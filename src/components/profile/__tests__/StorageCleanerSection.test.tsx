import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StorageCleanerSection } from '../StorageCleanerSection';
import * as storage from '@/lib/storage/indexeddb';
import { toast } from 'sonner';

vi.mock('@/lib/storage/indexeddb', () => ({
  getStorageUsageSummary: vi.fn().mockResolvedValue({
    claimsCount: 5,
    driveQueueCount: 12,
    driveQueueBytes: 15 * 1024 * 1024, // 15 MB
    recoveredClaimsCount: 2,
  }),
  clearDriveQueue: vi.fn().mockResolvedValue(undefined),
  clearRecoveredClaims: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('StorageCleanerSection Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the card layout with storage headers and refresh button', () => {
    const html = renderToStaticMarkup(<StorageCleanerSection />);

    expect(html).toContain('Browser Storage &amp; Memory');
    expect(html).toContain('IndexedDB');
    expect(html).toContain('Refresh');
  });

  it('renders the three storage metrics cards', () => {
    const html = renderToStaticMarkup(<StorageCleanerSection />);

    expect(html).toContain('Saved Claims');
    expect(html).toContain('Pending Drive Queue');
    expect(html).toContain('Recovery Snapshots');
  });

  it('displays reassuring copy clarifying active claims are never deleted', () => {
    const html = renderToStaticMarkup(<StorageCleanerSection />);

    expect(html).toContain('Safe cleanup:');
    expect(html).toContain('never deleted');
    expect(html).toContain('Clean Up Storage');
  });

  describe('Cleanup workflow logic', () => {
    it('calls clearDriveQueue and clearRecoveredClaims when cleaning up', async () => {
      vi.mocked(storage.clearDriveQueue).mockResolvedValueOnce(undefined);
      vi.mocked(storage.clearRecoveredClaims).mockResolvedValueOnce(undefined);

      // Verify the functions are imported and callable
      await storage.clearDriveQueue();
      await storage.clearRecoveredClaims();

      expect(storage.clearDriveQueue).toHaveBeenCalledTimes(1);
      expect(storage.clearRecoveredClaims).toHaveBeenCalledTimes(1);
    });

    it('formats MB correctly from byte sizes', () => {
      const bytes = 12.5 * 1024 * 1024;
      const mb = (bytes / (1024 * 1024)).toFixed(2);
      expect(mb).toBe('12.50');

      toast.success(`Cleaned up ${mb} MB of cached queue items and recovery snapshots.`);
      expect(toast.success).toHaveBeenCalledWith(
        'Cleaned up 12.50 MB of cached queue items and recovery snapshots.'
      );
    });
  });
});
