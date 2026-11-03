# CS414 ITIMM Lab Exam Guide

Interactive study site for the CS414 IT Infrastructure Monitoring and Management lab exam: all twelve labs
with commands, test inputs, expected outputs, common errors and viva answers.

Live site: https://xx-d3v-xx.github.io/temp/

## Features
- Sidebar per lab, collapsible parts with "Done" checkboxes (progress kept in your browser)
- Search (press `/`), copy buttons on code, dark mode, viva flashcards

## Rebuild
```
pip install markdown-it-py
python3 build/build.py   # content/guide.md -> docs/index.html
```
Pushing to `main` deploys `docs/` through the GitHub Actions Pages workflow.

The PDF copy is `CS414 ITIMM Lab Exam Guide (Labs 1-12).pdf`.
