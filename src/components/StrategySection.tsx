import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, deleteDoc, doc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { StrategyGuide, CoCRole } from "../types";
import { BookOpen, Filter, Plus, Link, Trash2, Video, Eye, Send, Upload, Image, X } from "lucide-react";

interface StrategySectionProps {
  userUid: string | null;
  userName: string;
  cocRole: CoCRole | null;
}

const CATEGORIES = ["Fireball Strategy", "Hydra", "Dragons", "QC Hybrid", "Root Riders", "Smash Attacks", "Others"] as const;

// Optimized canvas compressor to keep standard base64 strings small (sub 40KB) for Firestore
const compressAndGetBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 500; // slightly smaller limit for strategy pages to keep doc size super slim
        const MAX_HEIGHT = 500;
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
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.70);
          resolve(compressedBase64);
        } else {
          resolve(event.target?.result as string);
        }
      };
      img.onerror = (e) => reject(e);
    };
    reader.onerror = (e) => reject(e);
  });
};

export default function StrategySection({ userUid, userName, cocRole }: StrategySectionProps) {
  const [guides, setGuides] = useState<StrategyGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("All");

  // Form states to upload new strategy
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<typeof CATEGORIES[number]>("QC Hybrid");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [baseLink, setBaseLink] = useState("");
  const [compressing, setCompressing] = useState(false);

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

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressing(true);
    try {
      const b64 = await compressAndGetBase64(file);
      setImageUrl(b64);
    } catch (err) {
      console.error("Compression failed:", err);
      alert("Master, there was an issue processing the strategy screenshot.");
    } finally {
      setCompressing(false);
    }
  };

  const isLeaderOrCo = cocRole === "Leader" || cocRole === "Co-Leader";

  useEffect(() => {
    const q = query(collection(db, "strategies"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: StrategyGuide[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          title: data.title || "",
          category: data.category || "QC Hybrid",
          description: data.description || "",
          images: data.images || "",
          videoUrl: data.videoUrl || "",
          baseLink: data.baseLink || "",
          authorUid: data.authorUid || "",
          authorName: data.authorName || "Member",
          createdAt: data.createdAt
        });
      });
      setGuides(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "strategies");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    try {
      await addDoc(collection(db, "strategies"), {
        title: title.trim(),
        category,
        description: description.trim(),
        images: imageUrl.trim() || null,
        videoUrl: videoUrl.trim() || null,
        baseLink: baseLink.trim() || null,
        authorUid: userUid || "",
        authorName: userName,
        createdAt: serverTimestamp()
      });

      // Clear states
      setTitle("");
      setCategory("QC Hybrid");
      setDescription("");
      setImageUrl("");
      setVideoUrl("");
      setBaseLink("");
      setShowForm(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "strategies");
    }
  };

  const handleDelete = async (id: string) => {
    triggerConfirm(
      "CONFIRM STRATEGY GUIDE DELETION",
      "Are you absolutely certain you want to delete this strategic guide from the War Academy database?",
      async () => {
        try {
          await deleteDoc(doc(db, "strategies", id));
          triggerAlert("STRATEGY DELETED", "Success: The strategy guide has been removed from the map successfully.");
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          triggerAlert("STRATEGY DELETE ERROR", `Deletion failed!\n\nError: ${errMsg}\n\nPlease verify your Firebase database credentials or network status.`);
          handleFirestoreError(err, OperationType.DELETE, `strategies/${id}`);
        }
      }
    );
  };

  const filteredGuides = activeCategory === "All"
    ? guides
    : guides.filter(g => g.category === activeCategory);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      
      {/* Brand Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-rose-950/30 pb-4">
        <div className="flex items-center space-x-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded bg-red-950/40 border border-red-800/40 text-red-500 shadow shadow-red-950/50">
            <BookOpen className="h-5.5 w-5.5" />
          </div>
          <div>
            <h2 className="font-sans text-xl font-black uppercase tracking-wider text-zinc-100">
              STRATEGICAL ACADEMY
            </h2>
            <p className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">
              Explore professional blueprints, attack guides, video layouts and base copy links
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center justify-center space-x-2 rounded bg-gradient-to-r from-red-700 to-rose-700 hover:from-red-600 hover:to-rose-600 px-4 py-2 font-mono text-xs font-black uppercase tracking-wider text-white select-none transition"
        >
          <Plus className="h-4 w-4" />
          <span>Publish Strategy</span>
        </button>
      </div>

      {/* Categories slider */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveCategory("All")}
          className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded font-mono text-xs font-bold uppercase transition duration-150 ${
            activeCategory === "All"
              ? "bg-red-600 text-white"
              : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          <span>ALL Blueprints</span>
        </button>

        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3.5 py-1.5 rounded font-mono text-xs font-bold uppercase transition duration-150 ${
              activeCategory === cat
                ? "bg-red-655 text-red-400 bg-red-950/60 border border-red-900/50"
                : "bg-zinc-900 border border-zinc-850 text-zinc-455 hover:text-zinc-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* strategy creator modal form */}
      {showForm && (
        <form onSubmit={handleUpload} className="rounded border border-red-950/40 bg-zinc-950/80 p-5 space-y-4 shadow-xl">
          <h3 className="font-sans text-sm font-black uppercase tracking-wider text-zinc-200 border-b border-zinc-900 pb-2">
            Publish Strategy Blueprint
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Strategy Title
              </label>
              <input
                type="text"
                placeholder="E.g., TH16 Root Rider Spam & Overgrowth Guide"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded border border-zinc-900 bg-zinc-900/60 p-2 text-xs text-zinc-200 focus:border-red-600 outline-none"
              />
            </div>

            <div>
              <label className="block font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Strategy Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full rounded border border-zinc-900 bg-zinc-900/60 p-2 text-xs text-zinc-200 focus:border-red-600 outline-none"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Attack Steps & Execution Details
              </label>
              <textarea
                placeholder="Break down composition, spell choices, entry details, QC priorities..."
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded border border-zinc-900 bg-zinc-900/60 p-2 text-xs text-zinc-200 resize-none focus:border-red-600 outline-none"
              />
            </div>

            <div>
              <label className="block font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Screenshot / Tactical Map (Direct Upload)
              </label>
              {imageUrl ? (
                <div className="relative rounded border border-zinc-800 bg-zinc-900/40 p-2 flex items-center justify-between">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <img
                      src={imageUrl}
                      alt="Tactical Thumbnail"
                      className="h-12 w-12 rounded object-cover border border-zinc-800"
                    />
                    <div className="overflow-hidden">
                      <span className="font-mono text-[9px] text-zinc-400 block truncate font-bold">TACTICAL_MAP.JPG</span>
                      <span className="font-mono text-[8px] text-emerald-500 block uppercase font-bold">READY TO DEPLOY</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="p-1.5 rounded-full hover:bg-zinc-850 text-red-500 transition cursor-pointer"
                    title="Remove Image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative rounded border-2 border-dashed border-zinc-800 hover:border-red-955 bg-zinc-900/10 p-3.5 transition text-center flex flex-col items-center justify-center cursor-pointer group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  {compressing ? (
                    <div className="flex flex-col items-center space-y-1">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                      <span className="font-mono text-[9px] text-zinc-400 uppercase tracking-widest animate-pulse font-bold">Compressing Map...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center space-y-1">
                      <Upload className="h-4 w-4 text-zinc-550 group-hover:text-red-500 transition-colors" />
                      <span className="font-mono text-[9px] text-zinc-400 uppercase tracking-wider font-extrabold group-hover:text-zinc-200">Upload Screenshot</span>
                      <span className="font-mono text-[8px] text-zinc-650 block uppercase tracking-tighter">Auto-compressed JPG</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Video Guide Link (Optional - YouTube/Bilibili)
              </label>
              <input
                type="text"
                placeholder="(Optional) https://youtu.be/..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="w-full rounded border border-zinc-900 bg-zinc-900/60 p-2 text-xs text-zinc-200 focus:border-red-600 outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Layout Copy URL (Official clashofclans.com Link)
              </label>
              <input
                type="text"
                placeholder="https://link.clashofclans.com/en?action=OpenLayout&id=..."
                value={baseLink}
                onChange={(e) => setBaseLink(e.target.value)}
                className="w-full rounded border border-zinc-900 bg-zinc-900/60 p-2 text-xs text-zinc-200 focus:border-red-600 outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3.5 pt-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded bg-zinc-900 font-mono text-xs uppercase text-zinc-400 border border-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center space-x-1.5 px-4.5 py-2 rounded bg-gradient-to-r from-red-700 to-rose-700 hover:from-red-600 hover:to-rose-600 font-mono text-xs font-black uppercase text-white shadow"
            >
              <Send className="h-4 w-4" />
              <span>Broadcast Blueprint</span>
            </button>
          </div>
        </form>
      )}

      {/* Strategies displaying grid */}
      {loading ? (
        <div className="flex h-44 items-center justify-center space-x-2 text-zinc-500 font-mono text-xs">
          <div className="h-4 w-4 animate-spin rounded-full border border-red-500 border-t-transparent" />
          <span>Analyzing libraries...</span>
        </div>
      ) : filteredGuides.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded border border-zinc-900/50 bg-zinc-950/20 py-16 text-center">
          <BookOpen className="h-10 w-10 text-zinc-800 mb-2.5" />
          <span className="font-mono text-xs font-semibold text-zinc-500 uppercase">
            No Strategy Guides Found
          </span>
          <span className="font-sans text-[11px] text-zinc-650 mt-1">
            Be the first to post a legendary attack configuration.
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGuides.map(guide => (
            <div
              key={guide.id}
              className="rounded-lg border border-zinc-900 bg-zinc-950/70 overflow-hidden flex flex-col justify-between hover:border-red-950/50 hover:bg-zinc-950/90 transition shadow-lg"
            >
              {/* Media banner if present */}
              {guide.images ? (
                <div className="h-40 w-full overflow-hidden relative border-b border-zinc-900">
                  <img
                    src={guide.images}
                    alt={guide.title}
                    className="h-full w-full object-cover select-none"
                  />
                  <span className="absolute bottom-2.5 right-2.5 rounded bg-zinc-950/90 border border-zinc-800 px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider text-red-400">
                    {guide.category}
                  </span>
                </div>
              ) : (
                <div className="h-12 bg-zinc-900 p-2.5 flex items-center justify-between border-b border-zinc-910">
                  <span className="font-mono text-[9px] font-black uppercase tracking-wider bg-red-950/40 border border-red-800/50 text-red-400 px-1.5 py-0.5 rounded-sm">
                    {guide.category}
                  </span>
                </div>
              )}

              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-sans text-sm font-black text-zinc-100 uppercase tracking-wide truncate mb-2">
                    {guide.title}
                  </h3>
                  <p className="font-sans text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap line-clamp-4">
                    {guide.description}
                  </p>
                </div>

                {/* Author credit and metadata triggers */}
                <div className="border-t border-zinc-900 pt-3.5 mt-4 flex items-center justify-between">
                  <span className="font-mono text-[10px] text-zinc-500">
                    By <strong className="text-zinc-400 uppercase">{guide.authorName}</strong>
                  </span>

                  <div className="flex items-center space-x-1.5">
                    {guide.videoUrl && (
                      <a
                        href={guide.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded bg-amber-950/20 text-amber-500 hover:text-amber-400 transition"
                        title="Watch demonstration video"
                      >
                        <Video className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {guide.baseLink && (
                      <a
                        href={guide.baseLink}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded bg-red-950/20 text-red-500 hover:text-red-400 transition"
                        title="Copy COC Base Design Layout"
                      >
                        <Link className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {(guide.authorUid === userUid || isLeaderOrCo) && (
                      <button
                        onClick={() => handleDelete(guide.id)}
                        className="p-1.5 rounded bg-zinc-900 text-zinc-500 hover:bg-red-955 hover:text-red-400 transition"
                        title="Delete Guide"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
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
            <div className="font-mono text-[8px] text-zinc-550 mb-4 tracking-widest uppercase font-black">⚡ ACADEMY SECURITY COMMAND</div>
            
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
