// src/lib/ai/parsers/maruti-mga.ts
import type { ParserResult, EstimateLineItem, ExtractedEstimate } from './types';

const LABOUR_KEYWORDS   = /\b(fitment|removal|install|r\s*&\s*r|welding|cutting|align|balance|diagnosis|gas charges)\b/i;
const PAINTING_KEYWORDS = /\b(paint\w*|solid colo?ur|metallic|touch.?up|buffing|2k\s*coat)\b/i;

type ItemCategory = 'spare_parts' | 'labour_items' | 'painting_items';

function classifyDescription(desc: string): ItemCategory {
  if (PAINTING_KEYWORDS.test(desc)) return 'painting_items';
  if (LABOUR_KEYWORDS.test(desc))   return 'labour_items';
  return 'spare_parts';
}

function toNum(s: string): number {
  return parseFloat(s.replace(/,/g, '')) || 0;
}

// MGA row layout: s_no, particulars, part_number, hsn, qty, mrp (skip), basic, cgst%, cgst, sgst%, sgst, total
// Groups: [, sr, desc, partNo, hsn, qty, mrp, basic, cgst, sgst, total]
const MGA_DATA_ROW = /^\s*(\d+)\s+(.+?)\s{2,}([A-Z0-9\-]{6,}|-)\s+([\d]{5,}|-)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+\d+%\s+([\d,]+\.?\d*)\s+\d+%\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)$/;

const REG_PAT     = /reg\.?\s*no\.?\s*:?\s*([A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4})/i;
const INVOICE_PAT = /invoice\s*no\.?\s*:?\s*([A-Z0-9\/\-]+)/i;
const DATE_PAT    = /(?:date|dt\.?)\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i;

const NET_PAYABLE = /net\s*payable|grand\s*total/i;
const CGST_TOTAL  = /total\s*cgst/i;
const SGST_TOTAL  = /total\s*sgst/i;
const PARTS_SUB   = /parts\s*sub.?total/i;
const LABOUR_SUB  = /labour\s*sub.?total/i;
const PAINT_SUB   = /paint\s*sub.?total/i;

const MARUTI_HEADER = /MARUTI SUZUKI/i;
const MGA_HEADER    = /MGA INVOICE/i;

export function parseMarutiMga(textLayers: string[]): ParserResult {
  const spare_parts:    EstimateLineItem[]                    = [];
  const labour_items:   Omit<EstimateLineItem, 'category'>[] = [];
  const painting_items: Omit<EstimateLineItem, 'category'>[] = [];
  const unparsableSections: string[]                         = [];

  let workshop_name     = '';
  let vehicle_number    = '';
  let bill_number       = '';
  let estimate_date     = '';
  let gross_amount      = 0;
  let total_cgst        = 0;
  let total_sgst        = 0;
  let subtotal_parts    = 0;
  let subtotal_labour   = 0;
  let subtotal_painting = 0;
  let rowsParsed        = 0;

  // Workshop name state machine:
  // Line 1: "MARUTI SUZUKI INDIA LIMITED" → sawMarutiHeader
  // Line 2: "MGA INVOICE"                 → sawMgaHeader
  // Line 3: workshop name
  let sawMarutiHeader = false;
  let sawMgaHeader    = false;
  let workshopNameSet = false;

  for (const page of textLayers) {
    const lines = page.split('\n');

    for (const raw of lines) {
      const trimmed = raw.trim();
      if (!trimmed) continue;

      // Workshop name state machine (first-page header, lines 1-3)
      if (!workshopNameSet) {
        if (!sawMarutiHeader && MARUTI_HEADER.test(trimmed)) {
          sawMarutiHeader = true;
          continue;
        }
        if (sawMarutiHeader && !sawMgaHeader && MGA_HEADER.test(trimmed)) {
          sawMgaHeader = true;
          continue;
        }
        if (sawMarutiHeader && sawMgaHeader) {
          workshop_name   = trimmed;
          workshopNameSet = true;
          continue;
        }
      }

      // Header fields
      if (!vehicle_number) {
        const vm = trimmed.match(REG_PAT);
        if (vm) vehicle_number = vm[1].toUpperCase();
      }

      if (!bill_number) {
        const bm = trimmed.match(INVOICE_PAT);
        if (bm) bill_number = bm[1].trim();
      }

      if (!estimate_date) {
        const dm = trimmed.match(DATE_PAT);
        if (dm) estimate_date = dm[1];
      }

      // Summary totals
      if (NET_PAYABLE.test(trimmed)) {
        const n = trimmed.match(/([\d,]+\.?\d*)\s*$/);
        if (n) gross_amount = Math.max(gross_amount, toNum(n[1]));
        continue;
      }
      if (CGST_TOTAL.test(trimmed)) {
        const n = trimmed.match(/([\d,]+\.?\d*)\s*$/);
        if (n) total_cgst = Math.max(total_cgst, toNum(n[1]));
        continue;
      }
      if (SGST_TOTAL.test(trimmed)) {
        const n = trimmed.match(/([\d,]+\.?\d*)\s*$/);
        if (n) total_sgst = Math.max(total_sgst, toNum(n[1]));
        continue;
      }
      if (PARTS_SUB.test(trimmed)) {
        const n = trimmed.match(/([\d,]+\.?\d*)\s*$/);
        if (n) subtotal_parts = Math.max(subtotal_parts, toNum(n[1]));
        continue;
      }
      if (LABOUR_SUB.test(trimmed)) {
        const n = trimmed.match(/([\d,]+\.?\d*)\s*$/);
        if (n) subtotal_labour = Math.max(subtotal_labour, toNum(n[1]));
        continue;
      }
      if (PAINT_SUB.test(trimmed)) {
        const n = trimmed.match(/([\d,]+\.?\d*)\s*$/);
        if (n) subtotal_painting = Math.max(subtotal_painting, toNum(n[1]));
        continue;
      }

      // Data rows
      // Groups: [full, sr, desc, partNo, hsn, qty, mrp, basic, cgst, sgst, total]
      const match = trimmed.match(MGA_DATA_ROW);
      if (!match) {
        if (trimmed.length > 10 && unparsableSections.length < 50) {
          unparsableSections.push(trimmed);
        }
        continue;
      }

      const [, sr, desc, partNo, hsn, qtyStr, , basicStr, cgstStr, sgstStr, totalStr] = match;

      const quantity       = toNum(qtyStr);
      const taxable_amount = toNum(basicStr);   // Basic = taxable, not MRP
      const unit_price     = taxable_amount;    // unit_price derived from Basic
      const cgst_amount    = toNum(cgstStr);
      const sgst_amount    = toNum(sgstStr);
      const total_amount   = toNum(totalStr);

      const gst_percent = taxable_amount > 0
        ? Math.round((cgst_amount + sgst_amount) / taxable_amount * 100)
        : 18;

      const base: Omit<EstimateLineItem, 'category'> = {
        sr_no:          parseInt(sr, 10),
        description:    desc.trim().toUpperCase(),
        part_number:    partNo === '-' ? '' : partNo.trim(),
        hsn_sac:        hsn === '-' ? '' : hsn.trim(),
        quantity,
        unit_price,
        taxable_amount,
        cgst_amount,
        sgst_amount,
        total_amount,
        gst_percent,
      };

      const cat = classifyDescription(base.description);
      rowsParsed++;

      if (cat === 'spare_parts') {
        spare_parts.push({ ...base, category: '' });
      } else if (cat === 'painting_items') {
        painting_items.push(base);
      } else {
        labour_items.push(base);
      }
    }
  }

  const data: ExtractedEstimate = {
    workshop_name,
    workshop_address:          '',
    vehicle_number,
    chassis_number:            '',
    engine_number:             '',
    estimate_date,
    bill_number,
    spare_parts,
    labour_items,
    painting_items,
    subtotal_parts_taxable:    subtotal_parts,
    subtotal_labour_taxable:   subtotal_labour,
    subtotal_painting_taxable: subtotal_painting,
    total_cgst,
    total_sgst,
    total_tax:                 total_cgst + total_sgst,
    gross_amount,
  };

  const itemConf   = rowsParsed > 0 ? Math.min(1, rowsParsed / 3) : 0;
  const totalConf  = gross_amount > 0 ? 0.95 : 0;
  const headerConf = vehicle_number && bill_number ? 0.95
    : vehicle_number ? 0.7
    : 0.3;

  return {
    data,
    confidence:        { header: headerConf, items: itemConf, totals: totalConf },
    unparsableSections,
    parserName:        'maruti-mga',
  };
}
