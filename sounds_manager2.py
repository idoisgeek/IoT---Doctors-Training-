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
        self.lock = threading.Lock()
        self.p = pyaudio.PyAudio()
        self.stream = None
        self.is_playing = False
        self.currently_playing_id = None
        
    def start(self):
        self.audio_thread.start()
        
    def join(self):
        self.audio_thread.join()
        
    def _play_file(self, file_name, tag_id):
        self.is_playing = True
        self.currently_playing_id = tag_id
        
        try:
            # Open the wave file
            wf = wave.open(file_name, 'rb')
            speed_factor = random.uniform(0.8, 1.2)
            original_rate = wf.getframerate()
            new_rate = int(original_rate * speed_factor)
            
            # Loop continuously while tag is present
            while self.currently_playing_id == tag_id and not self.stop_event.is_set():
                # Reopen file if we reached the end
                if wf.tell() >= wf.getnframes():
                    wf.rewind()
                    
                # Create and setup stream
                self.stream = self.p.open(format=self.p.get_format_from_width(wf.getsampwidth()),
                                          channels=wf.getnchannels(),
                                          rate=new_rate,
                                          output=True)
                
                # Read a chunk of data and play it
                data = wf.readframes(1024)
                while data and self.currently_playing_id == tag_id and not self.stop_event.is_set():
                    self.stream.write(data)
                    data = wf.readframes(1024)
                    
                # Close the stream
                if self.stream:
                    self.stream.stop_stream()
                    self.stream.close()
                    self.stream = None
        except Exception as e:
            print(f"Error playing audio: {e}")
        finally:
            # Final cleanup
            if 'wf' in locals() and hasattr(wf, 'close'):
                wf.close()
            if self.stream:
                self.stream.stop_stream()
                self.stream.close()
                self.stream = None
            self.is_playing = False
            self.currently_playing_id = None
    
    def _audio_loop(self):
        while not self.stop_event.is_set():
            try:
                # Get command with short timeout to allow for frequent checking
                key = self.command_queue.get(timeout=0.1)
                
                # Check if we need to stop current playback before starting new one
                if self.is_playing and self.currently_playing_id != key:
                    self.currently_playing_id = None
                    time.sleep(0.2)  # Give time for playback to stop
                
                # Play the audio if key exists in audio map
                if key in self.audio_map:
                    self._play_file(self.audio_map[key], key)
                    
            except queue.Empty:
                continue
                
        # Cleanup when thread is stopping
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
        self.p.terminate()
    
    def stop_current_playback(self):
        """Stop the currently playing audio"""
        self.currently_playing_id = None

def main():
    audio_map = {
        1: '2530_AV.wav',
        # Add more mappings as needed
    }
    
    # Initialize components
    reader = SimpleMFRC522()
    sound_manager = SoundManager(audio_map)
    sound_manager.start()
    
    # Keep track of the currently playing tag
    current_tag_id = None
    
    try:
        print("Ready to detect RFID tags...")
        while True:
            try:
                # Use a separate process to check if a tag is present
                # This gives us a clean way to timeout if no tag is found
                read_timeout = 0.5  # half a second timeout
                
                # Create a pipe for communication
                tag_found_pipe = None
                tag_id = None
                
                # Fork a process to read the tag with a timeout
                from multiprocessing import Process, Pipe
                
                def read_tag(conn):
                    try:
                        id, text = reader.read()
                        conn.send(id)
                    except:
                        conn.send(None)
                    finally:
                        conn.close()
                
                parent_conn, child_conn = Pipe()
                p = Process(target=read_tag, args=(child_conn,))
                p.start()
                
                # Wait for read with timeout
                p.join(read_timeout)
                
                if p.is_alive():
                    # Read is taking too long, tag probably removed
                    p.terminate()
                    p.join()
                    tag_id = None
                else:
                    # We got a read result
                    if parent_conn.poll():
                        tag_id = parent_conn.recv()
                
                # Handle tag presence/absence
                if tag_id is not None:
                    # Tag is present
                    if current_tag_id != tag_id:
                        print(f"Tag detected: {tag_id}")
                        sound_manager.command_queue.put(tag_id)
                        current_tag_id = tag_id
                else:
                    # No tag present
                    if current_tag_id is not None:
                        print("Tag removed")
                        sound_manager.stop_current_playback()
                        current_tag_id = None
                
            except Exception as e:
                print(f"Error in main loop: {e}")
                if current_tag_id is not None:
                    sound_manager.stop_current_playback()
                    current_tag_id = None
                time.sleep(0.5)
            
    except KeyboardInterrupt:
        print("\nExiting...")
    finally:
        # Clean up
        sound_manager.stop_event.set()
        sound_manager.join()
        GPIO.cleanup()

if __name__ == "__main__":
    main()