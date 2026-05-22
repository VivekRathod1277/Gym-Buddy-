import google.generativeai as genai
import cv2
import PIL.Image
import os
from dotenv import load_dotenv
import threading

load_dotenv()

class AIAdvisor:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            print("WARNING: GEMINI_API_KEY not found in .env file.")
            self.model = None
            return
            
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.0-flash')
        self.is_analyzing = False
        self.last_suggestion = ""

    def analyze_frame(self, frame, exercise_name, callback):
        """
        Runs analysis in a separate thread to avoid blocking the main loop.
        """
        if not self.model or self.is_analyzing:
            return
            
        self.is_analyzing = True
        thread = threading.Thread(target=self._analyze_thread, args=(frame, exercise_name, callback))
        thread.start()

    def _analyze_thread(self, frame, exercise_name, callback):
        try:
            # Convert OpenCV BGR to RGB and then to PIL Image
            img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_img = PIL.Image.fromarray(img_rgb)
            
            prompt = f"""
            You are a professional fitness trainer. Analyze this image of a person performing a {exercise_name}.
            Identify any posture mistakes and give exactly ONE sentence of constructive feedback.
            Keep it short and encouraging for a voice assistant.
            """
            
            response = self.model.generate_content([prompt, pil_img])
            suggestion = response.text.strip()
            
            self.last_suggestion = suggestion
            callback(suggestion)
            
        except Exception as e:
            print(f"Gemini Analysis Error: {e}")
            callback("I'm having trouble analyzing the posture right now.")
        finally:
            self.is_analyzing = False

    def detect_exercise(self, frame):
        """
        Uses Gemini to identify the exercise being performed.
        """
        if not self.model:
            return "pushup" # Fallback
            
        try:
            img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_img = PIL.Image.fromarray(img_rgb)
            
            prompt = """
            Look at this gym setting. Which exercise is the person about to perform? 
            Respond with exactly ONE word from this list: pushup, pullup, squat, bicep_curl.
            If unsure, respond 'pushup'.
            """
            
            response = self.model.generate_content([prompt, pil_img])
            exercise = response.text.strip().lower()
            
            # Basic validation
            valid_exercises = ["pushup", "pullup", "squat", "bicep_curl"]
            for ex in valid_exercises:
                if ex in exercise:
                    return ex
            return "pushup"
        except Exception as e:
            print(f"Auto-Detect Error: {e}")
            return "pushup"
