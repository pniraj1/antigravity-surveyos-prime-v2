// ═══════════════════════════════════════════════════════════
// AI PROMPTS
// specialized for Motor Insurance Survey (India)
// ═══════════════════════════════════════════════════════════

/**
 * Appended to every prompt so the AI also returns a short text snippet
 * for each extracted field — used by the Evidence Viewer to show WHERE
 * in the document a value was found. The snippet is the surrounding text
 * from the source document (5–15 words), NOT an explanation.
 *
 * Convention: for a key "foo", the evidence snippet lives at "foo_context".
 * Example: "registration_number_context": "Regn No.: MH12AB1234 Date of Reg: 20-11-2019"
 */
const CONTEXT_INSTRUCTION = `
ADDITIONALLY: For EVERY field you extract (where the value is non-empty), also return a "_context" key containing a short 5-15 word verbatim text snippet copied directly from the document around where that field value appears. This helps users verify the source.
Example: if you extract "registration_number": "MH12AB1234", also return "registration_number_context": "Regn No: MH12AB1234  Regn Date: 20-Nov-2019".
Do NOT invent or paraphrase. Copy the text exactly as it appears in the document. Only include _context keys for non-empty fields.`;

// ─── Raw prompt bodies (without context instruction) ─────────────────────────
const RAW_PROMPTS: Record<string, string> = {
  rc: `You are an expert at reading Indian vehicle RC (Registration Certificate) documents. Extract ALL visible fields from this RC book image. Return ONLY a JSON object with these keys (use empty string if not found):
{
  "registration_number": "",
  "date_of_registration": "Look for 'Regn Date' or 'Date of Registration' - return as YYYY-MM-DD",
  "registration_valid_upto": "Look for 'Regn Valid Upto' or 'Registration Valid Upto' - return as YYYY-MM-DD",
  "year_of_manufacture": "Look for 'Mfg Yr', 'Year of Manufacture', 'YOM' - return as 4-digit number e.g. 2019",
  "owner_name": "",
  "address": "",
  "make": "",
  "model": "",
  "body_type": "",
  "chassis_number": "",
  "engine_number": "",
  "cubic_capacity": "",
  "colour": "",
  "fuel": "",
  "seating_capacity": "",
  "unladen_weight": "",
  "gross_weight": "Look for 'Gross Weight', 'GVW', 'RLW', 'Registered Laden Weight', 'Laden Weight', 'G.V.W.' - these all mean the same thing",
  "class_of_vehicle": "",
  "registering_authority": "Look for 'Registering Authority', 'RTO', 'Regn Authority', 'Issuing Authority' - the RTO office name that issued the RC",
  "permit_no": "",
  "route": "",
  "road_tax": "",
  "hypothecation": "Look for 'Hypothecation', 'Financer', 'HP Agreement', 'Under Hypothecation to' - the bank/NBFC name if vehicle is financed"
}
Return ONLY the JSON. No explanation, no markdown, no backticks.`,

  dl: `You are an expert at reading Indian Driving Licence (DL/MDL) documents. Extract ALL visible fields including Father/Husband name and ALL validity dates. Return ONLY a JSON object:
{
  "licence_number": "",
  "holder_name": "",
  "relation_type": "S/o or D/o or W/o",
  "father_or_husband_name": "Extract parent/spouse name from document",
  "date_of_birth": "Extract DOB - return as YYYY-MM-DD",
  "address": "",
  "date_of_issue": "",
  "validity_non_transport": "expiry date of LMV/Non-Transport licence",
  "validity_transport": "expiry date of Transport/HMV/TRANS licence (if present)",
  "issuing_authority": "RTO name",
  "rto": "",
  "vehicle_classes": "all classes listed e.g. LMV-NT, MCWG, TRANS, HMV",
  "badge_no": ""
}
Return ONLY the JSON. No explanation, no markdown, no backticks.`,

  policy: `You are an expert at reading Indian motor insurance policy documents. Extract ALL visible fields. Return ONLY a JSON object:
{
  "policy_number": "",
  "insurer_name": "",
  "insurer_address": "",
  "insured_name": "",
  "insured_address": "",
  "insured_mobile": "",
  "registration_number": "",
  "make_model": "",
  "chassis_number": "",
  "engine_number": "",
  "policy_type": "",
  "period_from": "",
  "period_to": "",
  "idv": "",
  "policy_issuing_office": "",
  "hpa_with": ""
}
Return ONLY the JSON. No explanation, no markdown, no backticks.`,

  estimate: `You are an expert at reading Indian vehicle repair estimates, proforma invoices, and workshop bills (e.g. Tata DTC, Maruti MGA, Hyundai etc.).

CRITICAL RULES:
1. Extract EVERY SINGLE line item from ALL pages. Do NOT stop at page 1. This document may have 50-80+ items across 3-5 pages.
2. PRESERVE the original serial number (Sr No / S.No / #) from the document as "sr_no". If not numbered, assign 1, 2, 3... in the order items appear.
3. Classify each item into one of three categories based on these rules:
   - spare_parts: Physical parts (HSN code starting with 87xx, 85xx, 27xx, 35xx etc.). These have part_number columns.
   - labour_items: Labour/service charges (SAC code starting with 9987). Descriptions contain words like "REPLACE", "R & R", "REMOVE", "FITMENT CHARGES", "DIAGNOSIS", "CUTTING", "WELDING", "GAS CHARGES". Do NOT put these in spare_parts.
   - painting_items: Painting jobs (SAC 9987). Descriptions contain "PAINTING", "SOLID COLOUR", "METALLIC COLOUR", "TOUCH UP". Do NOT put these in labour_items.
4. AMOUNTS — extract BOTH per line item (these are separate columns on the invoice):
   - "taxable_amount": the TAXABLE VALUE / BASE AMOUNT before GST (Qty × Unit Price column). This is the NET amount.
   - "cgst_amount": CGST amount for this line (printed on invoice).
   - "sgst_amount": SGST amount for this line (printed on invoice).
   - "total_amount": the FINAL AMOUNT including GST (last column). This is the GROSS amount.
   If only one amount column exists, put it in "total_amount" and set "taxable_amount" to total_amount / (1 + gst_percent/100).
5. For "category" on spare_parts: classify as "metal", "plastic", or "glass" based on the part name:
   - glass: windshield, window, mirror glass
   - plastic: bumper, cladding, grille, garnish, cap, air duct, skid plate, fender liner
   - metal: everything else (brackets, radiator, intercooler, hinges, cross member, structural parts, headlamp assy, fan assy, airbag, sensor, seat belt)
6. Look at the LAST PAGE for summary totals. Extract them as:
   - "subtotal_parts_taxable": Sum of parts taxable amounts (before GST)
   - "subtotal_labour_taxable": Sum of labour taxable amounts (before GST)
   - "subtotal_painting_taxable": Sum of painting taxable amounts (before GST)
   - "total_cgst": Total CGST from the invoice
   - "total_sgst": Total SGST from the invoice
   - "total_tax": Total tax (CGST + SGST)
   - "gross_amount": Final grand total (all items + all tax)
7. Extract the HSN/SAC code for each line item as "hsn_sac". It is typically a 4-8 digit code in a column.
8. DO NOT DUPLICATE ITEMS: If an item has only ONE price, place it in ONLY ONE category (spare_parts OR labour_items OR painting_items). ONLY split a line item if it explicitly has TWO separate price columns (e.g. a Part Price column AND a Labour Price column). If you DO split it, you MUST append " (Part)" and " (Labour)" to their descriptions respectively.

Return ONLY a JSON object:
{
  "workshop_name": "",
  "workshop_address": "",
  "vehicle_number": "",
  "chassis_number": "",
  "engine_number": "",
  "estimate_date": "",
  "bill_number": "",
  "spare_parts": [
    { "sr_no": 1, "description": "", "part_number": "", "hsn_sac": "", "quantity": 1, "unit_price": 0, "taxable_amount": 0, "cgst_amount": 0, "sgst_amount": 0, "total_amount": 0, "gst_percent": 18, "category": "metal or plastic or glass" }
  ],
  "labour_items": [
    { "sr_no": 1, "description": "", "hsn_sac": "", "quantity": 1, "unit_price": 0, "taxable_amount": 0, "cgst_amount": 0, "sgst_amount": 0, "total_amount": 0, "gst_percent": 18 }
  ],
  "painting_items": [
    { "sr_no": 1, "description": "", "hsn_sac": "", "quantity": 1, "unit_price": 0, "taxable_amount": 0, "cgst_amount": 0, "sgst_amount": 0, "total_amount": 0, "gst_percent": 18 }
  ],
  "subtotal_parts_taxable": 0,
  "subtotal_labour_taxable": 0,
  "subtotal_painting_taxable": 0,
  "total_cgst": 0,
  "total_sgst": 0,
  "total_tax": 0,
  "gross_amount": 0
}
Return ONLY the JSON. No explanation, no markdown, no backticks.`,

  'final-bill': `You are an expert at reading Indian FINAL WORKSHOP BILLS (Invoices/Tax Invoices). Extract ALL final billed line items from ALL pages.

CRITICAL RULES:
1. Extract EVERY SINGLE line item from ALL pages. Do NOT stop early. Multi-page bills may have 50-80+ items.
2. PRESERVE the original serial number (Sr No / S.No / #) from the bill as "sr_no". If not numbered, assign 1, 2, 3... in order of appearance.
3. Classify items:
   - spare_parts: Physical parts (HSN 87xx, 85xx, 27xx, 35xx etc.). Have part_number columns.
   - labour_items: Labour/service (SAC 9987) — "REPLACE", "R & R", "REMOVE", "FITMENT CHARGES", "DIAGNOSIS", "CUTTING", "WELDING", "GAS CHARGES".
   - painting_items: Paint jobs (SAC 9987) — "PAINTING", "SOLID COLOUR", "METALLIC COLOUR", "TOUCH UP".
4. AMOUNTS — extract BOTH per line (separate columns on the invoice):
   - "taxable_amount": TAXABLE VALUE / BASE AMOUNT before GST (Qty × Unit Price). This is the NET amount and is the PRIMARY anchor for matching against the estimate.
   - "cgst_amount": CGST for this line (if printed).
   - "sgst_amount": SGST for this line (if printed).
   - "total_amount": FINAL amount INCLUDING GST (last column, gross).
   If only one amount column exists, put it in "total_amount" and set "taxable_amount" to total_amount / (1 + gst_percent/100).
5. "part_number": extract for spare_parts ALWAYS. Also extract for labour/paint if the bill prints a code/SAC-ref in a part-number column (some workshops do this).
6. "hsn_sac": 4-8 digit HSN/SAC code per line.
7. "category" on spare_parts: glass (windshield/window/mirror glass), plastic (bumper/grille/cladding/garnish/cap/air duct/skid plate/fender liner), metal (everything else).
8. DO NOT DUPLICATE ITEMS: If an item has only ONE price, place it in ONLY ONE category (spare_parts OR labour_items OR painting_items). ONLY split a line item if it explicitly has TWO separate price columns (e.g. a Part Price column AND a Labour Price column). If you DO split it, you MUST append " (Part)" and " (Labour)" to their descriptions respectively.

Return ONLY a JSON object:
{
  "workshop_name": "",
  "bill_number": "",
  "bill_date": "",
  "spare_parts": [
    { "sr_no": 1, "description": "", "part_number": "", "hsn_sac": "", "quantity": 1, "unit_price": 0, "taxable_amount": 0, "cgst_amount": 0, "sgst_amount": 0, "total_amount": 0, "gst_percent": 18, "category": "metal or plastic or glass" }
  ],
  "labour_items": [
    { "sr_no": 1, "description": "", "part_number": "", "hsn_sac": "", "quantity": 1, "unit_price": 0, "taxable_amount": 0, "cgst_amount": 0, "sgst_amount": 0, "total_amount": 0, "gst_percent": 18 }
  ],
  "painting_items": [
    { "sr_no": 1, "description": "", "part_number": "", "hsn_sac": "", "quantity": 1, "unit_price": 0, "taxable_amount": 0, "cgst_amount": 0, "sgst_amount": 0, "total_amount": 0, "gst_percent": 18 }
  ],
  "total_amount": 0
}
Return ONLY the JSON. No explanation, no markdown, no backticks.`,

  photos: `You are a senior motor vehicle damage assessor with 20 years experience. Analyze ALL damage photos comprehensively and identify every damaged component. Return ONLY a JSON object:
{
  "damaged_parts": [
    { "part": "component name", "damage_type": "dented/scratched/cracked/broken/deformed/shattered", "severity": "Minor/Moderate/Major", "side": "Front/Rear/Left/Right/Multiple", "recommendation": "REPAIR or REPLACE", "reason": "brief technical reason", "estimated_cost": 0 }
  ],
  "overall_damage_summary": "one paragraph description",
  "overall_assessment": { "severity": "Minor/Moderate/Major/Total Loss", "total_parts": 0, "total_cost": 0, "repair_days": 0 }
}
Return ONLY the JSON. No explanation, no markdown, no backticks.`,

  permit: `You are an expert at reading Indian commercial vehicle permit documents. Extract ALL visible fields. Return ONLY a JSON object:
{
  "permit_no": "",
  "permit_type": "",
  "vehicle_number": "",
  "validity_from": "",
  "validity_to": "",
  "route": "",
  "issuing_authority": "",
  "goods_category": "",
  "gross_vehicle_weight_kg": "Look for 'Gross Vehicle Weight', 'GVW', 'RLW', 'Registered Laden Weight', 'Laden Weight', 'G.V.W.' - these all mean the same thing",
  "unladen_weight_kg": ""
}
Return ONLY the JSON. No explanation, no markdown, no backticks.`,

  auth: `You are an expert at reading Indian commercial vehicle authorisation certificates. Return ONLY a JSON object:
{
  "auth_no": "",
  "auth_type": "",
  "vehicle_number": "",
  "validity_from": "",
  "validity_to": "",
  "issuing_authority": "",
  "remarks": ""
}
Return ONLY the JSON. No explanation, no markdown, no backticks.`,

  fitness: `You are an expert at reading Indian vehicle fitness certificates. Return ONLY a JSON object:
{
  "fitness_cert_no": "",
  "vehicle_number": "",
  "chassis_number": "",
  "engine_number": "",
  "validity_from": "",
  "validity_to": "",
  "issuing_authority": "",
  "gross_vehicle_weight_kg": "Look for 'Gross Vehicle Weight', 'GVW', 'RLW', 'Registered Laden Weight', 'Laden Weight', 'G.V.W.' - these all mean the same thing",
  "unladen_weight_kg": "",
  "seating_capacity": "",
  "fuel_type": "",
  "fitness_type": "e.g. Goods Carriage, Passenger Vehicle, etc."
}
Return ONLY the JSON. No explanation, no markdown, no backticks.`,

  'lok-challan': `You are an expert at reading Indian goods transport Lok Challan / Consignment Note documents. Return ONLY a JSON object:
{
  "challan_no": "",
  "challan_date": "",
  "vehicle_number": "",
  "origin": "",
  "destination": "",
  "consignor": "",
  "consignee": "",
  "goods_description": "",
  "weight_kg": "",
  "freight_amount": "",
  "remarks": ""
}
Return ONLY the JSON. No explanation, no markdown, no backticks.`,

  claim: `You are an expert at reading Indian motor insurance claim forms and intimation letters. Extract ALL visible fields. Return ONLY a JSON object:
{
  "claim_number": "",
  "policy_number": "",
  "insured_name": "",
  "vehicle_number": "",
  "date_of_accident": "",
  "time_of_accident": "",
  "place_of_accident": "",
  "cause_of_accident": "",
  "driver_name": "",
  "driver_licence_no": "",
  "workshop_name": "",
  "place_of_repair": "",
  "third_party_details": ""
}
Return ONLY the JSON. No explanation, no markdown, no backticks.`,

  fir: `You are an expert at reading Indian Police FIR (First Information Report) or Spot Panchnama documents. Extract incident and vehicle details. Return ONLY a JSON object:
{
  "fir_number": "",
  "fir_date": "YYYY-MM-DD",
  "police_station": "",
  "date_of_accident": "YYYY-MM-DD",
  "time_of_accident": "HH:MM (24-hour format)",
  "place_of_accident": "",
  "pincode": "",
  "vehicle_number": "",
  "driver_name": "",
  "brief_accident_details": ""
}
Return ONLY the JSON. No explanation, no markdown, no backticks.`,

  'bank-statement': `You are an expert at reading Indian bank account statements. Extract ALL credit/incoming transactions (money received). Return ONLY a JSON object:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "amount": 0,
      "narration": "full transaction description/narration",
      "reference": "UTR/reference number if visible, else empty string"
    }
  ]
}
Rules:
- Include ONLY credit entries (deposits, NEFT received, IMPS received, UPI received, cheque deposits).
- Exclude debit entries (withdrawals, payments, charges).
- Amount must be a plain number (no ₹ symbol, no commas).
- If date is ambiguous use DD/MM/YYYY context from the statement header.
- Return ONLY the JSON. No explanation, no markdown, no backticks.`,
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Document types that produce high-volume line-item arrays (60+ rows).
 * For these, we skip the CONTEXT_INSTRUCTION entirely:
 *   - Halves the AI output token count → faster response
 *   - The Evidence Viewer still shows the full PDF pages (images are stored
 *     separately in sessionStorage and are unaffected)
 *   - Field-level text snippets are not useful for tabular line items anyway
 */
const NO_CONTEXT_TYPES = new Set(['estimate', 'final-bill', 'bank-statement']);

/**
 * Returns a prompt for the given document type with the context-snippet
 * instruction appended. This is the preferred way to get prompts so that
 * every extraction response includes `fieldName_context` keys that power
 * the Evidence Viewer.
 *
 * For high-volume line-item documents (estimate, final-bill, bank-statement)
 * the context instruction is intentionally omitted to reduce output token
 * count and improve extraction speed.
 *
 * @param docType  One of the keys in RAW_PROMPTS (e.g. "rc", "policy", "dl")
 * @param withContext  Set to false to skip the context instruction (default: true)
 */
export function getDocPrompt(docType: string, withContext = true): string {
  const base = RAW_PROMPTS[docType] ?? '';
  // Skip context snippets for high-volume tabular documents
  if (NO_CONTEXT_TYPES.has(docType)) return base;
  return withContext ? `${base}\n${CONTEXT_INSTRUCTION}` : base;
}

/**
 * @deprecated  Use getDocPrompt() instead so that context snippets are included.
 * Kept for backward compatibility with any legacy callers.
 */
export const DOC_PROMPTS: Record<string, string> = RAW_PROMPTS;

// ─── Insured Report Prompts ───────────────────────────────────────────────────

const LANGUAGE_INSTRUCTION: Record<string, string> = {
  english: 'Respond in simple, clear English that a non-expert can understand.',
  hindi:   'Respond in simple, everyday Hindi (Devanagari script) that a layman can understand.',
  marathi: 'Respond in simple, everyday Marathi (Devanagari script) that a layman can understand.',
};

/**
 * Pass 1: Extracts relevant clauses from the policy document images.
 * If no images available, caller should use getIRDAIStandardClauses() instead.
 */
export function buildPolicyAnalysisPrompt(language: string): string {
  const lang = LANGUAGE_INSTRUCTION[language] ?? LANGUAGE_INSTRUCTION.english;
  return `You are an Indian motor insurance expert. Analyze this insurance policy document and extract the key clauses that will affect the claim settlement.

${lang}

Focus on: excess/deductible clauses, depreciation clauses, consumables exclusions, any specific exclusions, NCB (no-claim bonus) impact, and salvage terms.

Return ONLY a JSON object:
{
  "clauses": [
    {
      "clauseType": "excess OR depreciation OR consumables-exclusion OR specific-exclusion OR ncb OR salvage",
      "clauseTitle": "Short title of the clause (5-8 words)",
      "policyText": "Verbatim text from the policy — maximum 2 sentences",
      "plainLanguage": "Simple explanation for the insured — maximum 2 sentences. ${lang}"
    }
  ]
}
Return between 3 and 6 clauses. Return ONLY the JSON. No explanation, no markdown, no backticks.`;
}

/**
 * Pass 2: Generates plain-language explanations per assessment row.
 * rowsJson: JSON.stringify of the simplified row array.
 */
export function buildLineExplanationPrompt(language: string, rowsJson: string): string {
  const lang = LANGUAGE_INSTRUCTION[language] ?? LANGUAGE_INSTRUCTION.english;
  return `You are helping an Indian motor insurance surveyor explain claim decisions to the vehicle owner.

${lang}

For each row below, write a plain-language explanation of why the insurance amount differs from the garage bill. Use simple words — no technical jargon.

Rules:
- If "remarks" is present, use it as the basis for your explanation.
- If "billedAmount" > "assessed" for labour or paint: the surveyor negotiated the rate down. Mention the actual amounts.
- If "allowed" is false or "action" is "disallow": explain it was not covered and why (use "remarks" if present).
- If "isDisposal" is true: explain the old part goes to the insurer as salvage.
- If you lack enough context to explain why (no remarks, unclear action), set "isFlagged" to true.
- "deductionCategory" must be one of: depreciation, consumable, negotiated, not-covered, previous-damage, safe, salvage.

Assessment rows:
${rowsJson}

Return ONLY a JSON array:
[
  {
    "assessmentRowId": "row id from input",
    "aiExplanation": "Plain language explanation. ${lang}",
    "deductionCategory": "one of the allowed values",
    "isFlagged": false
  }
]
Return ONLY the JSON array. No explanation, no markdown, no backticks.`;
}
