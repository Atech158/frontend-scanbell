import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";

// Firebase config is expected from environment variables.
// Set these in your frontend env (e.g. .env):
// REACT_APP_FIREBASE_API_KEY, REACT_APP_FIREBASE_AUTH_DOMAIN, REACT_APP_FIREBASE_PROJECT_ID,
// REACT_APP_FIREBASE_STORAGE_BUCKET, REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
// REACT_APP_FIREBASE_APP_ID, REACT_APP_FIREBASE_VAPID_KEY

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

let messagingInstance = null;

const getFirebaseMessaging = async () => {
  const supported = await isSupported().catch(() => false);
  if (!supported) {
    console.warn("Firebase messaging is not supported in this browser.");
    return null;
  }

  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }

  if (!messagingInstance) {
    messagingInstance = getMessaging();
  }

  return messagingInstance;
};

export const getMessagingToken = async () => {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.warn("Notification permission not granted.");
    return null;
  }

  // Register service worker explicitly
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      console.log("Service Worker registered:", registration);
    } catch (error) {
      console.error("Service Worker registration failed:", error);
    }
  }

  const messaging = await getFirebaseMessaging();
  if (!messaging) return null;

  const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY;

  try {
    const token = await getToken(messaging, vapidKey ? { vapidKey } : undefined);
    console.log("FCM Token obtained:", token ? "Success" : "Failed");
    return token;
  } catch (e) {
    console.error("Error getting FCM token:", e);
    return null;
  }
};

export const setupForegroundMessageHandler = async (onNotification) => {
  if (typeof window === "undefined") return;

  const messaging = await getFirebaseMessaging();
  if (!messaging) return;

  onMessage(messaging, (payload) => {
    console.log("Foreground message received:", payload);
    if (onNotification) {
      onNotification(payload);
    }
    // Show browser notification even in foreground
    if (payload.notification) {
      new Notification(payload.notification.title, {
        body: payload.notification.body,
        icon: "/icon.png",
      });
    }
  });
};

