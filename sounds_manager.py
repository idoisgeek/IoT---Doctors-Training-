import wave
import pyaudio
import random
import threading
import time
import queue
from mfrc522 import SimpleMFRC522
import RPi.GPIO as GPIO

class SoundManager:
    def __init__(self, audio_map):
        self.audio_map = audio_map
        self.command_queue = queue.Queue()
        self.stop_event = threading.Event()
        self.audio_thread = threading.Thread(target=self._audio_loop)
        self.current_key = None
        self.lock = threading.Lock()
        self.p = pyaudio.PyAudio()
        self.stream = None
        
    def start(self):
        self.audio_thread.start()
        
    def join(self):
        self.audio_thread.join()
        
    def _play_file(self, file_name):
        speed_factor = random.uniform(0.8, 1.2)
        wf = wave.open(file_name, 'rb')
        original_rate = wf.getframerate()
        new_rate = int(original_rate * speed_factor)
        self.stream = self.p.open(format=self.p.get_format_from_width(wf.getsampwidth()),
                                   channels=wf.getnchannels(),
                                   rate=new_rate,
                                   output=True)
        data = wf.readframes(1024)
        while data:
            with self.lock:
                if self.stop_event.is_set() or self.command_queue.qsize() > 0 or self.current_key == 's':
                    break
            self.stream.write(data)
            data = wf.readframes(1024)
        self.stream.stop_stream()
        self.stream.close()
        self.stream = None
        wf.close()
    
    def _audio_loop(self):
        while not self.stop_event.is_set():
            try:
                key = self.command_queue.get(timeout=0.1)
                with self.lock:
                    self.current_key = key
            except queue.Empty:
                continue

            # Only play if the key (RFID id) is in the audio_map
            if self.current_key in self.audio_map:
                self._play_file(self.audio_map[self.current_key])
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
        self.p.terminate()
             
    
if __name__ == "__main__":
    
    audio_map = {
        1 : '2530_AV.wav',
    }
    reader = SimpleMFRC522()
    sound_manager = SoundManager(audio_map)
    sound_manager.start()

    reader = SimpleMFRC522()
    try:
        while True: 
            print("Place your RFID tag near the reader...")
            id, text = reader.read()
            print(f"Tag ID: {id}")
            print(f"Text: {text}")
            sound_manager.command_queue.put(id)
    except KeyboardInterrupt:
        sound_manager.stop_event.set()
        sound_manager.join()

