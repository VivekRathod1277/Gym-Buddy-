import cv2
import sys
import mediapipe as mp
import argparse
import os

# Add parent dir to path so we can import core modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.frame_enhancer import enhance_if_needed

def test_detection(video_path, enhance=False):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error: Cannot open {video_path}")
        return 0.0, 0.0

    mp_pose = mp.solutions.pose
    # For fair comparison, we use standard confidence without low-light track scaling,
    # or we can just measure raw detection. Let's use 0.5/0.5
    pose = mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5)

    total_frames = 0
    detected_frames = 0
    total_confidence = 0.0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        total_frames += 1
        
        if enhance:
            frame, _ = enhance_if_needed(frame)

        rgb_image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb_image.flags.writeable = False
        results = pose.process(rgb_image)
        rgb_image.flags.writeable = True

        if results.pose_landmarks:
            detected_frames += 1
            # Average visibility of all landmarks as confidence proxy
            visibilities = [lm.visibility for lm in results.pose_landmarks.landmark]
            avg_vis = sum(visibilities) / len(visibilities)
            total_confidence += avg_vis

    cap.release()
    pose.close()

    success_rate = (detected_frames / total_frames * 100) if total_frames > 0 else 0.0
    avg_conf = (total_confidence / detected_frames) if detected_frames > 0 else 0.0

    return success_rate, avg_conf

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Benchmark pose detection with/without enhancement.")
    parser.add_argument("video", help="Path to video (e.g., synthetic low-light video)")
    args = parser.parse_args()

    print(f"Benchmarking video: {args.video}")
    print("--------------------------------------------------")
    
    print("Running WITHOUT enhancement...")
    succ_raw, conf_raw = test_detection(args.video, enhance=False)
    
    print("Running WITH enhancement...")
    succ_enh, conf_enh = test_detection(args.video, enhance=True)

    print("--------------------------------------------------")
    print(f"RESULTS FOR: {args.video}")
    print(f"Without Enhancement : Success Rate: {succ_raw:.2f}%, Avg Confidence: {conf_raw:.3f}")
    print(f"With Enhancement    : Success Rate: {succ_enh:.2f}%, Avg Confidence: {conf_enh:.3f}")
    print("--------------------------------------------------")
