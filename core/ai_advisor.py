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
        api_key = os.getenv("NVIDIA_API_KEY")
        if not api_key:
            print("WARNING: NVIDIA_API_KEY not found in .env file.")
            self.client = None
            return

        self.client = OpenAI(
            base_url="https://integrate.api.nvidia.com/v1",
            api_key=api_key,
        )
        self.model = "deepseek-ai/deepseek-v4-pro"
        self.is_analyzing = False
        self.last_suggestion = ""

    # ─────────────────────────────────────────────
    #  Internal helpers
    # ─────────────────────────────────────────────

    def _frame_to_base64(self, frame) -> str:
        """Convert an OpenCV BGR frame to a base64-encoded JPEG string."""
        img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_img = PIL.Image.fromarray(img_rgb)
        buffer = io.BytesIO()
        pil_img.save(buffer, format="JPEG", quality=85)
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
                f"You are a professional fitness trainer. "
                f"Analyze this image of a person performing a {exercise_name}. "
                f"Identify any posture mistakes and give exactly ONE sentence of "
                f"constructive feedback. Keep it short and encouraging — it will "
                f"be read aloud by a voice assistant."
            )

            response = self.client.chat.completions.create(
                model=self.model,
                messages=self._build_vision_messages(prompt, b64),
                temperature=0.7,
                top_p=0.95,
                max_tokens=128,
                extra_body={"chat_template_kwargs": {"thinking": False}},
                stream=False,
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
        Falls back to 'pushup' on any error.
        """
        if not self.client:
            return "pushup"

        try:
            b64 = self._frame_to_base64(frame)

            prompt = (
                "Look at this gym image. Which exercise is the person performing or about to perform? "
                "Respond with exactly ONE word from this list: pushup, pullup, squat, bicep_curl. "
                "If unsure, respond: pushup"
            )

            response = self.client.chat.completions.create(
                model=self.model,
                messages=self._build_vision_messages(prompt, b64),
                temperature=0.2,
                top_p=0.9,
                max_tokens=10,
                extra_body={"chat_template_kwargs": {"thinking": False}},
                stream=False,
            )

            exercise = response.choices[0].message.content.strip().lower()

            valid = ["pushup", "pullup", "squat", "bicep_curl"]
            for ex in valid:
                if ex in exercise:
                    return ex

            return "pushup"

        except Exception as e:
            print(f"[AIAdvisor] Exercise detection error: {e}")
            return "pushup"
