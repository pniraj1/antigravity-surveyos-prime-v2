// Stub — replaced by Task 6
import type { ParserResult } from './types';
import { parseGenericTable } from './generic-table';

export function parseTataDtc(textLayers: string[]): ParserResult {
  return parseGenericTable(textLayers);
}
