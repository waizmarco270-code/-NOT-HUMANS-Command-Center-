import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc, onSnapshot, collection } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { CWLPlan, CoCRole, Assignment, Member } from "../types";
import { Award, Target, Save, AlertTriangle, CheckCircle, Shield, Edit3, Plus, Trophy, MessageSquare } from "lucide-react";

interface CwlSectionProps {
  userUid: string | null;
  userName: string;
  cocRole: CoCRole | null;
  members: Member[];
}

export default function CwlSection({ userUid, userName, cocRole, members }: CwlSectionProps) {
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [cwlPlan, setCwlPlan] = useState<CWLPlan | null>(null);
  const [loading, setLoading] = useState(true);

  // Administrative form inputs
  const [opponentName, setOpponentName] = useState("");
  const [leaderNotes, setLeaderNotes] = useState("");
  const [coLeaderNotes, setCoLeaderNotes] = useState("");
  const [liveCwlGroup, setLiveCwlGroup] = useState<any>(null);

  const isLeaderOrCo = cocRole === "Leader" || cocRole === "Co-Leader";

  useEffect(() => {
    fetch("/api/clan/currentwar/leaguegroup")
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setLiveCwlGroup(data);
        }
      })
      .catch(err => console.warn("Could not load live CWL matchup group:", err));
  }, []);

  useEffect(() => {
    setLoading(true);
    const planId = `cwl_day_${selectedDay}`;
    const planRef = doc(db, "cwl_plans", planId);

    const unsubscribe = onSnapshot(planRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCwlPlan({
          id: docSnap.id,
          opponentName: data.opponentName || "",
          warDay: data.warDay || selectedDay,
          assignments: data.assignments || [],
          leaderNotes: data.leaderNotes || "",
          coLeaderNotes: data.coLeaderNotes || "",
          updatedBy: data.updatedBy || "",
          updatedAt: data.updatedAt,
        });
        setOpponentName(data.opponentName || "");
        setLeaderNotes(data.leaderNotes || "");
        setCoLeaderNotes(data.coLeaderNotes || "");
      } else {
        // No plan exists for this day, initialize a default blank framework
        const initialAssignments: Assignment[] = Array.from({ length: 15 }, (_, idx) => ({
          targetNo: idx + 1,
          assignedPlayerTag: "",
          assignedPlayerName: "",
          status: "pending",
          attackNotes: `Secure the Town Hall. Plan funnel from 6 o'clock.`,
          report: ""
        }));
        
        setCwlPlan({
          id: planId,
          opponentName: "",
          warDay: selectedDay,
          assignments: initialAssignments,
          leaderNotes: "",
          coLeaderNotes: "",
          updatedBy: "System Setup",
          updatedAt: new Date().toISOString(),
        });
        setOpponentName("");
        setLeaderNotes("");
        setCoLeaderNotes("");
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `cwl_plans/${planId}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedDay]);

  const handleSavePlan = async (updatedAssignments?: Assignment[]) => {
    if (!cwlPlan) return;
    const planId = `cwl_day_${selectedDay}`;
    try {
      await setDoc(doc(db, "cwl_plans", planId), {
        opponentName: opponentName.trim() || "Enemy Clan",
        warDay: selectedDay,
        assignments: updatedAssignments || cwlPlan.assignments,
        leaderNotes: leaderNotes.trim(),
        coLeaderNotes: coLeaderNotes.trim(),
        updatedBy: userName,
        updatedAt: new Date().toISOString(),
      });
      alert(`CWL War Day ${selectedDay} strategy program saved successfully.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `cwl_plans/${planId}`);
    }
  };

  const handleUpdateAssignment = (index: number, key: keyof Assignment, value: any) => {
    if (!cwlPlan) return;
    const updated = [...cwlPlan.assignments];
    updated[index] = {
      ...updated[index],
      [key]: value
    };
    
    // Automatically match player name if tag is selected
    if (key === "assignedPlayerTag") {
      const match = members.find(m => m.playerTag === value);
      updated[index].assignedPlayerName = match ? match.playerName : "";
    }

    setCwlPlan({
      ...cwlPlan,
      assignments: updated
    });
  };

  // Quick stats calculations
  const pendingAttacks = cwlPlan?.assignments.filter(a => a.status === "pending" && a.assignedPlayerTag).length || 0;
  const completedAttacks = cwlPlan?.assignments.filter(a => a.status !== "pending" && a.assignedPlayerTag).length || 0;
  const totalStars = cwlPlan?.assignments.reduce((sum, a) => {
    if (a.status.includes("3star")) return sum + 3;
    if (a.status.includes("2star")) return sum + 2;
    if (a.status.includes("1star")) return sum + 1;
    return sum;
  }, 0) || 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Brand Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-rose-950/30 pb-4">
        <div className="flex items-center space-x-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded bg-amber-950/30 border border-amber-800/40 text-amber-500 shadow shadow-amber-950/50">
            <Award className="h-5.5 w-5.5" />
          </div>
          <div>
            <h2 className="font-sans text-xl font-black uppercase tracking-wider text-zinc-100">
              CWL STRATEGIC COMMAND
            </h2>
            <p className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">
              Coordinated warfare mapping, targets orchestration, and Live Attack logging
            </p>
          </div>
        </div>

        {/* War Day selection rails */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0">
          {Array.from({ length: 7 }, (_, i) => i + 1).map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-3 py-1.5 rounded text-xs font-mono font-bold uppercase transition duration-150 ${
                selectedDay === day
                  ? "bg-amber-600 text-zinc-950 shadow shadow-amber-500/20"
                  : "bg-zinc-900 border border-zinc-800/30 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              DAY {day}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-44 items-center justify-center space-x-2.5 text-zinc-500 font-mono text-xs">
          <div className="h-4 w-4 animate-spin rounded-full border border-amber-500 border-t-transparent" />
          <span>Synchronizing war grids...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Targets Mapping Area */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded border border-zinc-900 bg-zinc-950/75 p-4 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-zinc-900">
                <div className="flex items-center space-x-3">
                  <Target className="h-5 w-5 text-red-500 animate-pulse" />
                  <div>
                    <h3 className="font-sans text-xs font-black uppercase tracking-widest text-zinc-300">
                      Combat Directives Matrix
                    </h3>
                    <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">
                      Opponent Clan: <span className="text-amber-500 font-medium">{opponentName || "Unassigned"}</span>
                    </p>
                  </div>
                </div>

                {isLeaderOrCo && (
                  <div className="flex items-center space-x-2.5">
                    <input
                      type="text"
                      placeholder="Opponent Clan Name"
                      value={opponentName}
                      onChange={(e) => setOpponentName(e.target.value)}
                      className="rounded border border-zinc-800 bg-zinc-900/60 px-3 py-1 font-sans text-xs text-zinc-300 placeholder-zinc-600 outline-none focus:border-amber-600"
                    />
                    <button
                      onClick={() => handleSavePlan()}
                      className="flex items-center space-x-1.5 rounded bg-amber-600 hover:bg-amber-500 px-3 py-1.5 font-mono text-[10px] font-black uppercase text-zinc-950 transition"
                    >
                      <Save className="h-3 w-3" />
                      <span>Save War Grid</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Assignments list */}
              <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
                {cwlPlan?.assignments.map((assignment, index) => {
                  const hasAssigned = !!assignment.assignedPlayerTag;
                  return (
                    <div
                      key={assignment.targetNo}
                      className={`rounded border p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
                        assignment.status === "pending"
                          ? "bg-zinc-900/45 border-zinc-900"
                          : assignment.status.includes("3star")
                            ? "bg-green-950/10 border-green-900/30"
                            : "bg-red-950/10 border-red-900/30"
                      }`}
                    >
                      {/* Left: Target index and assign dropdown */}
                      <div className="flex items-center space-x-3 md:w-1/3">
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-zinc-900 border border-zinc-800 font-mono text-xs font-bold text-zinc-400">
                          #{assignment.targetNo}
                        </div>

                        {isLeaderOrCo ? (
                          <select
                            value={assignment.assignedPlayerTag}
                            onChange={(e) => handleUpdateAssignment(index, "assignedPlayerTag", e.target.value)}
                            className="bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-600 w-full"
                          >
                            <option value="">-- Click to Assign Player --</option>
                            {members.map(m => (
                              <option key={m.playerTag} value={m.playerTag}>
                                {m.playerName} ({m.playerTag})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="truncate">
                            {hasAssigned ? (
                              <p className="font-sans text-xs font-bold text-zinc-100 truncate">
                                {assignment.assignedPlayerName}
                              </p>
                            ) : (
                              <p className="font-mono text-xs text-zinc-600 uppercase">
                                Unassigned Target
                              </p>
                            )}
                            {hasAssigned && (
                              <p className="font-mono text-[9px] text-zinc-500">
                                {assignment.assignedPlayerTag}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Center: Guidelines / notes */}
                      <div className="md:w-1/3">
                        {isLeaderOrCo ? (
                          <input
                            type="text"
                            placeholder="Attack instructions..."
                            value={assignment.attackNotes || ""}
                            onChange={(e) => handleUpdateAssignment(index, "attackNotes", e.target.value)}
                            className="bg-zinc-900/40 border border-zinc-800/60 rounded px-2.5 py-1 text-xs text-zinc-300 placeholder-zinc-700 w-full"
                          />
                        ) : (
                          <p className="font-sans text-xs text-zinc-400 truncate-2-lines line-clamp-2">
                            {assignment.attackNotes || "Attack assigned target according to plan."}
                          </p>
                        )}
                      </div>

                      {/* Right: Attack State dropdown & Report */}
                      <div className="flex items-center space-x-2.5 md:w-1/3 md:justify-end">
                        <select
                          value={assignment.status}
                          disabled={!hasAssigned}
                          onChange={(e) => handleUpdateAssignment(index, "status", e.target.value)}
                          className={`rounded px-2.5 py-1 text-xs font-mono font-bold uppercase cursor-pointer outline-none ${
                            assignment.status === "pending"
                              ? "bg-zinc-800 text-zinc-400 border border-zinc-700"
                              : assignment.status === "completed_3star"
                                ? "bg-green-950 text-green-400 border border-green-800"
                                : assignment.status === "missed"
                                  ? "bg-zinc-950 text-zinc-600 border border-zinc-900"
                                  : "bg-amber-950 text-amber-400 border border-amber-900"
                          }`}
                        >
                          <option value="pending">⏳ Pending Attack</option>
                          <option value="completed_3star">⭐⭐⭐ 3 Star</option>
                          <option value="completed_2star">⭐⭐ 2 Star</option>
                          <option value="completed_1star">⭐ 1 Star</option>
                          <option value="completed_0star">⭐ 0 Star</option>
                          <option value="missed">❌ Missed Attack</option>
                        </select>

                        {/* Save Trigger for quick manual edits */}
                        {isLeaderOrCo && (
                          <button
                            onClick={() => handleSavePlan(cwlPlan?.assignments)}
                            className="p-1 px-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-amber-500 transition"
                            title="Quick save target"
                          >
                            <Save className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sidebar Area: Notes, stats tracking, remaining alarms */}
          <div className="space-y-6">
            {/* Live Stats bento block */}
            <div className="rounded border border-zinc-900 bg-zinc-950/80 p-5 shadow-xl">
              <h3 className="font-sans text-xs font-black uppercase tracking-widest text-zinc-300 mb-3 flex items-center space-x-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span>War Map Telemetry</span>
              </h3>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="rounded bg-zinc-900 p-2.5 border border-zinc-800/30">
                  <span className="block font-mono text-[9px] uppercase tracking-wider text-zinc-500">Pending Actions</span>
                  <span className="font-mono text-lg font-black text-amber-500">{pendingAttacks}</span>
                </div>
                <div className="rounded bg-zinc-900 p-2.5 border border-zinc-800/30">
                  <span className="block font-mono text-[9px] uppercase tracking-wider text-zinc-500">Completed Attacks</span>
                  <span className="font-mono text-lg font-black text-green-500">{completedAttacks}</span>
                </div>
                <div className="rounded bg-zinc-900 p-2.5 border border-zinc-800/30 col-span-2 flex items-center justify-between">
                  <div>
                    <span className="block font-mono text-[9px] uppercase tracking-wider text-zinc-500">Projected Stars Accumulation</span>
                    <span className="font-mono text-base font-black text-rose-500">{totalStars} ★</span>
                  </div>
                  <CheckCircle className="h-7 w-7 text-green-600/30" />
                </div>
              </div>
            </div>

            {/* Strategic Notes */}
            <div className="rounded border border-zinc-900 bg-zinc-950/80 p-5 shadow-xl space-y-4">
              <div className="flex items-center space-x-2 border-b border-zinc-900 pb-2.5">
                <Shield className="h-4 w-4 text-red-500" />
                <h3 className="font-sans text-xs font-black uppercase tracking-widest text-zinc-300">
                  Tactical Guidelines
                </h3>
              </div>

              {/* Leader notes */}
              <div>
                <label className="block font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Leader War Orders
                </label>
                {isLeaderOrCo ? (
                  <textarea
                    value={leaderNotes}
                    onChange={(e) => setLeaderNotes(e.target.value)}
                    placeholder="Enter Leader orders..."
                    rows={3}
                    className="w-full bg-zinc-900 border border-zinc-850 rounded p-2 text-xs text-zinc-200 resize-none outline-none focus:border-amber-600"
                  />
                ) : (
                  <p className="text-xs text-zinc-300 bg-zinc-900/60 p-2.5 rounded border border-zinc-850/20 whitespace-pre-wrap font-sans">
                    {cwlPlan?.leaderNotes || "No specific orders issued yet."}
                  </p>
                )}
              </div>

              {/* Co-Leader notes */}
              <div>
                <label className="block font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Co-Leader Notes
                </label>
                {isLeaderOrCo ? (
                  <textarea
                    value={coLeaderNotes}
                    onChange={(e) => setCoLeaderNotes(e.target.value)}
                    placeholder="Enter Co-Leader notes..."
                    rows={3}
                    className="w-full bg-zinc-900 border border-zinc-850 rounded p-2 text-xs text-zinc-200 resize-none outline-none focus:border-amber-600"
                  />
                ) : (
                  <p className="text-xs text-zinc-300 bg-zinc-900/60 p-2.5 rounded border border-zinc-850/20 whitespace-pre-wrap font-sans">
                    {cwlPlan?.coLeaderNotes || "No Co-leader guidelines posted."}
                  </p>
                )}
              </div>

              {isLeaderOrCo && (
                <button
                  onClick={() => handleSavePlan()}
                  className="w-full flex items-center justify-center space-x-2 rounded bg-amber-600 hover:bg-amber-500 py-2.5 font-mono text-[10px] font-black uppercase text-zinc-950 transition"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Update Notes</span>
                </button>
              )}
            </div>

            {/* Live CWL Group Standings */}
            {liveCwlGroup && (
              <div className="rounded border border-zinc-900 bg-zinc-950/80 p-5 shadow-xl space-y-3.5">
                <div className="flex items-center space-x-2 border-b border-zinc-900 pb-2.5">
                  <Award className="h-4 w-4 text-amber-500 animate-pulse" />
                  <h3 className="font-sans text-xs font-black uppercase tracking-widest text-zinc-300">
                    Active CWL Group Matchups
                  </h3>
                </div>
                <div className="font-mono text-[10px] text-zinc-500 uppercase flex justify-between">
                  <span>Season: {liveCwlGroup.season}</span>
                  <span className="text-zinc-400 font-bold">{liveCwlGroup.state}</span>
                </div>
                <div className="space-y-2">
                  {liveCwlGroup.clans?.map((clan: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-xs bg-zinc-900/40 border border-zinc-900/60 p-2 rounded">
                      <div className="flex items-center space-x-2">
                        {clan.badgeUrls?.small && (
                          <img 
                            src={clan.badgeUrls.small} 
                            alt="Group Clan Badge" 
                            className="h-5 w-5 object-contain"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <span className="font-sans font-bold text-zinc-200 truncate max-w-36">{clan.name}</span>
                      </div>
                      <span className="font-mono text-[9px] text-zinc-500 font-semibold">Lvl {clan.clanLevel}</span>
                    </div>
                  ))}
                </div>
                <div className="font-mono text-[8px] text-zinc-600 uppercase border-t border-zinc-900/60 pt-2 text-center">
                  Matched program rounds: {liveCwlGroup.rounds?.length} war mappings
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
