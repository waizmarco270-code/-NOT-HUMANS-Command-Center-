import React, { useState } from "react";
import { Member, Hero } from "../types";
import { Trophy, Star, Shield, Award, Edit3, Save, UserCheck, RefreshCw, Layers } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";

interface LeagueInfo {
  name: string;
  icon: string;
  color: string;
  glowColor: string;
  bgGradient: string;
}

const getCustomLeague = (townHall: number): LeagueInfo => {
  const level = townHall || 15;
  if (level <= 7) {
    return {
      name: "Skeleton League 1",
      icon: "https://static.wikia.nocookie.net/clashofclans/images/2/23/Skeleton_info.png/revision/latest",
      color: "text-amber-500",
      glowColor: "rgba(245,158,11,0.3)",
      bgGradient: "from-zinc-950 via-zinc-950 to-amber-950/10 border-amber-600/30 hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]"
    };
  }
  if (level === 8) {
    return {
      name: "Skeleton League 2",
      icon: "https://static.wikia.nocookie.net/clashofclans/images/2/23/Skeleton_info.png/revision/latest",
      color: "text-amber-500",
      glowColor: "rgba(245,158,11,0.3)",
      bgGradient: "from-zinc-950 via-zinc-950 to-amber-950/10 border-amber-600/30 hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]"
    };
  }
  if (level === 9) {
    return {
      name: "Skeleton League 3",
      icon: "https://static.wikia.nocookie.net/clashofclans/images/2/23/Skeleton_info.png/revision/latest",
      color: "text-amber-500",
      glowColor: "rgba(245,158,11,0.3)",
      bgGradient: "from-zinc-950 via-zinc-950 to-amber-950/10 border-amber-600/30 hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]"
    };
  }
  if (level === 10) {
    return {
      name: "Barbarian League 4",
      icon: "https://static.wikia.nocookie.net/clashofclans/images/1/11/Barbarian_info.png/revision/latest",
      color: "text-amber-600",
      glowColor: "rgba(217,119,6,0.3)",
      bgGradient: "from-zinc-950 via-zinc-950 to-amber-950/15 border-amber-700/30 hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(217,119,6,0.15)]"
    };
  }
  if (level === 11) {
    return {
      name: "Barbarian League 6",
      icon: "https://static.wikia.nocookie.net/clashofclans/images/1/11/Barbarian_info.png/revision/latest",
      color: "text-amber-600",
      glowColor: "rgba(217,119,6,0.3)",
      bgGradient: "from-zinc-950 via-zinc-950 to-amber-950/15 border-amber-700/30 hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(217,119,6,0.15)]"
    };
  }
  if (level === 12) {
    return {
      name: "Archer League 8",
      icon: "https://static.wikia.nocookie.net/clashofclans/images/6/68/Archer_info.png/revision/latest",
      color: "text-rose-400",
      glowColor: "rgba(244,63,94,0.3)",
      bgGradient: "from-zinc-950 via-zinc-950 to-rose-950/20 border-rose-500/30 hover:border-rose-500/50 hover:shadow-[0_0_20px_rgba(244,63,94,0.15)]"
    };
  }
  if (level === 13) {
    return {
      name: "Wizard League 11",
      icon: "https://static.wikia.nocookie.net/clashofclans/images/1/15/Wizard_info.png/revision/latest",
      color: "text-sky-400",
      glowColor: "rgba(14,165,233,0.3)",
      bgGradient: "from-zinc-950 via-zinc-950 to-sky-950/20 border-sky-500/30 hover:border-sky-500/50 hover:shadow-[0_0_20px_rgba(14,165,233,0.15)]"
    };
  }
  if (level === 14) {
    return {
      name: "Valkyrie League 14",
      icon: "https://static.wikia.nocookie.net/clashofclans/images/8/87/Valkyrie_info.png/revision/latest",
      color: "text-orange-400",
      glowColor: "rgba(249,115,22,0.3)",
      bgGradient: "from-zinc-950 via-zinc-950 to-orange-950/20 border-orange-500/35 hover:border-orange-500/50 hover:shadow-[0_0_20px_rgba(249,115,22,0.15)]"
    };
  }
  if (level === 15) {
    return {
      name: "Witch League 17",
      icon: "https://static.wikia.nocookie.net/clashofclans/images/a/a2/Witch_info.png/revision/latest",
      color: "text-purple-400",
      glowColor: "rgba(168,85,247,0.35)",
      bgGradient: "from-zinc-950 via-zinc-950 to-purple-950/25 border-purple-500/30 hover:border-purple-500/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]"
    };
  }
  if (level === 16) {
    return {
      name: "Golem League 21",
      icon: "https://static.wikia.nocookie.net/clashofclans/images/c/ca/Golem_info.png/revision/latest",
      color: "text-zinc-300",
      glowColor: "rgba(161,161,170,0.3)",
      bgGradient: "from-zinc-950 via-zinc-950 to-zinc-900 border-zinc-700/40 hover:border-zinc-500/50 hover:shadow-[0_0_20px_rgba(161,161,170,0.15)]"
    };
  }
  return {
    name: "Electro Titan League 25",
    icon: "https://static.wikia.nocookie.net/clashofclans/images/7/7b/Electro_Titan_info.png/revision/latest",
    color: "text-cyan-400",
    glowColor: "rgba(6,182,212,0.35)",
    bgGradient: "from-zinc-950 via-zinc-950 to-cyan-950/25 border-cyan-500/30 hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]"
  };
};

const getRankFromTier = (tierId: number): LeagueInfo => {
  const tier = tierId % 100;
  if (tier <= 3) {
    return {
      name: `Skeleton League ${tier}`,
      icon: "https://static.wikia.nocookie.net/clashofclans/images/2/23/Skeleton_info.png/revision/latest",
      color: "text-amber-500",
      glowColor: "rgba(245,158,11,0.3)",
      bgGradient: "from-zinc-950 via-zinc-950 to-amber-950/10 border-amber-600/30 hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]"
    };
  }
  if (tier >= 4 && tier <= 7) {
    return {
      name: `Barbarian League ${tier}`,
      icon: "https://static.wikia.nocookie.net/clashofclans/images/1/11/Barbarian_info.png/revision/latest",
      color: "text-amber-600",
      glowColor: "rgba(217,119,6,0.3)",
      bgGradient: "from-zinc-950 via-zinc-950 to-amber-950/15 border-amber-700/30 hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(217,119,6,0.15)]"
    };
  }
  if (tier >= 8 && tier <= 10) {
    return {
      name: `Archer League ${tier}`,
      icon: "https://static.wikia.nocookie.net/clashofclans/images/6/68/Archer_info.png/revision/latest",
      color: "text-rose-400",
      glowColor: "rgba(244,63,94,0.3)",
      bgGradient: "from-zinc-950 via-zinc-950 to-rose-950/20 border-rose-500/30 hover:border-rose-500/50 hover:shadow-[0_0_20px_rgba(244,63,94,0.15)]"
    };
  }
  if (tier >= 11 && tier <= 13) {
    return {
      name: `Wizard League ${tier}`,
      icon: "https://static.wikia.nocookie.net/clashofclans/images/1/15/Wizard_info.png/revision/latest",
      color: "text-sky-400",
      glowColor: "rgba(14,165,233,0.3)",
      bgGradient: "from-zinc-950 via-zinc-950 to-sky-950/20 border-sky-500/30 hover:border-sky-500/50 hover:shadow-[0_0_20px_rgba(14,165,233,0.15)]"
    };
  }
  if (tier === 14 || tier === 15) {
    return {
      name: `Valkyrie League ${tier}`,
      icon: "https://static.wikia.nocookie.net/clashofclans/images/8/87/Valkyrie_info.png/revision/latest",
      color: "text-orange-400",
      glowColor: "rgba(249,115,22,0.3)",
      bgGradient: "from-zinc-950 via-zinc-950 to-orange-950/20 border-orange-500/35 hover:border-orange-500/50 hover:shadow-[0_0_20px_rgba(249,115,22,0.15)]"
    };
  }
  if (tier === 16) {
    return {
      name: `Pekka League ${tier}`,
      icon: "https://static.wikia.nocookie.net/clashofclans/images/c/c3/P.E.K.K.A_info.png/revision/latest",
      color: "text-indigo-400",
      glowColor: "rgba(99,102,241,0.35)",
      bgGradient: "from-zinc-950 via-zinc-950 to-indigo-950/25 border-indigo-500/30 hover:border-indigo-500/50 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)]"
    };
  }
  if (tier >= 17 && tier <= 20) {
    return {
      name: `Witch League ${tier}`,
      icon: "https://static.wikia.nocookie.net/clashofclans/images/a/a2/Witch_info.png/revision/latest",
      color: "text-purple-400",
      glowColor: "rgba(168,85,247,0.35)",
      bgGradient: "from-zinc-950 via-zinc-950 to-purple-950/25 border-purple-500/30 hover:border-purple-500/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]"
    };
  }
  if (tier >= 21 && tier <= 24) {
    return {
      name: `Golem League ${tier}`,
      icon: "https://static.wikia.nocookie.net/clashofclans/images/c/ca/Golem_info.png/revision/latest",
      color: "text-zinc-300",
      glowColor: "rgba(161,161,170,0.3)",
      bgGradient: "from-zinc-950 via-zinc-950 to-zinc-900 border-zinc-700/40 hover:border-zinc-500/50 hover:shadow-[0_0_20px_rgba(161,161,170,0.15)]"
    };
  }
  return {
    name: `Electro Titan League ${tier}`,
    icon: "https://static.wikia.nocookie.net/clashofclans/images/7/7b/Electro_Titan_info.png/revision/latest",
    color: "text-cyan-400",
    glowColor: "rgba(6,182,212,0.35)",
    bgGradient: "from-zinc-950 via-zinc-950 to-cyan-950/25 border-cyan-500/30 hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]"
  };
};

interface MemberProfileProps {
  member: Member;
  playerData: any; // Dynamic details loaded from API fallback
  onRefresh: () => void;
  onUpdateMember?: (updated: Member) => void;
}

export default function MemberProfile({ member, playerData, onRefresh, onUpdateMember }: MemberProfileProps) {
  const [specialty, setSpecialty] = useState(member.specialty || "QC Hybrid Specialist");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const profileImgInputRef = React.useRef<HTMLInputElement>(null);

  // Optimized canvas compressor to keep standard base64 strings small (sub 40KB) for Firebase Spark standard documents
  const compressAndGetBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 250; // Ultra compact size for optimized performance
          const MAX_HEIGHT = 250;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL("image/jpeg", 0.75);
            resolve(compressedBase64);
          } else {
            resolve(event.target?.result as string);
          }
        };
        img.onerror = (err) => {
          reject(err);
        };
      };
      reader.onerror = (err) => {
        reject(err);
      };
    });
  };

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const compressedStr = await compressAndGetBase64(file);
      // Save to Firebase firestore under members collection
      await updateDoc(doc(db, "members", member.uid), {
        photoUrl: compressedStr,
        updatedAt: new Date().toISOString()
      });
      // Trigger parent callback to let main App state synchronize
      if (onUpdateMember) {
        onUpdateMember({
          ...member,
          photoUrl: compressedStr
        });
      }
      alert("Comrade, custom battle logo saved successfully to Command Center database!");
    } catch (err) {
      console.error("Photo upload failed:", err);
      alert("Master, there was an issue processing and compressing your tactical profile photo.");
    } finally {
      setUploading(false);
    }
  };

  const specialties = [
    "QC Hybrid Specialist",
    "Hydra Specialist",
    "Lalo Specialist",
    "Root Rider Specialist",
    "Dragons Specialist",
    "Smash Attacks Specialist"
  ];

  const handleSaveSpecialty = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "members", member.uid), {
        specialty,
        updatedAt: new Date().toISOString()
      });
      setEditing(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `members/${member.uid}`);
    } finally {
      setSaving(false);
    }
  };

  const heroes: Hero[] = playerData?.heroes || [
    { name: "Barbarian King", level: 90, maxLevel: 95 },
    { name: "Archer Queen", level: 92, maxLevel: 95 },
    { name: "Grand Warden", level: 68, maxLevel: 70 },
    { name: "Royal Champion", level: 41, maxLevel: 45 }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
      
      {/* Left Bento: Main Identity Card */}
      <div className={`lg:col-span-1 rounded-lg p-5 shadow-2xl relative overflow-hidden flex flex-col justify-between transition-all duration-500 ${
        member.playerTag?.toUpperCase().trim() === "#PV9GPQPUC"
          ? "border-2 border-amber-400 bg-zinc-950/90 shadow-[0_0_30px_rgba(245,158,11,0.25)] ring-1 ring-purple-500/20"
          : "border border-red-950/30 bg-zinc-950/80"
      }`}>
        
        {/* Esports background visual overlay */}
        {member.playerTag?.toUpperCase().trim() === "#PV9GPQPUC" ? (
          <div className="absolute top-0 right-0 h-32 w-32 bg-gradient-to-br from-amber-500/15 via-purple-500/5 to-transparent rounded-full filter blur-xl pointer-events-none animate-pulse" />
        ) : (
          <div className="absolute top-0 right-0 h-32 w-32 bg-gradient-to-br from-red-600/5 to-transparent rounded-full filter blur-xl pointer-events-none" />
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className={`px-2.5 py-0.5 rounded text-[10px] uppercase font-mono font-black border ${
              member.playerTag?.toUpperCase().trim() === "#PV9GPQPUC"
                ? "bg-amber-950/60 border-amber-500/50 text-amber-400 font-extrabold shadow-[0_0_8px_rgba(245,158,11,0.4)] animate-pulse"
                : member.status === "Active"
                  ? "bg-red-950/50 border-red-900/40 text-red-500"
                  : "bg-zinc-900 border-zinc-800 text-zinc-500"
            }`}>
              {member.playerTag?.toUpperCase().trim() === "#PV9GPQPUC" ? "⚜️ Supreme Overlord ⚜️" : member.status}
            </span>

            <button
              onClick={onRefresh}
              className="p-1 px-1.5 rounded bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 text-zinc-400 transition"
              title="Refresh profile state"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
 
          {/* Profile Identity Details with Logo upload option */}
          <div className="flex items-center space-x-4 border-b border-zinc-900/50 pb-4">
            {/* Logo picture section */}
            <div className="relative group/avatar cursor-pointer shrink-0">
              <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-zinc-800 bg-zinc-900 flex items-center justify-center relative shadow-inner">
                {member.photoUrl ? (
                  <img
                    src={member.photoUrl}
                    alt={`${member.playerName} Custom Battle Logo`}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-lg font-black font-mono text-zinc-500">
                    {member.playerName?.substring(0, 2).toUpperCase() || "CH"}
                  </span>
                )}
                {uploading && (
                  <div className="absolute inset-x-0 bottom-0 bg-black/80 flex items-center justify-center py-1">
                    <span className="text-[7.5px] text-white font-mono animate-pulse">OPTIMIZING</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => profileImgInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 bg-rose-600 hover:bg-rose-500 text-white rounded-full p-1.5 shadow-md border border-zinc-900 scale-90 transition hover:scale-100 cursor-pointer active:scale-95"
                title="Upload custom logo"
              >
                <Edit3 className="h-3 w-3" />
              </button>
              <input
                type="file"
                ref={profileImgInputRef}
                accept="image/*"
                onChange={handleProfilePhotoUpload}
                className="hidden"
              />
            </div>

            <div>
              {member.playerTag?.toUpperCase().trim() === "#PV9GPQPUC" ? (
                <div>
                  <span className="block font-sans text-xl font-black uppercase tracking-wide bg-gradient-to-r from-amber-400 via-fuchsia-400 to-amber-300 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(245,158,11,0.5)] animate-pulse">
                    👑 {member.playerName} 👑
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-amber-500 block font-bold mt-1">
                    SUPREME COMMANDER-IN-CHIEF
                  </span>
                </div>
              ) : (
                <span className="block font-sans text-lg font-black uppercase tracking-wide text-zinc-100">
                  {member.playerName}
                </span>
              )}
              <span className="block font-mono text-[10px] text-zinc-500 mt-1">
                Player Tag: <strong className={member.playerTag?.toUpperCase().trim() === "#PV9GPQPUC" ? "text-amber-400" : "text-zinc-500"}>{member.playerTag}</strong>
              </span>
            </div>
          </div>
 
          <div className="pt-2 border-t border-zinc-900 flex items-center justify-between">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">Website Role</p>
              {member.playerTag?.toUpperCase().trim() === "#PV9GPQPUC" ? (
                <p className="font-sans text-xs font-black text-amber-400 uppercase mt-0.5 flex items-center space-x-1.5 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]">
                  <Shield className="h-3.5 w-3.5 text-amber-300 animate-spin" />
                  <span className="bg-gradient-to-r from-amber-400 to-amber-300 bg-clip-text text-transparent">Supreme Leader</span>
                </p>
              ) : (
                <p className="font-sans text-xs font-black text-red-400 uppercase mt-0.5 flex items-center space-x-1">
                  <Shield className="h-3.5 w-3.5" />
                  <span>{member.role}</span>
                </p>
              )}
            </div>

            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">Town Hall</p>
              <p className="font-sans text-xs font-black text-zinc-200 uppercase mt-0.5">
                Town Hall {member.townHall}
              </p>
            </div>
          </div>

          {/* Specialty Setting component */}
          <div className="pt-3 border-t border-zinc-900">
            <span className="block font-mono text-[10px] uppercase text-zinc-500 tracking-wider mb-2">Combat Specialization</span>
            {editing ? (
              <div className="flex items-center space-x-2">
                <select
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 outline-none w-full"
                >
                  {specialties.map(spec => (
                    <option key={spec} value={spec}>{spec}</option>
                  ))}
                </select>
                <button
                  onClick={handleSaveSpecialty}
                  disabled={saving}
                  className="p-2 bg-red-600 rounded text-white hover:bg-red-500 transition"
                >
                  <Save className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-zinc-900/40 p-2.5 rounded border border-zinc-850">
                <span className="font-sans text-xs font-semibold text-amber-500 uppercase">{specialty}</span>
                <button
                  onClick={() => setEditing(true)}
                  className="text-zinc-500 hover:text-zinc-300 transition"
                  title="Modify combat role"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Member history footprint */}
        <div className="mt-8 pt-4 border-t border-zinc-900 font-mono text-[9px] text-zinc-500 uppercase">
          Synced with Headquarters: {member.joinedAt ? new Date(member.joinedAt).toLocaleString() : "Date Active"}
        </div>
      </div>

      {/* Right Bento: Trophies, War Stars, and Veteran Accomplishments */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Statistics highlights box */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* Custom Town Hall League Status Card */}
          {(() => {
            const currentTH = playerData?.townHallLevel || member.townHall || 15;
            
            // Check if we have active real-time league history items
            const getActiveRank = () => {
              const history = playerData?.leagueHistory;
              if (Array.isArray(history) && history.length > 0) {
                // Sort descending so the largest season ID comes first
                const sorted = [...history].sort((a: any, b: any) => b.leagueSeasonId - a.leagueSeasonId);
                const latestSeason = sorted[0];
                if (latestSeason && latestSeason.leagueTierId !== undefined) {
                  return {
                    ...getRankFromTier(latestSeason.leagueTierId),
                    isLive: true,
                    seasonDetails: latestSeason
                  };
                }
              }
              return {
                ...getCustomLeague(currentTH),
                isLive: false,
                seasonDetails: null
              };
            };

            const activeRank = getActiveRank();

            return (
              <div className={`rounded-xl bg-gradient-to-br ${activeRank.bgGradient} p-5 flex flex-col justify-between shadow-2xl relative overflow-hidden transition-all duration-300`}>
                <div className="absolute -top-10 -right-10 h-24 w-24 bg-white/5 rounded-full filter blur-xl pointer-events-none" />
                
                <div className="flex items-center justify-between mb-4">
                  <span className={`font-mono text-[9px] uppercase tracking-widest ${activeRank.color} font-extrabold flex items-center space-x-1`}>
                    <span>Clan Rank System</span>
                    {activeRank.isLive && (
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-ping inline-block ml-1" />
                    )}
                  </span>
                  <Award className={`h-4.5 w-4.5 ${activeRank.color}`} />
                </div>

                <div className="flex items-center space-x-3.5 my-1">
                  <img 
                    src={activeRank.icon} 
                    alt={`${activeRank.name} Emblem`}
                    className="h-14 w-14 object-contain animate-bounce z-10"
                    style={{ filter: `drop-shadow(0 4px 12px ${activeRank.glowColor})` }}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      // Fallback badge if Wiki hotlink blocks referrer
                      e.currentTarget.src = "https://api-assets.clashofclans.com/leagues/72/R2zmhyv6vI-8vvSj94657E7byJuY0ba9YgBQ7gHg.png";
                    }}
                  />
                  <div>
                    <span className="block font-sans text-xs font-black text-zinc-400 uppercase tracking-wide">
                      {activeRank.isLive ? "Live API Rank" : "Current Rank"}
                    </span>
                    <span className={`block font-sans text-base font-black ${activeRank.color} uppercase tracking-tighter drop-shadow-md leading-none mt-1`}>
                      {activeRank.name}
                    </span>
                  </div>
                </div>

                <div className={`mt-4 pt-3 border-t border-zinc-900/60 font-mono text-[9px] ${activeRank.color} font-black uppercase tracking-wider flex justify-between`}>
                  <span>Town Hall {currentTH}</span>
                  {activeRank.isLive && activeRank.seasonDetails ? (
                    <span className="text-zinc-400">Wins: {activeRank.seasonDetails.attackWins} | Trophies: {activeRank.seasonDetails.leagueTrophies}</span>
                  ) : (
                    <span>Offline Fallback</span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Current Trophies Card */}
          <div className="rounded-xl bg-gradient-to-br from-zinc-950 via-zinc-950 to-sky-950/10 border border-sky-500/30 p-5 flex flex-col justify-between shadow-2xl relative overflow-hidden transition-all duration-300 hover:border-sky-500/50 hover:shadow-[0_0_20px_rgba(14,165,233,0.12)]">
            <div className="absolute -top-10 -right-10 h-24 w-24 bg-sky-500/5 rounded-full filter blur-xl pointer-events-none" />

            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-[9px] uppercase tracking-widest text-sky-400 font-extrabold font-black">Trophies Log</span>
              <Trophy className="h-4.5 w-4.5 text-sky-400" />
            </div>

            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-500 leading-none">Current Trophies</p>
              <p className="font-sans text-3xl font-black text-zinc-100 tracking-tight mt-1 flex items-baseline space-x-1">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-200">
                  {playerData?.trophies !== undefined ? playerData.trophies : member.trophies}
                </span>
                <span className="text-sm font-semibold text-sky-400 ml-1">🏆</span>
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-900/60 flex items-center justify-between font-mono text-[9.5px]">
              <span className="text-zinc-500 uppercase">All-Time Best:</span>
              <span className="text-indigo-300 font-extrabold uppercase">
                {playerData?.bestTrophies !== undefined ? playerData.bestTrophies : (member.trophies + 175)} 🏆
              </span>
            </div>
          </div>

          {/* War Stars Veteran Card */}
          <div className="rounded-xl bg-gradient-to-br from-zinc-950 via-zinc-950 to-rose-950/15 border border-rose-500/30 p-5 flex flex-col justify-between shadow-2xl relative overflow-hidden transition-all duration-300 hover:border-rose-500/50 hover:shadow-[0_0_20px_rgba(244,63,94,0.12)]">
            <div className="absolute -top-10 -right-10 h-24 w-24 bg-rose-500/5 rounded-full filter blur-xl pointer-events-none" />

            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-[9px] uppercase tracking-widest text-rose-500 font-extrabold">War Room Records</span>
              <Star className="h-4.5 w-4.5 text-rose-500 animate-pulse" />
            </div>

            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-500 leading-none">War Stars Count</p>
              <p className="font-sans text-3xl font-black text-zinc-100 tracking-tight mt-1 flex items-baseline space-x-1">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-amber-200">
                  {playerData?.warStars !== undefined ? playerData.warStars : member.warStars}
                </span>
                <span className="text-sm font-semibold text-rose-500 ml-1">⭐</span>
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-900/60 flex items-center justify-between font-mono text-[9.5px]">
              <span className="text-zinc-500 uppercase">Original Status:</span>
              <span className="text-rose-400 font-black uppercase tracking-wider">War Veteran 🔥</span>
            </div>
          </div>
        </div>

        {/* Heroes levels status grids */}
        <div className="rounded-lg border border-zinc-900 bg-zinc-950/80 p-5 shadow-xl">
          <div className="flex items-center space-x-2 border-b border-zinc-900 pb-3 mb-4">
            <Award className="h-4.5 w-4.5 text-red-500" />
            <h3 className="font-sans text-xs font-black uppercase tracking-widest text-zinc-300">
              Esports Hero Array
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {heroes.map((hero) => {
              const currentLevel = hero.level;
              const maxLevel = hero.maxLevel;
              const percentage = Math.min(100, (currentLevel / maxLevel) * 100);

              return (
                <div key={hero.name} className="bg-zinc-900/40 p-3.5 rounded border border-zinc-850/60">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="font-sans text-xs font-bold text-zinc-200 uppercase">{hero.name}</span>
                    <span className="font-mono text-[11px] font-black text-red-400">
                      Lvl {currentLevel} <span className="text-zinc-500">/ {maxLevel}</span>
                    </span>
                  </div>

                  {/* Level progress bar display */}
                  <div className="h-1.5 w-full bg-zinc-400/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-red-600 to-rose-500 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
