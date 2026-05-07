// Stub — replaced by Task 8
import type { ParserResult } from './types';
import { parseGenericTable } from './generic-table';

export function parseHyundaiDms(textLayers: string[]): ParserResult {
  return parseGenericTable(textLayers);
}
