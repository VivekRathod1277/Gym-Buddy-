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
)
from core.ai_coach import AICoach

router = APIRouter(prefix="/api/coach", tags=["coach"])

# Shared AICoach instance
_coach = AICoach()


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
    """Suggest today's exercise based on the user's weekly training history."""
    weekly = get_weekly_muscle_history(current_user.user_id)
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
    """Handle user overriding the AI workout suggestion."""
    weekly = get_weekly_muscle_history(current_user.user_id)
    result = _coach.negotiate_workout(
        user_preference=body.user_preference,
        weekly_history=weekly,
        ai_suggestion=body.ai_suggestion,
    )

    return NegotiateResponse(
        response=result["response"],
        final_exercise=result["final_exercise"],
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
