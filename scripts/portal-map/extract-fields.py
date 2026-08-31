import json, sys, re
from html.parser import HTMLParser

FIELD = {"input", "select", "textarea"}

class Grab(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows, self.cur, self.text = [], None, []
        self.stack, self.hidden = [], 0
        self.last_text = ""
    VOID = {"input", "br", "hr", "img", "meta", "link"}
    def handle_starttag(self, tag, attrs):
        a = {k.lower(): (v if v is not None else True) for k, v in attrs}
        cls, sty = str(a.get("class", "")), str(a.get("style", ""))
        hid = "ng-hide" in cls or "display: none" in sty or "display:none" in sty
        if tag in FIELD:
            r = {"tag": tag, "attrs": a, "label_hint": self.last_text.strip()[-70:], "options": [],
                 "hidden": self.hidden > 0 or hid}
            self.rows.append(r)
            self.cur = r if tag == "select" else None
        if tag not in self.VOID:
            self.stack.append(hid); self.hidden += 1 if hid else 0
        elif tag == "option" and self.cur is not None:
            self.cur["options"].append({"value": a.get("value", ""), "text": ""})
            self.text = []
    def handle_endtag(self, tag):
        if tag not in self.VOID and self.stack:
            self.hidden -= 1 if self.stack.pop() else 0
        if tag == "option" and self.cur is not None and self.cur["options"]:
            self.cur["options"][-1]["text"] = "".join(self.text).strip()
            self.text = []
        elif tag == "select":
            self.cur = None
    def handle_data(self, d):
        self.text.append(d)
        if d.strip():
            self.last_text = (self.last_text + " " + d.strip())[-200:]

def norm(r):
    a = r["attrs"]
    model = a.get("data-ng-model") or a.get("ng-model")
    typ = a.get("type") or ("select" if r["tag"] == "select" else "textarea")
    out = {
        "name": a.get("name"), "id": a.get("id"), "type": typ, "model": model,
        "label_hint": r["label_hint"] or None,
        "value": a.get("value") if typ in ("radio", "checkbox") else None,
        "placeholder": a.get("placeholder"),
        "maxlength": a.get("maxlength"),
        "pattern": a.get("ng-pattern") or a.get("data-ng-pattern"),
        "readonly": True if a.get("readonly") else None,
        "datepicker": True if "datepicker" in a else None,
        "required": a.get("required") or a.get("ng-required") or a.get("data-ng-required"),
        "disabled_when": a.get("data-ng-disabled") or a.get("ng-disabled"),
        "show_when": a.get("ng-show") or a.get("data-ng-show") or a.get("ng-if"),
        "bool_values": [a.get("data-ng-true-value"), a.get("data-ng-false-value")] if a.get("data-ng-true-value") else None,
        "ng_options": a.get("ng-options"),
        "options": r["options"] or None,
        "hidden": True if r.get("hidden") else None,
    }
    return {k: v for k, v in out.items() if v not in (None, "", [])}

src = sys.argv[1]
raw = open(src, encoding="utf8", errors="replace").read()
raw = re.sub(r"<!--.*?-->", "", raw, flags=re.S)  # dead markup, not on the page
p = Grab(); p.feed(raw)
rows, seen = [], set()
for r in p.rows:
    n = norm(r)
    key = (n.get("name"), n.get("id"), n.get("type"), n.get("value"), n.get("model"))
    if key in seen: continue
    seen.add(key); rows.append(n)

groups = {}
for r in rows:
    g = r["model"].rsplit(".", 1)[0] if r.get("model") else "(no-model)"
    groups.setdefault(g, []).append(r)

json.dump({"file": src, "total": len(rows), "groups": groups},
          open(sys.argv[2], "w", encoding="utf8"), indent=1, ensure_ascii=False)
print(f"{src} -> {len(rows)} fields")
for g, v in sorted(groups.items(), key=lambda x: -len(x[1])):
    print(f"{len(v):5}  {g}")
