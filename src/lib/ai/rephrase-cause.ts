import { callAIGateway } from '@/lib/ai/service';

// House style for "Cause and Nature of Accident", taken from a senior
// surveyor's reports (places blanked so the model doesn't copy them).
const EXAMPLES = [
  'As per the verbal statement of the driver of the insured vehicle (IV), the subject vehicle was proceeding towards ___ from ___. On the way, a third-party tipper travelling ahead halted sharply. Consequently, the insured vehicle (IV) driver could not control the vehicle in time and smashed against its rear portion, resulting in severe frontal and left-hand side impact damage.',
  'As per the claim form, the subject vehicle was in a parked condition when a stray dog under the car bit the sensor wiring, causing damage to it.',
  'As per the claim form, while the subject vehicle was plying through ___, an unfortunate multi-point impact occurred. A truck moving ahead suddenly drifted and touched/impacted the subject vehicle on the Right-Hand (RH / Offside) side, while simultaneously a pickup vehicle approaching from behind struck the subject vehicle on the Left-Hand (LH / Nearside) side, resulting in damage to the IV.',
];

export function buildCausePrompt(text: string): string {
  return `You rewrite the "Cause and Nature of Accident" for an Indian motor insurance survey report.
The input may be in Marathi, Hindi, English or mixed, often short and informal. Translate if needed and rewrite it in formal report English.

Style:
- Open with the source: "As per the claim form," (or "As per the verbal statement of the driver of the insured vehicle (IV)," if the input says the driver told it).
- Use "subject vehicle", "insured vehicle (IV)", "third-party". Write sides as "Right-Hand (RH / Offside)" and "Left-Hand (LH / Nearside)".
- Order: where the vehicle was going, what happened, the consequence, ending "resulting in damage to the IV" or similar.
- One paragraph, past tense, factual, no blame.

Rules:
- Never add facts that are not in the input — no sides, severity, places or vehicles it does not mention.
- Keep every fact the input gives, including names of places.

Examples of the house style:
${EXAMPLES.map((e) => `- ${e}`).join('\n')}

Input:
${text}

Reply with ONLY the rewritten paragraph.`;
}

export function cleanCauseReply(raw: string): string {
  return raw
    .trim()
    .replace(/^(rephrased|rewritten|output)\s*:\s*/i, '')
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function rephraseCause(text: string): Promise<string> {
  const reply = await callAIGateway(buildCausePrompt(text), [], 'text', 'text');
  const out = cleanCauseReply(reply);
  if (!out) throw new Error('AI returned an empty reply');
  return out;
}
