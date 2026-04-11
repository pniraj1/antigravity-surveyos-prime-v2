# IndexedDB Schema

To achieve zero-cost, offline-first execution, SurveyOS relies on `idb` (IndexedDB Wrapper) rather than a live Firebase Firestore synchronization for all core runtime mechanisms.

## `surveyos-db`

The primary local database is named `surveyos-db`.

### Stores
1. **claims**: `id` mapped document store holding full JSON stringified versions of `ClaimData`.
2. **sync-queue**: Used for debounced off-loading pushing changes securely toward Cloud Storage as a secondary backup.

## Persistence Behaviors
1. Instant write to `claims` via unified local handlers.
2. `BroadcastChannel('surveyos_claims_sync')` is emitted.
3. Debounced cloud synchronization drops local state to Firebase.
