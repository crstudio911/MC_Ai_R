import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getDatabase,
  ref,
  set,
  get,
  update,
  remove,
  push,
  onValue
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAWUOCFxgTDnvYd4Z5sjiXCfnzFO-WNbvQ",
  authDomain: "mc-ai-r.firebaseapp.com",
  databaseURL: "https://mc-ai-r-default-rtdb.firebaseio.com",
  projectId: "mc-ai-r",
  storageBucket: "mc-ai-r.firebasestorage.app",
  messagingSenderId: "614500677554",
  appId: "1:614500677554:web:ae9a9f65eea6af6d7e56ab"
};

const app = initializeApp(firebaseConfig);

const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence]
});

const apiKeyValid = /^AIza[0-9A-Za-z_-]{35}$/.test(firebaseConfig.apiKey);

const authStatus = { error: '', code: '' };

const classifyAuthError = err => {
  const code = err && err.code ? String(err.code) : '';
  if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') return 'anonymous';
  if (code.indexOf('api-key') !== -1) return 'key';
  return 'network';
};

const authReady = (async () => {
  if (!apiKeyValid) {
    authStatus.error = 'key';
    console.error("firebase-config.js: apiKey is not a real Firebase Web API key. Copy it from Firebase Console > Project settings > General > Your apps.");
    return null;
  }
  try {
    await auth.authStateReady();
    if (auth.currentUser) {
      try {
        await auth.currentUser.getIdToken(true);
        return auth.currentUser;
      } catch (staleErr) {
        await auth.signOut();
      }
    }
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (err) {
    authStatus.error = classifyAuthError(err);
    authStatus.code = err && err.code ? String(err.code) : '';
    console.error("Anonymous sign-in failed. Enable Anonymous in Firebase Console > Authentication > Sign-in method.", err);
    return null;
  }
})();

const db = getFirestore(app);
const rtdb = getDatabase(app);

export {
  app,
  auth,
  authReady,
  authStatus,
  db,
  rtdb,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  ref,
  set,
  get,
  update,
  remove,
  push,
  onValue
};
