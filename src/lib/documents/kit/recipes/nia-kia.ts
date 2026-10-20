import { NIA_CLAIM_RELATED_DOCS } from './nia-nontieup';
import { single, type Recipe } from './types';

export const NIA_KIA: Recipe = {
  portal: 'nia',
  flow: 'kia',
  title: 'NIA Kia',
  provisional: true,
  boxes: [
    single('rc', 'Registration Certificate', true),
    single('dl', 'Driving License', true),
    single('claimForm', 'Claim Form', true),
    NIA_CLAIM_RELATED_DOCS,
  ],
};
