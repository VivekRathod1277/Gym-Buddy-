import cv2
import numpy as np
import argparse
import os

def create_synthetic_lowlight(input_path, output_path, darkness_factor=0.3, noise_level=15):
    """
    Simulates a low-light environment by reducing brightness and adding sensor noise.
    - darkness_factor: 1.0 is original, 0.3 means 30% brightness.
    - noise_level: Standard deviation for Gaussian noise.
    """
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        print(f"Error: Could not open {input_path}")
        return

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    print(f"Processing {input_path} -> {output_path}")
    print(f"Darkness Factor: {darkness_factor}, Noise Level: {noise_level}")

    frame_count = 0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # 1. Darken image
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV).astype(np.float32)
        hsv[:, :, 2] = hsv[:, :, 2] * darkness_factor
        hsv[:, :, 2] = np.clip(hsv[:, :, 2], 0, 255)
        dark_frame = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)

        # 2. Add Gaussian noise to simulate high ISO / low light sensor noise
        noise = np.random.normal(0, noise_level, dark_frame.shape)
        noisy_frame = dark_frame.astype(np.float32) + noise
        noisy_frame = np.clip(noisy_frame, 0, 255).astype(np.uint8)

        out.write(noisy_frame)
        frame_count += 1
        
        if frame_count % 30 == 0:
            print(f"Processed {frame_count}/{total_frames} frames", end='\r')

    print(f"\nDone! Saved to {output_path}")
    cap.release()
    out.release()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create synthetic low-light video.")
    parser.add_argument("input", help="Path to input video")
    parser.add_argument("output", help="Path to output video")
    parser.add_argument("--darkness", type=float, default=0.25, help="Darkness factor (0.0 to 1.0)")
    parser.add_argument("--noise", type=float, default=25.0, help="Noise standard deviation")
    args = parser.parse_args()

    create_synthetic_lowlight(args.input, args.output, args.darkness, args.noise)
