import traceback
import sys

try:
    import main
    sys.argv = ["main.py", "Untitled design~2.mp4", "pushup.json"]
    main.main()
except Exception:
    with open("main_traceback.txt", "w") as f:
        f.write(traceback.format_exc())
