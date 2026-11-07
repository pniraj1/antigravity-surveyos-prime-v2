import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetCountFromServer = vi.fn();
const mockCollection = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  getCountFromServer: (...args: unknown[]) => mockGetCountFromServer(...args),
}));

vi.mock('@/lib/firebase/config', () => ({
  db: { _type: 'mock-db' },
}));

import { getSurveyorClaimCount } from '../claims-count';

describe('getSurveyorClaimCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 0 when uid is empty or whitespace', async () => {
    expect(await getSurveyorClaimCount('')).toBe(0);
    expect(await getSurveyorClaimCount('   ')).toBe(0);
    expect(mockGetCountFromServer).not.toHaveBeenCalled();
  });

  it('fetches count successfully using getCountFromServer', async () => {
    mockCollection.mockReturnValue({ path: 'users/test-uid-123/claims' });
    mockGetCountFromServer.mockResolvedValue({
      data: () => ({ count: 5 }),
    });

    const count = await getSurveyorClaimCount('test-uid-123');
    expect(count).toBe(5);
    expect(mockCollection).toHaveBeenCalledWith({ _type: 'mock-db' }, 'users', 'test-uid-123', 'claims');
  });

  it('handles 0 claims count accurately', async () => {
    mockCollection.mockReturnValue({ path: 'users/test-uid-zero/claims' });
    mockGetCountFromServer.mockResolvedValue({
      data: () => ({ count: 0 }),
    });

    const count = await getSurveyorClaimCount('test-uid-zero');
    expect(count).toBe(0);
  });

  it('propagates errors if Firestore rejects the query', async () => {
    mockGetCountFromServer.mockRejectedValue(new Error('Permission denied'));

    await expect(getSurveyorClaimCount('bad-uid')).rejects.toThrow('Permission denied');
  });
});
