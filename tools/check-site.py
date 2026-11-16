#!/usr/bin/env python3
"""Pre-merge checks for the static site in public/ (no dependencies).

Run: python3 tools/check-site.py
Fails if a local link or image is missing, if a live download/checkout/app link
appears while the site is still "coming soon", if a phone number or street
address shows up, if private-looking files are in public/, or if the draft
legal pages lose their DRAFT banner and noindex.
"""
import pathlib, re, sys
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote

ROOT = pathlib.Path(__file__).resolve().parent.parent / "public"
DRAFT_PAGES = {"privacy.html", "terms.html"}
REQUIRED = {"index.html", "support.html", "feedback.html", "subscribe.html", "manage.html", "privacy.html", "terms.html"}
errors = []

class Refs(HTMLParser):
    def __init__(self):
        super().__init__(); self.refs = []; self.tags = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs); self.tags.append((tag, a))
        for k in ("href", "src"):
            if a.get(k): self.refs.append((tag, k, a[k], a))

def local_target(base, ref):
    u = urlsplit(ref)
    if u.scheme or u.netloc or ref.startswith(("#", "mailto:", "data:")):
        return None
    if not u.path: return None
    return (base.parent / unquote(u.path)).resolve()

for name in sorted(REQUIRED):
    if not (ROOT / name).is_file(): errors.append(f"missing page: {name}")

text_files = [p for p in ROOT.rglob("*") if p.suffix in {".html", ".css", ".js"}]
for p in ROOT.rglob("*"):
    rel = p.relative_to(ROOT).as_posix()
    if re.search(r"(^|/)\.|\.(env|pem|p12|key|md|py|log|bak)$", rel):
        errors.append(f"file that should not be public: {rel}")

for p in text_files:
    rel = p.relative_to(ROOT).as_posix(); s = p.read_text(encoding="utf-8")
    # Image paths in CSS url() and JS string literals.
    for m in re.finditer(r"""url\(\s*["']?([^"')]+)["']?\s*\)|["'`](assets/[^"'`$]+\.(?:png|jpe?g|webp|svg|gif))["'`]""", s):
        ref = m.group(1) or m.group(2)
        if ref.startswith(("data:", "http")) or "${" in ref: continue
        # In JS, paths are resolved from the page (public/), not the script.
        base = p if p.suffix == ".css" else ROOT / "index.html"
        t = local_target(base, ref)
        if t and not t.exists(): errors.append(f"{rel}: missing file {ref}")
    if re.search(r"deepfocus://", s): errors.append(f"{rel}: live deepfocus:// app link before launch")
    if re.search(r"https?://\S+\.dmg\b|checkout\.stripe\.com|buy\.stripe\.com|billing\.stripe\.com", s, re.I):
        errors.append(f"{rel}: live download or checkout link before launch")
    if re.search(r"(?<![\w.])(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}(?!\d)", s):
        errors.append(f"{rel}: looks like a phone number")
    if re.search(r"\b\d{1,5}\s+[A-Z][a-z]+(\s[A-Z][a-z]+)*\s(Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Boulevard|Blvd)\b\.?", s):
        errors.append(f"{rel}: looks like a street address")
    if p.suffix != ".html": continue
    r = Refs(); r.feed(s)
    for tag, k, ref, a in r.refs:
        t = local_target(p, ref)
        if t is not None and not t.exists(): errors.append(f"{rel}: broken {tag} {k}={ref}")
        if ref.startswith("#") and len(ref) > 1 and f'id="{ref[1:]}"' not in s:
            errors.append(f"{rel}: anchor {ref} has no target")
    for tag, a in r.tags:
        if "data-app-billing" in a or "data-destination" in a:
            if a.get("href") != "#availability" or a.get("aria-disabled") != "true":
                errors.append(f"{rel}: billing/download/support button must stay disabled until launch")
    if p.name in DRAFT_PAGES:
        if "DRAFT — not approved" not in s: errors.append(f"{rel}: lost its DRAFT banner")
        if 'name="robots" content="noindex' not in s: errors.append(f"{rel}: draft page must be noindex")

fb = (ROOT / "feedback.html").read_text(encoding="utf-8")
m = re.search(r'<meta name="feedback-endpoint" content="([^"]*)"', fb)
if not m: errors.append("feedback.html: missing feedback-endpoint meta")
elif m.group(1) and not re.fullmatch(r"https://[a-z0-9.-]+(:\d+)?/v1/feedback", m.group(1)):
    errors.append("feedback.html: feedback-endpoint must be empty or https://<host>/v1/feedback")
if 'name="website"' not in fb or 'class="trap"' not in fb:
    errors.append("feedback.html: lost the spam trap field")
if re.search(r"gh[pousr]_[A-Za-z0-9]{20,}|github_pat_", "".join(p.read_text(encoding="utf-8") for p in text_files)):
    errors.append("a GitHub token is in public/; it belongs only on the feedback service")

idx = (ROOT / "main.js").read_text(encoding="utf-8")
if not re.search(r"const DOWNLOAD_URL = ''", idx):
    errors.append("main.js: DOWNLOAD_URL is set; the download must stay 'coming soon' until the signed build is ready")

if errors:
    print("\n".join("FAIL " + e for e in errors)); sys.exit(1)
print(f"OK: {len(text_files)} files checked in {ROOT.name}/")
