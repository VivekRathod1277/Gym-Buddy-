import sqlite3
import hashlib
import os

DB_PATH = "gym_ai.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
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
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    conn.commit()
    conn.close()

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def register_user(email, password):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("INSERT INTO users (email, password) VALUES (?, ?)", (email, hash_password(password)))
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        return False

def login_user(email, password):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE email = ? AND password = ?", (email, hash_password(password)))
    user = cursor.fetchone()
    conn.close()
    return user[0] if user else None

def save_session(user_id, exercise_name, total_reps, faults, ai_suggestion):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO exercise_sessions (user_id, exercise_name, total_reps, faults, ai_suggestion)
        VALUES (?, ?, ?, ?, ?)
    """, (user_id, exercise_name, total_reps, str(faults), ai_suggestion))
    conn.commit()
    conn.close()

def get_user_history(user_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT timestamp, exercise_name, total_reps, faults, ai_suggestion 
        FROM exercise_sessions WHERE user_id = ? ORDER BY timestamp DESC
    """, (user_id,))
    history = cursor.fetchall()
    conn.close()
    return history

# Initialize on import
init_db()
