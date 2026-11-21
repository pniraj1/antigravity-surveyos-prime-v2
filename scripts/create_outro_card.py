import subprocess
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg
import os

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
OUT_DIR = "recordings"

def create_outro():
    width, height = 1920, 1080
    img = Image.new("RGB", (width, height), color="#090E1A") # Deep Midnight Slate
    draw = ImageDraw.Draw(img)

    # Accent background glow in center
    # Subtle border
    draw.rectangle([40, 40, width - 40, height - 40], outline="#1E293B", width=2)
    draw.rectangle([46, 46, width - 46, height - 46], outline="#0EA5E9", width=1) # cyan accent

    # Try loading standard Windows system fonts
    font_bold_title = None
    font_sub = None
    font_cta = None
    font_small = None

    for font_name in ["segoeui.ttf", "arial.ttf", "calibri.ttf"]:
        try:
            font_path = os.path.join(r"C:\Windows\Fonts", font_name)
            font_bold_path = os.path.join(r"C:\Windows\Fonts", "segoeuib.ttf") if font_name == "segoeui.ttf" else font_path
            font_bold_title = ImageFont.truetype(font_bold_path, 68)
            font_sub = ImageFont.truetype(font_path, 34)
            font_cta = ImageFont.truetype(font_bold_path, 40)
            font_small = ImageFont.truetype(font_path, 28)
            break
        except:
            pass

    if not font_bold_title:
        font_bold_title = ImageFont.load_default()
        font_sub = font_bold_title
        font_cta = font_bold_title
        font_small = font_bold_title

    # Header
    brand_text = "Motor SurveyOS Prime"
    draw.text((width // 2, 280), brand_text, fill="#FFFFFF", font=font_bold_title, anchor="mm")

    # Subtitle
    sub_text = "IRDAI-Compliant Motor Insurance Survey & Loss Assessment Platform"
    draw.text((width // 2, 370), sub_text, fill="#94A3B8", font=font_sub, anchor="mm")

    # Divider bar
    draw.line([(width // 2 - 250, 430), (width // 2 + 250, 430)], fill="#0EA5E9", width=3)

    # CTA Button Box
    cta_box = [width // 2 - 400, 500, width // 2 + 400, 600]
    draw.rounded_rectangle(cta_box, radius=16, fill="#0284C7", outline="#38BDF8", width=2)
    draw.text((width // 2, 550), "Sign In to Start Your 14-Day Free Trial", fill="#FFFFFF", font=font_cta, anchor="mm")

    # Domain URL
    url_text = "surveyOS.in"
    draw.text((width // 2, 660), url_text, fill="#38BDF8", font=font_cta, anchor="mm")

    # Made in India & Team badge
    bottom_tag = "Proudly Made in India  |  SurveyOS Team"
    draw.text((width // 2, 850), bottom_tag, fill="#64748B", font=font_small, anchor="mm")

    outro_img_path = os.path.join(OUT_DIR, "outro_card.png")
    img.save(outro_img_path)
    print(f"Saved outro image to {outro_img_path}")

    # Generate 5-second video using FFmpeg
    outro_video_path = os.path.join(OUT_DIR, "outro_card.mp4")
    cmd = [
        FFMPEG, "-y",
        "-loop", "1",
        "-i", outro_img_path,
        "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
        "-c:v", "libx264",
        "-t", "5",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-shortest",
        outro_video_path
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode == 0:
        print(f"Successfully generated 5s outro video: {outro_video_path}")
    else:
        print("Outro video generation error:", res.stderr)

if __name__ == "__main__":
    create_outro()
