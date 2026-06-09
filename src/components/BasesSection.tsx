import React, { useState, useEffect } from "react";
import { 
  collection, 
  onSnapshot, 
  query, 
  writeBatch,
  doc, 
  updateDoc,
  deleteDoc, 
  addDoc, 
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { BaseLayout, CoCRole } from "../types";
import { sendPushNotification } from "../pushHelper";
import { 
  Layers, 
  ShieldAlert, 
  Plus, 
  Copy, 
  Check, 
  ExternalLink, 
  Trash2, 
  Lock, 
  GripVertical, 
  Award, 
  Sliders, 
  Info, 
  X, 
  Upload, 
  Image as ImageIcon,
  CheckSquare,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Edit,
  FileJson
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface BasesSectionProps {
  userUid: string | null;
  userName: string;
  userEmail: string | null;
  cocRole: CoCRole | null;
}

const TH_LEVELS = Array.from({ length: 12 }, (_, i) => 18 - i); // TH 18 down to 7

// Optimized base64 image compressor to keep document sizes slim
const compressAndGetBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 550;
        const MAX_HEIGHT = 550;
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
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.72);
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

export default function BasesSection({ userUid, userName, userEmail, cocRole }: BasesSectionProps) {
  const [bases, setBases] = useState<BaseLayout[]>([]);
  const [activeTab, setActiveTab] = useState<"not_humans" | "public">("not_humans");
  const [selectedTh, setSelectedTh] = useState<number>(18); // default TH18 representation
  const [showThSelector, setShowThSelector] = useState<boolean>(true);

  // Custom Town Hall backgrounds states
  const [thImages, setThImages] = useState<{ [thLevel: number]: string }>({});
  const [uploadingThId, setUploadingThId] = useState<number | null>(null);

  // Form State
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [baseLink, setBaseLink] = useState("");
  const [formTh, setFormTh] = useState<number>(18);
  const [imageUrl, setImageUrl] = useState("");
  
  const [compressing, setCompressing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dragOverActive, setDragOverActive] = useState(false);

  // Bulk Import States
  const [uploadMode, setUploadMode] = useState<"single" | "bulk">("single");
  const [bulkJson, setBulkJson] = useState("");
  const [bulkImportProgress, setBulkImportProgress] = useState<string | null>(null);

  // Editing Base State
  const [editingBase, setEditingBase] = useState<BaseLayout | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editBaseLink, setEditBaseLink] = useState("");
  const [editThLevel, setEditThLevel] = useState<number>(18);
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editCompressing, setEditCompressing] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editDragOverActive, setEditDragOverActive] = useState(false);

  // Lightbox Preview
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  // Copied indicator
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Custom alert/confirm modal state
  const [modalDialog, setModalDialog] = useState<{
    type: "confirm" | "alert";
    title: string;
    message: string;
    onRightBtn?: () => void;
    rightBtnText?: string;
    leftBtnText?: string;
  } | null>(null);

  const isSupremeLeader = userEmail?.toLowerCase().trim() === "waizmonazzum270@gmail.com";
  const isAuthorizedUploader = cocRole === "Leader" || cocRole === "Co-Leader" || isSupremeLeader;

  // Real-time custom Town Hall background screenshots subscription
  useEffect(() => {
    const q = query(collection(db, "th_images"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const mapping: { [thLevel: number]: string } = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.thLevel && data.imageUrl) {
            mapping[Number(data.thLevel)] = data.imageUrl;
          }
        });
        setThImages(mapping);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "th_images");
      }
    );
    return () => unsubscribe();
  }, []);

  // Supreme Leader specific background image upload
  const handleThImageUpload = async (thLevel: number, file: File) => {
    try {
      setUploadingThId(thLevel);
      const base64 = await compressAndGetBase64(file);
      const docId = String(thLevel);
      
      await setDoc(doc(db, "th_images", docId), {
        thLevel: thLevel,
        imageUrl: base64,
        updatedAt: new Date().toISOString()
      });
      
      triggerAlert("SUCCESS, MASTER", `Town Hall ${thLevel} screenshot has been updated successfully!`);
    } catch (err) {
      console.error(err);
      const detailedError = err instanceof Error ? err.message : String(err);
      triggerAlert("UPLOAD FAILED", `There was an issue encoding the Town Hall background screenshot, Master. Error detail: ${detailedError}`);
    } finally {
      setUploadingThId(null);
    }
  };

  // Real-time bases subscription
  useEffect(() => {
    const q = query(collection(db, "bases"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: BaseLayout[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            title: data.title || "Elite Base Plan",
            description: data.description || "No layout coordinates provided",
            imageUrl: data.imageUrl || "",
            baseLink: data.baseLink || "",
            thLevel: Number(data.thLevel || 15),
            rank: Number(data.rank !== undefined ? data.rank : 999),
            vaultType: data.vaultType || "public",
            authorUid: data.authorUid || "system",
            authorName: data.authorName || "Anonymity Sector",
            authorRole: data.authorRole || "Member",
            approved: !!data.approved,
            createdAt: data.createdAt
          });
        });
        setBases(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "bases");
      }
    );
    return () => unsubscribe();
  }, []);

  const triggerConfirm = (title: string, message: string, onConfirm: () => void) => {
    setModalDialog({
      type: "confirm",
      title,
      message,
      onRightBtn: onConfirm,
      rightBtnText: "Yes, Master",
      leftBtnText: "Cancel"
    });
  };

  const triggerAlert = (title: string, message: string) => {
    setModalDialog({
      type: "alert",
      title,
      message,
      leftBtnText: "Understood, Master"
    });
  };

  // Check custom clearance for tabs - everyone has access to view now!
  const hasVaultClearance = true;

  // Handles copying CoC Layout link
  const handleCopyLink = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Image upload
  const processImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      triggerAlert("INVALID FILE", "Please provide a valid image screenshot of your Clash of Clans base design.");
      return;
    }
    setCompressing(true);
    try {
      const b64 = await compressAndGetBase64(file);
      setImageUrl(b64);
    } catch (err) {
      console.error(err);
      triggerAlert("COMPRESSION FAILED", "Master, we could not compress this base screenshot properly.");
    } finally {
      setCompressing(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
  };

  // Drag and Drop files upload
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processImageFile(file);
  };

  // Submitting base layout
  const handleAddBase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !baseLink.trim() || !imageUrl) {
      triggerAlert("MISSING FIELDS", "Please ensure Title, Copy Layout Link and Screenshot are provided, Master.");
      return;
    }

    if (!baseLink.includes("link.clashofclans.com") && !baseLink.startsWith("http")) {
      triggerAlert("WARNING: INVALID URL", "Please provide a genuine official Clash of Clans base layout share URL.");
      return;
    }

    // Determine target vault limits
    if (activeTab === "not_humans" && !isAuthorizedUploader) {
      triggerAlert("CLASSIFIED REJECTION", "Only official Clan Officers (Leader, Co-Leader) are sanctioned to publish directly into NOT HUMANS VAULT.");
      return;
    }

    setSubmitting(true);
    try {
      // Find current max rank to append at end
      const basesInCurrentTH = bases.filter(b => b.vaultType === activeTab && b.thLevel === formTh);
      const maxRank = basesInCurrentTH.reduce((acc, current) => current.rank > acc ? current.rank : acc, -1);
      const newRank = maxRank + 1;

      const isNotHumans = activeTab === "not_humans";

      const payload = {
        title: title.trim(),
        description: description.trim(),
        baseLink: baseLink.trim(),
        thLevel: Number(formTh),
        rank: newRank,
        vaultType: activeTab,
        imageUrl: imageUrl,
        authorUid: userUid || "guest",
        authorName: isNotHumans ? "NOTHUMANS" : (userName || "Honorary Guest"),
        authorRole: isNotHumans ? "CLAN" : (cocRole || "Member"),
        approved: false, // requires Leader confirmation manually
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, "bases"), payload);

      sendPushNotification({
        title: "🏰 New Defence Layout Added",
        message: `${userName || "Warrior"} uploaded a TH${payload.thLevel} defense layout: "${title.trim()}"!`,
        linkToTab: "layouts",
        excludeUserUid: userUid || undefined
      });

      triggerAlert("BASE TRANSMITTED", "Success: The new defensive blueprint has been uploaded and encrypted.");
      
      // reset forms
      setTitle("");
      setDescription("");
      setBaseLink("");
      setFormTh(selectedTh);
      setImageUrl("");
      setIsOpenForm(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "bases");
    } finally {
      setSubmitting(false);
    }
  };

  // Bulk Multi-Import Feature
  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkJson.trim()) {
      triggerAlert("JSON EMPTY", "Please paste your demographic JSON blueprint array first, Master.");
      return;
    }

    if (activeTab === "not_humans" && !isAuthorizedUploader) {
      triggerAlert("CLASSIFIED REJECTION", "Only official Clan Officers (Leader, Co-Leader) are authorized to bulk import into NOT HUMANS VAULT.");
      return;
    }

    setSubmitting(true);
    setBulkImportProgress("Parsing and validating blueprints, Master...");

    try {
      const parsed = JSON.parse(bulkJson);
      if (!Array.isArray(parsed)) {
        throw new Error("Pasted JSON is not an Array. Base layouts must be formatted as [ { ... }, { ... } ]");
      }

      const validatedBases: any[] = [];
      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        
        // title check
        let itemTitle = String(item.title || "").trim();
        if (!itemTitle) {
          itemTitle = `Elite Base Plan #${i + 1}`;
        }
        if (itemTitle.length > 36) {
          itemTitle = itemTitle.slice(0, 36);
        }

        // description check
        const itemDesc = String(item.description || "").trim();

        // link check
        const itemLink = String(item.baseLink || "").trim();
        if (!itemLink) {
          throw new Error(`Item at index ${i} is missing its 'baseLink' property.`);
        }
        if (!itemLink.includes("link.clashofclans.com") && !itemLink.startsWith("http")) {
          throw new Error(`Item at index ${i} has an invalid URL link coordinates.`);
        }

        // thLevel check
        let itemTh = Number(item.thLevel);
        if (isNaN(itemTh) || itemTh < 7 || itemTh > 18) {
          itemTh = Number(formTh); // fallback
        }

        validatedBases.push({
          title: itemTitle,
          description: itemDesc,
          baseLink: itemLink,
          thLevel: itemTh,
          vaultType: activeTab,
          imageUrl: String(item.imageUrl || "").trim(), // empty string since they will edit screenshot later!
          authorUid: userUid || "guest",
          authorName: activeTab === "not_humans" ? "NOTHUMANS" : (userName || "Honorary Guest"),
          authorRole: activeTab === "not_humans" ? "CLAN" : (cocRole || "Member"),
          approved: false,
          createdAt: serverTimestamp()
        });
      }

      if (validatedBases.length === 0) {
        throw new Error("No valid base records discovered in matching payloads.");
      }

      setBulkImportProgress(`Deploying ${validatedBases.length} defense models, Master...`);

      for (let k = 0; k < validatedBases.length; k++) {
        setBulkImportProgress(`Transmitting defensive coordinate ${k + 1} of ${validatedBases.length}...`);
        
        const basesInTargetTH = bases.filter(b => b.vaultType === activeTab && b.thLevel === validatedBases[k].thLevel);
        const maxRank = basesInTargetTH.reduce((acc, current) => current.rank > acc ? current.rank : acc, -1);
        const baseRank = (maxRank === -1 ? 0 : maxRank) + 1 + k;
        
        const finalPayload = {
          ...validatedBases[k],
          rank: baseRank
        };

        await addDoc(collection(db, "bases"), finalPayload);
      }

      sendPushNotification({
        title: "🏰 Multi-Layouts Imported",
        message: `${userName || "Warrior"} imported a bulk batch of ${validatedBases.length} defense blueprints!`,
        linkToTab: "layouts",
        excludeUserUid: userUid || undefined
      });

      triggerAlert("BULK IMPORT SECURED", `A total of ${validatedBases.length} tactical defensive configurations have been successfully decrypted and indexed.`);
      setBulkJson("");
      setUploadMode("single");
      setIsOpenForm(false);
    } catch (err) {
      console.error(err);
      const detailedMessage = err instanceof Error ? err.message : String(err);
      triggerAlert("TRANSMISSION CEASED", `Master, we failed to parse or write bulk coordinates. Error detail: ${detailedMessage}`);
    } finally {
      setSubmitting(false);
      setBulkImportProgress(null);
    }
  };

  // Base editing handlers
  const handleEditBaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBase) return;
    if (!editTitle.trim() || !editBaseLink.trim()) {
      triggerAlert("MISSING FIELDS", "Please ensure Title and Copy Layout Link are provided, Master.");
      return;
    }

    if (!editBaseLink.includes("link.clashofclans.com") && !editBaseLink.startsWith("http")) {
      triggerAlert("WARNING: INVALID URL", "Please provide a genuine official Clash of Clans base layout share URL.");
      return;
    }

    setEditSubmitting(true);
    try {
      const docRef = doc(db, "bases", editingBase.id);
      await updateDoc(docRef, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        baseLink: editBaseLink.trim(),
        thLevel: Number(editThLevel),
        imageUrl: editImageUrl
      });
      triggerAlert("BASE UPDATED", "Success: The defensive blueprint changes have been saved and encrypted.");
      setEditingBase(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bases/${editingBase.id}`);
    } finally {
      setEditSubmitting(false);
    }
  };

  const processEditImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      triggerAlert("INVALID FILE", "Please provide a valid image screenshot of your Clash of Clans base design.");
      return;
    }
    setEditCompressing(true);
    try {
      const b64 = await compressAndGetBase64(file);
      setEditImageUrl(b64);
    } catch (err) {
      console.error(err);
      triggerAlert("COMPRESSION FAILED", "Master, we could not compress this base screenshot properly.");
    } finally {
      setEditCompressing(false);
    }
  };

  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processEditImageFile(file);
  };

  const handleEditDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setEditDragOverActive(true);
  };

  const handleEditDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setEditDragOverActive(false);
  };

  const handleEditDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setEditDragOverActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processEditImageFile(file);
  };

  // Deleting base layouts
  const handleDeleteBase = async (baseId: string) => {
    const base = bases.find(b => b.id === baseId);
    if (!base) return;

    // Check permissions
    const canDelete = isSupremeLeader || cocRole === "Leader" || (cocRole === "Co-Leader" && base.authorRole !== "Leader") || base.authorUid === userUid;
    if (!canDelete) {
      triggerAlert("MUTINY PREVENTED", "You do not have the credentials to incinerate this blueprint ledger, Master.");
      return;
    }

    triggerConfirm("CONFIRM BLUEPRINT INCINERATION", "Are you entirely confident you want to vaporise this layout design?", async () => {
      try {
        await deleteDoc(doc(db, "bases", baseId));
        triggerAlert(" blueprint PURGED", "System notification: base layout file successfully incinerated.");
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `bases/${baseId}`);
      }
    });
  };

  // Approval Toggle
  const handleToggleApproval = async (baseId: string, currentApproved: boolean) => {
    if (!isSupremeLeader) {
      triggerAlert("ACCESS VIOLATION", "Only the Supreme Leader holds authorization to issue stamps of Master Approved strategies.");
      return;
    }

    try {
      await updateDoc(doc(db, "bases", baseId), {
        approved: !currentApproved
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bases/${baseId}`);
    }
  };

  // Filtering bases based on town hall and tab
  const filteredBases = bases
    .filter((b) => b.vaultType === activeTab && b.thLevel === selectedTh)
    .sort((a, b) => a.rank - b.rank);

  // Drag and Drop reordering for ranking (NOT HUMANS VAULT)
  const [draggedBaseId, setDraggedBaseId] = useState<string | null>(null);

  const handleBaseDragStart = (e: React.DragEvent, id: string) => {
    if (!isAuthorizedUploader) return;
    setDraggedBaseId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleBaseDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleBaseDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!isAuthorizedUploader || !draggedBaseId || draggedBaseId === targetId) return;

    const sourceIndex = filteredBases.findIndex((b) => b.id === draggedBaseId);
    const targetIndex = filteredBases.findIndex((b) => b.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const updatedList = [...filteredBases];
    const [draggedItem] = updatedList.splice(sourceIndex, 1);
    updatedList.splice(targetIndex, 0, draggedItem);

    // Save back to Firestore
    setDraggedBaseId(null);
    try {
      const batch = writeBatch(db);
      updatedList.forEach((base, index) => {
        const ref = doc(db, "bases", base.id);
        batch.update(ref, { rank: index });
      });
      await batch.commit();
    } catch (err) {
      console.error(err);
      triggerAlert("REORDER FAILED", "Master, there was an error sync-writing the new ranking configurations backend.");
    }
  };

  // Push rank manually Up or Down (for testing and backup support)
  const handleShiftRank = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= filteredBases.length) return;

    const batch = writeBatch(db);
    const item1 = filteredBases[index];
    const item2 = filteredBases[targetIndex];

    batch.update(doc(db, "bases", item1.id), { rank: targetIndex });
    batch.update(doc(db, "bases", item2.id), { rank: index });

    try {
      await batch.commit();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 select-none relative" id="layout-bases-section">
      
      {/* SECTION BANNER HEADLINE */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#120707] via-[#090404] to-[#120707] border border-[#2b1717] px-6 py-6 shadow-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.03)_0%,_transparent_65%)] pointer-events-none" />
        <div className="relative z-15 flex items-start space-x-4">
          <div className="p-3 bg-[#261010]/90 border border-red-900/40 rounded-xl text-red-500 shadow-inner">
            <Layers className="h-7 w-7 animate-pulse text-rose-500" />
          </div>
          <div>
            <h1 className="font-mono text-lg font-black uppercase text-zinc-100 tracking-wider">
              DEFENSIVE GRID SCHEMATICS
            </h1>
            <p className="font-sans text-xs text-zinc-400 mt-1 max-w-xl">
              Coordinate and analyze flawless Clash of Clans base layouts configurations. Compare, clone, rank, and publish state-of-the-art designs validated by officers.
            </p>
          </div>
        </div>

        {/* UPLOAD TRIGGER ACTION */}
        <button
          onClick={() => {
            if (activeTab === "not_humans" && !isAuthorizedUploader) {
              triggerAlert("CLASSIFIED REJECTION", "Only official Commanders (Leader/Co-Leader) can upload to Not Humans Vault, Master.");
              return;
            }
            setFormTh(selectedTh);
            setIsOpenForm(true);
          }}
          className="relative z-10 self-start md:self-center flex items-center space-x-2 px-4 py-2 border border-red-750 hover:bg-red-950/20 text-red-400 hover:text-red-300 font-mono text-[10px] font-black uppercase tracking-widest rounded-lg transition duration-200 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>UPLOAD BASE LAYOUT</span>
        </button>
      </div>

      {/* DOUBLE-PLAY VAULTERS SEGMENT (TABS) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#211111] pb-4 gap-4">
        
        {/* VAULT DIRECTORY SLIDERS */}
        <div className="flex bg-[#0d0707] border border-[#211111] p-1.5 rounded-xl self-start">
          <button
            onClick={() => setActiveTab("public")}
            className={`px-4 py-2 rounded-lg font-mono text-[10px] font-black uppercase tracking-wider transition ${
              activeTab === "public"
                ? "bg-gradient-to-r from-zinc-900 to-[#100606] text-amber-500 shadow-md border border-[#2e1a1a]"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            👥 PUBLIC LIBRARY
          </button>
          <button
            onClick={() => setActiveTab("not_humans")}
            className={`px-4 py-2 rounded-lg font-mono text-[10px] font-black uppercase tracking-wider transition flex items-center space-x-1.5 ${
              activeTab === "not_humans"
                ? "bg-gradient-to-r from-[#210c0c] to-[#120505] text-red-500 shadow-md border border-red-950"
                : "text-zinc-500 hover:text-red-450"
            }`}
          >
            <Lock className="h-3.5 w-3.5 text-rose-500" />
            <span>NOT HUMANS VAULT</span>
          </button>
        </div>

        {/* VAULT DESCRIPTION STAGES */}
        <div className="font-mono text-[9px] text-zinc-500 uppercase flex items-center space-x-1.5">
          <Info className="h-3.5 w-3.5 text-zinc-650" />
          <span>
            {activeTab === "public" 
              ? "Any clan member may submit their top layouts with in-game clone links here." 
              : "Officer vault: high priority war blueprints organized strictly by elite rank index."}
          </span>
        </div>
      </div>

      {/* TH SELECTION ACCORDION SELECTOR */}
      {showThSelector && (
        <div className="bg-[#090404] border border-[#1b0e0e] p-4 rounded-2xl">
          <span className="block font-mono text-[9px] font-black uppercase text-amber-500/60 mb-3.5 tracking-wider">
            SELECT TOWN HALL CATEGORY
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {TH_LEVELS.map((th) => {
              const uploadedImg = thImages[th];
              return (
                <div
                  key={th}
                  onClick={() => {
                    setSelectedTh(th);
                    setShowThSelector(false);
                  }}
                  style={{ 
                    backgroundImage: uploadedImg ? `url(${uploadedImg})` : "none",
                    backgroundSize: "cover",
                    backgroundPosition: "center"
                  }}
                  className={`h-16 sm:h-20 rounded-xl border relative overflow-hidden transition-all duration-300 group flex items-center justify-center cursor-pointer ${
                    selectedTh === th
                      ? "border-amber-500 shadow-lg shadow-amber-950/45"
                      : "border-[#1b0a0a] hover:border-red-950"
                  }`}
                >
                  {/* Visual Underlay Overlay for Readability */}
                  <div className={`absolute inset-0 transition-colors duration-300 ${
                    selectedTh === th 
                      ? "bg-black/55 group-hover:bg-black/45" 
                      : "bg-black/75 group-hover:bg-black/65"
                  }`} />

                  {/* Card Text Content */}
                  <div className="relative z-10 flex flex-col items-center justify-center text-center">
                    <span className={`text-base font-black leading-none tracking-tight ${
                      selectedTh === th ? "text-amber-400 group-hover:text-amber-300" : "text-zinc-150 group-hover:text-white"
                    }`}>
                      TH {th}
                    </span>
                    <span className={`text-[7px] font-bold uppercase tracking-widest mt-1 ${
                      selectedTh === th ? "text-amber-500/70" : "text-zinc-500 group-hover:text-zinc-400"
                    }`}>
                      TOWN HALL
                    </span>
                  </div>

                  {/* Decorative bottom indicator for state */}
                  {selectedTh === th && (
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-amber-500" />
                  )}

                  {/* Supreme Leader's Dedicated Upload Option */}
                  {isSupremeLeader && (
                    <label 
                      onClick={(e) => e.stopPropagation()} 
                      className="absolute top-1 right-1 p-1 bg-black/80 hover:bg-black text-rose-500 hover:text-rose-450 border border-zinc-900 rounded-lg cursor-pointer opacity-0 group-hover:opacity-100 transition duration-200 z-20"
                      title="Master, upload custom background screenshot for this Town Hall level"
                    >
                      <Upload className="h-3 w-3" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            await handleThImageUpload(th, file);
                          }
                        }}
                      />
                    </label>
                  )}

                  {/* Upload loading indicator spinner */}
                  {uploadingThId === th && (
                    <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-30">
                      <RefreshCw className="h-4 w-4 text-amber-500 animate-spin" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MAIN CARDS LIST & VAULT LOGIC GATE */}
      {!showThSelector && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#211111] pb-4">
            <button
              onClick={() => setShowThSelector(true)}
              className="flex items-center space-x-2 px-4 py-2.5 border border-red-900/60 bg-[#160a0a]/95 hover:bg-[#2c1212] text-red-100 hover:text-white font-mono text-[10.5px] font-black uppercase tracking-widest rounded-lg transition duration-200 cursor-pointer active:scale-95 shadow-[0_0_15px_rgba(239,68,68,0.12)] self-start"
            >
              <span>← SELECT BASES OF OTHER TH</span>
            </button>
            <div className="px-3.5 py-1.5 rounded-lg bg-red-950/25 border border-red-900/30 text-amber-450 font-mono text-xs font-black uppercase tracking-wider self-start sm:self-auto">
              📂 ACTIVE SECTOR: TOWN HALL {selectedTh} CONFIGURATIONS
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key="grid-pane"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-4"
            >
            {filteredBases.length === 0 ? (
              
              /* EMPTY BLUEPRINT LEDGER CARD */
              <div className="text-center py-16 px-4 border border-dashed border-[#1f1010] rounded-3xl bg-zinc-950/40">
                <Layers className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
                <h4 className="font-mono text-xs font-black uppercase text-zinc-400 tracking-wider">
                  NO CHRONICLES PRELOADED
                </h4>
                <p className="font-sans text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                  No layout schematics currently index under Town Hall {selectedTh} category within the {activeTab === "not_humans" ? "authorized chamber" : "public registry"} sector.
                </p>
                <button
                  onClick={() => setIsOpenForm(true)}
                  className="mt-4 inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-red-900 text-zinc-300 font-mono text-[9px] font-black uppercase rounded-md tracking-wider transition cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>PUBLISH FIRST BLUEPRINT</span>
                </button>
              </div>

            ) : (

              /* REAL DEFENSIVE GRID RENDERED CONTAINER */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredBases.map((base, index) => {
                  
                  const isAuthor = base.authorUid === userUid;
                  const canDelete = isSupremeLeader || cocRole === "Leader" || (cocRole === "Co-Leader" && base.authorRole !== "Leader") || isAuthor;
                  const canEdit = isSupremeLeader || cocRole === "Leader" || (cocRole === "Co-Leader" && base.authorRole !== "Leader") || isAuthor;

                  return (
                    <div
                      key={base.id}
                      draggable={activeTab === "not_humans" && isAuthorizedUploader}
                      onDragStart={(e) => handleBaseDragStart(e, base.id)}
                      onDragOver={handleBaseDragOver}
                      onDrop={(e) => handleBaseDrop(e, base.id)}
                      className={`group relative flex flex-col justify-between rounded-2xl bg-gradient-to-b from-zinc-950 to-[#0e0606] border transition-all duration-200 overflow-hidden ${
                        base.approved 
                          ? "border-amber-450/40 shadow-[0_0_15px_rgba(245,158,11,0.06)]" 
                          : "border-[#1d0d0d] hover:border-[#381c1c]"
                      } ${draggedBaseId === base.id ? "opacity-30 border-dashed border-red-500" : ""}`}
                    >
                      {/* HEADER COVER IMAGE SCREENSHOT */}
                      <div className="relative aspect-video w-full overflow-hidden bg-black/60 border-b border-[#1b0d0d]">
                        {base.imageUrl ? (
                          <img
                            src={base.imageUrl}
                            alt={base.title}
                            className="h-full w-full object-cover group-hover:scale-102 transition duration-300 cursor-pointer"
                            onClick={() => setLightboxImg(base.imageUrl)}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div 
                            onClick={canEdit ? () => {
                              setEditingBase(base);
                              setEditTitle(base.title);
                              setEditDescription(base.description || "");
                              setEditBaseLink(base.baseLink);
                              setEditThLevel(base.thLevel);
                              setEditImageUrl(base.imageUrl || "");
                            } : undefined}
                            className="h-full w-full flex flex-col items-center justify-center text-zinc-700 hover:text-rose-500 bg-red-950/5 group/sc border-dashed hover:bg-rose-955/10 transition cursor-pointer"
                          >
                            <ImageIcon className="h-9 w-9 mb-1 text-zinc-650 group-hover/sc:text-rose-500 transition" />
                            <span className="font-mono text-[8px] uppercase tracking-wider text-zinc-500 group-hover/sc:text-rose-400">
                              {canEdit ? "➕ CLICK TO UPLOAD SCREENSHOT" : "No Screenshot"}
                            </span>
                          </div>
                        )}

                        {/* HOVER MAGNIFIER ICON */}
                        <div 
                          onClick={() => setLightboxImg(base.imageUrl)}
                          className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition duration-150 flex items-center justify-center cursor-pointer"
                        >
                          <span className="font-mono text-[9px] font-black uppercase bg-black/85 text-zinc-100 border border-zinc-800 rounded-md px-2.5 py-1.5 shadow-xl tracking-wider">
                            VIEW FULL SCREENSHOT
                          </span>
                        </div>

                        {/* DRAG HANDLE BADGE FOR OFFICERS */}
                        {activeTab === "not_humans" && isAuthorizedUploader && (
                          <div className="absolute top-2.5 left-2.5 py-1 px-1.5 rounded bg-black/90 border border-zinc-850 text-zinc-400 cursor-grab active:cursor-grabbing flex items-center space-x-1 shadow-md">
                            <GripVertical className="h-3.5 w-3.5 text-zinc-500" />
                            <span className="font-mono text-[8px] font-extrabold uppercase">DRAG</span>
                          </div>
                        )}

                        {/* LEADER APPROVED SUPREME SEAL BANNER */}
                        {base.approved && (
                          <div className="absolute top-2.5 right-2.5 py-1 px-2 rounded bg-amber-500/90 border border-amber-300 text-black font-mono text-[8px] font-black uppercase tracking-widest flex items-center space-x-1 shadow-lg animate-bounce duration-1000">
                            <Award className="h-3 w-3 fill-black text-black" />
                            <span>APPROVED BY COMMAND</span>
                          </div>
                        )}

                        {/* RANKING TILE (NOT HUMANS VAULT ONLY) */}
                        {activeTab === "not_humans" && (
                          <div className="absolute bottom-2.5 left-2.5 py-1 px-2 rounded bg-red-950/90 border border-red-500/40 text-red-400 font-mono font-black text-[9px] tracking-widest shadow">
                            RANK #{index + 1}
                          </div>
                        )}
                      </div>

                      {/* CARD CONTENT BODY */}
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          
                          {/* HEADLINE TITLE */}
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-mono text-xs font-black uppercase text-zinc-100 tracking-wider line-clamp-1">
                              {base.title}
                            </h3>
                            <span className="font-mono text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 flex-shrink-0">
                              TH {base.thLevel}
                            </span>
                          </div>

                          {/* SUB Description */}
                          {base.description && (
                            <p className="font-sans text-xs text-zinc-400 mt-2 line-clamp-2 leading-relaxed">
                              {base.description}
                            </p>
                          )}

                          {/* STRATEGY AUTHOR METADATA */}
                          <div className="mt-3.5 pt-3 border-t border-[#180a0a] flex items-center justify-between">
                            {(() => {
                              const isNotHumansBase = base.vaultType === "not_humans";
                              const dispName = isNotHumansBase ? "NOTHUMANS" : base.authorName;
                              const dispRole = isNotHumansBase ? "CLAN" : base.authorRole;
                              const dispInitial = dispName.charAt(0);
                              return (
                                <>
                                  <div className="flex items-center space-x-1.5">
                                    <div className="flex h-5 w-5 items-center justify-center bg-zinc-900 border border-zinc-800 rounded-full font-mono text-[9px] font-black text-zinc-400 uppercase">
                                      {dispInitial}
                                    </div>
                                    <span className="font-sans text-[10px] text-zinc-350 font-black truncate max-w-[110px]">
                                      {dispName}
                                    </span>
                                  </div>
                                  <span className="font-mono text-[8px] text-zinc-500 uppercase tracking-tighter font-extrabold text-amber-500/80">
                                    Role: {dispRole}
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                        </div>

                        {/* CTA CONTROLLER ROW */}
                        <div className="mt-4 pt-3.5 border-t border-[#1a0f0f] space-y-2">
                          
                          {/* CLASH LAYOUT IN-GAME ACTIONS */}
                          <div className="flex gap-2">
                            
                            {/* INSTANT CLONE ACTION */}
                            <a
                              href={base.baseLink}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 flex items-center justify-center space-x-1 px-3 py-1.5 bg-gradient-to-r from-red-950 to-rose-950/80 hover:from-red-900 hover:to-rose-900 border border-red-900/60 text-red-200 hover:text-white rounded-lg font-mono text-[9px] font-black uppercase tracking-wider transition"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>CLONE BASE Layout</span>
                            </a>

                            {/* CLIPBOARD COPY COORDINATES */}
                            <button
                              onClick={() => handleCopyLink(base.id, base.baseLink)}
                              className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-300 hover:text-zinc-100 rounded-lg transition flex items-center justify-center"
                              title="Copy Clash of Clans Link coordinates to clipboard"
                            >
                              {copiedId === base.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5 text-zinc-400" />
                              )}
                            </button>
                          </div>

                          {/* SPECIAL SUPREME LEADER & DEV ROW ACTIONS */}
                          <div className="flex items-center justify-between gap-2.5">
                            
                            {/* Manual Index Sorters (Officers Option inside private vault) */}
                            {activeTab === "not_humans" && isAuthorizedUploader && (
                              <div className="flex items-center space-x-1.5">
                                <button
                                  disabled={index === 0}
                                  onClick={() => handleShiftRank(index, "up")}
                                  className="p-1 rounded bg-[#0f0707] border border-zinc-850 hover:border-zinc-700 text-zinc-400 hover:text-white disabled:opacity-20 transition"
                                  title="Elevate Rank Order Index"
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </button>
                                <button
                                  disabled={index === filteredBases.length - 1}
                                  onClick={() => handleShiftRank(index, "down")}
                                  className="p-1 rounded bg-[#0f0707] border border-zinc-850 hover:border-zinc-700 text-zinc-400 hover:text-white disabled:opacity-20 transition"
                                  title="Lower Rank Order Index"
                                >
                                  <ArrowDown className="h-3 w-3" />
                                </button>
                              </div>
                            )}

                            <div className="flex items-center space-x-2 ml-auto">
                              
                              {/* SUPREME LEADER APPROVED TICK STATUS TIE */}
                              {isSupremeLeader && (
                                <button
                                  onClick={() => handleToggleApproval(base.id, base.approved)}
                                  className={`px-2 py-1 rounded font-mono text-[8px] font-black uppercase tracking-widest transition-all duration-200 flex items-center space-x-1.5 border ${
                                    base.approved
                                      ? "bg-amber-950/60 text-amber-400 border-amber-500"
                                      : "bg-zinc-950 text-zinc-550 border-zinc-850 hover:text-zinc-300 hover:border-zinc-700"
                                  }`}
                                  title="Toggles Master Leader Approval Badge Overlay"
                                >
                                  <CheckSquare className={`h-3 w-3 ${base.approved ? "text-amber-400" : "text-zinc-650"}`} />
                                  <span>{base.approved ? "APPROVED" : "APPROVE"}</span>
                                </button>
                              )}

                              {/* EDIT ACTION */}
                              {canEdit && (
                                <button
                                  onClick={() => {
                                    setEditingBase(base);
                                    setEditTitle(base.title);
                                    setEditDescription(base.description || "");
                                    setEditBaseLink(base.baseLink);
                                    setEditThLevel(base.thLevel);
                                    setEditImageUrl(base.imageUrl || "");
                                  }}
                                  className="p-1.5 rounded hover:bg-zinc-850 text-zinc-550 hover:text-amber-400 border border-transparent hover:border-zinc-800 transition"
                                  title="Edit defensive blueprint details and screenshot"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                              )}

                              {/* PURGE BUTTON */}
                              {canDelete && (
                                <button
                                  onClick={() => handleDeleteBase(base.id)}
                                  className="p-1.5 rounded hover:bg-red-950/15 text-zinc-600 hover:text-rose-500 border border-transparent hover:border-red-900/45 transition"
                                  title="Purge blueprint documentation from war database"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>

                          </div>

                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            )}
          </motion.div>
        </AnimatePresence>
      </div>
    )}

      {/* FULL UPLOAD MODAL DIALOG POPUP */}
      <AnimatePresence>
        {isOpenForm && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0b0505] border border-[#2b1717] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]"
            >
              
              {/* MODAL TITLE HEADER */}
              <div className="p-4 border-b border-[#210f0f] bg-[#070303] flex items-center justify-between">
                <div className="flex items-center space-x-2 text-rose-500">
                  <Layers className="h-4.5 w-4.5" />
                  <span className="font-mono text-xs font-black uppercase tracking-wider text-zinc-200">
                    TRANSMIT NEW DEFENSIVE COORDINATE
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpenForm(false)}
                  className="p-1.5 hover:bg-zinc-900 rounded-md text-zinc-400 hover:text-white transition"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* SELECTION TABS: SINGLE VS BULK */}
              <div className="grid grid-cols-2 border-b border-[#210f0f] bg-[#070303] text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setUploadMode("single")}
                  className={`py-3 font-black text-center border-r border-[#210f0f] transition ${
                    uploadMode === "single" 
                      ? "bg-[#110606] text-rose-500 font-extrabold" 
                      : "text-zinc-500 hover:text-rose-450 hover:bg-zinc-950/25"
                  }`}
                >
                  SINGLE BLUEPRINT
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode("bulk")}
                  className={`py-3 font-black text-center transition ${
                    uploadMode === "bulk" 
                      ? "bg-[#110606] text-rose-500 font-extrabold" 
                      : "text-zinc-500 hover:text-rose-450 hover:bg-zinc-950/25"
                  }`}
                >
                  IMPORT MULTIPLE (BULK)
                </button>
              </div>

              {uploadMode === "bulk" ? (
                <form onSubmit={handleBulkImport} className="p-5 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
                  
                  {/* VAULT DIRECTORY TARGET VERIFICATION */}
                  <div className="p-3 bg-[#110606] border border-red-950 rounded-xl">
                    <p className="font-mono text-[8px] text-zinc-550 uppercase tracking-wider mb-1">PUBLICATION SECTOR</p>
                    <p className="font-mono text-[11px] font-black text-rose-500 uppercase">
                      {activeTab === "not_humans" ? "🚨 BULK IMPORT: ENCRYPTED VAULT - SENIOR OFFICERS" : "👥 BULK IMPORT: PUBLIC CLAN DIRECTORY - MEMBERS GRID"}
                    </p>
                  </div>

                  {/* INFO AND PASTE BOX */}
                  <div>
                    <label className="block font-mono text-[9px] font-black uppercase text-zinc-500 tracking-wider mb-1">
                      PASTE STRUCTURAL BLUEPRINTS Array (JSON Format)
                    </label>
                    <textarea
                      placeholder='[&#10;  {&#10;    "title": "Anti-3 Star TH16",&#10;    "description": "Ice Golem fill",&#10;    "baseLink": "https://link.clashofclans.com/... ",&#10;    "thLevel": 16&#10;  }&#10;]'
                      value={bulkJson}
                      onChange={(e) => setBulkJson(e.target.value)}
                      rows={8}
                      className="w-full bg-[#0d0707] border border-[#2b1717] text-zinc-300 rounded-lg p-3 font-mono text-[10px] focus:ring-1 focus:ring-red-900 outline-none resize-none h-48 leading-relaxed placeholder-zinc-700"
                    />
                  </div>

                  {/* OPTIONAL TOWN HALL DEFAULT */}
                  <div>
                    <label className="block font-mono text-[9px] font-black uppercase text-zinc-500 tracking-wider mb-1">
                      FALLBACK TOWN HALL LEVEL
                    </label>
                    <select
                      value={formTh}
                      onChange={(e) => setFormTh(Number(e.target.value))}
                      className="w-full bg-[#0d0707] border border-[#2b1717] text-zinc-200 rounded-lg p-2 font-mono text-xs focus:ring-1 focus:ring-red-900 outline-none"
                    >
                      {TH_LEVELS.map(num => (
                        <option key={num} value={num}>Town Hall {num} (Fallback)</option>
                      ))}
                    </select>
                    <span className="block text-[8px] text-zinc-550 font-sans mt-1">
                      If layout JSON items do not define "thLevel", they fallback to this option.
                    </span>
                  </div>

                  {/* JSON TEMPLATE PREVIEW BOX WITH COPY CONTROLLER */}
                  <div className="bg-[#050202] border border-[#1f1010] p-3 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[8px] font-black text-amber-500/80 uppercase tracking-widest">
                        JSON TEMPLATE SCHEMATIC
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const template = `[\n  {\n    "title": "Base Title 16",\n    "description": "CC: 3 Ice Golems, very hard to lure.",\n    "baseLink": "https://link.clashofclans.com/en?action=OpenLayout&id=SHIELD-WALL",\n    "thLevel": 16\n  }\n]`;
                          navigator.clipboard.writeText(template);
                          triggerAlert("COPIED TO CLIPBOARD", "Template JSON format copied smoothly. You can paste and adjust this outside.");
                        }}
                        className="font-mono text-[8px] font-bold uppercase py-0.5 px-2 bg-zinc-900 border border-zinc-850 hover:border-zinc-700 text-zinc-350 hover:text-white rounded flex items-center space-x-1 transition"
                      >
                        <Copy className="h-2.5 w-2.5" />
                        <span>COPY TEMPLATE</span>
                      </button>
                    </div>
                    <pre className="text-[8px] font-mono text-zinc-500 overflow-x-auto bg-[#030101] p-2 rounded border border-zinc-950 max-h-24">
{`[
  {
    "title": "Anti-3 Star CWL Layout",
    "description": "Symmetrical design with off-centered TH.",
    "baseLink": "https://link.clashofclans.com/en?action=OpenLayout...",
    "thLevel": 16
  }
]`}
                    </pre>
                  </div>

                  {/* LOADING INDICATION STATE */}
                  {bulkImportProgress && (
                    <div className="p-2.5 bg-amber-950/15 border border-amber-955/65 rounded-xl flex items-center space-x-2">
                      <RefreshCw className="h-3.5 w-3.5 text-amber-500 animate-spin flex-shrink-0" />
                      <span className="font-mono text-[9px] uppercase font-black text-amber-400 tracking-wider">
                        {bulkImportProgress}
                      </span>
                    </div>
                  )}

                  {/* BUTTON ACTION CHANNELS */}
                  <div className="pt-3 flex space-x-3">
                    <button
                      type="button"
                      onClick={() => setIsOpenForm(false)}
                      className="flex-1 py-2.5 border border-[#2b1717] hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg font-mono text-[10px] font-black uppercase tracking-widest transition"
                    >
                      CANCEL
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || !bulkJson.trim()}
                      className="flex-1 py-2.5 bg-gradient-to-r from-red-950 to-[#260e0e] hover:from-red-900 hover:to-red-955 border border-red-900/60 disabled:opacity-20 text-red-200 disabled:cursor-not-allowed rounded-lg font-mono text-[10px] font-black uppercase tracking-widest transition flex items-center justify-center space-x-1"
                    >
                      {submitting ? (
                        <span>TRANSMITTING...</span>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" />
                          <span>IMPORT ALL PLAN DIRECTORIES</span>
                        </>
                      )}
                    </button>
                  </div>

                </form>
              ) : (
                <form onSubmit={handleAddBase} className="p-5 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
                  
                  {/* VAULT DIRECTORY TARGET VERIFICATION */}
                  <div className="p-3 bg-[#110606] border border-red-950 rounded-xl">
                    <p className="font-mono text-[8px] text-zinc-550 uppercase tracking-wider mb-1">PUBLICATION SECTOR</p>
                    <p className="font-mono text-[11px] font-black text-rose-500 uppercase">
                      {activeTab === "not_humans" ? "🚨 ENCRYPTED VAULT - SENIOR OFFICERS SECTOR" : "👥 PUBLIC CLAN DIRECTORY - MEMBERS GRID"}
                    </p>
                  </div>

                  {/* TH LEVELLER SECTOR */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-mono text-[9px] font-black uppercase text-zinc-500 tracking-wider mb-1">
                        TOWN HALL SECTOR
                      </label>
                      <select
                        value={formTh}
                        onChange={(e) => setFormTh(Number(e.target.value))}
                        className="w-full bg-[#0d0707] border border-[#2b1717] text-zinc-200 rounded-lg p-2 font-mono text-xs focus:ring-1 focus:ring-red-900 outline-none"
                      >
                        {TH_LEVELS.map(num => (
                          <option key={num} value={num}>Town Hall {num}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-mono text-[9px] font-black uppercase text-zinc-500 tracking-wider mb-1">
                        LAYOUT TITLE
                      </label>
                      <input
                        type="text"
                        placeholder="E.g., War Anti-3 Star"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={36}
                        className="w-full bg-[#0d0707] border border-[#2b1717] text-zinc-200 rounded-lg p-2 font-mono text-xs focus:ring-1 focus:ring-red-900 outline-none"
                      />
                    </div>
                  </div>

                  {/* COPY LAYOUT CoC LINK */}
                  <div>
                    <label className="block font-mono text-[9px] font-black uppercase text-zinc-500 tracking-wider mb-1">
                      CLASH COPY LAYOUT URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://link.clashofclans.com/en?action=OpenLayout..."
                      value={baseLink}
                      onChange={(e) => setBaseLink(e.target.value)}
                      className="w-full bg-[#0d0707] border border-[#2b1717] text-zinc-150 rounded-lg p-2 font-mono text-xs focus:ring-1 focus:ring-red-900 outline-none"
                    />
                    <span className="block text-[8px] text-zinc-550 font-sans mt-1">
                      To acquire, click 'Share' inside your Clash layout editor &gt; Copy Link.
                    </span>
                  </div>

                  {/* DESCRIPTION DIRECTIVES */}
                  <div>
                    <label className="block font-mono text-[9px] font-black uppercase text-zinc-500 tracking-wider mb-1">
                      BLUEPRINT DIRECTIVES & NOTES (OPTIONAL)
                    </label>
                    <textarea
                      placeholder="Anti-Lalo trap set, defensive ring offset, cc filled with super minions..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      maxLength={150}
                      className="w-full bg-[#0d0707] border border-[#2b1717] text-zinc-300 rounded-lg p-2 font-sans text-xs focus:ring-1 focus:ring-red-900 outline-none resize-none"
                    />
                  </div>

                  {/* DRAG SCREENSHOT BASE ENCLOSURE */}
                  <div>
                    <label className="block font-mono text-[9px] font-black uppercase text-zinc-500 tracking-wider mb-1">
                      BASE SCREENSHOT IMAGE
                    </label>
                    
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center relative ${
                        dragOverActive 
                          ? "border-red-500 bg-red-950/10" 
                          : imageUrl 
                            ? "border-emerald-500/50 bg-emerald-950/5" 
                            : "border-[#2b1717] hover:border-red-900 bg-[#0d0707]/60"
                      }`}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        id="base-screenshot-uploader"
                        onChange={handleImageChange}
                        className="hidden"
                      />

                      {compressing ? (
                        <div className="space-y-2">
                          <Upload className="h-8 w-8 text-amber-500 animate-spin mx-auto" />
                          <span className="block font-mono text-[9px] uppercase tracking-wider text-amber-400">
                            COMPRESSING & ENCRYPTING SHIELD...
                          </span>
                        </div>
                      ) : imageUrl ? (
                        <div className="space-y-2 relative w-full flex flex-col items-center">
                          <img
                            src={imageUrl}
                            alt="thumbnail"
                            className="h-28 object-cover rounded-lg border border-emerald-500/40"
                            referrerPolicy="no-referrer"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault(); e.stopPropagation(); setImageUrl("");
                            }}
                            className="absolute -top-1.5 right-11 p-1 bg-red-900/90 hover:bg-red-800 text-white rounded-full transition"
                            title="Purge preview image"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          <span className="block font-mono text-[8px] text-emerald-400 uppercase font-black">
                            ✓ BLUEPRINT READY (AUTO-COMPRESSED SECURE)
                          </span>
                        </div>
                      ) : (
                        <label htmlFor="base-screenshot-uploader" className="w-full h-full block cursor-pointer">
                          <Upload className="h-8 w-8 text-zinc-650 mx-auto group-hover:text-red-500 mb-2" />
                          <span className="block font-sans text-xs text-zinc-300 font-medium">
                            Drag and drop Base Screenshot, or <span className="text-red-400 underline">browse files</span>
                          </span>
                          <span className="block font-mono text-[8px] text-zinc-550 uppercase tracking-widest mt-1">
                            JPG OR PNG SHIELDS (AUTO COMPRESSED TO SUB 40KB)
                          </span>
                        </label>
                      )}
                    </div>
                  </div>

                  {/* MODAL FOOTER BUTTON ACTION CHANNELS */}
                  <div className="pt-3 flex space-x-3">
                    <button
                      type="button"
                      onClick={() => setIsOpenForm(false)}
                      className="flex-1 py-2.5 border border-[#2b1717] hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg font-mono text-[10px] font-black uppercase tracking-widest transition"
                    >
                      CANCEL
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || compressing || !imageUrl || !title.trim() || !baseLink.trim()}
                      className="flex-1 py-2.5 bg-gradient-to-r from-red-950 to-[#260e0e] hover:from-red-900 hover:to-red-950 border border-red-900/60 disabled:opacity-20 text-red-200 disabled:cursor-not-allowed rounded-lg font-mono text-[10px] font-black uppercase tracking-widest transition flex items-center justify-center space-x-1"
                    >
                      {submitting ? (
                        <span>TRANSMITTING...</span>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" />
                          <span>PUBLISH PLAN</span>
                        </>
                      )}
                    </button>
                  </div>

                </form>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT MODAL DIALOG POPUP */}
      <AnimatePresence>
        {editingBase !== null && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0b0505] border border-[#2b1717] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]"
            >
              
              {/* MODAL TITLE HEADER */}
              <div className="p-4 border-b border-[#210f0f] bg-[#070303] flex items-center justify-between">
                <div className="flex items-center space-x-2 text-rose-500">
                  <Edit className="h-4.5 w-4.5" />
                  <span className="font-mono text-xs font-black uppercase tracking-wider text-zinc-200">
                    MODULATE BLUEPRINT CONFIGURATION
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingBase(null)}
                  className="p-1.5 hover:bg-zinc-900 rounded-md text-zinc-400 hover:text-white transition"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* MODAL FORM CONTAINER */}
              <form onSubmit={handleEditBaseSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
                
                {/* VAULT DIRECTORY TARGET VERIFICATION */}
                <div className="p-3 bg-[#110606] border border-red-950 rounded-xl">
                  <p className="font-mono text-[8px] text-zinc-550 uppercase tracking-wider mb-1">TARGET IDENTIFICATION</p>
                  <p className="font-mono text-[11px] font-black text-rose-500 uppercase">
                    Editing: {editingBase.title} ({editingBase.vaultType === "not_humans" ? "🚨 Private Elite Vault" : "👥 Public Registry"})
                  </p>
                </div>

                {/* TH LEVELLER SECTOR */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-mono text-[9px] font-black uppercase text-zinc-500 tracking-wider mb-1">
                      TOWN HALL SECTOR
                    </label>
                    <select
                      value={editThLevel}
                      onChange={(e) => setEditThLevel(Number(e.target.value))}
                      className="w-full bg-[#0d0707] border border-[#2b1717] text-zinc-200 rounded-lg p-2 font-mono text-xs focus:ring-1 focus:ring-red-900 outline-none"
                    >
                      {TH_LEVELS.map(num => (
                        <option key={num} value={num}>Town Hall {num}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-mono text-[9px] font-black uppercase text-zinc-500 tracking-wider mb-1">
                      LAYOUT TITLE
                    </label>
                    <input
                      type="text"
                      placeholder="E.g., War Anti-3 Star"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      maxLength={36}
                      className="w-full bg-[#0d0707] border border-[#2b1717] text-zinc-200 rounded-lg p-2 font-mono text-xs focus:ring-1 focus:ring-red-900 outline-none"
                    />
                  </div>
                </div>

                {/* COPY LAYOUT CoC LINK */}
                <div>
                  <label className="block font-mono text-[9px] font-black uppercase text-zinc-500 tracking-wider mb-1">
                    CLASH COPY LAYOUT URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://link.clashofclans.com/en?action=OpenLayout..."
                    value={editBaseLink}
                    onChange={(e) => setEditBaseLink(e.target.value)}
                    className="w-full bg-[#0d0707] border border-[#2b1717] text-zinc-150 rounded-lg p-2 font-mono text-xs focus:ring-1 focus:ring-red-900 outline-none"
                  />
                </div>

                {/* DESCRIPTION DIRECTIVES */}
                <div>
                  <label className="block font-mono text-[9px] font-black uppercase text-zinc-500 tracking-wider mb-1">
                    BLUEPRINT DIRECTIVES & NOTES (OPTIONAL)
                  </label>
                  <textarea
                    placeholder="Anti-Lalo trap set, defensive ring offset, cc filled with super minions..."
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={2}
                    maxLength={150}
                    className="w-full bg-[#0d0707] border border-[#2b1717] text-zinc-300 rounded-lg p-2 font-sans text-xs focus:ring-1 focus:ring-red-900 outline-none resize-none"
                  />
                </div>

                {/* DRAG SCREENSHOT BASE ENCLOSURE */}
                <div>
                  <label className="block font-mono text-[9px] font-black uppercase text-zinc-500 tracking-wider mb-1">
                    BASE SCREENSHOT IMAGE
                  </label>
                  
                  <div
                    onDragOver={handleEditDragOver}
                    onDragLeave={handleEditDragLeave}
                    onDrop={handleEditDrop}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center relative ${
                      editDragOverActive 
                        ? "border-red-500 bg-red-950/10" 
                        : editImageUrl 
                          ? "border-emerald-500/50 bg-emerald-950/5" 
                          : "border-[#2b1717] hover:border-red-900 bg-[#0d0707]/60"
                    }`}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      id="edit-screenshot-uploader"
                      onChange={handleEditImageChange}
                      className="hidden"
                    />

                    {editCompressing ? (
                      <div className="space-y-2">
                        <Upload className="h-8 w-8 text-amber-500 animate-spin mx-auto" />
                        <span className="block font-mono text-[9px] uppercase tracking-wider text-amber-400">
                          COMPRESSING & ENCRYPTING SHIELD...
                        </span>
                      </div>
                    ) : editImageUrl ? (
                      <div className="space-y-2 relative w-full flex flex-col items-center">
                        <img
                          src={editImageUrl}
                          alt="thumbnail"
                          className="h-28 object-cover rounded-lg border border-emerald-500/40"
                          referrerPolicy="no-referrer"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault(); e.stopPropagation(); setEditImageUrl("");
                          }}
                          className="absolute -top-1.5 right-11 p-1 bg-red-900/90 hover:bg-red-800 text-white rounded-full transition"
                          title="Purge preview image"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <span className="block font-mono text-[8px] text-emerald-400 uppercase font-black">
                          ✓ BLUEPRINT PHOTO MODULATED (AUTO-COMPRESSED SECURE)
                        </span>
                      </div>
                    ) : (
                      <label htmlFor="edit-screenshot-uploader" className="w-full h-full block cursor-pointer">
                        <Upload className="h-8 w-8 text-zinc-650 mx-auto group-hover:text-amber-500 mb-2" />
                        <span className="block font-sans text-xs text-zinc-300 font-medium">
                          Drag and drop Base Screenshot, or <span className="text-red-450 underline">browse files</span>
                        </span>
                        <span className="block font-mono text-[8px] text-zinc-550 uppercase tracking-widest mt-1">
                          JPG OR PNG SHIELDS (AUTO COMPRESSED TO SUB 40KB)
                        </span>
                      </label>
                    )}
                  </div>
                </div>

                {/* MODAL FOOTER BUTTON ACTION CHANNELS */}
                <div className="pt-3 flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setEditingBase(null)}
                    className="flex-1 py-2.5 border border-[#2b1717] hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-lg font-mono text-[10px] font-black uppercase tracking-widest transition"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={editSubmitting || editCompressing || !editTitle.trim() || !editBaseLink.trim()}
                    className="flex-1 py-2.5 bg-gradient-to-r from-amber-950 to-[#26180e] hover:from-amber-900 hover:to-amber-955 border border-amber-900/60 disabled:opacity-20 text-amber-200 disabled:cursor-not-allowed rounded-lg font-mono text-[10px] font-black uppercase tracking-widest transition flex items-center justify-center space-x-1"
                  >
                    {editSubmitting ? (
                      <span>SAVING BLUEPRINT...</span>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>UPDATE CODES</span>
                      </>
                    )}
                  </button>
                </div>

              </form>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LIGHTBOX MAGNIFIED SCREENSHOT OVERLAY */}
      <AnimatePresence>
        {lightboxImg && (
          <div 
            onClick={() => setLightboxImg(null)}
            className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 cursor-zoom-out"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative max-w-4xl w-full max-h-[90vh] flex items-center justify-center rounded-xl overflow-hidden shadow-2xl border border-zinc-800 bg-[#0d0707]"
            >
              <img
                src={lightboxImg}
                alt="Magnified Blueprint Preview"
                className="max-w-full max-h-[85vh] object-contain"
                referrerPolicy="no-referrer"
              />
              <button
                onClick={() => setLightboxImg(null)}
                className="absolute top-4 right-4 p-2 bg-black/90 border border-zinc-800 rounded-full text-zinc-400 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CUSTOM DIALOG ALERTS/CONFIRMS */}
      <AnimatePresence>
        {modalDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-xl border border-red-950 bg-[#0c0505] p-5 shadow-2xl relative"
            >
              <div className="flex items-center space-x-2 text-rose-500 mb-2">
                <ShieldAlert className="h-5 w-5 animate-pulse" />
                <span className="font-mono text-xs font-black uppercase tracking-wider text-zinc-200">
                  {modalDialog.title}
                </span>
              </div>
              <p className="font-sans text-xs text-zinc-400 leading-relaxed whitespace-pre-line mt-2">
                {modalDialog.message}
              </p>
              <div className="mt-5 flex justify-end space-x-2.5">
                {modalDialog.type === "confirm" ? (
                  <>
                    <button
                      onClick={() => setModalDialog(null)}
                      className="px-3.5 py-1.5 border border-zinc-800 hover:bg-zinc-900 text-zinc-450 hover:text-white rounded font-mono text-[9px] font-black uppercase tracking-wide transition cursor-pointer"
                    >
                      {modalDialog.leftBtnText || "Cancel"}
                    </button>
                    <button
                      onClick={() => {
                        if (modalDialog.onRightBtn) modalDialog.onRightBtn();
                        setModalDialog(null);
                      }}
                      className="px-3.5 py-1.5 bg-red-950 border border-red-800 hover:bg-red-900 text-red-200 hover:text-white rounded font-mono text-[9px] font-black uppercase tracking-wide transition cursor-pointer"
                    >
                      {modalDialog.rightBtnText || "Confirm, Master"}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setModalDialog(null)}
                    className="px-4 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-200 hover:text-white rounded font-mono text-[9px] font-black uppercase tracking-wide transition cursor-pointer"
                  >
                    {modalDialog.leftBtnText || "Understood"}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
