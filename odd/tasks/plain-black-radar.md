# Plain black radar background

## Intent
User rejects the added grid as visual noise and explicitly requests a black map without grids. Remove decorative Cartesian grids from game radar and matching Home preview, preserving operational geometry, fixes, arrows, forecast, controls and fixed camera. Do not relocate airport/navigation points.

## Scope and evidence
Base main ae96dbaa21edea9f30936d834d873cf6e655468c. Delegated CodeGraph mapping found minor/major SVG grid patterns in RadarDisplay and separate SectorPreview patterns. Existing scope theme is black. Preserve transparent full-view pointer hit surface so canvas traffic glow and background command interactions remain visible/functional. Preview already has an opaque black base. Remove obsolete grid descriptions.

## Execution
Delegated direct: preparation covers4+ files and implementation2+ non-trivial files; bounded writer owns source/tests/docs. TDD ON from explicit session configuration; runner npm test (vitest run), serial full suite npm test -- --maxWorkers=1. Forecast120–160 authored lines including this document, one coherent work unit/PR, delivery ask-on-risk (no threshold forecast). RDD globally ON; previous exact-candidate decline does not cover this change. Assess committed candidate and obey native continuation. Publication/merge follows existing user authorization, only after checks.

## Tasks
- [x] BLACK-1 delegated: remove game and preview grids; retain black background and full-frame transparent input surface. Update focused regressions and README. Observed RED/GREEN, full tests, typecheck/build/diff check; Conventional Commit with tests/docs.
- [ ] BLACK-QA parent: desktop/mobile actual screenshots show plain black map with no grid, track/fix/background command interactions intact; native candidate gate; publish/CI/merge under existing authority and verify exact public assets.

## Acceptance and rollback
No decorative grid patterns/lines in either view; black scope; existing real map layers and optional range rings unchanged. No physics/domain/airport-coordinate changes. Revert only grid removal/tests/copy for rollback.

## Recovery
Preserve unrelated uncommitted odd/tasks/fixed-radar-surface.md proof and untracked .codegraph. Memory mirror odd/plain-black-radar/tasks pending: authoritative runtime session identity unavailable; attributed writes prohibited. BLACK-1 verified locally; parent browser/native gate/publication remains pending.


## BLACK-1 evidence
- Removed only game minor/major grid definitions/overlays and unused game useId; retained full-view transparent pointer rectangle, black scope, canvas glow and all operational airport geometry. Preview retains its black base and accessible useId title/description, without obsolete grid copy. README reflects plain black maps.
- TDD RED: `npm test -- src/components/FlightControls.test.ts src/components/HomePage.test.ts` failed3/passed39 before source changes, specifically patterned game hit fill and preview pattern presence. GREEN same command passed42/42.
- Full checks: `npm test -- --maxWorkers=1` passed546/546 across29files; `npm run typecheck`, `npm run build`, `git diff --check` passed. Existing DEP0205 module.register deprecation warning only. Built assets `index-Dg7m59zn.js` and `index-DN6W-KEd.css`.
- Runtime/input evidence: real RadarDisplay focused tests preserve full-frame background heading, four-corner selection, canvas bloom, fixed-domain resizing, nearest-track and arrow/forecast behavior; Home tests preserve navigation, preview accessibility and actual waypoint transforms. Actual desktop/mobile screenshot QA remains BLACK-QA; no claim of browser completion.
- Rollback boundary: revert only README map-background copy; RadarDisplay/SectorPreview grid removal; their focused regressions; this feature document. No domain/airport/physics/optional ring changes. Unrelated fixed-radar-surface proof and .codegraph excluded.
- One coherent work-unit commit: `fix(radar): restore plain black map backgrounds`; exact identity is recoverable with `git log -1 --format='%H %T' -- odd/tasks/plain-black-radar.md` and returned to parent. RDD remains ON/pending parent assessment; no remote mutations or memory writes performed.
