// ═══════════════════════════════════════════════════════════
// FIREBASE CONFIGURATION
// Project: surveyos-prime-ce978
// ═══════════════════════════════════════════════════════════

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Public config values (authDomain, projectId, etc.) come from .env.production (safe to commit).
// API key must come from .env.local (dev) or CI/CD secrets (production) — never commit to version control.
// If API key is ever exposed, rotate it immediately in Firebase Console: https://console.firebase.google.com/project/surveyos-v2-antigravity/settings/apikeys
// Firebase web API keys are restricted by Firestore Rules + Auth, not by secrecy alone.
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
