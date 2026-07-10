import pyttsx3
import sys

def main():
    print("Testing pyttsx3 voice engine...")
    try:
        engine = pyttsx3.init()
        print("Success initializing default driver.")
        print("Voices available:")
        voices = engine.getProperty('voices')
        for i, voice in enumerate(voices):
            print(f"  [{i}] ID: {voice.id}, Name: {voice.name}, Languages: {voice.languages}")
            
        print("Attempting to speak 'Hello, testing voice assistant.'...")
        engine.say("Hello, testing voice assistant.")
        engine.runAndWait()
        print("Speak completed successfully.")
    except Exception as e:
        print(f"Error with default driver: {e}")
        
    print("\nTesting with 'sapi5' driver...")
    try:
        engine = pyttsx3.init(driverName='sapi5')
        print("Success initializing sapi5 driver.")
        engine.say("Hello, testing sapi5 driver.")
        engine.runAndWait()
        print("Speak with sapi5 completed successfully.")
    except Exception as e:
        print(f"Error with sapi5 driver: {e}")

if __name__ == "__main__":
    main()
