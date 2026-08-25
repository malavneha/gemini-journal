import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
  browserLocalPersistence,
  setPersistence,
  signInAnonymously
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  Firestore
} from 'firebase/firestore';
import { JournalInteraction, ActionPlan } from './types';

// Client-side Firebase Configuration with dynamic/env fallbacks
// In development, values can come from Vite env or default project parameters
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyKeyForInitialConfigInDevMode",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${import.meta.env.VITE_FIREBASE_PROJECT_ID || "personal-gemini-journal"}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "personal-gemini-journal",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${import.meta.env.VITE_FIREBASE_PROJECT_ID || "personal-gemini-journal"}.appspot.com`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:abcdef123456"
};

// Check if valid Firebase credentials are provided or if running in prototype local fallback mode
export const isFirebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY && 
  import.meta.env.VITE_FIREBASE_PROJECT_ID &&
  !import.meta.env.VITE_FIREBASE_API_KEY.includes("Dummy")
);

// Initialize Firebase App defensively
let app;
let authInstance: any = null;
let dbInstance: any = null;

try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
  // Set auth persistence
  setPersistence(authInstance, browserLocalPersistence).catch(() => {
    // Gracefully handle iframe persistence restrictions if any
  });
} catch (e) {
  console.warn("Firebase initialization warning (standard in prototype or unconfigured mode):", e);
}

export const auth = authInstance;
export const db = dbInstance;
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Local Storage Fallback storage key for local offline/guest or demo test state
const LOCAL_STORAGE_KEY_PREFIX = 'gemini_journal_entries_';

// Helper: Strip all undefined values from an object before saving to Firestore
export function sanitizePayload<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: any = {};
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  });
  return result;
}

// User Sign In with Google
export async function signInWithGoogle(): Promise<User | null> {
  if (auth && isFirebaseConfigured) {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (err: any) {
      console.error("Google sign in error:", err);
      // If popup is blocked in iframe, suggest or throw clean error
      throw err;
    }
  } else {
    // If Firebase is not yet configured with real keys, provide interactive Demo/Guest session
    console.info("Using local demo auth mode because Firebase live project keys are not yet configured.");
    const demoUser = {
      uid: "demo-user-101",
      email: "demo.journaler@example.com",
      displayName: "Guest Journaler",
      photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=Journaler",
    } as unknown as User;
    localStorage.setItem("gemini_journal_demo_user", JSON.stringify(demoUser));
    return demoUser;
  }
}

// User Sign Out
export async function logOut(): Promise<void> {
  if (auth && isFirebaseConfigured) {
    await signOut(auth);
  }
  localStorage.removeItem("gemini_journal_demo_user");
}

// Save a journal interaction under /users/{userId}/interactions/{interactionId}
export async function saveJournalInteraction(
  userId: string,
  entry: Omit<JournalInteraction, 'userId'>
): Promise<JournalInteraction> {
  const fullEntry: JournalInteraction = {
    ...entry,
    userId,
    createdAt: entry.createdAt || new Date().toISOString(),
  };

  const sanitized = sanitizePayload(fullEntry);

  if (db && isFirebaseConfigured) {
    try {
      // Path: /users/{userId}/interactions/{interactionId}
      const interactionRef = doc(db, 'users', userId, 'interactions', entry.id);
      await setDoc(interactionRef, {
        ...sanitized,
        updatedAt: serverTimestamp(),
      });
      return fullEntry;
    } catch (err: any) {
      console.error("Error saving to Firestore:", err);
      // Fallback to local storage on permission or network issue so user NEVER loses thoughts
      saveToLocalStorage(userId, fullEntry);
      throw err;
    }
  } else {
    // Save to local storage for demo/preview user
    saveToLocalStorage(userId, fullEntry);
    return fullEntry;
  }
}

// Save or update an Action Plan for a specific journal interaction
export async function saveActionPlanToEntry(
  userId: string,
  interactionId: string,
  actionPlan: ActionPlan
): Promise<ActionPlan> {
  const planWithMeta: ActionPlan = {
    ...actionPlan,
    createdAt: actionPlan.createdAt || new Date().toISOString(),
    savedToFirestore: true,
  };

  const sanitized = sanitizePayload(planWithMeta);

  if (db && isFirebaseConfigured) {
    try {
      const interactionRef = doc(db, 'users', userId, 'interactions', interactionId);
      await setDoc(
        interactionRef,
        {
          actionPlan: sanitized,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err: any) {
      console.error("Error saving action plan to Firestore:", err);
      // Update local storage so data isn't lost
      updateActionPlanInLocalStorage(userId, interactionId, planWithMeta);
      throw err;
    }
  }

  // Always sync with local storage
  updateActionPlanInLocalStorage(userId, interactionId, planWithMeta);
  return planWithMeta;
}

// Delete a journal interaction under /users/{userId}/interactions/{interactionId}
export async function deleteJournalInteraction(
  userId: string,
  interactionId: string
): Promise<void> {
  if (db && isFirebaseConfigured) {
    try {
      const interactionRef = doc(db, 'users', userId, 'interactions', interactionId);
      await deleteDoc(interactionRef);
    } catch (err) {
      console.error("Error deleting from Firestore:", err);
      throw err;
    }
  }
  // Also delete from local storage
  deleteFromLocalStorage(userId, interactionId);
}

// Fetch all interactions for a user
export async function fetchUserInteractions(userId: string): Promise<JournalInteraction[]> {
  if (db && isFirebaseConfigured) {
    try {
      const interactionsRef = collection(db, 'users', userId, 'interactions');
      const q = query(interactionsRef, orderBy('createdAt', 'desc'), limit(100));
      const querySnapshot = await getDocs(q);
      
      const entries: JournalInteraction[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        entries.push({
          id: docSnap.id,
          userId,
          prompt: data.prompt || '',
          response: data.response || '',
          createdAt: data.createdAt || new Date().toISOString(),
          tags: data.tags || [],
          modelUsed: data.modelUsed,
          mood: data.mood,
          actionPlan: data.actionPlan,
        });
      });

      return entries;
    } catch (err: any) {
      console.warn("Firestore fetch error, falling back to local entries:", err);
      return getFromLocalStorage(userId);
    }
  } else {
    return getFromLocalStorage(userId);
  }
}

// Local Storage Helper Utilities
function getFromLocalStorage(userId: string): JournalInteraction[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function updateActionPlanInLocalStorage(userId: string, interactionId: string, actionPlan: ActionPlan): void {
  const existing = getFromLocalStorage(userId);
  const updated = existing.map((e) => {
    if (e.id === interactionId) {
      return { ...e, actionPlan };
    }
    return e;
  });
  localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(updated));
}

function saveToLocalStorage(userId: string, entry: JournalInteraction): void {
  const existing = getFromLocalStorage(userId);
  const updated = [entry, ...existing.filter((e) => e.id !== entry.id)];
  localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(updated));
}

function deleteFromLocalStorage(userId: string, interactionId: string): void {
  const existing = getFromLocalStorage(userId);
  const updated = existing.filter((e) => e.id !== interactionId);
  localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(updated));
}
