#!/usr/bin/env python3
"""Build docs/index.html from content/guide.md.

Usage:  pip install markdown-it-py   (once)
        python3 build/build.py
Output: docs/index.html  (docs/assets/* are hand-written, not generated)
"""
import html
import json
import re
from pathlib import Path

from markdown_it import MarkdownIt

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "content" / "guide.md"
OUT = ROOT / "docs" / "index.html"
PDF_URL = ("https://github.com/Xx-D3V-xX/temp/blob/main/"
           "CS413%20Blockchain%20Lab%20Exam%20Guide%20(Labs%201-9).pdf")

# html=False: any raw HTML in the markdown is escaped, never injected.
md = MarkdownIt("commonmark", {"html": False}).enable("table")


def slug(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s[:48].strip("-") or "section"


def split_headings(lines, prefix):
    """Split lines on lines starting with `prefix`, ignoring fenced code blocks."""
    chunks, cur, in_fence = [], [], False
    head = None
    for ln in lines:
        if ln.startswith("```"):
            in_fence = not in_fence
        if not in_fence and ln.startswith(prefix):
            chunks.append((head, cur))
            head, cur = ln[len(prefix):].strip(), []
        else:
            cur.append(ln)
    chunks.append((head, cur))
    return chunks  # first chunk has head None (text before first heading)


def render(lines):
    return md.render("\n".join(lines))


def plain(text):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html.unescape(text))).strip()


def inline(text):
    """Heading text -> safe inline HTML (handles `code` and backslash escapes)."""
    return md.renderInline(text)


def inline_plain(text):
    return plain(inline(text))


raw = SRC.read_text(encoding="utf-8").splitlines()
_, *sections = split_headings(raw, "## ")

META = []  # nav info
BODIES = []
FLASH = []

for idx, (title, body) in enumerate(sections):
    m = re.match(r"Lab (\d+):\s*(.*)", title)
    if m:
        sid, short, subtitle = f"lab{m.group(1)}", f"Lab {m.group(1)}", m.group(2)
        kind = "lab"
    elif title.lower().startswith("rapid-fire"):
        sid, short, subtitle, kind = "viva", "Viva bank", title, "viva"
    else:
        sid, short, subtitle, kind = "overview", "Overview", title, "overview"

    first_chunk = split_headings(body, "### ")
    lead_md = first_chunk[0][1]
    subs = first_chunk[1:]

    # Flashcards come from the viva table: | Lab | Question | Short answer |
    if kind == "viva":
        for ln in body:
            cells = [c.strip() for c in re.split(r"(?<!\\)\|", ln.strip().strip("|"))]
            if len(cells) == 3 and cells[0].isdigit():
                clean = lambda t: t.replace("\\|", "|").replace("`", "")
                FLASH.append({"lab": int(cells[0]), "q": clean(cells[1]), "a": clean(cells[2])})

    seen = set()
    sub_html, chips = [], []
    for stitle, sbody in subs:
        base = f"{sid}--{slug(stitle)}"
        sub_id, n = base, 2
        while sub_id in seen:
            sub_id, n = f"{base}-{n}", n + 1
        seen.add(sub_id)
        chips.append((sub_id, stitle))
        sub_html.append(
            f'<details class="sub" id="{sub_id}" open>'
            f'<summary><h3>{inline(stitle)}</h3>'
            f'<label class="done" title="Mark this part as done">'
            f'<input type="checkbox" data-sub="{sub_id}"><span>Done</span></label></summary>'
            f'<div class="sub-body">{render(sbody)}</div></details>'
        )

    chip_html = "".join(
        f'<a href="#{sid}" data-jump="{cid}">{html.escape(inline_plain(ct))}</a>' for cid, ct in chips
    )
    META.append({"id": sid, "short": short, "subtitle": subtitle, "n": len(chips), "kind": kind})
    BODIES.append(
        f'<section class="panel" id="{sid}" data-kind="{kind}" data-total="{len(chips)}">'
        f'<header class="panel-head"><p class="eyebrow">{html.escape(short)}</p>'
        f'<h2>{inline(subtitle)}</h2>'
        + (f'<div class="progress" aria-hidden="true"><i></i></div>'
           f'<p class="progress-label"></p>' if kind != "viva" else "")
        + f'<nav class="chips" aria-label="Sections in this lab">{chip_html}</nav></header>'
        f'<div class="lead">{render(lead_md)}</div>'
        + "".join(sub_html)
        + "</section>"
    )

nav_items = "".join(
    f'<li><a href="#{m["id"]}" data-nav="{m["id"]}"><b>{html.escape(m["short"])}</b>'
    f'<span>{html.escape(inline_plain(m["subtitle"]))}</span><em class="pct"></em></a></li>'
    for m in META
)

flash_json = json.dumps(FLASH).replace("</", "<\\/")
nav_json = json.dumps(META).replace("</", "<\\/")

page = f"""<!doctype html>
<html lang="en" data-theme="auto">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CS413 Blockchain Lab Exam Guide</title>
<meta name="description" content="Interactive guide for the CS413 Blockchain Technology lab end-semester exam: nine labs with code, test inputs, error fixes and viva answers.">
<link rel="stylesheet" href="assets/style.css">
<link id="hl-light" rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
<link id="hl-dark" rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css" disabled>
<script>document.documentElement.classList.add('js')</script>
</head>
<body>
<header class="topbar">
  <button id="menu" aria-label="Toggle menu" aria-expanded="false">&#9776;</button>
  <a class="brand" href="#overview">CS413 <span>Lab Exam Guide</span></a>
  <div class="search"><input id="q" type="search" placeholder="Search commands, errors, viva...  ( / )" autocomplete="off" aria-label="Search the guide"></div>
  <button id="theme" aria-label="Toggle dark mode" title="Toggle dark mode">&#9790;</button>
</header>

<div class="layout">
  <aside id="sidebar">
    <ul>{nav_items}
      <li class="sep"></li>
      <li><a href="#flashcards" data-nav="flashcards"><b>Flashcards</b><span>Viva drill, shuffle by lab</span><em class="pct"></em></a></li>
    </ul>
    <div class="side-tools">
      <button id="expand">Expand all</button>
      <button id="collapse">Collapse all</button>
      <button id="reset">Reset progress</button>
      <a href="{PDF_URL}" target="_blank" rel="noopener">PDF copy</a>
    </div>
  </aside>

  <main id="main">
    <div id="results" class="results" hidden></div>
    {''.join(BODIES)}
    <section class="panel" id="flashcards" data-kind="flash">
      <header class="panel-head"><p class="eyebrow">Practice</p><h2>Viva flashcards</h2></header>
      <div class="lead"><p>Read the question, answer aloud, then flip. Use the lab filter to drill the lab you were allotted.</p></div>
      <div class="fc-controls">
        <label>Lab <select id="fc-lab"><option value="0">All labs</option></select></label>
        <button id="fc-shuffle">Shuffle</button>
        <span id="fc-count"></span>
      </div>
      <button id="fc-card" class="fc-card" aria-live="polite"><small id="fc-side">Question</small><p id="fc-text"></p><em>Click or press Space to flip</em></button>
      <div class="fc-nav"><button id="fc-prev">&larr; Previous</button><button id="fc-next">Next &rarr;</button></div>
    </section>
    <footer>Built from the CS413 lab exam paper. Commands and versions on the exam machines may differ: read the supplied starter files first.</footer>
  </main>
</div>

<script id="flash-data" type="application/json">{flash_json}</script>
<script id="nav-data" type="application/json">{nav_json}</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js" defer></script>
<script src="assets/app.js" defer></script>
</body>
</html>
"""

OUT.write_text(page, encoding="utf-8")
print(f"wrote {OUT.relative_to(ROOT)}  ({len(page)//1024} KB)  "
      f"{len(META)} sections, {sum(m['n'] for m in META)} parts, {len(FLASH)} flashcards")
