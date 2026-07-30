import os
import uuid
import cv2
import numpy as np
import base64
import threading
from typing import List, Dict
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form, status, WebSocket, WebSocketDisconnect
import asyncio
import time
from fastapi.responses import FileResponse
import mediapipe as mp

from backend.schemas import (
    DetectExerciseRequest, DetectExerciseResponse,
    AnalyzeFrameRequest, AnalyzeFrameResponse,
    TaskStatusResponse, TokenData
)
from backend.dependencies import get_current_user
from core.ai_advisor import AIAdvisor
from core.physics_engine import PhysicsEngine
from core.ml_model import ExerciseClassifier
from core.frame_enhancer import enhance_if_needed, LOW_LIGHT_TRACKING_CONFIDENCE
from core.cloudinary_helper import upload_video_to_cloudinary

# ─── Pose factory (Step 10) ───────────────────────────────────────────────────
# Single source of truth for MediaPipe Pose config so thresholds are never
# scattered across three separate pipeline functions.
POSE_DETECTION_CONFIDENCE = 0.5
POSE_TRACKING_CONFIDENCE = 0.5

def _make_pose(low_light: bool = False):
    """Return a configured mp.solutions.pose.Pose instance.
    For low-light frames a reduced tracking_confidence is used (Step 11)
    so that noisy landmark data doesn't immediately drop the tracked skeleton.
    """
    tracking_conf = (
        LOW_LIGHT_TRACKING_CONFIDENCE if low_light
        else POSE_TRACKING_CONFIDENCE
    )
    return mp.solutions.pose.Pose(
        min_detection_confidence=POSE_DETECTION_CONFIDENCE,
        min_tracking_confidence=tracking_conf,
    )
# ─────────────────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/api/workout", tags=["workout"])

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def _find_blueprint(exercise_file: str) -> str:
    """Find the exercise blueprint JSON, checking multiple possible locations."""
    candidates = [
        os.path.join(PROJECT_ROOT, "config", "exercises", exercise_file),
        os.path.join(os.getcwd(), "config", "exercises", exercise_file),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "config", "exercises", exercise_file),
    ]
    for path in candidates:
        resolved = os.path.abspath(path)
        if os.path.exists(resolved):
            print(f"[BLUEPRINT] Found '{exercise_file}' at: {resolved}", flush=True)
            return resolved
    print(f"[BLUEPRINT] ERROR: '{exercise_file}' not found in any of these locations:", flush=True)
    for path in candidates:
        print(f"  - {os.path.abspath(path)}", flush=True)
    print(f"[BLUEPRINT] CWD = {os.getcwd()}", flush=True)
    print(f"[BLUEPRINT] PROJECT_ROOT = {PROJECT_ROOT}", flush=True)
    print(f"[BLUEPRINT] __file__ = {os.path.abspath(__file__)}", flush=True)
    return ""

print(f"[STARTUP] PROJECT_ROOT resolved to: {PROJECT_ROOT}", flush=True)
print(f"[STARTUP] CWD: {os.getcwd()}", flush=True)

# Initialize advisor
advisor = AIAdvisor()

# Directory configuration inside the workspace
TEMP_DIR = "temp_uploads"
PROCESSED_DIR = "processed_videos"

os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)

# In-memory task tracker
tasks: Dict[str, dict] = {}

def decode_base64_frame(b64_str: str) -> np.ndarray:
    """Helper to convert base64 image string to OpenCV BGR frame."""
    try:
        if "," in b64_str:
            b64_str = b64_str.split(",")[1]
        img_data = base64.b64decode(b64_str)
        nparr = np.frombuffer(img_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("Decoded image is None")
        # Auto-orient: portrait frames from phone cameras are rotated to landscape
        
        return frame
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid base64 frame encoding: {e}"
        )

# ── MediaPipe landmark indices used by the skeleton overlay ──────────────────
# Full body connections we care about (matches the screenshot: torso + limbs).
_SKELETON_CONNECTIONS = [
    # Torso
    (11, 12),  # shoulders
    (11, 23),  # left shoulder → left hip
    (12, 24),  # right shoulder → right hip
    (23, 24),  # hips
    # Left arm
    (11, 13),  # left shoulder → elbow
    (13, 15),  # left elbow → wrist
    # Right arm
    (12, 14),  # right shoulder → elbow
    (14, 16),  # right elbow → wrist
    # Left leg
    (23, 25),  # left hip → knee
    (25, 27),  # left knee → ankle
    (27, 31),  # left ankle → foot index
    # Right leg
    (24, 26),  # right hip → knee
    (26, 28),  # right knee → ankle
    (28, 32),  # right ankle → foot index
]

# The key joint landmarks to draw circles on
_KEY_JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 31, 32]


def draw_skeleton_overlay(image, landmarks, has_fault: bool = False) -> None:
    """
    Draw a premium anatomical skeleton overlay on *image* (in-place).

    Style matches the reference screenshot:
      - Thick white bone lines with a subtle red/orange tint when a fault is
        active.
      - Large filled white circles at each key joint, with a faint glow ring.

    Args:
        image:      BGR frame (modified in-place).
        landmarks:  mediapipe NormalizedLandmarkList.
        has_fault:  When True, the bones are tinted red to flag bad form.
    """
    h, w = image.shape[:2]
    lm = landmarks.landmark

    # Colour scheme
    bone_color   = (80, 80, 255) if has_fault else (255, 255, 255)  # red on fault, white normally
    glow_color   = (40, 40, 180) if has_fault else (160, 200, 255)  # softer glow ring
    joint_color  = (255, 255, 255)  # always white
    bone_thick   = 3   # main bone line thickness
    glow_thick   = 7   # glow halo thickness (drawn first, lower opacity)
    joint_radius = 7   # filled circle radius
    glow_radius  = 11  # glow ring radius

    def _pt(idx):
        """Convert normalised coords → pixel coords, return None if low visibility."""
        if idx >= len(lm):
            return None
        mark = lm[idx]
        if mark.visibility < 0.1:   # lowered from 0.3 — distant-person landmarks often score 0.1–0.3
            return None
        return (int(mark.x * w), int(mark.y * h))

    # --- Bone connections (glow pass then solid pass) ---
    glow_overlay = image.copy()
    for (a, b) in _SKELETON_CONNECTIONS:
        pa, pb = _pt(a), _pt(b)
        if pa is None or pb is None:
            continue
        # Glow halo (semi-transparent thick line drawn on overlay)
        cv2.line(glow_overlay, pa, pb, glow_color, glow_thick, cv2.LINE_AA)
    # Blend the glow overlay at low alpha
    cv2.addWeighted(glow_overlay, 0.35, image, 0.65, 0, image)

    # Solid bone lines on top
    for (a, b) in _SKELETON_CONNECTIONS:
        pa, pb = _pt(a), _pt(b)
        if pa is None or pb is None:
            continue
        cv2.line(image, pa, pb, bone_color, bone_thick, cv2.LINE_AA)

    # --- Joint circles ---
    for idx in _KEY_JOINTS:
        pt = _pt(idx)
        if pt is None:
            continue
        # Glow ring
        cv2.circle(image, pt, glow_radius, glow_color, 2, cv2.LINE_AA)
        # Filled joint
        cv2.circle(image, pt, joint_radius, joint_color, -1, cv2.LINE_AA)


def draw_hud_overlay(image, exercise_name, display_reps, angle, display_fault, tip_text, is_analyzing=False):
    """
    Draw the Premium HUD overlay on a frame.
    Matches the desktop main.py overlay: top header bar, rep counter, joint angle,
    AI advisor panel, and fault warning banner.
    """
    h, w = image.shape[:2]

    # --- Top Glassmorphism Header ---
    overlay = image.copy()
    cv2.rectangle(overlay, (0, 0), (w, 100), (20, 20, 20), -1)
    image = cv2.addWeighted(overlay, 0.7, image, 0.3, 0)

    # Divider Line (Neon Cyan)
    cv2.line(image, (0, 100), (w, 100), (0, 255, 255), 2)

    # Exercise Name
    cv2.putText(image, "ACTIVE SESSION", (30, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1, cv2.LINE_AA)
    cv2.putText(image, f"{exercise_name.upper()}", (30, 80), cv2.FONT_HERSHEY_DUPLEX, 1.2, (255, 255, 255), 2, cv2.LINE_AA)

    # Rep Counter (center)
    cv2.putText(image, "REPS", (w//2 - 50, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1, cv2.LINE_AA)
    cv2.putText(image, f"{display_reps:02d}", (w//2 - 60, 85), cv2.FONT_HERSHEY_DUPLEX, 1.8, (0, 255, 0), 3, cv2.LINE_AA)

    # Joint Angle (right side)
    cv2.putText(image, "JOINT ANGLE", (w - 180, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1, cv2.LINE_AA)
    cv2.putText(image, f"{int(angle)}deg", (w - 180, 80), cv2.FONT_HERSHEY_DUPLEX, 1.2, (255, 255, 255), 2, cv2.LINE_AA)

    # --- AI Advisor Panel ---
    if tip_text and tip_text != "Get into position, analysis will begin shortly.":
        cv2.rectangle(image, (20, 120), (w - 20, 180), (100, 50, 0), -1)
        cv2.putText(image, "GEMINI AI ADVISOR:", (35, 145), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1, cv2.LINE_AA)
        display_tip = tip_text[:75] + "..." if len(tip_text) > 75 else tip_text
        cv2.putText(image, display_tip, (35, 170), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1, cv2.LINE_AA)
    elif is_analyzing:
        cv2.putText(image, "GEMINI IS ANALYZING...", (30, 145), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 200, 255), 1, cv2.LINE_AA)

    # --- Fault Warning Banner (bottom) ---
    if display_fault:
        warning_overlay = image.copy()
        cv2.rectangle(warning_overlay, (0, h - 70), (w, h), (0, 0, 200), -1)
        image = cv2.addWeighted(warning_overlay, 0.8, image, 0.2, 0)

        cv2.putText(image, "CORRECTION REQUIRED", (w//2 - 130, h - 45),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 255), 1, cv2.LINE_AA)
        fault_text = f"> {display_fault.upper()} <"
        cv2.putText(image, fault_text, (w//2 - (len(display_fault)*8), h - 15),
                    cv2.FONT_HERSHEY_DUPLEX, 0.8, (255, 255, 255), 2, cv2.LINE_AA)

    return image

# ─────────────────────────────────────────────
#  Exercise Detection and Frame Coaching
# ─────────────────────────────────────────────

@router.post("/detect-exercise", response_model=DetectExerciseResponse)
def detect_exercise_endpoint(payload: DetectExerciseRequest, _: TokenData = Depends(get_current_user)):
    """Analyze a single frame to auto-detect the exercise type using NVIDIA NIM AI."""
    frame = decode_base64_frame(payload.frame_b64)
    try:
        detected = advisor.detect_exercise(frame)
        return DetectExerciseResponse(exercise=detected)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Exercise detection failed: {e}"
        )

@router.post("/analyze-frame", response_model=AnalyzeFrameResponse)
def analyze_frame_endpoint(payload: AnalyzeFrameRequest, _: TokenData = Depends(get_current_user)):
    """
    Coaches the user's form on a single frame.
    Blocks internally using an event until the NVIDIA NIM callback returns.
    """
    frame = decode_base64_frame(payload.frame_b64)
    event = threading.Event()
    result = []

    def callback(text: str):
        result.append(text)
        event.set()

    try:
        advisor.analyze_frame(frame, payload.exercise_name, callback)
        
        # Wait up to 10 seconds for NVIDIA response
        success = event.wait(timeout=10.0)
        if not success or not result:
            return AnalyzeFrameResponse(feedback="Keep your form tight and focus on controlled movement.")
        
        return AnalyzeFrameResponse(feedback=result[0])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Frame analysis failed: {e}"
        )

# ─────────────────────────────────────────────
#  List Available Exercises
# ─────────────────────────────────────────────

@router.get("/exercises", response_model=List[str])
def list_exercises(_: TokenData = Depends(get_current_user)):
    """List all exercises available in the system config blueprints."""
    blueprint_dir = os.path.join(PROJECT_ROOT, "config", "exercises")
    if not os.path.exists(blueprint_dir):
        return ["pushup", "pullup", "squat", "bicep_curl"]
    
    files = os.listdir(blueprint_dir)
    exercises = [f.replace(".json", "") for f in files if f.endswith(".json")]
    return exercises

# ─────────────────────────────────────────────
#  Async Video Processing Pipeline
# ─────────────────────────────────────────────

def process_video_task(
    task_id: str,
    input_path: str,
    output_path: str,
    exercise_file: str,
    user_id: int
):
    """Background worker task to process video and compile stats."""
    tasks[task_id]["status"] = "processing"
    tasks[task_id]["progress"] = 0.0

    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        tasks[task_id]["status"] = "failed"
        tasks[task_id]["error"] = "Could not open uploaded video file"
        return

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    if total_frames <= 0:
        total_frames = 1  # prevent division by zero

    # Portrait uploaded videos: swap VideoWriter dimensions so the output is landscape
    _portrait_video = height > width
    if _portrait_video:
        width, height = height, width
        print(f"[VIDEO] Portrait video detected — rotating to landscape ({width}x{height})", flush=True)

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    if not out.isOpened():
        tasks[task_id]["status"] = "failed"
        tasks[task_id]["error"] = "Could not initialize video writer"
        cap.release()
        return

    # Handle auto exercise detection from first frame
    if exercise_file in ["auto", "auto.json"]:
        ret, frame = cap.read()
        if ret:
            detected = advisor.detect_exercise(frame)
            exercise_file = f"{detected}.json"
        else:
            exercise_file = "pushup.json"
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

    exercise_name = exercise_file.replace(".json", "")
    blueprint_path = _find_blueprint(exercise_file)
    
    if not blueprint_path:
        tasks[task_id]["status"] = "failed"
        tasks[task_id]["error"] = f"Exercise blueprint '{exercise_file}' not found. Check server logs for details."
        cap.release()
        out.release()
        return

    engine = PhysicsEngine(blueprint_path)
    classifier = ExerciseClassifier()

    mp_pose = mp.solutions.pose
    pose = _make_pose(low_light=False)  # Step 10: shared factory
    mp_drawing = mp.solutions.drawing_utils

    processed_count = 0
    last_rep_count = 0
    tip_text = "Get into position, analysis will begin shortly."
    last_fault = None
    display_fault = None  # initialised so skeleton overlay has a valid value from frame 1
    ai_last_trigger = 0

    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            # Auto-orient portrait uploaded videos to landscape
            if _portrait_video:
                frame = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)

            processed_count += 1
            # Update progress ratio
            tasks[task_id]["progress"] = round((processed_count / total_frames) * 100, 2)

            # Step 13: enhance before pose estimation
            enhanced_frame, frame_class = enhance_if_needed(frame)
            if frame_class == "low_light" and not hasattr(pose, "_low_light_mode"):
                pose.close()
                pose = _make_pose(low_light=True)
                pose._low_light_mode = True
            elif frame_class != "low_light" and hasattr(pose, "_low_light_mode"):
                pose.close()
                pose = _make_pose(low_light=False)

            image = enhanced_frame.copy()
            rgb_image = cv2.cvtColor(enhanced_frame, cv2.COLOR_BGR2RGB)
            rgb_image.flags.writeable = False
            results = pose.process(rgb_image)
            rgb_image.flags.writeable = True
            pose_confidence = (
                results.pose_landmarks.landmark[0].visibility
                if results.pose_landmarks else 0.0
            )

            if results.pose_landmarks:
                # Premium skeleton overlay (replaces mp_drawing default)
                draw_skeleton_overlay(image, results.pose_landmarks, has_fault=bool(display_fault))

                # Run custom posture classification prediction
                _ = classifier.predict(results.pose_landmarks)

                # Biomechanical analysis
                eval_data = engine.evaluate_frame(results.pose_landmarks.landmark)
                if eval_data:
                    display_reps = eval_data['reps']
                    display_fault = eval_data['active_fault']
                    angle = eval_data['angle']

                    if display_reps > last_rep_count:
                        last_rep_count = display_reps

                    # Draw Overlay HUD
                    h_img, w_img, _ = image.shape
                    overlay = image.copy()
                    cv2.rectangle(overlay, (0, 0), (w_img, 100), (20, 20, 20), -1)
                    image = cv2.addWeighted(overlay, 0.7, image, 0.3, 0)
                    cv2.line(image, (0, 100), (w_img, 100), (0, 255, 255), 2)

                    cv2.putText(image, "ACTIVE SESSION", (30, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1, cv2.LINE_AA)
                    cv2.putText(image, exercise_name.upper(), (30, 80), cv2.FONT_HERSHEY_DUPLEX, 1.2, (255, 255, 255), 2, cv2.LINE_AA)
                    cv2.putText(image, "REPS", (w_img//2 - 50, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1, cv2.LINE_AA)
                    cv2.putText(image, f"{display_reps:02d}", (w_img//2 - 60, 85), cv2.FONT_HERSHEY_DUPLEX, 1.8, (0, 255, 0), 3, cv2.LINE_AA)
                    cv2.putText(image, "JOINT ANGLE", (w_img - 180, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1, cv2.LINE_AA)
                    cv2.putText(image, f"{int(angle)}deg", (w_img - 180, 80), cv2.FONT_HERSHEY_DUPLEX, 1.2, (255, 255, 255), 2, cv2.LINE_AA)

                    # Contextual coaching tips with AI Advisor
                    should_trigger = False
                    if processed_count > 60 and not advisor.is_analyzing:
                        if display_fault and display_fault != last_fault:
                            should_trigger = True
                            last_fault = display_fault
                        elif processed_count - ai_last_trigger > fps * 4:  # every 4 seconds of video
                            should_trigger = True
                            
                    if should_trigger:
                        ai_last_trigger = processed_count
                        def on_ai_received(text):
                            nonlocal tip_text
                            tip_text = text
                        # Make sure to copy the frame if it's being drawn on, but here 'frame' is the raw frame
                        advisor.analyze_frame(frame, exercise_name, on_ai_received)
                    elif not display_fault:
                        last_fault = None

                    cv2.rectangle(image, (20, 120), (w_img - 20, 180), (100, 50, 0), -1)
                    cv2.putText(image, "GEMINI AI ADVISOR:", (35, 145), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1, cv2.LINE_AA)
                    cv2.putText(image, tip_text, (35, 170), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1, cv2.LINE_AA)

                    if display_fault:
                        warning_overlay = image.copy()
                        cv2.rectangle(warning_overlay, (0, h_img - 70), (w_img, h_img), (0, 0, 200), -1)
                        image = cv2.addWeighted(warning_overlay, 0.8, image, 0.2, 0)
                        cv2.putText(image, "CORRECTION REQUIRED", (w_img//2 - 130, h_img - 45), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 255), 1, cv2.LINE_AA)
                        text_str = f"> {display_fault.upper()} <"
                        text_size = cv2.getTextSize(text_str, cv2.FONT_HERSHEY_DUPLEX, 0.8, 2)[0]
                        text_x = (w_img - text_size[0]) // 2
                        cv2.putText(image, text_str, (text_x, h_img - 15), cv2.FONT_HERSHEY_DUPLEX, 0.8, (255, 255, 255), 2, cv2.LINE_AA)

            out.write(image)

        cap.release()
        out.release()

        # Compile session and save to DB
        session_data = engine.get_session_data()
        from core.database import save_session
        save_session(
            user_id=user_id,
            exercise_name=session_data["exercise"],
            total_reps=session_data["total_reps"],
            faults=session_data["faults_recorded"],
            ai_suggestion=tip_text
        )

        # Upload to Cloudinary
        cloudinary_url = upload_video_to_cloudinary(output_path)
        final_video_url = cloudinary_url if cloudinary_url else f"/api/workout/processed-videos/{os.path.basename(output_path)}"

        # Update final task status
        tasks[task_id]["status"] = "completed"
        tasks[task_id]["progress"] = 100.0
        tasks[task_id]["result"] = {
            "exercise": session_data["exercise"],
            "total_reps": session_data["total_reps"],
            "faults_recorded": session_data["faults_recorded"],
            "processed_video_url": final_video_url,
            "ai_suggestion": tip_text
        }

        # Cleanup input file and output file (if uploaded)
        if os.path.exists(input_path):
            os.remove(input_path)
        if cloudinary_url and os.path.exists(output_path):
            os.remove(output_path)

    except Exception as exc:
        tasks[task_id]["status"] = "failed"
        tasks[task_id]["error"] = str(exc)
        if os.path.exists(input_path):
            os.remove(input_path)


@router.post("/process-video", response_model=TaskStatusResponse)
def upload_video_endpoint(
    background_tasks: BackgroundTasks,
    exercise: str = Form("auto"),  # auto or squat, pushup, pullup, bicep_curl
    file: UploadFile = File(...),
    current_user: TokenData = Depends(get_current_user)
):
    """
    Accepts video upload, registers task, and runs processing pipeline in the background.
    """
    task_id = str(uuid.uuid4())
    input_filename = f"{task_id}_{file.filename}"
    input_path = os.path.join(TEMP_DIR, input_filename)
    
    # Save output to .mp4
    output_filename = f"processed_{task_id}.mp4"
    output_path = os.path.join(PROCESSED_DIR, output_filename)

    # Save uploaded file
    try:
        with open(input_path, "wb") as buffer:
            buffer.write(file.file.read())
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save uploaded file: {e}"
        )

    # Convert exercise name to file name
    if exercise == "auto":
        exercise_file = "auto"
    else:
        exercise_file = exercise if exercise.endswith(".json") else f"{exercise}.json"

    tasks[task_id] = {
        "task_id": task_id,
        "status": "pending",
        "progress": 0.0,
        "result": None,
        "error": None,
        "input_path": input_path,
        "output_path": output_path,
        "exercise_file": exercise_file,
        "user_id": current_user.user_id
    }

    # We do NOT start a background task here anymore.
    # The processing will be driven by the WebSocket connection to stream the frames live.
    return TaskStatusResponse(
        task_id=task_id,
        status="pending",
        progress=0.0,
        result=None,
        error=None
    )

@router.websocket("/ws/stream-video/{task_id}")
async def stream_video_ws(websocket: WebSocket, task_id: str):
    await websocket.accept()
    if task_id not in tasks:
        await websocket.send_json({"status": "failed", "error": "Task not found"})
        await websocket.close()
        return

    task_info = tasks[task_id]
    input_path = task_info["input_path"]
    output_path = task_info["output_path"]
    exercise_file = task_info["exercise_file"]
    user_id = task_info["user_id"]

    tasks[task_id]["status"] = "processing"

    print(f"[WS] Streaming started for task {task_id}", flush=True)
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        print("[WS] cap.isOpened() failed!", flush=True)
        tasks[task_id]["status"] = "failed"
        await websocket.send_json({"status": "failed", "error": "Could not open uploaded video file"})
        await websocket.close()
        if os.path.exists(input_path):
            os.remove(input_path)
        return

    print(f"[WS] Handling auto detect for {exercise_file}", flush=True)
    # Handle auto exercise detection from first frame
    if exercise_file in ["auto", "auto.json"]:
        ret, frame = cap.read()
        if ret:
            print("[WS] Read first frame, detecting exercise...", flush=True)
            detected = await asyncio.to_thread(advisor.detect_exercise, frame)
            print(f"[WS] Detected exercise: {detected}", flush=True)
            if detected == "unknown":
                print("[WS] AI returned unknown, falling back to squat", flush=True)
                detected = "squat"
            exercise_file = f"{detected}.json"
        else:
            print("[WS] Failed to read first frame for auto detect", flush=True)
            exercise_file = "pushup.json"
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        
    print(f"[WS] Loading blueprint for {exercise_file}", flush=True)
    exercise_name = exercise_file.replace(".json", "")
    blueprint_path = _find_blueprint(exercise_file)
    
    if not blueprint_path:
        tasks[task_id]["status"] = "failed"
        await websocket.send_json({"status": "failed", "error": f"Exercise blueprint '{exercise_file}' not found. Check server logs for details."})
        cap.release()
        await websocket.close()
        if os.path.exists(input_path):
            os.remove(input_path)
        return

    engine = PhysicsEngine(blueprint_path)
    classifier = ExerciseClassifier()

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_delay = 1.0 / fps # target delay to stream at 1x speed

    # Portrait uploaded videos: swap VideoWriter dimensions for landscape output
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    _portrait_video = height > width
    if _portrait_video:
        width, height = height, width
        print(f"[WS] Portrait video detected — rotating to landscape ({width}x{height})", flush=True)

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    try:
        print("[WS] Initializing mediapipe...", flush=True)
        mp_pose = mp.solutions.pose
        pose = _make_pose(low_light=False)  # Step 10
        mp_drawing = mp.solutions.drawing_utils
        print("[WS] Mediapipe initialized", flush=True)

        tip_text = "Get into position, analysis will begin shortly."
        last_rep_count = 0
        display_reps = 0
        display_fault = None
        last_fault = None
        angle = 0
        processed_count = 0
        ai_last_trigger = 0

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1

        # Only process every Nth frame. Use grab() to skip frames
        # without decoding them — this is the key to real-time speed.
        SKIP_FACTOR = 5

        while cap.isOpened():
            # grab() reads the next frame without decoding — very fast
            if not cap.grab():
                break

            processed_count += 1

            # Only decode and process every Nth frame
            if processed_count % SKIP_FACTOR != 0:
                continue

            frame_start_time = time.time()

            ret, frame = cap.retrieve()
            if not ret:
                break

            # Auto-orient portrait uploaded videos to landscape
            if _portrait_video:
                frame = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)

            # Step 13: enhance before pose estimation
            enhanced_frame, frame_class = enhance_if_needed(frame)
            if frame_class == "low_light" and not hasattr(pose, "_low_light_mode"):
                pose.close()
                pose = _make_pose(low_light=True)
                pose._low_light_mode = True
            elif frame_class != "low_light" and hasattr(pose, "_low_light_mode"):
                pose.close()
                pose = _make_pose(low_light=False)

            image = enhanced_frame.copy()
            rgb_image = cv2.cvtColor(enhanced_frame, cv2.COLOR_BGR2RGB)
            rgb_image.flags.writeable = False
            results = pose.process(rgb_image)
            rgb_image.flags.writeable = True

            if results.pose_landmarks:
                # Premium skeleton overlay
                draw_skeleton_overlay(image, results.pose_landmarks, has_fault=bool(display_fault))

                _ = classifier.predict(results.pose_landmarks)
                eval_data = engine.evaluate_frame(results.pose_landmarks.landmark)
                if eval_data:
                    display_reps = eval_data['reps']
                    display_fault = eval_data['active_fault']
                    angle = eval_data['angle']

                    if display_reps > last_rep_count:
                        last_rep_count = display_reps

                    # Contextual coaching tips with AI Advisor
                    should_trigger = False
                    if processed_count > 60 and not advisor.is_analyzing:
                        if display_fault and display_fault != last_fault:
                            should_trigger = True
                            last_fault = display_fault
                        elif processed_count - ai_last_trigger > fps * 4:
                            should_trigger = True
                            
                    if should_trigger:
                        ai_last_trigger = processed_count
                        def on_ai_received(text):
                            nonlocal tip_text
                            tip_text = text
                        advisor.analyze_frame(frame, exercise_name, on_ai_received)
                    elif not display_fault:
                        last_fault = None

            # Draw the HUD overlay on the frame (exercise name, reps, angle, AI tip, faults)
            image = draw_hud_overlay(image, exercise_name, display_reps, angle, display_fault, tip_text, advisor.is_analyzing)

            out.write(image)

            # Send frame + data over WebSocket
            _, buffer = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 50])
            b64_img = base64.b64encode(buffer).decode('utf-8')

            await websocket.send_json({
                "status": "processing",
                "frame": b64_img,
                "reps": display_reps,
                "angle": int(angle) if angle else 0,
                "fault": display_fault,
                "ai_tip": tip_text,
                "exercise": exercise_name,
                "progress": round((processed_count / total_frames) * 100, 1)
            })

            # Pace the stream to play at roughly normal 1x speed on the frontend
            elapsed = time.time() - frame_start_time
            sleep_time = (frame_delay * SKIP_FACTOR) - elapsed
            if sleep_time > 0:
                await asyncio.sleep(sleep_time)
            else:
                await asyncio.sleep(0)  # yield to event loop

        cap.release()
        out.release()

        session_data = engine.get_session_data()
        from core.database import save_session
        save_session(
            user_id=user_id,
            exercise_name=session_data["exercise"],
            total_reps=session_data["total_reps"],
            faults=session_data["faults_recorded"],
            ai_suggestion=tip_text
        )

        final_result = {
            "exercise": session_data["exercise"],
            "total_reps": session_data["total_reps"],
            "faults_recorded": session_data["faults_recorded"],
            "processed_video_url": f"/api/workout/processed-videos/{os.path.basename(output_path)}",
            "ai_suggestion": tip_text
        }

        tasks[task_id]["status"] = "completed"
        tasks[task_id]["result"] = final_result

        await websocket.send_json({
            "status": "completed",
            "result": final_result
        })

        if os.path.exists(input_path):
            os.remove(input_path)

        await websocket.close()

    except WebSocketDisconnect:
        print(f"Client disconnected for task {task_id}")
        cap.release()
        out.release()
    except Exception as exc:
        print(f"WS error: {exc}")
        tasks[task_id]["status"] = "failed"
        await websocket.send_json({"status": "failed", "error": str(exc)})
        await websocket.close()



@router.get("/tasks/{task_id}", response_model=TaskStatusResponse)
def get_task_status(task_id: str, _: TokenData = Depends(get_current_user)):
    """Fetch status and progress details of a video processing task."""
    if task_id not in tasks:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task ID not found"
        )
    return TaskStatusResponse(**tasks[task_id])


@router.get("/processed-videos/{filename}")
def download_processed_video(filename: str):
    """Download the final analyzed workout video file."""
    file_path = os.path.join(PROCESSED_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Processed video file not found"
        )
    return FileResponse(file_path, media_type="video/mp4", filename=filename)


@router.websocket("/ws/live-stream")
async def live_stream_ws(websocket: WebSocket, exercise: str = "auto", user_id: int = 1):
    await websocket.accept()

    print(f"[WS] Live stream started for user {user_id}, exercise {exercise}", flush=True)

    exercise_file = exercise if exercise.endswith(".json") else f"{exercise}.json"

    mp_pose = mp.solutions.pose
    pose_task = asyncio.create_task(asyncio.to_thread(_make_pose, False))
    pose = None
    mp_drawing = mp.solutions.drawing_utils
    # Step 12: temporal smoothing — hold last confident landmarks
    _last_landmarks = None
    _lost_frames = 0
    _HOLD_FRAMES = 5  # hold position for up to 5 missed frames

    if exercise_file in ["auto", "auto.json"]:
        try:
            detected_exercise = None
            is_detecting = False
            last_detect_time = 0.0
            # Bug fix: previously this loop had no exit condition other than a
            # successful detection. If the AI advisor is unavailable (missing/
            # invalid NVIDIA_API_KEY, rate limit, network error) detect_exercise()
            # returns "unknown" forever and the session hung on "DETECTING
            # EXERCISE..." indefinitely -- indistinguishable from "not analysing"
            # on the user's side. Fall back to a default exercise after
            # AUTO_DETECT_FALLBACK_SECS instead of looping forever.
            detect_start_time = time.time()
            AUTO_DETECT_FALLBACK_SECS = 8.0
            FALLBACK_EXERCISE = "pushup"

            def on_detected(result):
                nonlocal detected_exercise, is_detecting
                detected_exercise = result
                is_detecting = False

            while not detected_exercise or detected_exercise in ["unknown", "none", ""]:
                data = await websocket.receive_json()
                if "status" in data and data["status"] == "stop":
                    await websocket.close()
                    return
                if "frame" in data:
                    frame = decode_base64_frame(data["frame"])
                    
                    image = frame.copy()

                    if not pose_task.done():
                        results = None
                    else:
                        if pose is None:
                            pose = pose_task.result()
                        rgb_image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                        rgb_image.flags.writeable = False
                        results = await asyncio.to_thread(pose.process, rgb_image)
                        rgb_image.flags.writeable = True

                    if results and getattr(results, "pose_landmarks", None):
                        # Premium skeleton overlay during auto-detect phase
                        draw_skeleton_overlay(image, results.pose_landmarks, has_fault=False)

                    if not is_detecting and (time.time() - last_detect_time > 2.0):
                        is_detecting = True
                        last_detect_time = time.time()
                        print("[WS] Auto-detecting exercise from frame...", flush=True)
                        async def run_detection(f):
                            try:
                                res = await asyncio.to_thread(advisor.detect_exercise, f)
                                on_detected(res)
                            except Exception:
                                on_detected("unknown")
                        asyncio.create_task(run_detection(frame))

                    timed_out = (time.time() - detect_start_time) > AUTO_DETECT_FALLBACK_SECS

                    if detected_exercise and detected_exercise.lower() not in ["unknown", "none", "", "auto"]:
                        print(f"[WS] Detected exercise: {detected_exercise}", flush=True)
                        exercise_file = f"{detected_exercise}.json"
                        break
                    elif timed_out:
                        print(
                            f"[WS] Auto-detect timed out after {AUTO_DETECT_FALLBACK_SECS}s "
                            f"(AI advisor unavailable?) -- falling back to {FALLBACK_EXERCISE}",
                            flush=True
                        )
                        detected_exercise = FALLBACK_EXERCISE
                        exercise_file = f"{FALLBACK_EXERCISE}.json"
                        await websocket.send_json({
                            "status": "processing",
                            "ai_tip": f"Couldn't auto-detect your exercise \u2014 starting {FALLBACK_EXERCISE} instead.",
                            "exercise": FALLBACK_EXERCISE,
                            "reps": 0,
                            "angle": 0,
                            "fault": None
                        })
                        break
                    else:
                        # Draw detecting message on the frame
                        h, w = image.shape[:2]
                        overlay = image.copy()
                        cv2.rectangle(overlay, (0, 0), (w, 80), (20, 20, 20), -1)
                        image = cv2.addWeighted(overlay, 0.7, image, 0.3, 0)
                        cv2.putText(image, "DETECTING EXERCISE...", (30, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2, cv2.LINE_AA)
                        cv2.putText(image, "Please get in position", (30, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1, cv2.LINE_AA)
                        
                        _, buffer = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 50])
                        out_b64 = base64.b64encode(buffer).decode('utf-8')
                        await websocket.send_json({
                            "status": "processing",
                            "frame": out_b64,
                            "ai_tip": "Detecting exercise... Please get in position.",
                            "exercise": "auto",
                            "reps": 0,
                            "angle": 0,
                            "fault": None
                        })
                        await asyncio.sleep(0)
        except Exception as e:
            import traceback
            err_msg = traceback.format_exc()
            print(f"[WS] Auto-detect failed: {e}\n{err_msg}", flush=True)
            exercise_file = "pushup.json"
            try:
                await websocket.send_json({
                    "status": "processing",
                    "ai_tip": f"Auto-detect error: {str(e)}",
                    "exercise": "pushup",
                    "reps": 0,
                    "angle": 0,
                    "fault": None
                })
            except Exception:
                pass

    exercise_name = exercise_file.replace(".json", "")
    blueprint_path = _find_blueprint(exercise_file)
    
    if not blueprint_path:
        await websocket.send_json({"status": "failed", "error": f"Exercise blueprint '{exercise_file}' not found. Check server logs for details."})
        await websocket.close()
        return

    try:
        engine = PhysicsEngine(blueprint_path)
        classifier = ExerciseClassifier()

        tip_text = "Get into position, analysis will begin shortly."
        last_rep_count = 0
        display_reps = 0
        display_fault = None
        last_fault = None
        angle = 0
        processed_count = 0
        ai_last_trigger = 0

        while True:
            data = await websocket.receive_json()
            if "status" in data and data["status"] == "stop":
                break

            if "frame" not in data:
                continue

            frame_b64 = data["frame"]
            try:
                frame = decode_base64_frame(frame_b64)
            except Exception as e:
                print(f"Frame decode error: {e}")
                continue

            processed_count += 1

            # Step 13: enhance before pose estimation
            enhanced_frame, frame_class = enhance_if_needed(frame)
            image = enhanced_frame.copy()

            if not pose_task.done():
                results = None
            else:
                if pose is None:
                    pose = pose_task.result()
                    
                if frame_class == "low_light" and not hasattr(pose, "_low_light_mode"):
                    pose.close()
                    pose = await asyncio.to_thread(_make_pose, True)
                    pose._low_light_mode = True
                elif frame_class != "low_light" and hasattr(pose, "_low_light_mode"):
                    pose.close()
                    pose = await asyncio.to_thread(_make_pose, False)

                rgb_image = cv2.cvtColor(enhanced_frame, cv2.COLOR_BGR2RGB)
                rgb_image.flags.writeable = False
                results = await asyncio.to_thread(pose.process, rgb_image)
                rgb_image.flags.writeable = True

            # Step 12: temporal smoothing — hold last good skeleton on missed frames
            if results and getattr(results, "pose_landmarks", None):
                _last_landmarks = results.pose_landmarks
                _lost_frames = 0
            elif _last_landmarks is not None and _lost_frames < _HOLD_FRAMES:
                _lost_frames += 1
                if results is None:
                    class DummyRes: pass
                    results = DummyRes()
                results.pose_landmarks = _last_landmarks
            else:
                _lost_frames += 1

            pose_confidence = (
                results.pose_landmarks.landmark[0].visibility
                if results and getattr(results, "pose_landmarks", None) else 0.0
            )

            if results and getattr(results, "pose_landmarks", None):
                # Premium skeleton overlay
                draw_skeleton_overlay(image, results.pose_landmarks, has_fault=bool(display_fault))

                _ = classifier.predict(results.pose_landmarks)
                eval_data = engine.evaluate_frame(results.pose_landmarks.landmark)
                if eval_data:
                    display_reps = eval_data['reps']
                    display_fault = eval_data['active_fault']
                    angle = eval_data['angle']

                    if display_reps > last_rep_count:
                        last_rep_count = display_reps

                    # Contextual coaching tips with AI Advisor
                    should_trigger = False
                    if processed_count > 30 and not advisor.is_analyzing:
                        if display_fault and display_fault != last_fault:
                            should_trigger = True
                            last_fault = display_fault
                        elif processed_count - ai_last_trigger > 60: # Assume roughly 15fps, so every 4s
                            should_trigger = True
                            
                    if should_trigger:
                        ai_last_trigger = processed_count
                        def on_ai_received(text):
                            nonlocal tip_text
                            tip_text = text
                        advisor.analyze_frame(frame, exercise_name, on_ai_received)
                    elif not display_fault:
                        last_fault = None

            # Draw the HUD overlay on the frame
            image = draw_hud_overlay(image, exercise_name, display_reps, angle, display_fault, tip_text, advisor.is_analyzing)

            # Send full annotated frame as JPEG
            _, buffer = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 50])
            out_b64 = base64.b64encode(buffer).decode('utf-8')

            # Step 17: include pose_confidence so frontend can warn on low visibility
            await websocket.send_json({
                "status": "processing",
                "frame": out_b64,
                "reps": display_reps,
                "angle": int(angle) if angle else 0,
                "fault": display_fault,
                "ai_tip": tip_text,
                "exercise": exercise_name,
                "pose_confidence": round(float(pose_confidence), 3)
            })
            
            await asyncio.sleep(0)

        # On stop
        session_data = engine.get_session_data()
        from core.database import save_session
        save_session(
            user_id=user_id,
            exercise_name=session_data["exercise"],
            total_reps=session_data["total_reps"],
            faults=session_data["faults_recorded"],
            ai_suggestion=tip_text
        )

        final_result = {
            "exercise": session_data["exercise"],
            "total_reps": session_data["total_reps"],
            "faults_recorded": session_data["faults_recorded"],
            "ai_suggestion": tip_text
        }

        await websocket.send_json({
            "status": "completed",
            "result": final_result
        })

        await websocket.close()

    except WebSocketDisconnect:
        print(f"Live stream client disconnected")
    except Exception as exc:
        print(f"Live stream error: {exc}", flush=True)
        import traceback
        traceback.print_exc()
        try:
            await websocket.send_json({"status": "failed", "error": f"Server error: {str(exc)}"})
        except Exception:
            pass
        await websocket.close()




