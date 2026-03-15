# backend/services/ai_agent.py

import os
import json
import asyncio
import time
from dotenv import load_dotenv
import google.generativeai as genai
from google.api_core.exceptions import ResourceExhausted, ServiceUnavailable

# Load env variables
load_dotenv(override=True)

API_KEY = os.getenv("GEMINI_API_KEY")
TEMP_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "temp_storage")

if not API_KEY:
    raise RuntimeError("❌ GEMINI_API_KEY not found in .env")

# Initialize Gemini client
genai.configure(api_key=API_KEY)

# --- CONFIGURATION ---
PRIMARY_MODEL = "gemini-3-pro-preview"  # Fast, multimodal, latest
FALLBACK_MODEL = "gemini-1.5-pro"       # Stable, high reasoning

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
    "filter": "none" // options: "none", "grayscale", "sepia", "warm", "cool", "vintage"
  }
}
"""

# =========================
# HELPER: VALIDATE SEGMENTS
# =========================
def sanitize_plan(plan):
    """
    Cleans up the AI's output to prevent FFmpeg crashes.
    """
    valid_segments = []
    if "segments_to_keep" in plan:
        for seg in plan["segments_to_keep"]:
            # Rule 1: Start must be < End
            if seg.get("end", 0) <= seg.get("start", 0):
                continue # Skip invalid segments
            
            # Rule 2: Start must be positive
            if seg.get("start", 0) < 0:
                seg["start"] = 0.0
            
            valid_segments.append(seg)
    
    plan["segments_to_keep"] = valid_segments
    return plan

# =========================
# HELPER: UPLOAD VIDEO
# =========================
def upload_video_to_gemini(filename):
    file_path = os.path.join(TEMP_DIR, filename)
    
    if not os.path.exists(file_path):
        print(f"❌ [AI AGENT] File not found locally: {file_path}")
        return None

    print(f"--- 📤 [AI AGENT] Uploading {filename} to Gemini... ---")
    
    # 1. Upload
    try:
        video_file = genai.upload_file(path=file_path)
    except Exception as e:
        print(f"❌ [AI AGENT] Upload failed: {e}")
        return None
    
    # 2. Poll state
    print(f"--- ⏳ [AI AGENT] Processing Video (URI: {video_file.uri})... ---")
    
    # Timeout safety (max 60 seconds wait)
    start_time = time.time()
    while video_file.state.name == "PROCESSING":
        if time.time() - start_time > 60:
            raise TimeoutError("Gemini video processing timed out.")
        time.sleep(2)
        video_file = genai.get_file(video_file.name)
        
    if video_file.state.name == "FAILED":
        raise ValueError(f"Gemini failed to process video: {video_file.state.name}")
        
    print(f"--- ✅ [AI AGENT] Video Ready. ---")
    return video_file

# =========================
# CORE AI FUNCTION
# =========================
async def analyze_command(user_text: str, video_filename: str = None):
    # 1. Prepare Video
    video_file = None
    if video_filename:
        try:
            video_file = upload_video_to_gemini(video_filename)
            if not video_file:
                 return {"explanation": "Error: Video upload failed.", "segments_to_keep": []}
        except Exception as e:
             return {"explanation": f"Error during upload: {str(e)}", "segments_to_keep": []}

    # 2. Construct Request
    prompt_parts = [SYSTEM_PROMPT, f"\nUSER COMMAND: {user_text}"]
    if video_file:
        prompt_parts.append(video_file)

    # 3. Call Model (With Fallback Logic)
    for model_name in [PRIMARY_MODEL, FALLBACK_MODEL]:
        try:
            print(f"--- 🧠 [AI AGENT] Reasoning with {model_name}... ---")
            
            model = genai.GenerativeModel(
                model_name=model_name,
                generation_config={"response_mime_type": "application/json", "temperature": 0.2} 
                # Low temp = more deterministic/accurate
            )
            
            response = model.generate_content(prompt_parts)
            
            # 4. Parsing & Cleanup
            try:
                plan = json.loads(response.text)
                clean_plan = sanitize_plan(plan) # Validate timestamps
                return clean_plan
            
            except json.JSONDecodeError:
                # Handle accidental markdown wrapping
                text = response.text.replace("```json", "").replace("```", "").strip()
                plan = json.loads(text)
                return sanitize_plan(plan)

        except (ResourceExhausted, ServiceUnavailable):
            print(f"⚠️ [AI AGENT] {model_name} overloaded. Switching to fallback...")
            continue # Try next model
            
        except Exception as e:
            print(f"❌ [AI AGENT] Unexpected error: {str(e)}")
            return {"explanation": f"AI Error: {str(e)}", "segments_to_keep": []}

    return {"explanation": "AI Service unavailable after retries.", "segments_to_keep": []}

# =========================
# LOCAL TEST RUNNER
# =========================
if __name__ == "__main__":
    async def test():
        # Ensure 'checklist.mp4' is in 'backend/temp_storage/' 
        test_video = "checklist.mp4" 
        
        print("\n\n=== 🧪 TESTING VOXEDIT PRO AGENT ===")
        
        # Test 1: Vague cleanup
        cmd1 = "Clean up the audio and remove silence."
        print(f"👉 Command: {cmd1}")
        res1 = await analyze_command(cmd1, video_filename=test_video)
        print(f"🤖 AI: {res1.get('explanation')}")
        print(f"✂️ Segments: {len(res1.get('segments_to_keep', []))}\n")
        
        # Test 2: Specific visual query (Edge Case)
        cmd2 = "Keep only the part where the red pen is visible."
        print(f"👉 Command: {cmd2}")
        res2 = await analyze_command(cmd2, video_filename=test_video)
        print(f"🤖 AI: {res2.get('explanation')}")
        print(f"✂️ Segments: {json.dumps(res2.get('segments_to_keep', []), indent=2)}")

    asyncio.run(test())