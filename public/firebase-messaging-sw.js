// Firebase Messaging Service Worker
// This handles background messages when the app is not in focus

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBtHQX069Opzu7xG3FU15JlmvMwLh4nQAw",
  authDomain: "mom-masale.firebaseapp.com",
  projectId: "mom-masale",
  storageBucket: "mom-masale.firebasestorage.app",
  messagingSenderId: "856734530140",
  appId: "1:856734530140:web:9cb53131148aa0d22b4499",
  measurementId: "G-VJ0J6L7X71"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'New Order';
  const notificationBody = payload.notification?.body || 'You have a new notification';
  const notificationIcon = '/icons/icon-192x192.png';

  const notificationOptions = {
    body: notificationBody,
    icon: notificationIcon,
    badge: '/icons/icon-72x72.png',
    tag: 'mom-masale-order',
    renotify: true,
    data: payload.data || {},
    vibrate: [200, 100, 200],
    actions: [
      {
        action: 'view',
        title: 'View Order'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);

  event.notification.close();

  // Handle action click
  if (event.action === 'view') {
    // Open the app or focus existing window
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // If a window is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});
