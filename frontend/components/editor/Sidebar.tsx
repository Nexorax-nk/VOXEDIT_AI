// components/editor/Sidebar.tsx
"use client";

import { 
  Clapperboard, 
  Bot, 
  Wand2, 
  Captions, 
  MessageSquare, 
  FolderOpen, 
  Settings 
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ToolId = "media" | "copilot" | "magic-assets" | "subtitles" | "ai-feedback" | "projects" | "settings";

interface SidebarProps {
  activeTool: ToolId;
  onChange: (id: ToolId) => void;
}

const MENU_ITEMS: { id: ToolId; label: string; icon: React.ElementType }[] = [
  { id: "media", label: "Media", icon: Clapperboard },
  { id: "copilot", label: "Copilot", icon: Bot },
  { id: "magic-assets", label: "Magic Assets", icon: Wand2 },
  { id: "subtitles", label: "Subtitles", icon: Captions },
  { id: "ai-feedback", label: "AI Feedback", icon: MessageSquare },
  { id: "projects", label: "Projects", icon: FolderOpen },
];

export default function Sidebar({ activeTool, onChange }: SidebarProps) {
  return (
    <aside className="w-18 h-full bg-[#1f1e1e] flex flex-col items-center py-4 z-50 select-none border-r border-border-gray/20">
      {/* --- Top Logo --- */}
      <div className="mb-8 flex flex-col items-center justify-center group cursor-pointer">
        <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-linear-to-br from-black via-neutral-900 to-neutral-800 border border-neutral-700 shadow-[0_0_20px_rgba(255,46,77,0.45)] transition-all duration-300 ease-out group-hover:scale-110 group-hover:border-[rgba(255,46,77,0.6)] group-hover:shadow-[0_0_40px_rgba(255,46,77,0.85)]">
          <span className="text-electric-red font-extrabold text-2xl tracking-widest drop-shadow-[0_0_8px_rgba(255,46,77,0.9)]">
            V
          </span>
        </div>
      </div>

      {/* --- Navigation Items --- */}
      <nav className="flex-1 w-full flex flex-col gap-3 px-2">
        {MENU_ITEMS.map((item) => {
          const isActive = activeTool === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={cn(
                "group relative w-full flex flex-col items-center justify-center py-2.5 rounded-xl transition-all duration-200",
                isActive 
                  ? "bg-bg-lighter text-white" 
                  : "text-text-secondary hover:text-white hover:bg-bg-lighter/50"
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-electric-red rounded-r-full shadow-[0_0_10px_#FF2E4D]" />
              )}
              <item.icon 
                className={cn(
                  "w-6 h-6 mb-1.5 transition-transform duration-200",
                  isActive ? "text-electric-red" : "group-hover:scale-110"
                )} 
              />
              <span className="text-[10px] font-medium tracking-wide text-center leading-tight">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* --- Bottom Actions --- */}
      <div className="mt-auto px-2 w-full">
        <button
          onClick={() => onChange("settings")}
          className={cn(
            "group w-full flex flex-col items-center justify-center py-3 rounded-xl transition-colors",
            activeTool === "settings" ? "text-electric-red bg-bg-lighter" : "text-text-secondary hover:text-white hover:bg-bg-lighter/50"
          )}
        >
          <Settings className="w-6 h-6 mb-1.5" />
          <span className="text-[10px] font-medium">Settings</span>
        </button>
      </div>
    </aside>
  );
}