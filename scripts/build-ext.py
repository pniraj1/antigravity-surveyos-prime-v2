"""Regenerate the map, strip dev-only manifest matches, zip the extension."""
import json, pathlib, subprocess, sys, zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
EXT = ROOT / "extension"

subprocess.run([sys.executable, str(ROOT / "scripts/portal-map/build-ext-map.py"), "nia-nontieup"], check=True)

DEV = ("file://", "localhost")
manifest = json.loads((EXT / "manifest.json").read_text(encoding="utf8"))
for cs in manifest["content_scripts"]:
    cs["matches"] = [m for m in cs["matches"] if not any(bad in m for bad in DEV)]
text = json.dumps(manifest)
for bad in DEV:
    if bad in text:
        sys.exit(f"manifest.json still contains '{bad}' outside content_scripts.matches — remove it before building")

dist = EXT / "dist"; dist.mkdir(exist_ok=True)
out = dist / f"surveyos-portal-fill-{manifest['version']}.zip"
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("manifest.json", json.dumps(manifest, indent=2))
    for p in ["icons/icon128.png", "maps/nia-nontieup.json",
              "src/background.js", "src/relay.js", "src/panel.js", "src/panel.css", "src/filler.js",
              "src/lib/packet-validate.js", "src/lib/fill-core.js"]:
        z.write(EXT / p, p)
print("built", out)
