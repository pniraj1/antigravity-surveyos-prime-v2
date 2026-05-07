import { describe, it, expect, vi, beforeEach } from 'vitest';
import { categorizeItems } from '../categorizer';

vi.mock('../service', () => ({
  callAIGateway: vi.fn(),
}));

import { callAIGateway } from '../service';
const mockCallAI = vi.mocked(callAIGateway);

const ITEMS: import('../parsers/types').EstimateLineItem[] = [
  {
    sr_no: 1,
    description: 'FRONT BUMPER ASSY',
    part_number: '',
    hsn_sac: '',
    quantity: 1,
    unit_price: 8500,
    taxable_amount: 8500,
    cgst_amount: 765,
    sgst_amount: 765,
    total_amount: 10030,
    gst_percent: 18,
    category: '',
  },
  {
    sr_no: 2,
    description: 'ENGINE OIL FILTER',
    part_number: '',
    hsn_sac: '',
    quantity: 1,
    unit_price: 500,
    taxable_amount: 500,
    cgst_amount: 45,
    sgst_amount: 45,
    total_amount: 590,
    gst_percent: 18,
    category: '',
  },
];

describe('categorizeItems', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty result for empty input', async () => {
    const result = await categorizeItems([]);
    expect(result.categorized).toHaveLength(0);
    expect(result.uncategorizedCount).toBe(0);
    expect(mockCallAI).not.toHaveBeenCalled();
  });

  it('applies categories from AI response', async () => {
    mockCallAI.mockResolvedValue(
      JSON.stringify({
        'FRONT BUMPER ASSY': 'plastic',
        'ENGINE OIL FILTER': 'metal',
      })
    );

    const result = await categorizeItems(ITEMS);
    expect(result.categorized[0].category).toBe('plastic');
    expect(result.categorized[1].category).toBe('metal');
    expect(result.uncategorizedCount).toBe(0);
  });

  it('leaves category empty when AI returns unknown value', async () => {
    mockCallAI.mockResolvedValue(
      JSON.stringify({
        'FRONT BUMPER ASSY': 'rubber', // invalid category
        'ENGINE OIL FILTER': 'metal',
      })
    );

    const result = await categorizeItems(ITEMS);
    expect(result.categorized[0].category).toBe('');
    expect(result.categorized[1].category).toBe('metal');
  });

  it('returns items unchanged on API error', async () => {
    mockCallAI.mockRejectedValue(new Error('API error'));
    const result = await categorizeItems(ITEMS);
    expect(result.categorized[0].category).toBe('');
    expect(result.uncategorizedCount).toBe(2);
  });

  it('returns items unchanged on malformed JSON response', async () => {
    mockCallAI.mockResolvedValue('not valid json {{');
    const result = await categorizeItems(ITEMS);
    expect(result.categorized[0].category).toBe('');
  });

  it('does not mutate original items', async () => {
    mockCallAI.mockResolvedValue(
      JSON.stringify({
        'FRONT BUMPER ASSY': 'plastic',
        'ENGINE OIL FILTER': 'metal',
      })
    );
    const originalCategory = ITEMS[0].category;
    await categorizeItems(ITEMS);
    expect(ITEMS[0].category).toBe(originalCategory); // unchanged
  });

  it('deduplicates descriptions before API call', async () => {
    const itemsWithDuplicates = [
      { ...ITEMS[0], sr_no: 1 },
      { ...ITEMS[0], sr_no: 2 }, // same description
      { ...ITEMS[1], sr_no: 3 },
    ];

    mockCallAI.mockResolvedValue(
      JSON.stringify({
        'FRONT BUMPER ASSY': 'plastic',
        'ENGINE OIL FILTER': 'metal',
      })
    );

    const result = await categorizeItems(itemsWithDuplicates);
    // Both items with 'FRONT BUMPER ASSY' description should get 'plastic'
    expect(result.categorized[0].category).toBe('plastic');
    expect(result.categorized[1].category).toBe('plastic');
    expect(result.categorized[2].category).toBe('metal');
  });

  it('handles case-insensitive lookup from AI response', async () => {
    mockCallAI.mockResolvedValue(
      JSON.stringify({
        'front bumper assy': 'plastic', // lowercase response
        'engine oil filter': 'metal',
      })
    );

    const result = await categorizeItems(ITEMS);
    expect(result.categorized[0].category).toBe('plastic');
    expect(result.categorized[1].category).toBe('metal');
  });

  it('only accepts valid categories: metal, plastic, glass, or empty string', async () => {
    mockCallAI.mockResolvedValue(
      JSON.stringify({
        'FRONT BUMPER ASSY': 'unknown', // invalid
        'ENGINE OIL FILTER': 'glass', // valid
      })
    );

    const result = await categorizeItems(ITEMS);
    expect(result.categorized[0].category).toBe('');
    expect(result.categorized[1].category).toBe('glass');
  });
});
