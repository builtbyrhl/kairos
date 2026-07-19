---
name: testing-sim-flow
description: Test the Kairos clinical-simulation flow end-to-end (landing → reception → nurse-briefing → patient → investigation/treatment → outcome → reflection). Use when verifying UI/layout changes or engine wiring in builtbyrhl/kairos.
---

# Testing the Kairos simulation flow

## Run the app
- `npm install` then `npm run dev` → http://localhost:3000 (no auth, no secrets needed). If 3000 is busy it uses 3001.
- Verify checks with `npx tsc --noEmit` and `npm run build`. `npm test` runs Vitest. `npx eslint .` lints.

## The golden-path flow (what to click)
1. `/` (landing) → click **Begin Shift**. A ~6s cinematic plays, then it `router.push('/reception')` during the white "threshold" phase. Wait ~7s after clicking before expecting the URL to change.
2. `/reception` → click **Begin Assessment →**. This is where the engines run: `generatePatientCase` → `generateEncounter` → `createSession`, then routes to **`/nurse-briefing`**.
3. `/nurse-briefing` → shows the LIVE generated patient (name/age/sex, chief complaint, real vitals grid). It must NOT say "Ramesh Kumar" or show static 118 / 94/62 / 93% / 37.2 — that was the old hardcoded version. Click **Accept Shift →** → `/patient`.
4. `/patient` → tabs: Overview, History, Investigations, Treatment, Timeline. The identity card must match the patient from the briefing (same generated name).
   - **Investigations** tab → **Order** on any item (e.g. 12-Lead ECG). Expect a Result panel, a toast, clinical time to advance, and the tab counter to increment.
   - **Treatment** tab → fill dose + route inputs then **Administer** (e.g. Aspirin 300mg oral). Expect "Administered at N min" and the Treatment counter to increment.
5. Overview → **Complete Encounter →**. The encounter card shows "Encounter closed" with a **See Outcome →** button → `/outcome`.
6. `/outcome` → cinematic consequence screen driven by the scoring engine: headline names the SAME patient with a score-derived fate (≥80% "is stable", ≥40% "is critical but alive", <40% "did not survive"), plus real recorded counts (clinical minutes, treatments, tests). Click **Clinical Reflection →** → `/reflection`.
7. `/reflection` → score/grade, category bars, per-hook clinical decisions. Footer reads "Score: X/100 · N decisions evaluated".

## Session state gotcha
- Session lives in `SessionProvider` inside the `(hospital)` route-group layout. Navigating to a marketing route (e.g. `/`) unmounts it, so hospital routes will redirect to `/reception` (or `/patient`) if you arrive without a session. Always start each run from the landing **Begin Shift** or from `/reception` → Begin Assessment. Each run generates a NEW random patient — identity differing between runs is expected.
- **All in-flow navigation must be client-side** (`router.push`/`next/link`), never raw `<a href>` — a full document navigation wipes the in-memory session.
- **Reception guard race (regression watch):** `/reception` has a `useEffect` that forwards an already-initialized session to `/patient`. It is gated by a `startingHere` ref so a case generated in reception still proceeds to `/nurse-briefing`. If Begin Assessment ever jumps straight to `/patient` (skipping the briefing), that ref gating has regressed.

## CSS / layout gotcha (high value)
`app/globals.css` is **unlayered**, so its rules beat Tailwind's `@layer utilities` regardless of specificity. Two classes of bug to watch for:
- A universal reset like `* { margin:0; padding:0 }` in globals.css silently zeroes **every** Tailwind spacing utility app-wide (`px-*`, `py-*`, `mx-auto`, `space-y-*`; `gap` is a separate property and survives). Symptom: cards/rows jammed together.
- Bare element selectors (`body`, `header`, `main`, `footer`) styled for the landing page leak into every route. Landing-only styling should be scoped under `.landing-shell` (applied in `app/(marketing)/layout.tsx`).

**Strong layout assertion:** don't eyeball spacing — verify computed styles. On `/patient`, a card's `padding` should be non-zero (e.g. `24px`) and the grid `gap` non-zero (e.g. `16px`). On a broken build these compute to `0px`. Use the browser console: `getComputedStyle(cardEl).padding`.

## Scoring assertion
`/reflection` footer reads "Score: X/100 · N decisions evaluated". For the STEMI case there should be **7** hooks evaluated (ecg timing, cath-lab timing, antiplatelet, oxygen, echo-before-cath, nitrate-with-low-BP, atypical presentation). Fewer than 7 (or all auto-awarding full points) means the scoring-trigger registry mismatch has regressed. The `/outcome` tier should be consistent with the score % (high score → "stable").

## Repo convention
- `AGENTS.md`: this is a modified Next.js — consult `node_modules/next/dist/docs/` before changing routing/navigation APIs.

## Devin Secrets Needed
- None. Local, unauthenticated.
