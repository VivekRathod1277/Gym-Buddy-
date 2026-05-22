"""
Landmark Data Collector
========================
Run this script while performing exercises in front of your webcam.
Press the labelled key to tag the current pose, and 'q' to quit.

Output: data/labeled_landmarks.csv
"""

import cv2
import mediapipe as mp
import csv
import os
import time

OUTPUT_DIR  = "data"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "labeled_landmarks.csv")
os.makedirs(OUTPUT_DIR, exist_ok=True)

KEY_MAP = {
    ord("1"): "good_form",
    ord("2"): "bad_form_partial",
    ord("3"): "bad_form_elbow",
    ord("4"): "bad_form_neck",
    ord("r"): "rest",
}

mp_pose = mp.solutions.pose

def get_header():
    header = []
    for i in range(33):
        header += [f"x{i}", f"y{i}", f"z{i}", f"v{i}"]
    header += ["label", "exercise"]
    return header

def collect(exercise_name="pushup"):
    pose = mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5)
    cap  = cv2.VideoCapture(0)

    file_exists = os.path.isfile(OUTPUT_FILE)
    csv_file    = open(OUTPUT_FILE, "a", newline="")
    writer      = csv.writer(csv_file)

    if not file_exists:
        writer.writerow(get_header())

    current_label = "rest"
    count = 0

    print("Keys: 1=good_form | 2=bad_partial | 3=bad_elbow | 4=bad_neck | r=rest | q=quit")

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = pose.process(rgb)

        if results.pose_landmarks:
            row = []
            for lm in results.pose_landmarks.landmark:
                row += [lm.x, lm.y, lm.z, lm.visibility]
            row += [current_label, exercise_name]
            writer.writerow(row)
            count += 1

        cv2.putText(frame, f"Label: {current_label}  |  Samples: {count}",
                    (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        cv2.imshow("Data Collector — Gym Trainer", frame)

        key = cv2.waitKey(10) & 0xFF
        if key == ord("q"):
            break
        elif key in KEY_MAP:
            current_label = KEY_MAP[key]
            print(f"Label switched → {current_label}")

    csv_file.close()
    cap.release()
    cv2.destroyAllWindows()
    print(f"\n[DONE] {count} samples saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    exercise = input("Enter exercise name (default: pushup): ").strip() or "pushup"
    collect(exercise)
