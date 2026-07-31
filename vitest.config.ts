import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // functions/*.test.js are deliberately framework-free node scripts (plain
    // asserts, run by `npm run test:functions`). Vitest cannot parse them as
    // suites, so keep them out of this runner rather than rewriting them.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/out/**', 'functions/**', 'open-design/**'],
    // zustand must be transformed rather than externalised, otherwise its
    // `import React from 'react'` bypasses vi.mock('react') and hook-reading
    // stores blow up outside a renderer (see hooks/__tests__/useAuth.test.ts).
    server: { deps: { inline: ['zustand'] } },
    // Dummy Firebase config so modules that import '@/lib/firebase/config'
    // (which validates these at import time) can be unit-tested. No network
    // calls are made in tests — only pure logic is exercised.
    env: {
      NEXT_PUBLIC_FIREBASE_API_KEY: 'test-api-key',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'test-project',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'test.appspot.com',
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '0',
      NEXT_PUBLIC_FIREBASE_APP_ID: 'test-app-id',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
