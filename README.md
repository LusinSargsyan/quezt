# Quezt — Turn users into players

No-code gamification for business. MVP screens: the **dashboard** (with Play mode) and the **player widget**.
Built from the Claude Design handoff ([Quezt_Main](https://claude.ai/artifact/UPPPX14h7zPXM8MgkxKg9z)) using DESIGN.md v0.4 + rules.md.

**Live:** _add your Vercel link_ · **Repo:** _add your GitHub link_

## What's inside

| Path | What |
|---|---|
| `index.html` | Landing page: hero, product tabs, how it works, pricing, FAQ, pilot form, QR |
| `screens.html` | All 21 MVP screens |
| `Main.html` … `Settings.html` | Dashboard screens 1–8 (+ 4b Levels) |
| `WHub.html`, `P*.html` | Player widget (Night theme, Quezt Player DS) |
| `W*.html` | Widget v1 (light theme) |
| `dc.js` | Tiny runtime: renders the Claude Design screens + **Play mode** (dark, brand, states) saved in `localStorage` |
| `home.js` + `config.js` | Sign-up form → `localStorage` + Make webhook (Homework 7) |
| `handoff/` | Original Claude Design files (source of truth) |
| `tools/build.py` | Rebuilds the pages from `handoff/` → `python3 tools/build.py` |
| `automation.md` | Make scenario spec + tests + checklist |

No build step, no framework: plain HTML/CSS/JS. Vercel serves the folder as is.

## Design-system check (rules.md Rule 6 + 7)

| Found in handoff | Fix |
|---|---|
| Fonts loaded from Google: Plus Jakarta Sans + Space Grotesk ❌ Rule 6 | Replaced with [Fontshare](https://www.fontshare.com/) Clash Display + Satoshi, Noto fallback kept |
| 37 inline hex/rgba values in 12 screens (e.g. `#ffffff`, `#eceaf2`, `rgba(15,14,23,.12)`) | Same values as tokens → not wrong colors, but should be `var(--…)`. Open item. |

## Run locally
```bash
python3 -m http.server 8000   # open http://localhost:8000
```
