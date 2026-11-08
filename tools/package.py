"""Packt den Ordner extension/ als dist/preiswaechter-<version>.zip.

Im Zip liegt ein Ordner "preiswaechter" mit manifest.json – nach dem Entpacken
wird genau dieser Ordner in Chrome geladen bzw. in Firefox seine manifest.json.
"""
import json
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent
ext = root / "extension"
version = json.loads((ext / "manifest.json").read_text(encoding="utf-8"))["version"]
dist = root / "dist"
dist.mkdir(exist_ok=True)
out = dist / f"preiswaechter-{version}.zip"
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for f in sorted(ext.rglob("*")):
        if f.is_file():
            z.write(f, Path("preiswaechter") / f.relative_to(ext))
print(out)
