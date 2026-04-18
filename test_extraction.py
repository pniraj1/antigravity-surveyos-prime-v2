"""
Test script to validate the extraction quality of the DTC Proforma Invoice
using the Gemini 2.5 Flash model directly.
"""
import sys
import os
# Force UTF-8 output on Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
import base64
import json
import sys
import os

# pip install google-generativeai Pillow pdf2image PyMuPDF
try:
    import fitz  # PyMuPDF
except ImportError:
    print("Installing PyMuPDF...")
    os.system(f"{sys.executable} -m pip install PyMuPDF")
    import fitz

try:
    import requests
except ImportError:
    print("Installing requests...")
    os.system(f"{sys.executable} -m pip install requests")
    import requests


API_KEY = "AIzaSyCiUeCBJkMHpthFCr6sf5qCyMBIWYXrV80"
MODEL = "gemini-2.5-flash"
PDF_PATH = r"C:\Users\Manasi\OneDrive\Desktop\Antigravity Surveyor V6 fixed\SurveyOS-Prime-V2\photosheetsforreview_extracted\DTC Proforma Invoice-1.PDF"

PROMPT = """You are an expert at reading Indian vehicle repair estimates, proforma invoices, and workshop bills (e.g. Tata DTC, Maruti MGA, Hyundai etc.).

CRITICAL RULES:
1. Extract EVERY SINGLE line item from ALL pages. Do NOT stop at page 1. This document may have 50-80+ items across 3-5 pages.
2. Classify each item into one of three categories based on these rules:
   - spare_parts: Physical parts (HSN code starting with 87xx, 85xx, 27xx, 35xx etc.). These have part_number columns.
   - labour_items: Labour/service charges (SAC code starting with 9987). Descriptions contain words like "REPLACE", "R & R", "REMOVE", "FITMENT CHARGES", "DIAGNOSIS", "CUTTING", "WELDING", "GAS CHARGES". Do NOT put these in spare_parts.
   - painting_items: Painting jobs (SAC 9987). Descriptions contain "PAINTING", "SOLID COLOUR", "METALLIC COLOUR", "TOUCH UP". Do NOT put these in labour_items.
3. For "amount": use the FINAL INVOICE AMOUNT (last column with GST included), NOT the taxable/base amount.
4. For "category" on spare_parts: classify as "metal", "plastic", or "glass" based on the part name:
   - glass: windshield, window, mirror glass
   - plastic: bumper, cladding, grille, garnish, cap, air duct, skid plate, fender liner
   - metal: everything else (brackets, radiator, intercooler, hinges, cross member, structural parts, headlamp assy, fan assy, airbag, sensor, seat belt)
5. Look at the LAST PAGE for summary totals: "Final Parts Invoice Amount", "Final Labour Invoice Amount", "Gross Amount", "Total Tax".

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
Return ONLY the JSON. No explanation, no markdown, no backticks."""

def pdf_to_images(pdf_path):
    """Convert PDF pages to base64 JPEG images."""
    doc = fitz.open(pdf_path)
    images = []
    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        # 1.5x zoom for good OCR quality while keeping file size small
        mat = fitz.Matrix(1.5, 1.5)
        pix = page.get_pixmap(matrix=mat)
        img_bytes = pix.tobytes("jpeg", 80)
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        images.append(b64)
        print(f"  Page {page_num + 1}: {len(img_bytes) / 1024:.0f} KB")
    doc.close()
    return images

def call_gemini(prompt, images):
    """Call Gemini API with images."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={API_KEY}"
    
    parts = []
    for img in images:
        parts.append({
            "inlineData": {
                "mimeType": "image/jpeg",
                "data": img
            }
        })
    parts.append({"text": prompt})
    
    body = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "temperature": 0.1,
            "topP": 0.95,
            "topK": 40,
            "maxOutputTokens": 65536,
            "responseMimeType": "application/json"
        },
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
        ]
    }
    
    print(f"\n[API] Calling Gemini {MODEL}...")
    resp = requests.post(url, json=body, timeout=120)
    
    if resp.status_code != 200:
        print(f"[ERROR] API Error {resp.status_code}: {resp.text[:500]}")
        sys.exit(1)
    
    data = resp.json()
    text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
    
    # Clean markdown fences if present
    text = text.replace("```json", "").replace("```", "").strip()
    return text

def main():
    print(f"[PDF] {PDF_PATH}")
    print(f"[MODEL] {MODEL}")
    print(f"\n--- Converting PDF to images ---")
    
    images = pdf_to_images(PDF_PATH)
    print(f"\n[OK] Converted {len(images)} pages")
    
    raw = call_gemini(PROMPT, images)
    
    try:
        result = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"\n[ERROR] JSON Parse Error: {e}")
        print(f"Raw response (first 2000 chars):\n{raw[:2000]}")
        sys.exit(1)
    
    # Analysis
    parts = result.get("spare_parts", [])
    labour = result.get("labour_items", [])
    painting = result.get("painting_items", [])
    
    print(f"\n{'='*60}")
    print(f"EXTRACTION RESULTS")
    print(f"{'='*60}")
    print(f"  Workshop: {result.get('workshop_name', 'N/A')}")
    print(f"  Vehicle:  {result.get('vehicle_number', 'N/A')}")
    print(f"  Bill #:   {result.get('bill_number', 'N/A')}")
    print(f"  Date:     {result.get('estimate_date', 'N/A')}")
    
    print(f"\n  [PARTS] Spare Parts: {len(parts)} items")
    parts_total = 0
    for i, p in enumerate(parts, 1):
        amt = p.get("amount", 0)
        parts_total += amt
        print(f"     {i:2d}. {p.get('description', '?')[:50]:50s} ₹{amt:>10,.2f}  [{p.get('category', '?')}]")
    print(f"     {'':50s} {'─'*15}")
    print(f"     {'SUBTOTAL':50s} ₹{parts_total:>10,.2f}")
    
    print(f"\n  [LABOUR] Labour Items: {len(labour)} items")
    labour_total = 0
    for i, l in enumerate(labour, 1):
        amt = l.get("amount", 0)
        labour_total += amt
        print(f"     {i:2d}. {l.get('description', '?')[:50]:50s} ₹{amt:>10,.2f}")
    print(f"     {'':50s} {'─'*15}")
    print(f"     {'SUBTOTAL':50s} ₹{labour_total:>10,.2f}")
    
    print(f"\n  [PAINT] Painting Items: {len(painting)} items")
    painting_total = 0
    for i, p in enumerate(painting, 1):
        amt = p.get("amount", 0)
        painting_total += amt
        print(f"     {i:2d}. {p.get('description', '?')[:50]:50s} ₹{amt:>10,.2f}")
    print(f"     {'':50s} {'─'*15}")
    print(f"     {'SUBTOTAL':50s} ₹{painting_total:>10,.2f}")
    
    print(f"\n  [AI TOTALS] Reported Totals from AI:")
    print(f"     Parts:    ₹{result.get('subtotal_parts', 0):>10,.2f}")
    print(f"     Labour:   ₹{result.get('subtotal_labour', 0):>10,.2f}")
    print(f"     Painting: ₹{result.get('subtotal_painting', 0):>10,.2f}")
    print(f"     GST:      ₹{result.get('gst_amount', 0):>10,.2f}")
    print(f"     TOTAL:    ₹{result.get('total_amount', 0):>10,.2f}")
    
    print(f"\n  [CALC] Calculated from items:")
    print(f"     Parts:    ₹{parts_total:>10,.2f}")
    print(f"     Labour:   ₹{labour_total:>10,.2f}")
    print(f"     Painting: ₹{painting_total:>10,.2f}")
    print(f"     SUM:      ₹{parts_total + labour_total + painting_total:>10,.2f}")
    
    # Save raw JSON for inspection
    out_path = os.path.join(os.path.dirname(PDF_PATH), "extraction_result.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"\n  [SAVED] Full JSON saved to: {out_path}")

if __name__ == "__main__":
    main()
