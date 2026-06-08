import React, { useState, useEffect, useRef } from "react";
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  addDoc, 
  setDoc, 
  serverTimestamp, 
  updateDoc, 
  doc, 
  deleteDoc,
  getDocs,
  where
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { ChatMessage, CoCRole, Member } from "../types";
import { 
  Send, 
  Pin, 
  Reply, 
  Search, 
  MessageSquare, 
  Flame, 
  Trash2, 
  Image, 
  ShieldAlert, 
  Eye, 
  EyeOff, 
  Clock, 
  RefreshCw, 
  Swords,
  Lock,
  Unlock,
  Plus,
  Tv,
  HelpCircle,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Users,
  Megaphone,
  Check,
  MoreVertical,
  X,
  Menu
} from "lucide-react";

interface WarRoomSectionProps {
  userUid: string;
  userEmail?: string;
  userName: string;
  cocRole: CoCRole | null;
  playerTag: string;
  onInspectPlayer?: (tag: string) => void;
  onToggleSidebar?: () => void;
  allMembers?: Member[];
  unreadCounts?: Record<string, number>;
  activeRoomGlobal?: string;
  onChangeRoom?: (roomId: string) => void;
}

const CHANNELS = [
  { id: "announcements", name: "# 📢-announcements", label: "Announcements", description: "Official tactical alerts & war plans", restricted: true },
  { id: "general", name: "# 💬-general-chat", label: "General Chat", description: "Standard tactical talks with squad", restricted: false },
  { id: "war", name: "# ⚔️-war-coordination", label: "War Room", description: "Attack coordinates, base assignments & plan syncs", restricted: false },
  { id: "layouts", name: "# 🏰-base-layouts", label: "Defence Layouts", description: "Post and copy elite defense strategies", restricted: false },
  { id: "polls", name: "# 📊-strategic-polls", label: "Tactical Polls", description: "Deploy surveys for active deployment plans", restricted: false }
];

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
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 600;
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

export default function WarRoomSection({ 
  userUid, 
  userEmail, 
  userName, 
  cocRole, 
  playerTag, 
  onInspectPlayer, 
  onToggleSidebar, 
  allMembers = [],
  unreadCounts,
  activeRoomGlobal,
  onChangeRoom
}: WarRoomSectionProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeRoom, setActiveRoom] = useState<string>(activeRoomGlobal || "general");

  // Keep local activeRoom state synchronized with parent's activeRoomGlobal prop
  useEffect(() => {
    if (activeRoomGlobal && activeRoomGlobal !== activeRoom) {
      setActiveRoom(activeRoomGlobal);
    }
  }, [activeRoomGlobal]);

  // Report changes back up to parent
  useEffect(() => {
    onChangeRoom?.(activeRoom);
  }, [activeRoom, onChangeRoom]);
  const [inputText, setInputText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [showImgInput, setShowImgInput] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [pinnedOption, setPinnedOption] = useState<"text" | "image">("text");
  const [limitCount, setLimitCount] = useState(40);
  const [showMobileChannels, setShowMobileChannels] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic Pin badges for Master
  const [lastPinnedCount, setLastPinnedCount] = useState(0);
  const [unreadPinsCount, setUnreadPinsCount] = useState(0);

  useEffect(() => {
    const currentPins = messages.filter(m => m.pinned && !m.isDeleted).length;
    // If a new message is pinned and the user is not looking at the pinned panel, increment unread counts
    if (currentPins > lastPinnedCount) {
      if (!showPinnedOnly) {
        setUnreadPinsCount(prev => prev + (currentPins - lastPinnedCount));
      }
    } else if (currentPins < lastPinnedCount) {
      setUnreadPinsCount(prev => Math.max(0, prev - (lastPinnedCount - currentPins)));
    }
    setLastPinnedCount(currentPins);
  }, [messages, showPinnedOnly, lastPinnedCount]);

  const handleToggleShowPinnedOnly = () => {
    const nextVal = !showPinnedOnly;
    setShowPinnedOnly(nextVal);
    if (nextVal) {
      setUnreadPinsCount(0);
    }
  };

  // Parsing individual mentions helper so the full background is not green
  const renderMessageTextWithMentions = (text: string) => {
    if (!text) return "";
    if (!text.includes("@")) {
      return text;
    }

    // 1. Sort members with spaces in their name by name length descending
    // (so we match longer names first to prevent partial matches)
    const membersWithSpaces = (allMembers || [])
      .filter(m => m.playerName && m.playerName.includes(" "))
      .sort((a, b) => (b.playerName?.length || 0) - (a.playerName?.length || 0));

    // Token map to hold elements
    const tokenMap: Record<string, string> = {};
    let processedText = text;

    membersWithSpaces.forEach((member, i) => {
      const mentionStr = `@${member.playerName}`;
      // Use a safe token replacement
      if (processedText.includes(mentionStr)) {
        const tokenId = `___MENTION_TOKEN_SPACE_${i}___`;
        tokenMap[tokenId] = mentionStr;
        // Replace all occurrences of this precise mention with the token
        processedText = processedText.split(mentionStr).join(tokenId);
      }
    });

    // 2. Split the processed text by standard mentions (without spaces)
    const parts = processedText.split(/(\@[A-Za-z0-9_#⚡🏹🗡️🛡️✨\-\u4e00-\u9fa5\u3040-\u30ff\u31f0-\u31ff\uff00-\uffef]+)/g);

    return (
      <>
        {parts.map((part, index) => {
          // If it matches a token from our space map
          if (part && tokenMap[part]) {
            return (
              <span
                key={`space-${index}`}
                className="text-emerald-600 font-extrabold select-all cursor-pointer hover:underline mx-0.5"
              >
                {tokenMap[part]}
              </span>
            );
          }
          // If it is a standard non-space mention
          if (part.startsWith("@") && part.length > 1) {
            return (
              <span
                key={`standard-${index}`}
                className="text-emerald-600 font-extrabold select-all cursor-pointer hover:underline mx-0.5"
              >
                {part}
              </span>
            );
          }
          return <span key={`text-${index}`}>{part}</span>;
        })}
      </>
    );
  };
  
  // Real-time lock settings state
  const [lockedRooms, setLockedRooms] = useState<Record<string, boolean>>({});
  
  // States for dynamic war monitoring
  const [warState, setWarState] = useState<any>(null);
  const [loadingWar, setLoadingWar] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<string>("SYNCING...");
  const [syncing, setSyncing] = useState(false);

  // Poll creator states (Generals only)
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  // Tactical Operational states
  const [showDevSheet, setShowDevSheet] = useState(false);
  const [activeMenuMsg, setActiveMenuMsg] = useState<ChatMessage | null>(null);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFullScreenImage(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  // 1. Fetch live War status from Clash of Clans Developer API
  const fetchWarStatus = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/currentwar");
      if (res.ok) {
        const data = await res.json();
        setWarState(data);
      }
    } catch (err) {
      console.warn("Could not sync active war telemetry logs:", err);
    } finally {
      setLoadingWar(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchWarStatus();
    const interval = setInterval(fetchWarStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // 2. Real-time war timer stopwatch
  useEffect(() => {
    if (!warState) return;

    const parseCocTimestamp = (ts: string) => {
      if (!ts) return null;
      try {
        const year = ts.substring(0, 4);
        const month = ts.substring(4, 6);
        const day = ts.substring(6, 8);
        const hour = ts.substring(9, 11);
        const min = ts.substring(11, 13);
        const sec = ts.substring(13, 15);
        return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}.000Z`);
      } catch (e) {
        return null;
      }
    };

    const timer = setInterval(() => {
      const now = new Date();
      let targetDate: Date | null = null;
      let label = "";

      if (warState.state === "preparation") {
        targetDate = parseCocTimestamp(warState.startTime);
        label = "WAR DAY BEGINS IN";
      } else if (warState.state === "inWar") {
        targetDate = parseCocTimestamp(warState.endTime);
        label = "WAR ENDS IN";
      }

      if (!targetDate) {
        if (warState.state === "warEnded") {
          setTimeRemaining("WAR ENDED");
        } else if (warState.state === "notInWar") {
          setTimeRemaining("NO ACTIVE WAR");
        } else {
          setTimeRemaining("UNKNOWN STATUS");
        }
        return;
      }

      const diff = targetDate.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeRemaining("00h 00m 00s");
        fetchWarStatus();
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        const pad = (n: number) => n.toString().padStart(2, "0");
        setTimeRemaining(`${label}: ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [warState]);

  // 3. Listen to real-time locks
  useEffect(() => {
    const lockRef = doc(db, "chats_settings", "rooms");
    const unsub = onSnapshot(lockRef, (docSnap) => {
      if (docSnap.exists()) {
        setLockedRooms(docSnap.data() || {});
      } else {
        setLockedRooms({});
      }
    }, (error) => {
      console.warn("Unable to fetch room locks safely:", error.message);
    });
    return () => unsub();
  }, []);

  // 4. Load messages with custom reactivity
  useEffect(() => {
    const q = query(
      collection(db, "chats"),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: ChatMessage[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.room === activeRoom) {
          list.push({
            id: docSnap.id,
            text: data.text || "",
            authorUid: data.authorUid || "",
            authorName: data.authorName || "Member",
            authorTag: data.authorTag || "",
            authorRole: data.authorRole || "Member",
            room: data.room || "general",
            imageUrl: data.imageUrl || "",
            createdAt: data.createdAt,
            pinned: !!data.pinned,
            replyTo: data.replyTo || "",
            reactions: data.reactions || {},
            isPoll: !!data.isPoll,
            pollOptions: data.pollOptions || [],
            pollVotes: data.pollVotes || {},
            isInspectCard: !!data.isInspectCard,
            inspectedPlayer: data.inspectedPlayer || null,
            isDeleted: !!data.isDeleted,
            deletedBy: data.deletedBy || ""
          } as any);
        }
      });
      
      // Reverse array so old messages remain at the top
      setMessages(list.reverse());
      
      // Auto-scroll inside chat box element
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTo({
            top: messagesContainerRef.current.scrollHeight,
            behavior: "smooth"
          });
        }
      }, 150);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "chats");
    });

    return () => unsubscribe();
  }, [activeRoom, limitCount]);

  // Handle locking/unlocking trigger
  const handleToggleRoomLock = async () => {
    if (cocRole !== "Leader" && cocRole !== "Co-Leader") {
      alert("Master, only Leaders and Co-Leaders can toggle locked channels.");
      return;
    }
    try {
      const currentVal = !!lockedRooms[activeRoom];
      await setDoc(doc(db, "chats_settings", "rooms"), {
        [activeRoom]: !currentVal
      }, { merge: true });
    } catch (err: any) {
      console.error("Lock saving failed:", err);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressing(true);
    try {
      const compressedStr = await compressAndGetBase64(file);
      setImageUrl(compressedStr);
    } catch (err) {
      console.error("Compression failed:", err);
      alert("Master, there was an issue processing the battlefield transmission image.");
    } finally {
      setCompressing(false);
    }
  };

  // General Post message handler
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check locked state restriction
    const isLocked = !!lockedRooms[activeRoom];
    const isAuthorized = cocRole === "Leader" || cocRole === "Co-Leader";
    if (isLocked && !isAuthorized) {
      alert("Master, this channel is locked by battle command. You do not have permissions to compose messages.");
      return;
    }

    // Check announcement channel restriction
    const channelDef = CHANNELS.find(c => c.id === activeRoom);
    if (channelDef?.restricted && !isAuthorized) {
      alert("Master, only Leaders/Co-Leaders can broadcast in the announcements channel!");
      return;
    }

    const trimmedInput = inputText.trim();
    if (trimmedInput.startsWith("/clearall")) {
      const isSupremeLeader = playerTag?.toUpperCase().trim() === "#PV9GPQPUC" || cocRole === "Leader";
      if (!isSupremeLeader) {
        triggerAlert("COMMAND ERROR", "SECURE COMMAND FAILURE: Master, ONLY the Supreme Leader ('Leader') has clearall authority in this war room!");
        return;
      }
      triggerConfirm(
        "CONFIRM BROAD ALL CHANNEL CLEAR",
        "Supreme Leader, do you authorize the absolute deletion of all transmissions in this tactical channel?",
        async () => {
          try {
            const q = query(collection(db, "chats"), where("room", "==", activeRoom));
            const snap = await getDocs(q);
            const deletePromises = snap.docs.map(docSnap => deleteDoc(docSnap.ref));
            await Promise.all(deletePromises);
            setInputText("");
            triggerAlert("CHANNEL PURGED", `Comrade, channel #${activeRoom} has been successfully purged of all communications by order of the Supreme Commander!`);
          } catch (err) {
            console.error("Purge failure:", err);
            triggerAlert("COMMAND PURGE ERROR", "Master, there stood an error while executing the absolute channel clearall sequence.");
          }
        }
      );
      return;
    }

    if (trimmedInput.startsWith("/inspect")) {
      let targetName = trimmedInput.substring(8).trim();
      if (targetName.startsWith("@")) {
        targetName = targetName.substring(1).trim();
      }
      if (!targetName) {
        alert("ERROR: Shorthand inspect incorrect format, Master. Use: /inspect @[player name]");
        return;
      }
      
      const matched = allMembers.find(m => {
        const cleanMatchedName = (m.playerName || m.playerName || "").toLowerCase().trim().replace(/⚡/g, "");
        const queryClean = targetName.toLowerCase().trim();
        return cleanMatchedName === queryClean || 
               (m.playerName || m.playerName || "").toLowerCase().trim() === queryClean ||
               (cleanMatchedName.includes(queryClean) && queryClean.length >= 3);
      });

      if (!matched) {
        alert(`Master, no active registered player found matching "${targetName}" inside our database roster.`);
        return;
      }

      try {
        const leagueLogoUrl = (matched as any).leagueTier?.iconUrls?.small || (matched as any).league?.iconUrls?.small || "https://api-assets.clashofclans.com/leagues/72/e--YMyIexEQQhE4imLoJcwhYn6Uy8KqlgyY3_kFV6t4.png";
        
        await addDoc(collection(db, "chats"), {
          text: `/inspect @${matched.playerName}`,
          authorUid: userUid,
          authorName: userName,
          authorTag: playerTag || "",
          authorRole: cocRole || "Member",
          room: activeRoom,
          createdAt: serverTimestamp(),
          pinned: false,
          reactions: {},
          isInspectCard: true,
          inspectedPlayer: {
            playerName: matched.playerName || "Warrior",
            playerTag: matched.playerTag || "",
            warStars: matched.warStars || 0,
            townHall: matched.townHall || 12,
            trophies: matched.trophies || 0,
            role: matched.role || "Member",
            specialty: matched.specialty || "Standard Assault",
            photoUrl: matched.photoUrl || "",
            leagueName: (matched as any).leagueTier?.name || (matched as any).league?.name || "Unranked",
            leagueLogo: leagueLogoUrl
          }
        });

        setInputText("");
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, "chats");
      }
      return;
    }

    if (!inputText.trim() && !imageUrl.trim()) return;

    try {
      let replyContext = "";
      if (replyTo) {
        replyContext = `@${replyTo.authorName}: "${replyTo.text.substring(0, 45)}${replyTo.text.length > 45 ? "..." : ""}"`;
      }

      await addDoc(collection(db, "chats"), {
        text: inputText.trim(),
        authorUid: userUid,
        authorName: userName,
        authorTag: playerTag || "",
        authorRole: cocRole || "Member",
        room: activeRoom,
        imageUrl: imageUrl.trim() || null,
        createdAt: serverTimestamp(),
        pinned: false,
        replyTo: replyContext,
        reactions: {}
      });

      setInputText("");
      setImageUrl("");
      setShowImgInput(false);
      setReplyTo(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "chats");
    }
  };

  // Create real-time poll handler
  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cocRole !== "Leader" && cocRole !== "Co-Leader") {
      alert("Master, only Generals can post tactical poll surveys.");
      return;
    }
    
    const validOptions = pollOptions.filter(opt => opt.trim() !== "");
    if (!pollQuestion.trim() || validOptions.length < 2) {
      alert("Please specify a valid survey query and at least two responses, Master.");
      return;
    }

    try {
      const votesMock: Record<string, string[]> = {};
      validOptions.forEach(opt => {
        votesMock[opt] = [];
      });

      await addDoc(collection(db, "chats"), {
        text: pollQuestion.trim(),
        authorUid: userUid,
        authorName: userName,
        authorTag: playerTag || "",
        authorRole: cocRole || "Member",
        room: activeRoom,
        createdAt: serverTimestamp(),
        pinned: false,
        isPoll: true,
        pollOptions: validOptions,
        pollVotes: votesMock
      });

      setPollQuestion("");
      setPollOptions(["", ""]);
      setShowPollCreator(false);
    } catch (err) {
      console.error("Poll deploy failed:", err);
      alert("Could not post tactical poll.");
    }
  };

  // Vote on options in real-time
  const handleVote = async (msgId: string, option: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    const currentVotes = { ...msg.pollVotes } as any;
    
    // Toggle userUid across options
    Object.keys(currentVotes).forEach(optKey => {
      let uids = currentVotes[optKey] || [];
      if (optKey === option) {
        if (uids.includes(userUid)) {
          uids = uids.filter((id: string) => id !== userUid);
        } else {
          uids.push(userUid);
        }
      } else {
        // Enforce single-choice standard
        uids = uids.filter((id: string) => id !== userUid);
      }
      currentVotes[optKey] = uids;
    });

    try {
      await updateDoc(doc(db, "chats", msgId), {
        pollVotes: currentVotes
      });
    } catch (err) {
      console.error("Vote register failed:", err);
    }
  };

  const handleAddReaction = async (msgId: string, emoji: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    const currentReactions = { ...msg.reactions };
    let usersList = currentReactions[emoji] || [];

    if (usersList.includes(userUid)) {
      usersList = usersList.filter(uid => uid !== userUid);
    } else {
      usersList.push(userUid);
    }

    if (usersList.length === 0) {
      delete currentReactions[emoji];
    } else {
      currentReactions[emoji] = usersList;
    }

    try {
      await updateDoc(doc(db, "chats", msgId), {
        reactions: currentReactions
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `chats/${msgId}`);
    }
  };

  const handleTogglePin = async (msgId: string, currentPin: boolean) => {
    if (cocRole !== "Leader" && cocRole !== "Co-Leader") {
      triggerAlert("UNAUTHORIZED ACTION", "Only Leaders and Co-Leaders have authorization to toggle pinned transmissions.");
      return;
    }
    try {
      await updateDoc(doc(db, "chats", msgId), {
        pinned: !currentPin
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `chats/${msgId}`);
    }
  };

  const canDeleteMsg = (msg: ChatMessage) => {
    const isSupremeLeaderEmail = userEmail?.toLowerCase().trim() === "waizmonazzum270@gmail.com";
    if (isSupremeLeaderEmail) {
      return true;
    }
    const isMessageFromSupreme = msg.authorTag?.toUpperCase().trim() === "#PV9GPQPUC";
    const isLeader = cocRole === "Leader";
    const isCoLeader = cocRole === "Co-Leader";
    const isMe = msg.authorUid === userUid;

    if (isLeader) {
      return !isMessageFromSupreme;
    }
    if (isCoLeader) {
      return !isMessageFromSupreme;
    }
    // Member or Elder can only delete their own message
    return isMe;
  };

  const handleDelete = async (msgId: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) {
      triggerAlert("CACHE REFERENCE MISSING", "Error: Transmission record not found in tactical cache registry.");
      return;
    }

    const isSupremeLeaderEmail = userEmail?.toLowerCase().trim() === "waizmonazzum270@gmail.com";
    const allowed = canDeleteMsg(msg);
    if (!allowed) {
      triggerAlert(
        "SECURE SHIELD SYSTEM",
        "Action Blocked: You do not possess the authorization status required to purge this premium secure transmission."
      );
      return;
    }

    // If Supreme Leader is logged in, they get the premium soft-deletion flow (and perm purge for already soft-deleted)
    if (isSupremeLeaderEmail) {
      if (msg.isDeleted) {
        triggerConfirm(
          "CONFIRM PERMANENT DELETION",
          "Are you sure you want to permanently purge this transmission from the secure database archives?",
          async () => {
            try {
              await deleteDoc(doc(db, "chats", msgId));
              triggerAlert("PURGED", "Success: Transmission permanently purged from database archives.");
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : String(err);
              triggerAlert("PURGE ERROR", `Database purge operation failed!\n\nError: ${errMsg}`);
              handleFirestoreError(err, OperationType.DELETE, `chats/${msgId}`);
            }
          }
        );
        return;
      }

      // Soft delete so only Supreme Leader retains visual reference, while standard users and co-leaders lose connection completely
      triggerConfirm(
        "CONFIRM DELETION",
        "Are you sure you want to delete this transmission? This will remove it from the channel listing.",
        async () => {
          try {
            await updateDoc(doc(db, "chats", msgId), {
              isDeleted: true,
              deletedBy: userName || "Leader",
              deletedAt: serverTimestamp()
            });
            triggerAlert("DELETED", "Success: Transmission deleted successfully.");
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            triggerAlert("DELETE ERROR", `Deletion failed!\n\nError: ${errMsg}`);
            handleFirestoreError(err, OperationType.DELETE, `chats/${msgId}`);
          }
        }
      );
      return;
    }

    // For EVERYONE ELSE (including Co-Leaders, normal Leaders, and other members):
    // Standard visual confirmation of permanent deletion, but under the hood we write soft-delete so that the Supreme Leader still sees it!
    triggerConfirm(
      "CONFIRM DELETION",
      "Are you sure you want to delete this transmission permanently? This action cannot be undone.",
      async () => {
        try {
          await updateDoc(doc(db, "chats", msgId), {
            isDeleted: true,
            deletedBy: userName || "User",
            deletedAt: serverTimestamp()
          });
          triggerAlert("DELETED", "Success: Transmission permanently deleted from the channel.");
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          triggerAlert("DELETE ERROR", `Deletion operation failed!\n\nError: ${errMsg}`);
          handleFirestoreError(err, OperationType.DELETE, `chats/${msgId}`);
        }
      }
    );
  };

  // Searching filters
  const isSupremeLeaderEmail = userEmail?.toLowerCase().trim() === "waizmonazzum270@gmail.com";

  const filteredMessages = messages.filter((msg) => {
    // Only the supreme leader who logged in with email waizmonazzum270@gmail.com can see soft-deleted messages
    if (msg.isDeleted && !isSupremeLeaderEmail) {
      return false;
    }
    const textMatch = msg.text.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      msg.authorName.toLowerCase().includes(searchQuery.toLowerCase());
    if (showPinnedOnly) {
      if (pinnedOption === "image") {
        return textMatch && msg.pinned && !!msg.imageUrl;
      } else {
        return textMatch && msg.pinned && !msg.imageUrl;
      }
    }
    return textMatch;
  });

  const isCurrentRoomLocked = !!lockedRooms[activeRoom];
  const activeChannelDef = CHANNELS.find(c => c.id === activeRoom) || CHANNELS[1];

  return (
    <div className="w-full h-full animate-fade-in flex flex-col max-w-none">
      
      {/* Central Chat Dashboard - 100% Full Screen Width and Height for Ultimate Modern Readability */}
      <div className="flex flex-col tracking-wide h-full w-full flex-1">
        
        {/* MAIN CHAT AREA WITH INF SCHEME - Professional WhatsApp-Inspired Light Theme */}
        <div className="w-full border-none lg:border lg:border-zinc-200 bg-white rounded-none lg:rounded-2xl flex flex-col h-full flex-1 overflow-hidden relative shadow-2xl">
          
          {/* Top Panel stats bar - Polished White layout */}
          <div className="bg-white p-3.5 border-b border-zinc-200 flex items-center justify-between relative z-30">
            <div className="flex items-center space-x-2 w-full md:w-auto min-w-0 select-none">
              {/* Mobile Sidebar Hamburger Toggle - visible across viewport matching full-screen layouts */}
              {onToggleSidebar && (
                <button
                  type="button"
                  onClick={onToggleSidebar}
                  className="flex p-2 -ml-1 mr-1 text-zinc-650 hover:text-red-650 hover:bg-zinc-100 rounded-lg transition duration-150 cursor-pointer items-center justify-center active:scale-95"
                  title="Open tactile dashboard menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
              )}
              
              <span className="text-base hidden sm:inline">💬</span>
              <div className="min-w-0 flex-1">
                <span className="font-sans text-xs font-black text-zinc-900 uppercase tracking-wider flex items-center gap-1.5 truncate">
                  {CHANNELS.find(c => c.id === activeRoom)?.name || `# ${activeRoom}`}
                  {isCurrentRoomLocked && (
                    <span className="text-[9px] bg-red-50 border border-red-100 text-red-650 px-1.5 py-0.5 rounded-full font-mono uppercase font-black shrink-0 animate-pulse">
                      🔒 Secured Lock
                    </span>
                  )}
                </span>
                <span className="block font-sans text-[10px] text-zinc-450 font-bold truncate">{activeChannelDef.description}</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 shrink-0">
              <div className="hidden md:flex text-right items-center space-x-2.5 text-zinc-400 text-[9.5px] font-mono">
                <span className="tracking-wider">LATENCY: LIVE SYNCO</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              {/* Dynamic PINS Toggle Button in Header */}
              <button
                type="button"
                onClick={handleToggleShowPinnedOnly}
                className={`relative flex items-center space-x-1.5 px-3 py-2 border rounded-xl transition duration-150 cursor-pointer text-xs font-mono font-black shadow-sm active:scale-95 ${
                  showPinnedOnly 
                    ? "bg-blue-600 border-blue-700 text-white hover:bg-blue-700" 
                    : "bg-white border-zinc-250/80 text-zinc-700 hover:text-blue-600 hover:bg-zinc-50"
                }`}
                title="Toggle viewing only high-priority pinned notices or layout strategies"
              >
                <Pin className={`h-3.5 w-3.5 ${showPinnedOnly ? "fill-white text-white animate-[bounce_1s_infinite]" : "text-zinc-500"}`} />
                <span className="hidden sm:inline">PINS</span>

                {/* Unread Pin Color bubble badge */}
                {unreadPinsCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white font-sans text-[9px] font-black h-4.5 w-4.5 rounded-full flex items-center justify-center animate-bounce shadow-md border-2 border-white leading-none">
                    {unreadPinsCount}
                  </span>
                )}
              </button>

              {/* Channels dropdown switcher */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMobileChannels(!showMobileChannels)}
                  className="flex items-center space-x-1 px-2.5 sm:px-3 py-2 text-zinc-800 hover:text-rose-650 hover:bg-zinc-50 border border-zinc-250/80 rounded-xl transition duration-150 cursor-pointer text-xs font-mono font-black shadow-sm active:scale-95"
                  title="Select secure channels and communications matrix filter"
                >
                  <MoreVertical className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">TACTICAL MENU</span>
                </button>

                {/* Dropdown Menu Overlay */}
                {showMobileChannels && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowMobileChannels(false)} 
                    />
                    
                    <div className="absolute right-1 md:right-0 mt-2 w-[calc(100vw-32px)] sm:w-72 max-w-xs bg-white border border-zinc-200 rounded-xl shadow-2xl p-4 z-50 animate-slide-down text-zinc-950 font-sans max-h-[75vh] overflow-y-auto scrollbar-thin">
                      <div className="flex items-center justify-between border-b border-zinc-100 pb-2 mb-3">
                        <span className="text-[10px] font-mono font-bold uppercase text-zinc-450 tracking-wider">
                          📁 Channel Roster
                        </span>
                        <button 
                          onClick={() => setShowMobileChannels(false)}
                          className="hover:bg-zinc-100 p-1 rounded text-zinc-400 hover:text-zinc-700 cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Dynamic Channels inside popover */}
                      <div className="space-y-1 mb-4">
                        {CHANNELS.map((ch) => {
                          const active = activeRoom === ch.id;
                          const isLocked = !!lockedRooms[ch.id];
                          return (
                            <button
                              key={ch.id}
                              onClick={() => {
                                setActiveRoom(ch.id);
                                setReplyTo(null);
                                setShowPinnedOnly(false);
                                setShowMobileChannels(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono font-bold transition duration-150 cursor-pointer ${
                                active
                                  ? "bg-rose-50 text-rose-700 border border-red-50/50"
                                  : "text-zinc-650 hover:bg-zinc-50 hover:text-zinc-900"
                              }`}
                            >
                              <div className="flex items-center space-x-2">
                                <span>
                                  {ch.id === "announcements" ? "📢" : ch.id === "war" ? "⚔️" : ch.id === "layouts" ? "🏰" : ch.id === "polls" ? "📊" : "💬"}
                                </span>
                                <span>{ch.name.substring(2)}</span>
                                {unreadCounts && unreadCounts[ch.id] > 0 && (
                                  <span className="ml-1.5 bg-red-600 text-white font-sans text-[9.5px] font-black h-4 px-1.5 rounded-full flex items-center justify-center animate-pulse leading-none shadow shadow-red-950">
                                    {unreadCounts[ch.id]}
                                  </span>
                                )}
                              </div>
                              {isLocked && <Lock className="h-3 w-3 text-red-500" />}
                            </button>
                          );
                        })}
                      </div>

                      {/* Search Bar inside popover */}
                      <div className="space-y-2 pt-2.5 border-t border-zinc-100">
                        <span className="block font-mono text-[9px] font-bold uppercase text-zinc-400">
                          Search Filter
                        </span>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Type keyword or user..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-8 pr-3 py-1.5 text-xs text-zinc-800 placeholder-zinc-400 outline-none focus:border-red-550 focus:bg-white"
                          />
                          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                        </div>

                        {/* View Pinned Switcher */}
                        <button
                          onClick={() => {
                            setShowPinnedOnly(!showPinnedOnly);
                            setShowMobileChannels(false);
                          }}
                          className={`w-full flex items-center space-x-2 py-1.5 px-2 rounded-lg text-[10px] font-mono font-bold uppercase transition cursor-pointer ${
                            showPinnedOnly ? "bg-red-50 text-red-600" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
                          }`}
                        >
                          {showPinnedOnly ? <Eye className="h-4 w-4 text-red-500" /> : <EyeOff className="h-4 w-4 text-zinc-400" />}
                          <span>{showPinnedOnly ? "Showing Pinned ONLY" : "View Pinned Transmissions"}</span>
                        </button>
                      </div>

                      {/* Note: Developer controls relocated to the input section '+' button */}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Sub-tabs selector for Pinned Messages (Text vs Image) */}
          {showPinnedOnly && (
            <div className="bg-gradient-to-r from-blue-50/75 via-white to-blue-50/50 border-b border-zinc-200 px-4 py-2.5 flex items-center justify-between gap-3 relative z-25 select-none animate-slide-down">
              <div className="flex items-center space-x-2">
                <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                <span className="text-[10px] font-mono font-black uppercase text-blue-800 tracking-wider">
                  📌 SECURED PINNED STRATEGIES
                </span>
                <span className="text-[8.5px] font-mono font-bold text-zinc-450 bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded-full">
                  Total: <strong className="text-blue-650">{messages.filter(m => m.pinned && !m.isDeleted).length}</strong>
                </span>
              </div>
              <div className="flex items-center bg-zinc-100 p-0.5 rounded-xl border border-zinc-200/80">
                <button
                  type="button"
                  onClick={() => setPinnedOption("text")}
                  className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[10px] font-mono font-black uppercase transition-all duration-150 active:scale-95 cursor-pointer ${
                    pinnedOption === "text"
                      ? "bg-white text-blue-650 shadow-sm border border-zinc-150"
                      : "text-zinc-500 hover:text-zinc-850"
                  }`}
                >
                  <MessageSquare className="h-3 w-3 shrink-0" />
                  <span>Text</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPinnedOption("image")}
                  className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[10px] font-mono font-black uppercase transition-all duration-150 active:scale-95 cursor-pointer ${
                    pinnedOption === "image"
                      ? "bg-white text-blue-650 shadow-sm border border-zinc-150"
                      : "text-zinc-500 hover:text-zinc-850"
                  }`}
                >
                  <Image className="h-3 w-3 shrink-0" />
                  <span>Images</span>
                </button>
              </div>
            </div>
          )}

          {/* Dynamic interactive Poll Creator Overlay for officers */}
          {showPollCreator && (
            <div className="bg-zinc-950 border-b border-zinc-900 p-4 space-y-3.5 relative z-20 shadow-xl max-w-xl mx-auto rounded-b-xl animate-slide-down">
              <div className="flex items-center justify-between">
                <span className="font-sans text-xs font-extrabold uppercase text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-amber-300 tracking-wider flex items-center gap-1.5">
                  🗳️ BATTLE DEPLOYMENT SURVEY DECK
                </span>
                <button 
                  onClick={() => setShowPollCreator(false)}
                  className="font-mono text-[9px] uppercase font-bold text-zinc-500 hover:text-zinc-200"
                >
                  Cancel ✕
                </button>
              </div>

              <form onSubmit={handleCreatePoll} className="space-y-3.1">
                <div>
                  <label className="block font-mono text-[9px] uppercase text-zinc-500 mb-1 font-bold">Survey Core Query Statement</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g., Do we declare wars on weekends or weekday rosters?"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    className="w-full rounded border border-zinc-900 bg-zinc-900/60 p-2 text-xs text-zinc-100 placeholder-zinc-700 outline-none focus:border-red-650"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block font-mono text-[9px] uppercase text-zinc-500 font-bold">Survey Response Options</label>
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <span className="font-mono text-[10px] text-zinc-600">{i + 1}.</span>
                      <input
                        type="text"
                        required={i < 2}
                        placeholder={i === 0 ? "Option A" : i === 1 ? "Option B" : "Option C (Optional)"}
                        value={opt}
                        onChange={(e) => {
                          const copy = [...pollOptions];
                          copy[i] = e.target.value;
                          setPollOptions(copy);
                        }}
                        className="flex-1 rounded border border-zinc-900 bg-zinc-900/60 p-1.5 text-xs text-zinc-200 placeholder-zinc-750 outline-none focus:border-red-650"
                      />
                    </div>
                  ))}

                  {pollOptions.length < 5 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions([...pollOptions, ""])}
                      className="text-[9px] font-mono text-amber-500/80 hover:text-amber-400 uppercase font-black tracking-widest mt-1 flex items-center gap-1"
                    >
                      + ADD CHOICE INCREMENT
                    </button>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="rounded bg-gradient-to-r from-red-800 to-rose-700 text-white font-mono text-[10px] font-black uppercase px-4 py-2 hover:from-red-700 hover:to-rose-600 cursor-pointer transition"
                  >
                    🚀 BROADCAST SURGICAL POLL
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Scrollable messages log frame wrapper with high-contrast luxury patterns */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin flex flex-col bg-[#efeae2]/50 bg-[radial-gradient(#d1d5db_1px,transparent_1px)] [background-size:20px_20px]">
            
            {/* Infinite loading older queries triggers */}
            {messages.length >= limitCount && (
              <div className="pb-3 text-center">
                <button
                  onClick={() => setLimitCount(prev => prev + 30)}
                  className="inline-flex items-center space-x-2 py-1.5 px-4 rounded border border-zinc-200 bg-white hover:bg-zinc-50 text-[10px] font-mono font-extrabold uppercase tracking-widest text-zinc-500 hover:text-rose-600 w-full justify-center transition cursor-pointer shadow-sm"
                >
                  <span>📥 DOWNLOAD ARCHIVED WAR RECORDS (+30 messages)</span>
                </button>
              </div>
            )}

            {showPinnedOnly && pinnedOption === "image" ? (
              (() => {
                const pinnedImages = messages.filter(m => m.pinned && m.imageUrl && !m.isDeleted);
                if (pinnedImages.length === 0) {
                  return (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-24 text-zinc-550 font-mono text-xs">
                      <Image className="h-10 w-10 text-zinc-350 mb-2.5" />
                      <span className="font-extrabold uppercase tracking-wider text-zinc-600 text-[11px] mb-0.5">No Pinned Strategic Visuals</span>
                      <span className="text-[10px] text-zinc-450">Master, upload battlefield screenshots to plan and coordinate layouts!</span>
                    </div>
                  );
                }
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-full w-full py-2 animate-fade-in select-none">
                    {pinnedImages.map((msg, idx) => {
                      return (
                        <div 
                          key={msg.id}
                          className="bg-white rounded-2xl border border-blue-200/40 overflow-hidden shadow-sm hover:shadow-md transition-all duration-350 flex flex-col hover:-translate-y-1 relative group bg-gradient-to-b from-white to-zinc-50/55"
                        >
                          {/* Badge counter */}
                          <div className="absolute top-3 left-3 bg-blue-600 border border-blue-400 text-white font-mono text-[9px] font-black tracking-widest px-2.5 py-0.5 rounded shadow z-10 select-none uppercase">
                            PLAN {idx + 1}
                          </div>

                          {/* Top Author Bar */}
                          <div className="p-3 border-b border-zinc-100 flex items-center justify-between relative bg-white/70 backdrop-blur-sm">
                            <div className="flex items-center space-x-2 pl-14">
                              <div className="text-left">
                                <span className="block font-sans text-xs font-black text-zinc-900 leading-none">
                                  {msg.authorName}
                                </span>
                                <span className="block font-mono text-[8px] text-blue-600 font-black mt-1 uppercase tracking-wider">
                                  {msg.authorRole}
                                </span>
                              </div>
                            </div>

                            {/* Unpin Action */}
                            {(cocRole === "Leader" || cocRole === "Co-Leader") && (
                              <button
                                type="button"
                                onClick={() => handleTogglePin(msg.id, true)}
                                className="p-1 px-2 text-[8px] font-mono font-bold uppercase tracking-wider rounded-lg bg-red-50 text-red-650 hover:bg-red-100 border border-red-200/50 transition cursor-pointer active:scale-95 shrink-0"
                                title="Unpin strategy image"
                              >
                                Unpin
                              </button>
                            )}
                          </div>

                          {/* Image Canvas with hover zoom and click to focus (lightbox) */}
                          <div 
                            onClick={() => setFullScreenImage(msg.imageUrl)}
                            className="relative overflow-hidden aspect-video bg-zinc-950 cursor-pointer group"
                          >
                            <img 
                              src={msg.imageUrl} 
                              alt="Pinned layout map"
                              className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition duration-305 flex items-end justify-center pb-3">
                              <span className="text-[10px] font-mono font-black text-white bg-blue-600/95 px-3 py-1 rounded-full shadow tracking-wider uppercase">
                                🔍 Inspect Plan
                              </span>
                            </div>
                          </div>

                          {/* Bottom Description */}
                          <div className="p-3.5 flex flex-col flex-1 justify-between text-left">
                            <p className="text-xs font-sans text-zinc-900 leading-relaxed font-semibold mb-3 break-words whitespace-pre-wrap">
                              {msg.text || "Tactical screenshot uploaded to coordinate strategy for the war base."}
                            </p>

                            <div className="border-t border-zinc-150/60 pt-2.5 flex items-center justify-between">
                              <span className="text-[7.5px] font-mono uppercase font-black text-zinc-400 tracking-widest flex items-center gap-1">
                                🛰️ COORD SECURED
                              </span>
                              
                              <button
                                type="button"
                                onClick={() => setFullScreenImage(msg.imageUrl)}
                                className="text-[9px] font-mono font-black text-blue-600 hover:text-blue-700 tracking-wider uppercase transition"
                              >
                                ZOOM MAP
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            ) : filteredMessages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-20 text-zinc-550 font-mono text-xs">
                <MessageSquare className="h-10 w-10 text-zinc-450 mb-2.5" />
                <span className="font-extrabold uppercase tracking-wider text-zinc-600 text-[11px] mb-0.5">Secure Feed Quiet</span>
                <span className="text-[10px] text-zinc-450">Comrade, there are no transmissions matching this search block.</span>
              </div>
            ) : (
              filteredMessages.map((msg) => {
                const belongsToMe = msg.authorUid === userUid;
                const hasReplied = !!msg.replyTo;
                
                // Determine user roles
                const isLeader = msg.authorRole === "Leader" || msg.authorRole === "Leader / Emperor";
                const isCoLeader = msg.authorRole === "Co-Leader" || msg.authorRole === "Co-Leader / General";
                const isSupremeOfficial = msg.authorTag?.toUpperCase().trim() === "#PV9GPQPUC" || msg.authorRole?.toLowerCase().includes("emperor");
                const isGeneralOfficer = isLeader || isCoLeader;
                const isElderRole = msg.authorRole === "Elder" || msg.authorRole === "Elder / Commander";

                // Resolve border & styles strictly based on CoC Role as requested by Master
                let borderTheme = "border-zinc-200 bg-white text-zinc-900 shadow-sm hover:border-zinc-300";
                let badgeRoleColor = "bg-zinc-100 text-zinc-650 border border-zinc-200 font-semibold";
                
                if (msg.isDeleted) {
                  borderTheme = "border-red-300 bg-red-50/30 text-stone-400 opacity-60 border-dashed shadow-inner";
                  badgeRoleColor = "bg-red-50 text-red-700 border border-red-200 font-mono font-bold text-[7.5px]";
                } else if (msg.pinned) {
                  // Master's Premium static blue border with glowing shadow elements (No pulse animation as requested)
                  borderTheme = "border-blue-400 bg-gradient-to-tr from-blue-50/40 via-white to-indigo-50/30 text-zinc-950 shadow-[0_4px_14px_rgba(59,130,246,0.22)] ring-1 ring-blue-300/50 hover:border-blue-500";
                  badgeRoleColor = "bg-blue-600 text-white border-blue-400 border font-black text-[8px]";
                } else if (isSupremeOfficial) {
                  borderTheme = "border-amber-300 bg-amber-50/95 text-amber-950 shadow-[0_2px_8px_rgba(245,158,11,0.06)] hover:border-amber-400";
                  badgeRoleColor = "bg-amber-100 text-amber-800 border-amber-200 border font-black";
                } else if (isGeneralOfficer) {
                  borderTheme = "border-red-200 bg-red-50/90 text-stone-900 shadow-[0_2px_8px_rgba(239,68,68,0.06)] hover:border-red-350";
                  badgeRoleColor = "bg-red-100 text-red-700 border-red-200 border font-black";
                } else if (isElderRole) {
                  borderTheme = "border-cyan-200 bg-cyan-50/90 text-cyan-955 shadow-[0_2px_8px_rgba(6,182,212,0.05)] hover:border-cyan-300";
                  badgeRoleColor = "bg-cyan-100 text-cyan-705 border border-cyan-200 border font-extrabold";
                }

                // Look up any custom battle logo from the parent's synchronized roster list
                const matchedMember = allMembers.find(
                  m => m.playerTag?.toUpperCase().trim() === msg.authorTag?.toUpperCase().trim() || m.uid === msg.authorUid
                );

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col max-w-[85%] md:max-w-[72%] group ${
                      belongsToMe ? "ml-auto items-end" : "mr-auto items-start"
                    }`}
                  >
                    {/* Sender Meta and Avatar section */}
                    <div className="flex items-center space-x-2.5 mb-1 flex-wrap">
                      
                      {/* Interactive Avatar trigger for inspecting */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onInspectPlayer && msg.authorTag) {
                            onInspectPlayer(msg.authorTag);
                          } else {
                            alert("Master, this player tag is not verified or indexed on the live server yet.");
                          }
                        }}
                        className={`font-mono text-[9px] font-black h-5.5 w-5.5 rounded-full flex items-center justify-center border transition-all cursor-pointer select-none active:scale-95 overflow-hidden shrink-0 ${
                          isSupremeOfficial 
                            ? "bg-amber-500 text-zinc-950 border-amber-400 ring-2 ring-amber-400/30 animate-pulse" 
                            : isGeneralOfficer 
                              ? "bg-red-900 text-white border-red-500 ring-1 ring-red-500/30" 
                              : isElderRole 
                                ? "bg-cyan-900 text-cyan-100 border-cyan-400" 
                                : "bg-zinc-200 text-zinc-600 border-zinc-350"
                        }`}
                        title="Click avatar to inspect live in-game profile card!"
                      >
                        {matchedMember?.photoUrl ? (
                          <img
                            src={matchedMember.photoUrl}
                            alt={`${msg.authorName} Avatar`}
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          msg.authorName.substring(0, 2).toUpperCase()
                        )}
                      </button>

                      {/* Username string */}
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onInspectPlayer && msg.authorTag) {
                            onInspectPlayer(msg.authorTag);
                          }
                        }}
                        className={`font-sans text-[11px] font-extrabold hover:underline cursor-pointer tracking-wide flex items-center gap-1 leading-none ${
                          isSupremeOfficial 
                            ? "text-amber-600" 
                            : isGeneralOfficer 
                              ? "text-red-700" 
                              : isElderRole 
                                ? "text-cyan-600" 
                                : "text-zinc-600"
                        }`}
                      >
                        {msg.authorName}

                        {/* Professional blue officer tick or verified crowns */}
                        {isGeneralOfficer && (
                          <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-blue-600 text-white font-extrabold text-[7.5px] select-none scale-95 border border-blue-400 shadow-sm" title="Blue Command Verified Badge">
                            ✓
                          </span>
                        )}
                      </span>

                      {/* Role representation pill */}
                      <span className={`font-mono text-[8px] uppercase px-1 rounded-sm ${badgeRoleColor}`}>
                        {isSupremeOfficial ? "Emperor" : msg.authorRole}
                      </span>
                      
                      {/* Pinned tactical tag indicator */}
                      {msg.pinned && (
                        <Pin className="h-3 w-3 text-red-500 animate-pulse" title="Pinned critical Battle Notice!" />
                      )}
                    </div>

                    {/* Chat Box Container block - Interactive single-tap operation trigger */}
                    <div 
                      onClick={() => setActiveMenuMsg(msg)}
                      className={`rounded-xl p-3 border relative transition-all duration-150 cursor-pointer hover:shadow-md active:scale-[0.99] group ${borderTheme}`}
                      title="Tap message bubble to open tactical menu (reply, copy, delete, pin, react)"
                    >
                      
                      {/* Deleted message warning banner for Supreme Leader */}
                      {msg.isDeleted && (
                        <div className="mb-2 bg-red-100/90 border border-red-300 text-red-800 text-[10px] font-mono px-2 py-1.5 rounded-lg flex items-center gap-1.5 font-bold animate-pulse shadow-sm">
                          <span>⚠️ TRANSMISSION DELETED BY {msg.deletedBy?.toUpperCase() || "LEADER"}. ONLY YOU CAN SEE THIS. TAP TO PERMANENTLY PURGE!</span>
                        </div>
                      )}

                      {/* Reply parent message text block */}
                      {hasReplied && (
                        <div className="mb-2 text-[10px] font-mono p-2 rounded-lg bg-zinc-100 border-l-2 border-red-500 text-zinc-600">
                          {msg.replyTo}
                        </div>
                      )}

                      {/* Conditional display for standard messages vs Poll System */}
                      {msg.isPoll ? (
                        <div className="space-y-3.5 min-w-[240px] md:min-w-[270px]">
                          {/* Poll Title banner */}
                          <div className="flex items-center space-x-1.5 pb-1 border-b border-zinc-200">
                            <span className="text-zinc-500 text-xs">📊</span>
                            <span className="text-[10px] font-mono font-black uppercase text-amber-600 tracking-wider">TACTICAL ROSTER POLL</span>
                          </div>

                          <p className="font-sans text-xs font-extrabold text-zinc-900 tracking-normal">
                            {msg.text}
                          </p>

                          {/* Poll Option grid with interactive vote meters */}
                          <div className="space-y-2">
                            {msg.pollOptions.map((opt: string) => {
                              const list = msg.pollVotes?.[opt] || [];
                              const selected = list.includes(userUid);
                              
                              // Calculate percentage
                              const totalVotes = (Object.values(msg.pollVotes || {}) as string[][]).reduce((acc: number, cur: string[]) => acc + (cur?.length || 0), 0);
                              const percentage = totalVotes > 0 ? Math.round((list.length / totalVotes) * 100) : 0;

                              return (
                                <button
                                  key={opt}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleVote(msg.id, opt);
                                  }}
                                  className={`w-full text-left p-2 rounded-lg text-[11px] font-mono relative overflow-hidden transition border cursor-pointer ${
                                    selected 
                                      ? "bg-red-50 border-red-200 text-red-700" 
                                      : "bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100 hover:border-zinc-300"
                                  }`}
                                >
                                  {/* Progress bar fill background matching standard web engines */}
                                  <div 
                                    className="absolute inset-y-0 left-0 bg-red-100 pointer-events-none transition-all duration-500"
                                    style={{ width: `${percentage}%` }}
                                  />

                                  <div className="relative flex items-center justify-between z-10 font-bold">
                                    <span className="flex items-center gap-1.5">
                                      {selected && <Check className="h-3 w-3 text-red-650 flex-shrink-0" />}
                                      <span className="truncate max-w-[190px]">{opt}</span>
                                    </span>
                                    <span>{percentage}% ({list.length})</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          
                          {/* Totals */}
                          <div className="flex items-center justify-between text-[9px] text-zinc-500 font-mono pt-1">
                            <span>Voters registered: {(Object.values(msg.pollVotes || {}) as string[][]).reduce((acc: number, cur: string[]) => acc + (cur?.length || 0), 0)}</span>
                            <span>🔒 Standard secured</span>
                          </div>
                        </div>
                      ) : msg.isInspectCard && (msg as any).inspectedPlayer ? (
                        <div className="space-y-3 min-w-[245px] sm:min-w-[280px] p-1">
                          {/* Banner */}
                          <div className="flex items-center justify-between border-b border-rose-100 pb-1.5 mb-2.5">
                            <span className="text-[10px] font-mono font-black uppercase text-red-650 tracking-wider flex items-center gap-1">
                              ⚔️ TACTICAL DOSSIER
                            </span>
                            <span className="text-[8px] font-mono bg-rose-100 text-rose-850 px-1.5 py-0.2 rounded-sm uppercase tracking-widest font-black">
                              VERIFIED
                            </span>
                          </div>

                          <div className="flex items-start space-x-3">
                            {/* Avatar or TownHall Icon */}
                            <div className="relative shrink-0 mt-0.5">
                              {(msg as any).inspectedPlayer.photoUrl ? (
                                <img
                                  src={(msg as any).inspectedPlayer.photoUrl}
                                  alt="inspected player custom pic"
                                  className="h-12 w-12 rounded-xl object-cover ring-2 ring-red-800 border border-zinc-900 shadow"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="h-12 w-12 rounded-xl bg-zinc-900 flex flex-col items-center justify-center border border-zinc-800 text-[10px] font-mono font-extrabold text-amber-500">
                                  <span className="text-[11px]">TH</span>
                                  <span>{(msg as any).inspectedPlayer.townHall}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <h4 className="font-sans text-xs font-black text-zinc-900 truncate leading-none mb-1">
                                {(msg as any).inspectedPlayer.playerName}
                              </h4>
                              <p className="font-mono text-[9px] text-zinc-500 select-all leading-none mb-2">
                                {(msg as any).inspectedPlayer.playerTag}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                <span className="font-mono text-[8.5px] font-extrabold px-1.5 py-0.2 rounded bg-zinc-950 text-white shadow-sm">
                                  {(msg as any).inspectedPlayer.role}
                                </span>
                                <span className="font-sans text-[8.5px] font-black px-1.5 py-0.2 rounded bg-amber-500 text-zinc-950 shadow-sm">
                                  TH {(msg as any).inspectedPlayer.townHall}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Stats Grid */}
                          <div className="grid grid-cols-2 gap-2 bg-zinc-50 border border-zinc-150 p-2 rounded-xl mt-3 shadow-inner">
                            <div className="text-center p-1.5 bg-white border border-zinc-200/60 rounded-lg shadow-sm">
                              <span className="block text-[8px] font-mono text-zinc-400 uppercase font-bold leading-none mb-1">League Rank</span>
                              <div className="flex items-center justify-center space-x-1">
                                <img 
                                  src={(msg as any).inspectedPlayer.leagueLogo} 
                                  alt={(msg as any).inspectedPlayer.leagueName}
                                  className="h-5 w-5 object-contain"
                                  loading="lazy"
                                />
                                <span className="text-[9.5px] font-sans font-black text-zinc-800 truncate max-w-[70px]">
                                  {(msg as any).inspectedPlayer.leagueName}
                                </span>
                              </div>
                            </div>
                            <div className="text-center p-1.5 bg-white border border-zinc-200/60 rounded-lg shadow-sm flex flex-col justify-center">
                              <span className="block text-[8px] font-mono text-zinc-400 uppercase font-bold leading-none mb-1">War Stars</span>
                              <span className="text-xs font-sans font-black text-amber-600 block">
                                ⭐ {(msg as any).inspectedPlayer.warStars}
                              </span>
                            </div>
                          </div>

                          {/* Specialty Section */}
                          <div className="p-2 bg-red-50/55 border border-red-100/60 rounded-xl mt-2 text-left">
                            <span className="block text-[8px] font-mono text-stone-500 uppercase font-extrabold tracking-wide mb-1 flex items-center gap-1">
                              🛡️ COMBAT SPECIALIZATION:
                            </span>
                            <span className="block font-sans text-[10.5px] text-zinc-800 font-extrabold leading-snug">
                              {(msg as any).inspectedPlayer.specialty || "Standard Assault (No custom tactics set)"}
                            </span>
                          </div>

                          {/* Interactive Inspection Action */}
                          {onInspectPlayer && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onInspectPlayer((msg as any).inspectedPlayer.playerTag);
                              }}
                              className="w-full text-center py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-sans text-[9.5px] font-black uppercase tracking-wider rounded-lg shadow cursor-pointer transition active:scale-[0.97] mt-1"
                            >
                              🔍 INSPECT ARCHIVES
                            </button>
                          )}
                        </div>
                      ) : msg.isDeleted ? (
                        <div className="space-y-1.5 py-1 min-w-[210px] select-all">
                          {/* Deleted title banner */}
                          <div className="flex items-center space-x-1.5 pb-1 border-b border-red-200/50">
                            <Trash2 className="h-3.5 w-3.5 text-red-500 animate-pulse shrink-0" />
                            <span className="text-[9px] font-mono font-black uppercase text-red-650 tracking-wider">
                              🗑️ Purged Directive (Emperor View)
                            </span>
                          </div>
                          <p className="font-sans text-xs italic text-stone-400 line-through break-words whitespace-pre-wrap leading-relaxed bg-zinc-50/80 p-1.5 rounded-lg border border-red-100/40">
                            "{msg.text}"
                          </p>
                          <div className="text-[8.5px] font-mono text-zinc-500 flex items-center justify-between mt-1">
                            <span>Deleted by: <strong className="text-red-700 uppercase">{msg.deletedBy || "Member"}</strong></span>
                            <span className="text-[8px] bg-red-100 text-red-750 px-1.5 py-0.2 rounded font-black tracking-widest leading-none">PURGED</span>
                          </div>
                        </div>
                      ) : (
                        <p className="font-sans break-words whitespace-pre-wrap leading-relaxed text-xs transition duration-150 select-text text-zinc-900">
                          {renderMessageTextWithMentions(msg.text)}
                        </p>
                      )}

                      {/* Image attachments sharing */}
                      {msg.imageUrl && !msg.isDeleted && (
                        <div className="mt-2 text-center relative max-w-sm rounded overflow-hidden">
                          <img
                            src={msg.imageUrl}
                            alt="tactical screen"
                            className="max-h-56 rounded-lg object-cover cursor-pointer hover:opacity-90 outline outline-1 outline-zinc-200 transition"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFullScreenImage(msg.imageUrl);
                            }}
                          />
                        </div>
                      )}

                    </div>

                    {/* Compact Active Emoji Reactions (Tapping on existing ones increments/toggles them) */}
                    {!msg.isPoll && msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 mt-1 text-[10px] font-mono select-none">
                        {Object.entries(msg.reactions).map(([emoji, list]) => {
                          if (!Array.isArray(list) || list.length === 0) return null;
                          const didReactValue = list.includes(userUid);
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddReaction(msg.id, emoji);
                              }}
                              className={`flex items-center space-x-1 px-1.5 py-0.5 rounded-lg border transition cursor-pointer font-bold active:scale-95 duration-100 ${
                                didReactValue 
                                  ? "bg-rose-50 border-rose-200 text-rose-700" 
                                  : "bg-white text-zinc-550 border-zinc-250 hover:text-zinc-800 hover:bg-zinc-50 shadow-sm"
                              }`}
                              title={`Emoji ${emoji} - click to toggle reaction`}
                            >
                              <span>{emoji}</span>
                              <span>{list.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            
            {/* Direct reference target anchor */}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply block drawer */}
          {replyTo && (
            <div className="bg-zinc-100 px-4 py-2 border-t border-zinc-200 flex items-center justify-between text-xs font-mono text-zinc-650 relative z-10 animate-slide-up">
              <span className="flex items-center space-x-1.5">
                <Reply className="h-3.5 w-3.5 text-rose-650 scale-x-[-1]" />
                <span>Replying to <strong className="text-zinc-800">@{replyTo.authorName}</strong></span>
              </span>
              <button
                onClick={() => setReplyTo(null)}
                className="text-[10px] uppercase font-black tracking-wider text-zinc-500 hover:text-red-600"
              >
                Cancel ✕
              </button>
            </div>
          )}

          {/* Locked room composition warnings for regular users */}
          {isCurrentRoomLocked && cocRole !== "Leader" && cocRole !== "Co-Leader" ? (
            <div className="p-4 bg-red-50 border-t border-red-100 flex items-center justify-center space-x-2 text-red-700 font-mono text-[9.5px] uppercase tracking-wider">
              <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" />
              <span>Master, this Battle channel is currently LOCKED by Co-leaders. Composing transmission barred.</span>
            </div>
          ) : (
            /* Composing chat container form - Beautifully Themed for Light WhatsApp style */
            <form onSubmit={handleSend} className="p-3 border-t border-zinc-200 bg-zinc-100 flex flex-col space-y-2 relative z-10 shadow-inner">
              
              {/* Special restriction note for announcement channels */}
              {activeChannelDef.restricted && (
                <div className="px-2 py-0.5 bg-red-50 border border-red-100 rounded-lg text-center text-[8px] text-red-700 font-mono font-black uppercase tracking-widest animate-pulse">
                  ⚠️ LEADERS & GENERALS MODE ACTIVE
                </div>
              )}

              {imageUrl && (
                <div className="bg-white border border-zinc-250 rounded-xl p-1.5 flex items-center justify-between max-w-[200px] animate-fade-in relative shadow-sm border-dashed">
                  <div className="flex items-center space-x-2">
                    <img
                      src={imageUrl}
                      alt="upload preview"
                      className="h-7 w-7 object-cover rounded-md border border-zinc-205"
                    />
                    <span className="text-[9.5px] font-mono font-extrabold text-emerald-700">
                      📎 SCREEN READY
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="text-zinc-400 hover:text-red-500 hover:bg-red-50 h-5 w-5 rounded-full flex items-center justify-center transition font-mono font-bold text-[9px] cursor-pointer"
                    title="Remove attachment"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Dynamic Developer Controls modal trigger inside Central main chat page */}
              {showDevSheet && (cocRole === "Leader" || cocRole === "Co-Leader") && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowDevSheet(false)} 
                  />
                  <div className="absolute bottom-16 left-3 right-3 sm:left-4 sm:right-auto md:w-[320px] bg-white border border-zinc-200 rounded-2xl shadow-2xl p-4 z-50 animate-slide-up text-zinc-950 font-sans">
                    <div className="flex items-center justify-between border-b border-zinc-150 pb-2 mb-3">
                      <span className="text-[10px] font-mono font-black uppercase text-red-650 tracking-wider flex items-center gap-1.5">
                        🛡️ COMMANDER SWITCHBOARD
                      </span>
                      <button 
                        type="button"
                        onClick={() => setShowDevSheet(false)}
                        className="hover:bg-zinc-100 py-0.5 px-2 rounded-lg text-zinc-400 hover:text-zinc-700 text-[10px] font-bold cursor-pointer"
                      >
                        CLOSE ✕
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Toggling channel lock state */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-mono text-zinc-400 uppercase font-bold">
                          Channel write locks ({activeChannelDef.label})
                        </label>
                        <button
                          type="button"
                          onClick={() => handleToggleRoomLock()}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border font-sans text-xs font-bold transition duration-200 cursor-pointer ${
                            isCurrentRoomLocked
                              ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                              : "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                          }`}
                        >
                          <span className="flex items-center space-x-1.5">
                            {isCurrentRoomLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                            <span>{isCurrentRoomLocked ? "Unlock active channel" : "Lock active channel"}</span>
                          </span>
                          <span className={`h-2.5 w-2.5 rounded-full ${isCurrentRoomLocked ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`} />
                        </button>
                      </div>

                      {/* Launch strategic channel poll */}
                      <div className="space-y-2 pt-2 border-t border-zinc-100">
                        <label className="block text-[10px] font-mono text-zinc-400 uppercase font-bold">
                          Deploy Interactive Poll in #{activeChannelDef.name.substring(2)}
                        </label>
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="Poll Question?"
                            value={pollQuestion}
                            onChange={(e) => setPollQuestion(e.target.value)}
                            className="w-full rounded-xl border border-zinc-200 bg-white p-2 text-xs text-zinc-900 placeholder-zinc-400 outline-none focus:border-red-500 shadow-sm"
                          />
                          <div className="space-y-1.5">
                            {pollOptions.map((opt, i) => (
                              <input
                                key={i}
                                type="text"
                                required={i < 2}
                                placeholder={i === 0 ? "Option A" : i === 1 ? "Option B" : `Option ${String.fromCharCode(65 + i)} (Optional)`}
                                value={opt}
                                onChange={(e) => {
                                  const copy = [...pollOptions];
                                  copy[i] = e.target.value;
                                  setPollOptions(copy);
                                }}
                                className="w-full rounded-lg border border-zinc-200 bg-white p-1.5 text-[11px] text-zinc-800 placeholder-zinc-400 outline-none focus:border-rose-500"
                              />
                            ))}
                          </div>
                          {pollOptions.length < 5 && (
                            <button
                              type="button"
                              onClick={() => setPollOptions([...pollOptions, ""])}
                              className="text-[9px] font-sans text-rose-650 hover:text-rose-800 uppercase font-extrabold tracking-wider pt-0.5"
                            >
                              + Choice increment
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={async (e) => {
                              const validOptions = pollOptions.filter(opt => opt.trim() !== "");
                              if (!pollQuestion.trim() || validOptions.length < 2) {
                                  alert("Master, please specify a valid poll query and at least two responses.");
                                  return;
                              }
                              await handleCreatePoll(e);
                              setShowDevSheet(false);
                            }}
                            className="w-full text-center py-2 bg-gradient-to-r from-red-800 to-rose-700 hover:from-rose-700 hover:to-rose-600 text-white font-sans text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer shadow-md transition"
                          >
                            🚀 BROADCAST POLL
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Mentions Autocomplete suggestions */}
              {(() => {
                const lastAtIdx = inputText.lastIndexOf("@");
                const showMentionsList = lastAtIdx !== -1 && !inputText.substring(lastAtIdx).includes(" ");
                const mentionQuery = showMentionsList ? inputText.substring(lastAtIdx + 1).toLowerCase() : "";
                const filteredMembersForMention = showMentionsList && allMembers
                  ? allMembers.filter(m => 
                      (m.playerName || "").toLowerCase().includes(mentionQuery) ||
                      (m.playerTag || "").toLowerCase().includes(mentionQuery)
                    ).slice(0, 5)
                  : [];

                if (!showMentionsList || filteredMembersForMention.length === 0) return null;

                return (
                  <div className="bg-white border border-zinc-200 rounded-xl shadow-2xl p-1.5 absolute bottom-16 left-3 right-3 sm:left-4 sm:right-auto w-64 z-40 animate-slide-up flex flex-col space-y-0.5 max-h-52 overflow-y-auto">
                    <div className="px-2 py-1.5 border-b border-zinc-150 text-[9px] font-mono font-black text-zinc-500 uppercase tracking-widest">
                      🎯 Mention Comrade
                    </div>
                    {filteredMembersForMention.map((member) => (
                      <button
                        key={member.playerTag}
                        type="button"
                        onClick={() => {
                          const before = inputText.substring(0, lastAtIdx);
                          setInputText(`${before}@${member.playerName} `);
                          document.getElementById("chat-input")?.focus();
                        }}
                        className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-zinc-50 text-left transition w-full cursor-pointer"
                      >
                        {member.photoUrl ? (
                          <img 
                            src={member.photoUrl} 
                            alt={member.playerName} 
                            className="h-6 w-6 rounded-md object-cover border border-zinc-200" 
                          />
                        ) : (
                          <div className="h-6 w-6 rounded-md bg-zinc-950 border border-zinc-800 flex items-center justify-center text-[8.5px] font-mono text-amber-500 font-bold">
                            TH{member.townHall}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="block text-[11px] font-bold text-zinc-900 truncate leading-none mb-0.5">
                            {member.playerName}
                          </span>
                          <span className="block text-[8.5px] font-mono text-zinc-400 leading-none">
                            {member.playerTag} | {member.role}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })()}

              <div className="flex items-center space-x-2">
                {/* Developer controls sheet toggler '+' */}
                {(cocRole === "Leader" || cocRole === "Co-Leader") && (
                  <button
                    type="button"
                    onClick={() => setShowDevSheet(!showDevSheet)}
                    className={`h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border font-black transition-all duration-300 cursor-pointer flex active:scale-95 shadow-sm ${
                      showDevSheet
                        ? "bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 text-white border-rose-800 shadow-md transform rotate-180"
                        : "bg-gradient-to-tr from-amber-500/15 via-rose-500/15 to-blue-500/15 hover:from-amber-500/25 hover:via-rose-500/25 hover:to-blue-500/25 text-rose-600 border-rose-250 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]"
                    }`}
                    title="Open Developer & Commander Controls"
                  >
                    <Plus className={`h-5.5 w-5.5 transition-transform duration-350 ${
                      showDevSheet ? "text-white" : "text-rose-600 drop-shadow-[0_1px_1px_rgba(239,68,68,0.2)]"
                    }`} />
                  </button>
                )}

                {/* Slim Tactical Image Upload Trigger on Left Side */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border transition-all duration-150 cursor-pointer flex active:scale-95 shadow-sm space-x-0.5 ${
                    imageUrl 
                      ? "bg-rose-600 border-rose-700 text-white hover:bg-rose-700 shadow-md shadow-rose-900/10" 
                      : "bg-gradient-to-tr from-rose-50 to-amber-50 border-rose-200/80 hover:bg-rose-100/50 text-rose-650"
                  }`}
                  title="Upload Battlefield Screenshot"
                >
                  <Image className={`h-4.5 w-4.5 ${compressing ? "animate-spin text-amber-500" : "text-rose-600 animate-pulse"}`} />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    isCurrentRoomLocked 
                      ? "Compose emergency protocol (Generals Bypass Mode)..." 
                      : `Speak in #${activeChannelDef.name.substring(2)}...`
                  }
                  className="flex-1 rounded-xl border border-zinc-200 bg-white px-3.5 py-3 font-sans text-xs text-zinc-900 placeholder-zinc-400 outline-none focus:border-rose-500 shadow-sm focus:ring-1 focus:ring-rose-500 h-11"
                  id="chat-input"
                />
                
                <button
                  type="submit"
                  className="h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-red-800 to-rose-700 text-white hover:from-rose-700 hover:to-rose-600 transition duration-150 cursor-pointer shadow-md shadow-red-900/10 active:scale-95 flex"
                  id="chat-send-btn"
                >
                  <Send className="h-4.5 w-4.5" />
                </button>
              </div>
            </form>
          )}

        </div>
      </div>

      {/* 📡 HOLDS TRANSACTION POPUP DIALOG OVERLAY */}
      {activeMenuMsg && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 animate-fade-in backdrop-blur-[1px]">
          {/* Backdrop click to close */}
          <div className="absolute inset-0" onClick={() => setActiveMenuMsg(null)} />
          
          {/* Centered tactical controls panel */}
          <div className="relative bg-white rounded-2xl max-w-sm w-full p-4 border border-zinc-200 shadow-2xl animate-scale-up text-zinc-950 font-sans z-10 mx-auto">
            
            {/* Header containing metadata */}
            <div className="flex items-center justify-between border-b border-zinc-150 pb-2 mb-3">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-red-650 tracking-wider block">
                  📡 Transmission Operations
                </span>
                <div className="text-xs font-extrabold text-zinc-800 flex items-center gap-1.5 mt-0.5">
                  <span>@{activeMenuMsg.authorName}</span>
                  <span className="text-[9px] font-mono bg-zinc-100 text-zinc-500 font-normal px-1 py-0.2 rounded uppercase">
                    {activeMenuMsg.authorRole}
                  </span>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setActiveMenuMsg(null)}
                className="hover:bg-zinc-100 p-1 rounded-lg text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Message snippet */}
            <div className="bg-zinc-50 border border-zinc-150 rounded-xl p-3 mb-4 text-xs italic text-zinc-650 max-h-24 overflow-y-auto scrollbar-thin select-all leading-relaxed whitespace-pre-wrap">
              "{activeMenuMsg.text}"
            </div>

            {/* EMOJI REACTIONS BAR (😂, 👍, 🔥, 😭, 💀) Row inside modal */}
            {!activeMenuMsg.isPoll && (
              <div className="mb-4 pt-1">
                <span className="block font-sans text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-2">
                  Select Battle Reaction
                </span>
                <div className="flex items-center gap-2.5 justify-around bg-zinc-50 border border-zinc-200 p-2 rounded-xl shadow-inner">
                  {["😂", "👍", "🔥", "😭", "💀"].map((emoji) => {
                    const list = activeMenuMsg.reactions?.[emoji] || [];
                    const didReactValue = list.includes(userUid);
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          handleAddReaction(activeMenuMsg.id, emoji);
                          setActiveMenuMsg(null);
                        }}
                        className={`text-2xl hover:scale-125 p-1 rounded-lg transition duration-150 cursor-pointer active:scale-90 ${
                          didReactValue ? "bg-rose-50 ring-1 ring-red-200 scale-110" : "hover:bg-zinc-150"
                        }`}
                        title={`React with ${emoji}`}
                      >
                        {emoji}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action Operators */}
            <div className="flex flex-col gap-1 font-mono text-[11px]">
              
              {/* Reply Transmission */}
              {!activeMenuMsg.isPoll && (
                <button
                  type="button"
                  onClick={() => {
                    setReplyTo(activeMenuMsg);
                    setActiveMenuMsg(null);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-zinc-750 hover:bg-zinc-50 rounded-xl transition font-extrabold cursor-pointer active:scale-[0.98]"
                >
                  <span className="flex items-center gap-2 text-zinc-700 font-sans">
                    <Reply className="h-4 w-4 text-red-600 scale-x-[-1]" />
                    <span>Draft Reply</span>
                  </span>
                  <span className="text-[9px] text-zinc-400 font-mono">REPLY</span>
                </button>
              )}

              {/* Copy Transmission Text (Copies to clipboard) */}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(activeMenuMsg.text);
                  alert("Transmission copied to battlefield clipboard, Master!");
                  setActiveMenuMsg(null);
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-zinc-750 hover:bg-zinc-50 rounded-xl transition font-extrabold cursor-pointer active:scale-[0.98]"
              >
                <span className="flex items-center gap-2 text-zinc-700 font-sans">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>Copy Text</span>
                </span>
                <span className="text-[9px] text-zinc-400 font-mono">COPY</span>
              </button>

              {/* Pin/Unpin controls */}
              {(cocRole === "Leader" || cocRole === "Co-Leader") && (
                <button
                  type="button"
                  onClick={() => {
                    handleTogglePin(activeMenuMsg.id, activeMenuMsg.pinned || false);
                    setActiveMenuMsg(null);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-zinc-750 hover:bg-zinc-50 rounded-xl transition font-extrabold cursor-pointer active:scale-[0.98]"
                >
                  <span className="flex items-center gap-2 text-zinc-700 font-sans">
                    <Pin className={`h-4 w-4 ${activeMenuMsg.pinned ? "text-red-550 fill-red-500" : "text-zinc-400"}`} />
                    <span>{activeMenuMsg.pinned ? "Unpin transmission" : "Pin transmission"}</span>
                  </span>
                  <span className="text-[9px] text-zinc-400 font-mono">PIN</span>
                </button>
              )}

              {/* Purge / Delete message logic */}
              {canDeleteMsg(activeMenuMsg) && (
                <button
                  type="button"
                  onClick={() => {
                    handleDelete(activeMenuMsg.id);
                    setActiveMenuMsg(null);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-red-750 hover:bg-red-50 rounded-xl transition font-extrabold cursor-pointer active:scale-[0.98]"
                >
                  <span className="flex items-center gap-2 font-sans text-red-700 font-black">
                    <Trash2 className="h-4 w-4 text-red-600" />
                    <span>{activeMenuMsg.isDeleted ? "Permanently Delete" : "Delete Transmission"}</span>
                  </span>
                  <span className="text-[9px] text-red-500/70 font-mono">{activeMenuMsg.isDeleted ? "PERM PURGE" : "PURGE"}</span>
                </button>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Lightbox full-screen modal zoom with download action */}
      {fullScreenImage && (
        <div 
          className="fixed inset-0 bg-zinc-950/95 z-[99999] flex flex-col items-center justify-center p-4 animate-fade-in backdrop-blur-md"
          onClick={() => setFullScreenImage(null)}
        >
          {/* Top actions panel */}
          <div className="absolute top-4 right-4 flex items-center space-x-3 z-55" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => {
                const link = document.createElement("a");
                link.href = fullScreenImage;
                link.download = `tactical_screenshot_${Date.now()}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="bg-white/15 hover:bg-white/20 text-white font-sans text-xs font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow border border-white/10"
              title="Download Screenshot"
            >
              <span>Download Image</span>
            </button>
            <button
              onClick={() => setFullScreenImage(null)}
              className="h-9 w-9 flex items-center justify-center rounded-full bg-red-600/90 hover:bg-red-705 text-white transition cursor-pointer active:scale-95 shadow text-sm font-bold"
              title="Close Panel"
            >
              ✕
            </button>
          </div>

          {/* Core high resolution image container */}
          <div 
            className="max-w-4xl max-h-[75vh] w-full flex items-center justify-center p-2 rounded-2xl overflow-hidden bg-black/45 border border-zinc-900 z-50 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={fullScreenImage}
              alt="zoom tactical layout screen"
              className="max-h-[72vh] max-w-full object-contain rounded-xl select-none"
            />
          </div>

          <p className="text-[10px] text-zinc-550 font-mono tracking-widest uppercase mt-4 select-none">
            🔍 Lightbox telemetry active • Tap background or tick close to eject
          </p>
        </div>
      )}

      {/* Shared Custom Interactive Iframe-Safe Action Dialog */}
      {modalDialog && (
        <div className="fixed inset-0 bg-zinc-950/85 backdrop-blur-md z-[999999] flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md bg-zinc-900 border-2 border-zinc-805 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            {/* Design header lines */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-red-650 via-red-500 to-red-800" />
            <div className="font-mono text-[8px] text-zinc-550 mb-4 tracking-widest uppercase font-black">⚡ COMMAND SECURE PROTOCOL</div>
            
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
