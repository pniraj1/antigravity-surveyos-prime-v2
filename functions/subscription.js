/**
 * Subscription gate — pure predicate, no Firestore dependency so it's
 * unit-testable standalone (see subscription.test.js).
 *
 * Mirrors src/lib/subscription/status.ts on the server side: the client's
 * SubscriptionGuard is only a UI overlay, so any function that spends money
 * (AI keys) or grants access must re-check here.
 */

/**
 * @param {object|null} profile  users/{uid}/profile/current document data
 * @param {Date} [now]           injectable clock for tests
 * @returns {boolean} true if the profile may use paid features right now
 */
function isSubscriptionActive(profile, now = new Date()) {
  if (!profile) return false;
  if (profile.isAdmin === true) return true;

  const status = profile.subscriptionStatus;
  if (status !== "active" && status !== "trial") return false;

  // Unlike Firestore rules, JS can parse the ISO expiry string and enforce it.
  const expiry = status === "trial" ? profile.trialEndDate : profile.subscriptionExpiry;
  if (!expiry) return true; // no expiry set = open-ended grant (admin/trial)
  return new Date(expiry) >= now;
}

module.exports = { isSubscriptionActive };
