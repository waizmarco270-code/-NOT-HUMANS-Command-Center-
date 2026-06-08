import React from "react";
import { 
  Shield, 
  Terminal, 
  Award, 
  User, 
  Info, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  LogOut, 
  Lock, 
  Sparkles,
  Users,
  Flame,
  Volume2,
  Layers
} from "lucide-react";
import { User as FirebaseUser } from "firebase/auth";
import { CoCRole } from "../types";
import { motion } from "motion/react";

interface PremiumSidebarProps {
  user: FirebaseUser | null;
  cocRole: CoCRole | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isRegistered: boolean;
  playerName?: string;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  onLogout: () => void;
  onOpenProfile?: () => void;
  unreadCounts?: Record<string, number>;
}

export default function PremiumSidebar({
  user,
  cocRole,
  activeTab,
  setActiveTab,
  isRegistered,
  playerName,
  isSidebarOpen,
  setIsSidebarOpen,
  onLogout,
  onOpenProfile,
  unreadCounts
}: PremiumSidebarProps) {
  
  if (!user) return null; // Only render when logged in

  const navItems = [
    { id: "hq", label: "HQ Terminal", icon: Shield, desc: "Clan Main Operations Hub" },
    { id: "war", label: "War Room", icon: Terminal, requiresReg: true, desc: "Active Wars & Tactical Chats" },
    { id: "cwl", label: "CWL Planner", icon: Award, requiresReg: true, desc: "War League Strategy Sheets" },
    { id: "announcements", label: "Notices", icon: Info, desc: "Official Announcements" },
    { id: "legends", label: "Legends", icon: User, desc: "Top Trophy Contenders" },
    { id: "strategies", label: "Strategies", icon: Terminal, requiresReg: true, desc: "Attack Combinations & Guides" },
    { id: "bases", label: "Defenses", icon: Layers, requiresReg: true, desc: "Bases & Layout Vaults" },
    { id: "giveaway", label: "Giveaways", icon: Award, requiresReg: true, desc: "Active Loot & Giveaways" },
    { id: "history", label: "Chronicles", icon: Info, desc: "Clan Milestones & History" }
  ];

  const sidebarContent = (isMobileLayout: boolean) => {
    const isCollapsed = !isSidebarOpen && !isMobileLayout;

    return (
      <div className="flex flex-col h-full bg-[#0a0505] border-r border-[#261515] relative">
        {/* BASALT PATTERN DECOR Overlays */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.03)_0%,_transparent_60%)] pointer-events-none" />
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-red-650 via-amber-500/50 to-red-650 opacity-20" />
        
        {/* PREMIUM DRAWER HEADER */}
        <div className={`p-4 border-b border-[#1c0d0d] flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
          {!isCollapsed ? (
            <div className="flex items-center space-x-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-950/80 border border-red-800/40 shadow-inner">
                <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
              </div>
              <div>
                <span className="block font-mono text-[9px] font-black uppercase text-amber-500 tracking-wider">
                  PREMIUM DECK
                </span>
                <span className="block font-sans text-xs font-black uppercase text-zinc-100 tracking-tight leading-none mt-0.5">
                  COMMAND CENTER
                </span>
              </div>
            </div>
          ) : (
            <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
          )}

          {/* Close/Toggle Controls */}
          {isMobileLayout ? (
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 rounded-md border border-[#2b1616] hover:bg-[#1a0c0c] text-zinc-500 hover:text-red-400 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden lg:flex p-1 rounded-md border border-[#2b1616] hover:bg-[#1a0c0c] text-zinc-500 hover:text-red-400 transition cursor-pointer"
              title={isSidebarOpen ? "Collapse navigation" : "Expand navigation"}
            >
              {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          )}
        </div>

        {/* PROFILE HEADER PANEL IN SIDEBAR (ONLY IF EXPANDED) */}
        {!isCollapsed && (
          <div className="p-4 bg-[#0d0707] border-b border-[#1c0d0d] flex items-center space-x-3 select-none">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                referrerPolicy="no-referrer"
                className="h-9 w-9 rounded border border-red-900/30 object-cover cursor-pointer hover:border-red-650 transition"
                alt="avatar"
                onClick={onOpenProfile}
              />
            ) : (
              <div 
                className="flex h-9 w-9 items-center justify-center rounded border border-red-900/30 bg-zinc-900 font-bold text-zinc-300 cursor-pointer hover:border-red-650"
                onClick={onOpenProfile}
              >
                {user.displayName?.charAt(0) || "U"}
              </div>
            )}
            <div className="text-left flex-1 min-w-0">
              <p 
                onClick={onOpenProfile}
                className="font-sans text-xs font-extrabold text-zinc-200 hover:text-red-400 cursor-pointer transition truncate"
              >
                {playerName || user.displayName?.split(" ")[0]} 👑
              </p>
              {cocRole && (
                <span className={`inline-block font-mono text-[8px] font-black uppercase px-1 rounded-sm mt-0.5 border ${
                  cocRole === "Leader" || cocRole === "Co-Leader"
                    ? "bg-red-950/60 border-red-900/30 text-red-400 animate-pulse" 
                    : cocRole === "Former Member"
                      ? "bg-zinc-900 border-zinc-800 text-zinc-500"
                      : "bg-amber-950/40 border-amber-900/30 text-amber-500"
                }`}>
                  {cocRole}
                </span>
              )}
            </div>
          </div>
        )}

        {/* NAVIGATION LIST */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto scrollbar-thin">
          {navItems.map((item) => {
            const Icon = item.icon;
            const disabled = item.requiresReg && !isRegistered;
            const active = activeTab === item.id;

            if (isCollapsed) {
              return (
                <button
                  key={item.id}
                  onClick={() => !disabled && setActiveTab(item.id)}
                  disabled={disabled}
                  className={`w-full flex justify-center py-3 rounded-lg relative group transition-all ${
                    active 
                      ? "bg-gradient-to-r from-red-950/60 to-red-900/40 text-red-450 border-l-2 border-red-500" 
                      : disabled 
                        ? "opacity-25 cursor-not-allowed" 
                        : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900/40"
                  }`}
                  title={`${item.label} - ${item.desc}`}
                >
                  <Icon className="h-5 w-5" />

                  {unreadCounts && unreadCounts[item.id] !== undefined && unreadCounts[item.id]! > 0 && (
                    <>
                      <span className="absolute top-2 right-5 h-2 w-2 rounded-full bg-red-600 animate-ping pointer-events-none" />
                      <span className="absolute top-2 right-5 h-2 w-2 rounded-full bg-red-600 pointer-events-none" />
                    </>
                  )}
                  
                  {/* Tooltip on Hover */}
                  <div className="absolute left-16 top-1/2 -translate-y-1/2 bg-zinc-950 border border-zinc-800 text-zinc-250 text-[10px] font-mono px-2.5 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-50 shadow-xl">
                    <span className="font-extrabold uppercase text-amber-400">{item.label}</span>
                    {unreadCounts && unreadCounts[item.id] !== undefined && unreadCounts[item.id]! > 0 && (
                      <span className="block text-red-400 text-[8px] font-black mt-0.5">{unreadCounts[item.id]} UNREAD TRANSMISSIONS</span>
                    )}
                    {disabled && <span className="block text-red-500 text-[8px] font-black mt-0.5">LOCKED • NEEDS MEMBER REGISTRATION</span>}
                  </div>
                </button>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => {
                  !disabled && setActiveTab(item.id);
                  if (isMobileLayout) {
                    setIsSidebarOpen(false); // Auto close menu on mobile selection
                  }
                }}
                disabled={disabled}
                className={`w-full text-left flex items-center justify-between px-3.5 py-2.5 rounded-lg border transition-all duration-150 ${
                  active
                    ? "bg-gradient-to-r from-red-950/80 to-[#100606] border-[#401c1c] text-red-400 font-extrabold"
                    : disabled
                      ? "opacity-30 cursor-not-allowed border-transparent text-zinc-600"
                      : "border-transparent text-zinc-400 hover:bg-[#100606]/40 hover:text-zinc-200 hover:border-[#1a0e0e]"
                }`}
              >
                <div className="flex items-center space-x-3 truncate">
                  <Icon className={`h-4.5 w-4.5 flex-shrink-0 ${active ? "text-red-500" : "text-zinc-500"}`} />
                  <div className="truncate text-left">
                    <span className="block font-mono text-[11px] uppercase tracking-wider leading-none">
                      {item.label}
                    </span>
                    <span className="block font-sans text-[9px] text-zinc-500 truncate mt-0.5 font-normal leading-tight">
                      {item.desc}
                    </span>
                  </div>
                </div>

                {disabled ? (
                  <Lock className="h-3 w-3 text-red-500 flex-shrink-0 ml-1" />
                ) : unreadCounts && unreadCounts[item.id] !== undefined && unreadCounts[item.id]! > 0 ? (
                  <span className="bg-red-600 text-white font-sans text-[9.5px] font-black px-1.5 py-0.5 rounded-full flex items-center justify-center animate-pulse border border-[#2b0505] leading-none shrink-0 ml-1 shadow">
                    {unreadCounts[item.id]}
                  </span>
                ) : active ? (
                  <div className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* LOGOUT FOOTER AT THE BOTTOM */}
        <div className="p-4 border-t border-[#1a0e0e] bg-[#070303]/80">
          {!isCollapsed ? (
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 border border-[#2b1616] hover:bg-red-950/20 text-zinc-500 hover:text-red-400 rounded-lg font-mono text-[10px] font-black uppercase tracking-widest transition cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>TERMINATE SESSION</span>
            </button>
          ) : (
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center py-2.5 hover:text-red-400 text-zinc-600 transition cursor-pointer"
              title="Terminate Operational Session"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* 1. MOBILE DRAWER OVERLAY (BLURRED BACKGROUND ACCRUALS) */}
      <div className="lg:hidden">
        {isSidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm transition-opacity duration-300" onClick={() => setIsSidebarOpen(false)} />
        )}
        <div className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          {sidebarContent(true)}
        </div>
      </div>

      {/* 2. DESKTOP PERMANENT / INLINE EXPANDABLE VIEWPORT PANEL */}
      <div className={`hidden lg:block h-screen sticky top-0 bg-[#0a0505] transition-all duration-300 flex-shrink-0 z-30 ${isSidebarOpen ? "w-64" : "w-20"}`}>
        {sidebarContent(false)}
      </div>
    </>
  );
}
