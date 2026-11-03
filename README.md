# CS413 Blockchain Lab Exam Guide

Interactive study site for the CS413 lab end-semester exam: all nine labs with code, test inputs,
common errors and fixes, and viva theory.

**Features:** one lab per page, search (`/` to focus), copy buttons on every code block, per-part
"Done" ticks with progress (saved in your browser), collapse/expand, dark mode, viva flashcards,
works on mobile, printable.

## Deploy (GitHub Pages)

1. Push this repo to GitHub (already done if you are reading this there).
2. Repo **Settings -> Pages -> Build and deployment -> Source: GitHub Actions**.
3. The workflow in `.github/workflows/pages.yml` runs on every push to `main`, rebuilds the page
   and publishes `docs/`. Site URL: `https://xx-d3v-xx.github.io/temp/`.

(Alternative with no Actions: Settings -> Pages -> Source "Deploy from a branch", branch `main`,
folder `/docs`.)

## Edit the content

All text lives in `content/guide.md` (headings `##` = lab, `###` = collapsible part).

```bash
pip install markdown-it-py
python3 build/build.py          # regenerates docs/index.html
python3 -m http.server -d docs  # preview at http://localhost:8000
```

`docs/assets/style.css` and `docs/assets/app.js` are hand-written. Code highlighting loads from
the cdnjs CDN; everything else works offline.

The original PDF copy is `CS413 Blockchain Lab Exam Guide (Labs 1-9).pdf`.
