import os
from PIL import Image, ImageDraw, ImageFont

# Source image
img_path = r"C:\Users\Manasi\.gemini\antigravity\brain\1eaa2f18-3c26-47c1-89d7-634ba22ffbad\surveyos_goa_surveyor_1794108742194.jpg"
out_path = r"C:\Users\Manasi\.gemini\antigravity\brain\1eaa2f18-3c26-47c1-89d7-634ba22ffbad\surveyos_launch_poster_branded.jpg"

img = Image.open(img_path).convert("RGBA")
W, H = img.size

overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
draw = ImageDraw.Draw(overlay)

# Load fonts
try:
    font_bold = ImageFont.truetype("arialbd.ttf", 36)
    font_sub = ImageFont.truetype("arial.ttf", 22)
    font_headline = ImageFont.truetype("arialbd.ttf", 46)
    font_tag = ImageFont.truetype("arial.ttf", 26)
    font_contact = ImageFont.truetype("arialbd.ttf", 24)
    font_contact_sub = ImageFont.truetype("arial.ttf", 20)
except:
    font_bold = ImageFont.load_default()
    font_sub = font_bold
    font_headline = font_bold
    font_tag = font_bold
    font_contact = font_bold
    font_contact_sub = font_bold

# 1. Top Header Glass Bar
header_h = 130
draw.rectangle([(0, 0), (W, header_h)], fill=(15, 23, 42, 235)) # Deep slate with opacity

# Draw Motor SurveyOS Logo
# SVG geometry scaled:
# Left bracket: (19, 8) -> (8, 8) -> (8, 56) -> (19, 56)
# Right bracket: (45, 8) -> (56, 8) -> (56, 56) -> (45, 56)
# M: (21.5, 40) -> (21.5, 22.4) -> (32, 32.6) -> (42.5, 22.4) -> (42.5, 40)
# Oxide line: (21.5, 45.4) to (42.5, 48.5) in #B03C26
lx, ly = 40, 25
scale = 1.3
def sx(val): return lx + (val - 8) * scale
def sy(val): return ly + (val - 8) * scale

# Draw logo mark
line_w = int(4 * scale)
draw.line([(sx(19), sy(8)), (sx(8), sy(8)), (sx(8), sy(56)), (sx(19), sy(56))], fill=(255, 255, 255, 255), width=line_w)
draw.line([(sx(45), sy(8)), (sx(56), sy(8)), (sx(56), sy(56)), (sx(45), sy(56))], fill=(255, 255, 255, 255), width=line_w)
draw.line([(sx(21.5), sy(40)), (sx(21.5), sy(22.4)), (sx(32), sy(32.6)), (sx(42.5), sy(22.4)), (sx(42.5), sy(40))], fill=(255, 255, 255, 255), width=int(line_w * 1.1))
# Oxide red baseline
draw.rectangle([(sx(21.5), sy(45.4)), (sx(42.5), sy(48.5))], fill=(176, 60, 38, 255))

# Brand Title & Eyebrow
draw.text((lx + 85, ly + 5), "Motor SurveyOS", fill=(255, 255, 255, 255), font=font_bold)
draw.text((lx + 87, ly + 46), "For IRDAI-Licensed Motor Surveyors · Made by Er. Niraj Patil", fill=(203, 213, 225, 255), font=font_sub)

# Right Pill: Try Without Account
pill_w, pill_h = 290, 48
px, py = W - pill_w - 40, ly + 14
draw.rounded_rectangle([(px, py), (px + pill_w, py + pill_h)], radius=24, fill=(176, 60, 38, 255))
draw.text((px + 28, py + 10), "Live Sandbox · No Login", fill=(255, 255, 255, 255), font=font_contact)

# 2. Hero Headline Banner in upper center
hero_top = 160
draw.rectangle([(40, hero_top), (W - 40, hero_top + 140)], fill=(15, 23, 42, 195))
draw.text((65, hero_top + 20), "Surveying is your assessment. The rest is just typing.", fill=(255, 255, 255, 255), font=font_headline)
draw.text((65, hero_top + 80), "Work from anywhere in the cloud. Don't be chained to one desktop at home.", fill=(254, 215, 170, 255), font=font_tag)

# 3. Bottom Comprehensive Contact & Action Footer
footer_h = 160
draw.rectangle([(0, H - footer_h), (W, H)], fill=(15, 23, 42, 245))

# Column 1: Website
draw.text((45, H - footer_h + 25), "TRY THE SOFTWARE", fill=(148, 163, 184, 255), font=font_contact_sub)
draw.text((45, H - footer_h + 55), "🌐 surveyos.in", fill=(255, 255, 255, 255), font=font_bold)
draw.text((45, H - footer_h + 105), "Zero-Login Sandbox · Test Your Estimate PDF", fill=(203, 213, 225, 255), font=font_contact_sub)

# Column 2: Direct WhatsApp & Call
draw.text((560, H - footer_h + 25), "DIRECT SURVEYOR SUPPORT & ACCESS", fill=(148, 163, 184, 255), font=font_contact_sub)
draw.text((560, H - footer_h + 55), "💬 WhatsApp / Call: +91 94220 00000", fill=(34, 197, 94, 255), font=font_bold) # Green WhatsApp style
draw.text((560, H - footer_h + 105), "Talk to Er. Niraj Patil (Practising Surveyor, Pune)", fill=(203, 213, 225, 255), font=font_contact_sub)

# Column 3: Email & Trust
draw.text((1100, H - footer_h + 25), "OFFICIAL CONTACT", fill=(148, 163, 184, 255), font=font_contact_sub)
draw.text((1100, H - footer_h + 55), "✉️ surveyosprime@gmail.com", fill=(255, 255, 255, 255), font=font_contact)
draw.text((1100, H - footer_h + 105), "Data Stays in India (Mumbai AWS/GCP)", fill=(148, 163, 184, 255), font=font_contact_sub)

# Merge and save
final = Image.alpha_composite(img, overlay).convert("RGB")
final.save(out_path, quality=95)
print("Saved branded poster to:", out_path)
