import os
from openai import OpenAI
try:
    client = OpenAI(
        base_url="https://api.deepseek.com",
        api_key=os.environ.get("DEEPSEEK_API_KEY", ""),
    )
    res = client.chat.completions.create(
        model="deepseek-chat",
        messages=[{"role": "user", "content": "hi"}],
        max_tokens=10
    )
    print("DEEPSEEK Success!")
except Exception as e:
    print(f"DEEPSEEK Error: {e}")
