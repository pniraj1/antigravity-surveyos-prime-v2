import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUIStore } from '@/stores/ui-store';
import { useSaveToCloudPrompt } from '@/hooks/useSaveToCloudPrompt';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const overrides = {
    useCallback: <T,>(fn: T) => fn,
    useState: <T,>(init: T) => [typeof init === 'function' ? (init as () => T)() : init, vi.fn()],
  };
  return { ...actual, ...overrides, default: { ...actual, ...overrides } };
});

let mockDriveToken: string | null = null;
vi.mock('@/lib/drive', () => ({
  getDriveToken: () => mockDriveToken,
}));

function renderHook<T>(hook: () => T) {
  return { result: { current: hook() } };
}

describe('useSaveToCloudPrompt', () => {
  beforeEach(() => {
    mockDriveToken = null;
    useUIStore.setState({ isDriveConnected: false });
  });

  it('automatically resolves true without modal when Google Drive is connected in UI store', async () => {
    useUIStore.setState({ isDriveConnected: true });
    const { result } = renderHook(() => useSaveToCloudPrompt());

    const ok = await Promise.race([
      result.current.confirmSaveToCloud('photo_01.jpg', 'claim-123'),
      new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('Hung waiting for modal dialog')), 100)),
    ]);
    expect(ok).toBe(true);
    expect(result.current.saveToCloudDialog).toBeNull();
  });

  it('automatically resolves true without modal when Google Drive token exists', async () => {
    useUIStore.setState({ isDriveConnected: false });
    mockDriveToken = 'mock-oauth-token';
    const { result } = renderHook(() => useSaveToCloudPrompt());

    const ok = await Promise.race([
      result.current.confirmSaveToCloud('photo_01.jpg', 'claim-123'),
      new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('Hung waiting for modal dialog')), 100)),
    ]);
    expect(ok).toBe(true);
    expect(result.current.saveToCloudDialog).toBeNull();
  });

  it('automatically resolves false without modal when Google Drive is not connected', async () => {
    useUIStore.setState({ isDriveConnected: false });
    mockDriveToken = null;
    const { result } = renderHook(() => useSaveToCloudPrompt());

    const ok = await Promise.race([
      result.current.confirmSaveToCloud('photo_01.jpg', 'claim-123'),
      new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('Hung waiting for modal dialog')), 100)),
    ]);
    expect(ok).toBe(false);
    expect(result.current.saveToCloudDialog).toBeNull();
  });
});
