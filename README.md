<div align="center">

# 🏋️ Gym Buddy — AI Fitness Trainer

**Real-Time Exercise Form Analysis powered by Computer Vision, Biomechanics & AI**

[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-0.10.14-FF6F00?style=flat-square&logo=google&logoColor=white)](https://mediapipe.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

</div>

---

## 📖 Overview

**Gym Buddy** is a full-stack AI-powered fitness application that analyzes exercise form in real-time using computer vision. It tracks 33 body landmarks per frame, counts reps via a biomechanical state machine, detects form faults, and delivers instant spoken coaching feedback.

### How It Works

| Layer | Technology | What It Does |
|---|---|---|
| **Pose Estimation** | Google MediaPipe | Extracts 33 body landmarks per frame |
| **Biomechanical Analysis** | Custom Physics Engine | Counts reps, detects form faults via JSON rules |
| **ML Classification** | Random Forest (scikit-learn) | Classifies posture quality in real-time |
| **AI Coaching** | NVIDIA NIM (DeepSeek) | Vision-based contextual coaching tips |
| **Voice Feedback** | pyttsx3 (SAPI5) | Spoken rep counts, fault alerts & AI tips |

---

## ✨ Features

- 🎥 **Real-Time Pose Tracking** — MediaPipe tracks 33 skeleton keypoints at low latency
- 🤖 **AI Exercise Detection** — Automatically identifies the exercise being performed
- ⚙️ **Biomechanical Rep Counter** — State-machine detects concentric vs. eccentric phases
- 🔊 **Non-Blocking Voice Assistant** — Auditory feedback without interrupting the video stream
- 🧠 **NVIDIA NIM AI Advisor** — Vision-language model generates dynamic, personalised tips
- 📊 **Session History Dashboard** — Tracks XP, reps, and session logs per user
- 🔐 **JWT Authentication** — Secure user login and registration
- 📡 **WebSocket Live Streaming** — Real-time frame-by-frame analysis via WebSocket

### Supported Exercises

| Exercise | Fault Detection |
|---|---|
| **Pushup** | Sagging back, piked hips, neck position |
| **Pullup** | Shoulder swing, chin not clearing bar |
| **Squat** | Knee cave, excessive forward lean, depth |
| **Bicep Curl** | Elbow drift, shoulder swing |
| **Chest Press** | Elbow flare, incomplete extension |

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                   │
│  ┌─────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐│
│  │AuthPage │  │ TrainerPage  │  │ WorkoutPage  │  │HistoryPage ││
│  └────┬────┘  └──────┬───────┘  └──────┬───────┘  └──────┬─────┘│
│       │              │ Voice / WS      │ WebSocket       │ REST │
│       │              │ & REST          │ (live frames)   │      │
└───────┼──────────────┼─────────────────┼─────────────────┼──────┘
        │              │                 │                 │
   ┌────▼──────────────▼─────────────────▼─────────────────▼───────┐
   │                   BACKEND (FastAPI + Uvicorn)                 │
   │                                                               │
   │  ┌────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────┐ │
   │  │auth.py │  │ coach.py   │  │ workout.py │  │ sessions.py  │ │
   │  │(JWT)   │  │(AI Trainer)│  │ (REST+WS)  │  │ (CRUD)       │ │
   │  └────────┘  └─────┬──────┘  └─────┬──────┘  └──────────────┘ │
   │                    │               │                          │
   │      ┌─────────────┼───────────────┼──────────────────┐       │
   │      ▼             ▼               ▼                  ▼       │
   │ ┌────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐ │
   │ │  Physics   │ │  ai_coach.py │ │  ML Model    │ │ ai_advisor│ │
   │ │  Engine    │ │ (DeepSeek)   │ │  (sklearn)   │ │ (NVIDIA) │ │
   │ └─────┬──────┘ └──────────────┘ └──────────────┘ └──────────┘ │
   │       │                                                       │
   │ ┌─────▼──────┐                                                │
   │ │  MediaPipe │  (Pose Landmark Detection)                     │
   │ └────────────┘                                                │
   │                                                               │
   │ ┌──────────────┐  ┌────────────────────────┐                  │
   │ │  SQLite DB   │  │  Voice Feedback (Web/  │                  │
   │ │  (gym_ai.db) │  │  pyttsx3 SAPI5)        │                  │
   │ └──────────────┘  └────────────────────────┘                  │
   └───────────────────────────────────────────────────────────────┘
```

---

## 🗂️ Project Structure

```
Gym Posture/
│
├── README.md
├── .gitignore
│
├── assets/                            ← Demo media
│   └── Login Page Animation video.mp4
│
├── infra/                             ← Deployment config (secrets gitignored)
│   ├── Dockerfile                     ← Docker build for the backend
│   └── Gym Buddy.pem / .ppk           ← SSH keys (local only, not in repo)
│
├── docs/                              ← Full documentation
│   ├── DOCS.md                        ← Detailed technical docs
│   └── tasks/                         ← Dev task tracking
│
├── frontend/                          ← React + Vite frontend
│   ├── src/
│   │   ├── App.tsx                    ← Root component + routing
│   │   ├── pages/
│   │   │   ├── AuthPage.tsx           ← Login / Register
│   │   │   ├── WorkoutPage.tsx        ← Upload + live analysis
│   │   │   └── HistoryPage.tsx        ← Session history
│   │   ├── components/
│   │   │   ├── NeuralBackground.tsx   ← Three.js animated background
│   │   │   ├── SessionSummaryModal.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.tsx
│   │   │   ├── useSessions.tsx
│   │   │   └── useVoice.tsx
│   │   └── lib/
│   │       └── api.ts                 ← Axios base instance
│   └── package.json
│
├── backend-server/                    ← Python FastAPI backend
│   ├── main.py                        ← CLI entry point (webcam / video file)
│   ├── requirements.txt
│   ├── render.yaml                    ← Render deployment config
│   ├── .env                           ← API keys (gitignored)
│   │
│   ├── backend/                       ← FastAPI routers
│   │   ├── main.py                    ← FastAPI app factory + CORS
│   │   ├── auth.py                    ← JWT register + login
│   │   ├── workout.py                 ← REST + WebSocket workout endpoints
│   │   ├── sessions.py                ← Session CRUD
│   │   ├── schemas.py                 ← Pydantic models
│   │   └── dependencies.py            ← JWT validation dependency
│   │
│   ├── core/                          ← Core engine modules
│   │   ├── physics_engine.py          ← Biomechanics + rep counting
│   │   ├── ml_model.py                ← Random Forest classifier
│   │   ├── ai_advisor.py              ← NVIDIA NIM integration
│   │   ├── voice_feedback.py          ← Non-blocking TTS
│   │   ├── database.py                ← SQLite ORM
│   │   ├── process_video.py           ← Offline batch video processing
│   │   └── process_video_with_audio.py
│   │
│   ├── scripts/                       ← ML training pipeline
│   │   ├── collect_data.py            ← Webcam data collector
│   │   ├── train_model.py             ← Train classifier from CSV
│   │   └── setup_model.py             ← Quick setup: generate + train
│   │
│   ├── config/exercises/              ← JSON exercise blueprints
│   │   ├── pushup.json
│   │   ├── pullup.json
│   │   ├── squat.json
│   │   ├── bicep_curl.json
│   │   └── chest_press.json
│   │
│   ├── models/                        ← Trained ML artifacts (gitignored)
│   ├── data/                          ← Training dataset (gitignored)
│   ├── temp_uploads/                  ← Runtime upload cache (gitignored)
│   └── processed_videos/              ← Runtime output cache (gitignored)
│
└── videos/                            ← Sample reference videos
    ├── input/
    └── output/
```

---

## 🚀 Quick Start

### Prerequisites

- Python 3.9+
- Node.js 18+
- An [NVIDIA NIM API key](https://build.nvidia.com/) (free tier available)

---

### 1. Clone the Repository

```bash
git clone https://github.com/VivekRathod1277/Gym-Buddy-.git
cd "Gym-Buddy-"
```

---

### 2. Backend Setup

```bash
cd backend-server

# Install Python dependencies
pip install -r requirements.txt
```

**Train the ML Model** (required on first run):

```bash
python scripts/setup_model.py
```

**Start the Backend API:**

```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

API live at `http://127.0.0.1:8000` · Swagger docs at `http://127.0.0.1:8000/docs`

---

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

App opens at `http://localhost:5173`

---

### 4. (Optional) CLI Mode

```bash
cd backend-server

# Webcam live feed
python main.py 0

# Video file (auto-detect exercise)
python main.py "my_workout.mp4"

# Video file + specific blueprint
python main.py "my_squat.mp4" squat.json
```

| Key | Action |
|---|---|
| `a` | Trigger AI analysis on current frame |
| `q` | Quit and export session JSON |

---

## 🧠 ML Model Details

| Property | Value |
|---|---|
| Architecture | Random Forest |
| Estimators | 200 trees |
| Max Depth | 15 |
| Input Features | 132 (33 landmarks × x, y, z, visibility) |
| Output Classes | `good_form`, `bad_form_partial`, `bad_form_elbow`, `bad_form_neck`, `rest` |
| Model Size | ~8.8 MB |

**Collect custom training data:**

```bash
python scripts/collect_data.py
```

| Key | Label |
|---|---|
| `1` | good_form |
| `2` | bad_form_partial |
| `3` | bad_form_elbow |
| `4` | bad_form_neck |
| `r` | rest |
| `q` | quit |

```bash
python scripts/train_model.py
```

---

## 📡 API Reference

Base URL: `http://localhost:8000/api`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Register a new user |
| `POST` | `/auth/login-json` | Login → receive JWT |
| `GET` | `/auth/me` | Get current user profile |
| `POST` | `/workout/process-video` | Upload video for processing |
| `GET` | `/workout/tasks/{task_id}` | Poll processing status |
| `GET` | `/workout/videos/{task_id}` | Stream processed video |
| `WS` | `/workout/ws/live-stream` | WebSocket live camera stream |
| `GET` | `/sessions/history` | Get workout history |
| `POST` | `/sessions/save` | Save a completed session |

---

## 🐳 Docker

```bash
# Build
docker build -f infra/Dockerfile -t gym-buddy-backend ./backend-server

# Run
docker run -p 8000:8000 --env-file backend-server/.env gym-buddy-backend
```

Also configured for **Render** deployment via `backend-server/render.yaml`.

---

## 🛠️ Tech Stack

**Backend:** `Python` · `FastAPI` · `Uvicorn` · `MediaPipe` · `OpenCV` · `scikit-learn` · `pyttsx3` · `SQLite` · `PyJWT` · `NVIDIA NIM`

**Frontend:** `React 19` · `TypeScript` · `Vite 7` · `Tailwind CSS` · `Three.js` · `Recharts` · `Radix UI` · `Axios` · `Zod`

---

## 🗄️ Database Schema

The app uses SQLite (`gym_ai.db`) for user management and session history.

### `users` Table
| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT |
| `email` | TEXT | UNIQUE NOT NULL |
| `password` | TEXT | NOT NULL (SHA-256 hash) |
| `name` | TEXT | Optional user name for AI greetings |

### `exercise_sessions` Table
| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT |
| `user_id` | INTEGER | FOREIGN KEY → users(id) |
| `timestamp` | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| `exercise_name` | TEXT | — |
| `total_reps` | INTEGER | — |
| `duration_seconds` | INTEGER | DEFAULT 0 |
| `faults` | TEXT | Stringified list of faults |
| `ai_suggestion` | TEXT | Last AI coaching tip |

---

## 📄 License

This project is licensed under the MIT License.

---

<div align="center">
Made with ❤️ by <a href="https://github.com/VivekRathod1277">Vivek Rathod</a>
</div>
