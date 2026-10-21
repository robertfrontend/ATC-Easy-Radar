# Square playable radar

## Objective and authorized scope
Use the full square radar, including corners, without stretching planes/runways or changing coordinate units. User authorized inspecting and adjusting rendering, clipping, selection/commands, viewport, spawn/culling/bounds, zoom/pan, saved-state compatibility and responsive usability; draft PR/checks/merge/deployment through existing GitHub session authorized. Preserve Home preview/navigation/progress and gameplay rules except necessary square boundary geometry.

## Findings and accepted design
Map and canvas bloom have circular masks; aircraft SVG targets are already outside that mask. Uniform xMidYMid meet and inverse CTM already preserve coordinates. Distinct radii: visual560, spawn580, uncleared departure600, distant cull2500. Reuse world units, airport-centered square half-extents600 and2500 with existing strict/inclusive semantics. Default1400square camera retains100units framing margin; zoom/pan/resize never change world survival. Keep circular intake580 and spawn schedule/safety unchanged. Range circles remain reference guides, not masks. More diagonal room necessarily means longer diagonal exit time; do not promise identical effective difficulty. Preserve caps/rates/separation/physics/targets/five-minute duration and successful exit-fix handoff semantics.

## Evidence and constraints
Supplied Library screenshot libfile_e350078a8cd88191a35a45eb3f79a83f NOT VIEWED: no Library/materialization tool exposed in this executor; organizer reported two failed transfers. Do not guess URLs or use its transfer. Independent code evidence only until local browser screenshots. Existing mobile fixed320px sidebar severely squeezes radar; responsive stacking/console placement is within authorized radar-usability scope. No credentials created, no protection bypass, no unrelated .atl/.codegraph changes.

## Execution and delivery
- Base124dd353d058e9a7a28b3af738f6ec8491a5f695. Delegated direct per mapping4+ files and writer2+ non-trivial files.
- TDD ON (explicit user direction retained), npm test = vitest run; observed RED/GREEN/refactor required.
- RDD ON global. Parent assesses each committed candidate against previous boundary and follows native transition/consent if due; no fabricated approval.
- Forecast450–550 authored additions+deletions, generated files excluded. Delivery auto-chain, stacked-to-main: user explicitly authorized separate PRs where useful, automatic main integration and no routine technical confirmations. Two independently verified units, each aimed below400; never code-golf tests/spacing to fit. First PR bounds; second rendering/mobile built from merged first. Record actual counts/boundaries.
- Engram mirror PENDING odd/square-radar/tasks: runtime identity unavailable, writes prohibited.

## Tasks and acceptance
- [x] SQUARE-1 delegated: shared fixed world-square geometry, departure600 and distant2500 boundaries with exact exclusions/order/scoring preserved; corners/axial boundary/translated airports/cleared departures/handoff/legacy state regressions. No render change yet. Full tests/typecheck/build/diff check, coherent conventional commit and independent PR to main. Rollback only square boundary helper/consumers/tests/doc.
- [ ] SQUARE-2 delegated: remove circular SVG/canvas clipping, rectangular background/preview consistency, preserve rings/uniform CTM and click/heading/direct-to after zoom/pan/resize. Responsive square radar with sidebar/console below on mobile, preserving mounted controls/drafts and desktop behavior. Focused RED/GREEN/full checks; browser desktop/mobile corner commands/zoom/pan/resize and saved/progress compatibility; performance sanity. Separate work-unit/PR after SQUARE-1, green checks/merge/production asset verification.

## Progress
CodeGraph-backed mapping and focused source inspection verified design; Home preview PR23 deployed with442tests and exact JS/CSS production hashes. Prior local bookkeeping branches preserved. SQUARE-1 implementation and local checks complete; commit/publication pending parent approval.

### SQUARE-1 verification (before commit)
- Route: delegated direct; parent mapping found4+ files and the bounded writer touched2+ non-trivial files. Pure `squareExtent` uses max absolute airport-relative coordinates, constants600/2500; strict departure `>600` and distant `<2500` remain unchanged.
- RED before production changes: `npm test -- src/utils/radarBounds.test.ts` failed11/passed7; `npm test -- src/hooks/useGameLoop.test.ts -t 'corner departure'` failed1/skipped14. Failures were old circular removal of corner tracks, not setup errors.
- GREEN: `npm test -- src/utils/radarBounds.test.ts src/hooks/useGameLoop.test.ts src/utils/departureQueue.test.ts` passed41/41. Full `npm test` passed461/461 in26 files; `npm run typecheck`, `npm run build` and `git diff --check` passed.
- Coverage: all four signed corners inside/at/outside both square edges, all axial thresholds, translated centers, restored legacy planes without mutation/migration, arrival/cleared/crashed exclusions, marked removal priority and strict35-unit handoff. Real hook fake-clock regression confirms no premature missed event, then exactly one non-scoring missed exit after crossing.
- Refactor: shared helper/half-extent names replace radial terminology; existing departure queue simulation uses the same distant geometry. No schedule, safety, caps, separation, physics, challenge goal or rendering changes.
- Runtime: fake-clock actual `useGameLoop` test above passed. Browser QA deferred to SQUARE-2 because this unit does not alter rendering/input/camera. Source screenshot remains unavailable and unseen.
- Rollback: README bounds note; `src/utils/radarBounds.ts`, its test, boundary consumers in departure/approach, departureQueue test geometry and the corner hook regression. Other behavior and Home preview remain intact.
- Authored count before commit:159 source/test/README additions+deletions plus this feature document (count reported separately to parent). RDD assessment and commit identity pending parent; Engram mirror still prohibited without runtime identity.

## Next step
Parent inspects/commits/assesses/publishes SQUARE-1, then delegates SQUARE-2. Report any failed/unavailable check exactly, especially screenshot access and mobile input capabilities.

## SQUARE-1 release
Localf05cd1e and publication2868289 share treef2f3caa26877bc5bb5a6e6857b97258d3418f158; native medium196 under_budget. PR24 created draft, CI/Vercel success, ready and merged412c2f5a64dac9c31ffca0ed3d63d24087e4fc05. SQUARE-2 starts from this clean merged main on codex/square-radar-view; no polluted diff. Bounds tests cover461 checks; production verification pending final render release.


### SQUARE-2 local implementation (uncommitted)
- Delegated writer route, TDD ON. Removed only canvas circular clipping and SVG radarClip; retained range rings, existing inverse-CTM pointer handlers and default1400-unit square camera. ViewBox hit rectangle now follows the camera, and rectangular SVG overflow prevents map paint extending into mobile footer. No boundary/physics/spawn/progress changes.
- Mobile: square SVG followed by existing prediction/readback/zoom controls, then command console and one persistently mounted flight strip. Desktop retains sidebar; the console now uses a reserved flow footer at all widths after browser QA proved its old overlay intercepted the southeast corner. Canvas CSS dimensions follow the actual SVG to prevent stretching bloom when mobile footer grows. Preview uses a square background, retaining existing runway/fix geometry.
- RED observed before source edits: old circular mask, console nested in radar, and missing square preview background failed3 targeted regressions. One existing long tutorial additionally timed out under parallel load; unchanged standalone GamePage run passed12/12, then combined focused27/27 passed. No timeout/runner settings changed.
- Real RadarDisplay regressions: all four corner track mouse/Enter/Space selection; heading commands at all four corners via inverse CTM after zoom and drag plus non-square resize; no resize camera reset; direct-to transmits once and reset returns original1400-square view. Canvas callback verifies corner bloom paints with no clip. Existing mocked GamePage tests verify single strip persistence and responsive console/sidebar classes; browser geometry/hit-tests remain parent QA.
- Final checks: `npm test` passed468/468 across26files; `npm run typecheck`, `npm run build`, `git diff --check` passed. Existing DEP0205 deprecation warning only. Authored diff217lines includes16doclines (parent release evidence retained), no cosmetic compression. Assets `index-Ig7opt9A.js` / `index-Dd6NvYUn.css`. Final browser corner confirmation, commit/RDD/publication/deployment remain pending. Screenshot limitation unchanged.
- Queued user request (not started): game readability after square release. No readability research or implementation included here.

- Browser correction: parent observed1180x757 SVG860x552.3359; worldSE(1100,1100) mapped(666.7154,717.5474) inside console rectangle190..670/646.5..733, which intercepted hit-testing. Updated regression first failed old md:absolute; source now reserves one console footer outside radar at every width, with remaining-height flex radar. No duplicated controls or input behavior changes. After correction: targeted test passed1/11skipped, full468/468tests26files passed; typecheck/build/diff-check passed. No runner changes.

## Accepted clarification: full-panel radar
Robert inspected production and clarified that the radar must fill the entire available panel, including a rectangular viewport, not a small centered square/circle. Earlier PR25 is already merged; its full-width presentation is insufficient. Do not call that presentation complete. Independent public browser measurement: SVG860x481.84 but square world occupies481.84x481.84, leaving189.08px gutters per side (~44% total width). Dominant outer compass/ring visually reinforces enclosure.

- [ ] SQUARE-3 (delegated writer then browser QA/parent release): match world viewBox aspect to actual SVG viewport while preserving uniform scale and camera center/short-span, anchored zoom/pan/reset. Default shortest span1400 and400–2600 limits remain. Remove dominant circular perimeter/compass/tick sequence; optional range guides subdued. No physics/world-bound change. All actual panel corners interactive for tracks inside fixed world limits; camera visibility does not grant unlimited survival outside sector boundaries. Verify at100% production before/after, desktopwide/tall/mobile, real corners and CTM, selection/Enter/resize and no console overlap. Separate PR26 candidate after publishedPR25; full tests/typecheck/build/checks/merge/assets verification. Rollback camera/presentation/tests/doc only.

Route delegated direct: mapping across4+ files, writer2+nontrivial files. TDD ON with npm test. Natural forecast280–380 authored lines for this independently reviewable unit; no cosmetic shrinking. Stacked-to-main delivery retained. Native boundary for this new slice is published313fd70 (same tree as human-declined prior candidate); prior review declined only for priorcandidate, globalmodeunchanged. No rejected review executed. Queued readability document preserved externally at /private/tmp/atc-game-readability-queued.md; no readability source work until this correction is deployed/verified. Engram still unavailable for attributed writes.

## Current next step
Implement/verify SQUARE-3 first, then resume game readability. Production baseline screenshot /private/tmp/atc-full-panel-before-desktop.jpg actually inspected by browser actor. Source Library screenshot remains unseen/unavailable.


### SQUARE-3 local implementation (not committed)
- Actual SVG ResizeObserver fits display viewBox to measured landscape/portrait/square aspect. Camera state retains airport-centered shortest span1400, limits400–2600, existing uniform CTM pointer math and anchored wheel/pan. Zero-size measurements retain last valid aspect; resize preserves camera center/span. Reset centers current airport; visible NM readout explicitly describes short side. No gameplay/world-bound changes.
- Removed solid outer compass circle,360ticks and12degree labels. Range rings remain uniformly subdued/dashed. Shared static preview guide rings now uniformly dashed at0.25opacity, without changing preview layout/size or runway/fix data.
- Existing guidance, readback and zoom controls reserve flow space outside SVG at every width, as does the console from the previous unit. No duplicate controls or corner overlays; SVG observer follows remaining actual panel dimensions, including selected-guidance changes.
- RED observed: updated resize ratio, new landscape fit and old circular perimeter failed3/12 tests (9passed); HUD flow regression failed1/13 (12skipped); preview guide regression failed1/5 (4skipped). Initial GREEN fit encountered only floating error30.00000000000003 versus30; corrected numeric assertion to7decimal tolerance, without changing interaction requirements.
- GREEN final: focused FlightControls/Home19/19, full `npm test`472/472 across26files; `npm run typecheck`, `npm run build`, `git diff --check` passed. Existing DEP0205 warning only. Tests retain four-corner mouse/Enter/Space and heading/direct-to after zoom/pan/resize; additionally verify no gutters, uniform scale, anchored wheel point, invalid-size handling, shortest-span zoom limits and translated-airport reset.
- Natural authored diff239lines (220source/tests +19document additions, including parent clarification); no cosmetic compression. Assets: `index-Bxu0Upoo.js` / `index-DD2OUz8Z.css`. Browser full-panel measurements/hit-tests, commit/RDD, release and production verification remain pending parent. No source screenshot materialization or readability work performed.

### SQUARE-3 visual reference-grid refinement (uncommitted)
- Parent visual review requested quiet full-panel cues after geometric fit passed. One static SVG pattern uses real112world-unit/5NM spacing, stable useId and low-opacity map-color strokes; full viewBox rectangle follows pan/zoom. No invented geometry, traffic, controls, simulation or per-frame DOM work.
- TDD: missing-grid regression RED1/14skipped, then focused15/15 and full473/473 across26files GREEN; typecheck/build/diff-check passed. Added40source/test authored lines plus this4-line doc addition =44additional lines. Assets `index-BdpauRWT.js` / `index-DD2OUz8Z.css`. Parent visual confirmation/commit/release pending; prior local commit not amended.
