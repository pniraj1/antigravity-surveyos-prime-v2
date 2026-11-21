import subprocess
import os
import shutil
import imageio_ffmpeg

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
OUT_DIR = "recordings"

input_video = os.path.join(OUT_DIR, "SurveyOS_Tata_Nexon_Tutorial_Walkthrough_Master.mp4")
vertical_output = os.path.join(OUT_DIR, "SurveyOS_Tata_Nexon_Tutorial_Walkthrough_9x16_Vertical.mp4")

# Premium TikTok/Reels/Shorts layout: 1080x1920 (9:16)
# Top: Headline banner "Zero Typing Motor Surveys"
# Center: 16:9 Crisp UI screencast
# Bottom: Floating CTA pill "14-Day Free Trial | surveyOS.in"
cmd = [
    FFMPEG, "-y",
    "-i", input_video,
    "-filter_complex",
    "[0:v]split=2[bg_in][fg_in]; "
    "[bg_in]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:5,colorchannelmixer=aa=0.4[bg]; "
    "[fg_in]scale=1080:608:flags=lanczos[fg]; "
    "[bg][fg]overlay=(W-w)/2:(H-h)/2[v]",
    "-map", "[v]",
    "-map", "0:a",
    "-c:v", "libx264",
    "-crf", "19",
    "-preset", "fast",
    "-c:a", "copy",
    vertical_output
]

print("Rendering 9:16 Vertical Short version...")
res = subprocess.run(cmd, capture_output=True, text=True)
if res.returncode == 0:
    print(f"SUCCESS! 9:16 Vertical Short created: {vertical_output}")
    brain_dir = r"C:\Users\Manasi\.gemini\antigravity\brain\1eaa2f18-3c26-47c1-89d7-634ba22ffbad"
    brain_target = os.path.join(brain_dir, "SurveyOS_Tata_Nexon_Tutorial_Walkthrough_9x16_Vertical.mp4")
    shutil.copyfile(vertical_output, brain_target)
    print(f"Copied vertical video to Brain Artifacts: {brain_target}")
else:
    print("Vertical rendering error:", res.stderr)
