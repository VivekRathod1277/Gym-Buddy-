"""
Coach API — Guided Workout Flow Endpoints
==========================================
REST endpoints that power the voice-driven AI personal trainer flow:
greeting, workout suggestion, negotiation, positioning tips, set summary.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from backend.schemas import (
    TokenData,
    GreetingResponse,
    WorkoutSuggestion,
    NegotiateRequest,
    NegotiateResponse,
    PositioningTipsResponse,
    SetSummaryRequest,
    SetSummaryResponse,
    UserProfileUpdate,
)
from backend.dependencies import get_current_user
from core.database import (
    get_user_name,
    update_user_name,
    get_weekly_muscle_history,
    get_last_session_faults,
    get_fitness_history,
    update_latest_fitness_plan,
    update_db_workout_exercises,
)
from core.ai_coach import AICoach

router = APIRouter(prefix="/api/coach", tags=["coach"])

# Shared AICoach instance
_coach = AICoach()

def map_routine_exercise_to_supported(exercise_name: str) -> str | None:
    name = exercise_name.lower().strip()
    if "push-up" in name or "pushup" in name or "push up" in name:
        return "pushup"
    if "pull-up" in name or "pullup" in name or "pull up" in name:
        return "pullup"
    if "squat" in name:
        return "squat"
    if "bicep curl" in name or "bicep_curl" in name or "bicep" in name:
        return "bicep_curl"
    if "chest press" in name or "chest_press" in name or "bench press" in name:
        return "chest_press"
    return None

DEFAULT_EXERCISES_DETAILS = {
    "pushup": {"name": "Push-ups", "sets": 3, "reps": "12 reps", "rest": "45s", "notes": "Chest to floor, full range"},
    "pullup": {"name": "Pull-ups", "sets": 3, "reps": "8 reps", "rest": "60s", "notes": "Chin above bar, full extension"},
    "squat": {"name": "Squats", "sets": 3, "reps": "15 reps", "rest": "45s", "notes": "Below parallel, knees track toes"},
    "bicep_curl": {"name": "Bicep Curls", "sets": 3, "reps": "12 reps", "rest": "30s", "notes": "Slow and controlled, elbows pinned"},
    "chest_press": {"name": "Chest Press", "sets": 3, "reps": "12 reps", "rest": "45s", "notes": "Elbows at 45 degrees, squeeze chest"}
}

# ── Greeting ─────────────────────────────────────────────────────────────────

@router.get("/greeting", response_model=GreetingResponse)
def get_greeting(current_user: TokenData = Depends(get_current_user)):
    """Generate a personalized voice greeting for the user."""
    user_name = get_user_name(current_user.user_id)
    last_session = get_last_session_faults(current_user.user_id)

    greeting = _coach.generate_greeting(user_name, last_session)

    return GreetingResponse(
        greeting=greeting,
        user_name=user_name,
        last_exercise=last_session["exercise_name"] if last_session else None,
        last_faults=last_session["faults"] if last_session else None,
    )


# ── Workout Suggestion ──────────────────────────────────────────────────────

@router.get("/suggest-workout", response_model=WorkoutSuggestion)
def suggest_workout(current_user: TokenData = Depends(get_current_user)):
    """Suggest today's exercise based on the user's weekly routine if it exists, otherwise fall back to history."""
    weekly = get_weekly_muscle_history(current_user.user_id)
    
    import json
    from datetime import datetime, timezone

    records = get_fitness_history(current_user.user_id)
    if records:
        latest_record = records[0]
        try:
            plan_json = latest_record.get("plan_json")
            if isinstance(plan_json, str):
                plan_json = json.loads(plan_json)

            date_val = latest_record.get("date")
            if isinstance(date_val, str):
                if date_val.endswith("Z"):
                    date_val = date_val.replace("Z", "+00:00")
                created_at = datetime.fromisoformat(date_val)
            elif isinstance(date_val, datetime):
                created_at = date_val
            else:
                created_at = datetime.now(timezone.utc)

            now = datetime.now(timezone.utc)
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            
            days_elapsed = (now - created_at).days
            day_num = (days_elapsed % 7) + 1
            day_key = f"Day {day_num}"

            weekly_workout = plan_json.get("weekly_workout", {})
            day_workout = weekly_workout.get(day_key, {})

            if day_workout:
                exercises = day_workout.get("exercises", [])
                
                trackable_list = []
                for ex in exercises:
                    ex_name = ex.get("name", "")
                    mapped = map_routine_exercise_to_supported(ex_name)
                    if mapped:
                        trackable_list.append(mapped)

                seen = set()
                trackable_exercises = [x for x in trackable_list if not (x in seen or seen.add(x))]

                suggested_exercise = "pushup"
                if trackable_exercises:
                    suggested_exercise = trackable_exercises[0]
                else:
                    min_group = min(weekly, key=weekly.get)
                    exercise_map = {"chest": "pushup", "back": "pullup", "legs": "squat", "arms": "bicep_curl"}
                    suggested_exercise = exercise_map.get(min_group, "pushup")

                suggestion = _coach.suggest_workout_from_routine(
                    day_num=day_num,
                    workout_type=day_workout.get("type", "Workout"),
                    focus=day_workout.get("focus", "General Fitness"),
                    exercises=exercises,
                    trackable_exercises=trackable_exercises,
                    suggested_exercise=suggested_exercise
                )

                from core.database import EXERCISE_MUSCLE_MAP
                muscle_group = EXERCISE_MUSCLE_MAP.get(suggestion["suggested_exercise"], "chest")
                return WorkoutSuggestion(
                    suggested_exercise=suggestion["suggested_exercise"],
                    muscle_group=muscle_group,
                    reasoning=suggestion["reasoning"],
                    weekly_summary=weekly,
                )

        except Exception as e:
            print(f"Error suggesting from routine: {e}")

    # Fallback to history
    suggestion = _coach.suggest_workout(weekly)
    return WorkoutSuggestion(
        suggested_exercise=suggestion["suggested_exercise"],
        muscle_group=suggestion["muscle_group"],
        reasoning=suggestion["reasoning"],
        weekly_summary=weekly,
    )


# ── Workout Negotiation ─────────────────────────────────────────────────────

@router.post("/negotiate", response_model=NegotiateResponse)
def negotiate_workout(
    body: NegotiateRequest,
    current_user: TokenData = Depends(get_current_user),
):
    """Handle user overriding the AI workout suggestion and update their weekly routine."""
    weekly = get_weekly_muscle_history(current_user.user_id)
    
    result = _coach.negotiate_workout(
        user_preference=body.user_preference,
        weekly_history=weekly,
        ai_suggestion=body.ai_suggestion,
    )
    
    final_exercise = result["final_exercise"]
    
    import json
    from datetime import datetime, timezone

    records = get_fitness_history(current_user.user_id)
    if records:
        latest_record = records[0]
        try:
            plan_json = latest_record.get("plan_json")
            if isinstance(plan_json, str):
                plan_json = json.loads(plan_json)

            date_val = latest_record.get("date")
            if isinstance(date_val, str):
                if date_val.endswith("Z"):
                    date_val = date_val.replace("Z", "+00:00")
                created_at = datetime.fromisoformat(date_val)
            elif isinstance(date_val, datetime):
                created_at = date_val
            else:
                created_at = datetime.now(timezone.utc)

            now = datetime.now(timezone.utc)
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)

            days_elapsed = (now - created_at).days
            day_num = (days_elapsed % 7) + 1
            day_key = f"Day {day_num}"

            weekly_workout = plan_json.get("weekly_workout", {})
            day_workout = weekly_workout.get(day_key, {})

            if day_workout:
                exercises = day_workout.get("exercises", [])
                
                new_ex_details = DEFAULT_EXERCISES_DETAILS.get(
                    final_exercise,
                    {"name": final_exercise.replace("_", " ").capitalize(), "sets": 3, "reps": "12 reps", "rest": "45s", "notes": "Slow and controlled"}
                )

                replaced = False
                for idx, ex in enumerate(exercises):
                    ex_name = ex.get("name", "")
                    if map_routine_exercise_to_supported(ex_name) is not None:
                        exercises[idx] = {
                            "name": new_ex_details["name"],
                            "sets": new_ex_details["sets"],
                            "reps": new_ex_details["reps"],
                            "rest": new_ex_details["rest"],
                            "notes": new_ex_details["notes"]
                        }
                        replaced = True
                        break

                if not replaced:
                    day_workout["exercises"] = [{
                        "name": new_ex_details["name"],
                        "sets": new_ex_details["sets"],
                        "reps": new_ex_details["reps"],
                        "rest": new_ex_details["rest"],
                        "notes": new_ex_details["notes"]
                    }]
                    day_workout["type"] = new_ex_details["name"]
                    day_workout["focus"] = "Modified Workout"
                    day_workout["duration"] = "30 min"
                    day_workout["color"] = "#6366f1"

                plan_json["weekly_workout"][day_key] = day_workout

                update_latest_fitness_plan(current_user.user_id, json.dumps(plan_json))
                update_db_workout_exercises(current_user.user_id, day_key, day_workout["exercises"])

        except Exception as e:
            print(f"Error updating weekly routine from negotiation: {e}")

    return NegotiateResponse(
        response=result["response"],
        final_exercise=final_exercise,
    )



# ── Positioning Tips ─────────────────────────────────────────────────────────

@router.get("/positioning-tips", response_model=PositioningTipsResponse)
def get_positioning_tips(
    exercise: str = "pushup",
    current_user: TokenData = Depends(get_current_user),
):
    """Get exercise-specific positioning cues for the setup phase."""
    tips = _coach.generate_positioning_tips(exercise)

    return PositioningTipsResponse(
        exercise=exercise,
        tips=tips,
    )


# ── Set Summary ──────────────────────────────────────────────────────────────

@router.post("/set-summary", response_model=SetSummaryResponse)
def get_set_summary(
    body: SetSummaryRequest,
    current_user: TokenData = Depends(get_current_user),
):
    """Generate a motivational post-set voice summary."""
    result = _coach.generate_set_summary(
        exercise=body.exercise,
        reps=body.reps,
        faults=body.faults,
        set_number=body.set_number,
    )

    return SetSummaryResponse(
        summary=result["summary"],
        motivation=result["motivation"],
    )


# ── User Profile (Name) ─────────────────────────────────────────────────────

@router.put("/profile")
def update_profile(
    body: UserProfileUpdate,
    current_user: TokenData = Depends(get_current_user),
):
    """Update the user's display name for personalized greetings."""
    if not body.name or not body.name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Name cannot be empty.",
        )

    success = update_user_name(current_user.user_id, body.name)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    return {"message": "Profile updated successfully", "name": body.name.strip()}
