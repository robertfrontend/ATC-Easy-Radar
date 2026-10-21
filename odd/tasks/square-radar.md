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
- [ ] SQUARE-1 delegated: shared fixed world-square geometry, departure600 and distant2500 boundaries with exact exclusions/order/scoring preserved; corners/axial boundary/translated airports/cleared departures/handoff/legacy state regressions. No render change yet. Full tests/typecheck/build/diff check, coherent conventional commit and independent PR to main. Rollback only square boundary helper/consumers/tests/doc.
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
