import sys
import base64
import numpy as np
import cv2
from fastapi.testclient import TestClient

# Add current dir to path to import main
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.main import app

client = TestClient(app)

def get_blank_frame_b64():
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    _, buffer = cv2.imencode('.jpg', img)
    return base64.b64encode(buffer).decode('utf-8')

def test_websocket():
    print("Connecting to websocket...")
    try:
        with client.websocket_connect("/api/workout/ws/live-stream?exercise=auto") as websocket:
            print("Sending first blank frame...")
            websocket.send_json({"frame": get_blank_frame_b64()})
            
            response = websocket.receive_json()
            print("Response:", {k: v for k, v in response.items() if k != 'frame'})
            
            if response.get("ai_tip") == "Detecting exercise... Please get in position.":
                print("SUCCESS: The backend correctly waited for a valid exercise instead of locking onto pushup!")
            else:
                print("FAILURE: Expected waiting message, got something else.")
                
            websocket.send_json({"status": "stop"})
            print("Test finished.")
    except Exception as e:
        print(f"Test failed with error: {e}")

if __name__ == "__main__":
    test_websocket()
