# backend/services/subtitle_gen.py
import os
import math
import ffmpeg
from faster_whisper import WhisperModel
import torch

TEMP_DIR = "temp_storage"

# --- CONFIG ---
# Use "tiny" or "base" for speed (Hackathon). Use "medium" for accuracy.
MODEL_SIZE = "base" 

# Check for GPU
device = "cuda" if torch.cuda.is_available() else "cpu"
compute_type = "float16" if device == "cuda" else "int8"

print(f"🧠 Loading Whisper ({MODEL_SIZE}) on {device}...")
try:
    model = WhisperModel(MODEL_SIZE, device=device, compute_type=compute_type)
except Exception:
    print("⚠️ GPU Failed. Fallback to CPU...")
    model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")

def generate_subtitles(filename: str):
    """
    Generates timestamped subtitles for a video.
    Returns a list of segments: [{start, end, text}, ...]
    """
    input_path = os.path.join(TEMP_DIR, filename)
    if not os.path.exists(input_path):
        return None

    try:
        print(f"🎬 Transcribing: {filename}...")
        
        # 1. Transcribe (Directly from video file works with faster-whisper!)
        segments, info = model.transcribe(input_path, beam_size=5)

        # 2. Format Results
        subtitle_data = []
        for segment in segments:
            subtitle_data.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip(),
                "confidence": segment.avg_logprob
            })

        print(f"✅ Generated {len(subtitle_data)} subtitle lines.")
        return subtitle_data

    except Exception as e:
        print(f"❌ Subtitle Error: {e}")
        return None