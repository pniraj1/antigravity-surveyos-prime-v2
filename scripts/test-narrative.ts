/**
 * Integration test: calls the Groq AI gateway and prints the generated narrative.
 *
 * This is a standalone script — it does NOT use the browser or Next.js.
 * It directly exercises the prompt builder + HTTP layer so you can see
 * exactly what letter the AI produces with real grouped assessment data.
 *
 * Usage:
 *   set GROQ_API_KEY=gsk_xxxx && npx tsx scripts/test-narrative.ts
 *   -- OR --
 *   $env:GROQ_API_KEY="gsk_xxxx"; npx tsx scripts/test-narrative.ts
 *
 * Output:  prints the full prompt sent to the AI, then the AI response.
 */

import { buildCoveringNarrativePrompt } from '../src/lib/ai/prompts';

// ── Mock claim data ────────────────────────────────────────────────────────────
// Mirrors a realistic final survey for a Tata Nexon.

const CLAIM_SUMMARY = JSON.stringify({
  claimNumber: 'CLM-2024-TEST-001',
  vehicleReg: 'MH01AB1234',
  make: 'Tata',
  model: 'Nexon',
  year: 2020,
  insuredName: 'Ramesh Kumar',
  policyNumber: 'POL/2024/12345',
  causeOfLoss: 'Collision with a stationary vehicle',
  dateOfAccident: '15-Apr-2024',
  workshopName: 'Speed Auto Works, Pune',
  estimateTotal: 53650,
  assessedTotal: 35000,
  depreciation: 4500,
  compulsoryExcess: 500,
  consumablesTotal: 450,
  salvageDeduction: 2000,
  netPayable: 27550,
  insuredPays: 7450,
}, null, 2);

const DEDUCTION_LINES = [
  'Depreciation on parts: ₹4,500',
  'Compulsory excess: ₹500',
  'Consumables (engine oil, coolant, nuts, bolts etc.): ₹450 — excluded under standard policy terms',
  'Salvage value of LH Door Assembly: ₹2,000 deducted',
];

// ── Grouped items (the new data the AI now receives) ──────────────────────────
// This is what the surveyor documented in the assessment sheet.

const GROUPED_ITEMS: Record<string, string[]> = {
  safe:         ['LH Headlamp', 'Front Grille'],     // Remarks: Safe → no replacement needed
  consumable:   ['Engine Oil', 'Coolant'],            // Remarks: Consumable → policy exclusion
  salvage:      ['LH Door Assembly'],                 // Remarks: Disposal → salvage deducted
  // not-covered and previous-damage left empty to test skip logic
};

// ── Build the prompt ──────────────────────────────────────────────────────────

const prompt = buildCoveringNarrativePrompt(
  'english',
  CLAIM_SUMMARY,
  DEDUCTION_LINES,
  GROUPED_ITEMS,
);

console.log('═'.repeat(70));
console.log('PROMPT SENT TO AI:');
console.log('═'.repeat(70));
console.log(prompt);
console.log('═'.repeat(70));

// ── Verify grouped block rendered ─────────────────────────────────────────────

const checks = [
  { label: 'Grouped block header present',  pass: prompt.includes('Assessment decisions by category') },
  { label: 'Safe category label',           pass: prompt.includes('Parts found safe') },
  { label: 'LH Headlamp listed',            pass: prompt.includes('LH Headlamp') },
  { label: 'Front Grille listed',           pass: prompt.includes('Front Grille') },
  { label: 'Consumable category label',     pass: prompt.includes('Consumable items') },
  { label: 'Engine Oil listed',             pass: prompt.includes('Engine Oil') },
  { label: 'Salvage category label',        pass: prompt.includes('Salvage / disposal') },
  { label: 'LH Door Assembly listed',       pass: prompt.includes('LH Door Assembly') },
  { label: 'Plain text instruction',        pass: prompt.includes('Return ONLY a plain text string') },
  { label: '3 paragraphs instruction',      pass: prompt.includes('3 paragraphs') },
];

console.log('\nPROMPT CONTENT CHECKS:');
let allPassed = true;
for (const c of checks) {
  const icon = c.pass ? '✅' : '❌';
  console.log(`  ${icon}  ${c.label}`);
  if (!c.pass) allPassed = false;
}

if (!allPassed) {
  console.error('\n❌  Some prompt checks failed. Fix the prompt builder before sending to AI.');
  process.exit(1);
}
console.log('\n✅  All prompt checks passed. Calling AI...\n');

// ── Call the AI ───────────────────────────────────────────────────────────────

async function runAITest(): Promise<void> {
  const apiKey = process.env.GROQ_API_KEY ?? process.env.GEMINI_API_KEY ?? '';
  if (!apiKey) {
    console.error('❌  No API key found.\n   Set GROQ_API_KEY or GEMINI_API_KEY and re-run.\n   Example (PowerShell):\n     $env:GEMINI_API_KEY="AIza_xxx"; npx tsx scripts/test-narrative.ts');
    process.exit(1);
  }

  const isGroq = !!process.env.GROQ_API_KEY;

  if (isGroq) {
    console.log('Provider: Groq (llama-3.3-70b-versatile)\n');

    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!resp.ok) {
      console.error('❌  Groq API error:', await resp.text());
      process.exit(1);
    }

    const data = await resp.json() as { choices: Array<{ message: { content: string } }> };
    printNarrative(data.choices?.[0]?.message?.content ?? '');

  } else {
    const models = [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-1.5-flash',
    ];
    let success = false;

    for (const model of models) {
      console.log(`Trying Gemini model: ${model}...`);
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 900 },
          }),
        }
      );

      if (resp.ok) {
        const data = await resp.json() as {
          candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
        };
        const narrative = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (narrative) {
          printNarrative(narrative);
          success = true;
          break;
        }
      } else {
        const err = await resp.json() as any;
        console.warn(`  ⚠️  ${model} failed: ${err.error?.message || 'Unknown error'}`);
      }
    }

    if (!success) {
      console.error('❌  All Gemini models failed or reached quota.');
      process.exit(1);
    }
  }
}

function printNarrative(narrative: string): void {
  console.log('═'.repeat(70));
  console.log('AI-GENERATED NARRATIVE:');
  console.log('═'.repeat(70));
  console.log(narrative);
  console.log('═'.repeat(70));

  const qualityChecks = [
    { label: 'Not empty (>50 chars)',                  pass: narrative.trim().length > 50 },
    { label: 'Mentions insured (Ramesh)',               pass: /ramesh/i.test(narrative) },
    { label: 'Mentions safe parts / no replacement',   pass: /headlamp|grille|safe|no.?replacement/i.test(narrative) },
    { label: 'Mentions consumables or Engine Oil',     pass: /engine.?oil|consumable|coolant/i.test(narrative) },
    { label: 'Mentions salvage / disposal / door',     pass: /door|salvage|disposal/i.test(narrative) },
    { label: 'No raw JSON leaked',                     pass: !narrative.includes('{"') && !narrative.includes('```') },
    { label: 'Settlement amount present (₹)',          pass: narrative.includes('₹') || /\d{4,}/.test(narrative) },
  ];

  console.log('\nNARRATIVE QUALITY CHECKS:');
  let passed = 0;
  for (const c of qualityChecks) {
    console.log(`  ${c.pass ? '✅' : '⚠️ '} ${c.label}`);
    if (c.pass) passed++;
  }
  console.log(`\n  Score: ${passed}/${qualityChecks.length}`);
}

runAITest().catch(err => { console.error('Unexpected error:', err); process.exit(1); });
