import subprocess
import os
import sys

POST_TEXT = """🚀 Excited to share my latest project: Gym Posture AI Trainer! 🏋️‍♂️💻

Improving gym form isn't just about counting repetitions—it's about preventing injury and maximizing biomechanical efficiency. To solve this, I built a Real-Time Gym Posture & Biomechanical Analysis Platform!

Here's how it works:
It uses Computer Vision and Machine Learning to track body movements in real-time, automatically count reps, detect common form errors, and provide active, conversational feedback.

🌟 Key Features:
• 🎥 Real-Time Pose Tracking: Powered by MediaPipe to track 33 standard skeleton keypoints with low latency.
• 🤖 Custom ML Classification: Trains a Random Forest Classifier on custom landmark datasets to instantly detect faults (e.g., elbow flaring, neck strain).
• ⚙️ Biomechanical Physics Engine: Tracks joint angles and detects exercise phase changes (concentric vs. eccentric motion) for precise rep-counting.
• 🔊 Non-Blocking Voice Assistant: Offers direct, real-time auditory feedback (e.g. "Rep 1", "Keep your elbows tucked!") so you don't have to look at the screen.
• 🧠 Gemini AI Advisor: Integrates Google Gemini to analyze video frames and generate dynamic, personalized posture tips.
• 📊 Progress Dashboard: Built with Streamlit and backed by SQLite to support user authentication, log history, and track XP progression.

🛠️ Tech Stack:
• UI/Dashboard: Streamlit
• Computer Vision & Tracking: OpenCV, MediaPipe
• Machine Learning: Scikit-learn (Random Forest)
• Generative AI: Google Gemini API
• Database: SQLite
• Voice Feedback: Python pyttsx3 / OS TTS engine

Watch the demo below showcasing form correction in action! I'd love to hear your thoughts and feedback. 👇

#AI #ComputerVision #MachineLearning #MediaPipe #GeminiAI #Streamlit #FitnessTech #Python #OpenCV #BioMechanics #Developer #TechInnovation"""

def copy_to_clipboard(text):
    # Ensure stdout handles Unicode characters
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    try:
        # Use Windows built-in clip.exe utility
        process = subprocess.Popen('clip', stdin=subprocess.PIPE, shell=True, text=True, encoding='utf-8')
        process.communicate(input=text)
        print("\n" + "="*50)
        print("✨ SUCCESS: The premium LinkedIn post has been COPIED to your clipboard!")
        print("💡 Action: Go to https://www.linkedin.com and press Ctrl+V to paste your post.")
        print("="*50 + "\n")
    except Exception as e:
        print(f"Error copying to clipboard: {e}")

if __name__ == "__main__":
    copy_to_clipboard(POST_TEXT)

