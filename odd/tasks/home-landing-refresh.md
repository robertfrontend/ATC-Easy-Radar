# Home landing refresh

## Objective
Refresh the ATC Easy Radar home landing page so new players can quickly understand and choose how to play, with Boston's sourced airport geography as a distinctive backdrop, while preserving the existing radar identity, Spanish-facing product context, route behavior, and accessibility.

## Problem and why
The current landing page is a dark monospace console with three similarly weighted destination links and a separate radar preview. Its copy mixes English and Spanish, and the hierarchy does not make the playable experience as clear as it could. The user asked to improve the landing page UI.

## Scope and constraints
- Restyle the landing page and its responsive presentation; preserve `/`, `/?setup=free`, `/challenges`, `/learning`, and tutorial launch behavior.
- Keep the three destinations and current labels/interactions expected by tests unless tests are adjusted only to match an approved preserved behavior.
- Keep airport/runway configuration, saved sessions, and route/query state intact.
- Follow the existing project visual language, but give the landing page a clearer aviation/radar-led hierarchy; use concise, consistent Spanish copy where appropriate.
- Do not alter pre-existing worktree changes in `package-lock.json`, `.atl/`, or `.codegraph/`.
- Remote operations: the user explicitly authorized pushing, creating the PR chain, and merging to `main` using GitHub CLI authenticated as `robertfrontend` (user-provided account email: `robert02frontend@gmail.com`).
- The Boston backdrop is decorative and separate from the currently selected gameplay airport; do not change default airport, tutorial, or setup behavior.
- On the landing page, remove the green vertical hero border and the entire foreground “Vista del sector”/`SectorPreview` panel; keep the Boston map as the visual background.

## Design direction
Instrument-panel editorial: retain the dark radar-green palette and monospace operational details, but give the headline and live sector preview dominant space; use a restrained runway/taxiway geometry motif rather than generic gradients or card grids. Keep primary play choice unmistakable, supporting learning/challenge routes secondary, and adapt the layout for narrow screens. Preserve keyboard focus visibility and reduced-motion behavior.

## TDD and checks
- TDD ON from retained explicit session configuration.
- Runner: `npm test` (Vitest); focused runner: `npm test -- src/components/HomePage.test.ts`.
- Observe a focused RED for changed/new behavior before implementation, then GREEN and refactor.
- Applicable checks: focused test, `npm run typecheck`, `npm run build`, `git diff --check`, and browser visual/responsive review if available.

## Delivery
- Route: delegated direct; mapping trigger fired because landing structure and behavior cross 4+ files; writer trigger applies because implementation touches multiple non-trivial files.
- Forecast at HLR-1 start: approximately 250–380 authored changed lines including tests and task document; delivery strategy `ask-on-risk`.
- Delivery strategy `ask-on-risk`; chain strategy selected by user: `feature-branch-chain`. The user has now authorized the GitHub CLI session for the destination repository and `main` merge.
- RDD is enabled globally; assess the actual work-unit candidate after commit and follow native consent/transitions. No prior candidate decision is assumed to cover this work.
- Engram mirror `odd/home-landing-refresh/tasks` pending: no authoritative runtime session ID is available, and project is not registered in Engram. Do not guess or register an ID.

## Checklist
- [x] HLR-1: Improved landing-page hierarchy and responsive UI while retaining all current entry points and state flows; added a focused test. Verified desktop rendering; mobile browser review remains pending.
- [x] HLR-2: Added a responsive, decorative Boston/KBOS geographic backdrop using existing sourced geometry; preserved selected airport/game setup and tested accessibility/independent selection behavior.
- [x] HLR-3: Removed the green vertical hero border and foreground `Vista del sector` preview panel, retaining the decorative Boston backdrop and selection/setup behavior; updated focused tests.
- [x] HLR-4: Removed the gray hero border and corrected the decorative Boston map's vertical orientation without changing gameplay geometry; updated focused tests.

## Acceptance criteria
- Existing destination routes, tutorial launch, keyboard focus transitions, and persistent setup state remain functional; the foreground sector preview is intentionally removed from the landing.
- Landing page has a distinctive radar-specific visual hierarchy and works on mobile/desktop; keyboard users retain visible focus.
- Focused tests, typecheck, production build, and diff check results are recorded honestly.
- A work-unit commit and its candidate risk/review status are recorded here.

## Progress and evidence
- Exploration confirmed `HomePage` owns both landing and free-play setup; styles live in `src/index.css`; navigation wrapper/state live in `src/App.tsx`; tests in `src/components/HomePage.test.ts` cover destinations, tutorial, preview, focus, route/state behavior.
- Working tree already had user changes in `package-lock.json`, `.atl/`, and `.codegraph/`; preserved untouched.
- HLR-1 implementation is in place: the landing now uses a radar-led editorial hero with the selected sector preview, concise Spanish introduction, one emphasized free-play destination, and supporting challenge/learning destinations. Setup routes, tutorial launch, preview SVG semantics, session history, and setup state flow are unchanged.
- TDD evidence: added `frames the landing around the live sector preview and a clear Spanish primary action`; focused test failed before implementation because `.landing-hero` did not exist (RED), then passed after implementation (GREEN).
- Verification: `npm test -- src/components/HomePage.test.ts` — 7 passed; `npm run typecheck` — passed; `npm run build` — passed with a >500 kB bundle-size advisory; `git diff --check` — passed. Browser inspection at `localhost:3001` confirmed the desktop hero, preview, and three destination links render; mobile viewport was not separately inspected.
- Work-unit commit: `049c6ca` (`feat(home): refresh landing page experience`).
- Native RDD assessment: medium tier (`executable_change` in focused test); outcome `under budget` (359 authored changed lines against `main`, `review_due=false`). Slice remains pending until cumulative work reaches the delivery budget; no reviewer/consent transition is due for this commit.
- HLR-1 PR slice: #46, merged into the tracker; child work-unit commit `7a57eba`. Mobile viewport visual review remains unavailable.
- HLR-2 evidence: `initialHomeSetup()` still selects `AIRPORTS[0]` (EGLL). `getGeographicAirport()` opt-in adapts KBOS with sourced geographic data; `Terrain` and `GeographicSector` can render its landscape and physical runways without fabricating geometry. Keep the existing selected-airport `<SectorPreview>` separate. The map is unofficial, approximate, and must be identified as decorative/non-navigational.
- HLR-2 route: delegated direct; mapping trigger fired across `HomePage`, `SectorPreview`, `GeographicSector`, KBOS adapter/data, and map types. TDD ON (retained explicit session setting), runner `npm test` (Vitest), focused runner `npm test -- src/components/HomePage.test.ts`.
- HLR-2 implementation: added `BostonBackdrop` from the existing KBOS geography and physical-runway geometry as an `aria-hidden`, non-interactive decorative SVG; retained the hero's selected-airport `SectorPreview` and all setup defaults. Responsive CSS places the subdued map behind hero content and fades it on narrow screens. The terrain is explicitly approximate/decorative, not for navigation.
- HLR-2 TDD: new test failed RED before implementation because no `data-decorative-airport="KBOS"` layer existed; GREEN after implementation. Final focused test: 8 passed. `npm run typecheck`, `npm run build`, and `git diff --check` passed; build retains the >500 kB bundle advisory. Desktop browser review at `127.0.0.1:3010` confirmed the coastline/runway backdrop behind the EGLL hero preview; mobile visual review unavailable because the connected browser exposes no viewport override.
- HLR-2 delivery: user selected `feature-branch-chain`; chain order is tracker → HLR-1 → HLR-2 → HLR-3 → HLR-4. Combined branch exceeds the 400-line review budget, so each behavior is a separate child PR. Remote PR/push/merge are now explicitly authorized via GitHub CLI.
- Parent verification: focused landing test 8/8 passed; `npm run typecheck`, `npm run build`, and `git diff --check` passed. Build warns that the minified JS bundle is >500 kB; Node reports a non-blocking `module.register()` deprecation. Desktop visual check passed; mobile viewport is not available for direct inspection, although responsive CSS is present.
- Work-unit commit: `d8d7ad8` (`feat(home): add Boston map backdrop`). Native RDD assessed the then-current range as medium, `review_due=true` (`slice_budget_reached`). The user later declined local native review and authorized continuing under ordinary checks.
- HLR-3 route: delegated direct; mapping spans `HomePage`, `HomePage.test.ts`, and `index.css`, and the writer trigger applies because implementation touches multiple non-trivial files. The user explicitly requested removing the green rail and whole foreground preview. TDD ON; runner `npm test` (Vitest), focused runner `npm test -- src/components/HomePage.test.ts`.
- HLR-3 TDD: updated hero and panel assertions first; focused run showed RED in 3 tests while the rail/panel remained. Removed the foreground panel only from landing; `SectorPreview` remains in free-play setup. Selected-airport metadata still changes independently from the KBOS backdrop. Final focused test: 8 passed.
- HLR-3 verification: `npm run typecheck`, `npm run build`, and `git diff --check` passed; build retains >500 kB bundle advisory. Desktop browser review confirmed no green rail or foreground panel, Boston backdrop remains, metadata and action links remain, and keyboard focus outline is visible on the tutorial button. Mobile viewport was not visually available; confirmed the existing 767px single-column rule and mobile map fade/placement remain intact in CSS.
- HLR-3 delivery: commit `2a9e65f` (`feat(home): simplify landing hero`); child PR slice commit `2a17e49`, merged via PR #48 into the tracker.
- HLR-4 route: delegated direct; changes were isolated to the backdrop SVG, landing CSS, and focused test. TDD ON; runner `npm test` (Vitest), focused runner `npm test -- src/components/HomePage.test.ts`.
- HLR-4 TDD: added an orientation assertion first; focused test failed RED (1 failed, 7 passed), then passed GREEN (8/8) after flipping only the decorative SVG content.
- HLR-4 verification: `npm run typecheck`, `npm run build`, and `git diff --check` passed; build retains the >500 kB bundle advisory. No browser visual check was available for this small correction.
- HLR-4 delivery: commit `65eb25a` (`fix(home): remove hero border and flip Boston map`); child PR slice commit `3ef95e3`, merged via PR #49 into the tracker.
- Native RDD: the full committed candidate was medium risk with `review_due=true` (`slice_budget_reached`); the user declined local native review and explicitly authorized proceeding with the GitHub CLI session. Continue under ordinary repository checks, without starting a reviewer.
- PR delivery: user selected `feature-branch-chain` and authorized pushing, PR creation, and merge to `main` via GitHub CLI. Authenticated CLI account is `robertfrontend`; remote is `origin` (`robertfrontend/ATC-Easy-Radar`). Child PRs #46 (work-unit commit `7a57eba`), #47 (`3692aa5`), #48 (`2a17e49`), and #49 (`3ef95e3`) are merged into tracker PR #45. Preserve unrelated local changes in `package-lock.json`, `.atl/`, and `.codegraph/`.
- PR #45 is still draft/no-merge until the final tracker diff and CI are verified; then merge it into `main` if GitHub's required checks and permissions allow.
