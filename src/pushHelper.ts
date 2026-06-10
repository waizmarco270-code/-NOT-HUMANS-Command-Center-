/**
 * Sovereign OneSignal Push Notification helper
 * Handles dynamic integration with OneSignal's reliable messaging channels.
 */

export interface PushStatus {
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
  loading: boolean;
}

let scriptLoadedPromise: Promise<void> | null = null;
let initPromise: Promise<any> | null = null;

function loadOneSignalScript(): Promise<void> {
  if (scriptLoadedPromise) return scriptLoadedPromise;
  
  scriptLoadedPromise = new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }
    
    if ((window as any).OneSignal) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      console.warn("⚠️ Failed to load OneSignal CDN SDK script on this device.");
      resolve();
    };
    document.head.appendChild(script);
  });
  
  return scriptLoadedPromise;
}

export async function checkPushSupport(): Promise<boolean> {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "Notification" in window
  );
}

/**
 * Robust OneSignal initialization cache.
 * Ensures the SDK is only initialized once and listens to active subscription state transitions.
 */
export async function initOneSignal(userUid?: string | null): Promise<any> {
  if (initPromise) {
    if (userUid) {
      try {
        const OneSignal = (window as any).OneSignal;
        if (OneSignal && OneSignal.User) {
          await OneSignal.login(userUid);
        }
      } catch (err) {
        console.warn("Error logging in during existing OneSignal session:", err);
      }
    }
    return initPromise;
  }

  initPromise = (async () => {
    await loadOneSignalScript();
    const OneSignal = (window as any).OneSignal;
    if (!OneSignal) {
      console.warn("⚠️ OneSignal SDK script loaded but object not found in window.");
      return null;
    }

    const appId = (import.meta as any).env.VITE_ONESIGNAL_APP_ID;
    if (!appId) {
      console.warn("⚠️ VITE_ONESIGNAL_APP_ID environment variable is missing.");
      return null;
    }

    try {
      await OneSignal.init({
        appId: appId,
        allowLocalhostAsSecureOrigin: true,
        notifyButton: {
          enable: false,
        },
        serviceWorkerPath: "sw.js",
        serviceWorkerParam: { scope: "/" }
      });

      console.log("🔥 [OneSignal SDK] Ready with App ID:", appId);

      // Register responsive subscriber level transitions
      OneSignal.User?.pushSubscription?.addEventListener("change", (event: any) => {
        console.log("🔥 [OneSignal Event] State change detected:", event?.current);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("onesignal-subscription-changed", { detail: event?.current }));
        }
      });

      if (userUid) {
        await OneSignal.login(userUid);
        console.log(`🔥 [OneSignal User Logged] Session key: ${userUid}`);
        
        // Dynamic zero-config client tagging for targeting and sender exclusion
        try {
          if (OneSignal.User && typeof OneSignal.User.addTag === "function") {
            await OneSignal.User.addTag("userUid", userUid);
            console.log(`🔥 [OneSignal Tagged] Synced userUid tag on login: ${userUid}`);
          }
        } catch (tagErr) {
          console.warn("OneSignal tag mapping failed:", tagErr);
        }
      }

      return OneSignal;
    } catch (err) {
      console.error("❌ OneSignal SDK init failed:", err);
      // Reset promise to let next attempts retry if necessary
      initPromise = null;
      return null;
    }
  })();

  return initPromise;
}

export async function getPushStatus(userUid: string | null): Promise<PushStatus> {
  const isSupported = await checkPushSupport();
  if (!isSupported) {
    return { supported: false, permission: "default", subscribed: false, loading: false };
  }

  const permission = Notification.permission;
  if (permission !== "granted" || !userUid) {
    return { supported: true, permission, subscribed: false, loading: false };
  }

  try {
    const OneSignal = await initOneSignal(userUid);
    if (!OneSignal) {
      return { supported: true, permission, subscribed: true, loading: false };
    }

    // Modern status retrieval
    const isSubscribed = !!(OneSignal.User?.pushSubscription?.id);
    const optedIn = OneSignal.User?.pushSubscription?.optedIn === true;

    // Self-healing auto-optIn: if browser allowed permissions, but OneSignal shows offline/opted out, automatically force opt-in!
    if (!isSubscribed || !optedIn) {
      console.log("⚡ [OneSignal Auto-Recovery] Browser permissions allowed, but SDK status is offline/logged-out. Auto opting in...");
      if (OneSignal.User?.pushSubscription) {
        OneSignal.User.pushSubscription.optIn().catch((optErr: any) => {
          console.warn("OneSignal optIn fallback failed:", optErr);
        });
      }
    }

    return {
      supported: true,
      permission,
      subscribed: true,
      loading: false
    };
  } catch (err) {
    console.warn("OneSignal status check fallback:", err);
    return { supported: true, permission, subscribed: true, loading: false };
  }
}

export async function subscribeToPushNotifications(userUid: string): Promise<boolean> {
  const isSupported = await checkPushSupport();
  if (!isSupported) {
    console.warn("Push notifications are not supported by this browser.");
    return false;
  }

  try {
    const OneSignal = await initOneSignal(userUid);
    if (!OneSignal) {
      throw new Error("OneSignal SDK could not be initialized.");
    }

    // Modern v16 requestPermission
    await OneSignal.Notifications.requestPermission();
    
    // Check if permission is now granted
    if (Notification.permission !== "granted") {
      console.warn("Permission was not granted by the user.");
      return false;
    }

    // Force sub sync
    if (OneSignal.User?.pushSubscription) {
      try {
        await OneSignal.User.pushSubscription.optIn();
      } catch (optErr) {
        console.warn("Attempted optIn fallback error:", optErr);
      }
    }

    console.log("🔥 [OneSignal Handshake] Force validation polling start...");
    // Poll up to 10 rounds (5 seconds) to guarantee the background registration has updated on the active SDK instance before wrapping up
    for (let i = 0; i < 10; i++) {
      const activeId = OneSignal.User?.pushSubscription?.id;
      const optedIn = OneSignal.User?.pushSubscription?.optedIn === true;
      if (activeId || optedIn) {
        console.log(`🔥 [OneSignal Handshake] Verified live active session! Subscriber: ${activeId}`);
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Explicit tag replication during handshake sequence to guarantee database targeting sync
    if (OneSignal.User && typeof OneSignal.User.addTag === "function") {
      try {
        await OneSignal.User.addTag("userUid", userUid);
        console.log(`🔥 [OneSignal Tagged] Dynamic userUid tag attached successfully: ${userUid}`);
      } catch (tagErr) {
        console.warn("OneSignal tag attachment bypassed:", tagErr);
      }
    }

    console.log("🔥 [OneSignal] Channel subscribed successfully under userUid:", userUid);
    return true;
  } catch (err) {
    console.error("Failed to subscribe in OneSignal:", err);
    return false;
  }
}

export async function sendPushNotification(payload: {
  title: string;
  message: string;
  linkToTab?: string;
  room?: string;
  excludeUserUid?: string;
}): Promise<boolean> {
  try {
    const res = await fetch("/api/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch (err) {
    console.error("Failed to request push notification delivery:", err);
    return false;
  }
}
