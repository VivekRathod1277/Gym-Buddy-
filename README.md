# Gym Trainer — Project Structure

```
Gym Posture/
│
├── app.py                    ← Web Dashboard (Streamlit UI)
├── main.py                   ← Command-line entry point
│
├── train_model.py            ← Train posture classifier on your own data
├── collect_data.py           ← Record labeled landmark data from webcam
├── setup_model.py            ← Quick setup: generates data + trains model
│
├── data/
│   └── labeled_landmarks.csv ← Labeled pose data (33 landmarks × 4 values)
│
├── models/
│   ├── posture_classifier.pkl ← Trained Random Forest classifier
│   └── label_encoder.pkl     ← Label encoder for class names
│
├── core/
│   ├── ml_model.py           ← PostureClassifier: loads and runs the model
│   ├── physics_engine.py     ← Biomechanical math: angles, reps, phase detection
│   ├── voice_feedback.py     ← Non-blocking TTS voice assistant
│   ├── ai_advisor.py         ← Deep analysis engine (async)
│   └── database.py           ← SQLite: user auth + session history
│
├── config/
│   └── exercises/
│       ├── pushup.json       ← Pushup blueprint (angles, thresholds, faults)
│       ├── pullup.json       ← Pullup blueprint
│       └── squat.json        ← Squat blueprint
│
├── demo_wrong_form.py        ← Demo: wrong form video (slow motion)
├── demo_right_form.py        ← Demo: correct form video
├── demo_pushup.py            ← Demo: pushup video
│
├── gym_ai.db                 ← SQLite database (auto-created)
├── requirements.txt          ← Python dependencies
└── README.md                 ← Project documentation
```

## Quick Start

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Train the custom posture model
```bash
py -3.9 setup_model.py
```

### 3. Launch the web dashboard
```bash
py -3.9 -m streamlit run app.py
```

### 4. Or run from command line
```bash
py -3.9 main.py "pushup.mp4"
```

## Model Details

| Property | Value |
|---|---|
| Architecture | Random Forest |
| Estimators | 200 |
| Max Depth | 15 |
| Input Features | 132 (33 landmarks × x, y, z, visibility) |
| Output Classes | good_form, bad_form_partial, bad_form_elbow, bad_form_neck, rest |
| Dataset | `data/labeled_landmarks.csv` |

## Collecting Your Own Data

Run `collect_data.py` and use the following keys while performing exercises:

| Key | Label |
|---|---|
| `1` | good_form |
| `2` | bad_form_partial |
| `3` | bad_form_elbow |
| `4` | bad_form_neck |
| `r` | rest |
| `q` | quit |
