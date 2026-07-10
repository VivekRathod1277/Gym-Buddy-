# ⚡ Gym Buddy — Frontend

> AI-Powered Biomechanical Analysis Platform  
> React + TypeScript + Vite + Tailwind CSS

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build Tool | Vite 7 |
| Styling | Tailwind CSS v3 |
| Routing | React Router v7 |
| Charts | Recharts |
| Icons | Lucide React |
| Voice | Web Speech API (`window.speechSynthesis`) |

---

## Project Structure

```
src/
├── App.tsx                   ← Root component + route definitions
├── main.tsx                  ← React DOM entry point
├── index.css                 ← Global design system (dark theme tokens)
│
├── pages/
│   ├── AuthPage.tsx          ← Login / Register with neural background
│   ├── WorkoutPage.tsx       ← Main analysis dashboard
│   └── HistoryPage.tsx       ← Progress & session history
│
├── components/
│   ├── Sidebar.tsx           ← Fixed nav: brand, links, mute toggle, logout
│   ├── NeuralBackground.tsx  ← Animated particle canvas (auth page)
│   ├── SessionSummaryModal.tsx ← Post-workout recap modal
│   └── ToastContainer.tsx    ← Global toast notification overlay
│
├── hooks/
│   ├── useAuth.tsx           ← Auth context (login, register, logout)
│   ├── useSessions.tsx       ← Session state + history management
│   ├── useVoice.tsx          ← Web Speech API voice feedback
│   └── useToast.tsx          ← Toast notification system
│
└── types/
    └── index.ts              ← Shared TypeScript types + exercise configs
```

---

## Getting Started

```bash
# Install dependencies
npm install --legacy-peer-deps

# Start development server (http://localhost:3000)
npm run dev

# Build for production
npm run build
```

---

## Pages

| Route | Page | Description |
|---|---|---|
| `/` | AuthPage | Login & Register with animated background |
| `/workout` | WorkoutPage | Live analysis: video feed, rep counter, AI tip |
| `/history` | HistoryPage | Session history, stats, XP |

---

## Design System

Colors (defined as CSS variables in `index.css`):

| Token | Value | Use |
|---|---|---|
| `--gb-bg` | `#0a0a0f` | App background |
| `--gb-cyan` | `#00d4ff` | Primary accent |
| `--gb-violet` | `#7b2ff7` | Secondary accent / AI |
| `--gb-danger` | `#ff4d6d` | Faults / errors |
| `--gb-success` | `#00ff88` | Active / success states |
| `--gb-warning` | `#ffcc00` | Scanning / warning states |

Fonts: **Orbitron** (headings) + **Inter** (body) — loaded via Google Fonts in `index.html`

---

## Backend Integration

The app currently runs with mock data. To connect to the real Python backend:

1. Build the FastAPI backend (`server.py` in the root project)
2. Update `src/hooks/useAuth.tsx` — replace mock `login()`/`register()` with `fetch('/api/auth/...')`
3. Update `src/hooks/useSessions.tsx` — replace mock sessions with `fetch('/api/history')`
4. In `WorkoutPage.tsx` — open a WebSocket to `/ws/analyze` and stream frames

---

*Part of the Gym Buddy MSc project.*
