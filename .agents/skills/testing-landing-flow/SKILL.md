---
name: testing-landing-flow
description: Test the Kairos landing → reception → reset flow end-to-end. Use when verifying changes to app/(marketing)/page.tsx, app/globals.css, fonts, or the cinematic transition.
---

# Testing the Kairos landing flow

## Run the app
- Install: `npm install` (or `npm ci`).
- Build + serve production (recommended when testing CSS/build output, since Tailwind v4 inlines `@import "tailwindcss"` only in the optimized build): `npm run build && npm start` → http://localhost:3000.
- Dev server: `npm run dev`.
- Verify build health: `npm run build` (runs `tsc`) and `npx tsc --noEmit` (strict). Note: `next build` in Next.js 16 does NOT run ESLint, so pre-existing lint errors don't block the Vercel deploy.

## Primary flow (`app/(marketing)/page.tsx`)
1. Landing page: hero "Kairos", ECG signature line, tagline, "Begin Shift" button.
2. Click **Begin Shift** → ~8.5s phased cinematic transition (commitment → environmental dissolve → heartbeat → terminal init lines → threshold → arrival).
3. Reception screen appears: "Patient Intake Queue" table (rows #KRS-901/442/811/203) + "Admissions Terminal 04" panel.
4. **Sign Out of Shift** → resets back to the landing page.

## Verifying fonts loaded (Google Fonts via @import in globals.css)
In the browser console: `document.fonts.check("16px 'Inter'")` and `document.fonts.check("16px 'JetBrains Mono'")` should both return `true`. The fonts `@import` must precede `@import "tailwindcss"` in `app/globals.css`, otherwise the production build emits an `@import rules must precede all rules` warning.

## Known gotcha — reception "Sign Out of Shift" may be unclickable
The rule `body.p2-environmental-shift header { opacity: 0; pointer-events: none }` in `app/globals.css` targets ALL `<header>` tags, and `body` keeps the `p2-environmental-shift` class after the transition. This can make the reception `<header>` (and its Sign Out button) invisible and unclickable via the UI. If a native click on the button does nothing, this is likely the cause. Workarounds to verify reset logic: trigger the handler directly (`document.getElementById('systemReset').click()`), or check `getComputedStyle(document.querySelector('.reception-header')).pointerEvents`. This may or may not be fixed in a given revision — check whether `body` still carries `p2-environmental-shift` in the reception state.

## Coordinate mapping for computer-use clicks
The computer tool uses a 1024x768 space mapped uniformly to the real display (check with `xrandr` / `xdotool getdisplaygeometry`). Browser chrome offset ≈ `window.outerHeight - window.innerHeight`; add it to `getBoundingClientRect().y` before scaling.

## Devin Secrets Needed
None — the app runs locally with no secrets or external services.
