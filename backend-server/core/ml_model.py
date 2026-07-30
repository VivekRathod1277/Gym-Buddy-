"""
Posture Classifier — Custom Trained Model Interface
=====================================================
Loads the trained RandomForest model from models/posture_classifier.pkl
and exposes a simple predict() API for use in main.py / app.py.

If the trained model file is not found, falls back to landmark
visibility-based heuristics.
"""

import pickle
import os
import numpy as np

MODEL_PATH   = os.path.join("models", "posture_classifier.pkl")
ENCODER_PATH = os.path.join("models", "label_encoder.pkl")


_cached_model = None
_cached_encoder = None
_is_loaded = False

class PostureClassifier:
    """
    Custom posture classification model trained on labeled landmark data.
    Architecture: Random Forest (200 estimators, max_depth=15)
    Dataset: 33 MediaPipe landmark coordinates (x, y, z, visibility) per frame.
    """

    def __init__(self):
        global _cached_model, _cached_encoder, _is_loaded
        if not _is_loaded:
            self.model   = None
            self.encoder = None
            self._load()
            _cached_model = self.model
            _cached_encoder = self.encoder
            _is_loaded = True
        else:
            self.model = _cached_model
            self.encoder = _cached_encoder

    def _load(self):
        if os.path.exists(MODEL_PATH) and os.path.exists(ENCODER_PATH):
            with open(MODEL_PATH, "rb") as f:
                self.model = pickle.load(f)
            with open(ENCODER_PATH, "rb") as f:
                self.encoder = pickle.load(f)
            print("[PostureClassifier] Custom model loaded successfully.")
        else:
            print("[PostureClassifier] No trained model found. Using heuristic mode.")

    def predict(self, pose_landmarks) -> str:
        """
        Predict the posture quality label for a given set of MediaPipe landmarks.

        Args:
            pose_landmarks: mediapipe.framework.formats.landmark_pb2.NormalizedLandmarkList

        Returns:
            str: Predicted label (e.g., 'good_form', 'bad_form_partial')
        """
        if self.model is None:
            return self._heuristic_predict(pose_landmarks)

        row = []
        for lm in pose_landmarks.landmark:
            row += [lm.x, lm.y, lm.z, lm.visibility]

        X = np.array(row).reshape(1, -1)
        pred_idx = self.model.predict(X)[0]
        label = self.encoder.inverse_transform([pred_idx])[0]
        return label

    def _heuristic_predict(self, pose_landmarks) -> str:
        """
        Fallback: checks average joint visibility as a proxy for form quality.
        """
        landmarks = pose_landmarks.landmark
        key_joints = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26]  # shoulders, elbows, wrists, hips, knees
        avg_visibility = sum(landmarks[i].visibility for i in key_joints) / len(key_joints)

        if avg_visibility > 0.75:
            return "good_form"
        elif avg_visibility > 0.5:
            return "bad_form_partial"
        else:
            return "low_visibility"

    def get_confidence(self, pose_landmarks) -> float:
        """Returns model confidence (probability) for the top prediction."""
        if self.model is None:
            return 0.0

        row = []
        for lm in pose_landmarks.landmark:
            row += [lm.x, lm.y, lm.z, lm.visibility]

        X = np.array(row).reshape(1, -1)
        proba = self.model.predict_proba(X)[0]
        return float(np.max(proba))


# ── Backward-compatible alias (used in main.py as ExerciseClassifier) ──
ExerciseClassifier = PostureClassifier
