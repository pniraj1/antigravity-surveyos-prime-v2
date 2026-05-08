// Stub — will be replaced with real implementation
import type { ParserResult } from './types';
import { parseGenericTable } from './generic-table';

export function parseMahindraMds(textLayers: string[]): ParserResult {
  return parseGenericTable(textLayers);
}
