"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Activity, Cpu, CheckCircle2, AlertCircle, 
  BrainCircuit, ScanEye, Wifi, Zap, BarChart3, Terminal
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- TYPES ---
type LogType = "info" | "success" | "warning" | "analysis" | "error";

interface LogMessage {
  id: string;
  type: LogType;
  text: string;
  timestamp: string;
}

interface ReasoningPanelProps {
  isProcessing: boolean;
}

// --- SUB-COMPONENT: NEURAL VISUALIZER ---
const NeuralVisualizer = ({ active }: { active: boolean }) => {
  return (
    <div className="h-12 flex items-end justify-center gap-1 p-2 opacity-80">
      {[...Array(12)].map((_, i) => (
        <div 
          key={i}
          className={cn(
            "w-1.5 rounded-t-sm bg-red-500 transition-all duration-75",
            active ? "animate-[bounce_0.5s_infinite]" : "h-1 opacity-20"
          )}
          style={{ 
            height: active ? `${Math.random() * 100}%` : '4px',
            animationDelay: `${i * 0.05}s`
          }} 
        />
      ))}
    </div>
  );
};

export default function ReasoningPanel({ isProcessing }: ReasoningPanelProps) {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [aiStats, setAiStats] = useState({ tokens: 0, latency: 0, confidence: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // --- WEBSOCKET CONNECTION ---
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8000/ws");
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      addLog("success", "UPLINK_ESTABLISHED: ws://secure-gate/8000");
      addLog("info", "Authenticating Gemini 3.0 Pro...");
    };

    ws.onclose = () => {
      setIsConnected(false);
      addLog("warning", "UPLINK_LOST. Attempting Reconnect...");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "log") {
            addLog(data.level, data.message);
        } else if (data.type === "stats") {
            setAiStats(prev => ({
                tokens: prev.tokens + (data.tokens || 0),
                latency: data.latency || prev.latency,
                confidence: Math.min(99, (prev.confidence || 85) + (Math.random() * 5 - 2))
            }));
        }
      } catch (e) {
        addLog("info", event.data);
      }
    };

    return () => ws.close();
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (type: LogType, text: string) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + "." + Math.floor(Math.random() * 99).toString().padStart(2, '0');
    setLogs(prev => [...prev, { id: Math.random().toString(), type, text, timestamp: time }]);
  };

  return (
    <div className="flex flex-col h-full bg-[#030303] border-l border-white/5 font-mono text-[10px] relative overflow-hidden">
      
      {/* CRT SCANLINE EFFECT OVERLAY */}
      <div className="absolute inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(255,0,0,0.01),rgba(255,0,0,0.03))] bg-size-[100%_3px,3px_100%]" />

      {/* --- HEADER --- */}
      <div className="h-14 shrink-0 border-b border-white/10 flex items-center justify-between px-4 bg-[#0a0a0a] relative z-10 shadow-lg shadow-black/50">
        <div className="flex items-center gap-2.5">
          <div className="relative">
             <BrainCircuit className={cn("w-5 h-5", isProcessing ? "text-[#ff0000] animate-pulse" : "text-neutral-600")} />
             {isProcessing && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />}
          </div>
          <div className="flex flex-col">
             <span className="font-bold tracking-[0.2em] uppercase text-neutral-200 text-xs">GEMINI 3.0</span>
             <span className="text-[8px] text-[#ff0000] tracking-widest font-semibold opacity-80">MULITIMODEL ENGINE</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
           <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded border border-white/5 transition-colors", isConnected ? "bg-[#ff0000]/10 text-[#ff0000] border-[#ff0000]/20" : "bg-neutral-900 text-neutral-500")}>
              <Wifi className="w-3 h-3" />
              <span className="text-[9px] font-bold tracking-wider">{isConnected ? "ONLINE" : "OFFLINE"}</span>
           </div>
        </div>
      </div>

      {/* --- METRICS DASHBOARD --- */}
      <div className="grid grid-cols-2 gap-px bg-white/5 border-b border-white/5 shrink-0 z-10">
         {/* Token Stat */}
         <div className="bg-[#080808] p-3 flex flex-col gap-2 group hover:bg-[#0c0c0c] transition-colors relative overflow-hidden">
            <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:opacity-20 transition-opacity">
                <Cpu className="w-8 h-8" />
            </div>
            <span className="text-neutral-500 uppercase tracking-wider flex items-center gap-1.5 text-[9px]">
               Context Load
            </span>
            <div className="flex items-end gap-1.5">
                <span className="text-xl font-bold text-neutral-200 leading-none">{aiStats.tokens.toLocaleString()}</span>
                <span className="text-[9px] text-neutral-600 mb-0.5">tok</span>
            </div>
            {/* Visual Bar */}
            <div className="w-full h-0.5 bg-neutral-800 mt-1 rounded-full overflow-hidden">
                <div className="h-full bg-[#ff0000]" style={{ width: `${Math.min(aiStats.tokens / 100, 100)}%` }} />
            </div>
         </div>

         {/* Latency Stat */}
         <div className="bg-[#080808] p-3 flex flex-col gap-2 group hover:bg-[#0c0c0c] transition-colors relative overflow-hidden">
            <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:opacity-20 transition-opacity">
                <Activity className="w-8 h-8" />
            </div>
            <span className="text-neutral-500 uppercase tracking-wider flex items-center gap-1.5 text-[9px]">
               Response Time
            </span>
            <div className="flex items-end gap-1.5">
                <span className={cn("text-xl font-bold leading-none", aiStats.latency < 500 ? "text-emerald-500" : "text-yellow-500")}>
                    {aiStats.latency}
                </span>
                <span className="text-[9px] text-neutral-600 mb-0.5">ms</span>
            </div>
             {/* Visual Bar */}
             <div className="w-full h-0.5 bg-neutral-800 mt-1 rounded-full overflow-hidden">
                <div className={cn("h-full", aiStats.latency < 500 ? "bg-emerald-500" : "bg-yellow-500")} style={{ width: `${Math.min(aiStats.latency / 20, 100)}%` }} />
            </div>
         </div>
      </div>

      {/* --- LIVE VISUALIZER & STATUS --- */}
      {isProcessing && (
          <div className="border-b border-white/5 bg-[#050505] relative shrink-0">
              <div className="absolute inset-0 bg-[#ff0000]/5 animate-pulse" />
              <div className="relative z-10 flex items-center justify-between px-4 py-2">
                  <div className="flex flex-col">
                      <span className="text-[#ff0000] font-bold tracking-widest text-[9px] flex items-center gap-2">
                          <Zap className="w-3 h-3 fill-current" /> PROCESSING
                      </span>
                      <span className="text-neutral-500 text-[8px] mt-0.5">Analyzing Multimodal Input Stream...</span>
                  </div>
                  <NeuralVisualizer active={true} />
              </div>
          </div>
      )}

      {/* --- LOG STREAM (TERMINAL STYLE) --- */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 relative z-10 custom-scrollbar" ref={scrollRef}>
         
         {logs.length === 0 && (
             <div className="flex h-full flex-col items-center justify-center text-neutral-700 opacity-50">
                 <Terminal className="w-8 h-8 mb-2" />
                 <p className="tracking-widest text-[9px]">SYSTEM STANDBY</p>
             </div>
         )}

         {logs.map((log) => (
            <div key={log.id} className="flex gap-3 group animate-in fade-in slide-in-from-bottom-1 duration-200">
               <span className="text-neutral-600 shrink-0 select-none font-mono opacity-60 w-12 text-right">
                   {log.timestamp.split('.')[1]}<span className="text-neutral-700">ms</span>
               </span>
               
               <div className="flex-1 wrap-break-word leading-relaxed">
                  {log.type === 'info' && (
                      <div className="text-neutral-400 flex gap-2">
                          <span className="text-blue-500 font-bold">ℹ</span> {log.text}
                      </div>
                  )}
                  
                  {log.type === 'success' && (
                      <div className="text-emerald-400 font-medium flex items-center gap-2 bg-emerald-500/5 px-2 py-1 -ml-2 rounded border border-emerald-500/10">
                          <CheckCircle2 className="w-3 h-3 shrink-0" /> 
                          {log.text}
                      </div>
                  )}
                  
                  {log.type === 'warning' && (
                      <div className="text-yellow-500 flex gap-2">
                          <span className="font-bold">⚠</span> {log.text}
                      </div>
                  )}
                  
                  {log.type === 'error' && (
                      <div className="text-red-500 font-bold flex items-center gap-2 bg-red-500/5 px-2 py-1 -ml-2 rounded border border-red-500/10">
                          <AlertCircle className="w-3 h-3 shrink-0" /> 
                          {log.text}
                      </div>
                  )}
                  
                  {log.type === 'analysis' && (
                      <div className="text-[#ff0000] font-medium flex items-start gap-2 border-l-2 border-[#ff0000] pl-2 my-1">
                          <ScanEye className="w-3 h-3 mt-0.5 shrink-0 animate-pulse" /> 
                          <span className="opacity-90">{log.text}</span>
                      </div>
                  )}
               </div>
            </div>
         ))}
         
         {/* Typing Cursor at bottom */}
         <div className="h-4 w-2 bg-[#ff0000] animate-pulse ml-16 mt-2 opacity-50" />
      </div>
    </div>
  );
}