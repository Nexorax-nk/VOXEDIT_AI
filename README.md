# VOXEDIT-AI 🎬

**Autonomous Multimodal AI Video Editing Agent Powered by Gemini 3**

---

VoxEdit is an agentic Non-Linear Editor (NLE) that transforms natural language into frame-accurate video edits.

Unlike traditional AI tools that rely only on transcripts, VoxEdit uses Gemini 3's native multimodal reasoning to simultaneously see, hear, and reason over video.

**It doesn't suggest edits. It plans, validates, and executes them autonomously.**

---

## 🎥 Project Demo


[![Covenant IQ Demo](https://img.youtube.com/vi/aAumkcwuHwc/0.jpg)](https://youtu.be/USMVJBiAc40)

Watch the **"Blue Mug Test"** to see compound multimodal reasoning in action.

---

## 🌐 Cloud Deployment & Architecture

VoxEdit's compute-intensive backend—handling multimodal video processing, frame-accurate rendering, and structured edit-plan validation—is fully containerized and deployed live on **Google Cloud Platform (GCP)**.

To handle the intensive CPU requirements of real-time video reasoning and re-encoding, we engineered a production-grade serverless pipeline:

- **Serverless Compute:** The FastAPI backend is Dockerized and hosted on **Google Cloud Run** for stateless, auto-scaling execution.
- **Live Media Processing:** Ephemeral container volumes handle heavy-lifting tasks like FFmpeg video manipulation and Faster-Whisper audio transcription on the fly.
- **Real-Time Telemetry:** Secure HTTPS endpoints handle media payloads, while a dedicated `wss://` WebSocket connection streams the AI's "thought process" back to the client in real-time.
- **Zero Mocking:** Every output is generated live. The pipeline routes real media directly to the **Gemini 3.0 Pro** and **ElevenLabs** APIs for authentic, unmocked multimodal reasoning.

A complete end-to-end demo video is provided to showcase the live cloud environment in action. For reviewers wishing to replicate the architecture, the full source code and local deployment instructions are included below.

### 🔗 Live API Endpoints
- **Production URL:** [https://voxedit-backend-577095710958.us-central1.run.app](https://voxedit-backend-577095710958.us-central1.run.app)
- **Interactive API Docs (Swagger UI):** [https://voxedit-backend-577095710958.us-central1.run.app/docs](https://voxedit-backend-577095710958.us-central1.run.app/docs)
- **Live Telemetry Stream:** `wss://voxedit-backend-577095710958.us-central1.run.app/ws`
  
---

## 📌 The Problem

Video editing remains fundamentally manual.

While generative AI can create content instantly, editing is still:

- **Timeline-driven**
- **Frame-by-frame**
- **Mechanically repetitive**

Creators spend nearly **40% of their time** scrubbing footage, cutting silence, and searching for specific moments.

### Current AI editors fail because they are text-bound

They edit from transcripts, not video.

They cannot execute instructions like:

- *"Cut when I wave goodbye."*
- *"Keep the product shot even if I'm silent."*
- *"Remove awkward pauses, but preserve intentional silence."*

**Why?** Because they cannot reason over visual context + audio semantics simultaneously.

---

## 🚀 The Solution — Multimodal Agency

**VoxEdit is not an assistant. It is an AI editing agent.**

By leveraging Gemini 3 Pro's multimodal architecture, VoxEdit treats video editing as a **reasoning problem** rather than a signal-processing task.

### Why Gemini 3?

We directly feed raw video streams and audio signals into Gemini 3 Pro.

Gemini 3 performs:

- Cross-modal correlation (video + audio alignment)
- Temporal reasoning across frames
- Intent decomposition from natural language
- Structured decision planning

It outputs a strict, machine-executable **JSON Edit Plan**, containing:

- Frame-accurate timestamps
- Logical conditions
- Action directives

**Without Gemini 3's native multimodal reasoning, this level of semantic editing would not be possible.**

---

## 🧩 Core Capabilities

### 🧠 Multimodal "Reasoning Cuts"

Execute compound logic across modalities:

> *"Remove all silence (Audio), BUT keep segments where the blue mug is visible (Video)."*

Gemini 3 correctly identifies:

- Silence segments
- Visual object persistence
- Override logic conditions

**Status:** Solved with structured reasoning validation.

---

### 👁 Transparent AI Reasoning Console

**AI should not be a black box.**

VoxEdit streams Gemini's reasoning in real time via WebSockets:

```
DETECTED: Awkward Pause (Confidence: 98%)
DETECTED: Blue Mug Visible (Frame 432–611)
DECISION: Override Silence Cut
```

Users see **why** edits are happening.

---

### ⚡ Frame-Accurate Rendering Engine

We built a custom FFmpeg wrapper.

Instead of using stream copy (which snaps to keyframes), we:

- Force libx264 re-encoding
- Implement filter graph pipelines
- Guarantee millisecond-level precision

This preserves **semantic correctness** over raw speed.

---

### 🎨 Generative Asset Pipeline

- **Subtitles:** Faster-Whisper (local, low latency)
- **Voice & SFX:** ElevenLabs
- Synchronized directly with Gemini's structured edit plan

---

## 🏗 System Architecture

```mermaid
graph TD
    %% --- ENTERPRISE STYLES ---
    linkStyle default interpolate basis
    classDef client fill:#0f172a,stroke:#334155,stroke-width:2px,color:#f8fafc
    classDef edge fill:#0284c7,stroke:#0369a1,stroke-width:2px,color:#fff
    classDef gcp fill:#16a34a,stroke:#15803d,stroke-width:2px,color:#fff
    classDef logic fill:#059669,stroke:#047857,stroke-width:2px,color:#fff
    classDef processing fill:#475569,stroke:#334155,stroke-width:2px,color:#fff
    classDef storage fill:#ca8a04,stroke:#a16207,stroke-width:2px,color:#fff
    classDef external fill:#7c3aed,stroke:#6d28d9,stroke-width:2px,color:#fff
    classDef env fill:#1e293b,stroke:#475569,stroke-width:1px,color:#94a3b8,font-family:monospace

    User([👤 End User / Web Browser]):::client

    %% --- ZONE 1: GLOBAL EDGE ---
    subgraph Edge ["🌐 Global Edge & Frontend"]
        UI[⚛️ Next.js Web Application]:::edge
        WSC[⚡ WSS Telemetry Client]:::edge
    end

    %% --- ZONE 2: CLOUD INFRASTRUCTURE ---
    subgraph GCP ["🟢 Google Cloud Platform (us-central1)"]
        Ingress((🛡️ Cloud Run Ingress <br> TLS/SSL Termination)):::gcp

        subgraph Serverless ["☁️ Cloud Run (Autoscaling Container)"]
            direction TB

            subgraph Config ["Secure Environment"]
                Secrets[🗝️ Secrets & Config Injection]:::env
            end

            subgraph AppServer ["⚡ Application Server"]
                ASGI[Uvicorn ASGI]:::logic
                Router[FastAPI Router]:::logic
                SocketMgr[WebSocket Manager]:::logic
            end

            subgraph Engines ["⚙️ Execution Engines"]
                Orchestrator[🎬 Media Orchestrator]:::processing
                FFmpeg[🎞️ FFmpeg Encoding Engine]:::processing
                Whisper[🗣️ Faster-Whisper Inference]:::processing
            end

            subgraph Storage ["💾 Ephemeral State"]
                TempVolume[(📁 Container File System)]:::storage
            end

            %% Internal server flows
            Secrets -.-> Orchestrator
            ASGI ==> Router
            ASGI ==> SocketMgr
            Router ==> Orchestrator
            Orchestrator ==> FFmpeg
            Orchestrator ==> Whisper
            FFmpeg <--> TempVolume
            Whisper <--> TempVolume
        end
    end

    %% --- ZONE 3: EXTERNAL SERVICES ---
    subgraph ExternalAI ["🧠 Third-Party Intelligence Providers"]
        Gemini{{✨ Google Gemini 3.0 Pro API}}:::external
        Eleven{{🔊 ElevenLabs TTS API}}:::external
    end

    %% --- DATA & REQUEST FLOWS ---
    User == "1. HTTPS Interactions" ==> UI
    UI == "2. HTTPS REST Upload/Commands" ==> Ingress
    WSC -. "Live Telemetry Connection" .- Ingress
    
    Ingress ==> ASGI
    Ingress -.-> ASGI
    
    Router == "3. Send Video & Context" ==> Gemini
    Gemini == "4. JSON Edit Plan" ==> Router
    
    Orchestrator == "Remote TTS Generation" ==> Eleven
    
    Orchestrator == "5. Return Processed Media URL" ==> Router
    Router == "6. Deliver MP4 payload" ==> Ingress
    Ingress == "HTTPS Response" ==> UI
    UI == "7. Render Final Asset" ==> User

    SocketMgr -. "Broadcast Logs" .- Ingress
```

---

## 🛠 Technology Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Reasoning Engine** | Gemini 3 Pro | Native multimodal reasoning + structured output |
| **Backend** | FastAPI (Python) | Async orchestration of heavy video tasks |
| **Video Engine** | FFmpeg (libx264) | Frame-accurate control |
| **Frontend** | Next.js 14 + React | Complex state + timeline UI |
| **Real-Time** | WebSockets | Transparent reasoning stream |
| **Speech** | Faster-Whisper | Local high-speed transcription |
| **Audio Gen** | ElevenLabs | Dynamic contextual SFX |

---

## 📂 Project Structure

```bash
VOXEDIT-AI/
├── 📂 backend/                     #  Python FastAPI Backend
│   ├── 📂 __pycache__/             #  Compiled Python bytecode (auto-generated)
│   ├── 📂 ffmpeg/                  #  Local FFmpeg binaries (if static linked)
│   ├── 📂 services/                #  Business Logic & AI Modules
│   │   ├── 📂 __pycache__/         #  Service-level bytecode
│   │   ├── 📜 ai_agent.py          #  Core Gemini 3.0 Pro reasoning engine
│   │   ├── 📜 sfx_gen.py           #  Sound Effect generation logic
│   │   ├── 📜 subtitle_gen.py      #  Faster-Whisper transcription service
│   │   ├── 📜 video_engine.py      #  Custom FFmpeg rendering pipeline (libx264)
│   │   └── 📜 voice_gen.py         #  ElevenLabs TTS generation wrapper
│   ├── 📂 temp_storage/            #  Temp folder for uploads & processed videos
│   ├── 📜 .env                     #  Backend API keys (Gemini, ElevenLabs)
│   ├── 📜 list_models.py           #  Utility script to check available Gemini models
│   ├── 📜 main.py                  #  Server Entry Point (FastAPI + WebSockets)
│   └── 📜 requirements.txt         #  Python dependency list
│
└── 📂 frontend/                    #  Next.js 14 Frontend
    ├── 📂 .next/                   #  Next.js build output (auto-generated)
    ├── 📂 node_modules/            #  Node.js dependencies (React, Tailwind, etc.)
    ├── 📂 public/                  #  Static assets (images, icons)
    ├── 📂 app/                     #  App Router (Main Application Code)
    │   ├── 📜 favicon.ico          #  Browser tab icon
    │   ├── 📜 globals.css          #  Global styles & Tailwind directives
    │   ├── 📜 layout.tsx           #  Root layout (fonts, metadata)
    │   └── 📜 page.tsx             #  Main Editor Dashboard Page
    ├── 📂 components/              #  UI Components
    │   ├── 📂 editor/              #  Video Editor Specific Components
    │   │   ├── 📜 AIGenPanel.tsx         #  UI for generating Assets (SFX/Subs)
    │   │   ├── 📜 Player.tsx             #  HTML5 Video Player Controller
    │   │   ├── 📜 ReasoningPanel.tsx     #  Real-time "AI Brain" Console (WebSockets)
    │   │   ├── 📜 Sidebar.tsx            #  Left navigation bar
    │   │   ├── 📜 Timeline.tsx           #  Magnetic Timeline visualization
    │   │   ├── 📜 ToolsPanel.tsx         #  Tool selector (Cut, Select, AI)
    │   │   └── 📜 TopBar.tsx             #  Header & Export controls
    │   └── 📜 components.json      #  Shadcn UI component configuration
    ├── 📂 lib/                     #  Utility functions (class merging, helpers)
    ├── 📜 .gitignore               #  Git ignore rules
    ├── 📜 components.json          #  UI library config
    ├── 📜 eslint.config.mjs        #  Code linting configuration
    ├── 📜 next-env.d.ts            #  TypeScript definitions for Next.js
    ├── 📜 next.config.mjs          #  Next.js build configuration
    ├── 📜 package-lock.json        #  Exact dependency versions
    ├── 📜 package.json             #  Project scripts & dependencies
    ├── 📜 postcss.config.mjs       #  CSS processing config
    ├── 📜 tailwind.config.ts       #  Tailwind CSS theme configuration
    └── 📜 tsconfig.json            #  TypeScript compiler options
```
---

## 🧠 Technical Challenges & Engineering Solutions

### 1. Hallucination vs Determinism

**Problem:** LLMs can generate plausible but incorrect timestamps.

**Solution:**

- Strict JSON schema enforcement
- Timestamp validation middleware
- Retry loop with constraint injection
- Video-duration boundary checks

Gemini outputs are validated before execution.

---

### 2. Keyframe Snapping Problem

**Problem:** Standard FFmpeg copy mode snaps cuts to nearest keyframe.

**Solution:**

- Custom filter graph pipeline
- Forced re-encoding via libx264
- Frame-level precision over performance shortcuts

---

### 3. Making AI Trustworthy

**Problem:** Users distrust invisible decision systems.

**Solution:**

- Real-time reasoning broadcast
- Transparent decision logs
- Deterministic execution trace

---

## 🚀 Roadmap

- [ ] Local-first rough cuts using lightweight Gemini variants
- [ ] Multi-track agent reasoning (A-roll + B-roll)
- [ ] Export to Premiere Pro / DaVinci Resolve via XML / EDL
- [ ] Automated B-roll coverage agent

---

## 💻 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

* **Python 3.10+:** [Download Here](https://www.python.org/downloads/)
* **Node.js 18+:** [Download Here](https://nodejs.org/)
* **FFmpeg:** [Download Here](https://www.ffmpeg.org/download.html)
* **FFmpeg:** **Critical Requirement.** You must install FFmpeg and add it to your System PATH.
   * Windows Guide: [How to install FFmpeg on Windows](https://www.wikihow.com/Install-FFmpeg-on-Windows)
   * Verify installation: Open a terminal and type `ffmpeg -version`. If it prints version info, you are ready.

---

## 1️⃣ Backend Setup (Python & FastAPI)

The backend handles the AI reasoning, video rendering, and WebSocket streams.

### 1. Navigate to the backend folder:

```bash
cd backend
```

### 2. Create a virtual environment:

```bash
python -m venv venv
```

### 3. Activate the virtual environment:

**Windows:**
```bash
venv\Scripts\activate
```

**Mac / Linux:**
```bash
source venv/bin/activate
```

### 4. Install dependencies:

```bash
pip install -r requirements.txt
```

### 5. Configure Environment Variables:

Create a file named `.env` inside the `backend` folder and add your API keys:

```env
GEMINI_API_KEY=your_google_gemini_key_here
ELEVENLABS_API_KEY=your_elevenlabs_key_here
```

(Get your Gemini Key from [Google AI Studio](https://aistudio.google.com/))

### Wire Frontend to Localhost:

By default, the frontend points to the live Google Cloud URL. To route it locally, search for https://voxedit-backend-577095710958.us-central1.run.app in the following files and replace it with http://localhost:8080 (and wss://... to ws://localhost:8080):

frontend/components/editor/ToolsPanel.tsx

frontend/components/editor/ReasoningPanel.tsx

frontend/app/editor/page.tsx

### 7. Start the local Server:

```bash
python main.py
```

You should see: `INFO: Uvicorn running on http://0.0.0.0:8000`

---

## 2️⃣ Frontend Setup (Next.js)

The frontend is the visual NLE interface.

### 1. Open a new terminal and navigate to the frontend folder:

```bash
cd frontend
```

### 2. Install Node dependencies:

```bash
npm install
```

### 3. Start the Development Server:

```bash
npm run dev
```

---

## 🚀 Launch the App

Open your browser and navigate to: **http://localhost:3000**

* **Test the Connection:** Look at the "Reasoning Panel" on the right side. It should say **"CONNECTED"** in green, indicating the WebSocket link to the Python backend is active.

---

## 🐳 Containerization & Serverless Deployment

To guarantee environment consistency and handle the complex system-level dependencies required for video processing (like FFmpeg), the entire backend orchestrator is fully containerized and deployed as a serverless microservice.

### Docker Architecture
The backend utilizes a custom `Dockerfile` based on a lightweight Python 3.10 image. The containerization process handles:
* **System-Level Dependencies:** Automated installation of `ffmpeg` and native audio processing libraries.
* **Python Environment:** Isolated installation of `google-genai`, `fastapi`, and `faster-whisper`.
* **ASGI Server:** Configured `uvicorn` to bind to `0.0.0.0:8080`, complying with Google Cloud Run's port requirements.

### Google Cloud Run Implementation
Instead of relying on a static virtual machine, the Docker container is deployed to **Google Cloud Run**. This provides an enterprise-grade, serverless execution environment with:
* **Auto-Scaling:** Automatically provisions compute instances based on incoming HTTP/WSS traffic.
* **Scale-to-Zero:** Reduces infrastructure costs by spinning down instances when the editor is idle.
* **Dynamic Injection:** Securely injects `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, and the dynamic `BASE_URL` directly into the container at runtime.

### 🚀 Production Deployment Command
For CI/CD reference, the production environment is deployed directly from the source using the Google Cloud CLI:

```bash
gcloud run deploy voxedit-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 1 \
  --no-cpu-throttling \
  --set-env-vars="BASE_URL=[https://voxedit-backend-577095710958.us-central1.run.app](https://voxedit-backend-577095710958.us-central1.run.app),GEMINI_API_KEY=[SECURE],ELEVENLABS_API_KEY=[SECURE]"
```

---

## 👤 Author

**Naveen Kumar**  
*Student@CIT aspiring Full Stack & AI Engineer*

---
