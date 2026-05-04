
import { buildCoveringNarrativePrompt } from '../src/lib/ai/prompts';

// ── Realistic Claim Data ───────────────────────────────────────────────────────
const CLAIM_SUMMARY = JSON.stringify({
  claimNumber: 'CLM/DTC/2024/089',
  vehicleReg: 'MH-12-PQ-4567',
  make: 'Maruti Suzuki',
  model: 'Swift VXI',
  year: 2021,
  insuredName: 'Mrs. Manasi',
  policyNumber: 'PL-9988776655',
  causeOfLoss: 'Minor brush with a pillar in parking',
  dateOfAccident: '22-Oct-2024',
  workshopName: 'DTC Auto Services, Mumbai',
  estimateTotal: 18500,
  assessedTotal: 12400,
  depreciation: 1200,
  compulsoryExcess: 1000,
  consumablesTotal: 350,
  salvageDeduction: 500,
  netPayable: 9350,
  insuredPays: 3050,
}, null, 2);

const DEDUCTION_LINES = [
  'Depreciation (Metal 10%, Plastic 50%): ₹1,200',
  'Compulsory Deductible: ₹1,000',
  'Consumables (Clips, Washers, Grease): ₹350',
  'Salvage value of Front Bumper: ₹500',
];

const GROUPED_ITEMS: Record<string, string[]> = {
  safe:         ['Right Fog Lamp', 'Internal Bracket'],
  consumable:   ['Bumper Clips', 'Washer Fluid', 'M-Grease'],
  salvage:      ['Front Bumper (Damaged)'],
  not_covered:  ['Previous dent on LH Quarter Panel'],
};

const prompt = buildCoveringNarrativePrompt(
  'english',
  CLAIM_SUMMARY,
  DEDUCTION_LINES,
  GROUPED_ITEMS,
);

async function runLiveTest(): Promise<void> {
  const apiKey = "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";
  
  console.log('--- CALLING GROQ WITH LIVE-STYLE DATA ---\n');

  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!resp.ok) {
    console.error('Groq error:', await resp.text());
    return;
  }

  const data = await resp.json() as any;
  const narrative = data.choices?.[0]?.message?.content || '';

  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('FINAL NARRATIVE FOR MANASI (DTC AUTO SERVICES):');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log(narrative);
  console.log('══════════════════════════════════════════════════════════════════════\n');
}

runLiveTest();
