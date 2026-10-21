# Full-perimeter traffic entry

## Objective and authorized scope
Correct real random traffic entry across the full initial radar panel, not only its renderer. Share a stable airport-centered rectangular simulation domain between spawning, departure exits, distant culling and safety/prediction. Preserve uniform scale, physical separation, speed, rates, caps, traffic mix, goals, Home preview and readable annotations. Preserve intentional guided/tutorial/Learning positions. User authorizes draft PRs, green checks, merge to main and production verification through the existing GitHub connector; no new credentials or protection bypass.

## Evidence and decision
Base main: `0267718f29f3d072fa4a73fe887b2f28a482222a`; branch `codex/full-perimeter-spawn`. CodeGraph-backed delegated mapping confirms `spawn.ts` still uses circular radius 580, while operational/distant bounds are square half600/2500 and the renderer expands independently to the actual panel aspect. This is a simulation inconsistency, not a clipping issue.

Freeze the first valid positive radar viewport aspect once per GamePage session. Session operational half extents are the initial camera half-span700 times the aspect expansion factors, so entry is at the actual panel perimeter rather than leaving the old100-world-unit framing bands unused. Distant bounds retain the existing2500/600 proportion. Pure helpers preserve legacy square600 defaults for standalone callers; session construction explicitly supplies700. Arrivals sample perimeter length uniformly with the existing 20-world-unit intake margin. Headings must remain inward even on elongated rectangles/corners. No world changes on resize, pan or zoom; only camera fit can change. Avoid advancing random-mode time before initial measurement. At initialization the camera fits the session perimeter exactly (no additional old framing margin), with intake20 world units inside it; subsequent orientation changes reframe only the camera. Preserve scripted modes.

Tradeoff: wider initial panels mean more space and longer transit paths. Preserve configured intensity/frequency/caps, not an unsupported claim of identical effective density or cross-device difficulty. A fixed canonical domain would avoid this difference but would not satisfy full initial-panel coverage. Rotation fits the frozen domain by camera only; additional visible world is not new simulation area.

## Execution and delivery
- Route: delegated direct for both source work units; mapping required 4+ files and implementation touches 2+ non-trivial files. Parent owns design, browser QA, release and native review transitions.
- TDD ON from retained explicit session instruction; runner `npm test` (`vitest run`). Observe RED before behavior, then GREEN/refactor. Ordinary checks: focused/full tests, `npm run typecheck`, `npm run build`, `git diff --check`.
- Forecast: 450–650 authored additions+deletions excluding generated files. Preserve existing stacked-to-main chain choice from this ongoing radar correction; deliver cohesive independent units, never shrink/minify tests or docs to meet a line budget. Delivery strategy auto-chain with cached stacked-to-main strategy; no PR over400 without explicit exception. Reassess actual boundaries once source is understood.
- RDD ON (global), verified by `gentle-ai review mode status`. Assess actual work-unit commits against last reviewed boundary; follow returned native transitions. Prior candidate-specific declines do not apply. Do not invoke review actors without required candidate consent.
- Engram mirror `odd/full-perimeter-spawn/tasks` PENDING: authoritative runtime identity unavailable; attributed memory writes prohibited. Local record is authoritative recovery copy.

## Tasks
- [x] ENTRY-1 (delegated): shared pure rectangular domain/perimeter geometry with translated-center, aspect, weighting, corner and inward-heading tests; preserve default square bounds semantics. Conventional work-unit commit with exact checks and rollback boundary. Aim independently safe additive API slice.
- [ ] ENTRY-2 (delegated): integrate frozen session domain through random spawn, exits/culling, challenge safety, predictions and camera fit; preserve scripted modes and frequency/caps. TDD integration/regression proof and work-unit commit(s), split only by coherent safe behavior when needed.
- [ ] ENTRY-3 (parent with delegated browser QA): verify four sides/corners, wide desktop/mobile, multiple airports/modes, stable domain under zoom/pan/resize, departures/exits and unchanged readability/Home. Explain verified cause/tests/QA before draft PR and merge. Assess native gates, publish clean slices, checks, merge and verify exact production assets and main CI.

## Acceptance and verification
Random entries are on the configured rectangle intake perimeter, outside the old radius580 circle (except legacy square600 fallback exact mid-edge where it equals580), with coverage across each edge and near corners including wide side bands. All initial headings move inward. No arbitrary simulation dependence on camera movement or resize. Bounds, safe-entry checks and forecasts use the same domain. No out-of-sector arbitrary spawns that get immediately culled. Existing departures remain runway-based; intentional training tracks unchanged. Camera uses uniform scaling, no letterboxing, and fits frozen domain on orientation change even if required span exceeds old max2600.

## Progress and next step
ENTRY-1 pure helper unit verified and ready for its work-unit commit. Parent assesses the committed candidate before integrating ENTRY-2. No review receipt exists yet; no random flow behavior has changed.

### ENTRY-1 evidence
- Delegated route: mapping required4+ files; bounded additive writer changed shared helper and a non-trivial new test file. Scope limited to pure geometry, no spawn/culling/render integration.
- APIs: immutable `RadarDomain`, square600 fallback, `createRadarDomain(aspect, halfSpan=600)`, canonical600-unit `domainExtent`, one-sample clockwise arc-length `sampleArrivalPerimeter`, existing-second-sample `arrivalInwardHeading`. Parent-approved explicit session half-span700 is tested without changing standalone defaults.
- TDD RED before source: `npm test -- src/utils/radarDomain.test.ts` failed25/25 because new functions were absent. GREEN: `npm test -- src/utils/radarDomain.test.ts src/utils/radarBounds.test.ts` passed43/43.
- Full `npm test` passed516/516 across28 files. `npm run typecheck`, `npm run build`, `git diff --check` passed. Existing Node `DEP0205` deprecation warning is non-blocking.
- Coverage: aspect expansion/invalid aspect fallback; explicit700 span; legacy square thresholds; translated centers; four exact corners/midpoints; deterministic20,000-sample edge-length weighting for four aspects; inward vectors at corners and100 perimeter samples for five aspects including20:1/1:20, with minimum/center/maximum jitter; ordinary ±30-degree bearing preserved.
- Runtime/browser: N/A for additive unused API; actual random traffic and browser proof belong to ENTRY-2/3. Pure helpers consume sample values, never random functions, so they cannot add random draws.
- Rollback: remove additions to `src/utils/radarBounds.ts` and new `src/utils/radarDomain.test.ts`; existing square consumers remain unchanged.
- Commit identity: parent records returned work-unit hash after commit; native assessment/publication pending parent. Engram mirror remains pending/prohibited without runtime identity.
