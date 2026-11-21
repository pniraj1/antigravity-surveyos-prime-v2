import subprocess
import imageio_ffmpeg

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

filter_str = (
    "[0:a]adelay=500|500[a0]; "
    "[1:a]adelay=8500|8500[a1]; "
    "[2:a]adelay=18500|18500[a2]; "
    "[3:a]adelay=28500|28500[a3]; "
    "[4:a]adelay=44500|44500[a4]; "
    "[5:a]adelay=52500|52500[a5]; "
    "[6:a]adelay=58500|58500[a6]; "
    "[7:a]adelay=65000|65000[a7]; "
    "[a0][a1][a2][a3][a4][a5][a6][a7]amix=inputs=8:normalize=0[out]"
)

cmd = [
    FFMPEG, "-y",
    "-i", "recordings/seg1_intro.mp3",
    "-i", "recordings/seg2_docs.mp3",
    "-i", "recordings/seg3_details.mp3",
    "-i", "recordings/seg4_assessment.mp3",
    "-i", "recordings/seg5_billcheck.mp3",
    "-i", "recordings/seg6_reports.mp3",
    "-i", "recordings/seg7_photos.mp3",
    "-i", "recordings/seg8_cta.mp3",
    "-filter_complex", filter_str,
    "-map", "[out]",
    "-t", "70.56",
    "recordings/master_voiceover.mp3"
]

print("Running FFmpeg audio mix...")
res = subprocess.run(cmd, capture_output=True, text=True)
print("Return code:", res.returncode)
if res.returncode != 0:
    print("Stderr:", res.stderr)
else:
    print("Successfully created recordings/master_voiceover.mp3!")
