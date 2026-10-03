import type { ClaimData } from '@/types';
import { callAIGateway } from '@/lib/ai/service';
import { buildSiteNotesPrompt } from '@/lib/ai/prompts';
import {
  siteNoteFields, allowsDamageRows, parseSiteNotesExtraction, planSiteNotes, type SiteNotesPlan,
} from './site-notes';

const EMPTY: SiteNotesPlan = { fills: [], conflicts: [], damageRows: [], unmapped: [] };

/** One text call on the surveyor's own key (~2K tokens). Throws if every provider fails. */
export async function readSiteNotes(claim: ClaimData): Promise<SiteNotesPlan> {
  const notes = (claim.siteNotes ?? '').trim();
  if (!notes) return EMPTY;
  const prompt = buildSiteNotesPrompt(notes, siteNoteFields(claim.surveyType), allowsDamageRows(claim.surveyType));
  const raw = await callAIGateway(prompt, [], 'json', 'text');
  return planSiteNotes(claim, parseSiteNotesExtraction(raw));
}
