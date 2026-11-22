# automation.md — Quezt pilot sign-up (Homework 7)

**In one sentence:** when someone joins the pilot on the Quezt live site, Make saves them to a Google Sheet, emails Lusine, and sends the person a welcome email.

Status: **LIVE in Make** (built by Claude via the Make connector, 22 Nov 2026) · Owner: Lusine

| Item | Value |
|---|---|
| Scenario | `Quezt — pilot sign-up` · id 8739265 · team "My Team" · **active, runs immediately** |
| Webhook | `quezt-pilot-signup` → `https://hook.eu1.make.com/1b6anyw5d7nd47d0g3ee6yx3klpdu6yj` (in `config.js`) |
| Data store | `Quezt pilot list` (id 269227, key = email → no duplicates) |
| Phase 2 | Gmail + Google Sheets — needs your Google authorization in Make |

### Built now (phase 1)
`Webhook` → `Data store › Add/replace record` (key = email) → `Webhook response` (200, `{"ok":true}`, CORS `*`)


## Flow (4 modules, free plan)

| # | Make module | What it does | Credits / run |
|---|---|---|---|
| 1 | **Webhooks › Custom webhook** | Receives the form JSON from `index.html` (instant, not scheduled) | 1 |
| 2 | **Google Sheets › Add a row** | Sheet `Quezt pilot list`: Date · Name · Email · Company · Product · Goal · Source | 1 |
| 3 | **Gmail › Send an email** → Lusine | "New Quezt pilot sign-up: {{name}} ({{product}})" | 1 |
| 4 | **Gmail › Send an email** → sign-up | Welcome email (only if they ticked consent — the form blocks submit without it) | 1 |
| opt | **Anthropic Claude › Create a prompt** (between 1 and 3) | One-line lead summary + suggested first campaign from `goal` | 1 + AI usage |

≈ 4 credits per sign-up → ~250 sign-ups/month on the free plan (1,000 credits). Free = 2 active scenarios. ([Make pricing](https://www.make.com/pricing)) — this uses 1.

Form payload (from `js/home.js`, sent form-encoded so the browser needs no CORS preflight):
```json
{"name":"Test Person","email":"test@example.com","company":"","product":"E-commerce","goal":"","source":"quezt-live","created_at":"2026-11-22T18:00:00.000Z"}
```

## Build steps (≈10 min in the browser)

1. make.com → **Create scenario** → add **Webhooks › Custom webhook** → *Add* → name `quezt-pilot` → **Copy address**.
2. Paste it in `config.js` → `makeWebhook: 'https://hook.eu2.make.com/…'` → commit → push (Vercel redeploys).
3. In Make click **Run once**, then submit the form on the live site once → Make shows "Successfully determined" (data structure learned).
4. Add **Google Sheets › Add a row** → connect your Google account → pick the sheet (create it first with the 7 headers above) → map fields.
5. Add 2× **Gmail › Send an email** (connect your Gmail) → map `{{1.name}}`, `{{1.email}}`.
6. Save → turn **Scheduling ON** ("Immediately as data arrives").
7. Proof: **Run once** + submit the form → screenshot the run (green bubbles) + the new Sheet row + email → add to Notion.

## Test cases

| # | Input | Expected | Result |
|---|---|---|---|
| T1 | Valid name + email + consent | Record added, response `{"ok":true}` | ✅ 22 Nov (test1@example.com) |
| T2 | Empty email | Form blocks, error under field, Make **not** called | ✅ tested locally |
| T3 | No consent | Form blocks, Make not called | ✅ tested locally |
| T4 | Name with Armenian letters `Լուսինե` | Record shows the same text (UTF-8) | ✅ run OK · check text in Data store |
| T5 | Same email twice | 1 record, updated (key = email) | ✅ run OK · expect 2 records total, not 3 |
| T6 | Webhook URL wrong / Make off | Site shows `QZ-WL-001`, sign-up kept in browser | ☐ |
| T7 | Scenario OFF ("Immediately" not set) | Make queues the webhook; runs when turned on | ☐ |

## Where automations go wrong — checklist

- [ ] **Scenario left OFF** after Run once → nothing happens on Day X. Turn Scheduling ON.
- [ ] **Data structure not learned** → fields empty in Sheets. Re-run step 3.
- [ ] **CORS**: Make webhooks accept browser POSTs; if the site shows QZ-WL-001 with "Failed to fetch", add a **Webhook response** module (status 200, header `Access-Control-Allow-Origin: *`).
- [ ] **Connections expire** (Google) → re-authorize in Make › Connections.
- [ ] **Credits run out** (1,000/month) → scenario stops until next month.
- [ ] **Duplicates / spam** → add a filter (email contains "@") and dedupe (T5).
- [ ] **Personal data**: Sheet private, not "anyone with the link". Webhook URL is public in the site code — anyone could post to it; OK for a pilot list, not for anything sensitive.
- [ ] **Test before Day X** (25 Nov): Run once → submit → show the result arriving.

## Rules check
Facts vs hypotheses: credit numbers = fact ([Make pricing](https://www.make.com/pricing)); "~250 sign-ups/month" = calculation; no pilot names invented (rules.md Rule 5).
