// ═══════════════════════════════════════════════════════════
// AUTH SERVICE
// Handles Google Sign-In and Authentication triggers
// ═══════════════════════════════════════════════════════════

import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { auth } from './config';

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  try {
    // Clear any intentional logout flag so the auth guard in
    // onAuthStateChanged knows this is a deliberate sign-in.
    try { localStorage.removeItem('surveyos_intentional_logout'); } catch { /* ignore */ }
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error('Login Error:', error);
    throw error;
  }
}

export async function signOutUser() {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error('Logout Error:', error);
    throw error;
  }
}
