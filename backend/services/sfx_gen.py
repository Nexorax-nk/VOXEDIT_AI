# backend/services/sfx_gen.py
import os
import uuid
import numpy as np
import math
from pydub import AudioSegment
from pydub.generators import WhiteNoise, Sine, Square
from elevenlabs.client import ElevenLabs
from dotenv import load_dotenv

load_dotenv()

client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

TEMP_DIR = "temp_storage"
os.makedirs(TEMP_DIR, exist_ok=True)

# ==========================================
# 🎹 SMART FALLBACK ENGINE (Local Synthesis)
# ==========================================
def generate_fallback_sfx(filepath: str, text: str, duration_ms: int = 1500):
    """
    Generates a procedural sound based on keywords so the demo never fails.
    """
    print(f"⚠️ API Failed. Synthesizing local sound for: '{text}'")
    text = text.lower()
    
    try:
        sound = None

        # 1. Beeps / UI Sounds
        if "beep" in text or "click" in text or "ping" in text:
            # High pitched sine wave with fast decay
            sound = Sine(880).to_audio_segment(duration=200).fade_out(100)
        
        # 2. Boom / Impact / Thunder
        elif "boom" in text or "impact" in text or "thud" in text:
            # Low frequency noise with heavy fade out
            noise = WhiteNoise().to_audio_segment(duration=800)
            sound = noise.low_pass_filter(200).fade_out(600).apply_gain(5)

        # 3. Laser / Sci-Fi (The "Pew Pew")
        elif "laser" in text or "shot" in text or "gun" in text:
            # Generate a frequency slide (chirp) using numpy
            sample_rate = 44100
            duration_s = 0.3
            t = np.linspace(0, duration_s, int(sample_rate * duration_s))
            # Slide frequency from 800Hz down to 100Hz
            frequency = np.linspace(800, 100, len(t))
            waveform = np.sin(2 * np.pi * frequency * t) * 0.5
            
            # Convert numpy array to AudioSegment
            audio_data = (waveform * 32767).astype(np.int16).tobytes()
            sound = AudioSegment(audio_data, frame_rate=sample_rate, sample_width=2, channels=1)

        # 4. Success / Notification
        elif "success" in text or "correct" in text or "win" in text:
            # Major Chord (C - E - G)
            note1 = Sine(523.25).to_audio_segment(duration=400).fade_out(200) # C5
            note2 = Sine(659.25).to_audio_segment(duration=400).fade_out(200) # E5
            note3 = Sine(783.99).to_audio_segment(duration=800).fade_out(600) # G5
            sound = note1.overlay(note2, position=100).overlay(note3, position=200)

        # 5. Default (Ambient Swell)
        else:
            sound = WhiteNoise().to_audio_segment(duration=duration_ms).low_pass_filter(500).fade_in(500).fade_out(500)

        # Normalize and Export
        sound = sound.normalize()
        sound.export(filepath, format="mp3")
        print(f"✅ Fallback SFX Generated: {filepath}")
        return filepath

    except Exception as e:
        print(f"❌ Fallback Gen Error: {e}")
        # Ultimate fail-safe: A tiny quiet blip
        try:
            Sine(440).to_audio_segment(duration=100).export(filepath, format="mp3")
            return filepath
        except:
            return None

# ==========================================
# 🌩️ MAIN GENERATOR (ElevenLabs)
# ==========================================
def generate_sound_effect(text: str, duration_seconds: float = None):
    """
    Generates a high-quality sound effect using ElevenLabs.
    """
    filename = f"sfx_{uuid.uuid4()}.mp3"
    filepath = os.path.join(TEMP_DIR, filename)

    try:
        print(f"✨ Generating High-Fidelity SFX: '{text}'...")

        # Convert simple float to None if 0/empty to let AI decide optimal length
        dur = duration_seconds if duration_seconds and duration_seconds > 0 else None

        # 1. Call API
        # Using the correct SDK method for SFX
        result = client.text_to_sound_effects.convert(
            text=text,
            duration_seconds=dur, 
            prompt_influence=0.5 # Balanced between creativity and instruction
        )

        # 2. Save File
        with open(filepath, "wb") as f:
            for chunk in result:
                if chunk:
                    f.write(chunk)
        
        # Verify file size (sometimes API returns empty valid streams on error)
        if os.path.getsize(filepath) < 1000:
             raise ValueError("Generated file is too small (API likely failed silently)")

        print(f"✅ SFX Saved: {filepath}")
        return filepath

    except Exception as e:
        print(f"❌ ElevenLabs SFX Error: {e}")
        print("🔄 Switching to Smart Fallback Mode...")
        
        # Calculate duration for fallback (default 1.5s if not specified)
        fb_dur = int(duration_seconds * 1000) if duration_seconds else 1500
        return generate_fallback_sfx(filepath, text, fb_dur)

# =========================
# LOCAL TEST RUNNER
# =========================
if __name__ == "__main__":
    print("--- Testing SFX Module ---")
    
    # Test 1: Fallback Logic (Mocking a Laser)
    print("\n1. Testing 'Laser' Fallback (Procedural Generation)...")
    path = generate_fallback_sfx(os.path.join(TEMP_DIR, "test_laser.mp3"), "laser gun shoot")
    
    # Test 2: Fallback Logic (Mocking a Success Chime)
    print("\n2. Testing 'Success' Fallback (Musical Generation)...")
    path = generate_fallback_sfx(os.path.join(TEMP_DIR, "test_success.mp3"), "success notification")