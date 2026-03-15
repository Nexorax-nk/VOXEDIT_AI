# backend/services/voice_gen.py
import os
import uuid
import hashlib
from elevenlabs.client import ElevenLabs
from elevenlabs import VoiceSettings
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Client
client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

# Configuration
TEMP_DIR = "temp_storage"
os.makedirs(TEMP_DIR, exist_ok=True)

# 🚀 CACHE SYSTEM: Stores { "text_hash": "file_path" }
# This makes common responses ("Okay.", "Done.") instant.
AUDIO_CACHE = {}

def generate_voice_reply(text: str):
    """
    Generates conversational audio using ElevenLabs Turbo v2.5.
    Includes caching for zero-latency repeats.
    """
    if not text:
        return None

    try:
        # 1. CHECK CACHE (Instant Return)
        # Create a unique hash for the text to use as a key
        text_hash = hashlib.md5(text.encode('utf-8')).hexdigest()
        
        if text_hash in AUDIO_CACHE:
            cached_path = AUDIO_CACHE[text_hash]
            if os.path.exists(cached_path):
                print(f"⚡ Cache Hit! Serving existing audio for: '{text[:20]}...'")
                return cached_path

        print(f"🎙️ Generating New Voice for: '{text[:30]}...'")

        # 2. GENERATE STREAM (Using Turbo 2.5)
        audio_stream = client.text_to_speech.convert(
            text=text,
            voice_id="JBFqnCBsd6RMkjVDRZzb", # 'Adam' (Great narrator voice)
            model_id="eleven_turbo_v2_5",    # 🚀 UPGRADE: Newer, faster, more natural
            output_format="mp3_44100_128",
            voice_settings=VoiceSettings(
                stability=0.4,       # Lower = more emotion/variation
                similarity_boost=0.8 # Higher = clearer voice
            )
        )

        # 3. SAVE FILE
        filename = f"reply_{uuid.uuid4()}.mp3"
        filepath = os.path.join(TEMP_DIR, filename)
        
        with open(filepath, "wb") as f:
            for chunk in audio_stream:
                if chunk:
                    f.write(chunk)
        
        # 4. UPDATE CACHE
        AUDIO_CACHE[text_hash] = filepath
        
        print(f"✅ Voice generated: {filepath}")
        return filepath

    except Exception as e:
        print(f"❌ ElevenLabs Error: {e}")
        return None

# =========================
# LOCAL TEST RUNNER
# =========================
if __name__ == "__main__":
    print("Testing Conversational Voice...")
    
    # First run (Generates)
    path1 = generate_voice_reply("Hello! I am VoxAgent.")
    
    # Second run (Should hit cache)
    path2 = generate_voice_reply("Hello! I am VoxAgent.")
    
    if path1 == path2:
        print("🎉 Success! Caching is working.")