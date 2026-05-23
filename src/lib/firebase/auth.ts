// ═══════════════════════════════════════════════════════════
// AUTH SERVICE
// Handles Google Sign-In and Authentication triggers
// ═══════════════════════════════════════════════════════════

import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { auth } from './config';

const googleProvider = new GoogleAuthProvider();
// Always show the Google account picker so logout feels real —
// without this, Google silently re-selects the previously used account.
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Initiates Google Sign-In via a popup window.
 * onAuthStateChanged in useAuth.ts picks up the result automatically.
 */
export async function signInWithGoogle(): Promise<void> {
  try { localStorage.removeItem('surveyos_intentional_logout'); } catch { /* ignore */ }
  await signInWithPopup(auth, googleProvider);
}

export async function signOutUser() {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error('Logout Error:', error);
    throw error;
  }
}
