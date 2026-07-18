/**
 * Self-check for the subscription gate. Run: `node subscription.test.js`
 * No framework — plain asserts. Fails loudly if the money-path logic breaks.
 */
const assert = require("assert");
const { isSubscriptionActive } = require("./subscription");

const NOW = new Date("2026-07-18T00:00:00Z");
const future = "2099-01-01T00:00:00Z";
const past = "2020-01-01T00:00:00Z";

// ── Allowed ──
assert.strictEqual(isSubscriptionActive({ subscriptionStatus: "active", subscriptionExpiry: future }, NOW), true, "active + future expiry");
assert.strictEqual(isSubscriptionActive({ subscriptionStatus: "trial", trialEndDate: future }, NOW), true, "trial + future end");
assert.strictEqual(isSubscriptionActive({ subscriptionStatus: "active", subscriptionExpiry: null }, NOW), true, "active, open-ended");
assert.strictEqual(isSubscriptionActive({ isAdmin: true, subscriptionStatus: "suspended" }, NOW), true, "admin always allowed");

// ── Blocked ──
assert.strictEqual(isSubscriptionActive(null, NOW), false, "no profile");
assert.strictEqual(isSubscriptionActive({ subscriptionStatus: "pending" }, NOW), false, "pending (unapproved) — Scenario 1");
assert.strictEqual(isSubscriptionActive({ subscriptionStatus: "suspended" }, NOW), false, "suspended — Scenario 2");
assert.strictEqual(isSubscriptionActive({ subscriptionStatus: "readonly" }, NOW), false, "readonly");
assert.strictEqual(isSubscriptionActive({ subscriptionStatus: "active", subscriptionExpiry: past }, NOW), false, "active but expired");
assert.strictEqual(isSubscriptionActive({ subscriptionStatus: "trial", trialEndDate: past }, NOW), false, "trial but expired");

console.log("subscription gate: all checks passed");
