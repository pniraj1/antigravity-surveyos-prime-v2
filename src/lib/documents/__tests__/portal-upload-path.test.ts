import { describe, it, expect } from 'vitest';
import { createBlankClaim } from '@/types/claim';
import { writePortalUpload } from '../folder';
import { safeFileStem } from '../naming';
import { RECIPES } from '../kit/recipes';

const claim = createBlankClaim();
const blob = new Blob(['x']);
const UNSAFE = /Unsafe name/;

describe('writePortalUpload path safety', () => {
  it.each(['..', '.', 'a/b', 'a\\b', ''])('rejects portalTitle %j', async (bad) => {
    await expect(writePortalUpload(claim, bad, [])).rejects.toThrow(UNSAFE);
  });

  it.each(['..', '.', 'x/../y.pdf', 'a\\b.pdf', ''])('rejects file name %j', async (bad) => {
    await expect(writePortalUpload(claim, 'NIA', [{ name: bad, blob }])).rejects.toThrow(UNSAFE);
  });

  it('every recipe box label gives a file name writePortalUpload accepts', async () => {
    for (const r of RECIPES) {
      for (const b of r.boxes) {
        const err = await writePortalUpload(claim, r.title, [{ name: `${safeFileStem(b.label)}.pdf`, blob }]).then(() => null, (e: unknown) => e);
        expect(String(err), `${r.title} / ${b.label}`).not.toMatch(UNSAFE);
      }
    }
  });

  it('a valid title and name pass validation (then fail later, on the missing folder)', async () => {
    const err = await writePortalUpload(claim, 'NIA Tie-up', [{ name: 'RC Book.pdf', blob }]).then(() => null, (e: unknown) => e);
    // no folder handle in node, so it must fail - but not with the validation error
    expect(err).not.toBeNull();
    expect(String(err)).not.toMatch(UNSAFE);
  });
});
