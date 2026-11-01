import type { DocType } from '@/types/documents';

// Port of Scan's chase/AskMessage.kt. The copy strings below are checked verbatim by Scan's
// AskTemplatesTest (drift test): change them only together with Scan.
export type AskLang = 'en' | 'hi' | 'mr';
export type ContactRole = 'insured' | 'garage' | 'other';

// %V = vehicle, %I = insurer, %R = reason. Owner reviews HI and MR copy before release.
export const ASK_COPY = {
  en: { hello: 'Namaste', intro: 'For claim %V (%I), please send:', thanks: 'Thank you,', reminder: 'Reminder: ', rejected: ' — please resend (%R)' },
  hi: { hello: 'नमस्ते', intro: 'क्लेम %V (%I) के लिए कृपया ये दस्तावेज़ भेजें:', thanks: 'धन्यवाद,', reminder: 'स्मरण: ', rejected: ' — कृपया दोबारा भेजें (%R)' },
  mr: { hello: 'नमस्कार', intro: 'क्लेम %V (%I) साठी कृपया खालील कागदपत्रे पाठवा:', thanks: 'धन्यवाद,', reminder: 'आठवण: ', rejected: ' — कृपया पुन्हा पाठवा (%R)' },
} as const;

/** Documents that normally come from the garage, not the insured. */
export const GARAGE_DOCS: ReadonlySet<DocType> = new Set<DocType>(['estimate', 'supplementaryEstimate', 'invoice']);

export const defaultRecipient = (docType: DocType): ContactRole => (GARAGE_DOCS.has(docType) ? 'garage' : 'insured');

// split/join so '$' in user text is never read as a replacement pattern
const fill = (s: string, key: string, val: string) => s.split(key).join(val);

/** items are [label, rejected reason | null] pairs; labels stay English. */
export function askMessage(
  lang: AskLang, name: string, vehicle: string, insurer: string,
  items: ReadonlyArray<readonly [string, string | null]>, surveyor: string, reminder: boolean,
): string {
  const c = ASK_COPY[lang];
  const header = (reminder ? c.reminder : '') + (name.trim() ? `${c.hello} ${name},` : `${c.hello},`);
  return [
    header,
    fill(fill(c.intro, '%V', vehicle), '%I', insurer),
    ...items.map(([label, why]) => `- ${label}${why === null ? '' : fill(c.rejected, '%R', why)}`),
    c.thanks,
    ...(surveyor.trim() ? [surveyor] : []),
  ].join('\n');
}

export const askSubject = (vehicle: string, insurer: string) => `Documents required — ${vehicle} (${insurer})`;

// Difference from Scan: Kotlin's URLEncoder also escapes ( ) ' ! ~ ; encodeURIComponent leaves them
// literal. Both are valid in a query string and WhatsApp/mail clients accept either.
// Spaces become %20 in both, never '+'.
const enc = encodeURIComponent;

export const waLink = (number: string, text: string) => `https://wa.me/${number}?text=${enc(text)}`;

export const mailtoUri = (to: string, subject: string, body: string) => `mailto:${to}?subject=${enc(subject)}&body=${enc(body)}`;
