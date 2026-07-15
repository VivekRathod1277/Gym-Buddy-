# Project: Gym Buddy — AI Personal Trainer & Workout Companion

Goal: Fix the live-webcam pose pipeline so it reliably detects and analyzes a person in dim gym lighting, then build out the rest of the AI-trainer workflow from the product spec — personalized greetings, negotiated workout selection, real-time posture correction and rep counting, diet tracking with photo verification, and progressive-overload analysis — on top of the existing MediaPipe + FastAPI + React codebase at github.com/VivekRathod1277/Gym-Buddy-.

## Todo List

### Phase 0 — Security hardening (do this first, before any other work)
- [ ] Step 1: Remove `Gym Buddy.pem` and `Gym Buddy.ppk` from git tracking (`git rm --cached`), add `*.pem`, `*.ppk`, and both exact filenames to `.gitignore`, and commit. These files are already exposed in git history and must be treated as compromised — create `SECURITY_TODO.md` noting that the human maintainer still needs to revoke/rotate the actual key on its cloud provider and purge git history, since neither is safe for an autonomous loop to do unsupervised.
- [ ] Step 2: In `backend-server/backend/dependencies.py`, remove the hardcoded fallback `"super-secret-gym-buddy-key-123456789"` for `JWT_SECRET_KEY` and raise a startup error instead if the environment variable is missing. Add a `.env.example` documenting `JWT_SECRET_KEY` and the vision-API key with placeholder values only.
- [ ] Step 3: Confirm `.env` is listed in `.gitignore` and was never committed; if `git log --follow -- .env` shows it was, add that to `SECURITY_TODO.md` alongside the key-rotation reminder.

### Phase 1 — Fix low-light human detection (priority bug)
- [ ] Step 4: Create `backend-server/core/frame_enhancer.py` with a single `enhance_if_needed(frame)` function — this becomes the one place all lighting-correction logic lives, instead of being duplicated per handler.
- [ ] Step 5: In `enhance_if_needed`, compute the frame's mean brightness (grayscale mean or HSV V-channel mean) and classify it as low-light, normal, or overexposed before deciding whether to enhance.
- [ ] Step 6: For frames classified low-light, convert to LAB color space, apply CLAHE to the L-channel only, then convert back to BGR — this boosts local contrast without the color distortion plain histogram equalization causes.
- [ ] Step 7: Add adaptive gamma correction scaled to how dark the frame is (the darker the frame, the stronger the correction), applied after CLAHE for frames that are still very dark.
- [ ] Step 8: Add light denoising (`cv2.fastNlMeansDenoisingColored` with conservative parameters, or a bilateral filter if that proves too slow for real-time) after brightening, since boosting a dark frame amplifies sensor noise.
- [ ] Step 9: Skip enhancement entirely for frames classified normal/overexposed in Step 5 — enhancing already-good frames tends to hurt detection accuracy, not help it.
- [ ] Step 10: In `backend-server/backend/workout.py`, replace the three duplicated `mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5)` instantiations (in `process_video_task`, `stream_video_ws`, `live_stream_ws`) with one shared factory function that reads thresholds from a single config.
- [ ] Step 11: Add a slightly lower `min_tracking_confidence` specifically for frames flagged low-light, exposed as a tunable constant rather than hardcoded — tune the exact value empirically against Step 16's benchmark instead of guessing.
- [ ] Step 12: Add temporal smoothing across frames (One-Euro filter or exponential moving average per landmark) so one noisy or missed frame doesn't cause a visible jump or a false "no human detected" — hold the last confident landmark position for a few frames before reporting lost tracking.
- [ ] Step 13: Call `enhance_if_needed` from all three pipelines in `backend-server/backend/workout.py`, right before the existing `cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)` line, so the fix applies to uploaded-video processing and both live WebSocket paths.
- [ ] Step 14: Update the `getUserMedia` call in `frontend/src/pages/WorkoutPage.tsx` (currently `{ video: true, audio: false }`) to request `{ video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: false }`.
- [ ] Step 15: Write `backend-server/tools/synthetic_lowlight.py` that takes any well-lit frame or short clip and generates darkened variants (reduced brightness plus sensor-noise grain, at a few severity levels) to simulate dim-gym conditions without needing new real footage yet.
- [ ] Step 16: Write `backend-server/test_lowlight_detection.py` that runs the pose pipeline with enhancement on vs. off across the synthetic-darkened set (and any real clips found in `backend-server/data/lowlight_samples/`, if present) and reports landmark-detection success rate and average confidence for each, so the fix is measured, not assumed.
- [ ] Step 17: Add a `pose_confidence` field to the WebSocket JSON payload sent to the frontend, and show a small inline message in `WorkoutPage.tsx` ("Having trouble seeing you — try adjusting the light or stepping back") whenever confidence stays low for more than about a second, instead of failing silently.

### Phase 2 — Core workflow gaps (per the product spec)
- [ ] Step 18: Add `weight` and `notes` columns to the `exercise_sessions` table in `backend-server/core/database.py` (it currently only stores `total_reps`), since personalized greetings and progressive overload both need more than a rep count.
- [ ] Step 19: Build a `GET /api/workout/greeting` endpoint that reads the logged-in user's most recent session `faults` and `timestamp` and returns a templated line like "Welcome back, {name}! Your {fault} on rep {n} last {day} — let's fix that today," falling back to a generic welcome when there's no history yet.
- [ ] Step 20: Call the greeting endpoint on dashboard load and display it before workout selection, matching the spec's Step 3.
- [ ] Step 21: Create a `workout_schedule` table (`user_id`, `day_of_week`, `target_muscle_group`) with a sensible default weekly split that the user can edit.
- [ ] Step 22: Build workout-selection logic that checks a requested muscle group against the last 7 days of `exercise_sessions`; if that group was already trained twice this week, return a rule-based pushback message suggesting today's scheduled group instead, matching the spec's Step 4 dialogue. Keep this rule-based rather than free-form LLM reasoning about training stats, so it can't misstate the user's actual history.
- [ ] Step 23: On the exercise-selection screen, let the user flag an injury or limitation per body part, and filter or reorder `backend-server/config/exercises/*.json` to avoid or substitute movements that load that area.
- [ ] Step 24: Before the rep-counting loop starts, surface one setup cue per exercise (grip width, hip/back bracing, breathing) sourced from a new `setup_cue` field added to each exercise's JSON blueprint, matching the spec's Step 5 example.
- [ ] Step 25: After each set, show the analysis screen and give the user an explicit "Start next set" / "End workout" choice, rather than only ending when the stream stops, matching the spec's Step 8.
- [ ] Step 26: Fix the documentation mismatch in `backend-server/core/ai_advisor.py` and `DOCS.md`: both describe the vision model as NVIDIA NIM / DeepSeek-V4-Pro, but the code actually calls Google's Gemini-compatible endpoint (`gemini-2.0-flash`). Align the comments, `DOCS.md`, the `.env` variable name, and the code to whichever provider is actually intended.

### Phase 3 — Diet tracking
- [ ] Step 27: Create a `meal_logs` table (`user_id`, `timestamp`, `food_description`, `calories`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`, `iron_mg`, `photo_path`).
- [ ] Step 28: Build daily target calculation using the Mifflin-St Jeor formula for BMR times an activity multiplier for TDEE, with a macro split based on the user's stated goal (cut/maintain/bulk), stored per user and manually editable.
- [ ] Step 29: Build `POST /api/diet/log-photo`: accept a food photo, send it to the existing vision-capable AI client for food identification and calorie/macro estimation, and store the result as pending until the user confirms or edits it — don't auto-log an unconfirmed AI estimate as fact.
- [ ] Step 30: Build a diet dashboard page showing today's logged meals against daily targets (calories, protein, fiber, iron) as progress bars, plus a history view by day and week.
- [ ] Step 31: Add manual meal-plan editing (add/remove/swap foods) independent of photo logging, so users aren't forced to photograph every meal.

### Phase 4 — Progressive overload
- [ ] Step 32: Add a `set_logs` table (`session_id`, `exercise_name`, `set_number`, `weight`, `reps`, `faults`) so progression can be tracked per set, not just per session.
- [ ] Step 33: Prompt the user for the weight they're using at the start of each set for weighted exercises — the webcam can't reliably read plates or dumbbell markings — defaulting to their last logged weight for that exercise.
- [ ] Step 34: Build a progression-analysis function per exercise that compares today's weight times reps against the user's historical best, flags personal records, and detects plateaus (same weight and reps for 3+ consecutive sessions).
- [ ] Step 35: Add a progress page using the existing `recharts` dependency to chart weight and rep trends per exercise over time.
- [ ] Step 36: Feed the PR/plateau detection from Step 34 into the AI advisor so the post-workout analysis (spec Step 7) suggests a concrete next step, like adding weight or adding a rep, tied to the user's stated goal.
