import type { DetectedFormat, DocumentProfile, TextLayerQuality } from './parsers/types';

const RICH_THRESHOLD = 200;
const GARBLED_RATIO  = 0.75;

export function assessTextQuality(text: string): TextLayerQuality {
  if (!text || text.length === 0) return 'none';
  if (text.length < 30) return 'sparse';
  const printable = (text.match(/[\x20-\x7Eऀ-ॿ₹]/g) ?? []).length;
  if (printable / text.length < GARBLED_RATIO) return 'garbled';
  if (text.length >= RICH_THRESHOLD) return 'rich';
  return 'sparse';
}

interface FormatDetection {
  format: DetectedFormat;
  confidence: number;
}

const FORMAT_SIGNATURES: Array<{
  format: DetectedFormat;
  signals: RegExp[];
  weight: number;
}> = [
  { format: 'tata-dtc',     signals: [/TATA MOTORS/i, /AUTHORIS[EA]D SERVICE/i], weight: 0.95 },
  { format: 'maruti-mga',   signals: [/MARUTI SUZUKI/i, /MGA/i],                  weight: 0.95 },
  { format: 'hyundai-dms',  signals: [/HYUNDAI/i, /DMS|DEALER MANAGEMENT/i],      weight: 0.90 },
  { format: 'mahindra-mds', signals: [/MAHINDRA/i, /MDS|DEALER SOLUTION/i],       weight: 0.90 },
];

const TABLE_HEADER_PATTERN = /\b(description|particulars|item)\b.{0,40}\b(qty|quantity)\b.{0,40}\b(rate|price|amount)\b/i;

export function detectFormat(textLayers: string[]): FormatDetection {
  const combined = textLayers.join('\n');
  for (const sig of FORMAT_SIGNATURES) {
    if (sig.signals.every(r => r.test(combined))) {
      return { format: sig.format, confidence: sig.weight };
    }
  }
  if (TABLE_HEADER_PATTERN.test(combined)) {
    return { format: 'generic-table', confidence: 0.65 };
  }
  return { format: 'unknown', confidence: 0 };
}

export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function buildProfile(
  fileHash: string,
  pageCount: number,
  textLayers: string[],
): DocumentProfile {
  const allText = textLayers.join('');
  const avgChars = pageCount > 0 ? allText.length / pageCount : 0;
  const hasTextLayer = avgChars >= RICH_THRESHOLD;
  const textLayerQuality = assessTextQuality(allText.slice(0, 2000));
  const { format, confidence } = detectFormat(textLayers);
  return {
    fileHash,
    pageCount,
    hasTextLayer,
    textLayerQuality,
    detectedFormat: format,
    formatConfidence: confidence,
    textLayers,
  };
}
