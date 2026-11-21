import asyncio
import edge_tts
import os

sample_text = "Ever sat at your desk at 11 PM, manually typing an 80-item dealer estimate into Excel? Watch how Motor SurveyOS finishes this entire Tata Nexon claim in sixty seconds."

voices = [
    ("prabhat", "en-IN-PrabhatNeural"),
    ("neerja_expressive", "en-IN-NeerjaExpressiveNeural"),
    ("andrew_multilingual", "en-US-AndrewMultilingualNeural"),
    ("brian_multilingual", "en-US-BrianMultilingualNeural")
]

async def test_voices():
    os.makedirs("recordings/voice_samples", exist_ok=True)
    for name, v in voices:
        out_file = f"recordings/voice_samples/{name}.mp3"
        print(f"Generating sample with {v}...")
        comm = edge_tts.Communicate(sample_text, v, rate="-2%")
        await comm.save(out_file)
        print(f"Saved {out_file}")

if __name__ == "__main__":
    asyncio.run(test_voices())
