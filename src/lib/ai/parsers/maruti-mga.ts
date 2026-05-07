// Stub — replaced by Task 7
import type { ParserResult } from './types';
import { parseGenericTable } from './generic-table';

export function parseMarutiMga(textLayers: string[]): ParserResult {
  return parseGenericTable(textLayers);
}
