import cv2
import asyncio
from core.ai_advisor import AIAdvisor

async def main():
    video_path = "C:/Users/ratho/Desktop/Projects - Msc/Gym Posture/chest press.mp4"
    cap = cv2.VideoCapture(video_path)
    ret, frame = cap.read()
    if not ret:
        print("Failed to read video")
        return
    
    advisor = AIAdvisor()
    print("Sending frame to AIAdvisor...")
    detected = await asyncio.to_thread(advisor.detect_exercise, frame)
    print(f"Detected exercise: {detected}")

if __name__ == "__main__":
    asyncio.run(main())
