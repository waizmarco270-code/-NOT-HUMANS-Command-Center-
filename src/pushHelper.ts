/**
 * Sovereign Web Push notification registration helper
 * Communicates with backend VAPID broker to register subscribers automatically.
 */

// Convert URL-safe base64 string to Uint8Array for VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface PushStatus {
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
  loading: boolean;
}

export async function checkPushSupport(): Promise<boolean> {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
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
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return {
      supported: true,
      permission,
      subscribed: !!subscription,
      loading: false
    };
  } catch (err) {
    console.error("Error checking push subscription:", err);
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
    // 1. Fetch dynamic public VAPID key from backend
    const configRes = await fetch("/api/push/config");
    if (!configRes.ok) {
      throw new Error(`Failed to fetch push configurations: ${configRes.status}`);
    }
    const { publicKey } = await configRes.json();
    if (!publicKey) {
      throw new Error("No active public VAPID key received from server.");
    }

    // 2. Request notification permissions from user
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("Notification permissions denied by user.");
      return false;
    }

    // 3. Register or get current ready service worker
    const registration = await navigator.serviceWorker.ready;

    // 4. Register subscription
    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });

    // 5. Submit subscription to backend coordinator
    const subscribeRes = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userUid,
        subscription
      })
    });

    if (!subscribeRes.ok) {
      throw new Error("Failed to post push subscription details to backend coordinate broker.");
    }

    console.log("🔥 [Web Push] Subscriber registered successfully.");
    return true;
  } catch (err) {
    console.error("Failed to configure push notification subscription:", err);
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
