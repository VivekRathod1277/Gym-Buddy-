import sys
import main

# Run the 'wrong form' video in slow motion with pullup config
sys.argv = ["main.py", "Pull ups wrong.mp4", "pullup.json", "--slow"]
main.main()
