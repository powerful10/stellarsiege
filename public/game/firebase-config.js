// Optional: Firebase config for Google sign-in, cloud saves, global leaderboard, and online duels.
//
// 1) Create a Firebase project
// 2) Add a Web App
// 3) Enable Authentication -> Sign-in method -> Google
// 4) Enable Realtime Database (for online rooms/duels)
// 5) Copy the config object here:
//
// window.FIREBASE_CONFIG = {
//   apiKey: "...",
//   authDomain: "...",
//   databaseURL: "...", // Realtime Database URL
//   projectId: "...",
//   storageBucket: "...",
//   messagingSenderId: "...",
//   appId: "...",
// };
//
// IMPORTANT: For Google sign-in you must run this game on http://localhost (or HTTPS hosting).
// Opening index.html via file:// will not work with OAuth popups.

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyAHzFAigw7IS__GSdoHlqPelxcO1BFnk5A",
  authDomain: "stellar-siege.firebaseapp.com",
  databaseURL: "https://stellar-siege-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "stellar-siege",
  storageBucket: "stellar-siege.firebasestorage.app",
  messagingSenderId: "1058826698690",
  appId: "1:1058826698690:web:a8483d043092ceaa28a05b",
};

// Optional: payments backend (Lemon Squeezy) base URL (same-origin if empty).
// When you deploy the backend, set e.g.:
// window.PAYMENTS_API_BASE = "https://yourdomain.com";
window.PAYMENTS_API_BASE = "";
