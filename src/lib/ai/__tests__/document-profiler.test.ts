import { describe, it, expect } from 'vitest';
import { hashFile, detectFormat, assessTextQuality } from '../document-profiler';

describe('assessTextQuality', () => {
  it('returns rich for dense printable text', () => {
    const text = 'A'.repeat(500);
    expect(assessTextQuality(text)).toBe('rich');
  });

  it('returns sparse for short text', () => {
    expect(assessTextQuality('hello world')).toBe('sparse');
  });

  it('returns garbled for mostly non-printable chars', () => {
    const garbled = '\x01\x02\x03\x04\x05'.repeat(50) + 'abc';
    expect(assessTextQuality(garbled)).toBe('garbled');
  });

  it('returns none for empty string', () => {
    expect(assessTextQuality('')).toBe('none');
  });
});

describe('detectFormat', () => {
  it('detects tata-dtc from signature text', () => {
    const pages = ['TATA MOTORS LIMITED\nAUTHORISED SERVICE CENTRE\nSr No  Description  Part No  HSN  Qty  Rate  Taxable  CGST  SGST  Total'];
    const { format, confidence } = detectFormat(pages);
    expect(format).toBe('tata-dtc');
    expect(confidence).toBeGreaterThan(0.8);
  });

  it('detects maruti-mga from signature text', () => {
    const pages = ['MARUTI SUZUKI INDIA LIMITED\nMGA INVOICE\nS.No  Particulars  Part Number  HSN Code  Qty  MRP  Basic  CGST  SGST  Total'];
    const { format, confidence } = detectFormat(pages);
    expect(format).toBe('maruti-mga');
    expect(confidence).toBeGreaterThan(0.8);
  });

  it('falls back to generic-table when headers found but brand unknown', () => {
    const pages = ['WORKSHOP INVOICE\nSr  Description  Qty  Rate  Amount\n1  BUMPER  1  5000  5000'];
    const { format, confidence } = detectFormat(pages);
    expect(format).toBe('generic-table');
    expect(confidence).toBeGreaterThan(0.5);
  });

  it('returns unknown when no table structure found', () => {
    const pages = ['This is a scanned image with no structured text'];
    const { format } = detectFormat(pages);
    expect(format).toBe('unknown');
  });
});
