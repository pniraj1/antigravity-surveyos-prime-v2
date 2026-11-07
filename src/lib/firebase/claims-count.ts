import { collection, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

/**
 * Returns the total number of claims created by a surveyor.
 * Executes as a server-side aggregation query (`getCountFromServer`),
 * costing only 1 lightweight metadata read per 1,000 index items.
 */
export async function getSurveyorClaimCount(uid: string): Promise<number> {
  const cleanUid = uid?.trim();
  if (!cleanUid) return 0;

  const claimsColl = collection(db, 'users', cleanUid, 'claims');
  const snapshot = await getCountFromServer(claimsColl);
  return snapshot.data().count;
}
