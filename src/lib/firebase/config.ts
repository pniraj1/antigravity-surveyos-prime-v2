// ═══════════════════════════════════════════════════════════
// FIREBASE CONFIGURATION
// Project: surveyos-prime-ce978
// ═══════════════════════════════════════════════════════════

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Non-secret values come from .env.production (committed, safe to expose).
// API key comes from .env.local only — rotate it in Firebase Console after any accidental exposure.
// Firebase web API keys are restricted by Firestore Rules + Auth, not by secrecy.
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

if (!firebaseConfig.apiKey) {
  throw new Error('NEXT_PUBLIC_FIREBASE_API_KEY is missing. Add it to .env.local for local dev.');
}

let app: FirebaseApp;

export function getFirebaseApp(): FirebaseApp {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  }
  return app || getApps()[0];
}

// Export singletons
export const auth = getAuth(getFirebaseApp());
export const db = getFirestore(getFirebaseApp());
