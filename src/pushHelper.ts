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
    await loadOneSignalScript();
    const OneSignal = (window as any).OneSignal;
    if (!OneSignal) {
      return { supported: true, permission, subscribed: false, loading: false };
    }

    const isSubscribed = OneSignal.User?.pushSubscription?.id ? true : false;
    return {
      supported: true,
      permission,
      subscribed: isSubscribed,
      loading: false
    };
  } catch (err) {
    console.warn("OneSignal status check fallback:", err);
    return { supported: true, permission, subscribed: false, loading: false };
  }
}

export async function subscribeToPushNotifications(userUid: string): Promise<boolean> {
  const isSupported = await checkPushSupport();
  if (!isSupported) {
    console.warn("Push notifications are not supported by this browser.");
    return false;
  }

  try {
    await loadOneSignalScript();
    const OneSignal = (window as any).OneSignal;
    if (!OneSignal) {
      throw new Error("OneSignal SDK failed to load.");
    }

    const appId = (import.meta as any).env.VITE_ONESIGNAL_APP_ID;
    if (!appId) {
      throw new Error("VITE_ONESIGNAL_APP_ID is not set in environment.");
    }

    // Call init first if not done
    await OneSignal.init({
      appId: appId,
      allowLocalhostAsSecureOrigin: true,
      notifyButton: {
        enable: false,
      },
    });

    if (userUid) {
      await OneSignal.login(userUid);
      console.log(`🔥 [OneSignal] Logged in user: ${userUid}`);
    }

    // Modern v16 requestPermission
    await OneSignal.Notifications.requestPermission();
    
    // Check if permission is now granted
    if (Notification.permission !== "granted") {
      console.warn("Permission was not granted by the user.");
      return false;
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
