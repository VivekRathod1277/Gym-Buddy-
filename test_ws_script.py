import asyncio
import websockets
import json
import requests
import sys

BASE_URL = "http://127.0.0.1:8000/api"
WS_URL = "ws://127.0.0.1:8000/api/workout/ws/stream-video"
VIDEO_PATH = r"C:\Users\ratho\Desktop\Projects - Msc\Gym Posture\videos\input\Untitled design.mp4"

async def test_websocket():
    # 1. Login
    print("Logging in...")
    login_data = {"email": "test@example.com", "password": "password"}
    try:
        res = requests.post(f"{BASE_URL}/auth/login-json", json=login_data)
        if res.status_code == 401:
            requests.post(f"{BASE_URL}/auth/register", json=login_data)
            res = requests.post(f"{BASE_URL}/auth/login-json", json=login_data)
        res.raise_for_status()
        token = res.json()["access_token"]
    except Exception as e:
        print(f"Login failed: {e}")
        return

    headers = {"Authorization": f"Bearer {token}"}

    # 2. Upload video
    print("Uploading video...")
    try:
        with open(VIDEO_PATH, "rb") as f:
            files = {"file": ("video.mp4", f, "video/mp4")}
            data = {"exercise": "auto"}
            res = requests.post(f"{BASE_URL}/workout/process-video", headers=headers, files=files, data=data)
        res.raise_for_status()
        task_id = res.json()["task_id"]
        print(f"Upload successful. Task ID: {task_id}")
    except Exception as e:
        print(f"Upload failed: {e}")
        return

    # 3. Connect to WebSocket
    print("Connecting to WebSocket...")
    try:
        async with websockets.connect(f"{WS_URL}/{task_id}", open_timeout=60) as ws:
            print("Connected! Listening for frames and AI tips...")
            while True:
                try:
                    message = await ws.recv()
                    data = json.loads(message)
                    if data.get("status") == "processing":
                        ai_tip = data.get("ai_tip")
                        fault = data.get("fault")
                        reps = data.get("reps")
                        print(f"Rep: {reps} | Fault: {fault} | AI TIP: {ai_tip}")
                    elif data.get("status") == "completed":
                        print("Processing completed!")
                        break
                    elif data.get("status") == "failed":
                        print(f"Processing failed: {data.get('error')}")
                        break
                except websockets.exceptions.ConnectionClosed:
                    print("Connection closed by server.")
                    break
    except Exception as e:
        print(f"WebSocket error: {e}")

if __name__ == "__main__":
    asyncio.run(test_websocket())
