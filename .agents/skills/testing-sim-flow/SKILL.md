---
name: testing-sim-flow
description: Test the Kairos clinical-simulation flow end-to-end (landing → reception → patient → investigation → reflection). Use when verifying UI/layout changes or engine wiring in builtbyrhl/kairos.
---

# Testing the Kairos simulation flow

## Run the app
- `npm install` then `npm run dev` → http://localhost:3000 (no auth, no secrets needed).
- Verify checks with `npx tsc --noEmit` and `npm run build`. `npm test` runs Vitest.

## The golden-path flow (what to click)
1. `/` (landing) → click **Begin Shift**. A ~6s cinematic plays, then it `router.push('/reception')` during the white "threshold" phase. Wait ~7s after clicking before expecting the URL to change.
2. `/reception` → click **Begin Assessment →**. This is where the engines run: `generatePatientCase` → `generateEncounter` → `createSession`, then routes to `/patient`.
3. `/patient` → tabs: Overview, History, Investigations, Treatment, Timeline.
   - **Investigations** tab → **Order** on any item (e.g. 12-Lead ECG). Expect a Result panel, a toast, clinical time to advance, and the tab counter to increment.
4. Overview → **Complete Encounter →** → **View Performance Report →** → `/reflection` shows score/grade, category bars, and per-hook clinical decisions.

## Session state gotcha
- Session lives in `SessionProvider` inside the `(hospital)` route-group layout. Navigating to a marketing route (e.g. `/`) unmounts it, so `/patient` will redirect to `/reception` if you arrive without generating a case. Always start each run from `/reception` → Begin Assessment (or from the landing Begin Shift).
- `/hospital` and `/nurse-briefing` are orphaned narrative pages; their links don't create a session, so they dead-end. Not part of the real flow.

## CSS / layout gotcha (high value)
`app/globals.css` is **unlayered**, so its rules beat Tailwind's `@layer utilities` regardless of specificity. Two classes of bug to watch for:
- A universal reset like `* { margin:0; padding:0 }` in globals.css silently zeroes **every** Tailwind spacing utility app-wide (`px-*`, `py-*`, `mx-auto`, `space-y-*`, `gap` is a separate property and survives). Symptom: cards/rows jammed together.
- Bare element selectors (`body`, `header`, `main`, `footer`) styled for the landing page leak into every route. Landing-only styling should be scoped under `.landing-shell` (applied in `app/(marketing)/layout.tsx`).

**Strong layout assertion:** don't eyeball spacing — verify computed styles. On `/patient`, a card's `padding` should be non-zero (e.g. `24px`) and the grid `gap` non-zero (e.g. `16px`). On a broken build these compute to `0px`. Use the browser console: `getComputedStyle(cardEl).padding`.

## Scoring assertion
`/reflection` footer reads "Score: X/100 · N decisions evaluated". For the STEMI case there should be **7** hooks evaluated (ecg timing, cath-lab timing, antiplatelet, oxygen, echo-before-cath, nitrate-with-low-BP, atypical presentation). Fewer than 7 (or all auto-awarding full points) means the scoring-trigger registry mismatch has regressed.

## Repo convention
- `AGENTS.md`: this is a modified Next.js — consult `node_modules/next/dist/docs/` before changing routing/navigation APIs.

## Devin Secrets Needed
- None. Local, unauthenticated.
