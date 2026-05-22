import sys
import main

# Run the pushup video in slow motion
sys.argv = ["main.py", "pushup.mp4", "pushup.json", "--slow"]
main.main()
