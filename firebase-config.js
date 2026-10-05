import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

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

const db = getFirestore(app);

const authReady = auth.authStateReady().then(() => auth.currentUser);

export {
  app,
  auth,
  authReady,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch
};
