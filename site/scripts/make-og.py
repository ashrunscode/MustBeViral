"""Draw public/og.png (1200x630), the link preview image. Run: python scripts/make-og.py"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
PAPER, INK, SIGNAL, MUTED = (244, 241, 234), (21, 20, 19), (255, 90, 31), (98, 94, 86)
CREAM, WALL, GLASS, GOLD = (
    (251, 246, 236),
    (239, 230, 214),
    (159, 202, 240),
    (255, 194, 61),
)
FONTS = Path("C:/Windows/Fonts")


def font(names, size):
    for n in names:
        p = FONTS / n
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default(size)


big = font(["seguibl.ttf", "segoeuib.ttf", "arialbd.ttf"], 86)
small = font(["seguisb.ttf", "segoeui.ttf", "arial.ttf"], 30)
mono = font(["CascadiaMono.ttf", "consola.ttf"], 24)

im = Image.new("RGB", (W, H), PAPER)
d = ImageDraw.Draw(im)

# A reel frame on the right, holding a shop front.
fx0, fy0, fx1, fy1 = 850, 60, 1150, 590
d.rounded_rectangle((fx0 + 14, fy0 + 16, fx1 + 14, fy1 + 16), radius=34, fill=SIGNAL)
d.rounded_rectangle(
    (fx0, fy0, fx1, fy1), radius=34, fill=(255, 196, 140), outline=INK, width=4
)
d.rectangle((fx0 + 4, 400, fx1 - 4, fy1 - 30), fill=(150, 139, 124))
d.rounded_rectangle(
    (fx0 + 4, fy1 - 60, fx1 - 4, fy1 - 4), radius=30, fill=(150, 139, 124)
)
for i in range(3):
    x = fx0 + 24 + i * 88
    d.rounded_rectangle((x, fy0 + 20, x + 78, fy0 + 25), radius=2, fill=(255, 255, 255))
# shop body, window, door
sx0, sx1 = fx0 + 36, fx1 - 36
d.rectangle((sx0, 236, sx1, 400), fill=WALL, outline=INK, width=4)
d.rectangle((sx0 + 22, 268, sx0 + 132, 352), fill=GLASS, outline=INK, width=4)
d.polygon(
    [(sx0 + 40, 350), (sx0 + 110, 270), (sx0 + 128, 270), (sx0 + 58, 350)],
    fill=(216, 238, 255),
)
d.rounded_rectangle((sx1 - 78, 278, sx1 - 22, 400), radius=8, fill=INK)
d.ellipse((sx1 - 40, 334, sx1 - 30, 344), fill=GOLD)
# awning stripes
ax0, ax1, ay0, ay1 = sx0 - 14, sx1 + 14, 200, 246
stripe = (ax1 - ax0) / 8
for i in range(8):
    d.rectangle(
        (ax0 + i * stripe, ay0, ax0 + (i + 1) * stripe, ay1),
        fill=SIGNAL if i % 2 == 0 else CREAM,
    )
d.rectangle((ax0, ay0, ax1, ay1), outline=INK, width=4)
# caption chip, sized to its text
cap = font(["seguisb.ttf", "segoeui.ttf", "arial.ttf"], 24)
w1, w2 = d.textlength("Shot 1", font=cap), d.textlength("the door", font=cap)
cw = w1 + 10 + w2 + 32
cx0 = (fx0 + fx1) / 2 - cw / 2
d.rounded_rectangle((cx0, 440, cx0 + cw, 482), radius=10, fill=(255, 255, 255), outline=INK, width=3)
d.text((cx0 + 16, 447), "Shot 1", font=cap, fill=(226, 71, 15))
d.text((cx0 + 16 + w1 + 10, 447), "the door", font=cap, fill=INK)

# Words, left side
d.rounded_rectangle((70, 70, 118, 118), radius=12, fill=SIGNAL)
d.ellipse((82, 86, 106, 110), outline=INK, width=4)
d.text((134, 76), "Must Be Viral", font=small, fill=INK)
d.text((70, 196), "Your photos in.", font=big, fill=INK)
d.text((70, 300), "Good reels out.", font=big, fill=SIGNAL)
d.text((72, 470), "AI social autopilot · in development", font=small, fill=INK)
d.text((72, 520), "FOR LOCAL BUSINESSES · WAITLIST OPEN", font=mono, fill=MUTED)

out = Path(__file__).resolve().parent.parent / "public" / "og.png"
im.save(out, optimize=True)
print(out, out.stat().st_size)
