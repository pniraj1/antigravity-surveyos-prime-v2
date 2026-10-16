"""Regenerate the maps, strip dev-only manifest matches, zip the extension.

Also writes two folders Chrome can "Load unpacked" (the source folder can't be
loaded: Chrome rejects the `__tests__` directory):
  dist/unpacked/      same as the zip — live portals + motorsurveyos-in
  dist/unpacked-dev/  adds localhost:3000 and file:///* for the fixtures
"""
import copy, json, pathlib, shutil, subprocess, sys, zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
EXT = ROOT / "extension"

FLOWS = sorted(p.name[: -len(".overlay.json")] for p in (ROOT / "scripts/portal-map").glob("*.overlay.json"))
for flow in FLOWS:
    subprocess.run([sys.executable, str(ROOT / "scripts/portal-map/build-ext-map.py"), flow], check=True)

DEV = ("file://", "localhost")
source = json.loads((EXT / "manifest.json").read_text(encoding="utf8"))
manifest = copy.deepcopy(source)
for cs in manifest["content_scripts"]:
    cs["matches"] = [m for m in cs["matches"] if not any(bad in m for bad in DEV)]
text = json.dumps(manifest)
for bad in DEV:
    if bad in text:
        sys.exit(f"manifest.json still contains '{bad}' outside content_scripts.matches — remove it before building")

FILES = ["icons/icon128.png", *(f"maps/{flow}.json" for flow in FLOWS),
         "src/background.js", "src/relay.js", "src/panel.js", "src/panel.css", "src/filler.js",
         "src/lib/packet-validate.js", "src/lib/fill-core.js"]

dist = EXT / "dist"; dist.mkdir(exist_ok=True)
out = dist / f"surveyos-portal-fill-{manifest['version']}.zip"
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("manifest.json", json.dumps(manifest, indent=2))
    for p in FILES:
        z.write(EXT / p, p)
print("built", out)

# Dev manifest: the source's localhost match, plus file:///* on the portal scripts
# (the ones that are not the SurveyOS relay) so the fixtures get the panel.
dev = copy.deepcopy(source)
for cs in dev["content_scripts"]:
    if "src/relay.js" not in cs["js"] and "file:///*" not in cs["matches"]:
        cs["matches"].append("file:///*")

for name, m in (("unpacked", manifest), ("unpacked-dev", dev)):
    folder = dist / name
    shutil.rmtree(folder, ignore_errors=True)
    for p in FILES:
        (folder / p).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(EXT / p, folder / p)
    (folder / "manifest.json").write_text(json.dumps(m, indent=2), encoding="utf8")
    print("wrote", folder)
