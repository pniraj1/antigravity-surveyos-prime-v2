// ═══════════════════════════════════════════════════════════
// AUTH LISTENER HOOK
// Keeps the auth store in sync with Firebase state
// ═══════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { useAuthStore } from '@/stores/auth-store';

export function useAuth() {
  const setUser = useAuthStore(s => s.setUser);

  useEffect(() => {
    // onAuthStateChanged returns an unsubscribe function
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, [setUser]);
}
