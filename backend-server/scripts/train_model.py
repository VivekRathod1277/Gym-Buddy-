"""
Custom Posture Classification Model — Trainer
=============================================
Trains a Random Forest classifier on labeled landmark data
collected from exercise videos.

Dataset: data/labeled_landmarks.csv
Output:  models/posture_classifier.pkl
"""

import pandas as pd
import numpy as np
import pickle
import os
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
from sklearn.preprocessing import LabelEncoder

DATA_PATH  = os.path.join("data", "labeled_landmarks.csv")
MODEL_DIR  = "models"
MODEL_PATH = os.path.join(MODEL_DIR, "posture_classifier.pkl")
ENCODER_PATH = os.path.join(MODEL_DIR, "label_encoder.pkl")

os.makedirs(MODEL_DIR, exist_ok=True)

def load_data():
    df = pd.read_csv(DATA_PATH)
    print(f"[INFO] Loaded {len(df)} samples with columns: {list(df.columns)}")
    return df

def train():
    df = load_data()

    # Features = all landmark coordinate columns (x, y, z, visibility)
    feature_cols = [c for c in df.columns if c not in ["label", "exercise"]]
    X = df[feature_cols].values
    y = df["label"].values

    # Encode labels to integers
    le = LabelEncoder()
    y_enc = le.fit_transform(y)

    # Train / test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_enc, test_size=0.2, random_state=42, stratify=y_enc
    )

    print(f"[INFO] Training on {len(X_train)} samples, testing on {len(X_test)}")

    # Model
    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=15,
        min_samples_split=4,
        random_state=42,
        n_jobs=-1
    )
    clf.fit(X_train, y_train)

    # Evaluation
    y_pred = clf.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"\n[RESULT] Test Accuracy: {acc * 100:.2f}%")
    print("\n[REPORT]\n", classification_report(y_test, y_pred, target_names=le.classes_))

    # Save model + encoder
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(clf, f)
    with open(ENCODER_PATH, "wb") as f:
        pickle.dump(le, f)

    print(f"\n[SAVED] Model → {MODEL_PATH}")
    print(f"[SAVED] Encoder → {ENCODER_PATH}")

if __name__ == "__main__":
    train()
