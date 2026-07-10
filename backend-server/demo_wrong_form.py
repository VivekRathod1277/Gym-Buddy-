import sys
import main

# Run the 'wrong form' video with pullup config
sys.argv = ["main.py", "Pull ups wrong.mp4", "pullup.json"]
main.main()
