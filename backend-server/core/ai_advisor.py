"""
AI Advisor — NVIDIA NIM (DeepSeek-V4-Pro)
==========================================
Replaces Google Gemini with NVIDIA's OpenAI-compatible NIM API.
Runs analysis in a background thread to avoid blocking the main loop.
"""

import os
import base64
import threading
import cv2
import PIL.Image
import io
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()


class AIAdvisor:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("NVIDIA_API_KEY")
        if not api_key:
            print("WARNING: API Key not found in .env file.")
            self.client = None
            return

        self.client = OpenAI(
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            api_key=api_key,
        )
        self.model = "gemini-2.0-flash"
        self.is_analyzing = False
        self.last_suggestion = ""

    # ─────────────────────────────────────────────
    #  Internal helpers
    # ─────────────────────────────────────────────

    def _frame_to_base64(self, frame) -> str:
        """Convert an OpenCV BGR frame to a base64-encoded JPEG string."""
        img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_img = PIL.Image.fromarray(img_rgb)
        
        # Downscale to max 512px to prevent API timeouts and reduce latency
        max_size = 512
        if pil_img.width > max_size or pil_img.height > max_size:
            pil_img.thumbnail((max_size, max_size), PIL.Image.Resampling.LANCZOS)
            
        buffer = io.BytesIO()
        pil_img.save(buffer, format="JPEG", quality=80)
        return base64.b64encode(buffer.getvalue()).decode("utf-8")

    def _build_vision_messages(self, prompt: str, b64_image: str) -> list:
        """Build an OpenAI-compatible messages list with an embedded image."""
        return [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{b64_image}"
                        },
                    },
                ],
            }
        ]

    # ─────────────────────────────────────────────
    #  Public API
    # ─────────────────────────────────────────────

    def analyze_frame(self, frame, exercise_name: str, callback):
        """
        Sends the current frame to DeepSeek-V4-Pro for posture coaching.
        Runs in a background thread — non-blocking.
        """
        if not self.client or self.is_analyzing:
            return

        self.is_analyzing = True
        thread = threading.Thread(
            target=self._analyze_thread,
            args=(frame, exercise_name, callback),
        )
        thread.daemon = True
        thread.start()

    def _analyze_thread(self, frame, exercise_name: str, callback):
        try:
            b64 = self._frame_to_base64(frame)

            prompt = (
                f"You are a human fitness trainer giving real-time feedback. "
                f"Analyze this image of a person performing a {exercise_name}. "
                f"Give extremely short, punchy feedback (max 6 words). "
                f"Be conversational, varied, and avoid robotic AI-speak. "
                f"Examples: 'Drop your hips!', 'Looking good!', 'Straighten your back!'. "
                f"Provide a unique, fresh phrasing this time."
            )

            response = self.client.chat.completions.create(
                model=self.model,
                messages=self._build_vision_messages(prompt, b64),
                temperature=0.7,
                top_p=0.95,
                max_tokens=128,
                stream=False,
                timeout=5.0,
            )

            suggestion = response.choices[0].message.content.strip()
            self.last_suggestion = suggestion
            callback(suggestion)

        except Exception as e:
            print(f"[AIAdvisor] Analysis error: {e}")
            callback("Keep your form tight and focus on controlled movement.")
        finally:
            self.is_analyzing = False

    def detect_exercise(self, frame) -> str:
        """
        Uses DeepSeek-V4-Pro vision to identify the exercise in the first frame.
        Falls back to 'unknown' on any error or if unsure.
        """
        if not self.client:
            return "unknown"

        try:
            b64 = self._frame_to_base64(frame)

            prompt = (
                "Look at this gym image. Which exercise is the person performing or about to perform? "
                "Respond with exactly ONE word from this list: pushup, pullup, squat, bicep_curl. "
                "If no person is clearly visible or they are not in a position to start any of these exercises, respond: unknown"
            )

            response = self.client.chat.completions.create(
                model=self.model,
                messages=self._build_vision_messages(prompt, b64),
                temperature=0.2,
                top_p=0.9,
                max_tokens=10,
                stream=False,
                timeout=5.0,
            )

            exercise = response.choices[0].message.content.strip().lower()

            valid = ["pushup", "pullup", "squat", "bicep_curl"]
            for ex in valid:
                if ex in exercise:
                    return ex

            return "unknown"

        except Exception as e:
            print(f"[AIAdvisor] Exercise detection error: {e}")
            return "unknown"
