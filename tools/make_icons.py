"""Erzeugt die PNG-Icons der Erweiterung (16/32/48/128 px)."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

out = Path(sys.argv[1])
S = 512
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle((16, 16, S - 16, S - 16), radius=110, fill=(15, 118, 110, 255))
# Preisschild
tag = [(110, 150), (300, 150), (410, 256), (300, 362), (110, 362)]
d.polygon(tag, fill=(255, 255, 255, 255))
d.ellipse((318, 236, 358, 276), fill=(15, 118, 110, 255))
font = None
for f in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
          "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf"]:
    if Path(f).exists():
        font = ImageFont.truetype(f, 190)
        break
d.text((205, 258), "€", fill=(15, 118, 110, 255), font=font, anchor="mm")
for size in (16, 32, 48, 128):
    img.resize((size, size), Image.LANCZOS).save(out / f"icon-{size}.png")
print("ok")
