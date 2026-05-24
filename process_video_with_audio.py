import cv2
import mediapipe as mp
import time
import json
import os
import sys
import subprocess

from core.physics_engine import PhysicsEngine
from core.ml_model import ExerciseClassifier

def main():
    video_source = "Test Video.mp4"
    exercise_file = "auto"
    temp_silent_video = "temp_silent.mp4"
    output_video_path = "Test Video_processed.mp4"

    # Check for CLI arguments
    if len(sys.argv) > 1:
        video_source = sys.argv[1]
    if len(sys.argv) > 2:
        exercise_file = sys.argv[2]
    if len(sys.argv) > 3:
        output_video_path = sys.argv[3]
    else:
        # Generate default output name
        base, ext = os.path.splitext(video_source)
        output_video_path = f"{base}_processed{ext}"

    # Slow motion factor (e.g., 2.0 = half speed / 2x duration)
    slow_motion_factor = 2.0

    print(f"Opening video source: {video_source}")
    cap = cv2.VideoCapture(video_source)
    if not cap.isOpened():
        print(f"Error: Could not open video file {video_source}")
        sys.exit(1)

    # Setup Paths with AI Auto-Detection
    if exercise_file == "auto" or not exercise_file:
        print("Analyzing video to detect exercise type...")
        ret, first_frame = cap.read()
        if ret:
            from core.ai_advisor import AIAdvisor
            advisor = AIAdvisor()
            detected = advisor.detect_exercise(first_frame)
            exercise_file = f"{detected}.json"
            print(f"Detected {detected}. Loading model.")
            # Reset video pointer after analysis frame
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        else:
            exercise_file = "pushup.json"

    if not exercise_file.endswith(".json"):
        exercise_file = f"{exercise_file}.json"

    # Get video properties
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    # Adjust output FPS for slow motion
    fps_output = fps / slow_motion_factor

    print(f"Video Info: {width}x{height} @ {fps:.2f} FPS (Output slow-motion: {fps_output:.2f} FPS). Total frames: {total_frames}")

    # Init Video Writer for temporary silent video at slower frame rate
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(temp_silent_video, fourcc, fps_output, (width, height))
    if not out.isOpened():
        print(f"Error: Could not open video writer for {temp_silent_video}")
        sys.exit(1)

    # Init ML Classifier & Physics Engine
    classifier = ExerciseClassifier()
    exercise_blueprint_path = os.path.join("config", "exercises", exercise_file)
    engine = PhysicsEngine(exercise_blueprint_path)

    # Init MediaPipe Pose
    mp_pose = mp.solutions.pose
    pose = mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5)
    mp_drawing = mp.solutions.drawing_utils

    # Voice scheduler queue
    voice_queue = []

    def queue_voice(text, trigger_ms):
        voice_queue.append({
            "text": text,
            "trigger_ms": trigger_ms
        })

    # Schedule initial welcome announcement
    exercise_display_name = exercise_file.split(".")[0].replace("_", " ").title()
    queue_voice(f"{exercise_display_name} session started.", 0)

    # Track faults & stats
    last_rep_count = 0
    last_spoken_fault = None
    last_fault_speak_time_ms = -10000  # Start far in the past to allow first alert instantly
    processed_count = 0

    print("Step 1: Processing video frames and skeleton analysis...")

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        processed_count += 1
        current_time_ms = int((processed_count / fps_output) * 1000)

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
                    rep_announcement = f"Rep {display_reps}"
                    print(f"Frame {processed_count} ({current_time_ms}ms): REP DETECTED! Total: {display_reps}")
                    queue_voice(rep_announcement, current_time_ms)
                    last_rep_count = display_reps
                    last_spoken_fault = None

                # Speak new faults with a general alert cooldown of 4500ms
                if display_fault and (display_fault != last_spoken_fault or (current_time_ms - last_fault_speak_time_ms) > 4500):
                    # Map long descriptions to short, punchy coaching cues for clear real-time speak timing
                    short_fault = display_fault
                    if "lower your hips" in display_fault.lower() or "piked" in display_fault.lower():
                        short_fault = "Lower your hips."
                    elif "keep your back flat" in display_fault.lower() or "sagging" in display_fault.lower():
                        short_fault = "Keep back flat."
                        
                    print(f"Frame {processed_count} ({current_time_ms}ms): FAULT ALERT! {short_fault}")
                    queue_voice(short_fault, current_time_ms)
                    last_spoken_fault = display_fault
                    last_fault_speak_time_ms = current_time_ms

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
                cv2.putText(image, exercise_display_name.upper(), (30, 80), cv2.FONT_HERSHEY_DUPLEX, 1.2, (255, 255, 255), 2, cv2.LINE_AA)

                cv2.putText(image, "REPS", (w//2 - 50, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1, cv2.LINE_AA)
                cv2.putText(image, f"{display_reps:02d}", (w//2 - 60, 85), cv2.FONT_HERSHEY_DUPLEX, 1.8, (0, 255, 0), 3, cv2.LINE_AA)

                cv2.putText(image, "JOINT ANGLE", (w - 180, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1, cv2.LINE_AA)
                cv2.putText(image, f"{int(angle)}deg", (w - 180, 80), cv2.FONT_HERSHEY_DUPLEX, 1.2, (255, 255, 255), 2, cv2.LINE_AA)

                # --- GEMINI AI PANEL (Premium Tip) ---
                tip_text = f"Keep your form steady during the {exercise_display_name.lower()}."
                if "pushup" in exercise_display_name.lower():
                    tip_text = "Engage your core to maintain a flat back and a straight line."
                elif "squat" in exercise_display_name.lower():
                    tip_text = "Keep your chest up and lower hips until thighs are parallel to ground."
                elif "pullup" in exercise_display_name.lower():
                    tip_text = "Pull up until your chin clears the bar. Squeeze shoulder blades."
                elif "bicep curl" in exercise_display_name.lower():
                    tip_text = "Keep elbows locked close to your torso and avoid swinging."

                if display_reps >= 1:
                    if "pushup" in exercise_display_name.lower():
                        tip_text = "Excellent depth! Focus on pushing through the chest."
                    elif "squat" in exercise_display_name.lower():
                        tip_text = "Great depth on the squat! Keep pushing through your heels."
                    elif "pullup" in exercise_display_name.lower():
                        tip_text = "Incredible pull strength! Ensure full extension at the bottom."
                    elif "bicep curl" in exercise_display_name.lower():
                        tip_text = "Perfect curl! Control the descent on the eccentric phase."

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

        # Write frame to silent video
        out.write(image)

    # Clean up video writer and capture
    cap.release()
    out.release()
    print("Step 1 Complete: Silent video frames generated.")

    # Step 2: Generate audio files using pyttsx3
    print("Step 2: Generating speech audio tracks...")
    import pyttsx3
    import wave
    engine_tts = pyttsx3.init()
    
    # We set rate and volume properties
    engine_tts.setProperty('rate', 170)
    engine_tts.setProperty('volume', 1.0)
    
    # Generate WAV files first
    for i, item in enumerate(voice_queue):
        wav_filename = f"temp_voice_{i}.wav"
        engine_tts.save_to_file(item["text"], wav_filename)
        item["wav_path"] = wav_filename
        
    engine_tts.runAndWait()
    del engine_tts
    
    # Helper function to get WAV duration
    def get_wav_duration_ms(file_path):
        try:
            with wave.open(file_path, 'rb') as wav_file:
                frames = wav_file.getnframes()
                rate = wav_file.getframerate()
                duration_s = frames / float(rate)
                return int(duration_s * 1000)
        except Exception as e:
            print(f"    Error reading WAV duration for {file_path}: {e}")
            return 2000 # default fallback 2s
            
    # Dynamically schedule start and end times based on actual durations
    print("  Calculating non-overlapping voice prompt schedule using actual audio durations...")
    last_voice_end_time_ms = 0
    for i, item in enumerate(voice_queue):
        duration_ms = get_wav_duration_ms(item["wav_path"])
        # Schedule after the last voice finishes to ensure zero overlap
        start_ms = max(item["trigger_ms"], last_voice_end_time_ms)
        end_ms = start_ms + duration_ms
        last_voice_end_time_ms = end_ms
        
        item["start_ms"] = start_ms
        item["duration_ms"] = duration_ms
        print(f"    Voice clip {i}: '{item['text']}'")
        print(f"      Trigger: {item['trigger_ms']}ms -> Scheduled: {start_ms}ms to {end_ms}ms (Duration: {duration_ms}ms)")
        
    print("Step 2 Complete: Audio clips generated and scheduled.")

    # Step 3: Mix and Merge Video and Audio using FFmpeg
    print("Step 3: Mixing voice audio tracks (excluding original video audio)...")
    
    # Force has_orig_audio = False to completely ignore original audio and eliminate noise
    has_orig_audio = False
    print("  Ignoring original video audio to eliminate noise as requested.")

    # Build FFmpeg command
    cmd = ["ffmpeg", "-y", "-i", temp_silent_video]
    # Do not add original video audio stream
        
    for item in voice_queue:
        cmd += ["-i", item["wav_path"]]
        
    filter_parts = []
    mix_inputs = []
    
    # Since there is no original video audio input, voice clips start at index 1
    start_idx = 1
    
    for i, item in enumerate(voice_queue):
        in_label = f"{start_idx + i}:a"
        out_label = f"a{i}"
        delay = item["start_ms"]
        # adelay uses millisecond timing
        filter_parts.append(f"[{in_label}]adelay={delay}|{delay}[{out_label}]")
        mix_inputs.append(f"[{out_label}]")
        
    if mix_inputs:
        filter_complex = ";".join(filter_parts)
        if filter_complex:
            filter_complex += ";"
        # Set normalize=0 to prevent volume degradation when mixing multiple inputs
        filter_complex += "".join(mix_inputs) + f"amix=inputs={len(mix_inputs)}:normalize=0[outa]"
        
        cmd += [
            "-filter_complex", filter_complex,
            "-map", "0:v",
            "-map", "[outa]",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-shortest",
            output_video_path
        ]
    else:
        cmd += ["-map", "0:v"]
        cmd += ["-c:v", "libx264", "-pix_fmt", "yuv420p", output_video_path]
        
    print("Executing FFmpeg...")
    try:
        subprocess.run(cmd, check=True)
        print("Step 3 Complete: Audio successfully merged into processed video.")
    except Exception as e:
        print(f"Error executing FFmpeg: {e}")
        sys.exit(1)

    # Step 4: Clean up temporary files
    print("Step 4: Cleaning up temporary cache files...")
    if os.path.exists(temp_silent_video):
        os.remove(temp_silent_video)
    for item in voice_queue:
        if os.path.exists(item["wav_path"]):
            os.remove(item["wav_path"])
            
    print("\n--- Process Complete! ---")
    print(f"Premium output video with voice feedback generated at: {output_video_path}")

if __name__ == "__main__":
    main()
