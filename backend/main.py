import os
import shutil
import speech_recognition as sr
from pydub import AudioSegment
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import json
import ffmpeg
import asyncio

# --- IMPORT CUSTOM SERVICES ---
from services.ai_agent import analyze_command
from services.video_engine import process_video, stitch_videos
from services.voice_gen import generate_voice_reply
from services.sfx_gen import generate_sound_effect

app = FastAPI()

# Allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Fine for now, lock down to your frontend URL later!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Grab the Cloud Run URL from environment variables, fallback to empty string for localhost
BASE_URL = os.environ.get("BASE_URL", "").rstrip('/')

UPLOAD_DIR = "temp_storage"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/files", StaticFiles(directory=UPLOAD_DIR), name="files")

# --- WEBSOCKET FOR REASONING PANEL (NEW) ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        # Send an initial connection log
        await websocket.send_json({"type": "log", "level": "info", "message": "Backend AI Engine Connected."})
        while True:
            # Keep connection alive and listen for any incoming messages
            data = await websocket.receive_text()
            print(f"WS Received: {data}")
    except WebSocketDisconnect:
        print("Client disconnected from WebSocket")

# --- 1. UPLOAD ENDPOINT ---
@app.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {
        "filename": file.filename,
        "url": f"{BASE_URL}/files/{file.filename}" # UPDATED Absolute URL
    }

# --- 2. TEXT EDIT ENDPOINT ---
@app.post("/edit")
async def edit_video(
    command: str = Form(...),
    filename: str = Form(...),
    clip_start: float = Form(0.0),
    clip_duration: float = Form(None)
):
    print(f"🎬 EDIT REQUEST: '{command}'")

    input_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(input_path):
        raise HTTPException(status_code=404, detail="File not found")

    ai_plan = await analyze_command(command)
    actions = ai_plan.get("actions", [])
    explanation = ai_plan.get("explanation", "Processed successfully.")

    if not actions:
        return {
            "status": "success",
            "original_file": filename,
            "processed_url": None,
            "new_duration": None,
            "explanation": explanation,
            "actions": []
        }

    result = await process_video(input_path, actions, clip_start, clip_duration)

    if not result:
        raise HTTPException(status_code=500, detail="Processing failed")

    new_filename = os.path.basename(result["path"])

    return {
        "status": "success",
        "processed_url": f"{BASE_URL}/files/{new_filename}", # UPDATED Absolute URL
        "new_duration": result["duration"],
        "explanation": explanation,
        "actions": actions
    }

# --- 3. VOICE COMMAND ENDPOINT ---
@app.post("/voice-command")
async def voice_command(
    audio: UploadFile = File(...),
    filename: str = Form(...),
    clip_start: float = Form(0.0),
    clip_duration: float = Form(None)
):
    print("🎤 Receiving Voice Command...")

    try:
        temp_audio_path = f"temp_storage/temp_voice_{audio.filename}"

        with open(temp_audio_path, "wb") as buffer:
            shutil.copyfileobj(audio.file, buffer)

        audio_segment = AudioSegment.from_file(temp_audio_path)
        wav_path = temp_audio_path + ".wav"
        audio_segment.export(wav_path, format="wav")

        recognizer = sr.Recognizer()

        with sr.AudioFile(wav_path) as source:
            audio_data = recognizer.record(source)

            try:
                text_command = recognizer.recognize_google(audio_data)
                print(f"🗣️ Transcribed: '{text_command}'")

            except sr.UnknownValueError:
                return {"status": "error", "message": "Could not understand audio"}

            except sr.RequestError:
                return {"status": "error", "message": "Speech service unavailable"}

        if os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)

        if os.path.exists(wav_path):
            os.remove(wav_path)

        ai_plan = await analyze_command(text_command)

        actions = ai_plan.get("actions", [])
        explanation = ai_plan.get("explanation", "Processed successfully.")

        voice_reply_path = generate_voice_reply(explanation)
        voice_reply_url = None

        if voice_reply_path:
            voice_filename = os.path.basename(voice_reply_path)
            voice_reply_url = f"{BASE_URL}/files/{voice_filename}" # UPDATED Absolute URL

        response_data = {
            "status": "success",
            "transcription": text_command,
            "explanation": explanation,
            "reply_audio_url": voice_reply_url,
            "processed_url": None,
            "new_duration": None,
            "actions": actions
        }

        if actions:
            input_path = os.path.join(UPLOAD_DIR, filename)

            result = await process_video(input_path, actions, clip_start, clip_duration)

            if result:
                new_filename = os.path.basename(result["path"])
                response_data["processed_url"] = f"{BASE_URL}/files/{new_filename}" # UPDATED Absolute URL
                response_data["new_duration"] = result["duration"]

        return response_data

    except Exception as e:
        print(f"Voice Error: {e}")
        return {"status": "error", "message": str(e)}

# --- 4. RENDER / EXPORT ENDPOINT ---
@app.post("/render")
async def render_project(
    project_data: str = Form(...)
):
    print("🎬 Received Render Request...")

    try:
        clips = json.loads(project_data)

        if not clips:
            return {"status": "error", "message": "No clips to render"}

        output_path = await stitch_videos(clips)

        if not output_path:
            raise HTTPException(status_code=500, detail="Render failed")

        new_filename = os.path.basename(output_path)

        return {
            "status": "success",
            "url": f"{BASE_URL}/files/{new_filename}" # UPDATED Absolute URL
        }

    except Exception as e:
        print(f"Render API Error: {e}")
        return {"status": "error", "message": str(e)}

# --- 5. SFX ENDPOINT ---
@app.post("/generate-sfx")
async def generate_sfx_endpoint(
    text: str = Form(...),
    duration: int = Form(None)
):

    output_path = generate_sound_effect(text, duration)

    if not output_path:
        raise HTTPException(status_code=500, detail="SFX Generation Failed")

    filename = os.path.basename(output_path)

    try:
        probe = ffmpeg.probe(output_path)
        dur = float(probe['format']['duration'])
    except:
        dur = 3.0

    return {
        "status": "success",
        "url": f"{BASE_URL}/files/{filename}", # UPDATED Absolute URL
        "duration": dur,
        "name": text
    }

# --- START SERVER (CLOUD RUN SAFE) ---
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)