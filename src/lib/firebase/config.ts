// ═══════════════════════════════════════════════════════════
// FIREBASE CONFIGURATION
// Project: surveyos-prime-ce978
// ═══════════════════════════════════════════════════════════

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCimnYVKZ0n-iX8MOHO2f3TP3GoBvNMqpk',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'surveyos-v2-antigravity.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'surveyos-v2-antigravity',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'surveyos-v2-antigravity.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '926682149516',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:926682149516:web:7a4b8de9b48e2ebf4dc1a9',
};

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
