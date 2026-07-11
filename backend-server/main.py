import cv2
import mediapipe as mp
import time
import json
import os
import sys

from core.physics_engine import PhysicsEngine
from core.voice_feedback import VoiceAssistant
from core.ml_model import ExerciseClassifier
from core.ai_advisor import AIAdvisor

def main():
    video_source = 0
    exercise_file = "auto" # Default to AI auto-detection

    
    # Check for CLI arguments
    if len(sys.argv) > 1:
        video_source = sys.argv[1]
    if len(sys.argv) > 2:
        exercise_file = sys.argv[2]
    else:
        exercise_file = "auto" # Force auto if not specified
        

        
    print(f"Using video source: {video_source}")
    print(f"Using blueprint: {exercise_file}")

    # Init Core Modules
    voice = VoiceAssistant()
    advisor = AIAdvisor()
    classifier = ExerciseClassifier()

    # Init Camera (supports files and numbers)
    if isinstance(video_source, str) and video_source.isdigit():
        video_source = int(video_source)
    cap = cv2.VideoCapture(video_source)

    # Setup Paths with AI Auto-Detection
    if exercise_file == "auto" or not exercise_file:
        voice.speak("Analyzing video to detect exercise type.")
        ret, first_frame = cap.read()
        if ret:
            detected = advisor.detect_exercise(first_frame)
            if detected == "unknown":
                print("AI returned unknown, falling back to pushup")
                detected = "pushup"
            exercise_file = f"{detected}.json"
            voice.speak(f"Detected {detected}. Loading model.")
            # Reset video pointer after analysis frame
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        else:
            exercise_file = "pushup.json"
            
    exercise_blueprint_path = os.path.join("config", "exercises", exercise_file)
    
    # Init Physics Engine
    engine = PhysicsEngine(exercise_blueprint_path)

    # Init MediaPipe
    mp_pose = mp.solutions.pose
    pose = mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5)
    mp_drawing = mp.solutions.drawing_utils
    
    last_fault_time = 0.0
    last_rep_count = 0
    last_spoken_fault = None
    
    ai_feedback = ""
    ai_feedback_time = 0
    
    def on_ai_received(text):
        nonlocal ai_feedback, ai_feedback_time
        ai_feedback = text
        ai_feedback_time = time.time()
        voice.speak(f"AI Tip: {text}")

    voice.speak("System initialized. Starting analysis.")

    print(f"Starting session for {exercise_file}. Press 'a' for AI Analysis, 'q' to quit.")
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
            
        # Recolor
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        image.flags.writeable = False
        
        # Detection
        results = pose.process(image)
        
        # Recolor back
        image.flags.writeable = True
        image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)

        if results.pose_landmarks:
            # Premium tracking lines (Neon Cyan/Blue)
            mp_drawing.draw_landmarks(
                image, results.pose_landmarks, mp_pose.POSE_CONNECTIONS,
                mp_drawing.DrawingSpec(color=(255, 255, 0), thickness=2, circle_radius=2), # Cyan nodes
                mp_drawing.DrawingSpec(color=(255, 255, 255), thickness=1, circle_radius=1) # White lines
            )
            
            # 1. ML Classification Prediction (Optional use)
            predicted_ex = classifier.predict(results.pose_landmarks)
            
            # 2. Physics Engine Evaluation
            eval_data = engine.evaluate_frame(results.pose_landmarks.landmark)
            
            if eval_data:
                display_reps = eval_data['reps']
                display_fault = eval_data['active_fault']

                # Speak new reps out loud
                if display_reps > last_rep_count:
                    voice.speak(f"Rep {display_reps}")
                    last_rep_count = display_reps
                    # Reset fault memory on new rep so user can be corrected again in next rep
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
                cv2.putText(image, f"{exercise_file.split('.')[0].upper()}", (30, 80), cv2.FONT_HERSHEY_DUPLEX, 1.2, (255, 255, 255), 2, cv2.LINE_AA)

                cv2.putText(image, "REPS", (w//2 - 50, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1, cv2.LINE_AA)
                cv2.putText(image, f"{display_reps:02d}", (w//2 - 60, 85), cv2.FONT_HERSHEY_DUPLEX, 1.8, (0, 255, 0), 3, cv2.LINE_AA)

                cv2.putText(image, "JOINT ANGLE", (w - 180, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1, cv2.LINE_AA)
                cv2.putText(image, f"{int(eval_data['angle'])}deg", (w - 180, 80), cv2.FONT_HERSHEY_DUPLEX, 1.2, (255, 255, 255), 2, cv2.LINE_AA)

                # --- GEMINI AI PANEL ---
                if time.time() - ai_feedback_time < 8.0 and ai_feedback:
                    cv2.rectangle(image, (20, 120), (w - 20, 180), (100, 50, 0), -1)
                    cv2.putText(image, "GEMINI AI ADVISOR:", (35, 145), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1, cv2.LINE_AA)
                    cv2.putText(image, f"{ai_feedback[:75]}...", (35, 170), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1, cv2.LINE_AA)
                elif advisor.is_analyzing:
                    cv2.putText(image, "GEMINI IS ANALYZING...", (30, 145), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 200, 255), 1, cv2.LINE_AA)

                # --- FAULT ALERTS ---
                if display_fault:
                    # Prevent repetitive alerts for the same fault within the same rep
                    if display_fault != last_spoken_fault:
                        voice.speak(display_fault)
                        last_spoken_fault = display_fault

                        
                    # Bottom Warning Banner
                    warning_overlay = image.copy()
                    cv2.rectangle(warning_overlay, (0, h - 70), (w, h), (0, 0, 200), -1)
                    image = cv2.addWeighted(warning_overlay, 0.8, image, 0.2, 0)
                    
                    cv2.putText(image, "CORRECTION REQUIRED", (w//2 - 130, h - 45), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 255), 1, cv2.LINE_AA)
                    cv2.putText(image, f"> {display_fault.upper()} <", (w//2 - (len(display_fault)*8), h - 15), 
                                cv2.FONT_HERSHEY_DUPLEX, 0.8, (255, 255, 255), 2, cv2.LINE_AA)

        # Resize frame for display if too large
        max_w, max_h = 1280, 720
        h, w = image.shape[:2]
        if w > max_w or h > max_h:
            scaling_factor = min(max_w / w, max_h / h)
            image = cv2.resize(image, None, fx=scaling_factor, fy=scaling_factor, interpolation=cv2.INTER_AREA)

        cv2.imshow('Gym Posture AI', image)

        # Handle Keyboard Inputs
        key = cv2.waitKey(30) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('a'):
            print("Triggering Gemini AI Analysis...")
            advisor.analyze_frame(frame, exercise_file.split('.')[0], on_ai_received)

    # Clean up and export payload
    cap.release()
    cv2.destroyAllWindows()
    voice.close()

    
    session_payload = engine.get_session_data()
    print("\n--- Session Complete ---")
    print("Export Ready Payload:\n", json.dumps(session_payload, indent=4))
    
    with open('session_export.json', 'w') as f:
        json.dump(session_payload, f, indent=4)


        
if __name__ == "__main__":
    main()
