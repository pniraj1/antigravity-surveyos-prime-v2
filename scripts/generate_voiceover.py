import asyncio
import os
import edge_tts

OUT_DIR = "recordings"

VOICE = "en-IN-PrabhatNeural"

SEGMENTS = [
    {
        "id": "seg1_intro",
        "text": "Every motor claim starts with zero typing in SurveyOS. Just create your claim with the vehicle registration number.",
        "start": 0.5,
    },
    {
        "id": "seg2_docs",
        "text": "Drop in your RC, driving licence, and policy copy. SurveyOS extracts vehicle details, IDV, and policy numbers in under ten seconds.",
        "start": 8.5,
    },
    {
        "id": "seg3_details",
        "text": "Check your Claim Details: Tata Nexon, 2022 manufacture, United India policy. Everything verified without manually re-typing a single digit.",
        "start": 18.5,
    },
    {
        "id": "seg4_assessment",
        "text": "In the Assessment Grid, metal, plastic, and glass depreciation are auto-calculated down to completed months. Plus, one-click export for the UIIC portal.",
        "start": 28.5,
    },
    {
        "id": "seg5_billcheck",
        "text": "Reconcile workshop bills with zero mismatch queries. Discrepancies are flagged instantly before you file.",
        "start": 44.5,
    },
    {
        "id": "seg6_reports",
        "text": "Generate print-ready final survey reports in your insurer's official format with a single click.",
        "start": 52.5,
    },
    {
        "id": "seg7_photos",
        "text": "Automatic photo sheets compressed under 1.95 megabytes for instant portal upload without email bounces.",
        "start": 58.5,
    },
    {
        "id": "seg8_cta",
        "text": "Sign in to start your 14-day free trial on surveyOS dot in.",
        "start": 65.0,
    },
]

async def generate():
    print(f"Generating voiceover segments using {VOICE}...")
    for seg in SEGMENTS:
        file_path = os.path.join(OUT_DIR, f"{seg['id']}.mp3")
        communicate = edge_tts.Communicate(seg["text"], VOICE, rate="+3%")
        await communicate.save(file_path)
        print(f"Saved {file_path}")

if __name__ == "__main__":
    asyncio.run(generate())
