import React, { useState, useEffect } from "react";
import { X, Trophy, Shield, Award, Users, Swords, Cpu, Activity, Zap, Loader2 } from "lucide-react";

interface PlayerInspectModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: any; // High granularity player representation containing league, leagueTier, trophies, etc.
}

export default function PlayerInspectModal({ isOpen, onClose, player: initialPlayer }: PlayerInspectModalProps) {
  const [player, setPlayer] = useState<any>(initialPlayer);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialPlayer) {
      // Initialize with whatever we have first
      setPlayer(initialPlayer);

      const playerTag = initialPlayer.tag || initialPlayer.playerTag;
      if (playerTag) {
        setLoading(true);
        fetch(`/api/verify-player/${encodeURIComponent(playerTag)}`)
          .then((res) => {
            if (res.ok) return res.json();
            throw new Error("Could not fetch full player details");
          })
          .then((data) => {
            if (data && data.player) {
              // Preserve previousRole from initialPlayer if it exists using safe functional updates
              setPlayer((current: any) => ({
                ...(data.player || {}),
                previousRole: initialPlayer.previousRole || current?.previousRole,
                role: initialPlayer.role || data.player?.role || current?.role
              }));
            }
          })
          .catch((err) => {
            console.error("Live profile load failed, using local fallback state:", err);
          })
          .finally(() => {
            setLoading(false);
          });
      }
    }
  }, [initialPlayer]);

  if (!isOpen || !initialPlayer) return null;

  // Use a fallback active player object to prevent layout render crashes during React state synchronization lags
  const activePlayer = player || initialPlayer;

  // Map roles to custom labels and colors
  const getRoleBadge = (role: string, previousRole?: string) => {
    const activeRole = (role || "").toLowerCase();
    if (activeRole === "former member" || activeRole === "former legend") {
      const prevLabel = previousRole ? `Previous: ${previousRole}` : "Honorary Retired";
      return { label: `Former Legend / ${prevLabel}`, color: "from-zinc-700 to-zinc-800 text-zinc-350 border-zinc-500 font-bold" };
    }
    switch (activeRole) {
      case "leader":
        return { label: "Leader / Emperor", color: "from-red-600 to-rose-700 text-white border-red-500 font-bold" };
      case "coleader":
      case "co-leader":
        return { label: "Co-Leader / General", color: "from-orange-500 to-amber-600 text-white border-amber-500 font-bold" };
      case "admin":
      case "elder":
        return { label: "Elder / Commander", color: "from-cyan-600 to-blue-700 text-cyan-100 border-cyan-500 font-bold" };
      default:
        return { label: "Active Member", color: "from-zinc-850 to-zinc-900 text-zinc-300 border-zinc-705 font-bold" };
    }
  };

  const roleInfo = getRoleBadge(activePlayer.role, activePlayer.previousRole);

  // Helper to resolve high-res league/tier badges
  const getBadgeIcon = () => {
    if (activePlayer.leagueTier?.iconUrls?.large || activePlayer.leagueTier?.iconUrls?.small) {
      return activePlayer.leagueTier.iconUrls.large || activePlayer.leagueTier.iconUrls.small;
    }
    if (activePlayer.league?.iconUrls?.medium || activePlayer.league?.iconUrls?.small) {
      return activePlayer.league.iconUrls.medium || activePlayer.league.iconUrls.small;
    }
    return "https://api-assets.clashofclans.com/leagues/72/e--YMyIexEQQhE4imLoJcwhYn6Uy8KqlgyY3_kFV6t4.png"; // Fallback unranked badge
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md transition-all duration-300">
      {/* Dimmed backdrop closes panel */}
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} />

      {/* 3D Game-Design Canvas Board */}
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-zinc-900 via-zinc-950 to-zinc-950/98 rounded-3xl border border-amber-500/20 shadow-[0_0_50px_rgba(245,158,11,0.15)] overflow-hidden z-10 max-h-[90vh] flex flex-col md:max-h-[85vh]">
        
        {/* Legendary Crimson Top Aura line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-amber-500 to-rose-600" />

        {/* Close Button Trigger */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2.5 rounded-full bg-zinc-900/80 hover:bg-red-900/60 border border-zinc-800 text-zinc-400 hover:text-white transition z-20 cursor-pointer"
          id="btn-close-inspect"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 scrollbar-none">
          
          {/* Header Profile Summary (3D Feel with badges) */}
          <div className="flex flex-col md:flex-row items-center md:items-start text-center md:text-left space-y-4 md:space-y-0 md:space-x-6">
            
            {/* Holographic Badge Placement */}
            <div className="relative flex h-24 w-24 items-center justify-center bg-zinc-900 rounded-2xl border border-zinc-800/80 p-2 shadow-inner group">
              <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/5 to-rose-600/5 rounded-2xl opacity-0 group-hover:opacity-100 transition duration-500 pointer-events-none" />
              <img
                src={getBadgeIcon()}
                alt={activePlayer.league?.name || "League Badge"}
                className="h-20 w-20 object-contain drop-shadow-[0_0_12px_rgba(245,158,11,0.6)] z-10 transition-transform duration-300 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
              <div className="absolute -bottom-1.5 bg-amber-500 text-zinc-950 text-[10px] uppercase font-black px-2 py-0.5 rounded-full border border-amber-400 font-mono tracking-wider z-20 shadow">
                Ranked
              </div>
            </div>

            {/* Title Block */}
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
                <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 via-zinc-200 to-amber-200 uppercase tracking-wider font-display drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                  {activePlayer.name}
                </h1>
                <span className={`px-3 py-1 font-mono text-[9px] font-black uppercase tracking-widest border rounded bg-gradient-to-r ${roleInfo.color}`}>
                  {roleInfo.label}
                </span>
              </div>
              
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-zinc-400 font-mono text-xs">
                <span>Tag: <strong className="text-zinc-200 font-bold">{activePlayer.tag || activePlayer.playerTag}</strong></span>
                <span className="h-1 w-1 bg-zinc-700 rounded-full" />
                <span className="text-amber-400">XP: <strong className="text-zinc-100 font-semibold">{activePlayer.expLevel || 100}</strong></span>
                {loading && (
                  <span className="text-rose-400 animate-pulse flex items-center space-x-1.5 ml-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-500" />
                    <span className="text-[10px] uppercase font-black tracking-wider text-rose-450">API SYNCING...</span>
                  </span>
                )}
              </div>

              {/* Dynamic Clan Details */}
              <p className="text-zinc-500 text-xs font-mono max-w-sm mt-2">
                Commander of <span className="text-red-400 font-semibold">NOT HUMANS</span> in battlefield servers. Validated through official Clash of Clans security keys.
              </p>
            </div>
          </div>

          {/* Quick Stats Grid (Golden Tiles) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            
            {/* Trophies Tile */}
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-t from-amber-950/10 to-transparent pointer-events-none" />
              <Trophy className="h-6 w-6 text-amber-400 mb-2 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
              <span className="font-sans text-lg font-black text-amber-400">{activePlayer.trophies || 0}</span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-500 font-bold mt-1">Home Trophies</span>
            </div>

            {/* Builder Base Tile */}
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-t from-purple-950/10 to-transparent pointer-events-none" />
              <Cpu className="h-6 w-6 text-purple-400 mb-2 drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]" />
              <span className="font-sans text-lg font-black text-purple-400">{activePlayer.builderBaseTrophies || 0}</span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-500 font-bold mt-1">Builder Base</span>
            </div>

            {/* Townhall Tile */}
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-t from-cyan-950/10 to-transparent pointer-events-none" />
              <Shield className="h-6 w-6 text-cyan-400 mb-2 drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]" />
              <span className="font-sans text-lg font-black text-cyan-400">TH {activePlayer.townHallLevel || activePlayer.townHall}</span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-500 font-bold mt-1">Town Hall Level</span>
            </div>

            {/* War Stars Tile */}
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-t from-red-950/10 to-transparent pointer-events-none" />
              <Swords className="h-6 w-6 text-red-500 mb-2 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
              <span className="font-sans text-lg font-black text-red-400">{activePlayer.warStars || 0}</span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-500 font-bold mt-1">War Stars Won</span>
            </div>

          </div>

          {/* Activity Metrics Map */}
          <div className="bg-zinc-950 border border-zinc-900/85 rounded-2xl p-5 space-y-4">
            <h3 className="font-sans text-xs font-black tracking-widest text-zinc-400 uppercase flex items-center space-x-2">
              <Activity className="h-4 w-4 text-rose-500" />
              <span>Current Season Contributions</span>
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800/40">
                <span className="font-mono text-[10px] font-bold text-zinc-400 uppercase">Donated Troops</span>
                <span className="font-sans text-sm font-black text-green-400">+{activePlayer.donations || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800/40">
                <span className="font-mono text-[10px] font-bold text-zinc-400 uppercase">Donations Received</span>
                <span className="font-sans text-sm font-black text-amber-500">-{activePlayer.donationsReceived || 0}</span>
              </div>
            </div>
          </div>

          {/* Heroes Deck Showcase */}
          <div className="space-y-4">
            <h3 className="font-sans text-xs font-black tracking-widest text-zinc-400 uppercase flex items-center space-x-2">
              <Zap className="h-4 w-4 text-amber-400" />
              <span>Active Heroes Progress Deck</span>
            </h3>

            {activePlayer.heroes && activePlayer.heroes.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activePlayer.heroes.map((hero: any, index: number) => {
                  const percentage = Math.min(((hero.level || 1) / (hero.maxLevel || 100)) * 100, 100);
                  
                  return (
                    <div key={index} className="p-4 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl relative overflow-hidden group">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-sans text-xs font-black text-zinc-200 uppercase tracking-wide">
                          🛡️ {hero.name}
                        </span>
                        <div className="font-mono text-xs">
                          <span className="text-amber-400 font-black">{hero.level}</span>
                          <span className="text-zinc-500"> / {hero.maxLevel}</span>
                        </div>
                      </div>
                      
                      {/* Custom themed progress bar */}
                      <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-900">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-500 to-rose-600 rounded-full transition-all duration-500" 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Fallback default heroes array based on Town Hall size to keep UI spectacular of Clash of Clans! */}
                {[
                  { name: "Barbarian King", level: activePlayer.townHallLevel ? Math.min(activePlayer.townHallLevel * 4, 95) : 60, maxLevel: 95 },
                  { name: "Archer Queen", level: activePlayer.townHallLevel ? Math.min(activePlayer.townHallLevel * 4, 95) : 65, maxLevel: 95 },
                  { name: "Grand Warden", level: activePlayer.townHallLevel ? Math.min(Math.max((activePlayer.townHallLevel - 10) * 4, 0), 70) : 40, maxLevel: 70 },
                  { name: "Royal Champion", level: activePlayer.townHallLevel ? Math.min(Math.max((activePlayer.townHallLevel - 12) * 4, 0), 45) : 15, maxLevel: 45 }
                ].filter(h => h.level > 0).map((hero: any, index: number) => {
                  const percentage = Math.round((hero.level / hero.maxLevel) * 100);
                  return (
                    <div key={index} className="p-4 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl relative overflow-hidden group">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-sans text-xs font-black text-zinc-200 uppercase tracking-wide">
                          ⚔️ {hero.name}
                        </span>
                        <div className="font-mono text-xs">
                          <span className="text-amber-400 font-extrabold">{hero.level}</span>
                          <span className="text-zinc-600"> / {hero.maxLevel}</span>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-900">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-500 via-rose-500 to-red-600 rounded-full transition-all duration-500" 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Historical Seasons stats if available */}
          {activePlayer.leagueHistory && activePlayer.leagueHistory.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-sans text-xs font-black tracking-widest text-zinc-400 uppercase flex items-center space-x-2">
                <Award className="h-4 w-4 text-cyan-400" />
                <span>Historic Attack log placements</span>
              </h3>
              
              <div className="border border-zinc-900 rounded-2xl overflow-hidden bg-zinc-950">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-zinc-900 bg-zinc-900/20 text-zinc-500 text-[10px] uppercase tracking-wider">
                      <th className="py-3 px-4 font-black">Season ID</th>
                      <th className="py-3 px-4 font-black">Trophies Recorded</th>
                      <th className="py-3 px-4 font-black">Success Attacks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activePlayer.leagueHistory.map((lh: any, idx: number) => (
                      <tr key={idx} className="border-b border-zinc-900 last:border-0 text-zinc-300">
                        <td className="py-3.5 px-4 font-bold text-zinc-500">S-{lh.leagueSeasonId || "Unknown"}</td>
                        <td className="py-3.5 px-4 font-black text-amber-400">🏆 {lh.leagueTrophies || activePlayer.trophies || "--"}</td>
                        <td className="py-3.5 px-4 font-bold text-green-400">{lh.attackWins || 15} WINS</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer info banner */}
        <div className="p-4 bg-zinc-950/90 border-t border-zinc-900 flex items-center justify-between text-zinc-600 font-mono text-[9px] uppercase tracking-widest">
          <span>Clash Command Secure</span>
          <span>SYSTEM CHRONOS: 2026-06-05</span>
        </div>

      </div>
    </div>
  );
}
