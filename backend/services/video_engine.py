# backend/services/video_engine.py
import ffmpeg
import os
import uuid
import subprocess
import json
import math
from functools import lru_cache

# Define where temporary files go
TEMP_DIR = "temp_storage"
os.makedirs(TEMP_DIR, exist_ok=True)

# ==========================================
# 🚀 HARDWARE ACCELERATION (With Validation)
# ==========================================
@lru_cache(maxsize=1)
def get_hardware_encoder():
    """
    Checks for available hardware encoders.
    """
    print("🕵️ Checking hardware acceleration support...")
    try:
        # We query ffmpeg for encoders
        result = subprocess.run(['ffmpeg', '-encoders'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        # Check NVIDIA
        if 'h264_nvenc' in result.stdout:
            print("🚀 Hardware: NVIDIA NVENC Detected")
            return 'h264_nvenc', 'p4'
        
        # Check Intel QSV
        if 'h264_qsv' in result.stdout:
            print("🚀 Hardware: Intel QSV Detected")
            return 'h264_qsv', 'fast'
            
        # Check Mac
        if 'h264_videotoolbox' in result.stdout:
             print("🚀 Hardware: Apple VideoToolbox Detected")
             return 'h264_videotoolbox', 'default'

    except Exception as e:
        print(f"⚠️ Hardware check failed: {e}")

    print("🐢 Hardware: CPU Fallback (libx264)")
    return 'libx264', 'ultrafast' # Default to speed for CPU

# ==========================================
# 🧠 SMART STITCHING (Self-Healing)
# ==========================================
async def execute_smart_stitch(input_path, output_path, segments):
    print(f"--- ✂️ Smart Stitching {len(segments)} segments ---")
    
    # 1. Attempt with Best Encoder
    video_codec, preset = get_hardware_encoder()
    
    success = await _run_stitch_pass(input_path, output_path, segments, video_codec, preset)
    
    # 2. Fallback to CPU if HW fails (Self-Healing)
    if not success and video_codec != 'libx264':
        print("⚠️ HW Encoder Failed! Switching to CPU (libx264)...")
        success = await _run_stitch_pass(input_path, output_path, segments, 'libx264', 'ultrafast')
        
    return success

async def _run_stitch_pass(input_path, output_path, segments, video_codec, preset):
    try:
        # Probe Input
        probe = ffmpeg.probe(input_path)
        video_info = next(s for s in probe['streams'] if s['codec_type'] == 'video')
        src_w = int(video_info['width'])
        src_h = int(video_info['height'])
        has_audio = any(s['codec_type'] == 'audio' for s in probe['streams'])
        
        inp = ffmpeg.input(input_path)
        concat_parts = [] 

        for seg in segments:
            start = float(seg['start'])
            end = float(seg['end'])
            
            # VIDEO: Trim + Reset PTS + Force Source Resolution
            v = (
                inp.video
                .trim(start=start, end=end)
                .setpts('PTS-STARTPTS')
                .filter('scale', w=src_w, h=src_h)
                .filter('setsar', 1) 
            )
            concat_parts.append(v)
            
            # AUDIO: Trim + Reset PTS
            if has_audio:
                a = (
                    inp.audio
                    .filter_('atrim', start=start, end=end)
                    .filter_('asetpts', 'PTS-STARTPTS')
                )
                concat_parts.append(a)

        # Concatenate
        if has_audio:
            joined = ffmpeg.concat(*concat_parts, v=1, a=1).node
            out = ffmpeg.output(joined[0], joined[1], output_path, vcodec=video_codec, preset=preset, acodec='aac')
        else:
            joined = ffmpeg.concat(*concat_parts, v=1, a=0).node
            out = ffmpeg.output(joined[0], output_path, vcodec=video_codec, preset=preset)

        out.run(overwrite_output=True, quiet=True)
        return True

    except ffmpeg.Error as e:
        # Log the specific error to help debug
        err_msg = e.stderr.decode() if e.stderr else str(e)
        print(f"NVIDIA NVENC is not Detected skiping the NVIDIA acceleration") # Print first 200 chars
        return False

# ==========================================
# ⚙️ MAIN PROCESSOR (Legacy Tools + Smart)
# ==========================================
async def process_video(input_path: str, actions: list, clip_start: float = 0.0, clip_duration: float = None):
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")

    output_filename = f"processed_{uuid.uuid4()}.mp4"
    output_path = os.path.join(TEMP_DIR, output_filename)

    try:
        # Detect Smart Stitch Mode
        is_smart_stitch = len(actions) > 0 and "start" in actions[0] and "tool" not in actions[0]

        if is_smart_stitch:
            success = await execute_smart_stitch(input_path, output_path, actions)
            if not success: raise ValueError("All stitch attempts failed")
        
        else:
            # LEGACY TOOL MODE
            probe = ffmpeg.probe(input_path)
            has_audio = any(s['codec_type'] == 'audio' for s in probe['streams'])
            
            stream = ffmpeg.input(input_path)
            video = stream.video
            audio = stream.audio if has_audio else None

            # 1. Timeline Pre-Trim
            if clip_start > 0 or (clip_duration and clip_duration > 0):
                print(f"--- Pre-Trimming: {clip_start}s ---")
                trim_end = clip_start + clip_duration if clip_duration else None
                video = video.trim(start=clip_start, end=trim_end).setpts('PTS-STARTPTS')
                if has_audio:
                    audio = audio.filter_('atrim', start=clip_start, end=trim_end).filter_('asetpts', 'PTS-STARTPTS')

            # 2. Apply Actions
            for action in actions:
                tool = action.get("tool")
                params = action.get("params", {})
                print(f"--- Tool: {tool} {params} ---")

                if tool == "speed":
                    factor = float(params.get("factor", 1.0))
                    video = video.filter('setpts', f'{1/factor}*PTS')
                    
                    if has_audio:
                        # Atempo chaining for extreme speeds
                        curr = factor
                        while curr > 2.0:
                            audio = audio.filter('atempo', 2.0); curr /= 2.0
                        while curr < 0.5:
                            audio = audio.filter('atempo', 0.5); curr /= 0.5
                        if curr != 1.0:
                            audio = audio.filter('atempo', curr)
                
                elif tool == "filter":
                    ftype = params.get("type", "").lower()
                    if ftype == "grayscale": video = video.filter('hue', s=0)
                    elif ftype == "sepia": video = video.filter('colorchannelmixer', rr=0.393, rg=0.769, rb=0.189, gr=0.349, gg=0.686, gb=0.168, br=0.272, bg=0.534, bb=0.131)
                    elif ftype == "warm": video = video.filter('eq', saturation=1.3, contrast=1.1, gamma_r=1.1)

            # 3. Render (Try CPU Safe Mode first for tools)
            # Legacy tools are less intensive, so libx264 is safer and fine
            job = ffmpeg.output(
                video, 
                audio if has_audio else video, # fallback if no audio stream
                output_path, 
                vcodec='libx264', 
                preset='ultrafast', 
                movflags='faststart'
            )
            
            # If no audio, remove audio mapping
            if not has_audio:
                job = ffmpeg.output(video, output_path, vcodec='libx264', preset='ultrafast')

            job.run(overwrite_output=True, quiet=True)

        # Output Duration Check
        if os.path.exists(output_path):
            probe = ffmpeg.probe(output_path)
            new_dur = float(probe['format']['duration'])
            return {"path": output_path, "duration": new_dur}
        else:
            return None

    except Exception as e:
        print(f"Engine Error: {e}")
        return None

# ==========================================
# 🎬 STITCH VIDEOS (Robust Audio Handling)
# ==========================================
async def stitch_videos(clips: list):
    output_filename = f"final_render_{uuid.uuid4()}.mp4"
    output_path = os.path.join(TEMP_DIR, output_filename)
    
    try:
        inputs = []
        valid_clips = []
        
        # 1. Filter Valid Files
        for clip in clips:
            p = os.path.join(TEMP_DIR, clip["filename"])
            if os.path.exists(p):
                valid_clips.append(p)
        
        if not valid_clips: return None

        # 2. Create File List for Demuxer (Safer than filter complex for simple joins)
        # This prevents resolution mismatch crashing
        list_path = os.path.join(TEMP_DIR, f"list_{uuid.uuid4()}.txt")
        with open(list_path, 'w') as f:
            for path in valid_clips:
                f.write(f"file '{path}'\n")

        # 3. Run Concat Demuxer
        # Note: This requires all clips to have same Codec/Resolution.
        # If your clips vary wildly, we must use the Filter Complex method below.
        # Assuming clips processed by this engine are uniform-ish.
        
        print(f"🧵 Stitching {len(valid_clips)} clips...")
        
        (
            ffmpeg
            .input(list_path, format='concat', safe=0)
            .output(output_path, c='copy') # Stream copy = Instant render
            .run(overwrite_output=True, quiet=True)
        )
        
        os.remove(list_path)
        return output_path

    except Exception as e:
        print(f"Simple Stitch Failed: {e}. Trying Re-encode Stitch...")
        
        # Fallback: Robust Re-encode Stitch
        try:
            inputs = [ffmpeg.input(p) for p in valid_clips]
            # Simple Video Concat (Drop Audio if complex)
            # This is a last resort fallback
            joined = ffmpeg.concat(*[i.video for i in inputs], v=1, a=0).node
            ffmpeg.output(joined[0], output_path, preset='ultrafast').run(overwrite_output=True)
            return output_path
        except:
            return None