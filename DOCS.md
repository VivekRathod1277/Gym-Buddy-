# Gym Buddy — Project Documentation

> **AI-Powered Real-Time Exercise Form Analyzer & Personal Trainer**

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Project Structure](#4-project-structure)
5. [Core Modules (`core/`)](#5-core-modules)
   - 5.1 [Physics Engine](#51-physics-engine)
   - 5.2 [ML Posture Classifier](#52-ml-posture-classifier)
   - 5.3 [AI Advisor (NVIDIA NIM)](#53-ai-advisor-nvidia-nim)
   - 5.4 [Voice Feedback Assistant](#54-voice-feedback-assistant)
   - 5.5 [Database Layer](#55-database-layer)
6. [Exercise Blueprints (`config/exercises/`)](#6-exercise-blueprints)
7. [Backend API (`backend/`)](#7-backend-api)
   - 7.1 [Authentication](#71-authentication)
   - 7.2 [Workout Processing](#72-workout-processing)
   - 7.3 [Session History](#73-session-history)
   - 7.4 [API Endpoints Reference](#74-api-endpoints-reference)
8. [Frontend UI (`Gym Buddy UI Build/`)](#8-frontend-ui)
9. [ML Training Pipeline](#9-ml-training-pipeline)
10. [CLI Mode (`main.py`)](#10-cli-mode)
11. [Video Processing Pipeline](#11-video-processing-pipeline)
12. [Setup & Installation](#12-setup--installation)
13. [Environment Variables](#13-environment-variables)
14. [Database Schema](#14-database-schema)

---

## 1. Project Overview

**Gym Buddy** is a full-stack, AI-powered fitness application that analyzes exercise form in real-time using computer vision. The system combines three layers of intelligence:

| Layer | Technology | Purpose |
|---|---|---|
| **Pose Estimation** | Google MediaPipe | Extracts 33 body landmarks (x, y, z, visibility) from every video frame |
| **Biomechanical Analysis** | Custom Physics Engine | Counts reps via a state machine, detects form faults using JSON-defined rules |
| **ML Classification** | Random Forest (scikit-learn) | Classifies posture quality (good form, bad form variants, rest) |
| **AI Coaching** | NVIDIA NIM (DeepSeek-V4-Pro) | Vision-based contextual coaching tips and automatic exercise detection |
| **Voice Feedback** | pyttsx3 (SAPI5) | Real-time spoken rep counts, fault alerts, and AI coaching tips |

### Supported Exercises

- **Pushup** — with sagging back, piked hips, and neck position fault detection
- **Pullup** — with shoulder swing and chin clearance fault detection
- **Squat** — with knee cave, forward lean, and depth fault detection
- **Bicep Curl** — with elbow drift and shoulder swing fault detection

---

## 2. System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                   │
│  ┌─────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │AuthPage │  │ WorkoutPage  │  │ HistoryPage  │                │
│  └────┬────┘  └──────┬───────┘  └──────┬───────┘                │
│       │              │ WebSocket        │ REST                   │
│       │              │ (live frames)    │                        │
└───────┼──────────────┼──────────────────┼────────────────────────┘
        │              │                  │
   ┌────▼──────────────▼──────────────────▼────────────────────────┐
   │                   BACKEND (FastAPI + Uvicorn)                 │
   │                                                               │
   │  ┌──────────┐  ┌────────────┐  ┌──────────────┐              │
   │  │ auth.py  │  │ workout.py │  │ sessions.py  │              │
   │  │ (JWT)    │  │ (REST+WS)  │  │ (CRUD)       │              │
   │  └──────────┘  └─────┬──────┘  └──────────────┘              │
   │                       │                                       │
   │         ┌─────────────┼──────────────────┐                    │
   │         ▼             ▼                  ▼                    │
   │  ┌────────────┐ ┌──────────────┐ ┌──────────────┐            │
   │  │  Physics   │ │  ML Model    │ │  AI Advisor  │            │
   │  │  Engine    │ │  (sklearn)   │ │ (NVIDIA NIM) │            │
   │  └─────┬──────┘ └──────────────┘ └──────────────┘            │
   │        │                                                      │
   │  ┌─────▼──────┐                                               │
   │  │  MediaPipe  │  (Pose Landmark Detection)                   │
   │  └────────────┘                                               │
   │                                                               │
   │  ┌──────────────┐  ┌──────────────────┐                       │
   │  │  SQLite DB   │  │  Voice Feedback  │                       │
   │  │  (gym_ai.db) │  │  (pyttsx3/SAPI5) │                       │
   │  └──────────────┘  └──────────────────┘                       │
   └───────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

### Backend / Core (Python)

| Package | Version | Purpose |
|---|---|---|
| `opencv-python` | latest | Video capture, frame processing, HUD overlay rendering |
| `mediapipe` | 0.10.14 | Google's pose estimation (33 landmarks per frame) |
| `numpy` | latest | Vector math for angle calculations and biomechanics |
| `scikit-learn` | latest | Random Forest classifier for posture classification |
| `pyttsx3` | latest | Text-to-speech voice feedback (Windows SAPI5 driver) |
| `openai` | latest | Client SDK for NVIDIA NIM (OpenAI-compatible endpoint) |
| `python-dotenv` | latest | Loads API keys from `.env` file |
| `Pillow` | latest | Image conversion for AI vision analysis |
| `fastapi` | latest | REST API + WebSocket backend server |
| `uvicorn` | latest | ASGI server for FastAPI |
| `pyjwt` | latest | JWT token generation and validation |
| `python-multipart` | latest | File upload (multipart form data) support |

### Frontend (TypeScript / React)

| Package | Purpose |
|---|---|
| `react` 19 + `react-dom` 19 | UI framework |
| `vite` 7 | Build tool and dev server |
| `typescript` 5.9 | Type safety |
| `react-router-dom` 7 | Client-side routing |
| `axios` | HTTP client for API calls |
| `tailwindcss` 3 | Utility-first CSS framework |
| `@radix-ui/*` | Accessible UI component primitives |
| `lucide-react` | Icon library |
| `recharts` | Data visualization charts |
| `three` + `postprocessing` | 3D neural background animation |
| `animejs` | Animation library |
| `sonner` | Toast notifications |
| `zod` | Schema validation |
| `react-hook-form` | Form state management |

---

## 4. Project Structure

```
Gym Posture/
│
├── main.py                         ← CLI entry point (webcam / video file)
├── main_runner.py                  ← Alternative launcher
│
├── core/                           ← Core engine modules
│   ├── physics_engine.py           ← Biomechanical analysis + rep counting
│   ├── ml_model.py                 ← Random Forest posture classifier
│   ├── ai_advisor.py               ← NVIDIA NIM DeepSeek-V4-Pro integration
│   ├── voice_feedback.py           ← Non-blocking TTS voice assistant
│   └── database.py                 ← SQLite ORM (users + sessions)
│
├── backend/                        ← FastAPI REST + WebSocket API
│   ├── main.py                     ← FastAPI app factory + CORS
│   ├── auth.py                     ← Register, Login (JWT), /me
│   ├── workout.py                  ← Video upload, WS streaming, exercise detection
│   ├── sessions.py                 ← Save/retrieve workout history
│   ├── schemas.py                  ← Pydantic request/response models
│   └── dependencies.py             ← JWT validation dependency
│
├── config/
│   └── exercises/                  ← JSON exercise blueprints
│       ├── pushup.json
│       ├── pullup.json
│       ├── squat.json
│       └── bicep_curl.json
│
├── models/                         ← Trained ML model artifacts
│   ├── posture_classifier.pkl      ← Random Forest model (~8.8 MB)
│   └── label_encoder.pkl           ← Label encoder for class mapping
│
├── data/
│   └── labeled_landmarks.csv       ← Training dataset (~5.1 MB)
│
├── Gym Buddy UI Build/app/         ← React + Vite frontend
│   ├── src/
│   │   ├── App.tsx                 ← Root component with routing
│   │   ├── pages/
│   │   │   ├── AuthPage.tsx        ← Login / Register page
│   │   │   ├── WorkoutPage.tsx     ← Video upload + live analysis view
│   │   │   └── HistoryPage.tsx     ← Workout session history
│   │   ├── components/
│   │   │   ├── NeuralBackground.tsx    ← Three.js animated background
│   │   │   ├── SessionSummaryModal.tsx ← Post-workout results modal
│   │   │   ├── Sidebar.tsx             ← Navigation sidebar
│   │   │   └── ToastContainer.tsx      ← Toast notification renderer
│   │   ├── hooks/
│   │   │   ├── useAuth.tsx         ← Authentication context + API
│   │   │   ├── useSessions.tsx     ← Session history context + API
│   │   │   ├── useVoice.tsx        ← Browser TTS voice hook
│   │   │   └── useToast.tsx        ← Toast notification hook
│   │   ├── lib/
│   │   │   └── api.ts              ← Axios instance (base URL config)
│   │   └── types/
│   │       └── index.ts            ← TypeScript type definitions
│   └── package.json
│
├── train_model.py                  ← Train classifier from real CSV data
├── collect_data.py                 ← Webcam data collector with keyboard labeling
├── setup_model.py                  ← Generate synthetic data + train (quick setup)
├── process_video.py                ← Offline video processing (batch mode)
├── process_video_with_audio.py     ← Video processing with audio overlay
│
├── .env                            ← NVIDIA API key
├── requirements.txt                ← Python dependencies
├── gym_ai.db                       ← SQLite database (auto-created)
└── README.md                       ← Quick-start guide
```

---

## 5. Core Modules

### 5.1 Physics Engine

**File:** `core/physics_engine.py`  
**Class:** `PhysicsEngine`

The biomechanical analysis engine is the heart of the system. It loads a JSON exercise blueprint and uses it to:

#### Rep Counting (State Machine)

The engine implements a two-state machine (`start` ↔ `end`) driven by the primary joint angle:

```
         angle > start_threshold
    ┌─────────────────────────────────┐
    │                                 │
    ▼          (rep counted)          │
  START ◄─────────────────────── END
    │                                 ▲
    │                                 │
    └─────────────────────────────────┘
         angle < end_threshold
```

- **Pushup Example:** Start = elbow angle > 130°, End = elbow angle < 110°
- A full rep is counted when the user returns from `end` → `start`

#### Camera Angle Auto-Detection

The engine automatically determines whether the camera is viewing from the **side** or **front** by computing the ratio of shoulder width to torso length:

```
ratio = shoulder_width / torso_length
if ratio > 0.3 → "front" view
else → "side" view
```

Certain form faults (e.g., sagging back) are only evaluated from the correct camera angle.

#### Form Fault Detection

The engine supports 5 fault detection strategies, all configurable via JSON:

| Fault Type | Description | Example Use |
|---|---|---|
| `joint_movement_x` | Horizontal drift of a joint beyond threshold | Elbow flare during curls |
| `joint_movement_y` | Vertical drift of a joint beyond threshold | Shoulder shrug during pullups |
| `distance_ratio` | Ratio between two joint-pair distances | Knee cave detection in squats |
| `angle_range` | Joint angle outside acceptable min/max range | Neck drop during pushups |
| `segment_angle` | Angle of a body segment relative to horizontal/vertical axis | Sagging back, piked hips |

#### Pushup-Specific Intelligence

The engine includes specialized logic for pushup posture:
- **Active stance detection:** Ignores faults when the user's torso is vertical (standing/setting up)
- **Piked vs. Sagging disambiguation:** Uses hip-shoulder relative Y-position to correctly identify whether the fault is piked hips (hips above shoulders) or sagging back (hips below shoulders)

#### Key Methods

| Method | Description |
|---|---|
| `evaluate_frame(landmarks)` | Processes one frame; returns `{angle, reps, state, active_fault}` |
| `get_session_data()` | Returns final session summary `{exercise, total_reps, faults_recorded}` |
| `calculate_angle(a, b, c)` | Computes the angle at point `b` between rays `ba` and `bc` |
| `parse_landmarks(landmarks)` | Converts MediaPipe landmark list to a named dictionary |

---

### 5.2 ML Posture Classifier

**File:** `core/ml_model.py`  
**Class:** `PostureClassifier` (aliased as `ExerciseClassifier`)

A custom-trained Random Forest classifier that predicts posture quality from raw MediaPipe landmarks.

#### Model Specifications

| Property | Value |
|---|---|
| Architecture | Random Forest |
| Estimators | 200 |
| Max Depth | 15 |
| Min Samples Split | 4 |
| Input Features | 132 (33 landmarks × 4 values: x, y, z, visibility) |
| Output Classes | `good_form`, `bad_form_partial`, `bad_form_elbow`, `bad_form_neck`, `rest` |
| Model File | `models/posture_classifier.pkl` (~8.8 MB) |
| Encoder File | `models/label_encoder.pkl` |

#### Fallback Heuristic Mode

If the trained model files are not found, the classifier falls back to a visibility-based heuristic:
- Average visibility of 10 key joints (shoulders, elbows, wrists, hips, knees)
- `> 0.75` → `good_form`
- `> 0.5` → `bad_form_partial`
- `≤ 0.5` → `low_visibility`

#### Key Methods

| Method | Description |
|---|---|
| `predict(pose_landmarks)` | Returns predicted posture label string |
| `get_confidence(pose_landmarks)` | Returns max probability from the model's prediction |

---

### 5.3 AI Advisor (NVIDIA NIM)

**File:** `core/ai_advisor.py`  
**Class:** `AIAdvisor`

Integrates with NVIDIA's NIM API using the DeepSeek-V4-Pro model for two vision-based capabilities:

#### 1. Frame Analysis (Coaching)

- Sends a JPEG-encoded frame to DeepSeek-V4-Pro with a coaching prompt
- Returns a single sentence of constructive posture feedback
- Runs in a **background thread** to avoid blocking the main video loop
- Uses a callback pattern: `analyze_frame(frame, exercise_name, callback)`

#### 2. Exercise Detection

- Analyzes the first frame of a video to auto-detect the exercise type
- Returns one of: `pushup`, `pullup`, `squat`, `bicep_curl`
- Falls back to `pushup` on any error

#### Configuration

| Setting | Value |
|---|---|
| API Endpoint | `https://integrate.api.nvidia.com/v1` |
| Model | `deepseek-ai/deepseek-v4-pro` |
| Coaching Temperature | 0.7 |
| Detection Temperature | 0.2 |
| Max Tokens (Coaching) | 128 |
| Max Tokens (Detection) | 10 |

---

### 5.4 Voice Feedback Assistant

**File:** `core/voice_feedback.py`  
**Class:** `VoiceAssistant`

A non-blocking text-to-speech system that provides real-time audio feedback during workouts.

#### Architecture

- Uses a **dedicated background thread** with a message queue
- Initializes COM (Windows `pythoncom.CoInitialize()`) for SAPI5 compatibility
- Re-creates the pyttsx3 engine for each message to ensure audio focus
- Speech rate: 175 WPM, Volume: 100%

#### Features

- **Rep announcements:** "Rep 1", "Rep 2", etc.
- **Fault alerts:** Speaks the fault message from the blueprint
- **AI tips:** Reads AI coaching suggestions aloud
- **Queue clearing:** `clear_queue()` drops pending messages to prevent voice lag buildup

---

### 5.5 Database Layer

**File:** `core/database.py`

A lightweight SQLite interface for user management and workout session persistence.

#### Tables

| Table | Purpose |
|---|---|
| `users` | User registration (email + hashed password) |
| `exercise_sessions` | Workout history per user |

#### Key Functions

| Function | Description |
|---|---|
| `init_db()` | Creates tables if not exist (runs on import) |
| `register_user(email, password)` | SHA-256 hashed registration |
| `login_user(email, password)` | Returns `user_id` or `None` |
| `save_session(user_id, ...)` | Logs a completed workout session |
| `get_user_history(user_id)` | Returns all sessions ordered by timestamp DESC |

---

## 6. Exercise Blueprints

**Directory:** `config/exercises/`

Each exercise is defined by a JSON blueprint that controls the Physics Engine's behavior. This is the **configuration-driven design** — adding a new exercise requires zero code changes, only a new JSON file.

### Blueprint Schema

```json
{
  "exercise_name": "string",
  "target_joints": {
    "primary": ["JOINT_A", "JOINT_B", "JOINT_C"]
  },
  "phases": {
    "start": { "angle": number, "threshold": number, "type": "greater_than" },
    "end":   { "angle": number, "threshold": number, "type": "less_than" }
  },
  "form_faults": [
    {
      "name": "string",
      "type": "angle_range | segment_angle | joint_movement_x | joint_movement_y | distance_ratio",
      "joints": ["..."],
      "threshold": number,
      "feedback_message": "string",
      "view": "side | front",
      "active_phases": ["start", "end"]
    }
  ]
}
```

### Current Blueprints

| Exercise | Primary Joints | Fault Checks | File |
|---|---|---|---|
| **Pushup** | Shoulder → Elbow → Wrist | Neck position, Sagging back, Piked hips | `pushup.json` |
| **Pullup** | Shoulder → Elbow → Wrist | Shoulder swing (X), Head clearance (Y) | `pullup.json` |
| **Squat** | Hip → Knee → Ankle | Knee cave, Forward lean, Depth check | `squat.json` |
| **Bicep Curl** | Shoulder → Elbow → Wrist | Elbow drift, Shoulder swing | `bicep_curl.json` |

---

## 7. Backend API

**Entry Point:** `backend/main.py`  
**Framework:** FastAPI  
**Server:** Uvicorn (port 8000)

### 7.1 Authentication

**File:** `backend/auth.py`

- JWT-based authentication with 7-day token expiry
- Two login endpoints: OAuth2 form-based (for Swagger UI) and JSON-body (for API clients)
- Password hashing: SHA-256

### 7.2 Workout Processing

**File:** `backend/workout.py`

The workout router supports two processing modes:

#### Mode 1: REST Endpoints
- **Exercise Detection** (`POST /api/workout/detect-exercise`): Send a base64 frame, get back the detected exercise name
- **Frame Analysis** (`POST /api/workout/analyze-frame`): Send a base64 frame + exercise name, get back AI coaching feedback
- **Video Upload** (`POST /api/workout/process-video`): Upload a video file, get back a task ID for tracking

#### Mode 2: WebSocket Live Streaming
- **WebSocket** (`WS /api/workout/ws/stream-video/{task_id}`): After uploading a video via REST, connect to this WebSocket to receive processed frames in real-time
- Each frame is sent as a JSON payload containing:
  - Base64-encoded annotated JPEG frame
  - Current rep count
  - Joint angle
  - Active fault (if any)
  - AI coaching tip
  - Exercise name

### 7.3 Session History

**File:** `backend/sessions.py`

- **Save Session** (`POST /api/sessions`): Log a completed workout
- **Get History** (`GET /api/sessions/history`): Retrieve all past sessions for the authenticated user

### 7.4 API Endpoints Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | ✗ | Register a new user |
| `POST` | `/api/auth/login` | ✗ | OAuth2 form login → JWT |
| `POST` | `/api/auth/login-json` | ✗ | JSON body login → JWT |
| `GET` | `/api/auth/me` | ✓ | Get current user info |
| `POST` | `/api/workout/detect-exercise` | ✓ | Auto-detect exercise from frame |
| `POST` | `/api/workout/analyze-frame` | ✓ | AI coaching for single frame |
| `GET` | `/api/workout/exercises` | ✓ | List available exercises |
| `POST` | `/api/workout/process-video` | ✓ | Upload video → task ID |
| `WS` | `/api/workout/ws/stream-video/{id}` | ✗ | Live processed frame stream |
| `GET` | `/api/workout/tasks/{id}` | ✓ | Check processing task status |
| `GET` | `/api/workout/processed-videos/{file}` | ✗ | Download processed video |
| `POST` | `/api/sessions` | ✓ | Save workout session |
| `GET` | `/api/sessions/history` | ✓ | Get workout history |

---

## 8. Frontend UI

**Directory:** `Gym Buddy UI Build/app/`  
**Stack:** React 19 + TypeScript + Vite + TailwindCSS

### Pages

| Page | Route | Description |
|---|---|---|
| **AuthPage** | `/` | Login / Register with animated neural background |
| **WorkoutPage** | `/workout` | Video upload, exercise selection, live WebSocket analysis with real-time HUD overlay |
| **HistoryPage** | `/history` | Past workout sessions with stats and charts |

### Key Components

| Component | Description |
|---|---|
| `NeuralBackground` | Three.js-powered animated particle network background |
| `SessionSummaryModal` | Post-workout results modal with reps, faults, and AI suggestion |
| `Sidebar` | Navigation sidebar with links to Workout and History |
| `ToastContainer` | Renders toast notifications from the `useToast` hook |

### React Hooks (Custom)

| Hook | Description |
|---|---|
| `useAuth` | Context provider for JWT authentication state, login/register API calls |
| `useSessions` | Context provider for fetching and caching workout session history |
| `useVoice` | Browser Web Speech API integration for client-side TTS |
| `useToast` | Toast notification state management |

### Providers (Wrapping Order)

```tsx
<AuthProvider>
  <SessionsProvider>
    <VoiceProvider>
      <ToastProvider>
        <AppRoutes />
        <ToastContainer />
      </ToastProvider>
    </VoiceProvider>
  </SessionsProvider>
</AuthProvider>
```

### Protected Routes

All routes except `/` (AuthPage) are wrapped in `<ProtectedRoute>`, which redirects unauthenticated users back to the login page.

---

## 9. ML Training Pipeline

The project includes three scripts for building and managing the posture classification model:

### `setup_model.py` — Quick Setup (Synthetic Data)

Generates **2,000 synthetic landmark samples** (400 per class) with class-specific noise profiles:
- `good_form`: Low variance (σ=0.02), high visibility
- `bad_form_*`: High variance (σ=0.08), lower visibility
- `rest`: Medium variance (σ=0.04)

Then trains and saves the model. Run this once before a demo/exhibition.

```bash
py -3.9 setup_model.py
```

### `collect_data.py` — Real Data Collection

Opens the webcam and records MediaPipe landmarks with keyboard-driven labeling:

| Key | Label |
|---|---|
| `1` | `good_form` |
| `2` | `bad_form_partial` |
| `3` | `bad_form_elbow` |
| `4` | `bad_form_neck` |
| `r` | `rest` |
| `q` | Quit and save |

Data is appended to `data/labeled_landmarks.csv`.

### `train_model.py` — Full Training

Trains on the real collected data with an 80/20 stratified split and prints a full classification report.

```bash
py -3.9 train_model.py
```

---

## 10. CLI Mode

**File:** `main.py`

The original command-line interface for running the system with a webcam or video file.

### Usage

```bash
# Live webcam (auto-detect exercise)
py -3.9 main.py

# Video file with auto-detection
py -3.9 main.py "pushup_video.mp4"

# Video file with specific exercise
py -3.9 main.py "pushup_video.mp4" pushup.json

# Slow motion playback
py -3.9 main.py "pushup_video.mp4" --slow
```

### HUD Overlay (OpenCV)

The CLI mode renders a premium heads-up display directly on the video frames:

- **Top Header:** Glassmorphic dark overlay with exercise name, rep counter, and joint angle
- **AI Advisor Panel:** Shows NVIDIA NIM coaching tips (triggered by pressing `a`)
- **Bottom Warning Banner:** Red alert bar for form fault corrections

### Keyboard Controls

| Key | Action |
|---|---|
| `a` | Trigger AI analysis of the current frame |
| `q` | Quit and export session data |

### Session Export

On quit, the session data is exported to `session_export.json`:

```json
{
    "exercise": "Pushup",
    "total_reps": 5,
    "faults_recorded": ["Sagging_Back", "Neck_Position"]
}
```

---

## 11. Video Processing Pipeline

### `process_video.py` — Batch Processing

Processes a video file offline (no webcam, no voice, no AI API calls). Renders the full HUD overlay with contextual coaching tips and saves the annotated video.

### `process_video_with_audio.py` — Processing with Audio

Extended version that also overlays audio feedback onto the processed video.

### Backend Video Processing (`backend/workout.py`)

The backend supports two video processing flows:

1. **Background Task:** Upload via `POST /api/workout/process-video`, then poll status via `GET /api/workout/tasks/{id}`
2. **WebSocket Streaming:** Upload first, then connect to `WS /api/workout/ws/stream-video/{id}` to receive frames in real-time

Both flows:
- Auto-detect exercise type from the first frame (if set to "auto")
- Run MediaPipe pose estimation on every frame
- Execute the Physics Engine for rep counting and fault detection
- Apply the ML classifier
- Render the full HUD overlay
- Save the processed video to `processed_videos/`
- Log the session to the SQLite database

---

## 12. Setup & Installation

### Prerequisites

- Python 3.9+ (MediaPipe requires 3.9)
- Node.js 18+ (for the frontend)
- Windows OS (for SAPI5 voice feedback)

### Backend Setup

```bash
# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Generate the ML model (quick synthetic data)
py -3.9 setup_model.py

# 3. Create a .env file with your NVIDIA API key
#    NVIDIA_API_KEY=nvapi-your-key-here

# 4. Start the FastAPI backend
py -3.9 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend Setup

```bash
# Navigate to the UI directory
cd "Gym Buddy UI Build/app"

# Install dependencies
npm install

# Start the dev server
npm run dev
```

### CLI Mode (No Backend Required)

```bash
# Run directly with webcam
py -3.9 main.py

# Run with a video file
py -3.9 main.py "your_video.mp4"
```

---

## 13. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NVIDIA_API_KEY` | Yes | NVIDIA NIM API key for DeepSeek-V4-Pro vision model |
| `JWT_SECRET_KEY` | No | JWT signing secret (defaults to `super-secret-gym-buddy-key-123456789`) |

Store these in a `.env` file in the project root.

---

## 14. Database Schema

**File:** `gym_ai.db` (SQLite, auto-created on first import of `core/database.py`)

### `users` Table

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT |
| `email` | TEXT | UNIQUE NOT NULL |
| `password` | TEXT | NOT NULL (SHA-256 hash) |

### `exercise_sessions` Table

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT |
| `user_id` | INTEGER | FOREIGN KEY → users(id) |
| `timestamp` | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| `exercise_name` | TEXT | — |
| `total_reps` | INTEGER | — |
| `faults` | TEXT | Stringified list of fault names |
| `ai_suggestion` | TEXT | Last AI coaching tip |

---

*Documentation generated on June 20, 2026.*
