from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from backend.schemas import SessionSave, SessionResponse, TokenData
from backend.dependencies import get_current_user
from core.database import save_session, get_user_history

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

@router.post("", status_code=status.HTTP_201_CREATED)
def create_session(session_data: SessionSave, current_user: TokenData = Depends(get_current_user)):
    """Log a completed workout session for the authenticated user."""
    try:
        save_session(
            user_id=current_user.user_id,
            exercise_name=session_data.exercise_name,
            total_reps=session_data.total_reps,
            faults=session_data.faults,
            ai_suggestion=session_data.ai_suggestion
        )
        return {"message": "Session saved successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save session: {e}"
        )

@router.get("/history", response_model=List[SessionResponse])
def get_history(current_user: TokenData = Depends(get_current_user)):
    """Retrieve the workout history for the authenticated user."""
    try:
        history = get_user_history(current_user.user_id)
        # Map raw DB tuples to List[SessionResponse]
        response = []
        for row in history:
            timestamp, exercise_name, total_reps, faults, ai_suggestion = row
            response.append(
                SessionResponse(
                    timestamp=str(timestamp),
                    exercise_name=exercise_name,
                    total_reps=total_reps,
                    faults=str(faults),
                    ai_suggestion=ai_suggestion
                )
            )
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve history: {e}"
        )
