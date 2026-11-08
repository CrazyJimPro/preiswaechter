"""Erzeugt assets/icon.png (512 px), assets/icon.ico und assets/tray.png.

Aufruf: python3 tools/make_icon.py  (braucht Pillow und die Schrift DejaVu Sans)
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "assets"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
TEAL = (15, 118, 110, 255)
S = 1024

img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle((32, 32, S - 32, S - 32), radius=220, fill=TEAL)
d.polygon([(220, 300), (600, 300), (820, 512), (600, 724), (220, 724)], fill=(255, 255, 255, 255))
d.ellipse((636, 472, 716, 552), fill=TEAL)
d.text((410, 516), "€", fill=TEAL, font=ImageFont.truetype(FONT, 380), anchor="mm")

img.resize((512, 512), Image.LANCZOS).save(OUT / "icon.png")
img.resize((256, 256), Image.LANCZOS).save(OUT / "icon.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
img.resize((64, 64), Image.LANCZOS).save(OUT / "tray.png")

# Infobereich mit rotem Punkt: Es gibt etwas Neues
neu = img.copy()
dn = ImageDraw.Draw(neu)
dn.ellipse((600, 600, 1010, 1010), fill=(255, 255, 255, 255))
dn.ellipse((640, 640, 970, 970), fill=(220, 38, 38, 255))
neu.resize((64, 64), Image.LANCZOS).save(OUT / "tray-neu.png")
neu.resize((64, 64), Image.LANCZOS).save(OUT / "tray-neu.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64)])
img.resize((64, 64), Image.LANCZOS).save(OUT / "tray.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64)])
