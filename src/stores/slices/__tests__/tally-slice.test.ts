import { describe, it, expect, beforeEach } from 'vitest';
import { useClaimStore } from '@/stores/claim-store';
import type { AssessmentRow, ClaimData } from '@/types';

const makeRow = (id: string, allowed: boolean, billedTaxable?: number, billedAmount?: number): AssessmentRow => ({
  id,
  particulars: `Item ${id}`,
  estimated: 1000,
  assessed: allowed ? 1000 : 0,
  partType: 'plastic',
  gst: 18,
  section: 'parts',
  allowed,
  billedTaxable,
  billedAmount,
  billStatus: billedTaxable !== undefined ? 'in-bill' : undefined,
});

describe('tallySlice', () => {
  beforeEach(() => {
    useClaimStore.setState({
      currentClaim: {
        id: 'c1',
        assessmentRows: [],
        extraBillItems: [],
      } as unknown as ClaimData,
    });
  });

  describe('activeTallyStage and wizard state', () => {
    it('defaults to grid and wizard closed', () => {
      expect(useClaimStore.getState().activeTallyStage).toBe('grid');
      expect(useClaimStore.getState().isReconcileWizardOpen).toBe(false);
    });

    it('toggles wizard open state', () => {
      useClaimStore.getState().setReconcileWizardOpen(true);
      expect(useClaimStore.getState().isReconcileWizardOpen).toBe(true);

      useClaimStore.getState().setReconcileWizardOpen(false);
      expect(useClaimStore.getState().isReconcileWizardOpen).toBe(false);
    });

    it('updates active tally stage to 1, 2, 3, 4, or grid', () => {
      const store = useClaimStore.getState();

      store.setTallyStage(2);
      expect(useClaimStore.getState().activeTallyStage).toBe(2);

      store.setTallyStage(3);
      expect(useClaimStore.getState().activeTallyStage).toBe(3);

      store.setTallyStage(4);
      expect(useClaimStore.getState().activeTallyStage).toBe(4);

      store.setTallyStage('grid');
      expect(useClaimStore.getState().activeTallyStage).toBe('grid');

      store.setTallyStage(1);
      expect(useClaimStore.getState().activeTallyStage).toBe(1);
    });
  });

  describe('markRemainingAllowedAsNotInBill', () => {
    it('marks allowed rows without billedTaxable as not-in-bill with 0 amounts', () => {
      const rows: AssessmentRow[] = [
        makeRow('r1', true, undefined), // allowed, unbilled -> should be marked
        makeRow('r2', true, 1200, 1416), // allowed, already billed -> unchanged
        makeRow('r3', false, undefined), // disallowed -> unchanged
      ];

      useClaimStore.setState({
        currentClaim: {
          id: 'c1',
          assessmentRows: rows,
          extraBillItems: [],
        } as unknown as ClaimData,
      });

      useClaimStore.getState().markRemainingAllowedAsNotInBill();

      const updatedRows = useClaimStore.getState().currentClaim?.assessmentRows!;
      expect(updatedRows).toHaveLength(3);

      // r1: allowed, was undefined -> now not-in-bill, 0, 0
      expect(updatedRows[0].id).toBe('r1');
      expect(updatedRows[0].billStatus).toBe('not-in-bill');
      expect(updatedRows[0].billedTaxable).toBe(0);
      expect(updatedRows[0].billedAmount).toBe(0);

      // r2: allowed, already billed -> preserved
      expect(updatedRows[1].id).toBe('r2');
      expect(updatedRows[1].billStatus).toBe('in-bill');
      expect(updatedRows[1].billedTaxable).toBe(1200);
      expect(updatedRows[1].billedAmount).toBe(1416);

      // r3: disallowed -> preserved
      expect(updatedRows[2].id).toBe('r3');
      expect(updatedRows[2].billStatus).toBeUndefined();
      expect(updatedRows[2].billedTaxable).toBeUndefined();
    });

    it('safely handles null currentClaim', () => {
      useClaimStore.setState({ currentClaim: null });
      expect(() => {
        useClaimStore.getState().markRemainingAllowedAsNotInBill();
      }).not.toThrow();
    });
  });
});
