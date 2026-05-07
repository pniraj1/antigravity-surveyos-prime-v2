import { describe, it, expect } from 'vitest';
import { runParser, parserMeetsThreshold, needsCategorization, PARSER_CONFIDENCE_THRESHOLD } from '../index';
import type { DocumentProfile, ParserResult } from '../types';

// Helper to build a minimal DocumentProfile
function makeProfile(format: DocumentProfile['detectedFormat'], textLayers: string[]): DocumentProfile {
  return {
    fileHash: 'test',
    pageCount: 1,
    hasTextLayer: true,
    textLayerQuality: 'rich',
    detectedFormat: format,
    formatConfidence: 0.9,
    textLayers,
  };
}

// Structured table text that parseGenericTable will parse with high confidence
const RICH_TABLE = `
SUNSHINE WORKSHOP
Vehicle: MH12AB1234  Date: 10-05-2026
1      FR BUMPER ASSY        1    8500    8500     765    765    10030
2      PAINTING SOLID CLR    1    2500    2500     225    225    2950
3      R&R FR BUMPER         1    600     600      54     54     708
4      ENGINE OIL 1L         2    450     900      81     81     1062
Grand Total                  14750
`;

describe('PARSER_CONFIDENCE_THRESHOLD', () => {
  it('is 0.85', () => {
    expect(PARSER_CONFIDENCE_THRESHOLD).toBe(0.85);
  });
});

describe('runParser', () => {
  it('dispatches generic-table format and returns ParserResult', () => {
    const profile = makeProfile('generic-table', [RICH_TABLE]);
    const result = runParser(profile);
    expect(result.parserName).toBe('generic-table');
    expect(result.data.spare_parts.length).toBeGreaterThan(0);
  });

  it('dispatches unknown format to generic-table fallback', () => {
    const profile = makeProfile('unknown', [RICH_TABLE]);
    const result = runParser(profile);
    expect(result.parserName).toBe('generic-table');
  });

  it('dispatches tata-dtc format (stub routes to generic-table)', () => {
    const profile = makeProfile('tata-dtc', [RICH_TABLE]);
    const result = runParser(profile);
    expect(result).toBeDefined();
  });

  it('dispatches maruti-mga format (stub routes to generic-table)', () => {
    const profile = makeProfile('maruti-mga', [RICH_TABLE]);
    const result = runParser(profile);
    expect(result).toBeDefined();
  });

  it('dispatches hyundai-dms format (stub routes to generic-table)', () => {
    const profile = makeProfile('hyundai-dms', [RICH_TABLE]);
    const result = runParser(profile);
    expect(result).toBeDefined();
  });

  it('dispatches mahindra-mds format (stub routes to generic-table)', () => {
    const profile = makeProfile('mahindra-mds', [RICH_TABLE]);
    const result = runParser(profile);
    expect(result).toBeDefined();
  });
});

describe('parserMeetsThreshold', () => {
  it('returns true when both items and totals confidence >= 0.85', () => {
    const result: ParserResult = {
      data: {} as any,
      confidence: { header: 0.8, items: 0.9, totals: 0.9 },
      unparsableSections: [],
      parserName: 'generic-table',
    };
    expect(parserMeetsThreshold(result)).toBe(true);
  });

  it('returns true when items and totals are exactly 0.85', () => {
    const result: ParserResult = {
      data: {} as any,
      confidence: { header: 0.8, items: 0.85, totals: 0.85 },
      unparsableSections: [],
      parserName: 'generic-table',
    };
    expect(parserMeetsThreshold(result)).toBe(true);
  });

  it('returns false when items confidence < 0.85', () => {
    const result: ParserResult = {
      data: {} as any,
      confidence: { header: 0.8, items: 0.7, totals: 0.9 },
      unparsableSections: [],
      parserName: 'generic-table',
    };
    expect(parserMeetsThreshold(result)).toBe(false);
  });

  it('returns false when totals confidence < 0.85', () => {
    const result: ParserResult = {
      data: {} as any,
      confidence: { header: 0.8, items: 0.9, totals: 0.5 },
      unparsableSections: [],
      parserName: 'generic-table',
    };
    expect(parserMeetsThreshold(result)).toBe(false);
  });

  it('returns false when both items and totals are below threshold', () => {
    const result: ParserResult = {
      data: {} as any,
      confidence: { header: 0.8, items: 0.5, totals: 0.6 },
      unparsableSections: [],
      parserName: 'generic-table',
    };
    expect(parserMeetsThreshold(result)).toBe(false);
  });
});

describe('needsCategorization', () => {
  it('returns true when any spare_part has empty category', () => {
    const result: ParserResult = {
      data: {
        spare_parts: [{ category: '', description: 'BUMPER' }],
      } as any,
      confidence: { header: 0.8, items: 0.9, totals: 0.9 },
      unparsableSections: [],
      parserName: 'generic-table',
    };
    expect(needsCategorization(result)).toBe(true);
  });

  it('returns true when multiple spare_parts exist and at least one has empty category', () => {
    const result: ParserResult = {
      data: {
        spare_parts: [
          { category: 'metal', description: 'BUMPER' },
          { category: '', description: 'DOOR PANEL' },
          { category: 'plastic', description: 'TRIM' },
        ],
      } as any,
      confidence: { header: 0.8, items: 0.9, totals: 0.9 },
      unparsableSections: [],
      parserName: 'generic-table',
    };
    expect(needsCategorization(result)).toBe(true);
  });

  it('returns false when all spare_parts have a category', () => {
    const result: ParserResult = {
      data: {
        spare_parts: [{ category: 'metal', description: 'BUMPER' }],
      } as any,
      confidence: { header: 0.8, items: 0.9, totals: 0.9 },
      unparsableSections: [],
      parserName: 'generic-table',
    };
    expect(needsCategorization(result)).toBe(false);
  });

  it('returns false when all spare_parts have categories', () => {
    const result: ParserResult = {
      data: {
        spare_parts: [
          { category: 'metal', description: 'BUMPER' },
          { category: 'plastic', description: 'TRIM' },
          { category: 'glass', description: 'WINDOW' },
        ],
      } as any,
      confidence: { header: 0.8, items: 0.9, totals: 0.9 },
      unparsableSections: [],
      parserName: 'generic-table',
    };
    expect(needsCategorization(result)).toBe(false);
  });

  it('returns false when spare_parts is empty', () => {
    const result: ParserResult = {
      data: { spare_parts: [] } as any,
      confidence: { header: 0.8, items: 0.9, totals: 0.9 },
      unparsableSections: [],
      parserName: 'generic-table',
    };
    expect(needsCategorization(result)).toBe(false);
  });
});
