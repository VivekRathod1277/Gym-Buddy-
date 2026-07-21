import os
import hashlib
from datetime import datetime, timedelta
from dotenv import load_dotenv
# pyrefly: ignore [missing-import]
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Warning: SUPABASE_URL or SUPABASE_KEY not found in environment variables.")
    supabase: Client = None
else:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Exercise → Muscle Group mapping ─────────────────────────────────────────
EXERCISE_MUSCLE_MAP = {
    "pushup": "chest",
    "push-up": "chest",
    "chest_press": "chest",
    "chest press": "chest",
    "pullup": "back",
    "pull-up": "back",
    "squat": "legs",
    "bicep_curl": "arms",
    "bicep curl": "arms",
}

def init_db():
    # Tables are managed in Supabase now.
    pass

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def register_user(email, password):
    if not supabase: return False
    # Check if email exists
    try:
        response = supabase.table("users").select("id").eq("email", email).execute()
        if len(response.data) > 0:
            return False
        
        supabase.table("users").insert({
            "email": email,
            "password": hash_password(password)
        }).execute()
        return True
    except Exception as e:
        print(f"Error registering user: {e}")
        return False

def login_user(email, password):
    if not supabase: return None
    try:
        response = supabase.table("users").select("id").eq("email", email).eq("password", hash_password(password)).execute()
        if response.data:
            return response.data[0]["id"]
        return None
    except Exception:
        return None

# ── User Profile ─────────────────────────────────────────────────────────────

def get_user_name(user_id: int) -> str | None:
    if not supabase: return None
    try:
        res = supabase.table("users").select("name").eq("id", user_id).execute()
        if res.data and res.data[0].get("name"):
            return res.data[0]["name"]
        return None
    except Exception:
        return None

def update_user_name(user_id: int, name: str) -> bool:
    if not supabase: return False
    try:
        supabase.table("users").update({"name": name.strip()}).eq("id", user_id).execute()
        return True
    except Exception:
        return False

def get_user_profile(user_id: int) -> dict | None:
    if not supabase: return None
    try:
        res = supabase.table("users").select(
            "email, age, gender, height, weight, activity, diet_type, mobile_no, date_of_birth"
        ).eq("id", user_id).execute()
        if res.data:
            return res.data[0]
        return None
    except Exception:
        return None

def update_user_profile(user_id: int, email: str, age: int, gender: str, height: float, weight: float, activity: float, diet_type: str, mobile_no: str, date_of_birth: str) -> bool:
    if not supabase: return False
    try:
        supabase.table("users").update({
            "email": email,
            "age": age,
            "gender": gender,
            "height": height,
            "weight": weight,
            "activity": activity,
            "diet_type": diet_type,
            "mobile_no": mobile_no,
            "date_of_birth": date_of_birth
        }).eq("id", user_id).execute()
        return True
    except Exception as e:
        print(f"Error updating profile: {e}")
        return False

# ── Session Storage ──────────────────────────────────────────────────────────

def save_session(user_id, exercise_name, total_reps, faults, ai_suggestion, duration=0):
    if not supabase: return
    try:
        supabase.table("exercise_sessions").insert({
            "user_id": user_id,
            "exercise_name": exercise_name,
            "total_reps": total_reps,
            "faults": str(faults),
            "ai_suggestion": ai_suggestion,
            "duration": duration
        }).execute()
    except Exception as e:
        print(f"Error saving session: {e}")

def get_user_history(user_id):
    if not supabase: return []
    try:
        res = supabase.table("exercise_sessions").select(
            "timestamp, exercise_name, total_reps, faults, ai_suggestion"
        ).eq("user_id", user_id).order("timestamp", desc=True).execute()
        
        # Convert to list of tuples for backwards compatibility with sqlite row fetching
        history = []
        for row in res.data:
            history.append((
                row.get("timestamp"),
                row.get("exercise_name"),
                row.get("total_reps"),
                row.get("faults"),
                row.get("ai_suggestion")
            ))
        return history
    except Exception as e:
        print(f"Error getting history: {e}")
        return []

def save_fitness_record(user_id: int, weight: float, height: float, bmi: float, calories: int, goal: str, plan_json: str) -> int:
    if not supabase: return None
    try:
        res = supabase.table("fitness_records").insert({
            "user_id": user_id,
            "weight": weight,
            "height": height,
            "bmi": bmi,
            "calories": calories,
            "goal": goal,
            "plan_json": plan_json
        }).execute()
        if res.data:
             return res.data[0]['id']
        return None
    except Exception as e:
        print(f"Error saving fitness record: {e}")
        return None

def get_fitness_history(user_id: int):
    if not supabase: return []
    try:
        res = supabase.table("fitness_records").select(
            "id, date, weight, height, bmi, calories, goal, plan_json"
        ).eq("user_id", user_id).order("date", desc=True).execute()
        return res.data
    except Exception as e:
        print(f"Error getting fitness history: {e}")
        return []

# ── AI Trainer: Weekly History ───────────────────────────────────────────────

def get_weekly_muscle_history(user_id: int) -> dict:
    if not supabase: return {"chest": 0, "back": 0, "legs": 0, "arms": 0}
    seven_days_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()
    try:
        res = supabase.table("exercise_sessions").select("exercise_name").eq("user_id", user_id).gte("timestamp", seven_days_ago).execute()
        
        muscle_counts = {"chest": 0, "back": 0, "legs": 0, "arms": 0}
        for row in res.data:
            exercise_name = row.get("exercise_name")
            if exercise_name:
                key = exercise_name.lower().strip()
                muscle = EXERCISE_MUSCLE_MAP.get(key, None)
                if muscle:
                    muscle_counts[muscle] += 1
        return muscle_counts
    except Exception as e:
        print(f"Error getting weekly muscle history: {e}")
        return {"chest": 0, "back": 0, "legs": 0, "arms": 0}

def get_last_session_faults(user_id: int) -> dict | None:
    if not supabase: return None
    try:
        res = supabase.table("exercise_sessions").select(
            "exercise_name, faults, timestamp, total_reps"
        ).eq("user_id", user_id).order("timestamp", desc=True).limit(1).execute()
        
        if not res.data:
            return None
            
        row = res.data[0]
        exercise_name = row.get("exercise_name")
        faults_str = row.get("faults")
        timestamp = row.get("timestamp")
        total_reps = row.get("total_reps")
        
        faults = []
        if faults_str and faults_str != "[]":
            cleaned = faults_str.strip("[]'\"")
            if cleaned:
                faults = [f.strip().strip("'\"") for f in cleaned.split(",") if f.strip()]

        return {
            "exercise_name": exercise_name or "unknown",
            "faults": faults,
            "timestamp": timestamp,
            "total_reps": total_reps or 0,
        }
    except Exception as e:
        print(f"Error getting last session faults: {e}")
        return None


def save_diet_routine(user_id: int, day_name: str, breakfast: str, lunch: str, dinner: str, tip: str):
    if not supabase: return
    try:
        supabase.table("diet_routines").insert({
            "user_id": user_id,
            "day_name": day_name,
            "breakfast": breakfast,
            "lunch": lunch,
            "dinner": dinner,
            "tip": tip
        }).execute()
    except Exception as e:
        print(f"Error saving diet routine: {e}")

def save_workout_routine(user_id: int, day_name: str, workout_type: str, focus: str, duration: str, color: str) -> int:
    if not supabase: return None
    try:
        res = supabase.table("workout_routines").insert({
            "user_id": user_id,
            "day_name": day_name,
            "workout_type": workout_type,
            "focus": focus,
            "duration": duration,
            "color": color
        }).execute()
        if res.data:
            return res.data[0]['id']
        return None
    except Exception as e:
        print(f"Error saving workout routine: {e}")
        return None

def save_workout_exercise(workout_routine_id: int, name: str, sets: int, reps: str, rest: str, notes: str):
    if not supabase: return
    try:
        supabase.table("workout_exercises").insert({
            "workout_routine_id": workout_routine_id,
            "name": name,
            "sets": sets,
            "reps": reps,
            "rest": rest,
            "notes": notes
        }).execute()
    except Exception as e:
        print(f"Error saving workout exercise: {e}")

init_db()
