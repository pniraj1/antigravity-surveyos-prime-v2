import type { ClaimData } from '@/types';
import { callAIGateway } from '@/lib/ai/service';
import { buildSiteNotesPrompt } from '@/lib/ai/prompts';
import {
  siteNoteFields, allowsDamageRows, parseSiteNotesExtraction, planSiteNotes,
  type SiteNotesExtraction, type SiteNotesPlan,
} from './site-notes';

export interface SiteNotesRead { claimId: string; extraction: SiteNotesExtraction; plan: SiteNotesPlan }

const EMPTY_EXTRACTION: SiteNotesExtraction = { fields: [], damageRows: [], unmapped: [] };
const EMPTY_PLAN: SiteNotesPlan = { fills: [], conflicts: [], damageRows: [], unmapped: [] };

/** One text call on the surveyor's own key (~2K tokens). Throws if every provider fails. */
export async function readSiteNotes(claim: ClaimData): Promise<SiteNotesRead> {
  const notes = (claim.siteNotes ?? '').trim();
  if (!notes) return { claimId: claim.id, extraction: EMPTY_EXTRACTION, plan: EMPTY_PLAN };
  const prompt = buildSiteNotesPrompt(notes, siteNoteFields(claim.surveyType), allowsDamageRows(claim.surveyType));
  const raw = await callAIGateway(prompt, [], 'json', 'text');
  const extraction = parseSiteNotesExtraction(raw);
  return { claimId: claim.id, extraction, plan: planSiteNotes(claim, extraction) };
}
