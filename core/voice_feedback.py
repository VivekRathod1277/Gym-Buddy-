import pyttsx3
import threading
import queue
import sys

class VoiceAssistant:
    def __init__(self):
        self.message_queue = queue.Queue()
        self.thread = threading.Thread(target=self._worker, daemon=True)
        self.thread.start()
        
    def _worker(self):
        try:
            import pythoncom
            pythoncom.CoInitialize()
        except Exception:
            pass
            
        while True:
            msg = self.message_queue.get()
            if msg is None:
                break
            
            try:
                print(f"[VOICE] Speaking: {msg}")
                # Re-initialize engine for each message to ensure audio focus
                engine = pyttsx3.init(driverName='sapi5')
                # Higher rate for maximum responsiveness
                engine.setProperty('rate', 175)
                engine.setProperty('volume', 1.0)
                
                engine.say(msg)
                engine.runAndWait()
                
                # Explicitly stop/close engine to release resources
                del engine
            except Exception as e:
                print(f"[VOICE ERROR] {e}")
            finally:
                self.message_queue.task_done()
            
    def speak(self, text):
        """
        Non-blocking TTS call.
        """
        if text:
            self.message_queue.put(text)

    def clear_queue(self):
        """
        Drop all pending messages to prevent voice lag buildup.
        """
        while not self.message_queue.empty():
            try:
                self.message_queue.get_nowait()
                self.message_queue.task_done()
            except Exception:
                break
        
    def close(self):
        self.message_queue.put(None)
        # We don't necessarily need to join here to avoid hanging on exit
        # as it's a daemon thread.

