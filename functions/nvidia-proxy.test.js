/**
 * Self-check for the nvidiaProxy deployment config. Run: `node nvidia-proxy.test.js`
 * NVIDIA vision models take 27-200s per page; the v2 default of 60s kills every
 * call. This asserts the declared timeout, which is otherwise invisible until
 * a surveyor hits it in production.
 */
const assert = require("assert");

// firebase-admin's initializeApp() runs at require-time in index.js and wants a
// project id. It never contacts the network here — we only read metadata.
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "surveyos-test";
process.env.FIREBASE_CONFIG = process.env.FIREBASE_CONFIG || "{}";

const { nvidiaProxy } = require("./index");

assert.ok(nvidiaProxy.__endpoint, "nvidiaProxy should expose v2 endpoint metadata");
assert.strictEqual(
  nvidiaProxy.__endpoint.timeoutSeconds,
  300,
  "nvidiaProxy must allow 300s — NVIDIA vision models take up to 200s per page"
);

console.log("nvidia-proxy.test.js: all assertions passed");
