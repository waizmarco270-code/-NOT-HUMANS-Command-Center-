import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, setDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Giveaway, CoCRole, Member } from "../types";
import { Gift, Award, Plus, Trash2, CheckCircle2, User, HelpCircle, Loader, Shuffle } from "lucide-react";

interface GiveawaySectionProps {
  userUid: string;
  userName: string;
  cocRole: CoCRole | null;
  members: Member[];
}

export default function GiveawaySection({ userUid, userName, cocRole, members }: GiveawaySectionProps) {
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const [loading, setLoading] = useState(true);

  // Administrative Form state
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [prize, setPrize] = useState("Gold Pass");
  const [description, setDescription] = useState("");
  const [endsInDays, setEndsInDays] = useState(3);

  // Participant collection sync states
  const [participantsMap, setParticipantsMap] = useState<{ [giveawayId: string]: string[] }>({});
  const [drawingId, setDrawingId] = useState<string | null>(null);

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

  useEffect(() => {
    const q = query(collection(db, "giveaways"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Giveaway[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          title: data.title || "",
          prize: data.prize || "Gold Pass",
          description: data.description || "",
          createdAt: data.createdAt,
          endsAt: data.endsAt,
          status: data.status || "active",
          winnerUid: data.winnerUid || "",
          winnerName: data.winnerName || ""
        });
      });
      setGiveaways(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "giveaways");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Real-time synchronization of participants per giveaway
  useEffect(() => {
    const unsubscribes = giveaways.map(gv => {
      const gvPartsRef = collection(db, "giveaways", gv.id, "participants");
      return onSnapshot(gvPartsRef, (snapshot) => {
        const list: string[] = [];
        snapshot.forEach(docSnap => {
          list.push(docSnap.id); // Doc ID is the participant's userUid
        });
        setParticipantsMap(prev => ({
          ...prev,
          [gv.id]: list
        }));
      });
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [giveaways]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      const endsAtDate = new Date();
      endsAtDate.setDate(endsAtDate.getDate() + endsInDays);

      await addDoc(collection(db, "giveaways"), {
        title: title.trim(),
        prize,
        description: description.trim(),
        createdAt: serverTimestamp(),
        endsAt: endsAtDate.toISOString(),
        status: "active"
      });

      setTitle("");
      setPrize("Gold Pass");
      setDescription("");
      setShowForm(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "giveaways");
    }
  };

  const handleJoin = async (giveawayId: string) => {
    try {
      const partDocRef = doc(db, "giveaways", giveawayId, "participants", userUid);
      await setDoc(partDocRef, {
        joinedAt: new Date().toISOString(),
        playerName: userName
      });
      alert(`Successfully registered for the ${prize} giveaway! Best of luck, warrior.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `giveaways/${giveawayId}/participants/${userUid}`);
    }
  };

  const handleDrawWinner = async (giveawayId: string) => {
    const entrants = participantsMap[giveawayId] || [];
    if (entrants.length === 0) {
      triggerAlert("ENTRANTS EMPTY", "No participants have registered for this giveaway currently.");
      return;
    }

    setDrawingId(giveawayId);

    // Simulate animated RNG sweep
    setTimeout(async () => {
      const randomUid = entrants[Math.floor(Math.random() * entrants.length)];
      // Attempt to resolve entrant's human identity name
      const matchedMember = members.find(m => m.uid === randomUid);
      const matchedName = matchedMember ? matchedMember.playerName : "Clash Veteran";

      try {
        await updateDoc(doc(db, "giveaways", giveawayId), {
          status: "ended",
          winnerUid: randomUid,
          winnerName: matchedName
        });
        triggerAlert("🎉 WINNER DRAW COMPLETED", `Congratulations to ${matchedName}! They have won the raffle selection!`);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `giveaways/${giveawayId}`);
      } finally {
        setDrawingId(null);
      }
    }, 2000);
  };

  const handleDelete = async (id: string) => {
    triggerConfirm(
      "CONFIRM RAFFLE DELETION",
      "Are you absolutely certain you want to purge this giveaway record? This action cannot be reverted.",
      async () => {
        try {
          await deleteDoc(doc(db, "giveaways", id));
          triggerAlert("GIVEAWAY DELETED", "Success: Giveaway record deleted successfully.");
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          triggerAlert("DELETE ERROR", `Giveaway Deletion FAILED!\n\nError: ${errMsg}`);
          handleFirestoreError(err, OperationType.DELETE, `giveaways/${id}`);
        }
      }
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      
      {/* Brand Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-rose-950/30 pb-4">
        <div className="flex items-center space-x-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded bg-amber-950/40 border border-amber-800/40 text-amber-500 shadow shadow-amber-950/50">
            <Gift className="h-5.5 w-5.5" />
          </div>
          <div>
            <h2 className="font-sans text-xl font-black uppercase tracking-wider text-zinc-100">
              GIVEAWAY LOGISTICS
            </h2>
            <p className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">
              Leader-sponsored Gold Passes, Event Passes, and custom giveaways distribution
            </p>
          </div>
        </div>

        {isLeaderOrCo && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center justify-center space-x-2 rounded bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 px-4 py-2 font-mono text-xs font-black uppercase tracking-wider text-zinc-950 leading-none transition"
          >
            <Plus className="h-4 w-4" />
            <span>Setup Giveaway</span>
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded border border-amber-900/40 bg-zinc-950/80 p-5 space-y-4 shadow-xl">
          <h3 className="font-sans text-sm font-black uppercase tracking-wider text-zinc-200 border-b border-zinc-900 pb-2">
            Configure Giveaway Campaign
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Campaign Title
              </label>
              <input
                type="text"
                placeholder="E.g., Monthly Gold Pass Raffle"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded border border-zinc-900 bg-zinc-900/60 p-2 text-xs text-zinc-200 focus:border-amber-600 outline-none"
              />
            </div>

            <div>
              <label className="block font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Campaign Target Prize
              </label>
              <select
                value={prize}
                onChange={(e) => setPrize(e.target.value)}
                className="w-full rounded border border-zinc-900 bg-zinc-900/60 p-2 text-xs text-zinc-200 focus:border-amber-600 outline-none"
              >
                <option value="Gold Pass">Gold Pass</option>
                <option value="Event Pass">Event Pass</option>
                <option value="Clan Chest Upgrade">Custom Loot Sack</option>
                <option value="Gems Bundle (500)">Bundle of 500 Gems</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Raffle Participation Conditions
              </label>
              <textarea
                placeholder="Declare guidelines (e.g. must complete all war attacks this season to qualify, etc.)"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded border border-zinc-900 bg-zinc-900/60 p-2 text-xs text-zinc-205 resize-none focus:border-amber-600 outline-none"
              />
            </div>

            <div>
              <label className="block font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Raffle Campaign Lifespan
              </label>
              <select
                value={endsInDays}
                onChange={(e) => setEndsInDays(Number(e.target.value))}
                className="w-full rounded border border-zinc-900 bg-zinc-900/60 p-2 text-xs text-zinc-200 focus:border-amber-600 outline-none"
              >
                <option value={1}>1 Day</option>
                <option value={3}>3 Days</option>
                <option value={7}>7 Days</option>
                <option value={14}>14 Days</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded bg-zinc-900 font-mono text-xs uppercase text-zinc-400 border border-zinc-850"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center space-x-1.5 px-4 rounded bg-amber-600 text-zinc-950 hover:bg-amber-500 font-mono text-xs font-black uppercase"
            >
              <span>Initiate Raffle</span>
            </button>
          </div>
        </form>
      )}

      {/* Giveaways listings block */}
      {loading ? (
        <div className="flex h-44 items-center justify-center space-x-2 text-zinc-500 font-mono text-xs">
          <div className="h-4 w-4 animate-spin rounded-full border border-amber-500 border-t-transparent" />
          <span>Intercepting secure parameters...</span>
        </div>
      ) : giveaways.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded border border-zinc-900/50 bg-zinc-950/20 py-16 text-center">
          <Gift className="h-10 w-10 text-zinc-880 mb-2.5" />
          <span className="font-mono text-xs font-semibold text-zinc-500 uppercase">
            Raffles Registry Quiet
          </span>
          <span className="font-sans text-[11px] text-zinc-650 mt-1">
            No giveaway campaigns are currently scheduled.
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {giveaways.map(gv => {
            const entrants = participantsMap[gv.id] || [];
            const alreadyJoined = entrants.includes(userUid);
            const isEnded = gv.status === "ended";
            const isDrawing = drawingId === gv.id;

            return (
              <div
                key={gv.id}
                className={`rounded-lg border p-5 flex flex-col justify-between space-y-4 hover:bg-zinc-950/90 transition shadow-xl relative ${
                  isEnded 
                    ? "border-zinc-900 bg-zinc-950/30 opacity-75" 
                    : "border-amber-955 bg-zinc-950/70"
                }`}
              >
                {/* Prize status tags */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`inline-block font-mono text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                      isEnded 
                        ? "bg-zinc-800 text-zinc-500" 
                        : "bg-amber-950/40 border border-amber-900/40 text-amber-500"
                    }`}>
                      {gv.prize}
                    </span>
                    <h3 className="font-sans text-sm font-black text-zinc-100 uppercase tracking-wide mt-2">
                      {gv.title}
                    </h3>
                  </div>

                  {isLeaderOrCo && (
                    <button
                      onClick={() => handleDelete(gv.id)}
                      className="p-1 px-1.5 rounded bg-zinc-900 text-zinc-500 hover:text-red-400 transition"
                      title="Terminate Giveaway"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <p className="font-sans text-xs text-zinc-400 leading-normal whitespace-pre-wrap">
                  {gv.description || "Register to gain a piece of legendary clan chest spoils!"}
                </p>

                {/* Draw Winner history block */}
                {isEnded ? (
                  <div className="rounded bg-zinc-900/60 p-3 border border-zinc-850 flex items-center space-x-3">
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">Raffle Campaign Closed</p>
                      <p className="font-sans text-xs text-green-400">
                        Winner: <strong className="uppercase font-bold">{gv.winnerName}</strong>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-[10px] text-zinc-500 font-mono">
                    <User className="h-3.5 w-3.5 text-amber-500" />
                    <span>Registered Contestants: <strong className="text-zinc-300">{entrants.length}</strong></span>
                  </div>
                )}

                {/* CTA control actions */}
                {!isEnded && (
                  <div className="pt-2">
                    {alreadyJoined ? (
                      <div className="w-full text-center py-2 rounded bg-zinc-900 border border-zinc-800 font-mono text-[10px] font-black uppercase text-green-500">
                        ✓ Registered in raffle
                      </div>
                    ) : (
                      <button
                        onClick={() => handleJoin(gv.id)}
                        className="w-full flex items-center justify-center space-x-2 rounded bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 py-2.5 font-mono text-xs font-black uppercase text-zinc-950 transition"
                      >
                        <gift className="h-3.5 w-3.5" />
                        <span>Join Contest Panel</span>
                      </button>
                    )}

                    {isLeaderOrCo && !isEnded && (
                      <button
                        onClick={() => handleDrawWinner(gv.id)}
                        disabled={isDrawing}
                        className="w-full mt-2 flex items-center justify-center space-x-1.5 rounded bg-zinc-905 border border-zinc-800 py-2 text-xs font-mono font-bold uppercase text-amber-400 hover:text-amber-350 transition"
                      >
                        {isDrawing ? (
                          <Loader className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Shuffle className="h-3.5 w-3.5" />
                        )}
                        <span>{isDrawing ? "Scrambling entrants..." : "Draw Random Winner"}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Shared Custom Interactive Iframe-Safe Action Dialog */}
      {modalDialog && (
        <div className="fixed inset-0 bg-zinc-950/85 backdrop-blur-md z-[999999] flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md bg-zinc-900 border-2 border-zinc-850 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            {/* Design header lines */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-650 via-amber-500 to-amber-800" />
            <div className="font-mono text-[8px] text-zinc-550 mb-4 tracking-widest uppercase font-black">⚡ COMMAND RAFFLE SECURITY</div>
            
            <h3 className="text-sm font-mono uppercase tracking-wider text-amber-500 font-extrabold mb-2">
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
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-505 text-zinc-950 text-xs font-black transition cursor-pointer active:scale-95 shadow-lg shadow-amber-950/40"
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
