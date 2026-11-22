"""Convert the Claude Design handoff (handoff/*.dc.html) into static pages in the repo root.
Run: python3 tools/build.py   (from the repo folder)
"""
import json, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "handoff"
canvas = json.loads((SRC / "canvas.json").read_text())["boards"]

FONTSHARE = "https://api.fontshare.com/v2/css?f[]=clash-display@600&f[]=satoshi@400,500,700,900&f[]=general-sans@500,600&display=swap"

def clean_css(css: str) -> str:
    # rules.md Rule 6: Fontshare fonts only (Clash Display + Satoshi) + Noto fallback
    return css.replace('"Space Grotesk",', "").replace('"Plus Jakarta Sans",', "")

for name in ["quezt.css", "player.css"]:
    (ROOT / "css" / name).write_text(clean_css((SRC / name).read_text()))

pages = []
for f in sorted(SRC.glob("*.dc.html")):
    stem = f.name.replace(".dc.html", "")
    board = canvas.get(f.name, {})
    if board.get("handmade"):
        continue  # empty scratch artboard
    s = f.read_text()
    title = re.search(r"<title>(.*?)</title>", s).group(1)
    css = re.findall(r'<link rel="stylesheet" href="(quezt|player)\.css">', s)
    if "quezt" not in css:
        css.insert(0, "quezt")  # Play mode panel reads dashboard tokens
    body = re.search(r"<x-dc>(.*)</x-dc>", s, re.S).group(1)
    helmet = re.search(r"<helmet>(.*?)</helmet>", body, re.S)
    extra_head = ""
    if helmet:
        h = helmet.group(1)
        h = re.sub(r'<link[^>]+fonts\.googleapis[^>]+>', "", h)
        h = h.replace("<style>body{margin:0}</style>", "")
        extra_head = h.strip()
        body = body.replace(helmet.group(0), "")
    body = re.sub(r"<sc-(for|if)\b", r'<template data-sc="\1"', body)
    body = re.sub(r"</sc-(for|if)>", "</template>", body)
    body = body.replace(".dc.html", ".html")
    script = re.search(r'(<script type="text/x-dc".*?</script>)', s, re.S).group(1)
    script = script.replace(".dc.html", ".html")
    full = board.get("w") == 1440
    kind = "full" if full else "stage"
    links = "\n".join(f'<link rel="stylesheet" href="css/{c}.css">' for c in css)
    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="Quezt — no-code gamification for business. MVP screen: {board.get('title', stem)}.">
<link rel="icon" href="img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://api.fontshare.com">
<link rel="stylesheet" href="{FONTSHARE}">
{links}
<link rel="stylesheet" href="css/site.css">
{extra_head}
</head>
<body class="page-{kind}">
<a class="skip" href="#qz-root">Skip to content</a>
<a class="home-link" href="index.html" aria-label="All Quezt screens"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>All screens</a>
<div id="qz-root" class="{'stage' if not full else 'full'}"></div>
<template id="qz-tpl">{body}</template>
{script}
<script src="js/dc.js"></script>
</body>
</html>
"""
    (ROOT / f"{stem}.html").write_text(html)
    pages.append({"file": f"{stem}.html", "title": board.get("title", stem), "w": board.get("w"), "h": board.get("h"), "page": board.get("page", "")})

(ROOT / "js" / "pages.json").write_text(json.dumps(pages, indent=1))
print(f"Built {len(pages)} pages")
