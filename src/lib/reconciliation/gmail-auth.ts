// ═══════════════════════════════════════════════════════════
// GMAIL OAUTH AUTHENTICATION — Motor SurveyOS V2
// Dedicated Token Client for Scoped Gmail Access (gmail.readonly)
// ═══════════════════════════════════════════════════════════

import { isSandbox } from '@/lib/sandbox';

export const GMAIL_TOKEN_KEY = 'surveyos_gmail_token';
export const GMAIL_EXPIRY_KEY = 'surveyos_gmail_token_expiry';
export const GMAIL_EMAIL_KEY = 'surveyos_gmail_email';

export const GMAIL_REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

/**
 * Stores the Gmail OAuth access token with its expiry in localStorage.
 */
export function setStoredGmailToken(token: string, expiresIn: number): void {
  const expiry = Date.now() + expiresIn * 1000;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(GMAIL_TOKEN_KEY, token);
      localStorage.setItem(GMAIL_EXPIRY_KEY, String(expiry));
    }
  } catch {
    /* storage full or disabled — ignore */
  }
}

/**
 * Clears the stored Gmail token, expiry, and email from localStorage.
 */
export function clearGmailToken(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(GMAIL_TOKEN_KEY);
      localStorage.removeItem(GMAIL_EXPIRY_KEY);
      localStorage.removeItem(GMAIL_EMAIL_KEY);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Retrieves the stored Gmail access token if it exists and has not expired.
 * Automatically clears the stored token if expired.
 */
export function getStoredGmailToken(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const token = localStorage.getItem(GMAIL_TOKEN_KEY);
    const expiry = Number(localStorage.getItem(GMAIL_EXPIRY_KEY) || 0);

    if (token && Date.now() < expiry) {
      return token;
    }

    if (token) {
      clearGmailToken();
    }
  } catch {
    /* localStorage unavailable */
  }
  return null;
}

/**
 * Retrieves the email address associated with the Gmail connection.
 */
export function getStoredGmailEmail(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(GMAIL_EMAIL_KEY);
  } catch {
    return null;
  }
}

/**
 * Returns whether there is an active, unexpired Gmail token.
 */
export function isGmailConnected(): boolean {
  return Boolean(getStoredGmailToken());
}

/**
 * Initiates the Google Identity Services OAuth popup specifically requesting
 * the `gmail.readonly` scope. Decoupled from Google Drive tokens.
 */
export function requestGmailToken(): Promise<string> {
  if (isSandbox()) {
    setStoredGmailToken('sandbox-gmail-token', 3600);
    return Promise.resolve('sandbox-gmail-token');
  }

  return new Promise((resolve, reject) => {
    // Check if Google Identity Services is available
    const g = typeof window !== 'undefined' ? (window as any).google : (globalThis as any).google;
    if (!g || !g.accounts?.oauth2) {
      return reject(
        new Error('Google Identity Services not loaded. Please wait a moment and try again.')
      );
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID;
    if (!clientId?.trim()) {
      return reject(
        new Error('Google Client ID is not configured. Please contact support or check configuration.')
      );
    }

    try {
      const tokenClient = g.accounts.oauth2.initTokenClient({
        client_id: clientId.trim(),
        scope: GMAIL_REQUIRED_SCOPES,
        error_callback: (err: { type?: string }) => {
          reject(
            new Error(
              err?.type === 'popup_closed'
                ? 'Google sign-in was closed.'
                : err?.type === 'popup_failed_to_open'
                ? 'Google sign-in popup was blocked. Allow popups and try again.'
                : 'Google sign-in did not complete.'
            )
          );
        },
        callback: async (response: any) => {
          if (response.error) {
            clearGmailToken();
            return reject(
              new Error(
                response.error_description ||
                (response.error === 'access_denied'
                  ? 'Access to Gmail was denied. Please grant read permission to check remittance emails.'
                  : response.error)
              )
            );
          }

          const token = response.access_token;
          const expiresIn = response.expires_in ?? 3500;
          setStoredGmailToken(token, expiresIn);

          // Fetch the user's email address
          try {
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const info = await res.json();
              if (info?.email && typeof localStorage !== 'undefined') {
                localStorage.setItem(GMAIL_EMAIL_KEY, info.email);
              }
            }
          } catch {
            /* ignore optional userinfo failure */
          }

          resolve(token);
        },
      });

      tokenClient.requestAccessToken({ prompt: '' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to launch Google auth';
      reject(new Error(msg));
    }
  });
}
