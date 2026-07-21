from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    user_id: Optional[int] = None

class SessionSave(BaseModel):
    exercise_name: str
    total_reps: int
    faults: List[str]
    ai_suggestion: str

class SessionResponse(BaseModel):
    timestamp: str
    exercise_name: str
    total_reps: int
    faults: str
    ai_suggestion: str

class AnalyzeFrameRequest(BaseModel):
    frame_b64: str  # Base64 encoded frame
    exercise_name: str

class AnalyzeFrameResponse(BaseModel):
    feedback: str

class DetectExerciseRequest(BaseModel):
    frame_b64: str

class DetectExerciseResponse(BaseModel):
    exercise: str

class TaskStatusResponse(BaseModel):
    task_id: str
    status: str  # pending, processing, completed, failed
    progress: float
    result: Optional[dict] = None
    error: Optional[str] = None


# ── AI Coach Flow Schemas ────────────────────────────────────────────────────

class UserProfileUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)

class GreetingResponse(BaseModel):
    greeting: str
    user_name: Optional[str] = None
    last_exercise: Optional[str] = None
    last_faults: Optional[List[str]] = None

class WorkoutSuggestion(BaseModel):
    suggested_exercise: str
    muscle_group: str
    reasoning: str
    weekly_summary: dict

class NegotiateRequest(BaseModel):
    user_preference: str
    ai_suggestion: str

class NegotiateResponse(BaseModel):
    response: str
    final_exercise: str

class PositioningTipsResponse(BaseModel):
    exercise: str
    tips: List[str]

class SetSummaryRequest(BaseModel):
    exercise: str
    reps: int
    faults: List[str]
    set_number: int

class SetSummaryResponse(BaseModel):
    summary: str
    motivation: str
