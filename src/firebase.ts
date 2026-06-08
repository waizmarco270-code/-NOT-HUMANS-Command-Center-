import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// Dynamic configuration matching keys precisely to allow smooth override on Vercel.
// On AI Studio container workspace, platform-specific environment variables for the default test database may take precedence.
// We only allow environment variable override if we are NOT in an AI Studio preview AND the override project ID matches our local target config project ID.
const metaEnv = (import.meta as any).env || {};
const isAiStudio = typeof window !== "undefined" && (window.location.hostname.includes("run.app") || window.location.hostname.includes("aistudio"));
const useEnvOverride = !isAiStudio && metaEnv.VITE_FIREBASE_API_KEY && (metaEnv.VITE_FIREBASE_PROJECT_ID === firebaseConfig.projectId);

const finalConfig = {
  apiKey: (useEnvOverride && metaEnv.VITE_FIREBASE_API_KEY) ? metaEnv.VITE_FIREBASE_API_KEY : firebaseConfig.apiKey,
  authDomain: (useEnvOverride && metaEnv.VITE_FIREBASE_AUTH_DOMAIN) ? metaEnv.VITE_FIREBASE_AUTH_DOMAIN : firebaseConfig.authDomain,
  projectId: (useEnvOverride && metaEnv.VITE_FIREBASE_PROJECT_ID) ? metaEnv.VITE_FIREBASE_PROJECT_ID : firebaseConfig.projectId,
  storageBucket: (useEnvOverride && metaEnv.VITE_FIREBASE_STORAGE_BUCKET) ? metaEnv.VITE_FIREBASE_STORAGE_BUCKET : firebaseConfig.storageBucket,
  messagingSenderId: (useEnvOverride && metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID) ? metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID : firebaseConfig.messagingSenderId,
  appId: (useEnvOverride && metaEnv.VITE_FIREBASE_APP_ID) ? metaEnv.VITE_FIREBASE_APP_ID : firebaseConfig.appId,
  firestoreDatabaseId: (useEnvOverride && metaEnv.VITE_FIREBASE_DATABASE_ID) ? metaEnv.VITE_FIREBASE_DATABASE_ID : (firebaseConfig.firestoreDatabaseId || "(default)")
};

if (typeof window !== "undefined") {
  console.log("🔥 [Firebase Config Diagnostics] Active Project ID:", finalConfig.projectId);
  console.log("🔑 [Firebase Config Diagnostics] Active API Key (masked):", finalConfig.apiKey ? `${finalConfig.apiKey.slice(0, 8)}...` : "NONE");
  console.log("📦 [Firebase Config Diagnostics] Active Database ID:", finalConfig.firestoreDatabaseId);
}

const app = initializeApp(finalConfig);
export const db = getFirestore(app, finalConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth();
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error("Firestore Error Detailed: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Bootstrap testing connection as requested in skill
export async function testConnection() {
  try {
    // Standard server call attempt to test connection
    const { doc, getDocFromServer } = await import("firebase/firestore");
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration or network status.");
    }
  }
}
testConnection();
