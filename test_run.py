import cv2
import mediapipe as mp
import sys
import os

# Add backend-server to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend-server'))
from core.physics_engine import PhysicsEngine
from core.ml_model import ExerciseClassifier
from core.ai_advisor import AIAdvisor

def test_video(video_path):
    print(f"Testing video: {video_path}")
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print("Failed to open video")
        return

    # Use auto detection for first frame
    advisor = AIAdvisor()
    ret, frame = cap.read()
    if not ret:
        print("Failed to read first frame")
        return
        
    detected = advisor.detect_exercise(frame)
    print(f"Detected exercise: {detected}")
    
    exercise_file = f"{detected}.json"
    if detected == "unknown" or not detected:
        exercise_file = "pushup.json"
        
    blueprint_path = os.path.join('backend-server', 'config', 'exercises', exercise_file)
    if not os.path.exists(blueprint_path):
        print(f"Blueprint not found: {blueprint_path}")
        blueprint_path = os.path.join('backend-server', 'config', 'exercises', 'pushup.json')
        
    print(f"Using blueprint: {blueprint_path}")
    engine = PhysicsEngine(blueprint_path)
    
    mp_pose = mp.solutions.pose
    pose = mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5)

    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
    
    frame_count = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
            
        frame_count += 1
        rgb_image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = pose.process(rgb_image)
        
        if results.pose_landmarks:
            eval_data = engine.evaluate_frame(results.pose_landmarks.landmark)
            if eval_data and frame_count % 30 == 0:
                print(f"Frame {frame_count}: Reps={eval_data['reps']}, State={eval_data['state']}, Fault={eval_data['active_fault']}")
        else:
            if frame_count % 30 == 0:
                print(f"Frame {frame_count}: No pose detected")
                
    session_data = engine.get_session_data()
    print(f"Finished processing. Total frames: {frame_count}")
    print(f"Session data: {session_data}")
    
if __name__ == '__main__':
    test_video('test.mp4')
