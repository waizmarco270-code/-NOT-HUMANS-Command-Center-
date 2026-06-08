import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { HistoryMilestone, CoCRole } from "../types";
import { 
  Landmark, Trophy, Shield, Calendar, Plus, Trash2, Send, 
  Search, Sparkles, Flame, Coins, Users, Map, Clock 
} from "lucide-react";

interface HistorySectionProps {
  cocRole: CoCRole | null;
}

export default function HistorySection({ cocRole }: HistorySectionProps) {
  const [milestones, setMilestones] = useState<HistoryMilestone[]>([]);
  const [loading, setLoading] = useState(true);

  // Sub-tabs
  const [subTab, setSubTab] = useState<"milestones" | "wars" | "capital" | "search">("milestones");

  // Dynamic API state
  const [warHistory, setWarHistory] = useState<any[]>([]);
  const [loadingWar, setLoadingWar] = useState(false);

  const [raidHistory, setRaidHistory] = useState<any[]>([]);
  const [loadingRaid, setLoadingRaid] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Form states to create milestone
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"war" | "milestone">("milestone");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [date, setDate] = useState("");

  // Shared Custom Alert & Confirmation dialog configuration so we avoid broken window.confirm inside sandboxed iFrames
  const [modalDialog, setModalDialog] = useState<{
    type: "confirm" | "alert";
    title: string;
    message: string;
    onLeftBtn?: () => void;
    onRightBtn?: () => void;
    leftBtnText?: string;
    rightBtnText?: string;
  } | null>(null);

  const triggerConfirm = (title: string, message: string, onConfirm: () => void) => {
    setModalDialog({
      type: "confirm",
      title,
      message,
      onRightBtn: onConfirm,
      rightBtnText: "Confirm",
      leftBtnText: "Cancel"
    });
  };

  const triggerAlert = (title: string, message: string) => {
    setModalDialog({
      type: "alert",
      title,
      message,
      leftBtnText: "Understood"
    });
  };

  const isLeaderOrCo = cocRole === "Leader" || cocRole === "Co-Leader";

  // 1. Sync custom milestones from Firestore
  useEffect(() => {
    const q = query(collection(db, "history"), orderBy("date", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: HistoryMilestone[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          title: data.title || "",
          type: data.type || "milestone",
          description: data.description || "",
          imageUrl: data.imageUrl || "",
          date: data.date || "Unknown",
          createdAt: data.createdAt
        });
      });
      setMilestones(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "history");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Fetch WarLog dynamically
  const fetchWarHistory = async () => {
    setLoadingWar(true);
    try {
      const res = await fetch("/api/clan/warlog");
      if (res.ok) {
        const data = await res.json();
        setWarHistory(data.items || []);
      }
    } catch (e) {
      console.error("Failed to load war history.", e);
    } finally {
      setLoadingWar(false);
    }
  };

  // 3. Fetch Capital raids
  const fetchRaidHistory = async () => {
    setLoadingRaid(true);
    try {
      const res = await fetch("/api/clan/capitalraidseasons");
      if (res.ok) {
        const data = await res.json();
        setRaidHistory(data.items || []);
      }
    } catch (e) {
      console.error("Failed to load capital raids.", e);
    } finally {
      setLoadingRaid(false);
    }
  };

  // Trigger on sub-tab switch
  useEffect(() => {
    if (subTab === "wars") {
      fetchWarHistory();
    } else if (subTab === "capital") {
      fetchRaidHistory();
    }
  }, [subTab]);

  // 4. Search Clans API
  const handleSearchClans = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/clans?name=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.items || []);
      }
    } catch (e) {
      console.error("Error searching in-game clans:", e);
    } finally {
      setSearching(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !date) return;

    try {
      await addDoc(collection(db, "history"), {
        title: title.trim(),
        type,
        description: description.trim(),
        imageUrl: imageUrl.trim() || null,
        date,
        createdAt: serverTimestamp()
      });

      setTitle("");
      setType("milestone");
      setDescription("");
      setImageUrl("");
      setDate("");
      setShowForm(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "history");
    }
  };

  const handleDelete = async (id: string) => {
    triggerConfirm(
      "CONFIRM HISTORY RECORD DELETION",
      "Are you absolutely certain you want to delete this historic achievement milestone card?",
      async () => {
        try {
          await deleteDoc(doc(db, "history", id));
          triggerAlert("ARCHIVE RECORD REMOVED", "Success: Historic record has been deleted successfully.");
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          triggerAlert("DELETE ERROR", `Deletion failed!\n\nError: ${errMsg}`);
          handleFirestoreError(err, OperationType.DELETE, `history/${id}`);
        }
      }
    );
  };

  // Format YYYYMMDDTHHMMSS.000Z CoC standard datetime
  const formatCocDate = (rawStr: string) => {
    if (!rawStr || rawStr.length < 8) return rawStr;
    const yyyy = rawStr.substring(0, 4);
    const mm = rawStr.substring(4, 6);
    const dd = rawStr.substring(6, 8);
    return `${yyyy}-${mm}-${dd}`;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      
      {/* Brand Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-rose-950/30 pb-4">
        <div className="flex items-center space-x-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded bg-red-955/40 border border-red-800/40 text-red-500 shadow shadow-red-950/50">
            <Landmark className="h-5.5 w-5.5" />
          </div>
          <div>
            <h2 className="font-sans text-xl font-black uppercase tracking-wider text-zinc-100">
              CLAN CHRONICLES & DATA ARCHIVE
            </h2>
            <p className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">
              Explore dynamic in-game datasets: war histories, capital raid program seasons, and the global in-game clan search engine.
            </p>
          </div>
        </div>

        {isLeaderOrCo && subTab === "milestones" && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center justify-center space-x-2 rounded bg-gradient-to-r from-red-700 to-rose-700 hover:from-red-600 hover:to-rose-600 px-4 py-2 font-mono text-xs font-black uppercase text-white transition"
          >
            <Plus className="h-4 w-4" />
            <span>Record Milestone</span>
          </button>
        )}
      </div>

      {/* Sub tabs orchestration bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-900 pb-2">
        <button
          onClick={() => setSubTab("milestones")}
          className={`px-3 py-1.5 rounded text-xs font-mono font-bold uppercase transition flex items-center space-x-1.5 ${
            subTab === "milestones"
              ? "bg-red-650 text-white shadow shadow-red-500/20"
              : "bg-zinc-950 border border-zinc-900 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Local Milestones</span>
        </button>

        <button
          onClick={() => setSubTab("wars")}
          className={`px-3 py-1.5 rounded text-xs font-mono font-bold uppercase transition flex items-center space-x-1.5 ${
            subTab === "wars"
              ? "bg-red-650 text-white shadow shadow-red-500/20"
              : "bg-zinc-950 border border-zinc-900 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Trophy className="h-3.5 w-3.5" />
          <span>In-Game War Logs</span>
        </button>

        <button
          onClick={() => setSubTab("capital")}
          className={`px-3 py-1.5 rounded text-xs font-mono font-bold uppercase transition flex items-center space-x-1.5 ${
            subTab === "capital"
              ? "bg-red-650 text-white shadow shadow-red-500/20"
              : "bg-zinc-950 border border-zinc-900 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Map className="h-3.5 w-3.5" />
          <span>Capital Raids</span>
        </button>

        <button
          onClick={() => setSubTab("search")}
          className={`px-3 py-1.5 rounded text-xs font-mono font-bold uppercase transition flex items-center space-x-1.5 ${
            subTab === "search"
              ? "bg-red-650 text-white shadow shadow-red-500/20"
              : "bg-zinc-950 border border-zinc-900 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Search className="h-3.5 w-3.5" />
          <span>Global Clan Finder</span>
        </button>
      </div>

      {/* RENDER DYNAMIC TAB: Local Milestones */}
      {subTab === "milestones" && (
        <>
          {showForm && (
            <form onSubmit={handleUpload} className="rounded border border-red-950/40 bg-zinc-955/80 p-5 space-y-4 shadow-xl">
              <h3 className="font-sans text-sm font-black uppercase tracking-wider text-zinc-200 border-b border-zinc-900 pb-2">
                Log Historic Milestone
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Milestone Title
                  </label>
                  <input
                    type="text"
                    placeholder="E.g., 50 War Win Streak Achieved"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded border border-zinc-900 bg-zinc-900/60 p-2 text-xs text-zinc-200 focus:border-red-650 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Registry Event Category
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full rounded border border-zinc-900 bg-zinc-900/60 p-2 text-xs text-zinc-200 focus:border-red-650 outline-none"
                  >
                    <option value="milestone">🎗️ Clan Milestone</option>
                    <option value="war">⚔️ Legendary War</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Screenshot / Image Link (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full rounded border border-zinc-900 bg-zinc-900/60 p-2 text-xs text-zinc-200 focus:border-red-650 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Event Record Date
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded border border-zinc-900 bg-zinc-900/60 p-2 text-xs text-zinc-200 focus:border-red-650 outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Detailed description / Chronicles description and memory
                  </label>
                  <textarea
                    placeholder="Write description detailing epic attack vectors, final count statistics..."
                    rows={3}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded border border-zinc-900 bg-zinc-900/60 p-2 text-xs text-zinc-200 resize-none focus:border-red-650 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded bg-zinc-900 font-mono text-xs uppercase text-zinc-400 border border-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center space-x-1.5 px-4 rounded bg-gradient-to-r from-red-700 to-rose-700 hover:from-red-600 hover:to-rose-600 font-mono text-xs font-black uppercase text-white"
                >
                  <Send className="h-4 w-4" />
                  <span>Record Memory</span>
                </button>
              </div>
            </form>
          )}
          {loading ? (
            <div className="flex h-44 items-center justify-center space-x-2.5 text-zinc-500 font-mono text-xs">
              <div className="h-4 w-4 animate-spin rounded-full border border-red-500 border-t-transparent" />
              <span>Restoring chronicled archives...</span>
            </div>
          ) : milestones.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-900/40 bg-zinc-955/20 py-20 text-center glass-card-standard">
              <Landmark className="h-10 w-10 text-rose-500/80 mb-3 animate-pulse" />
              <span className="font-mono text-xs font-black text-rose-400 uppercase tracking-widest">
                Chronicles Empty
              </span>
              <span className="font-sans text-[11px] text-zinc-400 mt-2 max-w-xs">
                No milestone logged under historical records yet. Record a prestigious victory!
              </span>
            </div>
          ) : (
            <div className="border-l-2 border-red-900 ml-4 space-y-8 relative py-2">
              {milestones.map(mil => {
                const isMilWar = mil.type === "war";
                return (
                  <div key={mil.id} className="relative pl-7 md:pl-10 group">
                    {/* Event node bullet */}
                    <div className={`absolute -left-[13px] top-1.5 flex h-6 w-6 items-center justify-center rounded-full border shadow-lg transition group-hover:scale-110 ${
                      isMilWar 
                        ? "bg-red-950 border-red-700 text-red-400 group-hover:shadow-[0_0_10px_rgba(244,63,94,0.4)]" 
                        : "bg-amber-950 border-amber-600 text-amber-400 group-hover:shadow-[0_0_10px_rgba(245,158,11,0.4)]"
                    }`}>
                      {isMilWar ? <Trophy className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                    </div>

                    {/* Card visual contents */}
                    <div className={`rounded-2xl p-6 shadow-2xl transition-all card-3d ${
                      isMilWar ? "glass-card-crimson" : "glass-card-gold"
                    }`}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <span className="flex items-center space-x-1.5 font-mono text-[9px] text-zinc-400 uppercase tracking-widest mb-1.5 font-bold">
                            <Calendar className="h-3.5 w-3.5 text-rose-500" />
                            <span>{mil.date}</span>
                          </span>

                          <h3 className="font-sans text-base font-black text-zinc-100 uppercase tracking-wide group-hover:glow-red transition">
                            {mil.title}
                          </h3>
                        </div>

                        {isLeaderOrCo && (
                          <button
                            onClick={() => handleDelete(mil.id)}
                            className="p-1.5 rounded-lg bg-zinc-950 border border-zinc-900 text-zinc-500 hover:text-red-400 hover:border-red-500/30 transition-all"
                            title="Erase Archive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <p className="font-sans text-xs text-zinc-300 mt-4 leading-relaxed whitespace-pre-wrap">
                        {mil.description}
                      </p>

                      {mil.imageUrl && (
                        <div className="mt-4 max-w-md overflow-hidden rounded-xl border border-zinc-800 shadow-md">
                          <img
                            src={mil.imageUrl}
                            alt={mil.title}
                            className="max-h-60 w-full object-cover select-none pointer-events-none hover:scale-105 transition duration-500"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* RENDER DYNAMIC TAB: In-Game War History */}
      {subTab === "wars" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center space-x-1.5">
              <Clock className="h-3.5 w-3.5 text-red-500 animate-pulse" />
              <span>CoC Global API Live Logs</span>
            </span>
            <button 
              onClick={fetchWarHistory}
              className="text-[10px] font-mono uppercase font-black text-rose-500 hover:underline flex items-center space-x-1"
            >
              <span>Refresh Logs</span>
            </button>
          </div>

          {loadingWar ? (
            <div className="flex h-36 items-center justify-center space-x-2 text-zinc-500 font-mono text-xs">
              <div className="h-4 w-4 animate-spin rounded-full border border-red-500 border-t-transparent" />
              <span>Querying Clash of Clans war matrix...</span>
            </div>
          ) : warHistory.length === 0 ? (
            <div className="text-center p-12 bg-zinc-955/20 border border-zinc-900/60 rounded-2xl glass-card-standard font-mono text-xs text-zinc-400">
              No war log items retrieved. Make sure your clan's War Log is set to public inside Clash of Clans.
            </div>
          ) : (
            <div className="space-y-4">
              {warHistory.map((war, idx) => {
                const isWin = war.result === "win";
                const isLoss = war.result === "lose";
                const cardTheme = isWin ? "glass-card-green" : isLoss ? "glass-card-crimson" : "glass-card-standard";
                
                return (
                  <div 
                    key={idx} 
                    className={`rounded-2xl p-5 transition flex flex-col md:flex-row items-center justify-between gap-5 card-3d shadow-xl border ${cardTheme}`}
                  >
                    {/* Left details */}
                    <div className="flex items-center space-x-4 w-full md:w-2/5">
                      <div className={`p-3 rounded-xl font-mono text-xs font-black uppercase text-center min-w-[75px] shadow ${
                        isWin 
                          ? "bg-green-950/40 text-green-400 border border-green-700/40" 
                          : isLoss 
                            ? "bg-red-950/45 text-red-400 border border-red-700/40" 
                            : "bg-zinc-900/50 text-zinc-400 border border-zinc-800"
                      }`}>
                        {war.result || "Tie"}
                      </div>
                      <div className="min-w-0">
                        <p className="font-sans text-[10px] uppercase font-black tracking-widest text-zinc-500">vs Opponent</p>
                        <h4 className="font-sans text-sm font-black text-zinc-100 truncate">{war.opponent?.name || "Enemy Clan"}</h4>
                        <p className="font-mono text-[9px] text-zinc-500 mt-1 truncate">{war.opponent?.tag}</p>
                      </div>
                    </div>

                    {/* Stats details */}
                    <div className="grid grid-cols-2 gap-4 text-center w-full md:w-2/5 font-mono">
                      <div className="bg-zinc-950/30 p-2 rounded-lg border border-zinc-900/30">
                        <span className="block text-[8px] uppercase tracking-widest text-zinc-500">Destruction</span>
                        <span className="text-xs font-black text-zinc-200">
                          {war.clan?.destructionPercentage}% vs {war.opponent?.destructionPercentage}%
                        </span>
                      </div>
                      <div className="bg-zinc-950/30 p-2 rounded-lg border border-zinc-900/30">
                        <span className="block text-[8px] uppercase tracking-widest text-zinc-500">Stars Count</span>
                        <span className="text-xs font-black text-amber-500 flex items-center justify-center space-x-0.5">
                          <span>{war.clan?.stars} ★ vs {war.opponent?.stars} ★</span>
                        </span>
                      </div>
                    </div>

                    {/* Right timestamps */}
                    <div className="text-right w-full md:w-1/5 font-mono text-[10px] text-zinc-400 border-t md:border-t-0 pt-3 md:pt-0 border-zinc-900/40">
                      <span className="block text-zinc-400">Size: <strong className="text-zinc-200">{war.teamSize}v{war.teamSize}</strong></span>
                      <span className="block mt-1 font-bold text-rose-400">{formatCocDate(war.endTime)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* RENDER DYNAMIC TAB: Capital Raids History */}
      {subTab === "capital" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center space-x-1.5">
              <Coins className="h-3.5 w-3.5 text-amber-500 animate-bounce" />
              <span>Capital Raid Seasons Sync</span>
            </span>
            <button 
              onClick={fetchRaidHistory}
              className="text-[10px] font-mono uppercase font-black text-amber-500 hover:underline"
            >
              Sync Raids
            </button>
          </div>

          {loadingRaid ? (
            <div className="flex h-36 items-center justify-center space-x-2 text-zinc-500 font-mono text-xs">
              <div className="h-4 w-4 animate-spin rounded-full border border-amber-550 border-t-transparent" />
              <span>Querying Capital peak database...</span>
            </div>
          ) : raidHistory.length === 0 ? (
            <div className="text-center p-12 bg-zinc-955/20 border border-zinc-900/60 rounded-2xl glass-card-standard font-mono text-xs text-zinc-400">
              No Capital Raid records found on server.
            </div>
          ) : (
            <div className="space-y-6">
              {raidHistory.map((season, idx) => (
                <div key={idx} className="glass-card-gold rounded-2xl p-6 space-y-5 shadow-2xl card-3d">
                  {/* Title & timing */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-rose-950/20 pb-4">
                    <div>
                      <h4 className="font-sans text-sm font-black uppercase text-zinc-100 flex items-center space-x-2">
                        <Map className="h-4.5 w-4.5 text-rose-500 animate-pulse" />
                        <span>Capital Raid Season Summary</span>
                      </h4>
                      <p className="font-mono text-[9px] text-zinc-400 mt-1">
                        TIMELINE: {formatCocDate(season.startTime)} to {formatCocDate(season.endTime)}
                      </p>
                    </div>

                    <span className="font-mono text-xs font-black uppercase text-amber-400 bg-amber-950/50 border border-amber-800/40 px-3 py-1.5 rounded-full shadow">
                      Total Loot: {season.capitalTotalLoot?.toLocaleString()} Gold 🪙
                    </span>
                  </div>

                  {/* Core Telemetry */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-xl bg-zinc-950/40 p-3.5 border border-zinc-900/40 font-mono text-center">
                      <span className="block text-[8px] uppercase tracking-widest text-zinc-500">Completed Raids</span>
                      <span className="text-sm font-black text-zinc-100">{season.raidsCompleted}</span>
                    </div>

                    <div className="rounded-xl bg-zinc-950/40 p-3.5 border border-zinc-900/40 font-mono text-center">
                      <span className="block text-[8px] uppercase tracking-widest text-zinc-500">Total Attacks</span>
                      <span className="text-sm font-black text-zinc-200">{season.totalAttacks}</span>
                    </div>

                    <div className="rounded-xl bg-zinc-950/40 p-3.5 border border-zinc-900/40 font-mono text-center">
                      <span className="block text-[8px] uppercase tracking-widest text-zinc-400 font-bold">Offensive Loot</span>
                      <span className="text-sm font-black text-amber-400">{season.offensiveLoot?.toLocaleString()} 🪙</span>
                    </div>

                    <div className="rounded-xl bg-zinc-950/40 p-3.5 border border-zinc-900/40 font-mono text-center">
                      <span className="block text-[8px] uppercase tracking-widest text-zinc-500">Defensive Loot</span>
                      <span className="text-sm font-black text-zinc-400">{season.defensiveLoot?.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Top Members Contribution */}
                  {Array.isArray(season.members) && season.members.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-rose-950/20">
                      <span className="block font-sans text-[10px] font-black uppercase tracking-wider text-amber-400 mb-2.5">
                        Top Contributor Standings
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                        {season.members.map((member: any, mIdx: number) => (
                          <div key={mIdx} className="flex items-center justify-between text-xs font-mono bg-zinc-950/50 border border-zinc-900/30 px-3 py-2 rounded-xl">
                            <span className="font-sans font-black text-zinc-300 truncate mr-2">{member.name}</span>
                            <div className="flex items-center space-x-3 text-[10px] flex-shrink-0">
                              <span className="text-zinc-500">Attacks: {member.attacks}/6</span>
                              <span className="text-amber-400 font-black">{member.loot?.toLocaleString()} Loot</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* RENDER DYNAMIC TAB: Global Clan Finder Search */}
      {subTab === "search" && (
        <div className="space-y-4">
          <form onSubmit={handleSearchClans} className="flex gap-2.5">
            <input
              type="text"
              placeholder="Search clans by name (e.g., NOT HUMANS, KOREAN, etc.)"
              required
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 rounded-xl border border-zinc-900 bg-zinc-950/80 px-4 py-3 font-sans text-xs text-zinc-100 placeholder-zinc-700 outline-none focus:border-red-650 transition-colors"
              id="spec-clan-query-search"
            />
            <button
              type="submit"
              disabled={searching}
              className="px-6 rounded-xl bg-gradient-to-r from-red-650 to-rose-700 hover:from-red-600 hover:to-rose-600 font-mono text-xs font-black uppercase text-white shadow-xl transition-all"
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </form>

          {searching ? (
            <div className="flex h-36 items-center justify-center space-x-2 text-zinc-500 font-mono text-xs">
              <div className="h-4 w-4 animate-spin rounded-full border border-red-500 border-t-transparent" />
              <span>Scanning Clash universe...</span>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center p-12 bg-zinc-955/20 border border-zinc-900/60 rounded-2xl glass-card-standard font-mono text-xs text-zinc-400">
              Submit a clan name above to scan active in-game clans in real-time.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {searchResults.map((clan, index) => (
                <div key={index} className="glass-card-standard rounded-2xl p-4.5 hover:border-red-500/30 transition flex items-center space-x-4 relative overflow-hidden card-3d shadow-md">
                  <div className="relative flex-shrink-0 bg-zinc-950/40 p-2 rounded-xl border border-zinc-900/40">
                    <img 
                      src={clan.badgeUrls?.small || clan.badgeUrls?.medium} 
                      alt="Badge"
                      className="h-10 w-10 object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-sans text-xs font-black text-zinc-100 truncate">{clan.name}</h4>
                    <p className="font-mono text-[9px] text-zinc-500 mt-1 truncate">{clan.tag}</p>
                    
                    <div className="flex flex-wrap items-center gap-2 mt-2 font-mono text-[9px] text-zinc-400">
                      <span className="bg-zinc-900 border border-zinc-850 px-1.5 py-0.5 rounded text-[8px] uppercase">Level {clan.clanLevel}</span>
                      <span>•</span>
                      <span>{clan.clanPoints} pts</span>
                      <span>•</span>
                      <span className="text-amber-500 font-bold">{clan.requiredTrophies}+ trophies</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Shared Custom Interactive Iframe-Safe Action Dialog */}
      {modalDialog && (
        <div className="fixed inset-0 bg-zinc-950/85 backdrop-blur-md z-[999999] flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md bg-zinc-900 border-2 border-zinc-850 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            {/* Design header lines */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-red-650 via-red-500 to-red-800" />
            <div className="font-mono text-[8px] text-zinc-550 mb-4 tracking-widest uppercase font-black">⚡ HISTORICAL ARCHIVES SECURITY</div>
            
            <h3 className="text-sm font-mono uppercase tracking-wider text-red-500 font-extrabold mb-2">
              {modalDialog.title}
            </h3>
            
            <p className="text-xs text-zinc-350 mb-6 leading-relaxed whitespace-pre-line font-sans">
              {modalDialog.message}
            </p>
            
            <div className="flex gap-3 justify-end font-mono">
              {modalDialog.type === "confirm" && (
                <button
                  type="button"
                  onClick={() => setModalDialog(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-bold transition cursor-pointer active:scale-95 border border-zinc-700/50"
                >
                  {modalDialog.leftBtnText || "Cancel"}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (modalDialog.type === "confirm" && modalDialog.onRightBtn) {
                    modalDialog.onRightBtn();
                  } else if (modalDialog.type === "alert" && modalDialog.onLeftBtn) {
                    modalDialog.onLeftBtn();
                  }
                  setModalDialog(null);
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-505 text-white text-xs font-bold transition cursor-pointer active:scale-95 shadow-lg shadow-red-950/40"
              >
                {modalDialog.type === "confirm" ? (modalDialog.rightBtnText || "Confirm") : (modalDialog.leftBtnText || "OK")}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
