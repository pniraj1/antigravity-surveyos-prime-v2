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

const { aiProxy, nvidiaProxy } = require("./index");

assert.ok(aiProxy.__endpoint, "aiProxy should expose v2 endpoint metadata");
assert.strictEqual(aiProxy.__endpoint.timeoutSeconds, 300, "aiProxy must allow 300s — NVIDIA vision models take up to 200s per page");
assert.ok(nvidiaProxy.__endpoint, "nvidiaProxy alias must still be exported for clients built before the rename");
assert.strictEqual(nvidiaProxy.__endpoint.timeoutSeconds, 300);

console.log("nvidia-proxy.test.js: all assertions passed");

// Rate-limit pass-through: stub https.request (node-fetch sends through it) so
// no network is touched, then call the function body directly.
(async () => {
  const https = require("https");
  const { PassThrough, Readable } = require("stream");
  const realRequest = https.request;
  https.request = () => {
    const req = new PassThrough();
    req.setTimeout = () => req;
    req.once("finish", () => {
      const res = Readable.from([Buffer.from("{}")]);
      res.statusCode = 200;
      res.statusMessage = "OK";
      res.headers = { "x-ratelimit-remaining-requests": "5", "x-other": "no" };
      res.rawHeaders = ["x-ratelimit-remaining-requests", "5", "x-other", "no"];
      req.emit("response", res);
    });
    return req;
  };
  try {
    const out = await aiProxy.run({ auth: { uid: "u", token: { firebase: { sign_in_provider: "anonymous" } } }, data: { provider: "ollama", path: "api/tags", key: "k" } });
    assert.strictEqual(out.rateLimit["x-ratelimit-remaining-requests"], "5");
    assert.deepStrictEqual(Object.keys(out.rateLimit), ["x-ratelimit-remaining-requests"]);
    console.log("nvidia-proxy.test.js: rateLimit pass-through ok");
  } finally {
    https.request = realRequest;
  }
})().catch((e) => { console.error(e); process.exit(1); });
