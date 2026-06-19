import requests
import time
import sys

BASE_URL = "http://127.0.0.1:8000/api"
VIDEO_PATH = r"C:\Users\ratho\Desktop\Projects - Msc\Gym Posture\videos\input\Untitled design.mp4"

print("Starting backend integration test...")

# 1. Login to get token
login_data = {
    "email": "test@example.com",
    "password": "password"
}
try:
    print("Attempting to login...")
    login_res = requests.post(f"{BASE_URL}/auth/login-json", json=login_data)
    
    if login_res.status_code == 401:
        # Need to register first
        print("User not found, registering...")
        requests.post(f"{BASE_URL}/auth/register", json=login_data)
        login_res = requests.post(f"{BASE_URL}/auth/login-json", json=login_data)
        
    login_res.raise_for_status()
    token = login_res.json()["access_token"]
    print("Login successful.")
except Exception as e:
    print(f"Login failed: {e}")
    sys.exit(1)

headers = {"Authorization": f"Bearer {token}"}

# 2. Upload video
try:
    print(f"Uploading video {VIDEO_PATH}...")
    with open(VIDEO_PATH, "rb") as f:
        files = {"file": ("video.mp4", f, "video/mp4")}
        data = {"exercise": "auto"}
        upload_res = requests.post(f"{BASE_URL}/workout/process-video", headers=headers, files=files, data=data)
        
    upload_res.raise_for_status()
    task_id = upload_res.json()["task_id"]
    print(f"Upload successful. Task ID: {task_id}")
except Exception as e:
    print(f"Upload failed: {e}")
    sys.exit(1)

# 3. Poll status
print("Polling status...")
while True:
    status_res = requests.get(f"{BASE_URL}/workout/tasks/{task_id}", headers=headers)
    status_data = status_res.json()
    status = status_data["status"]
    progress = status_data.get("progress", 0)
    
    print(f"Status: {status} ({progress}%)")
    
    if status == "completed":
        print("\nProcessing Complete!")
        print("Result:", status_data["result"])
        break
    elif status == "failed":
        print(f"\nProcessing Failed: {status_data.get('error')}")
        break
        
    time.sleep(2)
