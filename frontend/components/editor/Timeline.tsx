"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { 
  ZoomIn, ZoomOut, Maximize, Scissors, Trash2, 
  Video, Mic, Type, MoreHorizontal, Layers
} from "lucide-react"; 
import { cn } from "@/lib/utils";

// --- TYPES ---
export type TrackType = "video" | "audio" | "text";
export type Clip = {
  id: string;
  name: string;
  start: number;     
  duration: number; 
  offset: number;   
  url?: string;
  type: string;
};
export type Track = {
  id: string;
  type: TrackType;
  name: string;
  clips: Clip[];
};

type InteractionMode = "NONE" | "MOVE" | "TRIM_LEFT" | "TRIM_RIGHT";

interface TimelineProps {
  tracks: Track[];
  currentTime: number;
  onSeek: (time: number) => void;
  onDropNewClip: (trackId: string, clipData: any, time: number) => void;
  onUpdateClip: (trackId: string, clipId: string, updates: Partial<Clip>) => void;
  onSwitchTrack: (clipId: string, oldTrackId: string, newTrackId: string, newStart: number) => void;
  onSplitClip: (trackId: string, clipId: string, splitTime: number) => void;
  onDeleteClip: (trackId: string, clipId: string) => void;
  selectedClipId?: string;
  onSelectClip: (id: string | null) => void;
}

export default function Timeline({ 
  tracks, 
  currentTime, 
  onSeek,
  onDropNewClip,
  onUpdateClip,
  onSwitchTrack,
  onSplitClip,
  onDeleteClip,
  selectedClipId,
  onSelectClip
}: TimelineProps) {
  
  const [zoom, setZoom] = useState(30); 
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // --- REFS FOR SMOOTH DRAG LOGIC ---
  const stateRef = useRef({
      tracks,
      zoom,
      dragMode: "NONE" as InteractionMode,
      dragClipId: null as string | null,
      dragTrackId: null as string | null,
      startX: 0,
      originalStart: 0,
      originalDuration: 0,
      originalOffset: 0,
      currentNewStart: 0,
      currentNewDuration: 0
  });

  useEffect(() => { stateRef.current.tracks = tracks; }, [tracks]);
  useEffect(() => { stateRef.current.zoom = zoom; }, [zoom]);

  // --- LOCAL VISUAL STATE (For React Rendering) ---
  const [visualDrag, setVisualDrag] = useState<{
    isDragging: boolean;
    clipId: string | null;
    start: number;
    duration: number;
  }>({ isDragging: false, clipId: null, start: 0, duration: 0 });

  const pixelsToSeconds = (px: number) => px / stateRef.current.zoom;

  // --- RULER CALCULATION ---
  const rulerTicks = useMemo(() => {
    let step = 1; 
    if (zoom < 10) step = 30; else if (zoom < 30) step = 10; else if (zoom < 80) step = 5; else step = 1;
    const ticks = [];
    for (let i = 0; i <= 3600; i += step) ticks.push(i); 
    return { ticks, step };
  }, [zoom]);

  // --- ZOOM WHEEL ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaY) < 50) { 
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(prev => Math.min(Math.max(prev * delta, 2), 300));
      }
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  // --- KEYBOARD SHORTCUTS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if ((e.key === "Backspace" || e.key === "Delete") && selectedClipId) {
        tracks.forEach(t => t.clips.find(c => c.id === selectedClipId) && onDeleteClip(t.id, selectedClipId));
      }
      if ((e.key === "c" || (e.ctrlKey && e.key === "k")) && selectedClipId) handleSplit();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedClipId, tracks, onDeleteClip, currentTime]);

  // --- DRAG HANDLERS ---
  const handleMouseDown = (e: React.MouseEvent, clip: Clip, trackId: string, mode: InteractionMode) => {
    e.stopPropagation(); e.preventDefault();
    onSelectClip(clip.id);
    setIsFocused(true);

    stateRef.current.dragMode = mode;
    stateRef.current.dragClipId = clip.id;
    stateRef.current.dragTrackId = trackId;
    stateRef.current.startX = e.clientX;
    stateRef.current.originalStart = clip.start;
    stateRef.current.originalDuration = clip.duration;
    stateRef.current.originalOffset = clip.offset;
    stateRef.current.currentNewStart = clip.start;
    stateRef.current.currentNewDuration = clip.duration;

    setVisualDrag({ isDragging: true, clipId: clip.id, start: clip.start, duration: clip.duration });

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
  };

  const handleGlobalMouseMove = (e: MouseEvent) => {
      const state = stateRef.current;
      if (state.dragMode === "NONE" || !state.dragClipId) return;

      const deltaSeconds = pixelsToSeconds(e.clientX - state.startX);
      let newStart = state.originalStart;
      let newDuration = state.originalDuration;

      if (state.dragMode === "MOVE") {
          newStart = Math.max(0, state.originalStart + deltaSeconds);
      } 
      else if (state.dragMode === "TRIM_LEFT") {
          const maxStart = state.originalStart + state.originalDuration - 0.2; 
          newStart = Math.min(Math.max(0, state.originalStart + deltaSeconds), maxStart);
          const change = newStart - state.originalStart;
          newDuration = state.originalDuration - change;
      } 
      else if (state.dragMode === "TRIM_RIGHT") {
          newDuration = Math.max(0.2, state.originalDuration + deltaSeconds);
      }

      state.currentNewStart = newStart;
      state.currentNewDuration = newDuration;

      setVisualDrag(prev => ({ ...prev, start: newStart, duration: newDuration }));
  };

  const handleGlobalMouseUp = (e: MouseEvent) => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);

      const state = stateRef.current;
      if (state.dragMode === "NONE" || !state.dragClipId || !state.dragTrackId) return;

      if (state.dragMode === "MOVE") {
           const el = document.elementFromPoint(e.clientX, e.clientY);
           const targetTrackId = el?.closest('[data-track-id]')?.getAttribute('data-track-id');

           if (targetTrackId && targetTrackId !== state.dragTrackId) {
               onSwitchTrack(state.dragClipId, state.dragTrackId, targetTrackId, state.currentNewStart);
           } else {
               onUpdateClip(state.dragTrackId, state.dragClipId, { start: state.currentNewStart });
           }
      } 
      else if (state.dragMode === "TRIM_LEFT") {
           const change = state.currentNewStart - state.originalStart;
           onUpdateClip(state.dragTrackId, state.dragClipId, { 
               start: state.currentNewStart,
               duration: state.currentNewDuration,
               offset: state.originalOffset + change
           });
      }
      else if (state.dragMode === "TRIM_RIGHT") {
           onUpdateClip(state.dragTrackId, state.dragClipId, { duration: state.currentNewDuration });
      }

      stateRef.current.dragMode = "NONE";
      stateRef.current.dragClipId = null;
      setVisualDrag({ isDragging: false, clipId: null, start: 0, duration: 0 });
  };

  // --- EXTERNAL DROP (UPDATED WITH 1/3 SCALING LOGIC) ---
  const handleExternalDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; };
  
  const handleExternalDrop = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/json");
    
    if (data && scrollContainerRef.current) {
        const parsedClip = JSON.parse(data);
        const rect = scrollContainerRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left + scrollContainerRef.current.scrollLeft;
        
        // Calculate drop time based on CURRENT zoom
        const dropTime = Math.max(0, clickX / zoom);
        onDropNewClip(trackId, parsedClip, dropTime);

        // --- THE "1/3rd" AUTO-ZOOM FEATURE ---
        // If the timeline is empty (first clip), adjust zoom so the clip takes up 1/3 of the viewport.
        const totalClips = tracks.reduce((acc, t) => acc + t.clips.length, 0);
        
        if (totalClips === 0) {
            const containerWidth = rect.width;
            const clipDuration = parsedClip.duration || 10;
            
            // Formula: (ContainerWidth / 3) = ClipDuration * NewZoom
            // Therefore: NewZoom = (ContainerWidth / 3) / ClipDuration
            const targetZoom = (containerWidth / 3) / clipDuration;
            
            // Apply zoom with safety clamps
            setZoom(Math.min(Math.max(targetZoom, 2), 300));
        }
    }
  };

  // --- HELPERS ---
  const handleSplit = () => {
    if (!selectedClipId) return;
    const track = tracks.find(t => t.clips.some(c => c.id === selectedClipId));
    const clip = track?.clips.find(c => c.id === selectedClipId);
    if (track && clip && currentTime > clip.start && currentTime < (clip.start + clip.duration)) {
         onSplitClip(track.id, clip.id, currentTime);
         onSelectClip(null);
    }
  };
  
  // Adjusted "Fit to Screen" to also follow the 1/3rd style logic roughly (fit with padding)
  const fitToScreen = () => {
    let maxEnd = 10;
    tracks.forEach(t => t.clips.forEach(c => maxEnd = Math.max(maxEnd, c.start + c.duration)));
    if (scrollContainerRef.current) setZoom(scrollContainerRef.current.clientWidth / (maxEnd * 1.2));
  };

  const getTrackIcon = (type: string) => {
      const common = "w-3.5 h-3.5";
      switch(type) {
          case 'video': return <Video className={common} />;
          case 'audio': return <Mic className={common} />;
          case 'text': return <Type className={common} />;
          default: return <Layers className={common} />;
      }
  };

  return (
    <>
    <style jsx global>{`
        .timeline-scroll::-webkit-scrollbar { height: 10px; width: 10px; background: #0A0A0A; }
        .timeline-scroll::-webkit-scrollbar-track { background: #0A0A0A; border-top: 1px solid rgba(255,255,255,0.05); }
        .timeline-scroll::-webkit-scrollbar-thumb { background: #222; border-radius: 5px; border: 2px solid #0A0A0A; }
        .timeline-scroll::-webkit-scrollbar-thumb:hover { background: #333; }
        .timeline-scroll::-webkit-scrollbar-corner { background: #0A0A0A; }
    `}</style>

    <div 
        className="flex flex-col h-full w-full bg-[#0A0A0A] text-gray-300 font-sans select-none relative overflow-hidden outline-none" 
        ref={containerRef}
        tabIndex={0} 
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onClick={() => setIsFocused(true)} 
    >
      
      {/* --- TOOLBAR --- */}
      <div className="h-12 border-b border-white/6 flex items-center justify-between px-4 bg-[#0A0A0A] shrink-0 z-40 relative">
         <div className="flex gap-3 items-center">
             <div className="flex bg-[#111] p-0.5 rounded-lg border border-white/6">
                <button 
                  onClick={handleSplit} 
                  disabled={!selectedClipId} 
                  className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-sm text-[10px] font-bold tracking-wider uppercase transition-all",
                      selectedClipId 
                          ? "text-electric-red hover:bg-electric-red/10 hover:shadow-[0_0_15px_rgba(255,46,77,0.2)]" 
                          : "text-neutral-600 cursor-not-allowed"
                  )}
                >
                  <Scissors className="w-3.5 h-3.5" /> 
                  <span>Split</span>
                </button>
                <div className="w-px bg-white/6 my-1 mx-1" />
                <button 
                  onClick={() => selectedClipId && tracks.forEach(t => t.clips.find(c => c.id === selectedClipId) && onDeleteClip(t.id, selectedClipId))} 
                  disabled={!selectedClipId} 
                  className={cn(
                    "p-1.5 rounded-sm transition-colors",
                    selectedClipId ? "text-neutral-500 hover:text-electric-red hover:bg-electric-red/10" : "text-neutral-700 cursor-not-allowed"
                  )}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
             </div>
         </div>
         
         <div className="absolute left-1/2 -translate-x-1/2 font-mono text-xs font-semibold text-electric-red tracking-widest bg-electric-red/5 px-4 py-1.5 rounded-full border border-electric-red/20 shadow-[0_0_20px_rgba(255,46,77,0.1)]">
            {new Date(currentTime * 1000).toISOString().substr(11, 8)}
            <span className="text-neutral-500 text-[10px] ml-1">{(currentTime % 1).toFixed(2).substring(1)}</span>
         </div>

         <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 bg-[#111] px-2 py-1 rounded-lg border border-white/6">
                <button onClick={() => setZoom(z => Math.max(z - 10, 2))} className="p-1 hover:text-white transition-colors text-neutral-500"><ZoomOut className="w-3.5 h-3.5" /></button>
                <div className="w-20 h-1 bg-neutral-800 rounded-full overflow-hidden relative">
                    <div className="absolute left-0 top-0 bottom-0 bg-electric-red shadow-[0_0_10px_#FF2E4D]" style={{ width: `${Math.min(zoom/3, 100)}%` }} />
                </div>
                <button onClick={() => setZoom(z => Math.min(z + 10, 300))} className="p-1 hover:text-white transition-colors text-neutral-500"><ZoomIn className="w-3.5 h-3.5" /></button>
             </div>
             <button onClick={fitToScreen} className="p-2 hover:bg-white/5 rounded-md text-neutral-500 hover:text-white transition-colors"><Maximize className="w-4 h-4" /></button>
         </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* --- LEFT HEADER --- */}
        <div className="w-56 bg-[#0E0E0E] border-r border-white/6 flex flex-col shrink-0 z-30">
             <div className="h-9 border-b border-white/6 bg-[#0E0E0E] flex items-center px-4">
                 <span className="text-[10px] font-bold text-neutral-500 tracking-[0.2em] uppercase flex items-center gap-2">
                    <Layers className="w-3 h-3 text-electric-red" /> Layers
                 </span>
             </div>
             
             <div className="flex-1 overflow-hidden relative">
               {tracks.map(track => (
                  <div key={track.id} className="h-20 border-b border-white/6 flex flex-col justify-center px-4 hover:bg-white/2 transition-colors group relative">
                      <div className="absolute left-0 top-0 bottom-0 w-0.75 bg-electric-red opacity-0 group-hover:opacity-100 transition-opacity shadow-[0_0_12px_#FF2E4D]" />
                      <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-3">
                              <div className={cn(
                                "p-1.5 rounded bg-neutral-900 border border-white/5 transition-colors",
                                track.type === 'video' ? "text-blue-400" : track.type === 'audio' ? "text-emerald-400" : "text-white"
                              )}>
                                   {getTrackIcon(track.type)}
                              </div>
                              <span className="text-xs font-bold text-neutral-400 group-hover:text-white transition-colors truncate max-w-25">
                                  {track.name}
                              </span>
                          </div>
                          <MoreHorizontal className="w-4 h-4 text-neutral-600 hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="flex gap-2 pl-9">
                         <span className="text-[9px] text-neutral-600 bg-neutral-900/50 px-1.5 py-0.5 rounded border border-white/5 font-mono tracking-wide">{track.type.toUpperCase()}</span>
                      </div>
                  </div>
               ))}
             </div>
        </div>

        {/* --- TIMELINE AREA --- */}
        <div 
          className="flex-1 overflow-x-auto overflow-y-hidden relative timeline-scroll bg-[#0A0A0A]" 
          ref={scrollContainerRef}
          onScroll={() => { /* Sync if needed */ }}
          onClick={(e) => {
             if((e.target as HTMLElement).classList.contains('track-lane') || (e.target as HTMLElement).classList.contains('timeline-bg')) {
                const rect = e.currentTarget.getBoundingClientRect();
                const scrollLeft = e.currentTarget.scrollLeft;
                onSeek((e.clientX - rect.left + scrollLeft) / zoom);
                onSelectClip(null);
             }
          }}
        >
             <div className="min-w-full h-full timeline-bg relative" style={{ width: `${Math.max(2000, tracks.reduce((acc, t) => acc + t.clips.length * 100, 0) * zoom)}px` }}>
                 
                 {/* RULER */}
                 <div className="h-9 border-b border-white/6 bg-[#0A0A0A]/90 backdrop-blur-md sticky top-0 z-20 w-full shadow-sm">
                    {rulerTicks.ticks.map((time) => (
                        <div key={time} className="absolute bottom-0 top-3 border-l border-white/10" style={{ left: time * zoom }}>
                            <span className="absolute -top-1 left-1.5 text-[9px] font-mono text-neutral-500 select-none">
                                {time % 60 === 0 ? (time/60 + 'm') : time}
                            </span>
                        </div>
                    ))}
                 </div>

                 {/* Vertical Guidelines */}
                 <div className="absolute inset-0 pointer-events-none z-0">
                    {rulerTicks.ticks.map(time => (
                        <div key={time} className="absolute top-9 bottom-0 border-l border-dashed border-white/3" style={{ left: time * zoom }} />
                    ))}
                 </div>
                 
                 {/* Tracks */}
                 <div className="relative pt-0 z-10">
                    {tracks.map(track => (
                        <div 
                           key={track.id} 
                           data-track-id={track.id} 
                           className="track-lane h-20 border-b border-white/6 relative hover:bg-white/1 transition-colors"
                           onDragOver={handleExternalDragOver} 
                           onDrop={(e) => handleExternalDrop(e, track.id)}
                        >
                            {track.clips.map(clip => {
                                const isDraggingThis = visualDrag.isDragging && visualDrag.clipId === clip.id;
                                const isSelected = selectedClipId === clip.id;
                                const currentStart = isDraggingThis ? visualDrag.start : clip.start;
                                const currentDuration = isDraggingThis ? visualDrag.duration : clip.duration;
                                
                                let clipClass = "";
                                let clipStyle = {};

                                if (track.type === 'video') {
                                    clipClass = "bg-[#1A1A1A] border-l-2 border-l-[#FF2E4D] border-y border-r border-white/10";
                                } else if (track.type === 'audio') {
                                    clipClass = "bg-[#111] border-l-2 border-l-emerald-500 border-y border-r border-white/10";
                                    clipStyle = { backgroundImage: 'linear-gradient(90deg, #10b98111 1px, transparent 1px)', backgroundSize: '4px 100%' };
                                } else {
                                    clipClass = "bg-[#1A1A1A] border border-white/10";
                                }

                                return (
                                  <div key={clip.id} 
                                       className={cn(
                                          "absolute top-2 bottom-2 rounded-[3px] overflow-hidden group transition-none select-none", 
                                          clipClass,
                                          isSelected ? "ring-1 ring-electric-red shadow-[0_0_20px_rgba(255,46,77,0.15)] z-20" : "hover:brightness-110 z-10",
                                          isDraggingThis && "opacity-80 scale-[1.01] shadow-xl z-50 cursor-grabbing ring-1 ring-white/50"
                                       )} 
                                       style={{ 
                                          left: currentStart * zoom, 
                                          width: Math.max(currentDuration * zoom, 2),
                                          ...clipStyle
                                       }} 
                                       onMouseDown={(e) => handleMouseDown(e, clip, track.id, "MOVE")}
                                  >
                                      {track.type === 'audio' && (
                                         <div className="absolute inset-0 flex items-center opacity-30 pointer-events-none">
                                              <div className="w-full h-2/3 bg-linear-to-b from-emerald-500/0 via-emerald-500/30 to-emerald-500/0"></div>
                                         </div>
                                      )}

                                      {/* Handles */}
                                      <div className={cn("absolute left-0 top-0 bottom-0 w-3 z-30 opacity-0 group-hover:opacity-100 cursor-w-resize bg-linear-to-r from-black/80 to-transparent hover:from-electric-red/80 transition-all")} onMouseDown={(e) => handleMouseDown(e, clip, track.id, "TRIM_LEFT")} />
                                      <div className={cn("absolute right-0 top-0 bottom-0 w-3 z-30 opacity-0 group-hover:opacity-100 cursor-e-resize bg-linear-to-l from-black/80 to-transparent hover:from-electric-red/80 transition-all")} onMouseDown={(e) => handleMouseDown(e, clip, track.id, "TRIM_RIGHT")} />
                                      
                                      <div className="relative w-full h-full px-2 py-1 flex flex-col justify-center pointer-events-none">
                                          <div className="flex items-center gap-1.5 overflow-hidden">
                                              <span className={cn("text-[10px] font-bold truncate tracking-tight drop-shadow-md", isSelected ? "text-white" : "text-neutral-300")}>
                                                  {clip.name}
                                              </span>
                                          </div>
                                          {zoom > 10 && <span className="text-[8px] text-neutral-500 font-mono mt-0.5 opacity-80">{currentDuration.toFixed(1)}s</span>}
                                      </div>
                                  </div>
                                );
                            })}
                        </div>
                    ))}
                    
                    {/* --- PLAYHEAD (NEON RED) --- */}
                    <div className="absolute top-0 bottom-0 z-50 pointer-events-none" style={{ transform: `translateX(${currentTime * zoom}px)` }}>
                        <div className="w-px h-full bg-electric-red shadow-[0_0_10px_2px_rgba(255,46,77,0.5)]" />
                        <div className="absolute top-0 -left-1.5 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-8 border-t-electric-red drop-shadow-[0_0_10px_rgba(255,46,77,0.8)]" />
                    </div>
                 </div>
             </div>
        </div>
      </div>
    </div>
    </>
  );
}