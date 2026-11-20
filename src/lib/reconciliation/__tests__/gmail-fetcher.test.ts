import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildGmailSearchQuery,
  listGmailMessageIds,
  fetchPaymentEmailDetailsById,
  fetchRecentPaymentEmails,
  fetchGmailAttachmentBlob,
  decodeBase64UrlToString,
  base64UrlToUint8Array,
  PAYMENT_SUBJECT_KEYWORDS,
} from '../gmail-fetcher';
import type { InsurerSenderConfig } from '@/types/payment-reconciliation';

describe('Gmail Scoped Fetcher', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('buildGmailSearchQuery', () => {
    it('builds query with multiple senders and payment subject keywords', () => {
      const senders: InsurerSenderConfig[] = [
        { email: 'payments@newindia.co.in', insurerName: 'New India' },
        { email: 'disbursements@uiic.co.in', insurerName: 'United India' },
      ];

      const query = buildGmailSearchQuery(senders);

      expect(query).toContain('from:(payments@newindia.co.in OR disbursements@uiic.co.in)');
      expect(query).toContain(PAYMENT_SUBJECT_KEYWORDS);
      expect(query).not.toContain('newer_than:');
    });

    it('adds newer_than filter when daysBack is provided', () => {
      const senders: InsurerSenderConfig[] = [
        { email: 'surveyor.payment@nic.co.in', insurerName: 'National Insurance' },
      ];

      const query = buildGmailSearchQuery(senders, 60);

      expect(query).toContain('from:(surveyor.payment@nic.co.in)');
      expect(query).toContain(PAYMENT_SUBJECT_KEYWORDS);
      expect(query).toContain('newer_than:60d');
    });

    it('provides a safe fallback querying standard insurer keywords when senders list is empty', () => {
      const query = buildGmailSearchQuery([]);

      expect(query).not.toContain('from:()');
      expect(query).toContain(PAYMENT_SUBJECT_KEYWORDS);
      expect(query).toMatch(/insurance|insurer|surveyor/i);
    });

    it('handles senders with empty or whitespace-only emails as fallback', () => {
      const senders: InsurerSenderConfig[] = [
        { email: '   ', insurerName: 'Empty' },
        { email: '', insurerName: 'Blank' },
      ];

      const query = buildGmailSearchQuery(senders, 30);

      expect(query).not.toContain('from:()');
      expect(query).toContain(PAYMENT_SUBJECT_KEYWORDS);
      expect(query).toContain('newer_than:30d');
    });

    it('correctly formats newer_than with different daysBack values (15, 30, 60, 90)', () => {
      const senders: InsurerSenderConfig[] = [
        { email: 'claims@hdfcergo.com', insurerName: 'HDFC Ergo' },
      ];

      expect(buildGmailSearchQuery(senders, 15)).toContain('newer_than:15d');
      expect(buildGmailSearchQuery(senders, 30)).toContain('newer_than:30d');
      expect(buildGmailSearchQuery(senders, 60)).toContain('newer_than:60d');
      expect(buildGmailSearchQuery(senders, 90)).toContain('newer_than:90d');
    });

    it('omits newer_than filter when daysBack is undefined, 0, or negative', () => {
      const senders: InsurerSenderConfig[] = [
        { email: 'claims@hdfcergo.com', insurerName: 'HDFC Ergo' },
      ];

      expect(buildGmailSearchQuery(senders)).not.toContain('newer_than:');
      expect(buildGmailSearchQuery(senders, 0)).not.toContain('newer_than:');
      expect(buildGmailSearchQuery(senders, -10)).not.toContain('newer_than:');
    });
  });

  describe('decodeBase64UrlToString and base64UrlToUint8Array', () => {
    it('decodes base64url string accurately', () => {
      // "Payment Advice for Claim 310100" in base64url:
      // standard base64: "UGF5bWVudCBBZHZpY2UgZm9yIENsYWltIDMxMDEwMA=="
      // base64url: "UGF5bWVudCBBZHZpY2UgZm9yIENsYWltIDMxMDEwMA"
      const encoded = 'UGF5bWVudCBBZHZpY2UgZm9yIENsYWltIDMxMDEwMA';
      expect(decodeBase64UrlToString(encoded)).toBe('Payment Advice for Claim 310100');
    });

    it('converts base64url into Uint8Array bytes', () => {
      const encoded = 'SGVsbG8gV29ybGQ'; // "Hello World"
      const bytes = base64UrlToUint8Array(encoded);
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(new TextDecoder().decode(bytes)).toBe('Hello World');
    });
  });

  describe('fetchRecentPaymentEmails', () => {
    it('fetches and parses payment email summaries and attachments', async () => {
      const mockListResponse = {
        messages: [{ id: 'msg-001', threadId: 'th-001' }],
      };

      const mockDetailResponse = {
        id: 'msg-001',
        threadId: 'th-001',
        snippet: 'Payment disbursed for claim 31010031240100001234',
        payload: {
          headers: [
            { name: 'From', value: 'payments@newindia.co.in' },
            { name: 'Subject', value: 'Payment Advice - Claim 31010031240100001234' },
            { name: 'Date', value: 'Thu, 19 Nov 2026 10:30:00 +0530' },
          ],
          mimeType: 'multipart/mixed',
          parts: [
            {
              mimeType: 'text/plain',
              body: {
                // "UTR CMS93821019 amount 1800" in base64url
                data: 'VVRSIENNUzkzODIxMDE5IGFtb3VudCAxODAw',
              },
            },
            {
              filename: 'Payment_Advice_310100.pdf',
              mimeType: 'application/pdf',
              body: {
                attachmentId: 'att-999',
                size: 20480,
              },
            },
          ],
        },
      };

      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/messages?')) {
          return new Response(JSON.stringify(mockListResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.includes('/messages/msg-001')) {
          return new Response(JSON.stringify(mockDetailResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('Not found', { status: 404 });
      });

      const summaries = await fetchRecentPaymentEmails('fake-token', 'subject:payment', 5);

      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
      expect(summaries).toHaveLength(1);

      const item = summaries[0];
      expect(item.id).toBe('msg-001');
      expect(item.threadId).toBe('th-001');
      expect(item.from).toBe('payments@newindia.co.in');
      expect(item.subject).toBe('Payment Advice - Claim 31010031240100001234');
      expect(item.date).toBe('Thu, 19 Nov 2026 10:30:00 +0530');
      expect(item.snippet).toContain('Payment disbursed');
      expect(item.bodyText).toBe('UTR CMS93821019 amount 1800');
      expect(item.attachments).toHaveLength(1);
      expect(item.attachments[0]).toEqual({
        attachmentId: 'att-999',
        filename: 'Payment_Advice_310100.pdf',
        mimeType: 'application/pdf',
        size: 20480,
      });
    });

    it('returns empty array when no messages match query', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ messages: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const summaries = await fetchRecentPaymentEmails('fake-token', 'subject:nonexistent');
      expect(summaries).toEqual([]);
    });

    it('throws descriptive error on 401 Unauthorized', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' })
      );

      await expect(
        fetchRecentPaymentEmails('expired-token', 'subject:payment')
      ).rejects.toThrow('Gmail access token expired or invalid');
    });

    it('throws descriptive error on 403 Forbidden with plain response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('Forbidden', { status: 403, statusText: 'Forbidden' })
      );

      await expect(
        fetchRecentPaymentEmails('unscoped-token', 'subject:payment')
      ).rejects.toThrow(/Gmail API permission denied or insufficient scope/);
    });

    it('throws actionable guidance when Gmail API is disabled in Google Cloud Console', async () => {
      const gcpDisabledJson = {
        error: {
          code: 403,
          message: 'Gmail API has not been used in project 123456 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/gmail.googleapis.com/overview then retry.',
          status: 'PERMISSION_DENIED',
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(gcpDisabledJson), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(
        fetchRecentPaymentEmails('valid-token', 'subject:payment')
      ).rejects.toThrow(/Gmail API is disabled in your Google Cloud Console project/i);
    });

    it('handles network failure gracefully with descriptive error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

      await expect(
        fetchRecentPaymentEmails('valid-token', 'subject:payment')
      ).rejects.toThrow(/Gmail network request failed/i);
    });

    it('defaults maxResults to 25 when not explicitly provided', async () => {
      let capturedUrl = '';
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/messages?')) {
          capturedUrl = url;
          return new Response(JSON.stringify({ messages: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('Not found', { status: 404 });
      });

      await fetchRecentPaymentEmails('fake-token', 'subject:payment');
      expect(capturedUrl).toContain('maxResults=25');
    });
  });

  describe('listGmailMessageIds', () => {
    it('fetches matching message references with id and threadId', async () => {
      const mockResponse = {
        messages: [
          { id: 'msg-101', threadId: 'th-101' },
          { id: 'msg-102', threadId: 'th-102' },
        ],
      };

      let capturedUrl = '';
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        capturedUrl = url;
        return new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const result = await listGmailMessageIds('mock-token', 'subject:advice', 25);

      expect(result).toEqual([
        { id: 'msg-101', threadId: 'th-101' },
        { id: 'msg-102', threadId: 'th-102' },
      ]);
      expect(capturedUrl).toContain('q=subject%3Aadvice');
      expect(capturedUrl).toContain('maxResults=25');
    });

    it('defaults maxResults to 25 when not specified', async () => {
      let capturedUrl = '';
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        capturedUrl = url;
        return new Response(JSON.stringify({ messages: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      await listGmailMessageIds('mock-token', 'subject:payment');
      expect(capturedUrl).toContain('maxResults=25');
    });

    it('returns empty array when messages field is empty or missing', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await listGmailMessageIds('mock-token', 'subject:test');
      expect(result).toEqual([]);
    });

    it('throws when accessToken is empty', async () => {
      await expect(listGmailMessageIds('', 'subject:test')).rejects.toThrow(
        'Gmail access token is required'
      );
    });

    it('throws descriptive error on 401 Unauthorized', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' })
      );

      await expect(listGmailMessageIds('expired-token', 'subject:payment')).rejects.toThrow(
        'Gmail access token expired or invalid'
      );
    });

    it('throws descriptive error on 403 Forbidden', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('Forbidden', { status: 403, statusText: 'Forbidden' })
      );

      await expect(listGmailMessageIds('unscoped-token', 'subject:payment')).rejects.toThrow(
        /Gmail API permission denied or insufficient scope/
      );
    });

    it('throws actionable guidance when Gmail API is disabled in GCP', async () => {
      const gcpDisabledJson = {
        error: {
          code: 403,
          message: 'Gmail API has not been used in project 123456 before or it is disabled.',
          status: 'PERMISSION_DENIED',
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(gcpDisabledJson), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(listGmailMessageIds('valid-token', 'subject:payment')).rejects.toThrow(
        /Gmail API is disabled in your Google Cloud Console project/i
      );
    });

    it('handles network failure gracefully', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

      await expect(listGmailMessageIds('valid-token', 'subject:payment')).rejects.toThrow(
        /Gmail network request failed/i
      );
    });
  });

  describe('fetchPaymentEmailDetailsById', () => {
    const mockDetailResponse = {
      id: 'msg-999',
      threadId: 'th-999',
      snippet: 'Payment advice disbursement details',
      payload: {
        headers: [
          { name: 'From', value: 'noreply@icicilombard.com' },
          { name: 'Subject', value: 'Disbursement Advice MOT-98765' },
          { name: 'Date', value: 'Wed, 18 Nov 2026 14:00:00 +0530' },
        ],
        mimeType: 'multipart/mixed',
        parts: [
          {
            mimeType: 'text/plain',
            body: {
              data: 'RmVlIEFtb3VudCAyNTAw', // "Fee Amount 2500" in base64url
            },
          },
          {
            filename: 'Advice_98765.pdf',
            mimeType: 'application/pdf',
            body: {
              attachmentId: 'att-888',
              size: 15420,
            },
          },
        ],
      },
    };

    it('fetches and parses a single email message correctly', async () => {
      let capturedUrl = '';
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        capturedUrl = url;
        return new Response(JSON.stringify(mockDetailResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const result = await fetchPaymentEmailDetailsById('token-123', 'msg-999');

      expect(capturedUrl).toContain('/messages/msg-999?format=full');
      expect(result.id).toBe('msg-999');
      expect(result.threadId).toBe('th-999');
      expect(result.from).toBe('noreply@icicilombard.com');
      expect(result.subject).toBe('Disbursement Advice MOT-98765');
      expect(result.date).toBe('Wed, 18 Nov 2026 14:00:00 +0530');
      expect(result.snippet).toBe('Payment advice disbursement details');
      expect(result.bodyText).toBe('Fee Amount 2500');
      expect(result.attachments).toHaveLength(1);
      expect(result.attachments[0]).toEqual({
        attachmentId: 'att-888',
        filename: 'Advice_98765.pdf',
        mimeType: 'application/pdf',
        size: 15420,
      });
    });

    it('throws when accessToken or messageId is missing', async () => {
      await expect(fetchPaymentEmailDetailsById('', 'msg-1')).rejects.toThrow(
        'Gmail access token is required'
      );
      await expect(fetchPaymentEmailDetailsById('valid-token', '')).rejects.toThrow(
        'Gmail message ID is required'
      );
    });

    it('throws descriptive error on 401 Unauthorized', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' })
      );

      await expect(fetchPaymentEmailDetailsById('expired-token', 'msg-1')).rejects.toThrow(
        'Gmail access token expired or invalid'
      );
    });

    it('throws descriptive error on 403 Forbidden', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('Forbidden', { status: 403, statusText: 'Forbidden' })
      );

      await expect(fetchPaymentEmailDetailsById('unscoped-token', 'msg-1')).rejects.toThrow(
        /Gmail API permission denied or insufficient scope/
      );
    });

    it('handles network failure gracefully', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection reset'));

      await expect(fetchPaymentEmailDetailsById('valid-token', 'msg-1')).rejects.toThrow(
        /Gmail network request failed/i
      );
    });
  });

  describe('fetchGmailAttachmentBlob', () => {
    it('fetches and decodes attachment blob', async () => {
      const textContent = 'PDF Mock Content';
      const mockAttachmentData = {
        size: textContent.length,
        data: Buffer.from(textContent).toString('base64url'),
      };

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockAttachmentData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const blob = await fetchGmailAttachmentBlob('fake-token', 'msg-1', 'att-1');
      expect(blob).not.toBeNull();
      expect(blob).toBeInstanceOf(Blob);

      const text = await blob!.text();
      expect(text).toBe('PDF Mock Content');
    });

    it('returns null if attachment data is missing', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ size: 0 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const blob = await fetchGmailAttachmentBlob('fake-token', 'msg-1', 'att-empty');
      expect(blob).toBeNull();
    });

    it('throws descriptive error on 401 Unauthorized', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' })
      );

      await expect(
        fetchGmailAttachmentBlob('expired-token', 'msg-1', 'att-1')
      ).rejects.toThrow('Gmail access token expired or invalid');
    });

    it('throws descriptive error on 403 Forbidden', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('Forbidden', { status: 403, statusText: 'Forbidden' })
      );

      await expect(
        fetchGmailAttachmentBlob('unscoped-token', 'msg-1', 'att-1')
      ).rejects.toThrow('Gmail API permission denied or insufficient scope');
    });

    it('handles network failure gracefully', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection aborted'));

      await expect(
        fetchGmailAttachmentBlob('valid-token', 'msg-1', 'att-1')
      ).rejects.toThrow(/Gmail network request failed/i);
    });
  });
});
