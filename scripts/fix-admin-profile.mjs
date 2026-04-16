/**
 * One-time script: fix admin profile/current document.
 *
 * Run: node scripts/fix-admin-profile.mjs
 *
 * This corrects the profile/current doc that was accidentally created
 * with isAdmin:false and subscriptionStatus:pending by the broken useAuth.ts.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Find service account key ─────────────────────────────
const possibleKeys = [
  join(__dirname, '..', 'service-account.json'),
  join(__dirname, '..', 'serviceAccount.json'),
  join(__dirname, '..', 'firebase-service-account.json'),
];

let serviceAccount = null;
for (const keyPath of possibleKeys) {
  if (existsSync(keyPath)) {
    serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
    console.log(`Using service account: ${keyPath}`);
    break;
  }
}

if (!serviceAccount) {
  console.error('❌ No service account key found.');
  console.error('Download it from Firebase Console → Project Settings → Service Accounts');
  console.error('Save it as: scripts/../service-account.json');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const ADMIN_UID = 'QCgRlZdGF3etljVitH8xq3KsTqB2';

async function fixAdminProfile() {
  const currentRef = db.doc(`users/${ADMIN_UID}/profile/current`);
  const mainRef    = db.doc(`users/${ADMIN_UID}/profile/main`);

  const [currentSnap, mainSnap] = await Promise.all([
    currentRef.get(),
    mainRef.get(),
  ]);

  if (mainSnap.exists) {
    // Merge main into current, then delete main
    const mainData = mainSnap.data();
    await currentRef.set({
      ...mainData,
      isAdmin: true,
      subscriptionStatus: 'active',
      subscriptionExpiry: mainData.subscriptionExpiry || '2099-12-31',
      updatedAt: Timestamp.now(),
    }, { merge: true });
    await mainRef.delete();
    console.log('✅ Migrated profile/main → profile/current with isAdmin:true');
  } else if (currentSnap.exists) {
    // Just fix the existing current doc
    const existing = currentSnap.data();
    await currentRef.set({
      ...existing,
      isAdmin: true,
      subscriptionStatus: 'active',
      subscriptionExpiry: existing.subscriptionExpiry || '2099-12-31',
      updatedAt: Timestamp.now(),
    }, { merge: true });
    console.log('✅ Fixed profile/current — isAdmin:true, subscriptionStatus:active');
  } else {
    // Create fresh admin profile
    await currentRef.set({
      isAdmin: true,
      subscriptionStatus: 'active',
      subscriptionExpiry: '2099-12-31',
      email: 'pniraj.india@gmail.com',
      displayName: 'Admin',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    console.log('✅ Created fresh admin profile/current with isAdmin:true');
  }

  const fixed = await currentRef.get();
  console.log('\nProfile now in Firestore:');
  console.log(JSON.stringify(fixed.data(), null, 2));
}

fixAdminProfile().catch(console.error);
