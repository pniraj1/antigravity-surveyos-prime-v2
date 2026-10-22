import { describe, it, expect } from 'vitest';
import { tagFieldPages } from '../processor';
import { getConflictFields } from '../reconciliation';
import { createBlankClaim } from '@/types/claim';
import type { ClaimData } from '@/types';

describe('tagFieldPages', () => {
  it('tags non-empty scalar values with the real page, and file when not the first', () => {
    const out = tagFieldPages(
      { date_of_accident: '05/08/2026', date_of_accident_context: 'DOL 05/08/2026', driver_name: '', spare_parts: [{ a: 1 }] },
      { file: 1, page: 3 },
    ) as Record<string, unknown>;
    expect(out.date_of_accident_page).toBe(3);
    expect(out.date_of_accident_file).toBe(1);
    expect(out).not.toHaveProperty('driver_name_page');
    expect(out).not.toHaveProperty('date_of_accident_context_page');
    expect(out).not.toHaveProperty('spare_parts_page');
  });

  it('omits the file tag for the first file and passes through without a ref', () => {
    const out = tagFieldPages({ x: 'y' }, { file: 0, page: 2 }) as Record<string, unknown>;
    expect(out).toEqual({ x: 'y', x_page: 2 });
    expect(tagFieldPages({ x: 'y' }, undefined)).toEqual({ x: 'y' });
  });

  it('reaches Reconciliation sources so the viewer can open that page', () => {
    const c = createBlankClaim() as ClaimData;
    const claim = {
      ...c,
      vehicle: { ...c.vehicle, engineNumber: 'AAA' },
      extractedData: { rc: { engine_number: 'BBB', engine_number_page: 2 } },
    } as ClaimData;
    const src = getConflictFields(claim).find((f) => f.path === 'vehicle.engineNumber')!.sources[0];
    expect(src.page).toBe(2);
  });
});
