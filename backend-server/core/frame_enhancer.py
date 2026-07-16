"""
Frame Enhancer — Low-Light Detection & Enhancement
====================================================
Central place for all lighting-correction logic.
Called before MediaPipe pose estimation to improve detection in dim gym lighting.

Usage:
    from core.frame_enhancer import enhance_if_needed
    enhanced_frame = enhance_if_needed(frame)
"""

import cv2
import numpy as np

# ─── Tunable constants ────────────────────────────────────────────────────────
# Bug 4 fix: raised from 80 → 100. Phone cameras apply auto-HDR, so a dim gym
# can still measure mean brightness ~90-120, causing the low-light path to never
# trigger even when enhancement would help MediaPipe detection.
BRIGHTNESS_LOW_THRESHOLD = 100    # Mean brightness below this → low-light
BRIGHTNESS_HIGH_THRESHOLD = 200   # Mean brightness above this → overexposed
CLAHE_CLIP_LIMIT = 2.5            # CLAHE contrast limit (higher = more contrast)
CLAHE_TILE_GRID_SIZE = (8, 8)     # CLAHE tile size
GAMMA_MIN = 0.4                   # Maximum gamma boost (for very dark frames)
GAMMA_MAX = 1.0                   # No boost (frame is bright enough)
DENOISE_H = 5                     # Bilateral filter sigma (colour strength)
DENOISE_SIGMA_COLOR = 75
DENOISE_SIGMA_SPACE = 75
# ─────────────────────────────────────────────────────────────────────────────

# Reduced MediaPipe tracking confidence for low-light frames (empirically tuned)
LOW_LIGHT_TRACKING_CONFIDENCE = 0.35


def _mean_brightness(frame: np.ndarray) -> float:
    """Return the mean brightness of a BGR frame (HSV V-channel mean)."""
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    return float(np.mean(hsv[:, :, 2]))


def classify_frame(frame: np.ndarray) -> str:
    """
    Classify a frame as 'low_light', 'normal', or 'overexposed'.
    Returns one of those three string labels.
    """
    brightness = _mean_brightness(frame)
    if brightness < BRIGHTNESS_LOW_THRESHOLD:
        return "low_light"
    elif brightness > BRIGHTNESS_HIGH_THRESHOLD:
        return "overexposed"
    return "normal"


def _apply_clahe(frame: np.ndarray) -> np.ndarray:
    """
    Apply CLAHE to the L-channel of the LAB colour space.
    Boosts local contrast without the colour distortion plain histogram
    equalisation causes.
    """
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    l_ch, a_ch, b_ch = cv2.split(lab)
    clahe = cv2.createCLAHE(
        clipLimit=CLAHE_CLIP_LIMIT,
        tileGridSize=CLAHE_TILE_GRID_SIZE
    )
    l_ch = clahe.apply(l_ch)
    lab = cv2.merge([l_ch, a_ch, b_ch])
    return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)


def _apply_gamma(frame: np.ndarray, brightness: float) -> np.ndarray:
    """
    Adaptive gamma correction: darker frames get a stronger boost.
    Gamma is scaled linearly between GAMMA_MIN (very dark) and GAMMA_MAX (threshold).
    """
    # Map brightness [0, LOW_THRESHOLD] → gamma [GAMMA_MIN, GAMMA_MAX]
    ratio = max(0.0, min(1.0, brightness / BRIGHTNESS_LOW_THRESHOLD))
    gamma = GAMMA_MIN + ratio * (GAMMA_MAX - GAMMA_MIN)

    inv_gamma = 1.0 / gamma
    table = np.array([
        ((i / 255.0) ** inv_gamma) * 255
        for i in range(256)
    ], dtype=np.uint8)
    return cv2.LUT(frame, table)


def _apply_denoise(frame: np.ndarray) -> np.ndarray:
    """Light bilateral denoising — removes noise amplified by brightening."""
    return cv2.bilateralFilter(
        frame,
        d=DENOISE_H,
        sigmaColor=DENOISE_SIGMA_COLOR,
        sigmaSpace=DENOISE_SIGMA_SPACE
    )


def enhance_if_needed(frame: np.ndarray) -> tuple[np.ndarray, str]:
    """
    Main entry point. Enhances the frame only if needed.

    Returns:
        (enhanced_frame, classification) where classification is one of
        'low_light', 'normal', 'overexposed'.

    Pipeline for low-light frames:
        1. CLAHE on LAB L-channel  (local contrast boost, no colour shift)
        2. Adaptive gamma           (global brightness correction)
        3. Bilateral denoising      (remove amplified sensor noise)
    Normal/overexposed frames are returned unchanged.
    """
    if frame is None or frame.size == 0:
        return frame, "normal"

    brightness = _mean_brightness(frame)

    if brightness > BRIGHTNESS_HIGH_THRESHOLD:
        return frame, "overexposed"

    if brightness >= BRIGHTNESS_LOW_THRESHOLD:
        return frame, "normal"

    # Low-light pipeline
    enhanced = _apply_clahe(frame)
    enhanced = _apply_gamma(enhanced, brightness)
    enhanced = _apply_denoise(enhanced)
    return enhanced, "low_light"
