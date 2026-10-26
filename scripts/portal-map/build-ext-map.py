# scripts/portal-map/build-ext-map.py
"""
Overlay + extractor JSON -> extension map + hosted copy + PII-free fixture.

  python scripts/portal-map/build-ext-map.py nia-nontieup

Fails loudly when an overlay model path is not present in the capture (E9).
"""
import json, sys, html, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
HERE = pathlib.Path(__file__).resolve().parent

def load(p):
    return json.loads(p.read_text(encoding="utf8"))

def main(flow):
    overlay = load(HERE / f"{flow}.overlay.json")
    capture = load(HERE / f"{flow}-survey.json")
    by_model = {}
    for fields in capture["groups"].values():
        for f in fields:
            if f.get("model"):
                by_model.setdefault(f["model"], []).append(f)

    shared = sorted(overlay["fields"].keys() & overlay["files"].keys())
    if shared:
        sys.exit(f"overlay keys in both fields and files: {shared}")

    missing = [k for k, v in {**overlay["fields"], **overlay["files"]}.items()
               if v["model"] not in by_model]
    if missing:
        sys.exit(f"overlay paths not in capture: {missing}")

    def entry(v):
        e = {"modelPath": v["model"], "kind": v.get("kind", "text"), "empty": v.get("empty", "")}
        for k in ("label", "transform", "options", "maxLen", "from", "constant", "onlyIf"):
            if k in v:
                e[k] = v[k]
        return e

    need = ("portal", "flow", "version", "host", "route", "modelRoot", "claimNoPath", "doneHint")
    absent = [k for k in need if not overlay.get(k)]
    if absent:
        sys.exit(f"overlay header missing: {absent}")
    unlabeled = [k for k, v in overlay["fields"].items() if not v.get("label")]
    if unlabeled:
        sys.exit(f"overlay fields without label: {unlabeled}")
    optional = ("controller", "claimNoFallback", "invoiceCountPath")
    out = {k: overlay[k] for k in need + optional if k in overlay}
    out["fields"] = {k: entry(v) for k, v in overlay["fields"].items()}
    out["files"] = {k: {"modelPath": v["model"]} for k, v in overlay["files"].items()}

    text = json.dumps(out, indent=2) + "\n"
    for dest in (ROOT / "extension/maps" / f"{flow}.json", ROOT / "public/portal-maps" / f"{flow}.json"):
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(text, encoding="utf8")

    write_fixture(flow, overlay, by_model)
    print("ok", len(out["fields"]), "fields")

def write_fixture(flow, overlay, by_model):
    """One input per overlay path, same data-ng-model / type / name / radio values as
    the capture, no captured values. AngularJS 1.4.3 from cdnjs; a stub controller
    that mirrors the model roots so $setViewValue has somewhere to land."""
    rows = []
    for canon, v in {**overlay["fields"], **overlay["files"]}.items():
        for f in by_model[v["model"]]:
            t = f.get("type", "text")
            name = html.escape(f.get("name") or canon)
            model = html.escape(f["model"])
            if t == "radio":
                val = html.escape(str(f.get("value", "")))
                rows.append(f'<label>{name} {val} <input type="radio" name="{name}" value="{val}" data-ng-model="{model}"></label>')
            elif t == "select":
                clock = {"hour": 24, "minute": 60}.get(v.get("transform"))
                if clock:
                    opts = {f"{i:02d}": f"{i:02d}" for i in range(clock)}
                else:
                    # ponytail: option values as the live NIA page has them (saved page 2026-10-26), not guesses
                    opts = v.get("options", {"1": "1", "2": "2", "3": "3"}) if canon == "noOfInvoices" else v.get("options", {"CONSOLIDATED": "Consolidated", "BREAK UP": "Break-up"})
                os_ = "".join(f'<option value="{html.escape(k)}">{html.escape(str(x))}</option>' for k, x in opts.items())
                rows.append(f'<label>{name} <select name="{name}" data-ng-model="{model}" data-ng-change="log(\'{canon}\')"><option value="">--Select--</option>{os_}</select></label>')
            elif t == "file":
                rows.append(f'<label>{name} <input type="file" name="{name}" accept=".xls,.xlsx" data-ng-model="{model}" onchange="window.__fileChanged=(this.files[0]||{{}}).name"></label>')
            elif t == "textarea":
                rows.append(f'<label>{name} <textarea name="{name}" data-ng-model="{model}" data-ng-change="log(\'{canon}\')"></textarea></label>')
            else:
                rows.append(f'<label>{name} <input type="{t}" name="{name}" data-ng-model="{model}" data-ng-change="log(\'{canon}\')"></label>')
    body = "\n".join(rows)
    if overlay.get("invoiceCountPath"):
        body = (f'<div ng-repeat="inv in {overlay["invoiceCountPath"]} track by $index">'
                f'<h4>Invoice {{{{$index+1}}}}</h4>\n{body}\n</div>')
    ctrl = overlay.get("controller", "FixtureCtrl")
    paths = [v["model"] for v in {**overlay["fields"], **overlay["files"]}.values()] + [overlay["claimNoPath"]]
    page = f"""<!doctype html>
<html ng-app="fixture"><head><meta charset="utf-8"><title>{overlay['portal'].upper()} {flow} fixture</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/angular.js/1.4.3/angular.min.js"></script>
<style>label{{display:block;margin:4px 0;font:13px system-ui}}input,select,textarea{{margin-left:6px}}</style>
</head><body ng-controller="{ctrl}">
<h3>Fixture — {flow}. Claim <span id="claimNo">{{{{{overlay['claimNoPath']}}}}}</span></h3>
<p>Set a claim number: <input data-ng-model="{overlay['claimNoPath']}"> · ng-change log: <code>{{{{changes.join(', ')}}}}</code></p>
{body}
<script>
if (!location.hash) location.hash = '{overlay['route']}';
// Build every parent object of every mapped model path; [$index] -> a one-element array.
function ensure(o, path) {{
  var parts = path.replace(/\\[[^\\]]+\\]/g, '.0').split('.'); parts.pop();
  for (var i = 0; i < parts.length; i++) {{
    if (!(parts[i] in o)) o[parts[i]] = parts[i + 1] === '0' ? [] : {{}};
    o = o[parts[i]];
  }}
}}
angular.module('fixture', []).controller('{ctrl}', ['$scope', function($scope) {{
  {json.dumps(paths)}.forEach(function(p) {{ ensure($scope, p); }});
  $scope.changes = [];
  $scope.log = function(k) {{ $scope.changes.push(k); }};
}}]);
</script></body></html>
"""
    dest = ROOT / "extension/fixture" / f"{flow}.html"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(page, encoding="utf8")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "nia-nontieup")
