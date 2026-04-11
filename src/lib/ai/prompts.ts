// ═══════════════════════════════════════════════════════════
// AI PROMPTS
// specialized for Motor Insurance Survey (India)
// ═══════════════════════════════════════════════════════════

export const DOC_PROMPTS: Record<string, string> = {
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
  "gross_weight": "",
  "class_of_vehicle": "",
  "fitness_cert_no": "",
  "fitness_valid_upto": "",
  "permit_no": "",
  "route": "",
  "road_tax": "",
  "hypothecation": "",
  "fitness_type": "Extract 'Goods' or 'Passenger' or 'Private' if mentioned near fitness"
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
  "appointing_office": "",
  "hpa_with": ""
}
Return ONLY the JSON. No explanation, no markdown, no backticks.`,

  estimate: `You are an expert at reading Indian vehicle repair estimates and workshop bills. Extract ALL line items and totals. Return ONLY a JSON object:
{
  "workshop_name": "",
  "workshop_address": "",
  "vehicle_number": "",
  "chassis_number": "",
  "engine_number": "",
  "estimate_date": "",
  "bill_number": "",
  "spare_parts": [
    { "description": "", "part_number": "", "quantity": 1, "unit_price": 0, "amount": 0, "gst_percent": 18, "category": "metal or plastic or glass" }
  ],
  "labour_items": [
    { "description": "", "amount": 0, "gst_percent": 18 }
  ],
  "painting_items": [
    { "description": "", "amount": 0, "gst_percent": 18 }
  ],
  "subtotal_parts": 0,
  "subtotal_labour": 0,
  "subtotal_painting": 0,
  "gst_amount": 0,
  "total_amount": 0
}
Return ONLY the JSON. No explanation, no markdown, no backticks.`,

  'final-bill': `You are an expert at reading Indian FINAL WORKSHOP BILLS (Invoices). Extract ALL final billed line items. Return ONLY a JSON object:
{
  "workshop_name": "",
  "bill_number": "",
  "bill_date": "",
  "spare_parts": [
    { "description": "", "part_number": "", "quantity": 1, "unit_price": 0, "amount": 0, "gst_percent": 18, "category": "metal or plastic or glass" }
  ],
  "labour_items": [
    { "description": "", "amount": 0, "gst_percent": 18 }
  ],
  "painting_items": [
    { "description": "", "amount": 0, "gst_percent": 18 }
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
  "gross_vehicle_weight_kg": "",
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
  "gross_vehicle_weight_kg": "",
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
Return ONLY the JSON. No explanation, no markdown, no backticks.`
};
