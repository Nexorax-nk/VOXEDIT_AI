"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar, { ToolId } from "@/components/editor/Sidebar";
import TopBar from "@/components/editor/TopBar";
import ToolsPanel from "@/components/editor/ToolsPanel";
import Player from "@/components/editor/Player";
import Timeline, { Track, Clip } from "@/components/editor/Timeline";

const INITIAL_TRACKS: Track[] = [
  { id: "V1", type: "video", name: "Main Video", clips: [] },
  { id: "T1", type: "text",  name: "Text Overlay", clips: [] },
  { id: "A1", type: "audio", name: "SFX / Music", clips: [] },
];

export default function EditorPage() {
  const [activeTool, setActiveTool] = useState<ToolId>("media");
  
  // --- STATE ---
  const [tracks, setTracks] = useState<Track[]>(INITIAL_TRACKS);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  
  // --- EXPORT STATE ---
  const [isExporting, setIsExporting] = useState(false);

  // --- VIDEO PLAYER STATE ---
  const [playerSrc, setPlayerSrc] = useState<string | null>(null);
  const [playerClipStart, setPlayerClipStart] = useState(0);
  const [playerClipOffset, setPlayerClipOffset] = useState(0);

  // --- AUDIO PLAYER STATE ---
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [audioClipStart, setAudioClipStart] = useState(0);
  const [audioClipOffset, setAudioClipOffset] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // --- ENGINE 1: VIDEO CLIP DETECTION ---
  useEffect(() => {
     const videoTrack = tracks.find(t => t.type === 'video');
     
     if (videoTrack) {
        const activeClip = videoTrack.clips.find(clip => 
           currentTime >= clip.start && currentTime < (clip.start + clip.duration)
        );

        if (activeClip && activeClip.url) {
           if (playerSrc !== activeClip.url) {
               setPlayerSrc(activeClip.url);
               setPlayerClipStart(activeClip.start);
               setPlayerClipOffset(activeClip.offset);
           }
        } else {
           if (playerSrc !== null) setPlayerSrc(null);
        }
     }
  }, [currentTime, tracks, playerSrc]);

  // --- ENGINE 2: AUDIO CLIP DETECTION ---
  useEffect(() => {
     const audioTrack = tracks.find(t => t.type === 'audio');
     
     if (audioTrack) {
        const activeClip = audioTrack.clips.find(clip => 
           currentTime >= clip.start && currentTime < (clip.start + clip.duration)
        );

        if (activeClip && activeClip.url) {
           if (audioSrc !== activeClip.url) {
               setAudioSrc(activeClip.url);
               setAudioClipStart(activeClip.start);
               setAudioClipOffset(activeClip.offset);
           }
        } else {
           if (audioSrc !== null) setAudioSrc(null);
        }
     }
  }, [currentTime, tracks, audioSrc]);

  // --- ENGINE 3: AUDIO SYNC ---
  useEffect(() => {
      if (audioRef.current && audioSrc) {
          const localTime = currentTime - audioClipStart + audioClipOffset;
          if (Math.abs(audioRef.current.currentTime - localTime) > 0.3) {
              audioRef.current.currentTime = localTime;
          }
          if (isPlaying) {
              audioRef.current.play().catch(e => console.log("Audio play error", e));
          } else {
              audioRef.current.pause();
          }
      }
  }, [currentTime, isPlaying, audioSrc, audioClipStart, audioClipOffset]);

  // --- ENGINE 4: GAP PLAYBACK ---
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const tick = () => {
      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;
      
      if (isPlaying && !playerSrc) {
          setCurrentTime(prev => prev + delta);
          animationFrameId = requestAnimationFrame(tick);
      }
    };

    if (isPlaying && !playerSrc) {
      lastTime = performance.now();
      animationFrameId = requestAnimationFrame(tick);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, playerSrc]);

  // --- ACTIONS ---
  const handleDropNewClip = (trackId: string, clipData: any, time: number) => {
    const newClip: Clip = {
        id: Math.random().toString(36).substr(2, 9),
        name: clipData.name,
        start: time,
        duration: clipData.duration || 5,
        offset: 0, 
        url: clipData.url,
        type: clipData.type 
    };
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, clips: [...t.clips, newClip] } : t));
    setSelectedClipId(newClip.id);
    setCurrentTime(time); 
  };

  const handleUpdateClip = (trackId: string, clipId: string, updates: Partial<Clip>) => {
    setTracks(prev => prev.map(t => 
        t.id === trackId 
            ? { ...t, clips: t.clips.map(c => c.id === clipId ? { ...c, ...updates } : c) } 
            : t
    ));
  };

  const handleSwitchTrack = (clipId: string, oldTrackId: string, newTrackId: string, newStart: number) => {
    let clipToMove: Clip | undefined;
    const afterRemove = tracks.map(t => {
        if(t.id === oldTrackId) {
            clipToMove = t.clips.find(c => c.id === clipId);
            return { ...t, clips: t.clips.filter(c => c.id !== clipId) };
        }
        return t;
    });

    if(!clipToMove) return;

    setTracks(afterRemove.map(t => {
        if(t.id === newTrackId) {
            return { ...t, clips: [...t.clips, { ...clipToMove!, start: newStart }] };
        }
        return t;
    }));
  };

  const handleSplitClip = (trackId: string, clipId: string, splitTime: number) => {
    setTracks(prev => prev.map(track => {
       if (track.id !== trackId) return track;
       const originalClip = track.clips.find(c => c.id === clipId);
       if (!originalClip) return track;

       const offset = splitTime - originalClip.start;
       if (offset <= 0 || offset >= originalClip.duration) return track;

       const leftClip = { ...originalClip, duration: offset };
       const rightClip = { 
           ...originalClip, 
           id: Math.random().toString(36).substr(2, 9) + "_split", 
           start: splitTime, 
           duration: originalClip.duration - offset,
           offset: originalClip.offset + offset 
       };

       const newClips = track.clips.filter(c => c.id !== clipId);
       newClips.push(leftClip, rightClip);
       return { ...track, clips: newClips };
    }));
  };

  const handleDeleteClip = (trackId: string, clipId: string) => {
     setTracks(prev => prev.map(t => t.id === trackId ? { ...t, clips: t.clips.filter(c => c.id !== clipId) } : t));
     setSelectedClipId(null);
  };

  const getSelectedClipObject = () => {
    if (!selectedClipId) return null;
    for (const t of tracks) {
        const c = t.clips.find(clip => clip.id === selectedClipId);
        if (c) return c;
    }
    return null;
  };

  const handleAiProcessingComplete = (newUrl: string, newDuration: number) => {
    if (!selectedClipId) return;
    setTracks(prev => prev.map(track => {
        if (!track.clips.some(c => c.id === selectedClipId)) return track;
        return {
            ...track,
            clips: track.clips.map(c => {
                if (c.id === selectedClipId) {
                    return {
                        ...c,
                        url: newUrl,
                        offset: 0,
                        name: c.name + " (AI)",
                        duration: newDuration
                    };
                }
                return c;
            })
        };
    }));
    setPlayerSrc(newUrl);
    setPlayerClipOffset(0);
  };

  const handleExport = async () => {
      const videoTrack = tracks.find(t => t.type === 'video');
      if (!videoTrack || videoTrack.clips.length === 0) {
          alert("No clips to export!");
          return;
      }
      const sortedClips = [...videoTrack.clips].sort((a, b) => a.start - b.start);
      const clipData = sortedClips.map(c => ({
          filename: c.url?.split("/").pop() || "",
          duration: c.duration
      }));

      setIsExporting(true);
      try {
          const formData = new FormData();
          formData.append("project_data", JSON.stringify(clipData));
          const res = await fetch("http://localhost:8000/render", { method: "POST", body: formData });
          if (res.status === 404) { alert("Backend offline."); setIsExporting(false); return; }
          const data = await res.json();
          if (data.status === "success") {
              const link = document.createElement('a');
              link.href = data.url;
              link.download = "voxedit_final.mp4";
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
          } else { alert("Export failed: " + data.message); }
      } catch (e) { console.error(e); alert("Export failed."); } finally { setIsExporting(false); }
  };

  return (
    // 1. MASTER CONTAINER
    <main className="flex h-screen w-screen bg-[#09090b] overflow-hidden text-neutral-200 font-sans selection:bg-electric-red selection:text-white">
      
      {/* 2. SIDEBAR */}
      <Sidebar activeTool={activeTool} onChange={setActiveTool} />
      
      {/* 3. MAIN CONTENT COLUMN */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#09090b]">
        
        {/* HEADER */}
        <div className="shrink-0 z-50">
           <TopBar onExport={handleExport} isExporting={isExporting} />
        </div>
        
        {/* WORKSPACE AREA */}
        <div className="flex-1 flex overflow-hidden relative">
          
          {/* LEFT PANEL (Tools) - w-72 (288px) */}
          <div className="w-85 shrink-0 flex flex-col border-r border-white/10 bg-[#3a3a3a] z-20">
              <ToolsPanel 
                  activeTool={activeTool} 
                  onMediaSelect={() => {}} 
                  selectedClip={getSelectedClipObject()}
                  onUpdateProcessedClip={handleAiProcessingComplete}
              />
          </div>
          
          {/* RIGHT COLUMN (Player + Log + Timeline) */}
          <div className="flex flex-col flex-1 min-w-0 bg-[#1f1e1e] relative border-l border-[#272626] z-0">
            
            {/* TOP SPLIT: PLAYER & LOG */}
            <div className="flex-1 flex min-h-0 overflow-hidden bg-[#1f1e1e]">
                
                {/* 1. PLAYER CONTAINER - Fits Available Space Perfectly */}
                <div className="flex-1 flex items-center justify-center relative overflow-hidden">
                    {/* The Player component will stretch to fill this container */}
                    <div className="w-full h-full flex items-center justify-center p-4">
                        <Player 
                          src={playerSrc} 
                          currentTime={currentTime} 
                          isPlaying={isPlaying} 
                          onTimeUpdate={setCurrentTime} 
                          onDurationChange={()=>{}} 
                          onTogglePlay={() => setIsPlaying(!isPlaying)}
                          clipStartTime={playerClipStart}
                          clipOffset={playerClipOffset}
                        />
                    </div>
                </div>

                {/* 2. REASONING LOG (Agent Brain) - w-80 (320px) */}
                <div className="w-90 bg-[#09090b] border-l border-white/10 flex flex-col z-20 shadow-xl">
                    {/* Log Header */}
                    <div className="h-10 border-b border-white/10 flex items-center justify-between px-4 bg-[#121212]">
                         <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">VoxAgent</span>
                         </div>
                         <span className="text-[9px] text-gray-600 font-mono">GEMINI-1.5-PRO</span>
                    </div>

                    {/* Log Stream - STARTED EMPTY */}
                    <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-3">
                         {/* Logs will appear here dynamically */}
                    </div>
                </div>

            </div>

            {/* Hidden Audio Element */}
            {audioSrc && <audio ref={audioRef} src={audioSrc} className="hidden" />}

            {/* BOTTOM: TIMELINE (Fixed Height) */}
            <div className="h-80 shrink-0 border-t border-white/10 bg-[#757777] z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] relative">
               <Timeline 
                  tracks={tracks} 
                  currentTime={currentTime} 
                  onSeek={setCurrentTime} 
                  onDropNewClip={handleDropNewClip} 
                  onUpdateClip={handleUpdateClip}
                  onSwitchTrack={handleSwitchTrack}
                  onSplitClip={handleSplitClip}
                  onDeleteClip={handleDeleteClip}
                  selectedClipId={selectedClipId ?? undefined}
                  onSelectClip={setSelectedClipId}
               />
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}