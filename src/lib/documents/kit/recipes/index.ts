import type { ClaimData } from '@/types/claim';
import { insurerShortForm } from '../../insurers';
import { NIA_KIA } from './nia-kia';
import { NIA_NONTIEUP } from './nia-nontieup';
import type { Recipe } from './types';
import { UIIC_CLAIMSURVEY } from './uiic-claimsurvey';

export type { Recipe, RecipeBox } from './types';

export const RECIPES: Recipe[] = [NIA_NONTIEUP, NIA_KIA, UIIC_CLAIMSURVEY];

/** The recipe for this claim's insurer and portal flow, or null when we have none. */
export function recipeFor(claim: ClaimData): Recipe | null {
  const short = insurerShortForm(claim.policy.insurerName);
  const portal = short === 'NIA' ? 'nia' : short === 'UIIC' ? 'uiic' : null;
  if (!portal) return null;
  const flow = claim.portalFlow ?? (portal === 'nia' ? 'nontieup' : 'claimsurvey');
  return RECIPES.find((r) => r.portal === portal && r.flow === flow) ?? null;
}
