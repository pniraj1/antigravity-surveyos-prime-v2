import { describe, it, expect } from 'vitest';
import { createBlankClaim } from '@/types/claim';
import { buildUIICFinalHTML, buildUIICBillCheckHTML } from '../uiic-final-builder';

// word-export.ts rewrites this exact string into a break Word honours. If a builder changes it,
// the Word page breaks silently stop working, so fail here instead.
const BREAK = '<div style="page-break-before:always;"></div>';

describe('Word page-break drift', () => {
  const claim = createBlankClaim('final');
  it.each([
    ['UIIC final', () => buildUIICFinalHTML(claim, null)],
    ['UIIC bill check', () => buildUIICBillCheckHTML(claim, null)],
  ])('%s still emits the page break word-export rewrites', (_name, build) => {
    expect(build()).toContain(BREAK);
  });
});
