importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyD8Q-Ru_QGobJ_VbOW31karDMj6r3GGCdE",
  authDomain: "scanbell-ar.firebaseapp.com",
  projectId: "scanbell-ar",
  storageBucket: "scanbell-ar.firebasestorage.app",
  messagingSenderId: "1093927523954",
  appId: "1:1093927523954:web:3cc412e7a98e27c05bd4eb"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("Background message received:", payload);

  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: "/icon.png"
  });
});
