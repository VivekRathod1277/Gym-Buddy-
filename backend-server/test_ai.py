import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
headers = {"Content-Type": "application/json"}
payload = {
    "contents": [{
        "parts": [{"text": "Hello, what is your name?"}]
    }]
}
res = requests.post(url, headers=headers, json=payload)
print(res.status_code)
print(res.json())
