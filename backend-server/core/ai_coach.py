"""
AI Coach — NVIDIA NIM (DeepSeek-V4-Pro) Conversational Trainer
================================================================
Provides the conversational "personal trainer" persona for the guided
workout flow. Each method generates voice-ready text that the frontend
speaks aloud.

Uses the same NVIDIA NIM endpoint as AIAdvisor but with system prompts
tuned for each coaching role (greeting, scheduling, positioning, etc.).
"""

import os
import json
from datetime import datetime
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()


class AICoach:
    def __init__(self):
        api_key = os.getenv("NVIDIA_API_KEY")
        if not api_key:
            print("WARNING: NVIDIA_API_KEY not found — AICoach will use fallback responses.")
            self.client = None
            return

        self.client = OpenAI(
            base_url="https://integrate.api.nvidia.com/v1",
            api_key=api_key,
        )
        self.model = "deepseek-ai/deepseek-v4-pro"

    # ─────────────────────────────────────────────────────────────────────
    #  Internal helper
    # ─────────────────────────────────────────────────────────────────────

    def _chat(self, system_prompt: str, user_prompt: str, max_tokens: int = 200, temperature: float = 0.8) -> str:
        """Send a chat completion request and return the text response."""
        if not self.client:
            return ""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=temperature,
                top_p=0.95,
                max_tokens=max_tokens,
                stream=False,
                timeout=10.0,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"[AICoach] API error: {e}")
            return ""

    # ─────────────────────────────────────────────────────────────────────
    #  1. Greeting
    # ─────────────────────────────────────────────────────────────────────

    def generate_greeting(self, user_name: str | None, last_session: dict | None) -> str:
        """
        Generate a personalized voice greeting referencing the user's last
        workout faults and performance.
        """
        system = (
            "You are an enthusiastic, warm personal gym trainer named Buddy. "
            "Generate a short greeting (2-3 sentences max) for a user who just "
            "opened the app. Be conversational, motivating, and natural — like "
            "a real trainer greeting someone at the gym. Speak directly to them. "
            "If they had faults in their last session, briefly reference ONE "
            "specific fault and say you'll work on it today. "
            "Do NOT use emojis, markdown, or asterisks. Just plain spoken text."
        )

        name = user_name or "champ"
        if last_session and last_session.get("faults"):
            faults = last_session["faults"]
            exercise = last_session.get("exercise_name", "workout")
            reps = last_session.get("total_reps", 0)
            timestamp = last_session.get("timestamp", "")
            user_msg = (
                f"User's name: {name}. "
                f"Last session: {exercise}, {reps} reps. "
                f"Faults detected: {', '.join(faults)}. "
                f"Session date: {timestamp}."
            )
        elif last_session:
            exercise = last_session.get("exercise_name", "workout")
            reps = last_session.get("total_reps", 0)
            user_msg = (
                f"User's name: {name}. "
                f"Last session: {exercise}, {reps} reps, no faults. Great form!"
            )
        else:
            user_msg = f"User's name: {name}. This is their first session — no history yet."

        result = self._chat(system, user_msg, max_tokens=150)
        if not result:
            # Fallback greeting
            if last_session and last_session.get("faults"):
                fault = last_session["faults"][0].replace("_", " ").lower()
                return f"Welcome back, {name}! Last time I noticed some {fault} issues. Let's clean that up today — you've got this!"
            elif last_session:
                return f"Welcome back, {name}! Your form was solid last time. Let's keep that momentum going!"
            else:
                return f"Hey {name}! Welcome to Gym Buddy. I'm your AI trainer — let's get started with your first workout!"

        return result

    # ─────────────────────────────────────────────────────────────────────
    #  2. Workout Suggestion
    # ─────────────────────────────────────────────────────────────────────

    def suggest_workout(self, weekly_history: dict) -> dict:
        """
        Analyze weekly training distribution and suggest today's exercise.
        Returns: {"suggested_exercise": str, "muscle_group": str, "reasoning": str}
        """
        system = (
            "You are a personal trainer planning today's workout. "
            "Based on the user's weekly training history, suggest which muscle group "
            "and exercise to train today. Consider: muscles trained recently should rest, "
            "undertrained areas should be prioritized. "
            "Respond in EXACTLY this JSON format, nothing else:\n"
            '{"suggested_exercise": "exercise_name", "muscle_group": "group", "reasoning": "1-2 sentence spoken explanation"}\n'
            "Valid exercises: pushup, pullup, squat, bicep_curl, chest_press. "
            "Valid muscle groups: chest, back, legs, arms. "
            "The reasoning should sound like a trainer speaking naturally. No emojis or markdown."
        )

        user_msg = f"Weekly training history (sessions per muscle group in last 7 days): {json.dumps(weekly_history)}"

        result = self._chat(system, user_msg, max_tokens=150, temperature=0.5)

        # Try to parse JSON response
        try:
            if result:
                # Clean potential markdown fences
                cleaned = result.strip()
                if cleaned.startswith("```"):
                    cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
                    cleaned = cleaned.rsplit("```", 1)[0]
                data = json.loads(cleaned.strip())
                return {
                    "suggested_exercise": data.get("suggested_exercise", "pushup"),
                    "muscle_group": data.get("muscle_group", "chest"),
                    "reasoning": data.get("reasoning", "Let's get a solid workout in today."),
                }
        except (json.JSONDecodeError, KeyError):
            pass

        # Fallback: suggest the least-trained muscle group
        min_group = min(weekly_history, key=weekly_history.get)
        exercise_map = {"chest": "pushup", "back": "pullup", "legs": "squat", "arms": "bicep_curl"}
        exercise = exercise_map.get(min_group, "pushup")
        return {
            "suggested_exercise": exercise,
            "muscle_group": min_group,
            "reasoning": f"You haven't trained {min_group} much this week. Let's hit it today!",
        }

    def suggest_workout_from_routine(self, day_num: int, workout_type: str, focus: str, exercises: list, trackable_exercises: list, suggested_exercise: str) -> dict:
        """
        Generate a personalized workout suggestion based on the user's generated weekly routine.
        """
        system = (
            "You are a personal trainer planning today's workout based on the user's AI-generated 7-day routine. "
            "Explain what day of the routine it is, the workout type, focus, and what exercises are scheduled. "
            "If there are trackable exercises (like pushups, squats, bicep curls, pullups, chest press), suggest starting with one of them. "
            "If it's a rest/recovery/cardio day with no trackable exercises, mention that but encourage them to do a trackable exercise anyway to keep their momentum. "
            "Respond in EXACTLY this JSON format, nothing else:\n"
            '{"suggested_exercise": "exercise_name", "muscle_group": "group", "reasoning": "1-2 sentence spoken explanation"}\n'
            "Valid exercises: pushup, pullup, squat, bicep_curl, chest_press. "
            "Valid muscle groups: chest, back, legs, arms. "
            "The reasoning should sound like a trainer speaking naturally. No emojis or markdown."
        )

        user_msg = (
            f"Routine Day: Day {day_num}. "
            f"Workout Type: {workout_type}. "
            f"Focus: {focus}. "
            f"Scheduled Exercises: {', '.join([ex.get('name', '') for ex in exercises])}. "
            f"AI-Trackable Exercises on Schedule: {', '.join(trackable_exercises) if trackable_exercises else 'None'}. "
            f"Suggested Exercise to Track: {suggested_exercise}."
        )

        result = self._chat(system, user_msg, max_tokens=180, temperature=0.5)

        try:
            if result:
                cleaned = result.strip()
                if cleaned.startswith("```"):
                    cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
                    cleaned = cleaned.rsplit("```", 1)[0]
                data = json.loads(cleaned.strip())
                return {
                    "suggested_exercise": data.get("suggested_exercise", suggested_exercise),
                    "muscle_group": data.get("muscle_group", "chest"),
                    "reasoning": data.get("reasoning", f"Today is Day {day_num}, a {workout_type} day. Let's do some {suggested_exercise}!"),
                }
        except Exception:
            pass

        # Fallback reasoning
        muscle_group = "chest"
        if suggested_exercise == "pullup":
            muscle_group = "back"
        elif suggested_exercise == "squat":
            muscle_group = "legs"
        elif suggested_exercise == "bicep_curl":
            muscle_group = "arms"
        elif suggested_exercise == "chest_press":
            muscle_group = "chest"

        if trackable_exercises:
            reasoning = f"Today is Day {day_num} of your routine, focusing on {focus}. The schedule recommends {', '.join(trackable_exercises)}. Let's start with {suggested_exercise}!"
        else:
            reasoning = f"Today is Day {day_num} of your routine: {workout_type}. It is a recovery day with no trackable exercises, but let's do some {suggested_exercise} to stay active!"

        return {
            "suggested_exercise": suggested_exercise,
            "muscle_group": muscle_group,
            "reasoning": reasoning
        }

    # ─────────────────────────────────────────────────────────────────────
    #  3. Workout Negotiation
    # ─────────────────────────────────────────────────────────────────────

    def negotiate_workout(self, user_preference: str, weekly_history: dict, ai_suggestion: str) -> dict:
        """
        Respond to user overriding the AI's workout suggestion by confirming their choice immediately.
        Returns: {"response": str, "final_exercise": str}
        """
        system = (
            "You are a personal trainer. The user wants to change today's exercise. "
            "You must agree immediately without any pushback. "
            "Confirm the choice, mention that you've updated their weekly routine page to match, "
            "and encourage them to get started. "
            "Keep it to 2 sentences. Speak naturally. No emojis or markdown. "
            "Respond in EXACTLY this JSON format:\n"
            '{"response": "your spoken response", "final_exercise": "exercise_name"}\n'
            "Valid exercises: pushup, pullup, squat, bicep_curl, chest_press."
        )

        user_msg = (
            f"User wants to train: {user_preference}. "
            f"Original suggest: {ai_suggestion}."
        )

        result = self._chat(system, user_msg, max_tokens=200, temperature=0.7)

        try:
            if result:
                cleaned = result.strip()
                if cleaned.startswith("```"):
                    cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
                    cleaned = cleaned.rsplit("```", 1)[0]
                data = json.loads(cleaned.strip())
                return {
                    "response": data.get("response", f"Sure, let's switch today's workout to {user_preference}. I've updated your routine page!"),
                    "final_exercise": data.get("final_exercise", "pushup"),
                }
        except (json.JSONDecodeError, KeyError):
            pass

        # Fallback mapping
        preference_lower = user_preference.lower()
        exercise_map = {
            "chest": "pushup", "push": "pushup", "pushup": "pushup",
            "back": "pullup", "pull": "pullup", "pullup": "pullup",
            "legs": "squat", "leg": "squat", "squat": "squat",
            "arms": "bicep_curl", "arm": "bicep_curl", "bicep": "bicep_curl", "curl": "bicep_curl",
            "bench": "chest_press", "press": "chest_press", "chest_press": "chest_press",
        }
        
        final_ex = "pushup"
        for k, v in exercise_map.items():
            if k in preference_lower:
                final_ex = v
                break
        
        display_name = {
            "pushup": "push-ups",
            "pullup": "pull-ups",
            "squat": "squats",
            "bicep_curl": "bicep curls",
            "chest_press": "chest press"
        }.get(final_ex, final_ex)

        return {
            "response": f"Sure, let's do {display_name} instead! I have updated today's workout in your weekly routine.",
            "final_exercise": final_ex,
        }


    # ─────────────────────────────────────────────────────────────────────
    #  4. Positioning Tips
    # ─────────────────────────────────────────────────────────────────────

    def generate_positioning_tips(self, exercise_name: str) -> list[str]:
        """
        Generate exercise-specific setup cues for the positioning phase.
        Returns a list of short spoken tips.
        """
        system = (
            "You are a personal trainer helping someone set up for an exercise. "
            "Give exactly 4 short positioning tips (1 sentence each) that they need "
            "to get right BEFORE they start their reps. Focus on grip, stance, "
            "breathing prep, and body alignment. No emojis or markdown. "
            "Respond as a JSON array of strings, nothing else.\n"
            'Example: ["Grip the bar shoulder-width apart.", "Plant your feet firmly.", ...]'
        )

        user_msg = f"Exercise: {exercise_name.replace('_', ' ')}"

        result = self._chat(system, user_msg, max_tokens=200, temperature=0.6)

        try:
            if result:
                cleaned = result.strip()
                if cleaned.startswith("```"):
                    cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
                    cleaned = cleaned.rsplit("```", 1)[0]
                tips = json.loads(cleaned.strip())
                if isinstance(tips, list) and len(tips) > 0:
                    return tips[:5]
        except (json.JSONDecodeError, TypeError):
            pass

        # Fallback tips per exercise
        fallbacks = {
            "pushup": [
                "Place your hands shoulder-width apart on the ground.",
                "Keep your body in a straight line from head to heels.",
                "Engage your core and tighten your glutes.",
                "Take a deep breath before you start.",
            ],
            "pullup": [
                "Grip the bar slightly wider than shoulder-width.",
                "Hang with arms fully extended, shoulders engaged.",
                "Cross your ankles and squeeze your core.",
                "Take a deep breath and pull from your lats.",
            ],
            "squat": [
                "Stand with feet shoulder-width apart, toes slightly out.",
                "Keep your chest up and core braced.",
                "Push your hips back as you descend.",
                "Drive through your heels on the way up.",
            ],
            "bicep_curl": [
                "Stand tall with arms fully extended, palms facing forward.",
                "Pin your elbows to your sides — don't let them drift.",
                "Keep your core tight to avoid swinging.",
                "Take a breath before you curl.",
            ],
            "chest_press": [
                "Lie back with your feet flat on the floor.",
                "Grip the bar at shoulder width, not too wide.",
                "Retract your shoulder blades and arch your back slightly.",
                "Take a deep breath and brace your core.",
            ],
        }
        return fallbacks.get(exercise_name, fallbacks["pushup"])

    # ─────────────────────────────────────────────────────────────────────
    #  5. Set Summary
    # ─────────────────────────────────────────────────────────────────────

    def generate_set_summary(self, exercise: str, reps: int, faults: list, set_number: int) -> dict:
        """
        Generate a motivational post-set summary.
        Returns: {"summary": str, "motivation": str}
        """
        system = (
            "You are an energetic personal trainer giving a quick post-set recap. "
            "Summarize the set in 1-2 sentences (reps done, any form issues). "
            "Then give a short motivational push for the next set. "
            "Sound natural and spoken. No emojis, markdown, or asterisks. "
            "Respond in EXACTLY this JSON format:\n"
            '{"summary": "set recap", "motivation": "short pump-up"}'
        )

        fault_str = ", ".join(f.replace("_", " ") for f in faults) if faults else "none"
        user_msg = (
            f"Exercise: {exercise.replace('_', ' ')}. "
            f"Set {set_number} complete. "
            f"Reps: {reps}. "
            f"Form faults: {fault_str}."
        )

        result = self._chat(system, user_msg, max_tokens=150, temperature=0.8)

        try:
            if result:
                cleaned = result.strip()
                if cleaned.startswith("```"):
                    cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
                    cleaned = cleaned.rsplit("```", 1)[0]
                data = json.loads(cleaned.strip())
                return {
                    "summary": data.get("summary", f"Set {set_number} done — {reps} reps."),
                    "motivation": data.get("motivation", "Let's keep pushing!"),
                }
        except (json.JSONDecodeError, KeyError):
            pass

        # Fallback
        if faults:
            fault_note = f" Watch your {faults[0].replace('_', ' ').lower()} on the next set."
        else:
            fault_note = " Your form was solid."

        return {
            "summary": f"Set {set_number} complete — {reps} reps.{fault_note}",
            "motivation": "One more set, let's go! You've got this!",
        }
