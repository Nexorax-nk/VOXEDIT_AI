"use client";

import { useRef, useEffect, useState } from "react";
import { 
  Play, Maximize2, Settings, 
  Activity, Monitor, Signal 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PlayerProps {
  src: string | null;
  currentTime: number;
  clipStartTime?: number;
  clipOffset?: number; 
  isPlaying: boolean;
  onTimeUpdate: (t: number) => void;
  onDurationChange: (d: number) => void;
  onTogglePlay: () => void;
}

// Minimal MM:SS:MS
const formatTimecode = (time: number) => {
  const m = Math.floor(time / 60).toString().padStart(2, '0');
  const s = Math.floor(time % 60).toString().padStart(2, '0');
  const ms = Math.floor((time % 1) * 100).toString().padStart(2, '0');
  return `${m}:${s}:${ms}`;
};

export default function Player({ 
  src, 
  currentTime, 
  clipStartTime = 0, 
  clipOffset = 0, 
  isPlaying, 
  onTimeUpdate, 
  onDurationChange, 
  onTogglePlay 
}: PlayerProps) {
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Sync Play/Pause
  useEffect(() => {
    if (videoRef.current) {
        if (isPlaying && videoRef.current.paused) videoRef.current.play().catch(() => {});
        else if (!isPlaying && !videoRef.current.paused) videoRef.current.pause();
    }
  }, [isPlaying]);

  // Sync Time
  useEffect(() => {
    if (videoRef.current && src) {
        const relativeTime = currentTime - clipStartTime;
        const fileTime = Math.max(0, relativeTime + clipOffset);
        
        if (Math.abs(videoRef.current.currentTime - fileTime) > 0.25) {
            videoRef.current.currentTime = fileTime;
        }
    }
  }, [currentTime, clipStartTime, clipOffset, src]);

  const handleVideoTimeUpdate = () => {
      if (videoRef.current && isPlaying) {
          const fileTime = videoRef.current.currentTime;
          onTimeUpdate(fileTime - clipOffset + clipStartTime);
      }
  };

  return (
    <div className="flex-1 relative flex flex-col bg-[#09090b] overflow-hidden w-full h-full">
      {/* Subtle Background Grid */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} 
      />

      <div className="flex-1 flex items-center justify-center p-4 relative z-10 w-full h-full">
        
        {/* The Video Frame */}
        <div 
            className="aspect-video w-full h-full max-h-full bg-black rounded-lg shadow-2xl border border-white/5 relative overflow-hidden group select-none ring-1 ring-white/5 object-contain"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
          
          {/* --- TOP HUD (Minimal) --- */}
          <div className={cn(
              "absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-black/60 to-transparent z-20 flex justify-between items-start px-4 py-3 transition-opacity duration-300",
              src ? "opacity-100" : "opacity-30"
          )}>
              {/* Status Badge */}
              <div className="flex items-center gap-3">
                  <div className={cn("px-1.5 py-0.5 rounded-sm bg-black/40 backdrop-blur-md border border-white/10 text-[9px] font-medium tracking-wider flex items-center gap-1.5 text-neutral-400", isPlaying && "text-red-500 border-red-500/20 bg-red-500/5")}>
                      {isPlaying ? <Activity className="w-2.5 h-2.5" /> : <Monitor className="w-2.5 h-2.5" />}
                      {isPlaying ? "LIVE" : "READY"}
                  </div>
              </div>

              {/* Minimal Timecode */}
              <div className="font-mono text-xs text-white/80 tracking-widest tabular-nums opacity-80">
                  {formatTimecode(currentTime)}
              </div>
          </div>

          {/* --- VIDEO ELEMENT --- */}
          {src ? (
            <video
              ref={videoRef}
              src={src}
              className="w-full h-full object-contain bg-[#050505]"
              onTimeUpdate={handleVideoTimeUpdate}
              onLoadedMetadata={() => videoRef.current && onDurationChange(videoRef.current.duration)}
              onEnded={onTogglePlay}
              onClick={onTogglePlay}
            />
          ) : (
             // --- EMPTY STATE ---
             <div className="w-full h-full flex flex-col items-center justify-center bg-[#050505] relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 brightness-50" />
                <div className="z-10 flex flex-col items-center gap-3 opacity-40">
                   <Signal className="w-6 h-6 text-neutral-700" />
                   <p className="text-neutral-600 text-[10px] font-mono tracking-widest">NO SIGNAL</p>
                </div>
             </div>
          )}

          {/* --- CENTER PLAY BUTTON (Minimalist) --- */}
          {src && !isPlaying && (
            <div 
                onClick={onTogglePlay} 
                className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px] cursor-pointer group/btn transition-all duration-300"
            >
               <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 shadow-lg group-hover/btn:scale-105 group-hover/btn:bg-white/20 transition-all duration-300">
                 <Play className="w-6 h-6 text-white ml-1 fill-white opacity-90" />
               </div>
            </div>
          )}

          {/* --- BOTTOM HUD (Clean) --- */}
          <div className={cn(
              "absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/60 to-transparent z-20 flex justify-end items-end px-4 py-3 transition-opacity duration-300 pointer-events-none",
              (isHovered || !isPlaying) ? "opacity-100" : "opacity-0"
          )}>
               <div className="flex gap-1 pointer-events-auto">
                   <button className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-white/60 hover:text-white">
                      <Settings className="w-3.5 h-3.5" />
                   </button>
                   <button className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-white/60 hover:text-white">
                      <Maximize2 className="w-3.5 h-3.5" />
                   </button>
               </div>
          </div>

          {/* --- CORNER MARKERS (Minimal Viewfinder) --- */}
          <div className="absolute top-3 left-3 w-3 h-3 border-t border-l border-white/20 rounded-tl-[1px] pointer-events-none" />
          <div className="absolute top-3 right-3 w-3 h-3 border-t border-r border-white/20 rounded-tr-[1px] pointer-events-none" />
          <div className="absolute bottom-3 left-3 w-3 h-3 border-b border-l border-white/20 rounded-bl-[1px] pointer-events-none" />
          <div className="absolute bottom-3 right-3 w-3 h-3 border-b border-r border-white/20 rounded-br-[1px] pointer-events-none" />

        </div>
      </div>
    </div>
  );
}