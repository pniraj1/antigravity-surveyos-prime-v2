import { describe, it, expect } from 'vitest';
import { create } from 'zustand';
import { createClaimSlice, type ClaimSlice } from '../claimSlice';
import { createBlankClaim } from '@/types';
import { DEFAULT_DOCUMENT_ANNEXURE_OPTIONS } from '@/lib/photos/document-annexure';
import type { PhotoItem, AssessmentRow } from '@/types/assessment';

/**
 * A fresh, isolated instance of the claim slice per test — never the shared
 * `useClaimStore` singleton, so tests can't leak state into each other.
 * `replacePhotoImage` and `updateDocumentAnnexure` never touch useUIStore /
 * useAuthStore / IndexedDB, so seeding state via `setState` directly (rather
 * than through `loadClaim`/`newClaim`) keeps this test free of those
 * side-effecting dependencies.
 */
function makeStore() {
  return create<ClaimSlice>()(createClaimSlice);
}

const photo = (name: string, kind: PhotoItem['kind']): PhotoItem => ({
  dataUrl: `data:image/jpeg;base64,${name}`,
  name,
  w: 100,
  h: 200,
  kind,
});

describe('replacePhotoImage', () => {
  it('on a mixed damage/document array, replaces only the targeted entry', () => {
    const store = makeStore();
    const original = [
      photo('d1', 'damage'),
      photo('doc1', 'document'),
      photo('d2', 'damage'),
      photo('doc2', 'document'), // the second document — index 3
    ];
    store.setState({ currentClaim: { ...createBlankClaim(), photos: original } });

    store.getState().replacePhotoImage(3, 'data:image/jpeg;base64,rotated', 200, 150);

    const photos = store.getState().currentClaim!.photos;
    expect(photos[3]).toEqual({
      ...original[3],
      dataUrl: 'data:image/jpeg;base64,rotated',
      w: 200,
      h: 150,
    });
    // Every other entry keeps its original dataUrl, w, h and kind.
    expect(photos[0]).toEqual(original[0]);
    expect(photos[1]).toEqual(original[1]);
    expect(photos[2]).toEqual(original[2]);
  });

  it('is a no-op for an out-of-range index', () => {
    const store = makeStore();
    const original = [photo('d1', 'damage'), photo('doc1', 'document')];
    store.setState({ currentClaim: { ...createBlankClaim(), photos: original } });

    store.getState().replacePhotoImage(5, 'data:image/jpeg;base64,new', 1, 1);

    expect(store.getState().currentClaim!.photos).toEqual(original);
  });
});

describe('updateDocumentAnnexure', () => {
  it('on a claim with no documentAnnexure, produces a complete options object', () => {
    const store = makeStore();
    const claim = { ...createBlankClaim(), documentAnnexure: undefined };
    expect(claim.documentAnnexure).toBeUndefined();
    store.setState({ currentClaim: claim });

    store.getState().updateDocumentAnnexure({ verified: true });

    expect(store.getState().currentClaim!.documentAnnexure).toEqual({
      ...DEFAULT_DOCUMENT_ANNEXURE_OPTIONS,
      verified: true,
    });
  });
});

describe('policy check ↔ depreciation sync', () => {
  const seeded = () => {
    const store = makeStore();
    store.setState({ currentClaim: createBlankClaim('final') });
    return store;
  };

  it('setPolicyCheck({ nilDep: "yes" }) sets depreciationType to nil and merges', () => {
    const store = seeded();
    store.getState().setPolicyCheck({ imt23: 'na' });
    store.getState().setPolicyCheck({ nilDep: 'yes' });
    const c = store.getState().currentClaim!;
    expect(c.depreciationType).toBe('nil');
    expect(c.policyCheck).toEqual({ imt23: 'na', nilDep: 'yes' });
    expect(store.getState().isDirty).toBe(true);
  });

  it('setPolicyCheck without nilDep leaves depreciationType alone', () => {
    const store = seeded();
    store.getState().setDepreciationType('nil');
    store.getState().setPolicyCheck({ consumables: 'yes' });
    expect(store.getState().currentClaim!.depreciationType).toBe('nil');
  });

  it('setDepreciationType sets policyCheck.nilDep', () => {
    const store = seeded();
    store.getState().setDepreciationType('standard');
    expect(store.getState().currentClaim!.policyCheck?.nilDep).toBe('no');
    store.getState().setDepreciationType('nil');
    expect(store.getState().currentClaim!.policyCheck?.nilDep).toBe('yes');
  });

  it('keeps the AI read when answers change', () => {
    const store = seeded();
    store.setState({ currentClaim: { ...createBlankClaim('final'), policyCheck: { aiRead: { nilDep: 'yes' } } } });
    store.getState().setPolicyCheck({ nilDep: 'no' });
    expect(store.getState().currentClaim!.policyCheck).toEqual({ nilDep: 'no', aiRead: { nilDep: 'yes' } });
  });
});

describe('setBillCheckUpload', () => {
  const row = (over: Partial<AssessmentRow> = {}): AssessmentRow =>
    ({ id: 'r1', particulars: 'Door', allowed: true, estimated: 1000, gst: 18, assessed: 900, ...over }) as AssessmentRow;
  const seed = (rows: AssessmentRow[]) => {
    const store = makeStore();
    store.setState({
      currentClaim: {
        ...createBlankClaim(),
        assessmentRows: rows,
        extractedData: { estimate: { bill_number: 'B-7' } },
        extraBillItems: [{ id: 'x' } as never],
        billCheck: { billNo: '', billDate: '', billTotal: 0, estimateHeads: { metal: 1 } as never },
      },
    });
    return store;
  };

  it("'estimate' self-bills allowed rows and fills the bill no.", () => {
    const store = seed([row({ estimateAmount: 5 })]);
    store.getState().setBillCheckUpload('estimate');
    const c = store.getState().currentClaim!;
    expect(c.billCheck.baseDocument).toBe('final-bill');
    expect(c.assessmentRows[0]).toMatchObject({ billedAmount: 1180, billStatus: 'in-bill' });
    expect(c.billCheck.billNo).toBe('B-7');
    expect(c.extraBillItems).toEqual([]);
    expect(c.assessmentRows[0].estimateAmount).toBeUndefined();
    expect(c.billCheck.estimateHeads).toBeUndefined();
  });

  it("'final-bill' after from-bill clears the self-billed figures and refs", () => {
    const store = seed([row({ refSrNo: 3 })]);
    store.getState().setBillCheckUpload('estimate');
    store.getState().setBillCheckUpload('final-bill');
    const c = store.getState().currentClaim!;
    expect(c.billCheck.baseDocument).toBe('estimate');
    expect(c.assessmentRows[0].billStatus).toBe('pending');
    expect(c.assessmentRows[0].billedAmount).toBeUndefined();
    expect(c.assessmentRows[0].refSrNo).toBeUndefined();
  });

  it("'final-bill' on a normal claim leaves rows untouched but still clears extras", () => {
    const r = row({ billedAmount: 77, billStatus: 'in-bill', refSrNo: 2, estimateAmount: 9 });
    const store = seed([r]);
    store.getState().setBillCheckUpload('final-bill');
    const c = store.getState().currentClaim!;
    expect(c.assessmentRows[0]).toMatchObject({ billedAmount: 77, billStatus: 'in-bill', refSrNo: 2 });
    expect(c.assessmentRows[0].estimateAmount).toBeUndefined();
    expect(c.extraBillItems).toEqual([]);
    expect(c.billCheck.estimateHeads).toBeUndefined();
  });

  it("'estimate' on a normal claim clears refs from the real bill", () => {
    const store = seed([row({ refSrNo: '12', refStatus: 'clean', refMatch: {} as never })]);
    store.getState().setBillCheckUpload('estimate');
    const r0 = store.getState().currentClaim!.assessmentRows[0];
    expect([r0.refSrNo, r0.refStatus, r0.refMatch]).toEqual([undefined, undefined, undefined]);
  });

  it("'estimate' on a normal claim un-verifies the estimate's header (I5)", () => {
    const store = seed([row()]);
    store.getState().updateBillCheck({ verifiedBySurveyor: true });
    store.getState().setBillCheckUpload('estimate');
    expect(store.getState().currentClaim!.billCheck.verifiedBySurveyor).toBe(false);
  });

  it("'estimate' with copyHeader false leaves the bill header blank (F1)", () => {
    const store = seed([row()]);
    store.setState({ currentClaim: { ...store.getState().currentClaim!, extractedData: { estimate: { bill_number: 'B-7', estimate_date: '01/01/2026', gross_amount: 99999 } } } });
    store.getState().setBillCheckUpload('estimate', { copyHeader: false });
    const bc = store.getState().currentClaim!.billCheck;
    expect([bc.billNo, bc.billDate, bc.billTotal]).toEqual(['', '', 0]);
    expect(bc.baseDocument).toBe('final-bill');
  });

  it("'estimate' by default still copies the estimate header (F1)", () => {
    const store = seed([row()]);
    store.setState({ currentClaim: { ...store.getState().currentClaim!, extractedData: { estimate: { bill_number: 'B-7', gross_amount: 99999 } } } });
    store.getState().setBillCheckUpload('estimate');
    expect(store.getState().currentClaim!.billCheck.billTotal).toBe(99999);
  });

  it("'estimate' again on a from-bill claim keeps its refs", () => {
    const store = seed([row({ refSrNo: '7' })]);
    store.getState().updateBillCheck({ baseDocument: 'final-bill' });
    store.getState().setBillCheckUpload('estimate');
    expect(store.getState().currentClaim!.assessmentRows[0].refSrNo).toBe('7');
  });
});

describe('updateClaim', () => {
  // Phone notes (applyNotes) send whole sections; spotDetails was silently dropped (83753194).
  it('keeps a spotDetails section passed in, like every other section', () => {
    const store = makeStore();
    const blank = createBlankClaim();
    store.setState({ currentClaim: blank });
    store.getState().updateClaim({
      spotDetails: { ...blank.spotDetails, comments: 'Hit divider', repairWorkshop: 'Shree Motors', loadOrigin: 'Pune', enclosures: 'RC, DL' },
    });
    const sd = store.getState().currentClaim!.spotDetails;
    expect(sd).toMatchObject({ comments: 'Hit divider', repairWorkshop: 'Shree Motors', loadOrigin: 'Pune', enclosures: 'RC, DL' });
  });
});
