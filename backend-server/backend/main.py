from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.auth import router as auth_router
from backend.sessions import router as sessions_router
from backend.workout import router as workout_router
from backend.coach import router as coach_router
from backend.diet import router as diet_router
import uvicorn

app = FastAPI(
    title="Gym Posture AI API",
    description="Backend services for the Gym Posture tracking and posture feedback platform.",
    version="1.0.0"
)

# CORS Configuration - enables frontend (web/Streamlit/etc.) connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include sub-routers
app.include_router(auth_router)
app.include_router(sessions_router)
app.include_router(workout_router)
app.include_router(coach_router)
app.include_router(diet_router)

@app.get("/")
def read_root():
    return {
        "message": "Welcome to Gym Posture AI API!",
        "docs_url": "/docs",
        "status": "online"
    }

if __name__ == "__main__":
    # Start the server if running this file directly
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
