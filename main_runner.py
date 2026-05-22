import traceback
import sys

try:
    import main
    sys.argv = ["main.py", "videoplayback (1).mp4", "squat.json"]
    main.main()
except Exception:
    with open("main_traceback.txt", "w") as f:
        f.write(traceback.format_exc())
