// ═══════════════════════════════════════════════════════════
// AUTH SERVICE
// Handles Google Sign-In and Authentication triggers
// ═══════════════════════════════════════════════════════════

import { GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { auth } from './config';

const googleProvider = new GoogleAuthProvider();

/**
 * Initiates Google Sign-In via full-page redirect (not popup).
 * The page navigates to accounts.google.com — no return value.
 * Result is processed by getRedirectResult() in useAuth.ts on return.
 */
export function signInWithGoogle(): void {
  // Clear any intentional logout flag so the auth guard in
  // onAuthStateChanged knows this is a deliberate sign-in.
  try { localStorage.removeItem('surveyos_intentional_logout'); } catch { /* ignore */ }
  signInWithRedirect(auth, googleProvider);
}

export { getRedirectResult };

export async function signOutUser() {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error('Logout Error:', error);
    throw error;
  }
}
