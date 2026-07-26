/**
 * Self-check for the Bramha indexer. Run: `node bramha.test.js`
 * No framework — plain asserts. The critical property is that NO personal
 * data reaches the embedding text or the stored document.
 */
const assert = require("assert");
const { _internal } = require("./bramha");
const { buildEmbeddingText, memoryId, normalize } = _internal;

const claim = {
  vehicle: { make: "Maruti", model: "Swift", yearOfManufacture: 2019, fuel: "Petrol",
             bodyType: "Hatchback", registrationNumber: "MH12AB1234" },
  accident: { placeOfAccident: "NH-48 near Wakad", causeOfAccident: "Rear-end collision" },
  policy: { policyNumber: "POL-99887", insuredName: "Rajesh Kumar", insuredMobile: "9876543210" },
  assessmentRows: [
    { partName: "Front bumper", type: "Plastic", action: "Replace", assessed: 8500, depreciation: 500 },
    { partName: "Radiator support", type: "Metal", action: "Repair", assessed: 2200 },
  ],
  spotDamageRows: [{ part: "Headlamp", damage: "Cracked", action: "Replace" }],
  surveyType: "Final",
  isCompleted: true,
};

const text = buildEmbeddingText(claim);

// ── The whole point: no identifiers in what gets embedded or sent to Gemini ──
for (const secret of ["Rajesh", "Kumar", "9876543210", "POL-99887", "MH12AB1234"]) {
  assert.ok(!text.includes(secret), `embedding text must not contain PII: ${secret}`);
}

// ── But the useful signal must survive ──
for (const kept of ["Swift", "Front bumper", "8500", "Rear-end collision", "Final"]) {
  assert.ok(text.includes(kept), `embedding text should contain: ${kept}`);
}
assert.ok(text.includes("10700"), "totals are summed across assessment rows");

// ── Deterministic ids: same claim → same doc, so re-runs overwrite ──
assert.strictEqual(memoryId("uid1", "claimA"), "uid1__claimA");
assert.strictEqual(memoryId("uid1", "claimA"), memoryId("uid1", "claimA"));
assert.notStrictEqual(memoryId("uid1", "claimA"), memoryId("uid2", "claimA"));

// ── Normalisation: unit length, and zero vectors must not divide by zero ──
const n = normalize([3, 4]);
assert.ok(Math.abs(Math.hypot(...n) - 1) < 1e-9, "normalised vector is unit length");
assert.deepStrictEqual(normalize([0, 0]), [0, 0], "zero vector survives unchanged");

// ── Empty claim must produce something short enough to be skipped, not a crash ──
assert.ok(buildEmbeddingText({}).length < 20, "empty claim yields skippable text");

console.log("bramha indexer: all checks passed");
