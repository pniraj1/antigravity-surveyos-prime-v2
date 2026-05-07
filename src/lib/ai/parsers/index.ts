import type { DocumentProfile, ParserResult } from './types';
import { parseGenericTable } from './generic-table';
import { parseTataDtc } from './tata-dtc';
import { parseMarutiMga } from './maruti-mga';
import { parseHyundaiDms } from './hyundai-dms';
import { parseMahindraMds } from './mahindra-mds';

export const PARSER_CONFIDENCE_THRESHOLD = 0.85;

/**
 * Dispatches to the appropriate format-specific parser based on detected format.
 * Falls back to generic-table parser for unknown formats.
 */
export function runParser(profile: DocumentProfile): ParserResult {
  const { detectedFormat, textLayers } = profile;

  switch (detectedFormat) {
    case 'tata-dtc':
      return parseTataDtc(textLayers);
    case 'maruti-mga':
      return parseMarutiMga(textLayers);
    case 'hyundai-dms':
      return parseHyundaiDms(textLayers);
    case 'mahindra-mds':
      return parseMahindraMds(textLayers);
    case 'generic-table':
    case 'unknown':
    default:
      return parseGenericTable(textLayers);
  }
}

/**
 * Returns true if the parser result meets the confidence threshold for both
 * items and totals. This gates whether we skip AI extraction.
 */
export function parserMeetsThreshold(result: ParserResult): boolean {
  return (
    result.confidence.items >= PARSER_CONFIDENCE_THRESHOLD &&
    result.confidence.totals >= PARSER_CONFIDENCE_THRESHOLD
  );
}

/**
 * Returns true if any spare_parts item has an empty category.
 * This gates the need for AI-powered categorization.
 */
export function needsCategorization(result: ParserResult): boolean {
  return result.data.spare_parts.some((item) => item.category === '');
}

export * from './types';
