import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { deletableSelection, pickerColumns } from '../bill-check/BillCheckGrid';
import { OPTIONAL_COLUMNS } from '../bill-check/config';
import { uploadLabels } from '@/lib/reports/bill-check-mode';
import { BillCheckAttentionBanner } from '../bill-check/BillCheckAttentionBanner';
import type { BillFlag } from '@/lib/reports/bill-check-flags';

describe('deletableSelection', () => {
  it('drops selected ids the grid does not show', () => {
    expect(deletableSelection(new Set(['a', 'hiddenB']), new Set(['a']))).toEqual(['a']);
  });
});

describe('pickerColumns', () => {
  const label = (cols: ReturnType<typeof pickerColumns>, k: string) => cols.find(c => c.key === k)?.label;
  it('estimate-base claim keeps Estimate / Billed', () => {
    const c = pickerColumns(OPTIONAL_COLUMNS, uploadLabels(null));
    expect(label(c, 'unitPrice')).toBe('Estimate (taxable)');
    expect(label(c, 'billedTaxable')).toBe('Billed (taxable)');
  });
  it('from-bill claim swaps them', () => {
    const c = pickerColumns(OPTIONAL_COLUMNS, uploadLabels({ billCheck: { baseDocument: 'final-bill' } }));
    expect(label(c, 'unitPrice')).toBe('Bill (taxable)');
    expect(label(c, 'billedTaxable')).toBe('Estimated (taxable)');
  });
});

describe('attention banner', () => {
  it('tells where the hidden rejected rows are', () => {
    const flags = [{ kind: 'billed-rejected', rowId: 'x' }] as unknown as BillFlag[];
    const html = renderToStaticMarkup(
      <BillCheckAttentionBanner
        flags={flags}
        reconciliation={{ reconciles: true } as never}
        onConfirmAllBelow={() => {}} onKeepAllAbove={() => {}}
      />,
    );
    expect(html).toContain('Turn off Allowed only to see them.');
  });
});
