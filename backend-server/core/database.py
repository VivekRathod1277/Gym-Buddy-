import sqlite3
import hashlib
import os
from datetime import datetime, timedelta

DB_PATH = "gym_ai.db"

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


def _get_conn():
    """Get a database connection with row_factory for dict-like access."""
    conn = sqlite3.connect(DB_PATH)
    return conn


def init_db():
    conn = _get_conn()
    cursor = conn.cursor()

    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT DEFAULT NULL
        )
    ''')

    # Session data table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS exercise_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            exercise_name TEXT,
            total_reps INTEGER,
            faults TEXT,
            ai_suggestion TEXT,
            duration INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    # Migrate existing tables: add columns if they don't exist
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN name TEXT DEFAULT NULL")
    except sqlite3.OperationalError:
        pass  # Column already exists

    try:
        cursor.execute("ALTER TABLE exercise_sessions ADD COLUMN duration INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass  # Column already exists

    conn.commit()
    conn.close()


def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()


def register_user(email, password):
    try:
        conn = _get_conn()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO users (email, password) VALUES (?, ?)", (email, hash_password(password)))
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        return False


def login_user(email, password):
    conn = _get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE email = ? AND password = ?", (email, hash_password(password)))
    user = cursor.fetchone()
    conn.close()
    return user[0] if user else None


# ── User Profile ─────────────────────────────────────────────────────────────

def get_user_name(user_id: int) -> str | None:
    """Get the display name for a user, or None if not set."""
    conn = _get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    return row[0] if row and row[0] else None


def update_user_name(user_id: int, name: str) -> bool:
    """Set or update the user's display name."""
    conn = _get_conn()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET name = ? WHERE id = ?", (name.strip(), user_id))
    conn.commit()
    affected = cursor.rowcount
    conn.close()
    return affected > 0


# ── Session Storage ──────────────────────────────────────────────────────────

def save_session(user_id, exercise_name, total_reps, faults, ai_suggestion, duration=0):
    conn = _get_conn()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO exercise_sessions (user_id, exercise_name, total_reps, faults, ai_suggestion, duration)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (user_id, exercise_name, total_reps, str(faults), ai_suggestion, duration))
    conn.commit()
    conn.close()


def get_user_history(user_id):
    conn = _get_conn()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT timestamp, exercise_name, total_reps, faults, ai_suggestion 
        FROM exercise_sessions WHERE user_id = ? ORDER BY timestamp DESC
    """, (user_id,))
    history = cursor.fetchall()
    conn.close()
    return history


# ── AI Trainer: Weekly History ───────────────────────────────────────────────

def get_weekly_muscle_history(user_id: int) -> dict:
    """
    Returns exercise counts grouped by muscle group for the last 7 days.
    Example: {"chest": 3, "back": 1, "legs": 0, "arms": 2}
    """
    conn = _get_conn()
    cursor = conn.cursor()
    seven_days_ago = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
        SELECT exercise_name, COUNT(*) as cnt
        FROM exercise_sessions
        WHERE user_id = ? AND timestamp >= ?
        GROUP BY exercise_name
    """, (user_id, seven_days_ago))
    rows = cursor.fetchall()
    conn.close()

    # Aggregate by muscle group
    muscle_counts = {"chest": 0, "back": 0, "legs": 0, "arms": 0}
    for exercise_name, count in rows:
        if exercise_name:
            key = exercise_name.lower().strip()
            muscle = EXERCISE_MUSCLE_MAP.get(key, None)
            if muscle:
                muscle_counts[muscle] += count

    return muscle_counts


def get_last_session_faults(user_id: int) -> dict | None:
    """
    Returns the most recent session's exercise name, faults, and timestamp.
    Used for the personalized greeting.
    Returns None if no sessions exist.
    """
    conn = _get_conn()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT exercise_name, faults, timestamp, total_reps
        FROM exercise_sessions
        WHERE user_id = ?
        ORDER BY timestamp DESC
        LIMIT 1
    """, (user_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    exercise_name, faults_str, timestamp, total_reps = row
    # Parse faults from stored string format
    faults = []
    if faults_str and faults_str != "[]":
        # Handle both "['a', 'b']" and "a, b" formats
        cleaned = faults_str.strip("[]'\"")
        if cleaned:
            faults = [f.strip().strip("'\"") for f in cleaned.split(",") if f.strip()]

    return {
        "exercise_name": exercise_name or "unknown",
        "faults": faults,
        "timestamp": timestamp,
        "total_reps": total_reps or 0,
    }


# Initialize on import
init_db()
