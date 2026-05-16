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

let messaging: ReturnType<typeof getMessaging> | null = null;

// Check if messaging is supported (not supported in all browsers)
const initMessaging = async () => {
  try {
    const supported = await isSupported();
    if (supported) {
      messaging = getMessaging(app);
    }
    return messaging;
  } catch (error) {
    console.error('Firebase messaging not supported:', error);
    return null;
  }
};

// Request permission and get FCM token
export const requestNotificationPermission = async (): Promise<string | null> => {
  try {
    const messagingInstance = await initMessaging();
    if (!messagingInstance) {
      console.log('Messaging not supported');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    const token = await getToken(messagingInstance, {
      vapidKey: vapidKey
    });

    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

// Listen for foreground messages
export const onMessageListener = (): Promise<unknown> => {
  return new Promise(async (resolve) => {
    const messagingInstance = await initMessaging();
    if (!messagingInstance) {
      resolve(null);
      return;
    }
    onMessage(messagingInstance, (payload) => {
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

export { app, messaging };
