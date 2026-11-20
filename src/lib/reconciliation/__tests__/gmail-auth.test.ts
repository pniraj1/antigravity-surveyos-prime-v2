import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getStoredGmailToken,
  setStoredGmailToken,
  clearGmailToken,
  getStoredGmailEmail,
  requestGmailToken,
  GMAIL_TOKEN_KEY,
  GMAIL_EXPIRY_KEY,
  GMAIL_EMAIL_KEY,
} from '../gmail-auth';

// Mock localStorage in Node test environment
const mockStorageData = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => mockStorageData.get(key) ?? null,
  setItem: (key: string, value: string) => { mockStorageData.set(key, String(value)); },
  removeItem: (key: string) => { mockStorageData.delete(key); },
  clear: () => { mockStorageData.clear(); },
  get length() { return mockStorageData.size; },
  key: (i: number) => Array.from(mockStorageData.keys())[i] ?? null,
};

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
    configurable: true,
    writable: true,
  });
}

describe('Gmail Auth Module', () => {
  const originalEnv = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID;
  const originalGoogle = (globalThis as any).google;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID = originalEnv;
    (globalThis as any).google = originalGoogle;
    localStorage.clear();
  });

  describe('Token storage helpers', () => {
    it('returns null when no token is in localStorage', () => {
      expect(getStoredGmailToken()).toBeNull();
    });

    it('returns token when token is stored and not expired', () => {
      setStoredGmailToken('valid-gmail-token', 3600);
      expect(getStoredGmailToken()).toBe('valid-gmail-token');
    });

    it('returns null and cleans up when token is expired', () => {
      localStorage.setItem(GMAIL_TOKEN_KEY, 'expired-token');
      localStorage.setItem(GMAIL_EXPIRY_KEY, String(Date.now() - 1000));

      expect(getStoredGmailToken()).toBeNull();
      expect(localStorage.getItem(GMAIL_TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(GMAIL_EXPIRY_KEY)).toBeNull();
    });

    it('clears token, expiry, and email on clearGmailToken', () => {
      localStorage.setItem(GMAIL_TOKEN_KEY, 'some-token');
      localStorage.setItem(GMAIL_EXPIRY_KEY, String(Date.now() + 100000));
      localStorage.setItem(GMAIL_EMAIL_KEY, 'surveyor@example.com');

      clearGmailToken();

      expect(localStorage.getItem(GMAIL_TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(GMAIL_EXPIRY_KEY)).toBeNull();
      expect(localStorage.getItem(GMAIL_EMAIL_KEY)).toBeNull();
    });

    it('retrieves stored email', () => {
      localStorage.setItem(GMAIL_EMAIL_KEY, 'surveyor@example.com');
      expect(getStoredGmailEmail()).toBe('surveyor@example.com');
    });
  });

  describe('requestGmailToken', () => {
    it('rejects if Google Identity Services is not loaded', async () => {
      delete (globalThis as any).google;
      await expect(requestGmailToken()).rejects.toThrow(/Google Identity Services not loaded/i);
    });

    it('rejects if Client ID is not configured', async () => {
      process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID = '';
      (globalThis as any).google = {
        accounts: {
          oauth2: {
            initTokenClient: vi.fn(),
          },
        },
      };

      await expect(requestGmailToken()).rejects.toThrow(/Google Client ID is not configured/i);
    });

    it('initializes tokenClient with gmail.readonly scope and resolves on success', async () => {
      let initOptions: any = null;
      const mockRequestAccessToken = vi.fn().mockImplementation(() => {
        // Trigger callback with success
        initOptions.callback({
          access_token: 'new-gmail-access-token',
          expires_in: 3600,
        });
      });

      (globalThis as any).google = {
        accounts: {
          oauth2: {
            initTokenClient: vi.fn().mockImplementation((opts) => {
              initOptions = opts;
              return { requestAccessToken: mockRequestAccessToken };
            }),
          },
        },
      };

      const token = await requestGmailToken();

      expect(token).toBe('new-gmail-access-token');
      expect(initOptions.scope).toContain('https://www.googleapis.com/auth/gmail.readonly');
      expect(initOptions.client_id).toBe('test-client-id.apps.googleusercontent.com');
      expect(getStoredGmailToken()).toBe('new-gmail-access-token');
    });

    it('handles popup_closed error in error_callback', async () => {
      let initOptions: any = null;
      const mockRequestAccessToken = vi.fn().mockImplementation(() => {
        initOptions.error_callback({ type: 'popup_closed' });
      });

      (globalThis as any).google = {
        accounts: {
          oauth2: {
            initTokenClient: vi.fn().mockImplementation((opts) => {
              initOptions = opts;
              return { requestAccessToken: mockRequestAccessToken };
            }),
          },
        },
      };

      await expect(requestGmailToken()).rejects.toThrow(/Google sign-in was closed/i);
    });

    it('handles access_denied in response callback', async () => {
      let initOptions: any = null;
      const mockRequestAccessToken = vi.fn().mockImplementation(() => {
        initOptions.callback({
          error: 'access_denied',
          error_description: 'User denied access to Gmail',
        });
      });

      (globalThis as any).google = {
        accounts: {
          oauth2: {
            initTokenClient: vi.fn().mockImplementation((opts) => {
              initOptions = opts;
              return { requestAccessToken: mockRequestAccessToken };
            }),
          },
        },
      };

      await expect(requestGmailToken()).rejects.toThrow(/User denied access to Gmail/i);
      expect(getStoredGmailToken()).toBeNull();
    });
  });
});
