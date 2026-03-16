import os
import json
import asyncio
import time
from dotenv import load_dotenv

# 1. IMPORT THE NEW SDK
from google import genai
from google.genai import types
from google.api_core.exceptions import ResourceExhausted, ServiceUnavailable

# Load env variables
load_dotenv(override=True)

API_KEY = os.getenv("GEMINI_API_KEY")
TEMP_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "temp_storage")

if not API_KEY:
    raise RuntimeError("❌ GEMINI_API_KEY not found in .env")

# 2. INITIALIZE THE NEW CLIENT
client = genai.Client(api_key=API_KEY)

# --- CONFIGURATION ---
PRIMARY_MODEL = "gemini-3-pro-preview"  # Fast, multimodal, latest
FALLBACK_MODEL = "gemini-1.5-pro"     # Quick fallback

# --- THE "ANTI-HALLUCINATION" SYSTEM PROMPT ---
SYSTEM_PROMPT = """
You are **VOXEDIT AGENT**, an autonomous AI video editor.
Your goal is to translate natural language commands into precise, executable FFmpeg edit plans.

### INPUT DATA:
1. **User Command**: A specific editing instruction.
2. **Video Content**: Visuals and Audio from the attached file.

### 🧠 REASONING PROTOCOL (Perform this internally):
1. **Scan**: Watch the video from 00:00 to the end.
2. **Identify**: Locate the *exact* timestamps of events mentioned by the user (e.g., "silence", "laughter", "red car").
3. **Verify**: Double-check that these events actually happen. Do not invent events.
4. **Plan**: Calculate the `start` and `end` timestamps for the segments to KEEP.

### 🛡️ CRITICAL RULES (Anti-Hallucination):
1. **"Keep" Strategy**: You define what stays. Everything else is deleted.
2. **Silence Removal**: If asked to remove silence, identify disjointed speech segments. 
   - *Example*: User speaks 0-5s, silence 5-10s, speaks 10-15s. -> Keep [0,5] and [10,15].
3. **Impossible Requests**: If the user asks for something not in the video (e.g., "Show the dinosaur" but there is no dinosaur), return an empty segment list and explain why.
4. **Precision**: Use floats for timestamps (e.g., 12.45). Start must always be less than End.
5. **Context**: If the command is vague (e.g., "Fix it"), assume standard cleanup (remove long silences, improve contrast).

### OUTPUT FORMAT (STRICT JSON):
Return ONLY this JSON object. No markdown.
{
  "explanation": "I found 3 segments where you were speaking and removed the long pauses.",
  "segments_to_keep": [
    { "start": 0.0, "end": 4.5, "label": "Intro speech" },
    { "start": 8.2, "end": 15.0, "label": "Main point" }
  ],
  "global_effects": {
    "speed": 1.0, 
    "filter": "none"
  }
}
"""

def sanitize_plan(plan):
    valid_segments = []
    if "segments_to_keep" in plan:
        for seg in plan["segments_to_keep"]:
            if seg.get("end", 0) <= seg.get("start", 0):
                continue
            if seg.get("start", 0) < 0:
                seg["start"] = 0.0
            valid_segments.append(seg)
    plan["segments_to_keep"] = valid_segments
    return plan

def upload_video_to_gemini(filename):
    file_path = os.path.join(TEMP_DIR, filename)
    if not os.path.exists(file_path):
        print(f"❌ [AI AGENT] File not found locally: {file_path}")
        return None

    print(f"--- 📤 [AI AGENT] Uploading {filename} to Gemini... ---")
    try:
        # 3. NEW UPLOAD METHOD
        video_file = client.files.upload(file=file_path)
    except Exception as e:
        print(f"❌ [AI AGENT] Upload failed: {e}")
        return None
    
    print(f"--- ⏳ [AI AGENT] Processing Video (URI: {video_file.uri})... ---")
    start_time = time.time()
    while video_file.state.name == "PROCESSING":
        if time.time() - start_time > 60:
            raise TimeoutError("Gemini video processing timed out.")
        time.sleep(2)
        # 4. NEW GET FILE METHOD
        video_file = client.files.get(name=video_file.name)
        
    if video_file.state.name == "FAILED":
        raise ValueError(f"Gemini failed to process video: {video_file.state.name}")
        
    print(f"--- ✅ [AI AGENT] Video Ready. ---")
    return video_file

async def analyze_command(user_text: str, video_filename: str = None):
    video_file = None
    if video_filename:
        try:
            video_file = upload_video_to_gemini(video_filename)
            if not video_file:
                 return {"explanation": "Error: Video upload failed.", "segments_to_keep": []}
        except Exception as e:
             return {"explanation": f"Error during upload: {str(e)}", "segments_to_keep": []}

    prompt_parts = [SYSTEM_PROMPT, f"\nUSER COMMAND: {user_text}"]
    if video_file:
        prompt_parts.append(video_file)

    for model_name in [PRIMARY_MODEL, FALLBACK_MODEL]:
        try:
            print(f"--- 🧠 [AI AGENT] Reasoning with {model_name}... ---")
            
            # 5. NEW GENERATE CONTENT METHOD
            response = client.models.generate_content(
                model=model_name,
                contents=prompt_parts,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2
                )
            )
            
            try:
                plan = json.loads(response.text)
                return sanitize_plan(plan)
            except json.JSONDecodeError:
                text = response.text.replace("```json", "").replace("```", "").strip()
                plan = json.loads(text)
                return sanitize_plan(plan)

        except (ResourceExhausted, ServiceUnavailable):
            print(f"⚠️ [AI AGENT] {model_name} overloaded. Switching to fallback...")
            continue
            
        except Exception as e:
            print(f"❌ [AI AGENT] Unexpected error: {str(e)}")
            return {"explanation": f"AI Error: {str(e)}", "segments_to_keep": []}

    return {"explanation": "AI Service unavailable after retries.", "segments_to_keep": []}