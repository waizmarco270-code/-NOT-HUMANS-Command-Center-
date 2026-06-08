import React, { useState, useRef, useEffect } from "react";
import { Shield, LogIn, LogOut, Terminal, Award, User, Info, Menu, Bell, Check, Trash2 } from "lucide-react";
import { User as FirebaseUser } from "firebase/auth";
import { CoCRole } from "../types";

interface HeaderProps {
  user: FirebaseUser | null;
  cocRole: CoCRole | null;
  onLogin: () => void;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isRegistered: boolean;
  clanBadgeUrl?: string;
  playerName?: string;
  onOpenProfile?: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  notifications?: any[];
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  onClearNotifications?: () => void;
}

export default function Header({
  user,
  cocRole,
  onLogin,
  onLogout,
  activeTab,
  setActiveTab,
  isRegistered,
  clanBadgeUrl,
  playerName,
  onOpenProfile,
  isSidebarOpen,
  onToggleSidebar,
  notifications = [],
  onMarkAsRead,
  onMarkAllAsRead,
  onClearNotifications
}: HeaderProps) {
  const isLeaderOrCo = cocRole === "Leader" || cocRole === "Co-Leader";

  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadNotifCount = notifications.filter(n => !n.isRead).length;

  const navItems = [
    { id: "hq", label: "HQ", icon: Shield },
    { id: "war", label: "War Room", icon: Terminal, requiresReg: true },
    { id: "cwl", label: "CWL Planner", icon: Award, requiresReg: true },
    { id: "announcements", label: "Notices", icon: Info },
    { id: "legends", label: "Legends", icon: User },
    { id: "strategies", label: "Strategies", icon: Terminal, requiresReg: true },
    { id: "giveaway", label: "Giveaways", icon: Award, requiresReg: true },
    { id: "history", label: "Chronicles", icon: Info }
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-rose-950/40 bg-zinc-950/90 backdrop-blur-md">
      {/* Legendary NOT HUMANS Esports Tactical Broadcast Strip */}
      <div className="w-full bg-gradient-to-r from-[#170505] via-[#3a0d0d] to-[#170505] border-b border-red-900/45 py-1.5 px-4 overflow-hidden relative shadow-[0_2px_15px_rgba(239,68,68,0.12)] flex items-center justify-center">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(239,68,68,0.03)_1px,transparent_1px)] bg-[size:8px_8px] pointer-events-none" />
        <div className="flex items-center space-x-2 select-none">
          <span className="text-red-500 text-[10px] sm:text-xs animate-pulse">🛡️</span>
          <p className="font-mono text-[9px] sm:text-[10.5px] uppercase font-black tracking-widest text-[#fee2e2] text-center">
            NOT HUMANS DIRECTIVE // <span className="text-amber-400 font-bold">LOYALTY ABOVE ALL • INTELLECT IN COMBAT • SOVEREIGN UNTIL VICTORY. #2JVQ8PUUG</span>
          </p>
          <span className="text-red-500 text-[10px] sm:text-xs animate-pulse">⚔️</span>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl h-16 items-center justify-between px-4 sm:px-6">
        
        {/* Esports Clan Brand Logo & Hamburg Toggle Wrapper */}
        <div className="flex items-center space-x-3.5">
          {user && (
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-lg border border-red-950/40 bg-[#160a0a]/90 text-red-400 hover:text-red-300 hover:bg-[#261010] transition-colors cursor-pointer flex items-center justify-center active:scale-95 shadow-[0_0_12px_rgba(239,68,68,0.06)]"
              title={isSidebarOpen ? "Collapse tactile dashboard" : "Expand tactile dashboard"}
              id="hamburg-sidebar-toggle"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
          )}

          <div 
            onClick={() => setActiveTab("hq")} 
            className="flex cursor-pointer items-center space-x-3 transition-transform hover:scale-102"
          >
            <div className="relative flex h-11 w-11 items-center justify-center">
              {/* Pulsing Aura */}
              <div className="absolute inset-0 bg-red-600/20 rounded-full filter blur-md pointer-events-none" />
              <img 
                src={clanBadgeUrl || "https://api-assets.clashofclans.com/badges/200/HdJ2Uoq78hEwblk6vU0Nt74HmQ0PGMeL-SaTp2KWphc.png"} 
                alt="NOT HUMANS Logo" 
                className="h-10 w-10 object-contain z-10 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            <div>
              <span className="block font-sans text-sm font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-red-100 via-zinc-100 to-amber-200 uppercase sm:text-base leading-none">
                NOT HUMANS
              </span>
              <span className="block font-mono text-[9px] font-semibold tracking-widest text-red-500 uppercase mt-1">
                Command Center
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation links (ONLY VISIBLE TO LOGGED OUT GUESTS) */}
        {!user && (
          <nav className="hidden lg:flex items-center space-x-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const disabled = item.requiresReg && !isRegistered;
              const active = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => !disabled && setActiveTab(item.id)}
                  disabled={disabled}
                  className={`flex items-center space-x-2.5 px-3.5 py-2 rounded font-mono text-xs font-medium uppercase tracking-wider transition-all duration-200 ${
                    active
                      ? "bg-gradient-to-r from-red-950/80 to-zinc-900 border border-red-800/40 text-red-400"
                      : disabled
                        ? "opacity-30 cursor-not-allowed text-zinc-600"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-red-500" : "text-zinc-400"}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Authenticate & Meta stats buttons */}
        <div className="flex items-center space-x-3 pt-0">
          {user && (
            <div ref={dropdownRef} className="relative z-50">
              <button
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className={`p-2 rounded-lg border text-red-400 hover:text-red-300 transition-all cursor-pointer flex items-center justify-center relative active:scale-95 shadow-[0_0_12px_rgba(239,68,68,0.06)] ${
                  showNotifDropdown 
                    ? "bg-[#2d1212] border-red-850" 
                    : "bg-[#160a0a]/90 border-red-950/40 hover:bg-[#261010]"
                }`}
                title="Notifications Feed, Master"
                id="tactical-bell-notification-btn"
              >
                <Bell className={`h-4.5 w-4.5 ${unreadNotifCount > 0 ? "animate-pulse" : ""}`} />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white font-sans text-[8px] font-black h-4.5 min-w-4.5 px-1 rounded-full flex items-center justify-center animate-bounce border border-[#160a0a] leading-none shadow shadow-black">
                    {unreadNotifCount}
                  </span>
                )}
              </button>

              {showNotifDropdown && (
                <div className="absolute right-0 mt-2.5 w-80 sm:w-96 bg-[#0a0505] border border-red-900/40 rounded-xl shadow-[0_10px_35px_rgba(0,0,0,0.95)] p-4 text-zinc-100 font-sans max-h-[480px] overflow-y-auto scrollbar-thin">
                  <div className="flex items-center justify-between border-b border-[#2b1616] pb-2 mb-3 select-none">
                    <div className="flex items-center space-x-2">
                      <span className="text-red-500 animate-pulse">📡</span>
                      <span className="text-[10px] font-mono font-black uppercase text-[#e2a8a8] tracking-widest">
                        COMMAND DISPATCHES
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      {unreadNotifCount > 0 && (
                        <button
                          onClick={() => {
                            onMarkAllAsRead?.();
                          }}
                          className="text-[8px] font-mono text-cyan-400 hover:text-cyan-300 border border-cyan-900 bg-cyan-950/40 px-2 py-0.5 rounded transition uppercase font-black cursor-pointer"
                        >
                          Mark All Read
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button
                          onClick={() => {
                            onClearNotifications?.();
                            setShowNotifDropdown(false);
                          }}
                          className="text-[8px] font-mono text-zinc-500 hover:text-red-400 px-1 py-0.5 transition uppercase font-bold cursor-pointer"
                          title="Purge all logs"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 max-h-[360px] overflow-y-auto scrollbar-thin pr-1">
                    {notifications.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-zinc-500 font-mono text-[9px] uppercase font-bold tracking-wider">No active dispatches</p>
                        <p className="text-zinc-650 font-sans text-[9px] mt-1.5 max-w-xs mx-auto leading-normal">Mentions in chat, new defensive base listings, and combat strategies will stream here in real-time, Master!</p>
                      </div>
                    ) : (
                      notifications.map((notif) => {
                        let borderClass = "border-[#1c0e0e] bg-[#100606]/40";
                        let bannerClass = "text-zinc-450";
                        if (!notif.isRead) {
                          if (notif.type === "mention") {
                            borderClass = "border-emerald-900/50 bg-[#07130b]/60";
                            bannerClass = "text-emerald-400";
                          } else if (notif.type === "strategy") {
                            borderClass = "border-cyan-900/55 bg-[#061116]/60";
                            bannerClass = "text-cyan-400";
                          } else if (notif.type === "base") {
                            borderClass = "border-amber-900/55 bg-[#141009]/60";
                            bannerClass = "text-amber-400";
                          } else if (notif.type === "announcement") {
                            borderClass = "border-red-950 bg-[#160606]/60 animate-[pulse_3s_infinite]";
                            bannerClass = "text-red-400";
                          }
                        } else {
                          borderClass = "border-zinc-900 hover:bg-[#100a0a]/50 opacity-60";
                        }

                        const timeString = (() => {
                          const diff = Date.now() - notif.timestamp;
                          if (diff < 60000) return "Just now";
                          const mins = Math.floor(diff / 60000);
                          if (mins < 60) return `${mins}m ago`;
                          const hrs = Math.floor(mins / 60);
                          if (hrs < 24) return `${hrs}h ago`;
                          return new Date(notif.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
                        })();

                        return (
                          <div
                            key={notif.id}
                            onClick={() => {
                              onMarkAsRead?.(notif.id);
                              setActiveTab(notif.linkToTab);
                              setShowNotifDropdown(false);
                            }}
                            className={`p-2.5 rounded-lg border ${borderClass} transition duration-155 cursor-pointer hover:border-red-650 flex items-start gap-2 relative`}
                          >
                            <div className="flex-1 min-w-0 text-left">
                              <div className="flex items-center justify-between pointer-events-none">
                                <span className={`text-[9px] font-mono font-black uppercase tracking-wider ${bannerClass}`}>
                                  {notif.title}
                                </span>
                                <span className="text-[8px] font-mono text-zinc-500">
                                  {timeString}
                                </span>
                              </div>
                              <p className={`text-[11px] mt-1 leading-snug font-sans ${notif.isRead ? "text-zinc-550" : "text-zinc-200"}`}>
                                {notif.message}
                              </p>
                            </div>
                            
                            {!notif.isRead && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMarkAsRead?.(notif.id);
                                }}
                                className="p-1 rounded bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 text-emerald-400 hover:text-emerald-300 font-bold max-h-6 flex items-center justify-center cursor-pointer"
                                title="Acknowledge transmission"
                              >
                                <Check className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {user ? (
            <div className="flex items-center space-x-3 bg-zinc-900/80 border border-zinc-800/50 rounded-lg p-1.5 pr-3">
              <div 
                onClick={isRegistered ? onOpenProfile : undefined}
                className={`flex items-center space-x-3 ${isRegistered ? "cursor-pointer hover:bg-zinc-800/50 rounded p-0.5 transition-all" : ""}`}
                title={isRegistered ? "View & Manage Profile Drawer, Master" : undefined}
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    referrerPolicy="no-referrer"
                    alt="avatar"
                    className="h-8 w-8 rounded border border-zinc-700 object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded border border-zinc-700 bg-zinc-800 font-bold text-zinc-300">
                    {user.displayName?.charAt(0) || "U"}
                  </div>
                )}
                {/* Name and role context badges */}
                <div className="hidden sm:block text-left">
                  <p className="font-sans text-xs font-bold text-zinc-200 truncate max-w-[120px]">
                    {playerName || user.displayName?.split(" ")[0]}
                  </p>
                  {cocRole && (
                    <span className={`inline-block font-mono text-[9px] font-black uppercase px-1 rounded-sm ${
                      cocRole === "Leader" || cocRole === "Co-Leader"
                        ? "bg-red-950/60 border border-red-800/50 text-red-400" 
                        : cocRole === "Former Member"
                          ? "bg-zinc-800/80 border border-zinc-700 text-zinc-500"
                          : "bg-amber-950/40 border border-amber-900/30 text-amber-500"
                    }`}>
                      {cocRole}
                    </span>
                  )}
                </div>
              </div>
              <button 
                onClick={onLogout}
                className="ml-1 text-zinc-500 hover:text-red-400 transition cursor-pointer" 
                title="Log Out"
                id="btn-logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onLogin}
              className="flex items-center space-x-2.5 rounded bg-red-600 px-4 py-2 font-mono text-xs font-extrabold uppercase tracking-widest text-white shadow-md shadow-red-950/30 hover:bg-red-500 transition-all outline outline-1 outline-red-400/20 active:translate-y-0.5"
              id="btn-login-header"
            >
              <LogIn className="h-4 w-4" />
              <span>Login</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Tab layout toggles (ONLY VISIBLE TO LOGGED OUT GUESTS) */}
      {!user && (
        <div className="flex lg:hidden overflow-x-auto scrollbar-none border-t border-zinc-900 bg-zinc-950 px-2 py-2.5 space-x-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const disabled = item.requiresReg && !isRegistered;
            const active = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => !disabled && setActiveTab(item.id)}
                disabled={disabled}
                className={`flex-shrink-0 flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-mono text-[10px] font-semibold uppercase tracking-wider transition-all ${
                  active
                    ? "bg-red-950/60 border border-red-900/40 text-red-400"
                    : disabled
                      ? "opacity-30 cursor-not-allowed text-zinc-700"
                      : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}
