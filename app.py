import streamlit as st
import cv2
import tempfile
import time
import os
import mediapipe as mp
from core.physics_engine import PhysicsEngine
from core.voice_feedback import VoiceAssistant
from core.ai_advisor import AIAdvisor
from core.database import register_user, login_user, save_session, get_user_history

# ─────────────────────────────────────────────
#  PAGE CONFIG  (must be first Streamlit call)
# ─────────────────────────────────────────────
st.set_page_config(
    page_title="Gym Trainer",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ─────────────────────────────────────────────
#  GLOBAL CSS INJECTION
# ─────────────────────────────────────────────
def inject_css():
    st.markdown(
        """
        <style>
        /* ── Google Fonts ── */
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Inter:wght@400;500;600&display=swap');

        /* ── Root & Background ── */
        html, body, [data-testid="stAppViewContainer"] {
            background: #0a0a0f !important;
            color: #e0e0e0;
            font-family: 'Inter', sans-serif;
        }
        [data-testid="stHeader"] { background: transparent !important; }
        [data-testid="stSidebar"] {
            background: linear-gradient(180deg, #0d0d1a 0%, #11111f 100%) !important;
            border-right: 1px solid #1e1e3a;
        }

        /* ── Hero Title ── */
        .hero-title {
            text-align: center;
            font-family: 'Orbitron', monospace;
            font-size: clamp(2rem, 5vw, 3.5rem);
            font-weight: 900;
            background: linear-gradient(135deg, #00d4ff 0%, #7b2ff7 60%, #ff006e 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            letter-spacing: 4px;
            margin: 0;
            padding: 20px 0 5px 0;
        }
        .hero-subtitle {
            text-align: center;
            font-size: 0.8rem;
            letter-spacing: 5px;
            color: #555580;
            font-family: 'Inter', sans-serif;
            margin-bottom: 30px;
        }

        /* ── Auth Card ── */
        .auth-card {
            background: rgba(18, 18, 36, 0.85);
            border: 1px solid rgba(0, 212, 255, 0.15);
            border-radius: 18px;
            padding: 40px 35px;
            backdrop-filter: blur(20px);
            box-shadow: 0 25px 80px rgba(0, 0, 0, 0.6), 0 0 40px rgba(0, 212, 255, 0.05);
            max-width: 480px;
            margin: 0 auto;
        }
        .auth-card-title {
            font-family: 'Orbitron', monospace;
            font-size: 1.1rem;
            font-weight: 700;
            color: #00d4ff;
            letter-spacing: 3px;
            margin-bottom: 24px;
            text-transform: uppercase;
        }

        /* ── Inputs ── */
        [data-testid="stTextInput"] input {
            background: rgba(255,255,255,0.04) !important;
            border: 1px solid rgba(0, 212, 255, 0.2) !important;
            border-radius: 10px !important;
            color: #e0e0e0 !important;
            padding: 12px 16px !important;
            font-size: 0.95rem !important;
            transition: border-color 0.3s;
        }
        [data-testid="stTextInput"] input:focus {
            border-color: #00d4ff !important;
            box-shadow: 0 0 0 2px rgba(0, 212, 255, 0.15) !important;
        }
        [data-testid="stTextInput"] label {
            color: #8888aa !important;
            font-size: 0.8rem !important;
            letter-spacing: 1.5px !important;
            text-transform: uppercase !important;
        }

        /* ── Buttons ── */
        [data-testid="stButton"] > button {
            background: linear-gradient(135deg, #00d4ff 0%, #0077ff 100%) !important;
            color: #000 !important;
            font-family: 'Orbitron', monospace !important;
            font-weight: 700 !important;
            font-size: 0.8rem !important;
            letter-spacing: 2px !important;
            border: none !important;
            border-radius: 10px !important;
            padding: 14px 28px !important;
            width: 100% !important;
            cursor: pointer !important;
            transition: all 0.25s ease !important;
            text-transform: uppercase !important;
            margin-top: 10px !important;
        }
        [data-testid="stButton"] > button:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 8px 25px rgba(0, 212, 255, 0.45) !important;
        }

        /* ── Tabs ── */
        [data-testid="stTabs"] [data-baseweb="tab-list"] {
            background: transparent !important;
            border-bottom: 1px solid #1e1e3a !important;
            gap: 4px;
        }
        [data-testid="stTabs"] [data-baseweb="tab"] {
            background: transparent !important;
            color: #555580 !important;
            font-family: 'Orbitron', monospace !important;
            font-size: 0.7rem !important;
            letter-spacing: 2px !important;
            font-weight: 600 !important;
            border-radius: 0 !important;
            padding: 12px 20px !important;
            border: none !important;
        }
        [data-testid="stTabs"] [aria-selected="true"] {
            color: #00d4ff !important;
            border-bottom: 2px solid #00d4ff !important;
        }

        /* ── Metric Cards ── */
        .stat-card {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(0,212,255,0.15);
            border-radius: 14px;
            padding: 20px;
            text-align: center;
        }
        .stat-value {
            font-family: 'Orbitron', monospace;
            font-size: 2.8rem;
            font-weight: 900;
            color: #00d4ff;
            line-height: 1;
        }
        .stat-label {
            color: #555580;
            font-size: 0.7rem;
            letter-spacing: 3px;
            text-transform: uppercase;
            margin-top: 6px;
        }
        .stat-card-warning .stat-value { color: #ff4d6d; }

        /* ── AI Advisor Panel ── */
        .ai-panel {
            background: linear-gradient(135deg, rgba(123,47,247,0.08), rgba(255,0,110,0.05));
            border: 1px solid rgba(123,47,247,0.3);
            border-radius: 14px;
            padding: 18px 22px;
        }
        .ai-panel-title {
            font-family: 'Orbitron', monospace;
            font-size: 0.65rem;
            color: #7b2ff7;
            letter-spacing: 3px;
            text-transform: uppercase;
            margin-bottom: 8px;
        }
        .ai-panel-text {
            color: #c0c0e0;
            font-size: 0.9rem;
            line-height: 1.6;
        }

        /* ── History Card ── */
        .history-card {
            background: rgba(18, 18, 36, 0.7);
            border: 1px solid rgba(0, 212, 255, 0.1);
            border-radius: 12px;
            padding: 18px 22px;
            margin-bottom: 12px;
        }
        .history-exercise {
            font-family: 'Orbitron', monospace;
            font-size: 0.75rem;
            color: #00d4ff;
            letter-spacing: 2px;
            text-transform: uppercase;
        }
        .history-reps {
            font-size: 2rem;
            font-weight: 700;
            color: #e0e0e0;
        }
        .history-fault {
            color: #ff4d6d;
            font-size: 0.8rem;
        }
        .history-suggestion {
            color: #8888aa;
            font-size: 0.85rem;
            font-style: italic;
            margin-top: 8px;
        }

        /* ── Sidebar ── */
        .sidebar-logo {
            font-family: 'Orbitron', monospace;
            font-size: 1rem;
            font-weight: 700;
            color: #00d4ff;
            letter-spacing: 2px;
            margin-bottom: 4px;
        }
        .sidebar-email {
            font-size: 0.75rem;
            color: #555580;
        }
        .sidebar-divider {
            border: none;
            border-top: 1px solid #1e1e3a;
            margin: 16px 0;
        }

        /* ── Alert overrides ── */
        .stAlert {
            border-radius: 10px !important;
            border-left-width: 4px !important;
        }

        /* ── Selectbox ── */
        [data-testid="stSelectbox"] > div > div {
            background: rgba(255,255,255,0.04) !important;
            border: 1px solid rgba(0,212,255,0.2) !important;
            border-radius: 10px !important;
            color: #e0e0e0 !important;
        }
        [data-testid="stSelectbox"] label {
            color: #8888aa !important;
            font-size: 0.8rem !important;
            letter-spacing: 1.5px !important;
            text-transform: uppercase !important;
        }

        /* ── File uploader ── */
        [data-testid="stFileUploader"] {
            border: 1px dashed rgba(0,212,255,0.3) !important;
            border-radius: 12px !important;
            padding: 10px !important;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )

inject_css()

# ─────────────────────────────────────────────
#  SESSION STATE
# ─────────────────────────────────────────────
for key, val in [("logged_in", False), ("user_id", None), ("email", "")]:
    if key not in st.session_state:
        st.session_state[key] = val


# ─────────────────────────────────────────────
#  AUTHENTICATION PAGE
# ─────────────────────────────────────────────
def auth_page():
    # Centre content
    _, col, _ = st.columns([1, 1.2, 1])
    with col:
        st.markdown('<p class="hero-title">⚡ GYM TRAINER</p>', unsafe_allow_html=True)
        st.markdown('<p class="hero-subtitle">BIOMECHANICAL ANALYSIS PLATFORM</p>', unsafe_allow_html=True)

        login_tab, reg_tab = st.tabs(["  🔐  LOGIN  ", "  👤  REGISTER  "])

        with login_tab:
            st.markdown('<div class="auth-card">', unsafe_allow_html=True)
            st.markdown('<p class="auth-card-title">Sign In</p>', unsafe_allow_html=True)
            email = st.text_input("Email Address", key="l_email", placeholder="you@example.com")
            password = st.text_input("Password", type="password", key="l_pass", placeholder="••••••••")
            if st.button("SIGN IN", key="login_btn"):
                uid = login_user(email, password)
                if uid:
                    st.session_state.logged_in = True
                    st.session_state.user_id = uid
                    st.session_state.email = email
                    st.rerun()
                else:
                    st.error("Invalid credentials. Please check your email and password.")
            st.markdown("</div>", unsafe_allow_html=True)

        with reg_tab:
            st.markdown('<div class="auth-card">', unsafe_allow_html=True)
            st.markdown('<p class="auth-card-title">Create Account</p>', unsafe_allow_html=True)
            new_email = st.text_input("Email Address", key="r_email", placeholder="you@example.com")
            new_pass = st.text_input("Password", type="password", key="r_pass", placeholder="Min. 8 characters")
            if st.button("CREATE ACCOUNT", key="register_btn"):
                if not new_email or "@" not in new_email:
                    st.error("Please enter a valid email address.")
                elif len(new_pass) < 6:
                    st.error("Password must be at least 6 characters.")
                elif register_user(new_email, new_pass):
                    st.success("✅ Account created! Please switch to the Login tab.")
                else:
                    st.error("This email is already registered.")
            st.markdown("</div>", unsafe_allow_html=True)


# ─────────────────────────────────────────────
#  SIDEBAR
# ─────────────────────────────────────────────
def render_sidebar():
    with st.sidebar:
        st.markdown(f'<p class="sidebar-logo">⚡ GYM PARTNER</p>', unsafe_allow_html=True)
        st.markdown(f'<p class="sidebar-email">ACTIVE MEMBER</p>', unsafe_allow_html=True)
        st.markdown('<hr class="sidebar-divider">', unsafe_allow_html=True)
        
        page = st.radio(
            "NAVIGATION",
            options=["🏋️  Workout", "📊  History"],
            label_visibility="visible"
        )
        
        st.markdown('<hr class="sidebar-divider">', unsafe_allow_html=True)
        if st.button("🚪 LOGOUT"):
            for key in ["logged_in", "user_id", "email"]:
                st.session_state[key] = False if key == "logged_in" else None if key == "user_id" else ""
            st.rerun()
        
        return page.split("  ")[-1]  # strip icon


# ─────────────────────────────────────────────
#  WORKOUT PAGE
# ─────────────────────────────────────────────
def workout_page():
    st.markdown('<p class="hero-title" style="font-size:1.8rem; text-align:left; padding:0;">WORKOUT ANALYSIS</p>', unsafe_allow_html=True)
    st.markdown("---")

    ctrl_col, vid_col = st.columns([1, 2], gap="large")

    with ctrl_col:
        st.markdown("##### ⚙️ CONFIGURATION")
        mode = st.selectbox("Input Mode", ["Upload Video", "Live Webcam"])
        exercise = st.selectbox("Exercise Override", ["auto", "pushup.json", "pullup.json", "squat.json"])

        uploaded = None
        if mode == "Upload Video":
            uploaded = st.file_uploader("Upload Workout Video", type=["mp4", "mov", "avi", "mkv"])

        st.markdown("---")
        start = st.button("▶  START ANALYSIS")
        

    with vid_col:
        st.markdown("##### 🎥 LIVE FEED")
        video_placeholder = st.empty()
        st.markdown("---")

        m1, m2, m3 = st.columns(3)
        with m1: reps_ph = st.empty()
        with m2: angle_ph = st.empty()
        with m3: status_ph = st.empty()

    if start:
        source = None
        if mode == "Live Webcam":
            source = 0
        elif uploaded:
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
            tmp.write(uploaded.read())
            source = tmp.name
        else:
            st.warning("Please upload a video file to continue.")
            return

        ex_file = exercise if exercise != "auto" else "auto"
        run_analysis(source, ex_file, video_placeholder, reps_ph, angle_ph, status_ph)


# ─────────────────────────────────────────────
#  ANALYSIS RUNNER
# ─────────────────────────────────────────────
def run_analysis(source, exercise_file, video_ph, reps_ph, angle_ph, status_ph):
    voice = VoiceAssistant()
    advisor = AIAdvisor()
    cap = cv2.VideoCapture(source)

    # ── Slow Motion: calculate per-frame delay ──
    native_fps = cap.get(cv2.CAP_PROP_FPS) or 30
    SLOW_MOTION_FACTOR = 3.0  # 3x slower than real-time
    frame_delay = SLOW_MOTION_FACTOR / native_fps  # seconds to wait per frame

    def _set_status(text, color="#00ff88"):
        status_ph.markdown(
            f'<div class="stat-card"><div class="stat-value" style="font-size:1.2rem;color:{color};">{text}</div>'
            f'<div class="stat-label">STATUS</div></div>',
            unsafe_allow_html=True,
        )

    # ── Auto-detect exercise ──
    if exercise_file == "auto":
        _set_status("SCANNING", "#ffcc00")
        ret, frame = cap.read()
        if ret:
            exercise_name = advisor.detect_exercise(frame)
            exercise_file = f"{exercise_name}.json"
            voice.speak(f"Detected {exercise_name}. Starting session.")
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
    else:
        exercise_name = exercise_file.split(".")[0]
        voice.speak(f"Starting {exercise_name} session.")

    blueprint_path = os.path.join("config", "exercises", exercise_file)
    engine = PhysicsEngine(blueprint_path)

    mp_pose = mp.solutions.pose
    pose = mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5)
    mp_draw = mp.solutions.drawing_utils

    last_reps = 0
    last_fault_time = 0
    last_spoken_fault = None
    current_ai = "⏳ Waiting for AI analysis..."
    ai_fetch_time = 0

    _set_status("ACTIVE")

    def on_ai(text):
        nonlocal current_ai, ai_fetch_time
        current_ai = text
        ai_fetch_time = time.time()
        voice.speak(f"Posture Tip: {text}")

    # Auto-trigger Gemini after 3 seconds
    gemini_triggered = False

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = pose.process(rgb)

        if results.pose_landmarks:
            mp_draw.draw_landmarks(
                rgb, results.pose_landmarks, mp_pose.POSE_CONNECTIONS,
                mp_draw.DrawingSpec(color=(0, 200, 255), thickness=2, circle_radius=3),
                mp_draw.DrawingSpec(color=(200, 200, 255), thickness=1),
            )
            eval_data = engine.evaluate_frame(results.pose_landmarks.landmark)
            if eval_data:
                reps = eval_data["reps"]
                fault = eval_data["active_fault"]
                angle = int(eval_data["angle"])

                reps_ph.markdown(
                    f'<div class="stat-card"><div class="stat-value">{reps}</div><div class="stat-label">REPS</div></div>',
                    unsafe_allow_html=True,
                )
                angle_ph.markdown(
                    f'<div class="stat-card"><div class="stat-value" style="font-size:2rem;">{angle}°</div><div class="stat-label">JOINT ANGLE</div></div>',
                    unsafe_allow_html=True,
                )

                if reps > last_reps:
                    voice.clear_queue()  # drop stale messages before speaking rep
                    voice.speak(f"Rep {reps}")
                    last_reps = reps
                    last_spoken_fault = None

                if fault and fault != last_spoken_fault:
                    voice.speak(fault)
                    last_spoken_fault = fault

                # Auto-trigger Gemini on first rep
                if reps >= 1 and not gemini_triggered:
                    advisor.analyze_frame(frame, exercise_name, on_ai)
                    gemini_triggered = True

        # Resize for display
        h, w = rgb.shape[:2]
        if w > 1080:
            scale = 1080 / w
            rgb = cv2.resize(rgb, None, fx=scale, fy=scale)

        video_ph.image(rgb, channels="RGB", use_container_width=True)

        # Slow motion delay — makes video 3x slower and gives voice time to speak
        time.sleep(frame_delay)


    cap.release()
    voice.close()
    _set_status("DONE", "#7b2ff7")

    # Save session
    session = engine.get_session_data()
    save_session(
        st.session_state.user_id,
        session.get("exercise", exercise_file),
        session.get("total_reps", last_reps),
        session.get("faults_recorded", []),
        current_ai,
    )
    st.success(f"✅ Session saved! Total Reps: {last_reps}")


# ─────────────────────────────────────────────
#  HISTORY PAGE
# ─────────────────────────────────────────────
def history_page():
    st.markdown('<p class="hero-title" style="font-size:1.8rem; text-align:left; padding:0;">YOUR PROGRESS</p>', unsafe_allow_html=True)
    st.markdown("---")

    history = get_user_history(st.session_state.user_id)

    if not history:
        st.info("No sessions recorded yet. Start training to see your progress here!")
        return

    # Summary stats
    total_reps = sum(row[2] for row in history)
    total_sessions = len(history)

    s1, s2, s3 = st.columns(3)
    s1.markdown(f'<div class="stat-card"><div class="stat-value">{total_sessions}</div><div class="stat-label">TOTAL SESSIONS</div></div>', unsafe_allow_html=True)
    s2.markdown(f'<div class="stat-card"><div class="stat-value">{total_reps}</div><div class="stat-label">TOTAL REPS</div></div>', unsafe_allow_html=True)
    s3.markdown(f'<div class="stat-card"><div class="stat-value">{total_sessions * 5} <span style="font-size:1rem">XP</span></div><div class="stat-label">EXPERIENCE</div></div>', unsafe_allow_html=True)

    st.markdown("---")
    st.markdown("##### 📋 SESSION HISTORY")

    for row in history:
        timestamp, exercise, reps, faults, suggestion = row
        st.markdown(f"""
        <div class="history-card">
            <div class="history-exercise">{exercise.upper().replace('.JSON','')}</div>
            <div style="display:flex; gap:20px; align-items:center; margin:8px 0;">
                <span class="history-reps">{reps}</span>
                <span style="color:#555580; font-size:0.8rem;">reps completed</span>
            </div>
            <div class="history-fault">⚠ {faults}</div>
            <div class="history-suggestion">🧠 {suggestion}</div>
            <div style="font-size:0.7rem; color:#333355; margin-top:8px;">{timestamp}</div>
        </div>
        """, unsafe_allow_html=True)


# ─────────────────────────────────────────────
#  APP ROUTER
# ─────────────────────────────────────────────
if not st.session_state.logged_in:
    auth_page()
else:
    page = render_sidebar()
    if "History" in page:
        history_page()
    else:
        workout_page()
