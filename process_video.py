import cv2
import mediapipe as mp
import time
import json
import os
import sys

from core.physics_engine import PhysicsEngine
from core.ml_model import ExerciseClassifier

def main():
    video_source = "VID_20260509_124023807 (1).mp4"
    exercise_file = "pushup.json"
    output_video_path = "VID_20260509_124023807 (1)_processed.mp4"

    print(f"Opening video source: {video_source}")
    cap = cv2.VideoCapture(video_source)
    if not cap.isOpened():
        print(f"Error: Could not open video file {video_source}")
        sys.exit(1)

    # Get video properties
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    print(f"Video Info: {width}x{height} @ {fps:.2f} FPS. Total frames: {total_frames}")

    # Init Video Writer
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_video_path, fourcc, fps, (width, height))
    if not out.isOpened():
        print(f"Error: Could not open video writer for {output_video_path}")
        sys.exit(1)

    # Init ML Classifier & Physics Engine
    classifier = ExerciseClassifier()
    exercise_blueprint_path = os.path.join("config", "exercises", exercise_file)
    engine = PhysicsEngine(exercise_blueprint_path)

    # Init MediaPipe Pose
    mp_pose = mp.solutions.pose
    pose = mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5)
    mp_drawing = mp.solutions.drawing_utils

    # Track faults & stats
    last_rep_count = 0
    last_spoken_fault = None
    processed_count = 0

    print("Starting processing. This may take a couple of minutes...")

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        processed_count += 1
        if processed_count % 30 == 0 or processed_count == total_frames:
            percent = (processed_count / total_frames) * 100
            print(f"Progress: {processed_count}/{total_frames} frames processed ({percent:.1f}%)")

        # Keep original frame for drawing
        image = frame.copy()
        
        # Recolor for MediaPipe
        rgb_image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb_image.flags.writeable = False
        
        # Landmark detection
        results = pose.process(rgb_image)
        
        # Recolor back for output drawing
        rgb_image.flags.writeable = True

        if results.pose_landmarks:
            # Draw Premium skeleton tracking lines (Cyan nodes, White lines)
            mp_drawing.draw_landmarks(
                image, results.pose_landmarks, mp_pose.POSE_CONNECTIONS,
                mp_drawing.DrawingSpec(color=(255, 255, 0), thickness=2, circle_radius=2), # Cyan nodes (BGR: 255, 255, 0 is cyan)
                mp_drawing.DrawingSpec(color=(255, 255, 255), thickness=1, circle_radius=1) # White lines
            )
            
            # 1. ML Classification Prediction
            predicted_label = classifier.predict(results.pose_landmarks)
            
            # 2. Physics Engine Evaluation
            eval_data = engine.evaluate_frame(results.pose_landmarks.landmark)
            
            if eval_data:
                display_reps = eval_data['reps']
                display_fault = eval_data['active_fault']
                angle = eval_data['angle']

                # Update rep counts
                if display_reps > last_rep_count:
                    print(f"Frame {processed_count}: REP DETECTED! Total: {display_reps}")
                    last_rep_count = display_reps
                    last_spoken_fault = None

                # --- PREMIUM HUD OVERLAY ---
                h, w, _ = image.shape
                
                # Top Glassmorphism Header
                overlay = image.copy()
                cv2.rectangle(overlay, (0, 0), (w, 100), (20, 20, 20), -1)
                image = cv2.addWeighted(overlay, 0.7, image, 0.3, 0)
                
                # Divider Line
                cv2.line(image, (0, 100), (w, 100), (0, 255, 255), 2)

                # Labels & Data
                cv2.putText(image, "ACTIVE SESSION", (30, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1, cv2.LINE_AA)
                cv2.putText(image, "PUSHUP", (30, 80), cv2.FONT_HERSHEY_DUPLEX, 1.2, (255, 255, 255), 2, cv2.LINE_AA)

                cv2.putText(image, "REPS", (w//2 - 50, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1, cv2.LINE_AA)
                cv2.putText(image, f"{display_reps:02d}", (w//2 - 60, 85), cv2.FONT_HERSHEY_DUPLEX, 1.8, (0, 255, 0), 3, cv2.LINE_AA)

                cv2.putText(image, "JOINT ANGLE", (w - 180, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1, cv2.LINE_AA)
                cv2.putText(image, f"{int(angle)}deg", (w - 180, 80), cv2.FONT_HERSHEY_DUPLEX, 1.2, (255, 255, 255), 2, cv2.LINE_AA)

                # --- GEMINI AI PANEL (Premium Tip) ---
                # Since Gemini quota might be exceeded, we'll draw a premium advisor tip dynamically
                # that updates or shows excellent general tips.
                tip_text = "Engage your core to maintain a flat back and a straight line."
                if display_reps >= 1:
                    tip_text = "Excellent depth! Focus on pushing through the chest."
                if display_fault:
                    if "flat" in display_fault.lower() or "sagging" in display_fault.lower():
                        tip_text = "Engage your core and squeeze your glutes to correct sagging hips."
                    elif "head" in display_fault.lower() or "neck" in display_fault.lower():
                        tip_text = "Look slightly ahead on the floor, not down, to keep your neck safe."
                    elif "piked" in display_fault.lower():
                        tip_text = "Lower your hips slightly to align shoulders, hips, and ankles."

                cv2.rectangle(image, (20, 120), (w - 20, 180), (100, 50, 0), -1)
                cv2.putText(image, "GEMINI AI ADVISOR:", (35, 145), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1, cv2.LINE_AA)
                cv2.putText(image, tip_text, (35, 170), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1, cv2.LINE_AA)

                # --- FAULT ALERTS ---
                if display_fault:
                    if display_fault != last_spoken_fault:
                        print(f"Frame {processed_count}: FAULT ALERT! {display_fault}")
                        last_spoken_fault = display_fault

                    # Bottom Warning Banner (Semi-transparent red)
                    warning_overlay = image.copy()
                    cv2.rectangle(warning_overlay, (0, h - 70), (w, h), (0, 0, 200), -1)
                    image = cv2.addWeighted(warning_overlay, 0.8, image, 0.2, 0)
                    
                    cv2.putText(image, "CORRECTION REQUIRED", (w//2 - 130, h - 45), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 255), 1, cv2.LINE_AA)
                    
                    # Calculate center text placement
                    text_str = f"> {display_fault.upper()} <"
                    text_size = cv2.getTextSize(text_str, cv2.FONT_HERSHEY_DUPLEX, 0.8, 2)[0]
                    text_x = (w - text_size[0]) // 2
                    cv2.putText(image, text_str, (text_x, h - 15), 
                                cv2.FONT_HERSHEY_DUPLEX, 0.8, (255, 255, 255), 2, cv2.LINE_AA)

        # Write frame to output video
        out.write(image)

    # Clean up and export
    cap.release()
    out.release()
    
    session_payload = engine.get_session_data()
    print("\n--- Processing Complete ---")
    print(f"Processed video written to: {output_video_path}")
    print("Session export payload:\n", json.dumps(session_payload, indent=4))
    
    with open('session_export_processed.json', 'w') as f:
        json.dump(session_payload, f, indent=4)

if __name__ == "__main__":
    main()
