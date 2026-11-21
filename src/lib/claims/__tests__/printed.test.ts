import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ClaimData } from '@/types/claim';

vi.mock('@/lib/documents/sink', () => ({ saveDocuments: vi.fn().mockResolvedValue([]) }));
vi.mock('@/lib/drive', () => ({ uploadFileToDrive: vi.fn() }));

import { withPrinted, recordPrinted } from '../printed';
import { useClaimStore } from '@/stores/claim-store';
import { saveReportToClaimFolder } from '@/lib/reports/auto-file-report';
import { saveDocuments } from '@/lib/documents/sink';

const claim = (extra: Partial<ClaimData> = {}) => ({ id: 'c1', ...extra }) as ClaimData;

describe('withPrinted', () => {
  it('keeps other kinds and does not mutate the input', () => {
    const input = claim({ printedAt: { feeBill: 'old' } });
    const out = withPrinted(input, 'surveyReport', 'now');
    expect(out.printedAt).toEqual({ feeBill: 'old', surveyReport: 'now' });
    expect(input.printedAt).toEqual({ feeBill: 'old' });
  });
});

describe('recordPrinted', () => {
  beforeEach(() => {
    useClaimStore.setState({ currentClaim: claim() });
  });

  it('ignores a claim that is not the open one', () => {
    recordPrinted('other', 'surveyReport');
    expect(useClaimStore.getState().currentClaim?.printedAt).toBeUndefined();
  });

  it('records on the open claim', () => {
    recordPrinted('c1', 'spotReport');
    expect(useClaimStore.getState().currentClaim?.printedAt?.spotReport).toBeTruthy();
  });
});

describe('saveReportToClaimFolder', () => {
  it('records printedAt even when saveDocuments returns []', async () => {
    useClaimStore.setState({ currentClaim: claim() });
    await saveReportToClaimFolder(claim(), 'f.html', new Blob(['x']), 'surveyReport');
    expect(useClaimStore.getState().currentClaim?.printedAt?.surveyReport).toBeTruthy();
  });

  it('records printedAt even when saveDocuments throws (pins ordering)', async () => {
    vi.mocked(saveDocuments).mockRejectedValueOnce(new Error('boom'));
    useClaimStore.setState({ currentClaim: claim() });
    const ok = await saveReportToClaimFolder(claim(), 'f.html', new Blob(['x']), 'surveyReport');
    expect(ok).toBe(false);
    expect(useClaimStore.getState().currentClaim?.printedAt?.surveyReport).toBeTruthy();
  });

  it('records nothing when the claim has no id', async () => {
    useClaimStore.setState({ currentClaim: claim() });
    await saveReportToClaimFolder({} as ClaimData, 'f.html', new Blob(['x']), 'surveyReport');
    expect(useClaimStore.getState().currentClaim?.printedAt).toBeUndefined();
  });
});
