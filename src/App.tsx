import React, { useState, useEffect, useMemo } from "react";
import { onAuthStateChanged, signInWithPopup, signInAnonymously, signOut, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, collection, onSnapshot, query, orderBy, getDocs, writeBatch, deleteDoc, where, limit } from "firebase/firestore";
import { auth, db, googleProvider, handleFirestoreError, OperationType } from "./firebase";
import { Member, CoCRole } from "./types";
import { motion, AnimatePresence } from "motion/react";

// Extracted sub-components
import Header from "./components/Header";
import PremiumSidebar from "./components/PremiumSidebar";
import MemberProfile from "./components/MemberProfile";
import WarRoomSection from "./components/WarRoomSection";
import CwlSection from "./components/CwlSection";
import AnnouncementSection from "./components/AnnouncementSection";
import StrategySection from "./components/StrategySection";
import GiveawaySection from "./components/GiveawaySection";
import HistorySection from "./components/HistorySection";
import BasesSection from "./components/BasesSection";
import PlayerInspectModal from "./components/PlayerInspectModal";

// Lucide Icons
import {
  ShieldAlert,
  Dribbble,
  Volume2,
  Calendar,
  Layers,
  Award,
  Globe,
  Star,
  Trophy,
  Flame,
  User,
  Users,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Zap,
  RefreshCw,
  Eye,
  EyeOff,
  Edit,
  Check,
  BookOpen,
  ShieldCheck,
  X,
  ChevronDown,
  ChevronUp,
  Download
} from "lucide-react";

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [cocRole, setCocRole] = useState<CoCRole | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [inputTag, setInputTag] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [activeTab, setActiveTab] = useState("hq");
  const [isSidebarOpen, setIsSidebarOpen] = useState(typeof window !== "undefined" ? window.innerWidth >= 1024 : true);
  const [pendingPasscodeRegistration, setPendingPasscodeRegistration] = useState<any>(null);
  const [passcodeInput, setPasscodeInput] = useState("");
  
  // Tactical custom notification and window.alert interceptor
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (msg: string) => {
      console.log("ALERT INTERCEPTED VIA PROXIED WINDOW:", msg);
      setToast({ message: msg, type: "info" });
    };
    return () => {
      window.alert = originalAlert;
    };
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Official Clan stats loading state (backed up by proxy fallback)
  const [clanStats, setClanStats] = useState<any>(null);
  const [clanLoading, setClanLoading] = useState(true);
  const [outboundIp, setOutboundIp] = useState<string>("");
  const [lastSyncedTime, setLastSyncedTime] = useState<Date | null>(new Date());
  const [isSyncing, setIsSyncing] = useState(false);

  // --- PROGRESSIVE WEB APP (PWA) HOOKS AND ENGINE ---
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    // 1. Register the Service Worker in production/Vercel or development
    if ("serviceWorker" in navigator) {
      const registerSW = () => {
        navigator.serviceWorker.register("/sw.js")
          .then((reg) => console.log("[Service Worker] Online at Scope:", reg.scope))
          .catch((err) => console.warn("[Service Worker] Offline fallback activated:", err));
      };
      
      if (document.readyState === "complete" || document.readyState === "interactive") {
        registerSW();
      } else {
        window.addEventListener("load", registerSW);
      }
    }

    // 2. Intercept beforeinstallprompt
    const handleInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
      console.log("[PWA Engine] App installation detected as supported!");
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);

    // 3. Listen for Navigator messages from Web Push Notification clicks
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "NAVIGATE") {
        const url = new URL(event.data.url, window.location.origin);
        const tab = url.searchParams.get("tab");
        if (tab) {
          setActiveTab(tab as any);
        }
      }
    };
    navigator.serviceWorker?.addEventListener?.("message", handleServiceWorkerMessage);

    // 4. Track when the app gets successfully installed
    const handleAppInstalled = () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
      console.log("[PWA Engine] Master has successfully installed the Command Center App! Enjoy the direct access!");
    };
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      navigator.serviceWorker?.removeEventListener?.("message", handleServiceWorkerMessage);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      console.warn("[PWA Engine] Call rejected: deferredPrompt is not ready yet.");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA Engine] Master chosen outcome: ${outcome}`);
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setIsInstallable(false);
    }
  };

  // Dynamic Favicon and dynamic JSON Web Manifest integration
  useEffect(() => {
    const badgeUrl = clanStats?.badgeUrls?.small || clanStats?.badgeUrls?.medium;
    if (badgeUrl) {
      // Favicon Updates
      let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        link.type = "image/png";
        document.head.appendChild(link);
      }
      link.href = badgeUrl;
      console.log("[Favicon Sync] Dynamic Clan badge favicon updated:", badgeUrl);

      // Apple Touch Icon Updates
      let appleLink: HTMLLinkElement | null = document.querySelector("link[rel='apple-touch-icon']");
      if (!appleLink) {
        appleLink = document.createElement("link");
        appleLink.rel = "apple-touch-icon";
        document.head.appendChild(appleLink);
      }
      appleLink.href = clanStats?.badgeUrls?.large || badgeUrl;
      console.log("[PWA Sync] apple-touch-icon synchronized with live emblem:", appleLink.href);
    }

    // Dynamic Manifest creation to link live CoC Clan properties like Badge, Shield level and Name!
    if (clanStats) {
      const clanName = clanStats.name || "NOT HUMANS";
      const clanBadge = clanStats.badgeUrls?.large || "https://api-assets.clashofclans.com/badges/512/HdJ2Uoq78hEwblk6vU0Nt74HmQ0PGMeL-SaTp2KWphc.png";
      
      const dynamicManifest = {
        name: `${clanName} Command Center`,
        short_name: clanName,
        description: `Official Live Command Center and Stats Board for CoC Clan: ${clanName}`,
        start_url: "/",
        display: "standalone",
        background_color: "#09090b",
        theme_color: "#ef4444",
        orientation: "portrait-primary",
        icons: [
          {
            src: clanBadge,
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: clanStats.badgeUrls?.medium || clanBadge,
            sizes: "200x200",
            type: "image/png"
          },
          {
            src: clanStats.badgeUrls?.small || clanBadge,
            sizes: "70x70",
            type: "image/png"
          }
        ]
      };

      const blob = new Blob([JSON.stringify(dynamicManifest, null, 2)], { type: "application/json" });
      const dynamicUrl = URL.createObjectURL(blob);

      let link: HTMLLinkElement | null = document.querySelector("#dynamic-manifest-link");
      if (!link) {
        // Remove standard static manifest element to override standard behaviour
        const staticManifest: HTMLLinkElement | null = document.querySelector("link[rel='manifest']");
        if (staticManifest) {
          staticManifest.remove();
        }
        link = document.createElement("link");
        link.id = "dynamic-manifest-link";
        link.rel = "manifest";
        document.head.appendChild(link);
      }
      link.href = dynamicUrl;
      console.log("[PWA Sync] Web Manifest updated with live properties:", dynamicManifest);

      return () => {
        URL.revokeObjectURL(dynamicUrl);
      };
    }
  }, [clanStats]);

  // --- REAL-TIME IN-APP NOTIFICATIONS & CENTRAL UNREAD CHATS ENGINE ---
  interface InAppNotification {
    id: string;
    type: "mention" | "strategy" | "base" | "announcement";
    title: string;
    message: string;
    timestamp: number;
    linkToTab: string;
    linkToDetail?: string;
    isRead: boolean;
  }

  const [currentOpenedChannel, setCurrentOpenedChannel] = useState<string>("general");
  const [globalMessages, setGlobalMessages] = useState<any[]>([]);

  // Track last read ticks of each chat room/channel, persisted in localStorage
  const [lastReadTimes, setLastReadTimes] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    const rooms = ["general", "war", "layouts", "polls", "announcements", "silent"];
    const cachedUser = localStorage.getItem("nh_last_logged_in_uid") || "guest";
    rooms.forEach(room => {
      const stored = localStorage.getItem(`lastReadTime_${cachedUser}_${room}`);
      // Default to 12 hours ago so that on initial registration they have a realistic retro feed
      map[room] = stored ? Number(stored) : Date.now() - 12 * 60 * 60 * 1000;
    });
    return map;
  });

  // Track notifications list, persisted in localStorage
  const [notifications, setNotifications] = useState<InAppNotification[]>(() => {
    const cachedUser = localStorage.getItem("nh_last_logged_in_uid") || "guest";
    try {
      const stored = localStorage.getItem(`nh_notifications_${cachedUser}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Sync notifications to local storage on changes
  useEffect(() => {
    const keyUser = user?.uid || "guest";
    localStorage.setItem("nh_last_logged_in_uid", keyUser);
    localStorage.setItem(`nh_notifications_${keyUser}`, JSON.stringify(notifications));
  }, [notifications, user]);

  // Keep lastReadTimes synchronized with current loaded user
  useEffect(() => {
    if (user) {
      const rooms = ["general", "war", "layouts", "polls", "announcements", "silent"];
      setLastReadTimes(prev => {
        const nextMap = { ...prev };
        rooms.forEach(room => {
          const stored = localStorage.getItem(`lastReadTime_${user.uid}_${room}`);
          if (stored) {
            nextMap[room] = Number(stored);
          }
        });
        return nextMap;
      });
    }
  }, [user]);

  // Trigger double synthesizer beep audio ping
  const triggerNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playBeep = (freq: number, startTime: number, duration: number, type: OscillatorType = "sine") => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);
        
        gain.gain.setValueAtTime(0.12, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration - 0.02);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      playBeep(880, audioCtx.currentTime, 0.1, "triangle");
      playBeep(1200, audioCtx.currentTime + 0.12, 0.15, "sine");
    } catch (e) {
      console.warn("Audio Context beep trigger ignored (iframe permissions limitations):", e);
    }
  };

  // 1. Listen to background chats for mentions & unread count updates
  useEffect(() => {
    if (!user || !isRegistered) return;

    const q = query(
      collection(db, "chats"),
      orderBy("createdAt", "desc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: any[] = [];
      snapshot.forEach((d) => {
        const item = d.data();
        msgs.push({
          id: d.id,
          ...item,
          createdAtNum: item.createdAt ? (item.createdAt.toMillis ? item.createdAt.toMillis() : Number(item.createdAt)) : Date.now()
        });
      });
      
      setGlobalMessages(msgs);

      // Analyze for tagged mentions inside new chat cards
      const myPlayerName = member?.playerName || user.displayName || "";
      const myEmailUser = user.email ? user.email.split("@")[0] : "";
      
      msgs.forEach((msg) => {
        if (msg.authorUid === user.uid) return;
        
        const lowerText = (msg.text || "").toLowerCase();
        const hasMention = 
          (myPlayerName && lowerText.includes(`@${myPlayerName.toLowerCase()}`)) ||
          (myEmailUser && lowerText.includes(`@${myEmailUser.toLowerCase()}`));

        if (hasMention) {
          const mentionNotifId = `mention_${msg.id}`;
          setNotifications(prev => {
            if (prev.some(n => n.id === mentionNotifId)) return prev;
            
            triggerNotificationSound();
            const newNotif: InAppNotification = {
              id: mentionNotifId,
              type: "mention",
              title: "🎯 Tactical Mention",
              message: `${msg.authorName || "Warrior"} mentioned you in #${msg.room || "general"}: "${msg.text.substring(0, 50)}${msg.text.length > 50 ? "..." : ""}"`,
              timestamp: msg.createdAtNum,
              linkToTab: "war",
              linkToDetail: msg.room || "general",
              isRead: false
            };
            return [newNotif, ...prev].slice(0, 50);
          });
        }
      });
    }, (err) => {
      console.error("[Notifications Engine] Chats stream subscription failed:", err);
    });

    return () => unsubscribe();
  }, [user, isRegistered, member]);

  // 2. Listen to newly published Battle Strategies
  useEffect(() => {
    if (!user || !isRegistered) return;

    const q = query(
      collection(db, "strategies"),
      orderBy("createdAt", "desc"),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const item = change.doc.data();
          const stratId = change.doc.id;
          if (item.authorUid === user.uid) return;

          const createdAtNum = item.createdAt ? (item.createdAt.toMillis ? item.createdAt.toMillis() : Number(item.createdAt)) : Date.now();
          const notifId = `strategy_${stratId}`;

          // Only fire alert if within last 48 hours to prevent retroactive history dumps
          if (createdAtNum < Date.now() - 48 * 60 * 60 * 1000) return;

          setNotifications(prev => {
            if (prev.some(n => n.id === notifId)) return prev;
            
            triggerNotificationSound();
            const newNotif: InAppNotification = {
              id: notifId,
              type: "strategy",
              title: "🧠 Battle Strategy Published",
              message: `New strategy "${item.title || "Elite Guide"}" authored by ${item.authorName || "Commander"}!`,
              timestamp: createdAtNum,
              linkToTab: "strategies",
              isRead: false
            };
            return [newNotif, ...prev].slice(0, 50);
          });
        }
      });
    });

    return () => unsubscribe();
  }, [user, isRegistered]);

  // 3. Listen to newly uploaded Defense Layout Blueprints
  useEffect(() => {
    if (!user || !isRegistered) return;

    const q = query(
      collection(db, "bases"),
      orderBy("createdAt", "desc"),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const item = change.doc.data();
          const baseId = change.doc.id;
          if (item.authorUid === user.uid) return;

          const createdAtNum = item.createdAt ? (item.createdAt.toMillis ? item.createdAt.toMillis() : Number(item.createdAt)) : Date.now();
          const notifId = `base_${baseId}`;

          if (createdAtNum < Date.now() - 48 * 60 * 60 * 1000) return;

          setNotifications(prev => {
            if (prev.some(n => n.id === notifId)) return prev;
            
            triggerNotificationSound();
            const newNotif: InAppNotification = {
              id: notifId,
              type: "base",
              title: "🏰 Layout Blueprint Uploaded",
              message: `Elite TH${item.thLevel || "Unknown"} Defensive layout published by ${item.authorName || "Strategist"}!`,
              timestamp: createdAtNum,
              linkToTab: "bases",
              isRead: false
            };
            return [newNotif, ...prev].slice(0, 50);
          });
        }
      });
    });

    return () => unsubscribe();
  }, [user, isRegistered]);

  // 4. Listen to elite Announcements & Notices broadcasts
  useEffect(() => {
    if (!user || !isRegistered) return;

    const q = query(
      collection(db, "announcements"),
      orderBy("createdAt", "desc"),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const item = change.doc.data();
          const annId = change.doc.id;
          if (item.authorUid === user.uid) return;

          const createdAtNum = item.createdAt ? (item.createdAt.toMillis ? item.createdAt.toMillis() : Number(item.createdAt)) : Date.now();
          const notifId = `announcement_${annId}`;

          if (createdAtNum < Date.now() - 48 * 60 * 60 * 1000) return;

          setNotifications(prev => {
            if (prev.some(n => n.id === notifId)) return prev;
            
            triggerNotificationSound();
            const newNotif: InAppNotification = {
              id: notifId,
              type: "announcement",
              title: "📢 HQ Announcement Broadcast",
              message: `"${item.title || "Important Notice"}" published to all channels by ${item.authorName || "Clan Chief"}.`,
              timestamp: createdAtNum,
              linkToTab: "announcements",
              isRead: false
            };
            return [newNotif, ...prev].slice(0, 50);
          });
        }
      });
    });

    return () => unsubscribe();
  }, [user, isRegistered]);

  // Compute unread counts for chat channels dynamically
  const computedChatUnreads = useMemo(() => {
    const counts: Record<string, number> = {
      general: 0,
      war: 0,
      layouts: 0,
      polls: 0,
      announcements: 0
    };
    if (!user) return counts;

    globalMessages.forEach((msg) => {
      const room = msg.room || "general";
      if (msg.authorUid === user.uid) return;
      const lastRead = lastReadTimes[room] || 0;
      if (msg.createdAtNum > lastRead) {
        counts[room] = (counts[room] || 0) + 1;
      }
    });
    return counts;
  }, [globalMessages, lastReadTimes, user]);

  // Mark specific channel inside war room as read
  const markRoomAsRead = (room: string) => {
    if (!user) return;
    const now = Date.now();
    setLastReadTimes(prev => {
      const updated = { ...prev, [room]: now };
      localStorage.setItem(`lastReadTime_${user.uid}_${room}`, String(now));
      return updated;
    });
  };

  // Sync room read stamps when activeTab is "war" or currentOpenedChannel is updated
  useEffect(() => {
    if (activeTab === "war" && user) {
      markRoomAsRead(currentOpenedChannel);
    }
  }, [activeTab, currentOpenedChannel, user]);

  // Combined Sidebar Tab unreads
  const sidebarUnreads = useMemo(() => {
    const totalWarUnreads = 
      computedChatUnreads.general + 
      computedChatUnreads.war + 
      computedChatUnreads.layouts + 
      computedChatUnreads.polls + 
      computedChatUnreads.announcements;

    return {
      war: totalWarUnreads,
      strategies: notifications.filter(n => n.type === "strategy" && !n.isRead).length,
      bases: notifications.filter(n => n.type === "base" && !n.isRead).length,
      announcements: notifications.filter(n => n.type === "announcement" && !n.isRead).length
    };
  }, [computedChatUnreads, notifications]);

  // Notification management callbacks
  const handleMarkNotifAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
    const matchedNotif = notifications.find(n => n.id === id);
    if (matchedNotif?.linkToDetail) {
      setCurrentOpenedChannel(matchedNotif.linkToDetail);
    }
  };

  const handleMarkAllNotifsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const handleClearAllNotifs = () => {
    setNotifications([]);
  };

  const handleApprovePending = async (uid: string, result: boolean) => {
    try {
      const dbRef = doc(db, "members", uid);
      if (result) {
        await updateDoc(dbRef, { status: "Active", isRegisteredUser: true });
        setToast({ message: "Master, player has been officially APPROVED! 🛡️", type: "success" });
      } else {
        await deleteDoc(dbRef);
        setToast({ message: "Master, player was REJECTED and banished! ⚔️", type: "error" });
      }
    } catch (e) {
      console.error("Failed to approve player:", e);
    }
  };

  // Dynamic user specific details
  const [playerData, setPlayerData] = useState<any>(null);

  // Player Inspect Dialog and Sub-Tab States
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [isInspectOpen, setIsInspectOpen] = useState(false);
  const [rosterSubTab, setRosterSubTab] = useState<"live" | "past">("live");

  // Synchronize Firestore "members" status based on actual in-game live API members roster
  const syncRoster = async (liveMemberList: any[]) => {
    if (!liveMemberList || liveMemberList.length === 0) return;
    
    // CRITICAL: Roster synchronization writes to Firestore. Only signed-in (authenticated)
    // users with Leader or Co-Leader roles have Firestore roster write privileges.
    // This avoids "Missing or insufficient permissions" errors on unauthorized players.
    if (!auth.currentUser) {
      console.log("[Roster Sync] Guest user detected, skipping background roster sync.");
      return;
    }

    if (cocRole !== "Leader" && cocRole !== "Co-Leader") {
      console.log(`[Roster Sync] Role "${cocRole}" is not authorized to synchronize the clan roster. Skipping.`);
      return;
    }

    try {
      const querySnapshot = await getDocs(collection(db, "members"));
      const firestoreMembers: any[] = [];
      querySnapshot.forEach(docSnap => {
        firestoreMembers.push({ uid: docSnap.id, ...docSnap.data() });
      });

      // Normalize live user tags with uppercase and trim to eliminate case/whitespace matching issues
      const liveTagsSet = new Set(liveMemberList.map(m => m.tag?.toUpperCase().trim()).filter(Boolean));
      const batch = writeBatch(db);
      let writesCount = 0;

      // 1. If an active firestore member is NOT in the live players API list anymore, mark them as Former Member
      for (const fMember of firestoreMembers) {
        if (!fMember.playerTag) continue;
        const normalizedFTag = fMember.playerTag.toUpperCase().trim();
        const isStillInClan = liveTagsSet.has(normalizedFTag);
        const currentStatus = fMember.status?.trim().toLowerCase();
        
        if (!isStillInClan && currentStatus === "active") {
          const docRef = doc(db, "members", fMember.uid);
          batch.update(docRef, {
            status: "Former Member",
            previousRole: fMember.role || "Member",
            role: "Former Member",
            updatedAt: new Date().toISOString()
          });

          // Generate dynamic departure chronicle milestone
          const historyRef = doc(collection(db, "history"));
          batch.set(historyRef, {
            title: `🛡️ Legend Departed: ${fMember.playerName || "A comrade"}`,
            type: "milestone",
            description: `Veteran Commander **${fMember.playerName || "A comrade"}** (${fMember.playerTag || ""}) has departed to start a new journey. Their active service under rank of ${fMember.role || "Warrior"} has ended.`,
            imageUrl: "",
            date: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString()
          });

          writesCount += 2;
        }
        // 2. If a former member joined back, set them back to Active
        else if (isStillInClan && currentStatus === "former member") {
          const liveDetails = liveMemberList.find(m => m.tag?.toUpperCase().trim() === normalizedFTag);
          const docRef = doc(db, "members", fMember.uid);
          
          const rawRole = (liveDetails?.role || "member").toLowerCase();
          const assignedRole = rawRole === "admin" || rawRole === "elder" ? "Elder" : rawRole === "coleader" || rawRole === "co-leader" ? "Co-Leader" : rawRole === "leader" ? "Leader" : "Member";
          
          batch.update(docRef, {
            status: "Active",
            role: assignedRole,
            trophies: liveDetails?.trophies || fMember.trophies || 0,
            townHall: liveDetails?.townHallLevel || fMember.townHall || 15,
            warStars: liveDetails?.warStars || fMember.warStars || 0,
            updatedAt: new Date().toISOString()
          });

          // Generate dynamic return chronicle milestone
          const historyRef = doc(collection(db, "history"));
          batch.set(historyRef, {
            title: `⚡ Rebel Returned: ${fMember.playerName || "A comrade"}`,
            type: "milestone",
            description: `Rebel Commander **${fMember.playerName || "A comrade"}** (${fMember.playerTag || ""}) has returned to the battlefield! Active rank of ${assignedRole} is restored.`,
            imageUrl: "",
            date: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString()
          });

          writesCount += 2;
        }
        // 2.5 If an already active member has changed stats, update them dynamically in real-time in the database!
        else if (isStillInClan && currentStatus === "active") {
          const liveDetails = liveMemberList.find(m => m.tag?.toUpperCase().trim() === normalizedFTag);
          if (liveDetails) {
            const rawRole = (liveDetails.role || "member").toLowerCase();
            const assignedRole = rawRole === "admin" || rawRole === "elder" ? "Elder" : rawRole === "coleader" || rawRole === "co-leader" ? "Co-Leader" : rawRole === "leader" ? "Leader" : "Member";
            
            const liveTrophies = liveDetails.trophies || 0;
            const liveTownHall = liveDetails.townHallLevel || 15;
            const liveWarStars = liveDetails.warStars || 0;
            const liveName = liveDetails.name || fMember.playerName;

            const hasChanged = 
              fMember.trophies !== liveTrophies || 
              fMember.townHall !== liveTownHall || 
              fMember.warStars !== liveWarStars ||
              fMember.role !== assignedRole ||
              fMember.playerName !== liveName;

            if (hasChanged) {
              const docRef = doc(db, "members", fMember.uid);
              batch.update(docRef, {
                playerName: liveName,
                role: assignedRole,
                trophies: liveTrophies,
                townHall: liveTownHall,
                warStars: liveWarStars,
                updatedAt: new Date().toISOString()
              });
              writesCount++;
            }
          }
        }
      }

      // 3. If a live clan member does not yet exist in Firestore, seed them as an Active member
      const firestoreTagsSet = new Set(firestoreMembers.map(m => m.playerTag?.toUpperCase().trim()).filter(Boolean));
      for (const lMember of liveMemberList) {
        if (!lMember.tag) continue;
        const normalizedTag = lMember.tag.toUpperCase().trim();
        if (!firestoreTagsSet.has(normalizedTag)) {
          const docId = normalizedTag.replace("#", "");
          const docRef = doc(db, "members", docId);
          
          const rawRole = (lMember.role || "member").toLowerCase();
          const assignedRole = rawRole === "admin" || rawRole === "elder" ? "Elder" : rawRole === "coleader" || rawRole === "co-leader" ? "Co-Leader" : rawRole === "leader" ? "Leader" : "Member";

          batch.set(docRef, {
            uid: docId,
            playerTag: lMember.tag,
            playerName: lMember.name || "Clan Mate",
            role: assignedRole,
            townHall: lMember.townHallLevel || 15,
            trophies: lMember.trophies || 5000,
            warStars: lMember.warStars || 0,
            status: "Active",
            specialty: "QC Hybrid Specialist",
            joinedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          writesCount++;
        }
      }

      // Commit updates if any changes occurred
      if (writesCount > 0) {
        await batch.commit();
        console.log(`[Roster Sync] Successfully synchronized ${writesCount} member states with Firestore!`);
      }
    } catch (error) {
      console.error("Failed to run automatic roster synchronization:", error);
    }
  };

  // 1. Core Auth State Change Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const isMasterDev = firebaseUser.email?.toLowerCase() === "waizmonazzum270@gmail.com";
        const memberRef = doc(db, "members", firebaseUser.uid);
        const docSnap = await getDoc(memberRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as Member;
          let finalRole = data.role;
          let needsUpdate = false;
          let finalStatus = data.status;
          let finalTag = data.playerTag;
          let finalName = data.playerName;
          
          if (isMasterDev) {
            if (data.role !== "Leader" || data.status !== "Active" || data.playerTag !== "#PV9GPQPUC" || data.playerName !== "⚡Nadozaid⚡") {
              finalRole = "Leader";
              finalStatus = "Active";
              finalTag = "#PV9GPQPUC";
              finalName = "⚡Nadozaid⚡";
              needsUpdate = true;
            }
          }
          
          const updatedMember: Member = {
            ...data,
            role: finalRole,
            playerTag: finalTag,
            status: finalStatus,
            playerName: finalName
          };

          if (needsUpdate) {
            await setDoc(memberRef, { 
              role: "Leader", 
              playerTag: "#PV9GPQPUC", 
              status: "Active",
              playerName: "⚡Nadozaid⚡",
              updatedAt: new Date().toISOString()
            }, { merge: true });
          }

          setMember(updatedMember);
          setCocRole(finalRole);
          setIsRegistered(true);
          setShowTagModal(false);
          
          // Preload active player specifics
          try {
            const res = await fetch(`/api/verify-player/${encodeURIComponent(updatedMember.playerTag)}`);
            if (res.ok) {
              const text = await res.text();
              const body = JSON.parse(text);
              if (body.player) setPlayerData(body.player);
            } else throw new Error("API failed");
          } catch (e) {
            try {
              const cachedData = await import("../clanData.json");
              const clanList = cachedData.default?.memberList || cachedData.memberList || [];
              const clanMember = clanList.find((m: any) => m.tag === updatedMember.playerTag);
              if (clanMember) setPlayerData(clanMember);
            } catch (err) {}
          }
        } else {
          if (isMasterDev) {
            // Instantly auto-register the master email to skip modal entry screens!
            const newMember: Member = {
              uid: firebaseUser.uid,
              playerTag: "#PV9GPQPUC",
              playerName: "⚡Nadozaid⚡",
              role: "Leader",
              townHall: 15,
              trophies: 5650,
              warStars: 1940,
              status: "Active",
              specialty: "QC Hybrid Specialist",
              joinedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };

            await setDoc(memberRef, newMember);
            setMember(newMember);
            setCocRole("Leader");
            setIsRegistered(true);
            setShowTagModal(false);

            try {
              const res = await fetch(`/api/verify-player/%23PV9GPQPUC`);
              if (res.ok) {
                 const text = await res.text();
                 const body = JSON.parse(text);
                 if (body.player) setPlayerData(body.player);
              } else throw new Error("API failed");
            } catch (e) {
              try {
                const cachedData = await import("../clanData.json");
                const clanList = cachedData.default?.memberList || cachedData.memberList || [];
                const clanMember = clanList.find((m: any) => m.tag === "#PV9GPQPUC");
                if (clanMember) setPlayerData(clanMember);
              } catch (err) {}
            }
          } else {
            // Force modal to register player tag
            setIsRegistered(false);
            setShowTagModal(true);
          }
        }
      } else {
        setMember(null);
        setCocRole(null);
        setIsRegistered(false);
        setPlayerData(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Real-time Members Sync List (Hall of Legends and Leaderboards)
  useEffect(() => {
    const q = query(collection(db, "members"), orderBy("trophies", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Member[] = [];
      snapshot.forEach(docSnap => {
        list.push({ uid: docSnap.id, ...docSnap.data() } as Member);
      });
      setAllMembers(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "members");
    });
    return () => unsubscribe();
  }, []);

  // 2.7 Fetch Pending Approvals for Leader
  useEffect(() => {
    if (!user || !isRegistered || (cocRole !== "Leader" && cocRole !== "Co-Leader")) return;

    const q = query(
      collection(db, "members"),
      where("status", "==", "Pending")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const item = change.doc.data();
          const pendingUid = change.doc.id;
          
          const notifId = `approval_${pendingUid}`;
          
          setNotifications(prev => {
            if (prev.some(n => n.id === notifId)) return prev;
            return [{
              id: notifId,
              type: "announcement", // Repurpose announcement icon or generic type
              title: "👑 PENDING APPROVAL",
              message: `Unknown tag ${item.playerTag} (${item.playerName}) is requesting to sync a profile not in our live clan roster.`,
              timestamp: Date.now(),
              isRead: false
            }, ...prev];
          });
        }
      });
    });

    return () => unsubscribe();
  }, [user, isRegistered, cocRole]);

  // 3. Sync Clan stats with periodic high-frequency polling from API proxy for instant real-time responsiveness
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/clan");
        if (response.ok) {
           // We might get an HTML response in Vercel. Try to parse JSON.
          const text = await response.text();
          try {
            const data = JSON.parse(text);
            if (data && data.memberList) {
              setClanStats(data);
              setLastSyncedTime(new Date());
              return;
            }
          } catch (e) {
            console.warn("Could not parse JSON from /api/clan, falling back to local data");
          }
        }
        
        // Fallback to local import if the above fails or response NOT ok
        const cachedData = await import("../clanData.json");
        setClanStats(cachedData.default || cachedData);
        setLastSyncedTime(new Date());

      } catch (err) {
        console.error("Could not fetch clan statistics:", err);
        // Fallback for Vercel static deployments where endpoint fails completely
        try {
          const cachedData = await import("../clanData.json");
          setClanStats(cachedData.default || cachedData);
          setLastSyncedTime(new Date());
        } catch(e) {}
      } finally {
        setClanLoading(false);
      }
    };

    const fetchIp = async () => {
      try {
        const res = await fetch("/api/ip");
        if (res.ok) {
          const text = await res.text();
          try {
             const data = JSON.parse(text);
             setOutboundIp(data.ip);
          } catch(e) {
             setOutboundIp("Failed to query IP");
          }
        }
      } catch (e) {
        setOutboundIp("Failed to query IP");
      }
    };

    fetchStats();
    fetchIp();

    // Set up auto-updater background interval (runs every 15 seconds to reflect instaneous edits)
    const intervalId = setInterval(() => {
      fetchStats();
    }, 15000);

    return () => clearInterval(intervalId);
  }, []);

  // 4. Reactive Roster Synchronization (only executed securely by authenticated Leader/Co-Leader)
  useEffect(() => {
    if (clanStats && clanStats.memberList && clanStats.memberList.length > 0) {
      const isUserAuthorized = cocRole === "Leader" || cocRole === "Co-Leader";
      if (isUserAuthorized) {
        console.log("[Roster Sync] Authorized Leader/Co-Leader session detected. Refreshing clan roster.");
        syncRoster(clanStats.memberList);
      }
    }
  }, [clanStats, cocRole]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setToast({
        message: "Welcome, Commander! Secure connection established successfully.",
        type: "success"
      });
    } catch (err: any) {
      console.error("Google authentication failed:", err);
      
      const googleErrCode = err.code || "unknown";
      let googleFriendlyMsg = "Google login failed.";
      if (googleErrCode === "auth/unauthorized-domain") {
        googleFriendlyMsg = "Google login: Domain not authorized. Add " + window.location.hostname + " to authorized domains in Firebase Console.";
      } else if (googleErrCode === "auth/operation-not-allowed") {
        googleFriendlyMsg = "Google login: Provider not enabled. Enable Google sign-in in Firebase Auth Console.";
      } else if (err.message && err.message.includes("closed")) {
        googleFriendlyMsg = "Login prompt closed by user.";
      } else {
        googleFriendlyMsg = `Authentication error: ${err.message || googleErrCode}`;
      }

      setToast({
        message: googleFriendlyMsg,
        type: "error"
      });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setMember(null);
      setCocRole(null);
      setIsRegistered(false);
      setActiveTab("hq");
    } catch (err) {
      console.error("Log out failed:", err);
    }
  };

  const handleVerifyTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputTag.trim() || !user) return;
    setRegistering(true);

    try {
      const cleaned = inputTag.trim().toUpperCase();
      const cleanedTagWithHash = cleaned.startsWith("#") ? cleaned : `#${cleaned}`;

      // 1. Prevent duplicate registrations for the same player tag
      const q = query(collection(db, "members"), where("playerTag", "==", cleanedTagWithHash));
      const querySnapshot = await getDocs(q);
      let isRegisteredByOther = false;
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.isRegisteredUser && data.uid !== user.uid) {
          isRegisteredByOther = true;
        }
      });

      if (isRegisteredByOther) {
        alert(`Master, this Player Tag (${cleanedTagWithHash}) has already been registered by another comrade! One player tag can only be registered once on our Command Center.`);
        setRegistering(false);
        return;
      }

      // 2. Query player details from our clan verify proxy
      let body: any = null;
      try {
        const response = await fetch(`/api/verify-player/${encodeURIComponent(cleanedTagWithHash)}`);
        if (response.ok) {
          const text = await response.text();
          try {
            body = JSON.parse(text);
          } catch (e) {
            console.warn("Parse failed for /api/verify-player, falling back to local");
          }
        }
      } catch (e) {
        console.warn("Fetch failed for /api/verify-player, falling back to local");
      }

      if (!body) {
        // Fallback to local clanData.json if vercel api fails
        try {
          const cachedData = await import("../clanData.json");
          const clanList = cachedData.default?.memberList || cachedData.memberList || [];
          const clanMember = clanList.find((m: any) => m.tag === cleanedTagWithHash);
          
          if (clanMember) {
            body = {
               verified: true,
               belongsToClan: true,
               player: {
                  tag: clanMember.tag,
                  name: clanMember.name,
                  townHallLevel: clanMember.townHallLevel || 15,
                  role: clanMember.role,
                  trophies: clanMember.trophies || 5000,
                  bestTrophies: (clanMember.trophies || 5000) + 350,
                  warStars: clanMember.expLevel ? clanMember.expLevel * 4 : 1000,
                  league: clanMember.league || { name: "Unranked" },
                  heroes: [
                    { name: "Barbarian King", level: Math.min((clanMember.townHallLevel || 15) * 4, 95) },
                    { name: "Archer Queen", level: Math.min((clanMember.townHallLevel || 15) * 4, 95) },
                    { name: "Grand Warden", level: Math.min(Math.max(0, ((clanMember.townHallLevel || 15) - 10) * 4), 70) }
                  ]
               }
            };
          } else {
             body = {
                verified: false,
                belongsToClan: false,
                error: `Master, this Player Tag (${cleanedTagWithHash}) does not exist in our offline roster.`
             };
          }
        } catch (e) {
          throw new Error("Proxy offline and local fallback failed");
        }
      }

      if (body.verified && body.belongsToClan) {
        const player = body.player;

        // Keep DB clean from duplicate legacy unregistered auto-synchronized records
        const strippedTag = player.tag.toUpperCase().replace("#", "");
        if (strippedTag) {
          try {
            await deleteDoc(doc(db, "members", strippedTag));
          } catch (e) {
            console.warn("Could not delete legacy unregistered member log, proceeding:", e);
          }
        }

        const userStatus = body.needsApproval ? "Pending" : "Active";
        // Map CoC role to website role
        let assignedRole = "Member";
        console.log("Player raw role detection:", player.role);
        if (player.role?.toLowerCase() === "leader") assignedRole = "Leader";
        else if (player.role?.toLowerCase() === "coleader") assignedRole = "Co-Leader";
        else if (player.role?.toLowerCase() === "co-leader") assignedRole = "Co-Leader";
        else if (player.role?.toLowerCase() === "admin") assignedRole = "Elder";
        console.log("Assigned role:", assignedRole);

        // Security Passcode Challenge for Leaders and Co-Leaders to prevent unauthorized claims
        if (!body.needsApproval && (assignedRole === "Leader" || assignedRole === "Co-Leader" || player.tag === "#PV9GPQPUC" || player.tag?.toUpperCase() === "#PV9GPQPUC")) {
          console.log("Triggering passcode prompt for tag:", player.tag);
          setPendingPasscodeRegistration({ body, assignedRole, userStatus, player });
          setShowTagModal(false);
          setRegistering(false);
          return;
        }

        await completeRegistration(body, assignedRole, userStatus, player);
      } else {
        alert(body.error || `Master, this Player Tag does not exist or does not belong to our official 'NOT HUMANS' clan (#2JVQ8PUUG)!`);
      }
    } catch (err: any) {
      console.error("Verification failed:", err);
      alert("Master, verification server is offline or returned an error. Please retry!");
    } finally {
      setRegistering(false);
    }
  };

  const completeRegistration = async (body: any, assignedRole: string, userStatus: string, player: any) => {
    if (!user) return;
    try {
      const memberRef = doc(db, "members", user.uid);
      const newMember: Member = {
        uid: user.uid,
        playerTag: player.tag,
        playerName: player.name,
        role: assignedRole as any,
        townHall: player.townHallLevel || 15,
        trophies: player.trophies || 5000,
        warStars: player.warStars || 1000,
        status: userStatus as any,
        specialty: "QC Hybrid Specialist", // default selection
        isRegisteredUser: true,
        joinedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(memberRef, newMember);
      setMember(newMember);
      setCocRole(newMember.role);
      setIsRegistered(true);
      setShowTagModal(false);
      setPlayerData(player);
      
      alert(`Master, Verification Successful!\nMatched Comrade: ${player.name}\nDesignation: ${newMember.role}`);
    } catch (err: any) {
      console.error("Verification commit failed:", err);
      alert("Master, database offline.");
    }
  };

  const submitPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedSecret = passcodeInput.trim().toUpperCase();
    if (sanitizedSecret !== "NOTHUMANS_LEADER" && sanitizedSecret !== "NOTHUMANS" && sanitizedSecret !== "LEADER") {
      alert("❌ Verification Rejected: Invalid Sovereign Passcode.");
      setPendingPasscodeRegistration(null);
      setPasscodeInput("");
      return;
    }
    
    if (pendingPasscodeRegistration) {
      setRegistering(true);
      await completeRegistration(
        pendingPasscodeRegistration.body,
        pendingPasscodeRegistration.assignedRole,
        pendingPasscodeRegistration.userStatus,
        pendingPasscodeRegistration.player
      );
      setRegistering(false);
      setPendingPasscodeRegistration(null);
      setPasscodeInput("");
    }
  };

  const getSyncStatusMessage = () => {
    if (!lastSyncedTime) return "Never";
    const diffMs = new Date().getTime() - lastSyncedTime.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);

    if (diffSecs < 10) return "Just now";
    if (diffSecs < 60) return `${diffSecs}s ago`;
    return `${diffMins}m ago`;
  };

  const handleForceSync = async () => {
    if (cocRole !== "Leader" && cocRole !== "Co-Leader") {
      alert("Only the Leader or Co-Leader has authority to trigger database synchronization, Master! 🛡️");
      return;
    }
    setIsSyncing(true);
    try {
      const response = await fetch("/api/clan");
      if (response.ok) {
        const data = await response.json();
        setClanStats(data);
        setLastSyncedTime(new Date());

        if (data && data.memberList && data.memberList.length > 0) {
          await syncRoster(data.memberList);
        }
        alert("Clan list and database synchronized successfully, Master! 🏆");
      } else {
        alert("Clash of Clans API is busy. Please try again later! 🛡️");
      }
    } catch (err) {
      console.error("Force sync failed:", err);
      alert("Synchronization encountered an unexpected error, Master!");
    } finally {
      setIsSyncing(false);
    }
  };

  // Dynamic Player Avatar generator (instead of bullets)
  const getPlayerAvatar = (name: string, role: string, th: number) => {
    const initials = name ? name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "CM" : "CM";
    let bgGradient = "from-[#290f11] via-[#150607] to-zinc-950";
    let borderRing = "border-red-900/60 shadow-md";
    let textGrad = "text-rose-400";

    if (role === "Leader") {
      bgGradient = "from-amber-500 via-rose-750 to-purple-950";
      borderRing = "border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.55)] ring-1 ring-amber-300/30 animate-pulse";
      textGrad = "text-yellow-100 font-extrabold";
    } else if (role === "Co-Leader") {
      bgGradient = "from-amber-600 via-[#1f0d0e] to-red-950";
      borderRing = "border-amber-500/80 shadow-[0_0_8px_rgba(245,158,11,0.35)]";
      textGrad = "text-amber-200 font-bold";
    } else if (role === "Elder") {
      bgGradient = "from-cyan-600 to-indigo-950";
      borderRing = "border-cyan-400/80 shadow-[0_0_6px_rgba(34,211,238,0.2)]";
      textGrad = "text-cyan-200 font-medium";
    }

    return (
      <div className={`h-8 w-8 rounded-full bg-gradient-to-br ${bgGradient} border-2 ${borderRing} flex items-center justify-center font-mono text-[9px] uppercase font-black tracking-tighter ${textGrad} select-none flex-shrink-0`}>
        {initials}
      </div>
    );
  };

  // Persistent Clan Description & War Rules States (Real-time Firestore Synchronized)
  const [clanDescription, setClanDescription] = useState<string>(
    `🔰 Serious War Clan — Only for Legends ⚔️\n🔰 Wanna join CWL? First we check your war skills 💪\n🔰 Full Clan Games, Events & Donations — always maxed\n🔰 Elder earned through War performance, Clan Games & activity\n🔰 Co-Leader requires loyalty, trust & at least 1 month with us\n🔰 Wars, CWL & Bonus decisions are handled by the Leader`
  );
  const [clanWarRules, setClanWarRules] = useState<string>(
    `⚔️ NOT HUMANS RULES & WAR CODEX ⚔️\n\n1. BOTH WAR ATTACKS ARE MANDATORY. No exceptions, targets are designated by Co-Leaders.\n2. ALL HEROES MUST BE ACTIVE IN WARS. If you are upgrading, mark status as opt-out.\n3. FOLLOW STRATEGY. Do not attack random bases without consulting Co-Leaders.\n4. SPECIFIC DONATIONS. Fill defense with max tier troops specified in requests.\n5. STAY ACTIVE & RESPECT FAMILY.`
  );
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [isEditRulesOpen, setIsEditRulesOpen] = useState(false);
  const [isEditDescOpen, setIsEditDescOpen] = useState(false);
  const [rulesDraft, setRulesDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const [savingMetadata, setSavingMetadata] = useState(false);

  // Initialize and synchronize Description or Rules across all clients in real-time
  useEffect(() => {
    const docRef = doc(db, "configs", "clan_metadata");
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.description) setClanDescription(data.description);
        if (data.warRules) setClanWarRules(data.warRules);
      } else {
        // Seed initial setups
        setDoc(docRef, {
          description: `🔰 Serious War Clan — Only for Legends ⚔️\n🔰 Wanna join CWL? First we check your war skills 💪\n🔰 Full Clan Games, Events & Donations — always maxed\n🔰 Elder earned through War performance, Clan Games & activity\n🔰 Co-Leader requires loyalty, trust & at least 1 month with us\n🔰 Wars, CWL & Bonus decisions are handled by the Leader`,
          warRules: `⚔️ NOT HUMANS RULES & WAR CODEX ⚔️\n\n1. BOTH WAR ATTACKS ARE MANDATORY. No exceptions, coordinates are designated by Co-Leaders.\n2. ALL HEROES MUST BE ACTIVE IN WARS. If you are upgrading, mark status as opt-out.\n3. FOLLOW STRATEGY. Do not attack random bases without consulting Co-Leaders.\n4. SPECIFIC DONATIONS. Fill defense with max tier troops specified in requests.\n5. STAY ACTIVE & RESPECT FAMILY.`
        }).catch(err => console.warn("Failed to seed default configs:", err));
      }
    }, (err) => {
      console.warn("Error loading dynamic settings:", err);
    });
    return () => unsubscribe();
  }, []);

  const handleSaveMetadata = async (type: "desc" | "rules", newValue: string) => {
    setSavingMetadata(true);
    try {
      const docRef = doc(db, "configs", "clan_metadata");
      const payload: any = {};
      if (type === "desc") payload.description = newValue;
      else payload.warRules = newValue;

      await setDoc(docRef, payload, { merge: true });
      if (type === "desc") setIsEditDescOpen(false);
      else setIsEditRulesOpen(false);
      alert("Clan database configuration modulated successfully, Master! 🛡️");
    } catch (e: any) {
      console.error("Failed to write configs:", e);
      alert("Database error: Missing index or unauthorized role permission, Master.");
    } finally {
      setSavingMetadata(false);
    }
  };

  // Dynamically merge local Firestore data with live API polling structure for 100% accurate, real-time metrics
  const liveActiveMembers = useMemo(() => {
    if (clanStats && clanStats.memberList && clanStats.memberList.length > 0) {
      return clanStats.memberList.map((m: any) => {
        const rawRole = (m.role || "member").toLowerCase();
        const assignedRole = rawRole === "admin" || rawRole === "elder" ? "Elder" : rawRole === "coleader" || rawRole === "co-leader" ? "Co-Leader" : rawRole === "leader" ? "Leader" : "Member";
        
        const dbMatch = allMembers.find(f => f.playerTag?.toUpperCase().trim() === m.tag?.toUpperCase().trim());
        
        return {
          uid: m.tag.replace("#", ""),
          playerTag: m.tag,
          playerName: m.name || "Clan Mate",
          role: assignedRole,
          townHall: m.townHallLevel || dbMatch?.townHall || 15,
          trophies: m.trophies || 5000,
          warStars: m.warStars !== undefined ? m.warStars : (dbMatch?.warStars || 0),
          status: "Active",
          specialty: dbMatch?.specialty || "QC Hybrid Specialist",
          joinedAt: dbMatch?.joinedAt || new Date().toISOString(),
          updatedAt: dbMatch?.updatedAt || new Date().toISOString()
        } as Member;
      }).sort((a, b) => b.trophies - a.trophies);
    }
    
    return allMembers.filter(m => m.status === "Active");
  }, [allMembers, clanStats]);

  // Quick stats computed directly from synced members list
  const activeMembersCount = liveActiveMembers.length;
  const formerMembersCount = allMembers.filter(m => m.status === "Former Member").length;
  
  // Custom theme constants
  const cwlLeagueName = clanStats?.warLeague?.name || "Champion League III";
  const capitalLevel = clanStats?.clanCapital?.capitalHallLevel || 10;
  const totalWarWins = clanStats?.warWins || 342;
  const currentStreak = clanStats?.warWinStreak || 9;

  return (
    <div className={`clash-cosmic-bg text-zinc-100 flex flex-col font-sans selection:bg-rose-900/40 selection:text-white relative overflow-hidden ${
      activeTab === "war" && user && isRegistered ? "h-[100dvh]" : "min-h-screen"
    }`}>
      
      {/* Immersive Game Vibe Parallax & Volcanic Glowing Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(244,63,94,0.075)_0%,_transparent_75%)] pointer-events-none z-0 animate-pulse" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(251,191,36,0.02)_1px,_transparent_1px),_linear-gradient(90deg,_rgba(251,191,36,0.02)_1px,_transparent_1px)] bg-[size:40px_40px] pointer-events-none z-0 opacity-60" />
      
      {/* Hot Volcanic Floating Glowing Orbs - 3D depth */}
      <div className="absolute -top-12 left-1/4 h-[550px] w-[550px] bg-rose-900/20 rounded-full filter blur-[130px] pointer-events-none z-0 volcanic-ambient" />
      <div className="absolute top-1/3 right-10 h-[500px] w-[500px] bg-amber-900/15 rounded-full filter blur-[150px] pointer-events-none z-0 volcanic-ambient" style={{ animationDelay: "-3s" }} />
      <div className="absolute -bottom-20 left-1/3 h-[600px] w-[600px] bg-purple-950/15 rounded-full filter blur-[160px] pointer-events-none z-0 volcanic-ambient" style={{ animationDelay: "-6s" }} />
      <div className="absolute bottom-10 right-1/4 h-[450px] w-[450px] bg-cyan-950/10 rounded-full filter blur-[120px] pointer-events-none z-0 volcanic-ambient" style={{ animationDelay: "-9s" }} />


      {/* Header and navigation controller */}
      <div className={activeTab === "war" && user && isRegistered ? "hidden lg:block" : "block"}>
        <Header
          user={user}
          cocRole={cocRole}
          onLogin={handleLogin}
          onLogout={handleLogout}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isRegistered={isRegistered}
          clanBadgeUrl={clanStats?.badgeUrls?.medium}
          playerName={member?.playerName || undefined}
          onOpenProfile={() => setIsProfileDrawerOpen(true)}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          notifications={notifications}
          onMarkAsRead={handleMarkNotifAsRead}
          onMarkAllAsRead={handleMarkAllNotifsAsRead}
          onClearNotifications={handleClearAllNotifs}
          onApprovePending={handleApprovePending}
        />
      </div>

      {/* Main Row container for Dashboard Sidebar + Operational Content */}
      <div className="flex flex-row flex-1 relative w-full overflow-hidden">
        
        {/* Premium Hamburger Side Drawer Navigation (only visible to logged in members) */}
        <PremiumSidebar
          user={user}
          cocRole={cocRole}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isRegistered={isRegistered}
          playerName={member?.playerName || undefined}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          onLogout={handleLogout}
          onOpenProfile={() => setIsProfileDrawerOpen(true)}
          unreadCounts={sidebarUnreads}
        />

        {/* Main Panel views content container */}
        <main className={`flex-1 relative z-10 scrollbar-thin ${
          activeTab === "war" && user && isRegistered 
            ? "p-0 lg:py-8 lg:px-6 h-full overflow-hidden flex flex-col" 
            : "py-8 px-4 sm:px-6 overflow-y-auto"
        }`}>

        {/* View Switch routing */}
        {activeTab === "hq" && (
          <div className="space-y-12">
            
            {/* 1. Clash of Clans Authentic Royal Banner Section */}
            <div className="relative rounded-2xl border-2 border-amber-500/25 bg-gradient-to-b from-[#1c1114] via-[#100b0c] to-[#0d090a] overflow-hidden py-12 px-6 sm:px-12 text-center shadow-2xl flex flex-col items-center justify-center shadow-[0_0_40px_rgba(239,68,68,0.06)]">
              
              {/* CoC style decorative flags and wood/stone texture overlays */}
              <div className="absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-r from-red-600 via-amber-500 to-red-600" />
              <div className="absolute inset-0 bg-[linear-gradient(rgba(239,68,68,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(239,68,68,0.01)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none opacity-40" />
              
              {/* Golden circular backdrop glow */}
              <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-80 w-80 bg-gradient-to-b from-amber-500/10 to-transparent rounded-full filter blur-3xl pointer-events-none" />

              {/* Majestic Large Circular Clan Badge (Same Banner as CoC) */}
              <div className="relative mb-6 group select-none">
                <div className="absolute inset-0 bg-red-600/25 rounded-full filter blur-xl group-hover:bg-red-500/35 transition duration-500 pointer-events-none" />
                <div className="relative rounded-full p-1 border-2 border-amber-400 bg-zinc-950 shadow-[0_0_25px_rgba(245,158,11,0.3)]">
                  <img 
                    src={clanStats?.badgeUrls?.large || "https://api-assets.clashofclans.com/badges/512/HdJ2Uoq78hEwblk6vU0Nt74HmQ0PGMeL-SaTp2KWphc.png"} 
                    alt="NOT HUMANS Large Emblem" 
                    className="h-28 w-28 sm:h-32 sm:w-32 object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>

              <span className="inline-flex items-center space-x-2 font-mono text-[10px] font-black uppercase tracking-widest bg-amber-950/40 border border-amber-800/40 text-amber-400 px-3 py-1 rounded-full mb-4">
                <Flame className="h-3.5 w-3.5 text-amber-500" />
                <span>OFFICIAL IN-GAME SHIELD AND REGISTERED BADGE</span>
              </span>

              <h1 className="font-sans text-4xl sm:text-7xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-zinc-50 via-zinc-200 to-amber-200 select-none drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)] max-w-4xl leading-none">
                NOT HUMANS
              </h1>
              
              <span className="block font-mono text-xs sm:text-sm font-bold text-red-500 tracking-widest uppercase mt-2 select-none">
                CLAN COMMAND MATRIX • <span className="text-zinc-400">#2JVQ8PUUG</span>
              </span>

              <p className="mt-4 font-mono text-[10.5px] sm:text-xs text-zinc-400 max-w-xl uppercase tracking-wider mx-auto leading-relaxed border-t border-zinc-900/60 pt-4">
                The sovereign, esports-inspired secure communications hub, war room registry, and real-time operations dashboard for elite commanders.
              </p>

              <div className="mt-8 flex flex-wrap justify-center gap-4 relative z-10">
                {user ? (
                  isRegistered ? (
                    <button
                      onClick={() => setActiveTab("war")}
                      className="flex items-center space-x-2.5 rounded bg-gradient-to-r from-red-600 via-rose-700 to-red-600 px-6 py-3 font-mono text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-red-950/60 hover:from-red-500 hover:to-rose-600 transition-all active:translate-y-0.5"
                    >
                      <Zap className="h-4 w-4 text-amber-400" />
                      <span>Enter War Room</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowTagModal(true)}
                      className="flex items-center space-x-2 rounded bg-amber-500 hover:bg-amber-400 px-6 py-3 font-mono text-xs font-black uppercase tracking-widest text-zinc-950 shadow-lg shadow-amber-950/55 transition-all"
                    >
                      <span>Verify Player Tag</span>
                    </button>
                  )
                ) : (
                  <button
                    onClick={handleLogin}
                    className="flex items-center justify-center space-x-2.5 rounded bg-red-600 hover:bg-red-500 px-6 py-3 font-mono text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-red-950/40 transition-all cursor-pointer"
                  >
                    <User className="h-4 w-4" />
                    <span>Login with Google</span>
                  </button>
                )}

                {isInstallable && (
                  <button
                    onClick={handleInstallClick}
                    className="flex items-center space-x-2.5 rounded border border-amber-500/80 bg-amber-500/10 hover:bg-amber-500/20 px-6 py-3 font-mono text-xs font-black uppercase tracking-widest text-amber-400 shadow-lg shadow-amber-950/40 animate-pulse transition-all active:translate-y-0.5"
                  >
                    <Download className="h-4 w-4 text-amber-500 animate-bounce" />
                    <span>Install HQ App</span>
                  </button>
                )}

                <a
                  href="https://link.clashofclans.com/en?action=OpenClanProfile&tag=%232JVQ8PUUG"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-2 rounded border border-zinc-800 bg-zinc-900/60 px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-zinc-200 transition-all shadow"
                >
                  <span>Official In-Game Profile</span>
                  <ExternalLink className="h-3.5 w-3.5 text-zinc-500" />
                </a>
              </div>
            </div>

            {/* 2. Interactive Clan Telemetry (Live bento grid) */}
            <div className="space-y-5">
              <div className="flex items-center space-x-2 border-b border-zinc-900/40 pb-3">
                <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
                <h3 className="font-sans text-xs font-black uppercase tracking-widest text-zinc-300">
                  Clan Telemetry Matrix
                </h3>
              </div>

              {clanLoading ? (
                <div className="flex items-center space-x-2.5 font-mono text-xs text-zinc-500">
                  <div className="h-3 w-3 animate-spin rounded-full border border-red-500 border-t-transparent" />
                  <span>Loading secure logs...</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {/* Clan Level (Crimson) */}
                  <div className="glass-card-crimson rounded-xl p-4.5 shadow-2xl flex flex-col justify-between card-3d relative overflow-hidden group">
                    <div className="absolute top-2 right-2 opacity-15 group-hover:opacity-40 transition">
                      <Award className="h-10 w-10 text-rose-500" />
                    </div>
                    <span className="block font-mono text-[9px] uppercase tracking-wider text-rose-400 font-bold">Clan Authority</span>
                    <span className="font-sans text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-zinc-50 to-red-200 mt-2.5">Level {clanStats?.clanLevel || 18}</span>
                  </div>

                  {/* Wars won (Gold) */}
                  <div className="glass-card-gold rounded-xl p-4.5 shadow-2xl flex flex-col justify-between card-3d-gold relative overflow-hidden group">
                    <div className="absolute top-2 right-2 opacity-15 group-hover:opacity-40 transition">
                      <Trophy className="h-10 w-10 text-amber-500" />
                    </div>
                    <span className="block font-mono text-[9px] uppercase tracking-wider text-amber-400 font-bold">Wars Won</span>
                    <span className="font-sans text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-zinc-50 to-amber-200 mt-2.5">{totalWarWins} Wins</span>
                  </div>

                  {/* Active win streak (Green) */}
                  <div className="glass-card-green rounded-xl p-4.5 shadow-2xl flex flex-col justify-between card-3d relative overflow-hidden group">
                    <div className="absolute top-2 right-2 opacity-15 group-hover:opacity-40 transition">
                      <Flame className="h-10 w-10 text-green-500" />
                    </div>
                    <span className="block font-mono text-[9px] uppercase tracking-wider text-green-400 font-bold">Active Streak</span>
                    <span className="font-sans text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-zinc-50 to-green-200 mt-2.5">{currentStreak} Wins 🔥</span>
                  </div>

                  {/* Reg Counter (Purple) */}
                  <div className="glass-card-purple rounded-xl p-4.5 shadow-2xl flex flex-col justify-between card-3d relative overflow-hidden group">
                    <div className="absolute top-2 right-2 opacity-15 group-hover:opacity-40 transition">
                      <Users className="h-10 w-10 text-purple-500" />
                    </div>
                    <span className="block font-mono text-[9px] uppercase tracking-wider text-purple-400 font-bold">Sovereigns</span>
                    <span className="font-sans text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-zinc-50 to-purple-200 mt-2.5">{activeMembersCount} Veterans</span>
                  </div>

                  {/* CWL Standing (Cyan) */}
                  <div className="glass-card-cyan rounded-xl p-4.5 shadow-2xl flex flex-col justify-between card-3d relative overflow-hidden group">
                    <div className="absolute top-2 right-2 opacity-15 group-hover:opacity-40 transition">
                      <Award className="h-10 w-10 text-cyan-500" />
                    </div>
                    <span className="block font-mono text-[9px] uppercase tracking-wider text-cyan-400 font-bold">CWL Rank</span>
                    <span className="font-sans text-xs font-black text-transparent bg-clip-text bg-gradient-to-r from-zinc-55 to-cyan-200 mt-2.5 truncate" title={cwlLeagueName}>{cwlLeagueName}</span>
                  </div>

                  {/* Capital Hall (Bronze) */}
                  <div className="glass-card-bronze rounded-xl p-4.5 shadow-2xl flex flex-col justify-between card-3d relative overflow-hidden group">
                    <div className="absolute top-2 right-2 opacity-15 group-hover:opacity-40 transition">
                      <Layers className="h-10 w-10 text-amber-600" />
                    </div>
                    <span className="block font-mono text-[9px] uppercase tracking-wider text-amber-500 font-bold">Capital Peak</span>
                    <span className="font-sans text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-zinc-50 to-amber-300 mt-2.5">Hall Lvl {capitalLevel}</span>
                  </div>
                </div>
              )}


              {/* Developer Configuration Guidance Banner */}
              {user?.email?.toLowerCase() === "waizmonazzum270@gmail.com" && (
                <div className="rounded-xl border border-dashed border-red-900/30 bg-red-950/10 p-5 shadow space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <h4 className="font-mono text-xs font-black uppercase tracking-wider text-red-400">
                      Clash of Clans Developer Gateway Configuration
                    </h4>
                  </div>
                  <p className="font-sans text-xs text-zinc-405 leading-normal">
                    To test real-time data sync, register your API Key on the{" "}
                    <a href="https://developer.clashofclans.com" target="_blank" rel="noreferrer" className="text-red-500 hover:underline font-bold">
                      Clash of Clans Developer Portal
                    </a>
                    . When prompted for an <strong>IP Address</strong>, you must enter this sandbox's exact outbound public IP address:
                  </p>
                  <div className="flex items-center space-x-2.5 mt-2">
                    <code className="bg-zinc-950 border border-zinc-900 text-red-400 font-mono text-xs px-3 py-1.5 rounded font-black select-all">
                      {outboundIp || "Querying server..."}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(outboundIp);
                        alert("IP address copied to clipboard!");
                      }}
                      className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 rounded border border-zinc-800 text-[10px] font-mono uppercase tracking-wider text-zinc-400 hover:text-zinc-200 transition"
                    >
                      Copy IP
                    </button>
                  </div>
                </div>
              )}

            </div>


                       {/* 4. Active Roster and recruitment banners */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Leaderboard system summary */}
              <div className="glass-card-standard rounded-2xl p-6 shadow-2xl md:col-span-2 space-y-4">
                <div className="flex items-center space-x-2 border-b border-zinc-900/60 pb-3">
                  <Trophy className="h-4.5 w-4.5 text-amber-500 animate-bounce" />
                  <h3 className="font-sans text-xs font-black uppercase tracking-widest text-zinc-300">
                    Leaderboard Rankings • Elite Commanders
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-[11px] text-zinc-400">
                    <thead>
                      <tr className="border-b border-zinc-900/65 text-[10px] uppercase text-zinc-500">
                        <th className="pb-3 text-zinc-400 font-black pl-2">Player Identity</th>
                        <th className="pb-3 text-zinc-400 font-black">Town Hall</th>
                        <th className="pb-3 text-right text-zinc-400 font-black">Trophies & League Status</th>
                        <th className="pb-3 text-right text-zinc-400 font-black pr-2">War Stars Registry</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900/20">
                      {liveActiveMembers.slice(0, 5).map((m, rankIndex) => {
                        const isSupreme = m.playerTag?.toUpperCase().trim() === "#PV9GPQPUC";
                        const displayRank = rankIndex + 1;

                        // Responsive league name & color badges based on actual active trophies
                        let leagueLabel = "Legends League 👑";
                        let leagueBadgeStyle = "text-yellow-400 bg-yellow-950/30 border-yellow-500/25";

                        if (m.trophies >= 5000) {
                          leagueLabel = "Legends League 👑";
                          leagueBadgeStyle = "text-yellow-400 bg-yellow-950/30 border-yellow-500/25";
                        } else if (m.trophies >= 4100) {
                          leagueLabel = "Titan I Guild 🛡️";
                          leagueBadgeStyle = "text-cyan-400 bg-cyan-950/30 border-cyan-500/25";
                        } else if (m.trophies >= 3200) {
                          leagueLabel = "Champion III ⚔️";
                          leagueBadgeStyle = "text-purple-400 bg-purple-950/30 border-purple-500/25";
                        } else {
                          leagueLabel = "Master Clan 🔱";
                          leagueBadgeStyle = "text-zinc-400 bg-zinc-900/40 border-zinc-800";
                        }

                        return (
                          <tr key={m.uid} className={`hover:bg-rose-950/10 transition-colors ${isSupreme ? "bg-amber-950/20 border-l-2 border-l-amber-400" : ""}`}>
                            <td className="py-3 pl-2 truncate font-sans text-xs font-black text-zinc-200 flex items-center space-x-3.5">
                              {/* Rank tag */}
                              {displayRank === 1 ? (
                                <span className="inline-flex h-5.5 w-5.5 rounded-full items-center justify-center text-[10px] font-extrabold bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-zinc-950 ring-1 ring-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]" title="Gold Medallist">
                                  🥇
                                </span>
                              ) : displayRank === 2 ? (
                                <span className="inline-flex h-5.5 w-5.5 rounded-full items-center justify-center text-[10px] font-extrabold bg-gradient-to-r from-zinc-300 via-slate-100 to-zinc-400 text-zinc-950 ring-1 ring-zinc-350 shadow-[0_0_8px_rgba(203,213,225,0.4)]" title="Silver Medallist">
                                  🥈
                                </span>
                              ) : displayRank === 3 ? (
                                <span className="inline-flex h-5.5 w-5.5 rounded-full items-center justify-center text-[10px] font-extrabold bg-gradient-to-r from-amber-700 via-amber-600 to-amber-850 text-white ring-1 ring-amber-700 shadow-[0_0_8px_rgba(180,83,9,0.3)]" title="Bronze Medallist">
                                  🥉
                                </span>
                              ) : (
                                <span className="inline-flex h-5 w-5 rounded-full items-center justify-center text-[9px] font-mono font-black bg-zinc-900 border border-zinc-800 text-zinc-400">
                                  {displayRank}
                                </span>
                              )}

                              {/* STYLED PROFILE AVATAR ENCLOSURE */}
                              {getPlayerAvatar(m.playerName, m.role, m.townHall)}

                              {/* Identity label info */}
                              <div className="flex flex-col">
                                {isSupreme ? (
                                  <span className="font-sans font-black text-amber-400 bg-gradient-to-r from-amber-400 via-fuchsia-400 to-amber-300 bg-clip-text text-transparent flex items-center gap-1 drop-shadow-[0_0_8px_rgba(245,158,11,0.45)] animate-pulse">
                                    👑 {m.playerName} 👑
                                  </span>
                                ) : (
                                  <span className="font-bold text-zinc-150">{m.playerName}</span>
                                )}
                                <span className="text-[9px] font-mono font-bold text-rose-500 uppercase tracking-widest">{m.role}</span>
                              </div>
                            </td>
                            <td className="py-3 text-zinc-300 font-bold">
                              <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-900 text-[10px] font-mono text-zinc-250">
                                TH {m.townHall}
                              </span>
                            </td>
                            <td className="py-3 text-right font-black text-xs">
                              <div className="flex flex-col items-end">
                                <span className={isSupreme ? "text-amber-405 font-black text-xs" : "text-amber-500 font-black text-xs"}>
                                  {m.trophies} 🏆
                                </span>
                                <span className={`inline-block text-[8px] font-mono font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${leagueBadgeStyle} mt-1 scale-90 origin-right`}>
                                  {leagueLabel}
                                </span>
                              </div>
                            </td>
                            <td className={`py-3 text-right font-bold text-xs pr-2 ${isSupreme ? "text-rose-400 font-black animate-pulse" : "text-zinc-200"}`}>
                              <span className="inline-flex items-center space-x-1 font-mono text-xs font-black">
                                <span>{m.warStars}</span>
                                <span className="text-amber-400 text-[11px] animate-pulse">★</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recruitment bento */}
              <div className="glass-card-crimson rounded-2xl p-6 shadow-2xl space-y-5 flex flex-col justify-between card-3d">
                <div>
                  <div className="flex items-center space-x-2 border-b border-rose-950/40 pb-3">
                    <Users className="h-4.5 w-4.5 text-rose-500" />
                    <h3 className="font-sans text-xs font-black uppercase tracking-widest text-zinc-300">
                      Recruitment Division
                    </h3>
                  </div>

                  <p className="text-xs text-zinc-350 leading-relaxed mt-3.5">
                    NOT HUMANS is looking for exceptional Town Hall 15+ war tacticians who are ready to push the boundaries of competitive play under our banner.
                  </p>
                </div>

                <div className="pt-4 border-t border-rose-950/40">
                  <span className="block font-mono text-[9px] uppercase tracking-wider text-rose-400 font-bold">Minimum requirements</span>
                  <p className="font-sans text-xs font-black text-zinc-200 mt-1">TH15+ • 5000+ Trophies • Active Participation</p>
                  
                  <a
                    href="https://link.clashofclans.com/en?action=OpenClanProfile&tag=%232JVQ8PUUG"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full mt-4 flex items-center justify-center space-x-2 rounded bg-gradient-to-r from-red-650 to-rose-700 py-2.5 font-mono text-[10px] font-black uppercase text-white hover:shadow-[0_0_15px_rgba(244,63,94,0.3)] transition-all transform active:translate-y-0.5 shadow-md"
                  >
                    <span>Request to Join</span>
                    <ChevronRight className="h-4 w-4 text-amber-400" />
                  </a>
                </div>
              </div>

            </div>

            {/* NEW SECTION 1: CLAN METADATA DIRECTIVES & STATS (Description & War Rules side-by-side) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* CLAN DESCRIPTION (Slate-Gold Gradient Card) */}
              <div className="rounded-2xl border border-amber-950/40 bg-gradient-to-b from-[#1c120e] to-[#0a0503] p-6 shadow-2xl relative overflow-hidden transition hover:border-amber-900/60 flex flex-col justify-between" id="clan-description-container">
                <div>
                  <div className="flex items-center justify-between border-b border-amber-950/25 pb-3.5 mb-4">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 bg-amber-950/40 rounded-xl border border-amber-800/40 text-amber-500">
                        <BookOpen className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <h3 className="font-sans text-xs font-black uppercase tracking-widest text-[#f5bf76]">
                          Clan Description & Directives
                        </h3>
                        <p className="font-mono text-[8px] text-zinc-500 uppercase tracking-wider mt-0.5">
                          Sovereign Creed for Legends Only
                        </p>
                      </div>
                    </div>

                    {(cocRole === "Leader" || cocRole === "Co-Leader") && (
                      <button
                        onClick={() => {
                          setDescDraft(clanDescription);
                          setIsEditDescOpen(true);
                        }}
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-amber-950/60 border border-amber-800/40 hover:bg-amber-900/40 text-[9px] font-mono font-black uppercase text-amber-400 transition cursor-pointer"
                        title="Edit Clan Description"
                        id="edit-description-button"
                      >
                        <Edit className="h-3 w-3" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>

                  {isEditDescOpen ? (
                    <div className="space-y-3 py-1">
                      <textarea
                        value={descDraft}
                        onChange={(e) => setDescDraft(e.target.value)}
                        className="w-full h-44 bg-zinc-950 border border-amber-900/50 text-amber-100 font-mono text-xs rounded-xl p-3 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition leading-relaxed resize-none"
                      />
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => setIsEditDescOpen(false)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-900 text-zinc-400 font-mono text-[10px] uppercase font-bold hover:bg-zinc-850 transition"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveMetadata("desc", descDraft)}
                          disabled={savingMetadata}
                          className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 font-mono text-[10px] font-black uppercase text-zinc-950 hover:shadow-[0_0_12px_rgba(245,158,11,0.3)] transition"
                          id="btn-save-desc"
                        >
                          {savingMetadata ? "Saving..." : "Save Code"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Premium Expanded Text Block */}
                      <p className="font-sans text-xs text-zinc-400 leading-relaxed italic border-l-2 border-amber-900/40 pl-3">
                        "Loyalty above all. We fight with intellect and coordinate as one sovereign entity. Victory is a choice."
                      </p>

                      {/* Expandable/collapsible content wrapper */}
                      <div className="relative rounded-xl bg-zinc-950/60 border border-zinc-900 p-4">
                        <div className={`space-y-2.5 font-sans text-xs leading-normal select-none ${isDescExpanded ? "" : "max-h-24 overflow-hidden"}`}>
                          {clanDescription.split("\n").map((line, idx) => (
                            <div key={idx} className="flex items-start space-x-2 text-zinc-300">
                              <span className="text-amber-500 flex-shrink-0 mt-0.5 select-none">•</span>
                              <span className="font-semibold text-zinc-200">{line}</span>
                            </div>
                          ))}
                        </div>
                        
                        {!isDescExpanded && (
                          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-zinc-950/95 via-zinc-950/50 to-transparent pointer-events-none rounded-b-xl" />
                        )}
                      </div>

                      <div className="flex justify-center pt-2">
                        <button
                          onClick={() => setIsDescExpanded(!isDescExpanded)}
                          className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-950/45 to-zinc-900 border border-amber-900/25 hover:border-amber-600/30 text-[9.5px] font-mono font-black uppercase text-amber-500 transition shadow cursor-pointer"
                          id="toggle-desc-view"
                        >
                          {isDescExpanded ? (
                            <>
                              <span>Collapse Description</span>
                              <ChevronUp className="h-3.5 w-3.5" />
                            </>
                          ) : (
                            <>
                              <span>Read Full Description</span>
                              <ChevronDown className="h-3.5 w-3.5" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>


              {/* CLAN WAR RULES (Obsidian-Crimson Gradient Card - Editable) */}
              <div className="rounded-2xl border border-red-950/45 bg-gradient-to-b from-[#1b0d0f] to-[#0a0304] p-6 shadow-2xl relative overflow-hidden transition hover:border-red-900/60 flex flex-col justify-between" id="clan-war-rules-container">
                <div>
                  <div className="flex items-center justify-between border-b border-red-950/25 pb-3.5 mb-4">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 bg-red-950/40 rounded-xl border border-red-800/40 text-rose-500">
                        <ShieldCheck className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <h3 className="font-sans text-xs font-black uppercase tracking-widest text-[#f43f5e]">
                          Clan War Rules & Codex
                        </h3>
                        <p className="font-mono text-[8px] text-zinc-500 uppercase tracking-wider mt-0.5">
                          Enforcible by Leaders & Generals
                        </p>
                      </div>
                    </div>

                    {(cocRole === "Leader" || cocRole === "Co-Leader") && (
                      <button
                        onClick={() => {
                          setRulesDraft(clanWarRules);
                          setIsEditRulesOpen(true);
                        }}
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-800/40 hover:bg-red-900/40 text-[9px] font-mono font-black uppercase text-red-400 transition cursor-pointer"
                        title="Edit War Rules"
                        id="edit-rules-button"
                      >
                        <Edit className="h-3 w-3" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>

                  {isEditRulesOpen ? (
                    <div className="space-y-3 py-1">
                      <textarea
                        value={rulesDraft}
                        onChange={(e) => setRulesDraft(e.target.value)}
                        className="w-full h-44 bg-zinc-950 border border-red-900/50 text-rose-100 font-mono text-xs rounded-xl p-3 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition leading-relaxed resize-none"
                      />
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => setIsEditRulesOpen(false)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-900 text-zinc-400 font-mono text-[10px] uppercase font-bold hover:bg-zinc-850 transition"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveMetadata("rules", rulesDraft)}
                          disabled={savingMetadata}
                          className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-red-650 to-rose-750 font-mono text-[10px] font-black uppercase text-white hover:shadow-[0_0_12px_rgba(244,63,94,0.3)] transition"
                          id="btn-save-rules"
                        >
                          {savingMetadata ? "Saving..." : "Save Codex"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Premium Rules Display Box */}
                      <div className="rounded-xl bg-zinc-950/70 border border-zinc-900/80 p-4 space-y-3 h-[180px] overflow-y-auto scrollbar-thin">
                        {clanWarRules.split("\n").map((line, idx) => {
                          if (!line.trim()) return null;
                          const isHeaderLine = line.startsWith("⚔️") || line.toUpperCase() === line;
                          return (
                            <div key={idx} className={`text-xs ${isHeaderLine ? "font-mono font-black text-rose-400 border-b border-rose-950/ 30 pb-1.5 text-[10px] uppercase tracking-wider flex items-center space-x-1.5 mb-1 mt-0.5" : "text-zinc-300 font-sans leading-relaxed flex items-start space-x-2"}`}>
                              {!isHeaderLine && <span className="h-1.5 w-1.5 rounded-full bg-rose-500 mt-1.5 flex-shrink-0" />}
                              <span className={isHeaderLine ? "" : "text-zinc-200"}>{line}</span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500 uppercase tracking-widest pt-2">
                        <span>Status: Fully Armed</span>
                        <span className="text-rose-500 animate-pulse">● STRICTLY ENFORCED</span>
                      </div>
                    </div>
                  )}

                </div>
              </div>

            </div>

            {/* NEW SECTION 2: MEET OUR CLAN CO-LEADERS (Count badge, gorgeous card rows) */}
            <div className="rounded-2xl border border-zinc-900 bg-zinc-950/45 p-6 shadow-2xl relative overflow-hidden" id="meet-co-leaders-container">
              <div className="absolute top-0 right-0 h-40 w-40 bg-rose-950/10 rounded-full filter blur-2xl pointer-events-none" />
              
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-zinc-900 pb-4 mb-6 gap-3">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-rose-950/30 border border-rose-900/30 text-rose-500 rounded-2xl">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-sans text-sm font-black uppercase tracking-widest text-zinc-100 flex items-center gap-2">
                      Meet Our Clan Co-Leaders
                    </h3>
                    <p className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest mt-0.5">
                      Elite Tactical Officers of NOT HUMANS
                    </p>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <span className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-rose-950/40 border border-rose-900/40 text-rose-400 font-mono text-[10px] font-black uppercase tracking-wider">
                    <span>Active Co-Leaders:</span>
                    <span className="text-zinc-100 bg-[#fb2c4a] rounded-md px-1.5 py-0.5 animate-pulse">
                      {liveActiveMembers.filter(m => m.role === "Co-Leader").length}
                    </span>
                  </span>
                </div>
              </div>

              {/* Grid / card rows layout */}
              {liveActiveMembers.filter(m => m.role === "Co-Leader").length === 0 ? (
                <div className="text-center py-12 text-zinc-500 font-mono text-xs">
                  <span>No active Co-Leaders synced on database matrix yet. Run Force Sync to catalog! 🛡️</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {liveActiveMembers.filter(m => m.role === "Co-Leader").map((co, index) => {
                    // Let's create beautiful combat titles dynamically based on specialties or index
                    const specialties = [
                      "QC Hybrid Specialist ⚡",
                      "Lavaloon Overseer 🎈",
                      "Root Rider Vanguard 🪵",
                      "Sarch Hydra Tactician 🐉",
                      "Super Bowler Maestro 🔮",
                      "Golem Witch Juggernaut 🛡️"
                    ];
                    const selectedSpecialty = co.specialty || specialties[index % specialties.length];

                    return (
                      <div
                        key={co.uid}
                        className="rounded-xl border border-[#2c1214] bg-gradient-to-b from-[#140809] to-[#0a0304] p-4.5 flex flex-col justify-between hover:border-rose-900/55 hover:shadow-[0_0_15px_rgba(244,63,94,0.1)] transition duration-300 relative group overflow-hidden border-l-2 border-l-amber-500"
                        id={`co-leader-card-${co.uid}`}
                      >
                        <div className="absolute top-0 right-0 h-16 w-16 bg-amber-500/5 rounded-bl-full transform translate-x-3 -translate-y-3 group-hover:bg-amber-500/10 transition" />
                        
                        <div className="space-y-4">
                          {/* Card Top: Profile Photo & Name */}
                          <div className="flex items-center space-x-3 border-b border-zinc-900 pb-3">
                            {getPlayerAvatar(co.playerName, co.role, co.townHall)}
                            <div className="overflow-hidden">
                              <h4 className="font-bold text-xs text-zinc-200 truncate pr-2" title={co.playerName}>
                                {co.playerName}
                              </h4>
                              <span className="text-[8.5px] font-mono text-amber-500 uppercase tracking-widest font-black">
                                Co-Leader
                              </span>
                            </div>
                          </div>

                          {/* Card Middle: Combat Stats */}
                          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                            <div className="bg-zinc-950/70 border border-zinc-900/60 p-2 rounded">
                              <span className="block text-[8px] text-zinc-500 uppercase">Town Hall</span>
                              <span className="font-bold text-zinc-200">Level {co.townHall}</span>
                            </div>
                            <div className="bg-zinc-950/70 border border-zinc-900/60 p-2 rounded">
                              <span className="block text-[8px] text-zinc-500 uppercase">Trophies</span>
                              <span className="font-bold text-amber-500">{co.trophies} 🏆</span>
                            </div>
                          </div>
                        </div>

                        {/* Card Bottom: Combat specialty & Stars */}
                        <div className="mt-4 pt-3 border-t border-zinc-900 space-y-2">
                          <div className="flex items-center justify-between text-[9px] font-mono">
                            <span className="text-zinc-500 uppercase">War Registry</span>
                            <span className="font-black text-rose-450">{co.warStars || 500} ★</span>
                          </div>
                          
                          <div className="text-[9px] bg-red-950/15 border border-red-950/20 px-2 py-1 rounded text-red-300 font-mono text-center truncate select-none font-bold">
                            {selectedSpecialty}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

            </div>

          </div>
        )}

        {/* Modular routing tabs */}
        {activeTab === "war" && user && isRegistered && (
          <WarRoomSection
            userUid={user.uid}
            userEmail={user.email || ""}
            userName={member?.playerName || user.displayName || "Warrior"}
            cocRole={cocRole}
            playerTag={member?.playerTag || ""}
            allMembers={allMembers}
            onInspectPlayer={(tag) => {
              setSelectedPlayer({ tag });
              setIsInspectOpen(true);
            }}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            unreadCounts={computedChatUnreads}
            activeRoomGlobal={currentOpenedChannel}
            onChangeRoom={(roomId) => setCurrentOpenedChannel(roomId)}
          />
        )}

        {activeTab === "cwl" && user && isRegistered && (
          <CwlSection
            userUid={user.uid}
            userName={user.displayName || "Commander"}
            cocRole={cocRole}
            members={allMembers}
          />
        )}

        {activeTab === "announcements" && (
          <AnnouncementSection
            userUid={user?.uid || null}
            userName={user?.displayName || "Leader"}
            cocRole={cocRole}
          />
        )}

        {activeTab === "strategies" && user && isRegistered && (
          <StrategySection
            userUid={user.uid}
            userName={user.displayName || "Guide Creator"}
            cocRole={cocRole}
          />
        )}

        {activeTab === "bases" && user && isRegistered && (
          <BasesSection
            userUid={user.uid}
            userName={member?.playerName || user.displayName || "Base Tactician"}
            userEmail={user.email}
            cocRole={cocRole}
          />
        )}

        {activeTab === "giveaway" && user && isRegistered && (
          <GiveawaySection
            userUid={user.uid}
            userName={user.displayName || "Raffle User"}
            cocRole={cocRole}
            members={allMembers}
          />
        )}

        {activeTab === "history" && (
          <HistorySection
            cocRole={cocRole}
          />
        )}

        {activeTab === "legends" && (
          <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-rose-950/30 pb-5">
              <div className="flex items-center space-x-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-950/50 border border-amber-800/50 text-amber-500 shadow-xl shadow-amber-950/40 animate-pulse">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="font-sans text-xl font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 via-zinc-200 to-amber-200">
                    Sovereign Clan Command Centre
                  </h2>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-0.5">
                    Live Active Combatants & Retrospect Veterans of NOT HUMANS
                  </p>
                </div>
              </div>

              {/* Sub-tab Switches and Synchronization Controls */}
              <div className="flex flex-wrap items-center gap-3 bg-zinc-950/40 p-2.5 rounded-2xl border border-zinc-900/60 shadow-lg select-none">
                {/* Last Synced Status Stamp */}
                <div className="text-right font-mono text-[9px] uppercase tracking-wider text-zinc-500 mr-1 px-3 py-1 rounded bg-zinc-950/60 border border-zinc-900/40 flex flex-col justify-center">
                  <span className="text-zinc-500 scale-90 origin-right">Database Sync</span>
                  <span className="text-amber-500 font-extrabold font-sans">
                    {lastSyncedTime ? `Synced: ${getSyncStatusMessage()}` : "Not Synced"}
                  </span>
                </div>

                {/* Secure Golden Trigger Button for Leader/Co-Leader */}
                {(cocRole === "Leader" || cocRole === "Co-Leader") && (
                  <button
                    onClick={handleForceSync}
                    disabled={isSyncing}
                    className="flex items-center justify-center space-x-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-zinc-800 disabled:to-zinc-900 px-3 py-2 font-mono text-[10px] font-black uppercase text-zinc-950 hover:shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all transform active:translate-y-0.5 shadow border border-amber-400/30 select-none cursor-pointer"
                    title="Force Synchronize Clan Roster & Stats"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${(isSyncing || isSyncing) ? "animate-spin" : ""}`} />
                    <span>{isSyncing ? "Syncing..." : "Force Sync"}</span>
                  </button>
                )}

                {/* Sub-tab Switchers */}
                <div className="flex items-center space-x-1 border-l border-zinc-900/80 pl-3">
                  <button
                    onClick={() => setRosterSubTab("live")}
                    className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider font-bold rounded-lg transition-all ${
                      rosterSubTab === "live"
                        ? "bg-amber-500 text-zinc-950 border border-amber-450 font-extrabold shadow"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                    id="tab-sub-live"
                  >
                    Live Guild Roster ({clanStats?.memberList?.length || 50})
                  </button>
                  <button
                    onClick={() => setRosterSubTab("past")}
                    className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider font-bold rounded-lg transition-all ${
                      rosterSubTab === "past"
                        ? "bg-red-800 text-white border border-red-755 font-extrabold shadow"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                    id="tab-sub-past"
                  >
                    Departed Legends ({allMembers.filter(m => m.status === "Former Member").length})
                  </button>
                </div>
              </div>
            </div>

            {/* LIVE ACTIVE CHANNELS VIEW */}
            {rosterSubTab === "live" ? (
              <div className="space-y-4">
                {/* Search active members controller block */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-950/40 border border-zinc-900/60 p-4 rounded-2xl backdrop-blur">
                  <div className="font-mono text-xs text-zinc-400">
                    🚀 Currently scanning live battle levels in-game. Click on any squad member to inspect their full live stats and heroes.
                  </div>
                </div>

                {clanLoading || !clanStats?.memberList ? (
                  <div className="flex flex-col items-center justify-center py-24 text-zinc-500 font-mono text-xs">
                    <div className="h-6 w-6 animate-spin rounded-full border border-red-500 border-t-transparent mb-3" />
                    <span>Deploying visual tracking scanners...</span>
                  </div>
                ) : (
                  <div className="glass-card-standard rounded-2xl overflow-hidden border border-zinc-900/80 shadow-2xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-mono text-xs">
                        <thead>
                          <tr className="border-b border-zinc-900/60 bg-zinc-900/40 text-zinc-500 text-[10px] uppercase tracking-widest font-black">
                            <th className="py-4 px-4 text-center">Rank</th>
                            <th className="py-4 px-4">Commander</th>
                            <th className="py-4 px-4 text-center">Hall Level</th>
                            <th className="py-4 px-4">In-game Role</th>
                            <th className="py-4 px-4">League Badge</th>
                            <th className="py-4 px-4 text-right">Trophies</th>
                            <th className="py-4 px-4 text-right">Builder XP</th>
                            <th className="py-4 px-4 text-right">Donations</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900/30">
                          {clanStats.memberList.map((m: any, rankIdx: number) => {
                            const isSupreme = m.tag?.toUpperCase().trim() === "#PV9GPQPUC";
                            const isKing = m.role?.toLowerCase() === "leader";
                            const isGeneral = m.role?.toLowerCase() === "coleader";
                            const isElder = m.role?.toLowerCase() === "admin";
                            
                            // Role Badge styles
                            let roleColor = "text-zinc-500 bg-zinc-950/40 border border-zinc-900";
                            let roleLabel = "Warrior";
                            if (isSupreme) {
                              roleColor = "text-amber-300 bg-gradient-to-r from-purple-950/60 via-amber-950/40 to-purple-950/60 border border-amber-400 font-extrabold shadow-[0_0_10px_rgba(245,158,11,0.5)] animate-pulse";
                              roleLabel = "👑 Supreme Leader";
                            } else if (isKing) {
                              roleColor = "text-red-400 bg-red-950/40 border border-red-800/40 font-black";
                              roleLabel = "Leader";
                            } else if (isGeneral) {
                              roleColor = "text-amber-400 bg-amber-950/40 border border-amber-900/40 font-black";
                              roleLabel = "Co-Leader";
                            } else if (isElder) {
                              roleColor = "text-cyan-400 bg-cyan-950/40 border border-cyan-900/40 font-black";
                              roleLabel = "Elder";
                            }

                            // High-res league badge icon
                            const badgeIcon = m.leagueTier?.iconUrls?.small || m.league?.iconUrls?.small || "https://api-assets.clashofclans.com/leagues/72/e--YMyIexEQQhE4imLoJcwhYn6Uy8KqlgyY3_kFV6t4.png";

                            // Search for corresponding registered user from reactive Firestore cached copy
                            const matchedDb = allMembers.find(f => f.playerTag?.toUpperCase().trim() === m.tag?.toUpperCase().trim());
                            const isRegistered = isSupreme || !!(matchedDb && matchedDb.isRegisteredUser);

                            const rankNum = m.clanRank || (rankIdx + 1);

                            return (
                              <tr 
                                key={m.tag} 
                                onClick={() => {
                                  setSelectedPlayer(m);
                                  setIsInspectOpen(true);
                                }}
                                className={`cursor-pointer transition-all card-3d border-b border-zinc-900/40 ${
                                  isSupreme
                                    ? "bg-gradient-to-r from-emerald-950/20 via-amber-900/10 to-transparent hover:from-emerald-950/25 hover:via-amber-900/15 border-l-[4px] border-l-amber-400 font-extrabold shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/25"
                                    : isRegistered
                                      ? "bg-emerald-950/10 border-l-[3px] border-l-emerald-500 hover:bg-emerald-950/20 text-emerald-50 font-black"
                                      : "bg-red-950/5 border-l-[3px] border-l-red-650/30 hover:bg-red-950/15 text-zinc-350"
                                }`}
                              >
                                {/* Rank badge */}
                                <td className="py-4 px-4 text-center">
                                  {matchedDb?.photoUrl ? (
                                    <div className="relative inline-block">
                                      <img
                                        src={matchedDb.photoUrl}
                                        alt={`${m.name} custom avatar`}
                                        className="h-7 w-7 rounded-full object-cover ring-2 ring-emerald-500 border border-zinc-900 shadow-lg"
                                        referrerPolicy="no-referrer"
                                      />
                                      <span className="absolute -bottom-1 -right-1 bg-zinc-950 text-emerald-400 border border-zinc-800 rounded px-0.5 text-[7px] font-mono font-bold leading-none scale-75 shadow">
                                        {rankNum}
                                      </span>
                                    </div>
                                  ) : rankNum === 1 ? (
                                    <span className="inline-flex h-7 w-7 rounded-full items-center justify-center text-[10px] font-extrabold bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-zinc-950 ring-2 ring-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.6)]" title="Gold Star Rank 1">
                                      🥇
                                    </span>
                                  ) : rankNum === 2 ? (
                                    <span className="inline-flex h-7 w-7 rounded-full items-center justify-center text-[10px] font-extrabold bg-gradient-to-r from-zinc-300 via-slate-100 to-zinc-400 text-zinc-950 ring-2 ring-zinc-300 shadow-[0_0_12px_rgba(203,213,225,0.5)]" title="Silver Star Rank 2">
                                      🥈
                                    </span>
                                  ) : rankNum === 3 ? (
                                    <span className="inline-flex h-7 w-7 rounded-full items-center justify-center text-[10px] font-extrabold bg-gradient-to-r from-amber-700 via-amber-600 to-amber-850 text-white ring-2 ring-amber-700 shadow-[0_0_12px_rgba(180,83,9,0.4)]" title="Bronze Star Rank 3">
                                      🥉
                                    </span>
                                  ) : (
                                    <span className="inline-flex h-6 w-6 rounded-full items-center justify-center text-[10px] font-bold bg-zinc-900 border border-zinc-800 text-zinc-500 font-mono">
                                      {rankNum}
                                    </span>
                                  )}
                                </td>

                                {/* Name block */}
                                <td className="py-4 px-4">
                                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                    {isSupreme ? (
                                      <div className="font-sans font-black text-amber-400 bg-gradient-to-r from-amber-400 via-fuchsia-400 to-amber-300 bg-clip-text text-transparent text-sm whitespace-nowrap uppercase tracking-wider flex items-center gap-1">
                                        <span>⚜️ {m.name} ⚜️</span>
                                      </div>
                                    ) : (
                                      <div className={`font-sans font-black text-sm whitespace-nowrap uppercase tracking-wide transition-colors group-hover:text-amber-400 ${isRegistered ? "text-emerald-300 font-extrabold" : "text-zinc-200"}`}>
                                        {m.name}
                                      </div>
                                    )}
                                    {isRegistered ? (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 drop-shadow-[0_0_4px_rgba(16,185,129,0.3)] animate-pulse">
                                        ● Verified
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-red-950/60 border border-red-900/30 text-red-500/60">
                                        ● Guest
                                      </span>
                                    )}
                                  </div>
                                  <div className={`text-[9px] font-mono tracking-wider mt-0.5 ${isSupreme ? "text-amber-500/85" : isRegistered ? "text-emerald-600/80 font-semibold" : "text-zinc-650"}`}>
                                    {m.tag}
                                  </div>
                                </td>

                                {/* Town hall representation */}
                                <td className="py-4 px-4 text-center font-sans">
                                  <span className="inline-block px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg bg-cyan-950/40 border border-cyan-800/30 text-cyan-400">
                                    TH {m.townHallLevel || 15}
                                  </span>
                                </td>

                                {/* Role Badge */}
                                <td className="py-4 px-4">
                                  <span className={`inline-block px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest rounded-md ${roleColor}`}>
                                    {roleLabel}
                                  </span>
                                </td>

                                {/* League Badge with Icon */}
                                <td className="py-4 px-4 whitespace-nowrap">
                                  <div className="flex items-center space-x-2.5">
                                    <img 
                                      src={badgeIcon} 
                                      alt={m.leagueTier?.name || "League Badge"} 
                                      className="h-7 w-7 object-contain drop-shadow-[0_0_4px_rgba(251,191,36,0.2)]"
                                      referrerPolicy="no-referrer"
                                    />
                                    <span className="text-[10px] text-zinc-300 font-bold max-w-[120px] truncate block">
                                      {m.leagueTier?.name || m.league?.name || "Unranked"}
                                    </span>
                                  </div>
                                </td>

                                {/* Trophies */}
                                <td className="py-4 px-4 text-right font-black text-amber-400 font-sans text-xs">
                                  {m.trophies || 0} 🏆
                                </td>

                                {/* Builder Base */}
                                <td className="py-4 px-4 text-right font-black text-purple-400 font-sans text-xs">
                                  {m.builderBaseTrophies || 0} 🔧
                                </td>

                                {/* Donations Contribution */}
                                <td className="py-4 px-4 text-right">
                                  <div className="text-[11px] font-bold text-green-400 font-sans">
                                    ▲ {m.donations || 0}
                                  </div>
                                  <div className="text-[9px] text-zinc-650 font-sans mt-0.5">
                                    ▼ {m.donationsReceived || 0}
                                  </div>
                                </td>

                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* DEPARTED LEGENDS VETERANS ARCHIVE TABLE */
              <div className="space-y-6">
                <div className="bg-zinc-950/40 border border-zinc-900/60 p-4 rounded-xl font-mono text-xs text-zinc-500 leading-relaxed flex items-center space-x-2.5 shadow-md">
                  <span className="text-red-500">🛡️</span>
                  <span>Tracked veterans who previously served in NOT HUMANS. If a veteran rejoins, the system detects their official server tag and restores them to active rank automatically.</span>
                </div>

                {allMembers.filter(m => m.status === "Former Member").length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-20 glass-card-standard rounded-2xl text-zinc-600 font-mono text-[10px] uppercase">
                    No veterans are retired in archives. Clean slate.
                  </div>
                ) : (
                  <div className="glass-card-standard rounded-2xl overflow-hidden border border-zinc-900/80 shadow-2xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-mono text-xs">
                        <thead>
                          <tr className="border-b border-zinc-900/60 bg-zinc-900/40 text-zinc-500 text-[10px] uppercase tracking-widest font-black">
                            <th className="py-4 px-4 text-center">No.</th>
                            <th className="py-4 px-4">Veteran Commander</th>
                            <th className="py-4 px-4 text-center">Last Hall</th>
                            <th className="py-4 px-4">Former Clan Role</th>
                            <th className="py-4 px-4 text-right">Archived Trophies</th>
                            <th className="py-4 px-4 text-right">War Stars Record</th>
                            <th className="py-4 px-4 text-right">Left Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900/30">
                          {allMembers
                            .filter(m => m.status === "Former Member")
                            .map((m, rankIdx) => {
                              const prevRole = m.previousRole || "Member";
                              const isKing = prevRole.toLowerCase() === "leader";
                              const isGeneral = prevRole.toLowerCase() === "coleader" || prevRole.toLowerCase() === "co-leader";
                              const isElder = prevRole.toLowerCase() === "admin" || prevRole.toLowerCase() === "elder";

                              // Role Badge styles
                              let roleColor = "text-zinc-500 bg-zinc-950/40 border border-zinc-900";
                              let roleLabel = "Warrior";
                              if (isKing) {
                                roleColor = "text-red-400 bg-red-950/40 border border-red-800/40 font-black";
                                roleLabel = "Leader";
                              } else if (isGeneral) {
                                roleColor = "text-amber-400 bg-amber-950/40 border border-amber-900/40 font-black";
                                roleLabel = "Co-Leader";
                              } else if (isElder) {
                                roleColor = "text-cyan-400 bg-cyan-950/40 border border-cyan-900/40 font-black";
                                roleLabel = "Elder";
                              }

                              const formattedDate = m.updatedAt 
                                ? new Date(m.updatedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                                : "Archived";

                              return (
                                <tr
                                  key={m.uid}
                                  onClick={() => {
                                    setSelectedPlayer({
                                      tag: m.playerTag,
                                      name: m.playerName,
                                      role: "Former Member",
                                      previousRole: m.previousRole || "Member",
                                      townHallLevel: m.townHall,
                                      trophies: m.trophies,
                                      builderBaseTrophies: m.trackerBB || 2200,
                                      warStars: m.warStars || 0,
                                      donations: 0,
                                      donationsReceived: 0,
                                    });
                                    setIsInspectOpen(true);
                                  }}
                                  className="hover:bg-zinc-900/60 active:bg-zinc-900/80 border-b border-zinc-900/40 cursor-pointer transition-all card-3d group"
                                >
                                  {/* No. badge */}
                                  <td className="py-4 px-4 text-center">
                                    {m.photoUrl ? (
                                      <div className="relative inline-block">
                                        <img
                                          src={m.photoUrl}
                                          alt={`${m.playerName} custom avatar`}
                                          className="h-7 w-7 rounded-full object-cover ring-2 ring-red-800 border border-zinc-900 shadow-lg"
                                          referrerPolicy="no-referrer"
                                        />
                                        <span className="absolute -bottom-1 -right-1 bg-zinc-950 text-red-400 border border-zinc-800 rounded px-0.5 text-[7px] font-mono font-bold leading-none scale-75 shadow">
                                          {rankIdx + 1}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="inline-block h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-zinc-900/80 text-zinc-500 border border-zinc-800/50">
                                        {rankIdx + 1}
                                      </span>
                                    )}
                                  </td>

                                  {/* Name block */}
                                  <td className="py-4 px-4">
                                    <div className="font-sans font-black text-rose-450 text-sm whitespace-nowrap uppercase tracking-wide group-hover:text-amber-400 transition animate-fade-in">
                                      {m.playerName || m.playerTag}
                                    </div>
                                    <div className="text-[9px] text-zinc-600 font-mono tracking-wider mt-0.5">
                                      {m.playerTag}
                                    </div>
                                  </td>

                                  {/* Town hall level */}
                                  <td className="py-4 px-4 text-center font-sans">
                                    <span className="inline-block px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg bg-cyan-950/40 border border-cyan-800/30 text-cyan-400">
                                      TH {m.townHall || 15}
                                    </span>
                                  </td>

                                  {/* Previous Role Badge */}
                                  <td className="py-4 px-4">
                                    <span className={`inline-block px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest rounded-md ${roleColor}`}>
                                      {roleLabel}
                                    </span>
                                  </td>

                                  {/* Archived Trophies */}
                                  <td className="py-4 px-4 text-right font-black text-amber-500/80 font-sans text-xs">
                                    {m.trophies || 0} 🏆
                                  </td>

                                  {/* War Stars Record from Firestore */}
                                  <td className="py-4 px-4 text-right font-black text-red-400 font-sans text-xs">
                                    {m.warStars || 0} ⚔️
                                  </td>

                                  {/* Left Date / Archived Date */}
                                  <td className="py-4 px-4 text-right text-zinc-500 font-mono text-[10px]">
                                    {formattedDate}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </main>

      </div>

      {/* 5. Clash of Clans API Player Tag Verification Modal pop */}
      {showTagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/95 backdrop-blur-sm">
          <div className="max-w-md w-full rounded-xl border border-red-950/50 bg-zinc-950 p-6 shadow-2xl relative space-y-4">
            
            <div className="absolute top-0 right-0 p-3">
              <ShieldAlert className="h-5 w-5 text-red-500" />
            </div>

            <div>
              <h2 className="font-sans text-lg font-black uppercase tracking-wider text-zinc-100">
                VERIFY COG COMMANDER
              </h2>
              <p className="font-sans text-xs text-zinc-400 mt-1 leading-normal">
                To access secure War Rooms, CWL planners, and battle strategies, enter your official Clash of Clans player identity tag matching the NOT HUMANS clan (#2JVQ8PUUG).
              </p>
            </div>

            <form onSubmit={handleVerifyTag} className="space-y-4 pt-2">
              <div>
                <label className="block font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                  Enter Player Tag
                </label>
                <input
                  type="text"
                  placeholder="E.g., #PV9GPQPUC"
                  required
                  value={inputTag}
                  onChange={(e) => setInputTag(e.target.value)}
                  className="w-full rounded border border-zinc-900 bg-zinc-900/60 p-2.5 font-mono text-sm text-zinc-100 placeholder-zinc-700 outline-none focus:border-red-600"
                  id="modal-tag-input"
                />
              </div>

              {/* Secure Token Instructions */}
              <div className="rounded bg-zinc-950/80 border border-zinc-900 p-3 space-y-1 text-[10px] leading-normal font-sans text-zinc-400 text-center">
                <p className="font-bold text-red-400 font-mono text-[9px] uppercase tracking-wide">🛡️ CLAN MEMBERS ONLY SECURITY 🛡️</p>
                <p className="text-zinc-500">Only verified active players of our NOT HUMANS esports roster can register. Each player tag can only be mapped to a single user account.</p>
              </div>

              <div className="flex items-center space-x-2.5">
                <button
                  type="submit"
                  disabled={registering}
                  className="flex-1 flex items-center justify-center space-x-2 rounded bg-gradient-to-r from-red-700 to-rose-700 hover:from-red-600 hover:to-rose-600 py-3 font-mono text-xs font-black uppercase text-white shadow transition-all cursor-pointer"
                  id="modal-verify-submit"
                >
                  {registering ? (
                    <span>Verifying tag...</span>
                  ) : (
                    <span>Register Player Tag</span>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => setShowTagModal(false)}
                  className="rounded bg-zinc-900 w-24 py-3 border border-zinc-850 font-mono text-xs uppercase text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sliding Profile Drawer Panel */}
      <AnimatePresence>
        {pendingPasscodeRegistration && (
          <motion.div 
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="max-w-md w-full bg-zinc-950 border-2 border-amber-500 shadow-[0_0_40px_rgba(245,158,11,0.2)] rounded-2xl overflow-hidden p-6 relative">
              <div className="text-center space-y-3 mb-6">
                <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto animate-pulse" />
                <h3 className="font-sans text-xl font-black uppercase tracking-widest text-amber-500">
                  SECURITY PASSCODE VERIFICATION
                </h3>
                <p className="text-xs font-mono text-zinc-400">
                  Comrade, this tag has elite permissions. Enter the official NOT HUMANS clan passcode to authorize registration:
                </p>
              </div>

              <form onSubmit={submitPasscode} className="space-y-4">
                <input
                  type="password"
                  placeholder="Enter Secret Passcode"
                  value={passcodeInput}
                  onChange={e => setPasscodeInput(e.target.value)}
                  className="w-full bg-black border border-amber-900 focus:border-amber-500 rounded-lg p-3 text-center text-amber-500 font-mono text-lg tracking-widest outline-none transition-all placeholder:text-zinc-700"
                  autoFocus
                />
                
                <div className="flex items-center space-x-3 pt-2">
                  <button
                    type="submit"
                    disabled={registering || !passcodeInput.trim()}
                    className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-black font-black uppercase font-sans text-sm tracking-widest py-3 rounded-lg flex justify-center items-center cursor-pointer shadow-lg shadow-amber-900/30"
                  >
                    {registering ? <RefreshCw className="w-5 h-5 animate-spin" /> : "Authorize"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingPasscodeRegistration(null);
                      setPasscodeInput("");
                    }}
                    className="w-24 border border-zinc-800 hover:bg-zinc-900 text-zinc-400 uppercase font-sans font-bold text-xs py-3 rounded-lg cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}

        {isProfileDrawerOpen && isRegistered && member && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProfileDrawerOpen(false)}
              className="fixed inset-0 z-40 bg-zinc-950/80 backdrop-blur-xs cursor-pointer"
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.3, ease: "easeInOut" }}
              className="fixed inset-y-0 right-0 z-50 w-full max-w-4xl bg-zinc-950/98 border-l border-red-950/30 p-6 shadow-2xl overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-zinc-900 pb-4 mb-6">
                <div>
                  <h2 className="font-sans text-lg font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-zinc-100 to-amber-200">
                    🎖️ COMMANDER PROFILE ARCHIVE
                  </h2>
                  <p className="font-sans text-[11px] text-zinc-400 mt-1">
                    Live in-game statistics link, combat spec, heroes status & elite website clearances.
                  </p>
                </div>
                <button
                  onClick={() => setIsProfileDrawerOpen(false)}
                  className="rounded bg-zinc-900 hover:bg-zinc-850 border border-zinc-850 px-3.5 py-2 font-mono text-xs uppercase text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
                >
                  Close Panel ✕
                </button>
              </div>

              {/* MemberProfile component */}
              <MemberProfile
                member={member}
                playerData={playerData}
                onUpdateMember={(updated: Member) => {
                  setMember(updated);
                }}
                onRefresh={async () => {
                  try {
                    const res = await fetch(`/api/verify-player/${encodeURIComponent(member.playerTag)}`);
                    let updatedPlayer = null;
                    if (res.ok) {
                      const text = await res.text();
                      try {
                         const body = JSON.parse(text);
                         updatedPlayer = body.player;
                      } catch(e) {}
                    }
                    if (!updatedPlayer) {
                       const cachedData = await import("../clanData.json");
                       const clanList = cachedData.default?.memberList || cachedData.memberList || [];
                       const clanMember = clanList.find((m: any) => m.tag === member.playerTag);
                       if (clanMember) updatedPlayer = clanMember;
                    }
                    
                    if (updatedPlayer) {
                      setPlayerData(updatedPlayer);

                      // Save updated stats back to Firestore so leaderboards/roster are updated
                      if (user && user.uid) {
                        await setDoc(
                          doc(db, "members", user.uid),
                          {
                            playerName: updatedPlayer.name,
                            trophies: updatedPlayer.trophies,
                            warStars: updatedPlayer.warStars,
                            townHall: updatedPlayer.townHallLevel || member.townHall,
                            updatedAt: new Date().toISOString()
                          },
                          { merge: true }
                        );

                        // Instantly update local member state for live visual synchronization
                        setMember(prev => prev ? {
                          ...prev,
                          playerName: updatedPlayer.name,
                          trophies: updatedPlayer.trophies,
                          warStars: updatedPlayer.warStars,
                          townHall: updatedPlayer.townHallLevel || prev.townHall,
                          updatedAt: new Date().toISOString()
                        } : null);
                      }

                      alert("Command center statistics synchronized successfully, Master! 🛡️");
                    }
                  } catch (e) {
                    console.error("Manual refresh sync failed:", e);
                    alert("Database synchronization offline.");
                  }
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Player Inspect Modal pop */}
      <PlayerInspectModal
        isOpen={isInspectOpen}
        onClose={() => setIsInspectOpen(false)}
        player={selectedPlayer}
      />

      {/* Authentic 3D Floating Embers Effect overlay background */}
      {activeTab !== "chat" && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-10">
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className="coc-ember"
              style={{
                left: `${(i * 7) % 100}%`,
                animationDelay: `${i * 1.1}s`,
                animationDuration: `${12 + (i % 6) * 2}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Esports Footer credits */}
      {activeTab === "hq" && (
        <footer className="border-t border-zinc-900 py-6 mt-12 bg-zinc-950 relative z-20">
          <div className="mx-auto max-w-7xl px-4 flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-[10px] text-zinc-600 uppercase">
            <p>© 2026 NOT HUMANS ESPORTS. All clan rights reserved.</p>
            <div className="flex items-center space-x-3.5">
              <span className="text-zinc-400">#2JVQ8PUUG</span>
              <span className="text-zinc-700">|</span>
              <span>Clash of Clans Certified</span>
            </div>
          </div>
        </footer>
      )}

      {/* Dynamic Toast Notification Panel */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-[100] max-w-sm w-[340px] bg-gradient-to-br from-[#120707] via-[#210c0c] to-[#0c0303] border border-red-900/60 rounded-xl shadow-2xl p-4 flex items-start space-x-3"
          >
            <div className="flex-1">
              <span className="block font-mono text-[9px] font-black uppercase text-amber-500 tracking-widest leading-none">
                TACTICAL TRANSMISSION
              </span>
              <p className="font-sans text-xs text-zinc-200 mt-2 leading-relaxed">
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-zinc-500 hover:text-white font-mono text-[10px] font-bold cursor-pointer"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
