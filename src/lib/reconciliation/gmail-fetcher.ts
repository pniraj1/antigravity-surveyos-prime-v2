import { InsurerSenderConfig } from '@/types/payment-reconciliation';

export interface GmailAttachmentInfo {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface GmailPaymentMessageSummary {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  bodyText?: string;
  attachments: GmailAttachmentInfo[];
}

export interface GmailMessageHeaderSummary {
  id: string;
  threadId?: string;
}

export const PAYMENT_SUBJECT_KEYWORDS =
  '(subject:payment OR subject:disbursement OR subject:remittance OR subject:fee OR subject:bill OR subject:advice)';

export const DEFAULT_INSURER_KEYWORDS =
  '(insurance OR insurer OR surveyor OR "payment advice")';

/**
 * Parses Google Gmail API error responses to provide actionable diagnostic error messages.
 */
export async function parseGmailErrorResponse(
  response: Response,
  defaultMessage = 'Gmail API permission denied or insufficient scope'
): Promise<string> {
  try {
    const errorJson = await response.json();
    const rawMsg = errorJson?.error?.message;
    if (typeof rawMsg === 'string' && rawMsg.trim().length > 0) {
      const lower = rawMsg.toLowerCase();
      if (lower.includes('disabled') || lower.includes('not been used')) {
        return 'Gmail API is disabled in your Google Cloud Console project. Please enable Gmail API in Google Cloud Console, or use "Paste Email" / "Drop Advice".';
      }
      if (lower.includes('insufficient') || lower.includes('scope')) {
        return 'Gmail API permission denied or insufficient scope. Please re-authenticate to grant Gmail access.';
      }
      return `Gmail API error: ${rawMsg}`;
    }
  } catch {
    /* ignore json parsing failures */
  }
  return defaultMessage;
}

/**
 * Builds targeted Gmail search query for surveyor payment advices.
 * Extracts non-empty sender emails, or falls back to standard insurer keywords.
 */
export function buildGmailSearchQuery(
  senders: InsurerSenderConfig[],
  daysBack?: number
): string {
  const validEmails = (senders || [])
    .map(s => s.email?.trim())
    .filter((e): e is string => Boolean(e && e.length > 0));

  let senderClause: string;
  if (validEmails.length > 0) {
    senderClause = `from:(${validEmails.join(' OR ')})`;
  } else {
    senderClause = DEFAULT_INSURER_KEYWORDS;
  }

  const queryParts = [senderClause, PAYMENT_SUBJECT_KEYWORDS];

  if (typeof daysBack === 'number' && daysBack > 0) {
    queryParts.push(`newer_than:${daysBack}d`);
  }

  return queryParts.join(' ');
}

/**
 * Decodes a base64url-encoded string to UTF-8 text.
 */
export function decodeBase64UrlToString(base64Url: string): string {
  if (!base64Url) return '';
  try {
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }

    if (typeof Buffer !== 'undefined') {
      return Buffer.from(base64, 'base64').toString('utf-8');
    }

    if (typeof atob === 'function') {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    }

    return '';
  } catch {
    return '';
  }
}

/**
 * Converts a base64url-encoded string to a Uint8Array byte buffer.
 */
export function base64UrlToUint8Array(base64Url: string): Uint8Array {
  if (!base64Url) return new Uint8Array(0);
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }

  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(base64, 'base64');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  return new Uint8Array(0);
}

interface GmailMessagePart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: {
    attachmentId?: string;
    size?: number;
    data?: string;
  };
  parts?: GmailMessagePart[];
}

interface GmailMessageResponse {
  id: string;
  threadId: string;
  snippet?: string;
  payload?: GmailMessagePart;
}

function parseGmailMessage(msgData: GmailMessageResponse): GmailPaymentMessageSummary {
  const headers = msgData?.payload?.headers || [];

  const getHeader = (name: string): string => {
    const found = headers.find(h => h.name?.toLowerCase() === name.toLowerCase());
    return found?.value?.trim() || '';
  };

  const from = getHeader('from');
  const subject = getHeader('subject');
  const date = getHeader('date');

  const attachments: GmailAttachmentInfo[] = [];
  let bodyText: string | undefined;

  function traversePart(part?: GmailMessagePart) {
    if (!part) return;

    if (part.filename && part.filename.trim().length > 0 && part.body?.attachmentId) {
      attachments.push({
        attachmentId: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType || 'application/octet-stream',
        size: typeof part.body.size === 'number' ? part.body.size : 0,
      });
    }

    if (!bodyText && part.mimeType === 'text/plain' && part.body?.data) {
      const decoded = decodeBase64UrlToString(part.body.data);
      if (decoded) {
        bodyText = decoded;
      }
    }

    if (Array.isArray(part.parts)) {
      for (const subPart of part.parts) {
        traversePart(subPart);
      }
    }
  }

  if (msgData?.payload) {
    traversePart(msgData.payload);
  }

  if (!bodyText && msgData?.snippet) {
    bodyText = msgData.snippet;
  }

  return {
    id: msgData?.id || '',
    threadId: msgData?.threadId || '',
    subject,
    from,
    date,
    snippet: msgData?.snippet || '',
    ...(bodyText ? { bodyText } : {}),
    attachments,
  };
}

/**
 * Quickly fetches the list of matching Gmail message references (id & threadId)
 * without downloading full message payloads or attachments.
 */
export async function listGmailMessageIds(
  accessToken: string,
  query: string,
  maxResults = 25
): Promise<GmailMessageHeaderSummary[]> {
  if (!accessToken) {
    throw new Error('Gmail access token is required');
  }

  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;

  let listResponse: Response;
  try {
    listResponse = await fetch(listUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error';
    throw new Error(`Gmail network request failed: ${message}`);
  }

  if (listResponse.status === 401) {
    throw new Error('Gmail access token expired or invalid');
  }
  if (listResponse.status === 403) {
    const errorMsg = await parseGmailErrorResponse(listResponse);
    throw new Error(errorMsg);
  }
  if (!listResponse.ok) {
    throw new Error(`Gmail API error: ${listResponse.status} ${listResponse.statusText}`);
  }

  let listData: { messages?: Array<{ id: string; threadId?: string }> };
  try {
    listData = await listResponse.json();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid JSON';
    throw new Error(`Failed to parse Gmail response: ${message}`);
  }

  const messages = listData.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  return messages
    .filter((m): m is { id: string; threadId?: string } => Boolean(m && typeof m.id === 'string' && m.id.length > 0))
    .map((m) => ({
      id: m.id,
      ...(m.threadId ? { threadId: m.threadId } : {}),
    }));
}

/**
 * Fetches and parses a single Gmail message by its ID, including body snippet and attachment info.
 */
export async function fetchPaymentEmailDetailsById(
  accessToken: string,
  messageId: string
): Promise<GmailPaymentMessageSummary> {
  if (!accessToken) {
    throw new Error('Gmail access token is required');
  }
  if (!messageId) {
    throw new Error('Gmail message ID is required');
  }

  const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=full`;
  let msgResponse: Response;
  try {
    msgResponse = await fetch(msgUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error';
    throw new Error(`Gmail network request failed: ${message}`);
  }

  if (msgResponse.status === 401) {
    throw new Error('Gmail access token expired or invalid');
  }
  if (msgResponse.status === 403) {
    const errorMsg = await parseGmailErrorResponse(msgResponse);
    throw new Error(errorMsg);
  }
  if (!msgResponse.ok) {
    throw new Error(`Gmail API error: ${msgResponse.status} ${msgResponse.statusText}`);
  }

  let msgData: GmailMessageResponse;
  try {
    msgData = await msgResponse.json();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid JSON';
    throw new Error(`Failed to parse Gmail message response: ${message}`);
  }

  return parseGmailMessage(msgData);
}

/**
 * Fetches recent payment emails from Gmail API using surveyor's OAuth token.
 */
export async function fetchRecentPaymentEmails(
  accessToken: string,
  query: string,
  maxResults = 25
): Promise<GmailPaymentMessageSummary[]> {
  const messageRefs = await listGmailMessageIds(accessToken, query, maxResults);
  if (messageRefs.length === 0) {
    return [];
  }

  return Promise.all(
    messageRefs.map((msgRef) => fetchPaymentEmailDetailsById(accessToken, msgRef.id))
  );
}

/**
 * Fetches an attachment blob from Gmail for a given message and attachment ID.
 */
export async function fetchGmailAttachmentBlob(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<Blob | null> {
  if (!accessToken) {
    throw new Error('Gmail access token is required');
  }
  if (!messageId || !attachmentId) {
    return null;
  }

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error';
    throw new Error(`Gmail network request failed: ${message}`);
  }

  if (response.status === 401) {
    throw new Error('Gmail access token expired or invalid');
  }
  if (response.status === 403) {
    const errorMsg = await parseGmailErrorResponse(response);
    throw new Error(errorMsg);
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch attachment: ${response.status} ${response.statusText}`);
  }

  const data: { size?: number; data?: string } = await response.json();
  if (!data || !data.data) {
    return null;
  }

  const bytes = base64UrlToUint8Array(data.data);
  return new Blob([bytes as unknown as BlobPart], { type: 'application/octet-stream' });
}
