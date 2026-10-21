# Home radar preview

## Objective and problem
Restore visual product context on Home after PR22 moved the existing sector preview into preparation. Preserve visual product context when simplifying navigation.

## Authorized scope and constraints
User requested a faithful Home game/radar preview and authorized existing GitHub connection, draft PR, green checks, merge and deployment verification. Reuse existing data-driven static sector SVG; no invented image, mounted game engine, heavy animation or configuration on Home. Preserve Jugar libre / Retos / Learning and secondary tutorial. Desktop CTA must remain above fold; responsive, accessible, reserved dimensions/no layout shift. Do not change gameplay/progress/settings or unrelated .atl/.codegraph. Previous local verification commit stays on its original branch.

## Execution
- Base: main 159c69e0dec6781701d79f59629533d86ecac133; branch codex/home-radar-preview.
- Route: delegated direct. Read preparation delegated; reusable markup + Home + regressions touches multiple non-trivial files.
- TDD ON, carried from explicit user direction; npm test = vitest run. Observe regression RED before implementation, then GREEN/refactor.
- RDD ON global; assess committed unit against base and follow native transitions/consent if due.
- Delivery ask-on-risk, forecast 350 authored additions+deletions including extraction/tests/docs. No chain strategy selected. No cosmetic shrinking to meet budget.
- Engram mirror PENDING (topic odd/home-radar-preview/tasks): authoritative session identity unavailable, attributed writes prohibited by runtime.

## Tasks and acceptance
- [ ] PREVIEW-1 (delegated writer): Reuse existing static airport/runway SVG on Home and preparation, accessible descriptive label and compact responsive layout; maintain three primary destinations/tutorial above preview in reading order. Add regression for preview presence, unchanged links, no config/engine on Home and retained preparation behavior. RED/GREEN, full tests, typecheck, build, diff check. Commit outcome with tests/docs as one coherent unit; rollback only preview extraction/layout/tests/docs.
- [ ] PREVIEW-2 (delegated browser QA, parent release): Visually inspect desktop 1180x757 and mobile390x844; CTA above desktop fold, faithful visible preview, no overflow/layout shifts, focus/nav/preparation retained. Follow native risk assessment, draft PR, attach/checks/merge without bypass and verify production commit/assets.

## Evidence
Read-only mapping: existing Home SVG uses airport/runway data and radar palette; no simulation. Actual RadarDisplay runs animation/prediction and is unsuitable for a lightweight Home preview. Main public fetch verified current.

PREVIEW-1 implementation evidence (not yet committed/released):
- Extracted the existing data-driven static SVG to `src/components/SectorPreview.tsx`, reused in preparation and below Home destinations/tutorial. Geometry and runway/ILS/departure state remain unchanged. Home uses a reserved square, compact max-width card and responsive two-column section; no simulation, animated traffic or invented aircraft.
- Added SVG role/image title/description with stable unique IDs and changed the misleading Live label to Static sector preview. Existing radar palette/type and keyboard navigation retained; no new controls or loading states.
- TDD: before implementation, focused HomePage tests observed 2 new failures (missing accessible preview/title) and 3 prior passes. After implementation 5/5 focused tests passed, including navigation order, no Home inputs/game launch and selected-airport retention across cancel/reopen.
- Full checks observed: `npm test` 25 files / 442 tests passed; `npm run typecheck` passed; `npm run build` passed; `git diff --check` passed. Node emitted existing DEP0205 module.register deprecation warning; checks exited 0.
- React checklist: pure typed component, type-only airport import, useId for SVG naming, no effects/game loop/dynamic dependency or new animation; existing responsive palette and aspect-ratio dimensions preserved.
- Natural authored count before commit: 359 lines including this 33-line feature document (36 test additions, Home 10 additions/130 deletions, 150-line extracted component). No threshold-driven compression. Browser visual QA, commit/RDD, remote checks and release remain pending parent.

## Next step
Parent inspects changes, performs PREVIEW-2 browser QA and commits/releases after applicable RDD. PREVIEW-1 checkbox remains pending until work-unit commit evidence is recorded. Keep entire prior feature history intact; no memory writes until runtime identity restored.
