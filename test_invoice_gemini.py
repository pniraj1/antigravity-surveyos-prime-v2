"""
Direct test: convert DTC Proforma Invoice-1.PDF to image and send to Gemini.
Run: python test_invoice_gemini.py
Requires: pip install pymupdf requests pillow
"""
import sys, base64, json, io, requests
from pathlib import Path

PDF_PATH = r"C:\Users\Manasi\OneDrive\Desktop\Antigravity Surveyor V6 fixed\SurveyOS-Prime-V2\photosheetsforreview_extracted\DTC Proforma Invoice-1.PDF"

# ── Gemini key — replace with your real AIza key ──────────────────────────────
# The AQ.../OAuth token from before is a short-lived access token that expires.
# We'll try both the oauth approach and report the exact error.
GEMINI_KEY   = "AIzaSyDBmJAFHt3SKk1VVhp2F3LxJiXi-dummy"   # <-- NOT REAL, replaced at runtime
MODEL        = "gemini-2.5-flash"
FALLBACK_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash-latest"]

PROMPT = """You are an expert at reading Indian vehicle repair estimates and workshop bills. 
Extract ALL line items and totals. Return ONLY a JSON object:
{
  "workshop_name": "",
  "vehicle_number": "",
  "estimate_date": "",
  "bill_number": "",
  "spare_parts": [
    { "description": "", "part_number": "", "quantity": 1, "unit_price": 0, "amount": 0 }
  ],
  "labour_items": [
    { "description": "", "amount": 0 }
  ],
  "total_amount": 0
}
Return ONLY the JSON. No explanation, no markdown, no backticks."""

def pdf_to_jpeg_base64(pdf_path: str, scale: float = 1.5) -> list[tuple[str, str]]:
    """Convert PDF pages to JPEG base64. Returns list of (mime, base64) tuples."""
    try:
        import fitz  # pymupdf
    except ImportError:
        print("ERROR: pymupdf not installed. Run: pip install pymupdf")
        sys.exit(1)

    doc = fitz.open(pdf_path)
    pages = []
    matrix = fitz.Matrix(scale, scale)
    
    for page_num in range(doc.page_count):
        page = doc[page_num]
        pix = page.get_pixmap(matrix=matrix)
        
        # Convert to JPEG in memory
        img_bytes = pix.tobytes("jpeg")
        b64 = base64.b64encode(img_bytes).decode('utf-8')
        size_kb = len(img_bytes) / 1024
        print(f"  Page {page_num+1}: {pix.width}x{pix.height}px, JPEG size: {size_kb:.1f} KB")
        pages.append(("image/jpeg", b64))
    
    doc.close()
    return pages

def call_gemini(key: str, model: str, images: list[tuple[str,str]], prompt: str):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    
    # Detect OAuth vs API key
    is_api_key = key.startswith("AIza")
    params = {"key": key} if is_api_key else {}
    headers = {"Content-Type": "application/json"}
    if not is_api_key:
        headers["Authorization"] = f"Bearer {key}"
    
    parts = [{"inlineData": {"mimeType": mime, "data": b64}} for mime, b64 in images]
    parts.append({"text": prompt})
    
    body = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 8192,
            "responseMimeType": "application/json"
        },
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
        ]
    }
    
    resp = requests.post(url, params=params, headers=headers, json=body, timeout=60)
    return resp

def main():
    if len(sys.argv) < 2:
        print("Usage: python test_invoice_gemini.py <YOUR_GEMINI_API_KEY>")
        print("  Example: python test_invoice_gemini.py AIzaSy...")
        sys.exit(1)
    
    key = sys.argv[1]
    print(f"\n{'='*60}")
    print(f"Testing DTC Proforma Invoice with Gemini")
    print(f"Key type: {'API Key (AIza...)' if key.startswith('AIza') else 'OAuth/Bearer token'}")
    print(f"PDF: {PDF_PATH}")
    print(f"{'='*60}\n")
    
    # 1. Convert PDF
    print("Step 1: Converting PDF to images...")
    if not Path(PDF_PATH).exists():
        print(f"ERROR: File not found: {PDF_PATH}")
        sys.exit(1)
    
    images = pdf_to_jpeg_base64(PDF_PATH, scale=1.5)
    print(f"  Total pages: {len(images)}\n")
    
    # 2. Try models in fallback order
    all_models = [MODEL] + FALLBACK_MODELS
    
    for model in all_models:
        print(f"Step 2: Calling Gemini [{model}]...")
        resp = call_gemini(key, model, images, PROMPT)
        
        print(f"  HTTP Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            candidate = data.get("candidates", [{}])[0]
            finish_reason = candidate.get("finishReason", "UNKNOWN")
            
            print(f"  Finish Reason: {finish_reason}")
            
            if finish_reason == "SAFETY":
                print("\n  ⚠️  BLOCKED BY SAFETY FILTERS!")
                print("  This is the likely bug — Gemini is blocking the invoice due to")
                print("  personal/financial data. The safety settings should already be BLOCK_NONE.")
                safety_ratings = candidate.get("safetyRatings", [])
                for r in safety_ratings:
                    print(f"    {r.get('category')}: {r.get('probability')}")
                break
            
            text = candidate.get("content", {}).get("parts", [{}])[0].get("text", "")
            print(f"\n  ✅ SUCCESS with model: {model}")
            print(f"  Raw response (first 500 chars):\n  {text[:500]}")
            
            try:
                parsed = json.loads(text)
                print(f"\n  Parsed JSON keys: {list(parsed.keys())}")
                print(f"  Workshop: {parsed.get('workshop_name', 'N/A')}")
                print(f"  Total Amount: {parsed.get('total_amount', 'N/A')}")
                parts_count = len(parsed.get('spare_parts', []))
                labour_count = len(parsed.get('labour_items', []))
                print(f"  Spare parts extracted: {parts_count}")
                print(f"  Labour items extracted: {labour_count}")
            except json.JSONDecodeError as e:
                print(f"\n  ⚠️  JSON PARSE ERROR: {e}")
                print(f"  Raw text: {text}")
            break
            
        else:
            err_data = resp.json()
            err_msg = err_data.get("error", {}).get("message", "Unknown")
            err_code = err_data.get("error", {}).get("code", resp.status_code)
            print(f"  ❌ FAILED [{err_code}]: {err_msg}")
            
            if resp.status_code == 404:
                print(f"  → Model '{model}' not found on this account. Trying next...")
                continue
            elif resp.status_code == 401 or resp.status_code == 403:
                print(f"  → AUTH ERROR: Key is invalid or expired!")
                print(f"    If you used an OAuth/AQ token, it has expired (they last ~1 hour).")
                print(f"    Get a permanent API key from: https://aistudio.google.com/apikey")
                break
            elif resp.status_code == 429:
                print(f"  → RATE LIMITED: Free tier quota exceeded.")
                break
            else:
                print(f"  → Full error: {json.dumps(err_data, indent=2)}")
                break
    
    print(f"\n{'='*60}")
    print("Test complete.")

if __name__ == "__main__":
    main()
