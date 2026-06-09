import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Announcement, CoCRole } from "../types";
import { Megaphone, Pin, Star, Trash2, Calendar, Send, ShieldAlert } from "lucide-react";
import { sendPushNotification } from "../pushHelper";

interface AnnouncementSectionProps {
  userUid: string | null;
  userName: string;
  cocRole: CoCRole | null;
}

export default function AnnouncementSection({ userUid, userName, cocRole }: AnnouncementSectionProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [loading, setLoading] = useState(true);

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
    const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Announcement[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            title: data.title || "",
            content: data.content || "",
            authorUid: data.authorUid || "",
            authorName: data.authorName || "Anonymous",
            pinned: !!data.pinned,
            createdAt: data.createdAt,
          });
        });
        // Sort pinned items first, then by createdAt desc
        list.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });
        setAnnouncements(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "announcements");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      await addDoc(collection(db, "announcements"), {
        title: title.trim(),
        content: content.trim(),
        authorUid: userUid || "",
        authorName: userName,
        pinned: isPinned,
        createdAt: serverTimestamp(),
      });

      sendPushNotification({
        title: "📢 New Announcement Posted",
        message: `${userName}: "${title.trim()}"`,
        linkToTab: "announcements",
        excludeUserUid: userUid || undefined
      });

      setTitle("");
      setContent("");
      setIsPinned(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "announcements");
    }
  };

  const handleDelete = async (id: string) => {
    triggerConfirm(
      "CONFIRM ANNOUNCEMENT DELETION",
      "Are you absolutely certain you want to delete this official announcement?",
      async () => {
        try {
          await deleteDoc(doc(db, "announcements", id));
          triggerAlert("ANNOUNCEMENT DELETED", "Success: Announcement deleted successfully.");
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          triggerAlert("ANNOUNCEMENT DELETE ERROR", `Deletion failed!\n\nError: ${errMsg}`);
          handleFirestoreError(err, OperationType.DELETE, `announcements/${id}`);
        }
      }
    );
  };

  const handleTogglePin = async (id: string, currentPin: boolean) => {
    try {
      await updateDoc(doc(db, "announcements", id), {
        pinned: !currentPin,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `announcements/${id}`);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Brand Header */}
      <div className="flex items-center space-x-3.5 border-b border-rose-950/30 pb-4">
        <div className="flex h-11 w-11 items-center justify-center rounded bg-red-950/50 border border-red-800/40 text-red-500 shadow shadow-red-950/50">
          <Megaphone className="h-5.5 w-5.5" />
        </div>
        <div>
          <h2 className="font-sans text-xl font-black uppercase tracking-wider text-zinc-100">
            ANNOUNCEMENT BROADCASTS
          </h2>
          <p className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">
            Official instructions, schedules and war details published by CoC Leaders
          </p>
        </div>
      </div>

      {/* Admin Panel to create Announcements */}
      {isLeaderOrCo && (
        <form 
          onSubmit={handleCreate} 
          className="relative overflow-hidden rounded border border-red-950/40 bg-zinc-950/65 p-5 outline outline-1 outline-red-500/5 shadow-xl shadow-black/80"
          id="announcement-form"
        >
          <div className="absolute top-0 right-0 p-3 flex items-center space-x-1.5 opacity-40">
            <ShieldAlert className="h-4 w-4 text-red-500" />
            <span className="font-mono text-[9px] font-bold text-red-500 uppercase">LEADER SYSTEM</span>
          </div>

          <h3 className="font-sans text-xs font-black uppercase tracking-widest text-zinc-300 mb-4 flex items-center space-x-2">
            <span>Issue New Broadcast</span>
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Notice Title
              </label>
              <input
                type="text"
                placeholder="E.g., CWL Day 3 Strategy Update"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded border border-zinc-900 bg-zinc-900/40 px-3.5 py-2 font-sans text-xs font-medium text-zinc-100 placeholder-zinc-600 outline-none focus:border-red-600 focus:bg-zinc-900 transition-all"
                id="announcement-title"
              />
            </div>

            <div>
              <label className="block font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Announcement Content
              </label>
              <textarea
                placeholder="Enter details, attack guidelines, schedule information, or instructions..."
                rows={4}
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full rounded border border-zinc-900 bg-zinc-900/40 px-3.5 py-2 font-sans text-xs font-medium text-zinc-100 placeholder-zinc-600 outline-none focus:border-red-600 focus:bg-zinc-900 transition-all resize-none"
                id="announcement-content"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-zinc-900 pt-4">
              <label className="flex cursor-pointer items-center space-x-2.5">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="rounded border-zinc-800 bg-zinc-900 text-red-600 accent-red-600 focus:ring-0 focus:ring-offset-0 h-4 w-4"
                  id="announcement-pin"
                />
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400 select-none">
                  Pin announcement to top
                </span>
              </label>

              <button
                type="submit"
                className="flex items-center space-x-2 rounded bg-gradient-to-r from-red-700 to-rose-800 px-4 py-2 font-mono text-xs font-extrabold uppercase tracking-widest text-white shadow shadow-red-950/50 hover:from-red-600 hover:to-rose-700 transition duration-150"
                id="announcement-submit"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Publish Broadcast</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Announcements Listing */}
      {loading ? (
        <div className="flex h-32 items-center justify-center space-x-2.5 text-zinc-500 font-mono text-xs">
          <div className="h-4 w-4 animate-spin rounded-full border border-red-500 border-t-transparent" />
          <span>Intercepting frequencies...</span>
        </div>
      ) : announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded border border-zinc-900/50 bg-zinc-950/20 py-16 text-center shadow-inner">
          <Megaphone className="h-10 w-10 text-zinc-800 mb-2.5" />
          <span className="font-mono text-xs font-semibold text-zinc-500 uppercase">
            Frequency Quiet
          </span>
          <span className="font-sans text-[11px] text-zinc-600 mt-1">
            No official clan notices have been broadcasted yet.
          </span>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((item) => (
            <div
              key={item.id}
              className={`relative overflow-hidden rounded border transition-all duration-200 ${
                item.pinned
                  ? "border-red-900/60 bg-gradient-to-r from-red-950/15 to-zinc-950/90 shadow-lg shadow-red-950/5"
                  : "border-zinc-900/80 bg-zinc-950/30 hover:bg-zinc-900/10 shadow"
              }`}
            >
              {/* Highlight gradient pin for premium COC feel */}
              {item.pinned && (
                <div className="absolute top-0 left-0 h-full w-1.5 bg-gradient-to-b from-red-600 to-rose-700" />
              )}

              <div className="p-5 pl-6 sm:pl-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    {/* Header line */}
                    <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                      {item.pinned && (
                        <span className="flex items-center space-x-1 font-mono text-[9px] font-black uppercase tracking-wider bg-red-950/60 border border-red-800/60 text-red-400 px-1.5 py-0.5 rounded-sm">
                          <Pin className="h-2.5 w-2.5" />
                          <span>Pinned Alert</span>
                        </span>
                      )}
                      <h3 className="font-sans text-sm font-black text-zinc-100 uppercase tracking-wide">
                        {item.title}
                      </h3>
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 font-mono text-[10px] text-zinc-500 mb-4">
                      <span className="flex items-center space-x-1">
                        <Star className="h-3 w-3 text-red-500" />
                        <span className="font-bold text-zinc-400 uppercase">{item.authorName}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {item.createdAt
                            ? new Date(item.createdAt.seconds * 1000).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "New Notice"}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Leader Controls */}
                  {isLeaderOrCo && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleTogglePin(item.id, item.pinned)}
                        className={`p-1.5 rounded transition ${
                          item.pinned 
                            ? "bg-red-950/40 text-red-400 hover:text-red-300" 
                            : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"
                        }`}
                        title={item.pinned ? "Unpin notice" : "Pin notice"}
                      >
                        <Pin className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 rounded bg-zinc-900 text-zinc-500 hover:bg-red-950/40 hover:text-red-400 transition"
                        title="Delete Broadcast"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Announcement Body */}
                <p className="font-sans text-xs leading-relaxed text-zinc-300 whitespace-pre-wrap selection:bg-red-900/30 selection:text-white">
                  {item.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Shared Custom Interactive Iframe-Safe Action Dialog */}
      {modalDialog && (
        <div className="fixed inset-0 bg-zinc-950/85 backdrop-blur-md z-[999999] flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md bg-zinc-900 border-2 border-zinc-850 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            {/* Design header lines */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-red-650 via-red-500 to-red-800" />
            <div className="font-mono text-[8px] text-zinc-550 mb-4 tracking-widest uppercase font-black">⚡ ANNOUNCEMENTS SECURE SYSTEM</div>
            
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
