export type CoCRole = "Leader" | "Co-Leader" | "Elder" | "Member" | "Former Member";

export interface Hero {
  name: string;
  level: number;
  maxLevel: number;
}

export interface Member {
  uid: string;
  playerTag: string;
  playerName: string;
  role: CoCRole;
  townHall: number;
  trophies: number;
  warStars: number;
  status: "Active" | "Former Member";
  specialty?: string;
  previousRole?: string;
  isRegisteredUser?: boolean;
  joinedAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  photoUrl?: string;
}

export interface Reaction {
  emoji: string;
  users: string[]; // List of user display names or uids
}

export interface ChatMessage {
  id: string;
  text: string;
  authorUid: string;
  authorName: string;
  authorTag: string;
  authorRole: CoCRole;
  room: "global" | "war";
  imageUrl?: string;
  createdAt: any; // Firestore Timestamp
  pinned?: boolean;
  replyTo?: string; // Original message text/author summary
  reactions?: { [emoji: string]: string[] }; // Emoji -> userUids[]
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorUid: string;
  authorName: string;
  pinned: boolean;
  createdAt: any; // Firestore Timestamp
}

export interface Assignment {
  targetNo: number;
  assignedPlayerTag: string;
  assignedPlayerName: string;
  status: "pending" | "completed_3star" | "completed_2star" | "completed_1star" | "completed_0star" | "missed";
  attackNotes?: string;
  report?: string;
}

export interface CWLPlan {
  id: string; // "day_X"
  opponentName: string;
  warDay: number;
  assignments: Assignment[];
  leaderNotes?: string;
  coLeaderNotes?: string;
  updatedBy: string;
  updatedAt: any;
}

export interface Giveaway {
  id: string;
  title: string;
  prize: string;
  description: string;
  createdAt: any;
  endsAt: any;
  status: "active" | "ended";
  winnerUid?: string;
  winnerName?: string;
}

export interface StrategyGuide {
  id: string;
  title: string;
  category: "Lalo" | "Hydra" | "Dragons" | "QC Hybrid" | "Root Riders" | "Smash Attacks";
  description: string;
  images?: string; // base64 code or url
  videoUrl?: string;
  baseLink?: string;
  authorUid: string;
  authorName: string;
  createdAt: any;
}

export interface HistoryMilestone {
  id: string;
  title: string;
  type: "war" | "milestone";
  description: string;
  imageUrl?: string;
  date: string;
  createdAt: any;
}

export interface BaseLayout {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  baseLink: string;
  thLevel: number;
  rank: number;
  vaultType: "not_humans" | "public";
  authorUid: string;
  authorName: string;
  authorRole: CoCRole;
  approved: boolean;
  createdAt: any;
}

