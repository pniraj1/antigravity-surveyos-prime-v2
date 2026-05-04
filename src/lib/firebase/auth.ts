// ═══════════════════════════════════════════════════════════
// AUTH SERVICE
// Handles Google Sign-In and Authentication triggers
// ═══════════════════════════════════════════════════════════

import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { auth } from './config';
import { logger } from '@/lib/utils/logger';

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    logger.error('Login Error:', error);
    throw error;
  }
}

export async function signOutUser() {
  try {
    await signOut(auth);
  } catch (error: any) {
    logger.error('Logout Error:', error);
    throw error;
  }
}
