// src/lib/ai/parsers/tata-dtc.ts
import type { ParserResult, EstimateLineItem, ExtractedEstimate } from './types';

const LABOUR_KEYWORDS   = /\b(r\s*&\s*r|remove|replace|fitment|diagnosis|welding|cutting|gas\s*charges|align|balance)\b/i;
const PAINTING_KEYWORDS = /\b(paint\w*|solid\s*colo?ur|metallic|touch.?up|buffing)\b/i;

type ItemCategory = 'spare_parts' | 'labour_items' | 'painting_items';

function classifyDescription(desc: string): ItemCategory {
  if (PAINTING_KEYWORDS.test(desc)) return 'painting_items';
  if (LABOUR_KEYWORDS.test(desc))   return 'labour_items';
  return 'spare_parts';
}

function toNum(s: string): number {
  return parseFloat(s.replace(/,/g, '')) || 0;
}

// DTC data row pattern:
// Groups: (sr_no) (description) (part_no: alphanumeric or '-') (hsn: 5+ digits or '-') (qty) (rate) (taxable) (cgst_pct%) (cgst) (sgst_pct%) (sgst) (total)
// Columns are space-aligned; part_no may be alphanumeric or '-'; hsn is 5+ digit code or '-'
const DTC_DATA_ROW = /^\s*(\d+)\s{1,}(.+?)\s{2,}([A-Z0-9]{4,}|-)\s{1,}(\d{5,}|-)\s{1,}([\d,]+\.?\d*)\s{1,}([\d,]+\.?\d*)\s{1,}([\d,]+\.?\d*)\s{1,}\d+%\s{1,}([\d,]+\.?\d*)\s{1,}\d+%\s{1,}([\d,]+\.?\d*)\s{1,}([\d,]+\.?\d*)\s*$/;

const VEHICLE_PAT   = /(?:vehicle\s*no\.?|reg\.?\s*no\.?)\s*:?\s*([A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4})/i;
const BILL_PAT      = /bill\s*no\.?\s*:?\s*([A-Z0-9/\-]+)/i;
const DATE_PAT      = /(?:date|dt\.?)\s*:?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i;
const GRAND_TOTAL   = /grand\s*total|net\s*payable/i;
const CGST_TOTAL    = /total\s*cgst/i;
const SGST_TOTAL    = /total\s*sgst/i;
const PARTS_SUB     = /sub.?total\s*parts/i;
const LABOUR_SUB    = /sub.?total\s*labour/i;
const PAINTING_SUB  = /sub.?total\s*paint/i;
const TATA_HEADER   = /TATA\s*MOTORS\s*LIMITED/i;
const AUTH_SERVICE  = /AUTHORISED\s*SERVICE/i;

export function parseTataDtc(textLayers: string[]): ParserResult {
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

  // Workshop name state machine: look for TATA MOTORS LIMITED → AUTHORISED SERVICE → next non-empty line
  let sawTataHeader   = false;
  let sawAuthService  = false;
  let workshopNameSet = false;

  for (const page of textLayers) {
    const lines = page.split('\n');

    for (const raw of lines) {
      const trimmed = raw.trim();
      if (!trimmed) continue;

      // Workshop name state machine (first page header)
      if (!workshopNameSet) {
        if (TATA_HEADER.test(trimmed)) {
          sawTataHeader = true;
          continue;
        }
        if (sawTataHeader && AUTH_SERVICE.test(trimmed)) {
          sawAuthService = true;
          continue;
        }
        if (sawTataHeader && sawAuthService) {
          workshop_name  = trimmed;
          workshopNameSet = true;
          continue;
        }
      }

      // Header fields from the vehicle/date/bill line
      if (!vehicle_number) {
        const vm = trimmed.match(VEHICLE_PAT);
        if (vm) vehicle_number = vm[1].toUpperCase();
      }

      if (!bill_number) {
        const bm = trimmed.match(BILL_PAT);
        if (bm) bill_number = bm[1].trim();
      }

      if (!estimate_date) {
        const dm = trimmed.match(DATE_PAT);
        if (dm) estimate_date = dm[1];
      }

      // Summary totals
      if (GRAND_TOTAL.test(trimmed)) {
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
      if (PAINTING_SUB.test(trimmed)) {
        const n = trimmed.match(/([\d,]+\.?\d*)\s*$/);
        if (n) subtotal_painting = Math.max(subtotal_painting, toNum(n[1]));
        continue;
      }

      // Data rows
      const match = trimmed.match(DTC_DATA_ROW);
      if (!match) {
        if (trimmed.length > 10 && unparsableSections.length < 50) {
          unparsableSections.push(trimmed);
        }
        continue;
      }

      const [, sr, desc, partNo, hsn, qtyStr, rateStr, taxableStr, cgstStr, sgstStr, totalStr] = match;

      const quantity       = toNum(qtyStr);
      const unit_price     = toNum(rateStr);
      const taxable_amount = toNum(taxableStr);
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
        spare_parts.push({ ...base, category: '' }); // '' = unclassified material; Task 8 categorizer fills metal/plastic/glass
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
    parserName:        'tata-dtc',
  };
}
