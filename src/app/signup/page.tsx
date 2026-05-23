'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /signup is kept alive for marketing links.
 * All visitors are transparently redirected to /access-request,
 * which handles unauthenticated, pending, and confirmed states.
 */
export default function SignupPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/access-request');
  }, [router]);
  return null;
}
