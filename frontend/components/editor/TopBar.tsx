// components/editor/TopBar.tsx
"use client";

import { Play, Download, Loader2 } from "lucide-react";

interface TopBarProps {
  onExport?: () => void;
  isExporting?: boolean;
}

export default function TopBar({ onExport, isExporting = false }: TopBarProps) {
  return (
    <header className="h-16 border-b border-border-gray bg-[#000000] flex items-center px-6 justify-between shrink-0 z-20">
      
      {/* --- Left: Logo & Branding --- */}
      <div className="flex items-center gap-3">
          <span className="text-[17px] font-bold text-electric-red ml-3 border border-electric-red/20 px-1.5 py-0.5 rounded bg-electric-red/5 tracking-wider">
            VOXEDIT AI
          </span>
      </div>

      {/* --- Right: Actions (Preview, Export, Profile) --- */}
      <div className="flex items-center gap-4">
        
        {/* Preview Button */}
        <button className="flex items-center gap-2 px-3 py-1.5 bg-black/60 border border-neutral-700 text-neutral-400 text-xs font-medium rounded-md transition-all duration-300 group hover:text-white hover:border-electric-red/60 hover:shadow-[0_0_18px_rgba(255,46,77,0.35)]">
          <Play className="w-3 h-3 fill-current transition-colors group-hover:text-electric-red" />
          <span className="tracking-wide">Preview</span>
        </button>

        {/* Export Button */}
        <button 
            onClick={onExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-5 py-2 bg-electric-red hover:bg-electric-red-hover text-white text-[11px] font-bold uppercase tracking-wider rounded transition-all shadow-[0_4px_14px_rgba(255,46,77,0.3)] hover:shadow-[0_6px_20px_rgba(255,46,77,0.4)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Rendering...</span>
              </>
          ) : (
              <>
                <Download className="w-3 h-3" />
                <span>Export</span>
              </>
          )}
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-border-gray mx-1" />

        {/* Profile Avatar */}
        <div className="w-9 h-9 rounded-full bg-linear-to-br from-zinc-800 to-zinc-700 border border-zinc-600 shadow-sm flex items-center justify-center cursor-pointer hover:border-electric-red/50 transition-colors">
            <span className="text-xs font-bold text-white">NK</span>
        </div>
      </div>
    </header>
  );
}