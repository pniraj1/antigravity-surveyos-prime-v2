import subprocess
import os
import shutil
import imageio_ffmpeg

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
OUT_DIR = "recordings"

main_video = os.path.join(OUT_DIR, "main_with_audio.mp4")
outro_video = os.path.join(OUT_DIR, "outro_card.mp4")
final_output = os.path.join(OUT_DIR, "SurveyOS_Tata_Nexon_Tutorial_Walkthrough_Master.mp4")

# Re-encode both streams to uniform sample rate 44100Hz stereo and 25fps before concat
cmd = [
    FFMPEG, "-y",
    "-i", main_video,
    "-i", outro_video,
    "-filter_complex",
    "[0:v]fps=25,format=yuv420p[v0]; [0:a]aformat=sample_rates=44100:channel_layouts=stereo[a0]; "
    "[1:v]fps=25,format=yuv420p[v1]; [1:a]aformat=sample_rates=44100:channel_layouts=stereo[a1]; "
    "[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]",
    "-map", "[v]",
    "-map", "[a]",
    "-c:v", "libx264",
    "-crf", "18",
    "-preset", "fast",
    "-c:a", "aac",
    "-b:a", "192k",
    final_output
]

print("Concatenating with clean stream alignment...")
res = subprocess.run(cmd, capture_output=True, text=True)
if res.returncode == 0:
    print("SUCCESS! Final output cleanly created.")
    brain_dir = r"C:\Users\Manasi\.gemini\antigravity\brain\1eaa2f18-3c26-47c1-89d7-634ba22ffbad"
    brain_target = os.path.join(brain_dir, "SurveyOS_Tata_Nexon_Tutorial_Walkthrough_Master.mp4")
    shutil.copyfile(final_output, brain_target)
    print(f"Updated Brain artifact at: {brain_target}")
else:
    print("Error:", res.stderr)
