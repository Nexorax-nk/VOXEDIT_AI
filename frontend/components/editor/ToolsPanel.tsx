"use client";

import { useState, useRef, useEffect } from "react";
import {
  Plus, Film, Play, Sparkles, FolderOpen, MessageSquare, Captions,
  Loader2, Send, User, Bot, Trash2, Mic, Keyboard, StopCircle,
  Wand2, Music, Type, Activity, Radio, X
} from "lucide-react";
import { ToolId } from "./Sidebar";
import { cn } from "@/lib/utils";
import { Clip } from "./Timeline";

/* ================= TYPES ================= */

export type MediaFile = {
  name: string;
  type: "video" | "image" | "audio";
  url: string;
  duration: number;
};

interface ToolsPanelProps {
  activeTool: ToolId;
  onMediaSelect?: (url: string) => void;
  selectedClip?: Clip | null;
  onUpdateProcessedClip?: (newUrl: string, newDuration: number) => void; 
}

type ChatMessage = {
  role: "user" | "ai";
  text: string;
};

/* ================= MEDIA PANEL ================= */

const MediaPanel = ({
  files,
  setFiles,
  onSelect,
}: {
  files: MediaFile[];
  setFiles: React.Dispatch<React.SetStateAction<MediaFile[]>>;
  onSelect?: (url: string) => void;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("http://localhost:8000/upload", { method: "POST", body: formData });
      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      
      const newFile: MediaFile = {
          name: file.name,
          type: file.type.startsWith("video") ? "video" : "image",
          url: data.url,
          duration: 10 // Placeholder
      };

      // Get real duration if video
      if (newFile.type === 'video') {
          const video = document.createElement('video');
          video.src = data.url;
          video.onloadedmetadata = () => {
              newFile.duration = video.duration;
              setFiles(prev => [...prev, newFile]);
              setIsUploading(false);
          };
      } else {
          setFiles(prev => [...prev, newFile]);
          setIsUploading(false);
      }
    } catch (err) {
      console.error(err);
      alert("Backend not running?");
      setIsUploading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, file: MediaFile) => {
    e.dataTransfer.setData("application/json", JSON.stringify(file));
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="flex flex-col h-full bg-[#09090b]">
      <input ref={fileInputRef} type="file" hidden accept="image/*,video/*" onChange={handleFileChange} />

      <div className="p-4 border-b border-white/5">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className={cn(
            "w-full py-6 rounded-xl border border-dashed flex flex-col items-center justify-center gap-2 transition-all group relative overflow-hidden",
            isUploading 
              ? "border-white/10 opacity-50 cursor-wait bg-white/5" 
              : "border-white/10 hover:border-[#FF2E4D] hover:bg-electric-red/5 active:scale-[0.99]"
          )}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#FF2E4D]" />
                <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-semibold">Uploading...</span>
            </div>
          ) : (
            <>
              <div className="p-3 rounded-full bg-[#18181b] group-hover:bg-[#FF2E4D] transition-colors shadow-lg">
                  <Plus className="w-5 h-5 text-neutral-400 group-hover:text-white" />
              </div>
              <span className="text-xs font-medium text-neutral-400 group-hover:text-white mt-1">Import Media</span>
            </>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 opacity-30">
            <Film className="w-12 h-12 mb-3 text-neutral-600" />
            <p className="text-[10px] uppercase tracking-[0.2em] font-medium">Library Empty</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {files.map((file, idx) => (
              <div
                key={idx}
                draggable
                onDragStart={(e) => handleDragStart(e, file)}
                onClick={() => onSelect?.(file.url)}
                className="relative aspect-video bg-[#141414] rounded-lg overflow-hidden border border-white/5 cursor-grab active:cursor-grabbing group hover:border-electric-red/50 transition-all shadow-md hover:shadow-electric-red/10"
              >
                {file.type === "video" ? (
                  <video src={file.url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
                ) : (
                  <img src={file.url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
                )}
                
                <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2.5">
                    <div className="flex items-center gap-2 mb-0.5">
                        <div className="w-1 h-3 bg-[#FF2E4D] rounded-full shadow-[0_0_8px_#FF2E4D]" />
                        <p className="text-[10px] text-white font-bold truncate w-full tracking-wide">{file.name}</p>
                    </div>
                    <p className="text-[9px] text-neutral-400 pl-3 font-mono">{file.duration.toFixed(1)}s</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ================= COPILOT (CHAT) PANEL ================= */

const CopilotPanel = ({ 
  selectedClip,
  onProcessComplete,
  messages,
  setMessages
}: { 
  selectedClip?: Clip | null, 
  onProcessComplete?: (url: string, newDuration: number) => void,
  messages: ChatMessage[],
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
}) => {
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [mode, setMode] = useState<"chat" | "voice">("chat"); 
  const [isRecording, setIsRecording] = useState(false);      
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  const handleSend = async () => {
    if (!input.trim()) return;
    executeCommand(input);
  };

  const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
            
            if (!selectedClip) {
                 setMessages(prev => [...prev, { role: "ai", text: "⚠️ Please select a clip first!" }]);
                 return;
            }

            setMessages(prev => [...prev, { role: "user", text: "🎤 (Voice Command)" }]);
            setIsProcessing(true);

            try {
                const formData = new FormData();
                formData.append("audio", audioBlob, "voice_command.webm");
                const filename = selectedClip.url?.split('/').pop() || "";
                formData.append("filename", filename);
                const clipOffset = (selectedClip as any).offset || 0;
                formData.append("clip_start", clipOffset.toString());
                formData.append("clip_duration", selectedClip.duration.toString());

                const res = await fetch("http://localhost:8000/voice-command", {
                    method: "POST",
                    body: formData
                });

                const data = await res.json();

                if (data.status === "error") {
                    setMessages(prev => [...prev, { role: "ai", text: "Error: " + data.message }]);
                } else {
                    setMessages(prev => {
                        const newHistory = [...prev];
                        newHistory.pop(); // Remove user placeholder
                        return [
                            ...newHistory,
                            { role: "user", text: `"${data.transcription}"` },
                            { role: "ai", text: data.explanation }
                        ];
                    });

                    if (data.reply_audio_url) {
                        const audio = new Audio(data.reply_audio_url);
                        audio.play().catch(e => console.error("Audio Playback Error:", e));
                    }

                    if (data.processed_url && onProcessComplete) {
                        onProcessComplete(data.processed_url, data.new_duration);
                    }
                }
            } catch (e) {
                setMessages(prev => [...prev, { role: "ai", text: "Voice upload failed." }]);
            } finally {
                setIsProcessing(false);
            }
        };

        mediaRecorder.start();
        setIsRecording(true);
    } catch (err) {
        alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const toggleRecording = () => {
      if (isRecording) stopRecording();
      else startRecording();
  };

  const executeCommand = async (commandText: string) => {
    if (!selectedClip) {
        setMessages(prev => [
            ...prev, 
            { role: "user", text: commandText }, 
            { role: "ai", text: "Please select a clip on the Timeline first." }
        ]);
        setInput("");
        return;
    }

    if (mode === "chat") {
         setMessages(prev => [...prev, { role: "user", text: commandText }]);
    }
    
    setInput("");
    setIsProcessing(true);

    try {
        const formData = new FormData();
        formData.append("command", commandText);
        const filename = selectedClip.url?.split('/').pop() || "";
        formData.append("filename", filename);
        const clipOffset = (selectedClip as any).offset || 0;
        formData.append("clip_start", clipOffset.toString());
        formData.append("clip_duration", selectedClip.duration.toString());

        const res = await fetch("http://localhost:8000/edit", { method: "POST", body: formData });
        const data = await res.json();

        if (data.status === "error") {
            setMessages(prev => [...prev, { role: "ai", text: "Error: " + data.message }]);
        } else {
            setMessages(prev => [...prev, { role: "ai", text: data.explanation }]);
            if (data.processed_url && onProcessComplete) {
                onProcessComplete(data.processed_url, data.new_duration);
            }
        }
    } catch (e) {
        setMessages(prev => [...prev, { role: "ai", text: "Server connection failed." }]);
    } finally {
        setIsProcessing(false);
    }
  };

  const handleClearChat = () => {
      setMessages([{ role: "ai", text: "Chat cleared. Ready." }]);
  };

  return (
    <div className="flex flex-col h-full bg-[#09090b] relative">
      {/* --- HEADER TABS --- */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0 z-10 bg-[#09090b]/95 backdrop-blur border-b border-white/5">
          <div className="flex bg-[#141414] p-1 rounded-lg border border-white/5 shadow-inner">
              <button 
                onClick={() => setMode("chat")}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all duration-300", 
                    mode === "chat" 
                        ? "bg-[#FF2E4D] text-white shadow-[0_2px_10px_rgba(255,46,77,0.3)]" 
                        : "text-neutral-500 hover:text-white"
                )}
              >
                  <Keyboard className="w-3 h-3" /> Chat
              </button>
              <button 
                onClick={() => setMode("voice")}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all duration-300", 
                    mode === "voice" 
                        ? "bg-[#FF2E4D] text-white shadow-[0_2px_10px_rgba(255,46,77,0.3)]" 
                        : "text-neutral-500 hover:text-white"
                )}
              >
                  <Mic className="w-3 h-3" /> Voice
              </button>
          </div>
          <button onClick={handleClearChat} className="p-2 rounded-full hover:bg-white/5 text-neutral-600 hover:text-[#FF2E4D] transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>

      {/* --- CHAT AREA --- */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar scroll-smooth">
        {messages.map((msg, idx) => (
          <div key={idx} className={cn("flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300", msg.role === "user" ? "flex-row-reverse" : "")}>
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border shadow-sm",
              msg.role === "ai" 
                ? "bg-[#141414] border-[#FF2E4D]/20 text-[#FF2E4D]" 
                : "bg-[#222] border-white/5 text-white"
            )}>
              {msg.role === "ai" ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            <div className={cn(
              "p-3.5 rounded-2xl text-xs leading-relaxed max-w-[85%] shadow-md border relative group",
              msg.role === "ai" 
                ? "bg-[#18181b] border-white/5 text-neutral-300 rounded-tl-none hover:border-[#FF2E4D]/20 transition-colors" 
                : "bg-gradient-to-br from-[#FF2E4D] to-[#d91b36] border-[#FF2E4D] text-white rounded-tr-none shadow-[0_2px_10px_rgba(255,46,77,0.2)]"
            )}>
              {msg.text}
            </div>
          </div>
        ))}
        
        {/* --- COOL PROCESSING STATE --- */}
        {isProcessing && (
           <div className="flex gap-3 animate-in fade-in duration-300">
              <div className="w-8 h-8 rounded-full bg-[#FF2E4D]/10 border border-[#FF2E4D]/30 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(255,46,77,0.2)]">
                 <Loader2 className="w-4 h-4 text-[#FF2E4D] animate-spin" />
              </div>
              <div className="p-3.5 rounded-2xl rounded-tl-none bg-[#111] border border-white/5 flex flex-col gap-2 min-w-[160px] shadow-lg">
                 <span className="text-[10px] font-bold text-[#FF2E4D] uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                    <Sparkles className="w-3 h-3" /> Thinking...
                 </span>
                 {/* Shimmer Effect Bar */}
                 <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FF2E4D] to-transparent w-1/2 animate-[shimmer_1.5s_infinite] translate-x-[-100%]" />
                 </div>
              </div>
           </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* --- INPUT AREA --- */}
      <div className="p-4 border-t border-white/5 bg-[#09090b]">
        {mode === "chat" ? (
            <div className="relative group">
                <input 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    disabled={isProcessing}
                    className="w-full bg-[#141414] border border-white/10 rounded-xl px-4 py-4 pr-12 text-xs text-white focus:outline-none focus:border-[#FF2E4D] focus:ring-1 focus:ring-[#FF2E4D]/50 placeholder:text-neutral-600 transition-all shadow-inner"
                    placeholder={selectedClip ? `Ask AI to edit this clip...` : "Select a clip to start..."}
                />
                <button 
                    onClick={handleSend}
                    disabled={isProcessing || !input.trim()}
                    className="absolute right-2 top-2 p-2 rounded-lg bg-[#FF2E4D] hover:bg-[#ff1f40] disabled:bg-transparent disabled:text-neutral-700 text-white transition-all shadow-lg shadow-[#FF2E4D]/20 hover:scale-105 active:scale-95"
                >
                    <Send className="w-3.5 h-3.5" />
                </button>
            </div>
        ) : (
            // --- COOL VOICE INTERFACE ---
            <div className="flex flex-col items-center justify-center gap-5 py-6">
                <div className="relative">
                    {/* Ripple Effects when Recording */}
                    {isRecording && (
                        <>
                            <div className="absolute inset-0 rounded-full border border-[#FF2E4D] animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite] opacity-50" />
                            <div className="absolute inset-[-8px] rounded-full border border-[#FF2E4D]/50 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] opacity-30" />
                            <div className="absolute inset-[-16px] rounded-full bg-[#FF2E4D]/5 animate-pulse" />
                        </>
                    )}
                    
                    <button 
                        onClick={toggleRecording}
                        className={cn(
                            "w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 relative z-10 border-4",
                            isRecording 
                                ? "bg-[#FF2E4D] border-[#FF2E4D]/30 shadow-[0_0_40px_rgba(255,46,77,0.6)] scale-110" 
                                : "bg-[#141414] border-white/10 hover:border-[#FF2E4D] hover:text-[#FF2E4D] text-neutral-500 shadow-xl hover:shadow-[0_0_20px_rgba(255,46,77,0.15)]"
                        )}
                    >
                        {isRecording ? (
                            <div className="flex gap-1 h-6 items-center">
                                <div className="w-1 bg-white animate-[bounce_1s_infinite] h-3 rounded-full" />
                                <div className="w-1 bg-white animate-[bounce_1.2s_infinite] h-6 rounded-full" />
                                <div className="w-1 bg-white animate-[bounce_0.8s_infinite] h-3 rounded-full" />
                            </div>
                        ) : (
                            <Mic className="w-8 h-8" />
                        )}
                    </button>
                </div>
                
                <div className="flex flex-col items-center gap-1">
                    <p className={cn("text-[10px] uppercase font-bold tracking-[0.25em]", isRecording ? "text-[#FF2E4D] animate-pulse" : "text-neutral-500")}>
                        {isRecording ? "Listening..." : "Tap to Speak"}
                    </p>
                    {isRecording && <p className="text-[9px] text-neutral-600 font-mono">REC 00:0{Math.floor(Math.random()*9)}</p>}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

/* ================= MAGIC ASSETS PANEL ================= */

const MagicAssetsPanel = () => {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedFiles, setGeneratedFiles] = useState<MediaFile[]>([]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);

    try {
      const formData = new FormData();
      formData.append("text", prompt);
      const res = await fetch("http://localhost:8000/generate-sfx", { method: "POST", body: formData });
      const data = await res.json();
      if (data.status === "success") {
        const newFile: MediaFile = { name: data.name, type: "audio", url: data.url, duration: data.duration };
        setGeneratedFiles(prev => [newFile, ...prev]);
        setPrompt(""); 
      } else { alert("Generation failed"); }
    } catch (e) { alert("Error generating SFX."); } finally { setIsGenerating(false); }
  };

  const handleDragStart = (e: React.DragEvent, file: MediaFile) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ ...file, type: "audio" }));
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="flex flex-col h-full bg-[#09090b]">
      <div className="p-5 border-b border-white/5 relative overflow-hidden bg-gradient-to-b from-[#141414] to-transparent">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF2E4D]/10 blur-[60px] rounded-full pointer-events-none" />
        
        <h3 className="text-[10px] font-bold text-neutral-400 mb-4 uppercase tracking-widest flex items-center gap-2">
            <Wand2 className="w-3.5 h-3.5 text-[#FF2E4D]" /> AI Sound Generator
        </h3>
        
        <div className="relative group">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isGenerating}
            placeholder="Describe sound (e.g. 'cinematic boom')..."
            className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3.5 pr-11 text-xs text-white focus:outline-none focus:border-[#FF2E4D] focus:ring-1 focus:ring-[#FF2E4D]/20 placeholder:text-neutral-600 transition-all shadow-inner"
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
          />
          <button 
             onClick={handleGenerate}
             disabled={isGenerating || !prompt.trim()}
             className="absolute right-2 top-2 p-1.5 rounded-lg bg-[#FF2E4D] hover:bg-[#ff1f40] disabled:bg-transparent disabled:text-neutral-600 text-white transition-all shadow-lg shadow-[#FF2E4D]/20"
          >
             {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
         {generatedFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 opacity-40">
                <div className="w-12 h-12 rounded-full bg-[#141414] border border-white/5 flex items-center justify-center mb-3 shadow-inner">
                    <Music className="w-5 h-5 text-neutral-600" />
                </div>
                <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-medium">No assets generated</p>
            </div>
         ) : (
            generatedFiles.map((file, i) => (
                <div 
                   key={i} 
                   draggable 
                   onDragStart={(e) => handleDragStart(e, file)}
                   className="flex items-center gap-3 p-3 bg-[#141414]/50 border border-white/5 rounded-xl hover:border-[#FF2E4D]/40 hover:bg-[#141414] cursor-grab active:cursor-grabbing group transition-all"
                >
                    <div className="w-9 h-9 rounded-full bg-[#222] flex items-center justify-center shrink-0 group-hover:bg-[#FF2E4D] group-hover:text-white transition-all duration-300 text-neutral-500 shadow-md">
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-neutral-300 group-hover:text-white truncate transition-colors">{file.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="h-0.5 flex-1 bg-neutral-800 rounded-full overflow-hidden">
                                <div className="h-full bg-neutral-600 w-1/3 group-hover:bg-[#FF2E4D] transition-colors" />
                            </div>
                            <p className="text-[9px] text-neutral-600 font-mono">{file.duration.toFixed(1)}s</p>
                        </div>
                    </div>
                </div>
            ))
         )}
      </div>
    </div>
  );
};

/* ================= SUBTITLES PANEL ================= */

const SubtitlesPanel = ({ selectedClip }: { selectedClip?: Clip | null }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [subtitles, setSubtitles] = useState<any[]>([]);

  const handleGenerate = async () => {
    if (!selectedClip || !selectedClip.url) return alert("Select a video clip first.");
    setIsGenerating(true);
    setSubtitles([]);
    try {
        const formData = new FormData();
        formData.append("filename", selectedClip.url.split("/").pop() || "");
        const res = await fetch("http://localhost:8000/generate-subtitles", { method: "POST", body: formData });
        const data = await res.json();
        if (data.status === "success") setSubtitles(data.subtitles);
        else alert("Failed.");
    } catch (e) { alert("Error."); } finally { setIsGenerating(false); }
  };

  const handleDragStart = (e: React.DragEvent, sub: any) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ name: sub.text, type: "text", url: "", duration: sub.end - sub.start }));
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="flex flex-col h-full bg-[#09090b]">
       <div className="p-5 border-b border-white/5">
          <button 
             onClick={handleGenerate}
             disabled={isGenerating || !selectedClip}
             className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#FF2E4D] to-[#ff1f40] text-white font-bold text-xs uppercase tracking-wide transition-all flex items-center justify-center gap-2 disabled:from-[#222] disabled:to-[#222] disabled:text-neutral-500 disabled:cursor-not-allowed shadow-lg shadow-[#FF2E4D]/20 disabled:shadow-none hover:scale-[1.02] active:scale-[0.98] hover:shadow-[#FF2E4D]/40"
          >
             {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Captions className="w-4 h-4" />}
             {isGenerating ? "Transcribing..." : "Generate Captions"}
          </button>
       </div>

       <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {subtitles.length === 0 ? (
             !isGenerating && (
                 <div className="flex flex-col items-center justify-center h-40 opacity-40">
                    <Captions className="w-10 h-10 mb-3 text-neutral-600" />
                    <p className="text-[10px] text-neutral-500 uppercase tracking-widest">No subtitles</p>
                 </div>
             )
          ) : (
             subtitles.map((sub, i) => (
                 <div 
                    key={i} 
                    draggable 
                    onDragStart={(e) => handleDragStart(e, sub)}
                    className="p-3 bg-[#141414] border border-white/5 rounded-lg hover:border-[#FF2E4D]/40 cursor-grab active:cursor-grabbing group transition-all"
                 >
                     <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[9px] font-mono text-[#FF2E4D] bg-[#FF2E4D]/10 px-1.5 py-0.5 rounded border border-[#FF2E4D]/20">
                            {sub.start.toFixed(1)}s - {sub.end.toFixed(1)}s
                        </span>
                        <Type className="w-3 h-3 text-neutral-600 group-hover:text-white transition-colors" />
                     </div>
                     <p className="text-xs text-neutral-300 group-hover:text-white leading-relaxed font-medium">"{sub.text}"</p>
                 </div>
             ))
          )}
       </div>
    </div>
  );
};

/* ================= MAIN WRAPPER ================= */

const PlaceholderPanel = ({ title, icon: Icon }: { title: string; icon: any }) => (
  <div className="flex flex-col items-center justify-center h-full opacity-40 bg-[#09090b]">
    <div className="w-16 h-16 rounded-full bg-[#141414] flex items-center justify-center mb-4 border border-white/5 shadow-xl">
        <Icon className="w-8 h-8 text-neutral-600" />
    </div>
    <p className="text-[10px] text-neutral-500 uppercase tracking-[0.2em] font-bold">{title}</p>
  </div>
);

export default function ToolsPanel({ activeTool, onMediaSelect, selectedClip, onUpdateProcessedClip }: ToolsPanelProps) {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([{ role: "ai", text: "Ready to edit! Select a clip or use voice commands." }]);

  const titles: Record<string, string> = {
    media: "Media Library",
    copilot: "AI Assistant",
    "magic-assets": "Sound Lab",
    subtitles: "Subtitles",
    "ai-feedback": "AI Feedback",
    projects: "Projects",
    settings: "Settings",
  };

  return (
    // UPDATED: w-full (fits parent), removed z-index, removed shadow
    <div className="w-full bg-[#09090b] border-r border-white/5 flex flex-col shrink-0 h-full">
      <div className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-[#09090b]">
        <h2 className="text-neutral-300 text-[10px] uppercase tracking-[0.2em] font-bold flex items-center gap-3">
            <div className="relative">
                <div className="w-2 h-2 bg-[#FF2E4D] rounded-full relative z-10" />
                <div className="absolute inset-0 bg-[#FF2E4D] blur-[4px] opacity-80" />
            </div>
            {titles[activeTool] || "Tool"}
        </h2>
      </div>

      <div className="flex-1 overflow-hidden bg-[#09090b]">
        {activeTool === "media" && <MediaPanel files={mediaFiles} setFiles={setMediaFiles} onSelect={onMediaSelect} />}
        {activeTool === "copilot" && <CopilotPanel selectedClip={selectedClip} onProcessComplete={onUpdateProcessedClip} messages={chatMessages} setMessages={setChatMessages} />}
        {activeTool === "magic-assets" && <MagicAssetsPanel />}
        {activeTool === "subtitles" && <SubtitlesPanel selectedClip={selectedClip} />}
        {activeTool === "ai-feedback" && <PlaceholderPanel title="Feedback" icon={MessageSquare} />}
        {activeTool === "projects" && <PlaceholderPanel title="Projects" icon={FolderOpen} />}
        {activeTool === "settings" && <PlaceholderPanel title="Settings" icon={Radio} />}
      </div>
    </div>
  );
}