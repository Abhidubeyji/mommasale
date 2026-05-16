import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyBtHQX069Opzu7xG3FU15JlmvMwLh4nQAw",
  authDomain: "mom-masale.firebaseapp.com",
  projectId: "mom-masale",
  storageBucket: "mom-masale.firebasestorage.app",
  messagingSenderId: "856734530140",
  appId: "1:856734530140:web:9cb53131148aa0d22b4499",
  measurementId: "G-VJ0J6L7X71"
};

const vapidKey = "BOJDJ6gwhEyQwx21RrV8HfreBKneEBF21GTFcoyJ5J9uKutc-OrzL9fFsi07Lpzes0nzmp7XzBtloWpHTOiQs5o";

// Initialize Firebase only if it hasn't been initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

let messagingInstance: ReturnType<typeof getMessaging> | null = null;

// Register service worker
const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('Service Worker registered:', registration.scope);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
};

// Check if messaging is supported (not supported in all browsers)
const initMessaging = async () => {
  if (messagingInstance) return messagingInstance;

  try {
    const supported = await isSupported();
    if (supported) {
      messagingInstance = getMessaging(app);
    }
    return messagingInstance;
  } catch (error) {
    console.error('Firebase messaging not supported:', error);
    return null;
  }
};

// Request permission and get FCM token
export const requestNotificationPermission = async (): Promise<string | null> => {
  try {
    // First register service worker
    await registerServiceWorker();

    const messaging = await initMessaging();
    if (!messaging) {
      console.log('Messaging not supported');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    // Wait for service worker to be ready
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.ready;
    }

    const token = await getToken(messaging, {
      vapidKey: vapidKey
    });

    console.log('FCM Token obtained:', token ? 'Success' : 'Failed');
    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

// Listen for foreground messages
export const onMessageListener = (): Promise<unknown> => {
  return new Promise(async (resolve) => {
    const messaging = await initMessaging();
    if (!messaging) {
      resolve(null);
      return;
    }
    onMessage(messaging, (payload) => {
      console.log('Foreground message received:', payload);
      resolve(payload);
    });
  });
};

// Check if notifications are supported
export const isNotificationSupported = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
};

// Get current notification permission status
export const getNotificationPermission = (): NotificationPermission | null => {
  if (!isNotificationSupported()) return null;
  return Notification.permission;
};

// Check if user has FCM token in database
export const checkUserFCMStatus = async (): Promise<{ hasToken: boolean; browserPermission: NotificationPermission | null }> => {
  try {
    const response = await fetch('/api/fcm-token/status');
    if (response.ok) {
      const data = await response.json();
      return {
        hasToken: data.hasToken || false,
        browserPermission: getNotificationPermission()
      };
    }
  } catch (error) {
    console.error('Error checking FCM status:', error);
  }
  return {
    hasToken: false,
    browserPermission: getNotificationPermission()
  };
};

export { app, messagingInstance as messaging };
