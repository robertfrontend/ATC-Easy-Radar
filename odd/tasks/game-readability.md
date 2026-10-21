# Game readability

## Objective and authorized scope
Moderately enlarge aircraft symbols, readouts, critical game controls and interaction areas at 100% desktop/mobile scale. Preserve full-panel radar, coordinates, physical separation, mechanics, balance, progress, zoom/pan, keyboard and Enter. Do not globally enlarge Home/Learning or hide traffic. Existing authorization covers draft PR, checks, merge and deployment through the connected GitHub session without new credentials or protection bypass.

## Evidence and design
- Base: `28376c886642719743d845b9e1bf5ca57a8597ea`, branch `codex/game-readability`. PR26 was deployed and independently verified before this task, with 473 tests and full-panel desktop/mobile QA.
- Production screenshots showed tiny text: previous 16-unit symbols and 13/12.5-unit labels were geographic units, approximately 4.5/3.5 screen pixels on a 390-pixel mobile panel.
- Slice A counter-scales annotations only using existing SVG ResizeObserver dimensions and the aspect-aware camera. Callsigns are 12 px, readouts 11 px, symbols 10 px, and track hit diameter 44 px. Canvas bloom matches the symbol.
- Slice A flips/clamps visible track labels at edges using estimated monospace widths. Offscreen labels are not pinned into the viewport. Geographic 2 NM halos, trails, velocity vectors and forecasts remain unchanged.
- All hit circles render before every annotation so later transparent targets cannot intercept earlier visible callsigns. Hit circles select the nearest actual track; labels and keyboard select the named track.
- Slice B adds four bounded local quadrants for nearby tracks and scoped control text/touch targets. No general collision solver or hidden labels; extreme density and edge-constrained clusters may still overlap.

## Execution and delivery
- Route: delegated direct. Mapping required 4+ files; implementation required 2+ non-trivial files. Parent owns browser QA and release.
- TDD: ON, explicit retained task instruction. Runner: `npm test` (`vitest run`).
- RDD remains ON. Previous radar review was declined only for that candidate. Parent assesses each actual work-unit slice and follows native transitions; no new consent inferred.
- Initial forecast: 300–390 authored additions plus deletions. Full behavior naturally reached 481 lines after real browser findings required correct hit-layer ordering and bounded density mitigation.
- Delivery: parent-approved stacked-to-main units A then B, each with tests/docs and independent checks. No compressed code, omitted tests or cosmetic deletion to meet the heuristic.
- Engram mirror `odd/game-readability/tasks`: PENDING because runtime identity is unavailable and attributed writes are prohibited.

## Tasks and slice boundaries
- [x] READ-1A (delegated implementation): readable annotation metrics, finite resize/zoom sizing, edge placement, nearest dense selection and correct hit-layer ordering, with focused/full tests and a conventional commit. Slice A excludes ControlPanel, zoom touch sizing and nearby-label spreading. Rollback: annotation presentation, hit interactions and their tests/docs only.
- [ ] READ-2A (parent QA/release): desktop/mobile sizing, edge labels, min/default/max zoom, resize/pan, named label selection through overlapping hit areas, Enter/direct-to and gameplay routes; assess native gate, draft PR, checks, merge and deployment.
- [ ] READ-1B (delegated, restored on `codex/game-readability-density`; commit pending): restore bounded nearby-label spreading, critical 12 px control text and 44 px button/range/zoom targets, with their tests. Rollback: density layout and scoped control presentation/tests only.
- [ ] READ-2B (parent QA/release): 2–4 nearby labels, desktop/mobile control targets, keyboard and unchanged clearance behavior; native assessment, separate draft PR, checks, merge and deployed smoke.

## Verification and recovery
- A RED evidence: missing metrics plus annotation/dense-selection failures; offscreen-label regression; actual browser interception of an earlier callsign by a later target reproduced by a failing paint-order regression.
- B RED evidence: control-target regression and 2–4-track label-overlap regression. Complete A+B source passed 33 focused tests, 491 full tests, typecheck, build and diff check before safe preservation.
- Complete A+B source snapshot: `/private/tmp/atc-readability-complete.isrk2o40`, six explicit files plus `SHA256SUMS`. Restore B behavior only after A merges; preserve current task/release evidence rather than blindly overwriting this document.
- React checklist: reused observer with cleanup and unchanged-dimension bailout; no per-frame React measurement state, dependencies or global styles. Existing semantic selection, keyboard and direct-to/Enter guards remain.
- Source Library screenshot remains unavailable and unseen. Use independent browser screenshots, not claims about the missing image.
- Slice A work-unit commit: `acdf5161c05a3d7ead88a975bc80053853639448` (`fix(radar): keep aircraft annotations readable at every zoom`); 283 additions + 82 deletions = 365 authored lines. This postcommit SHA record is intentionally not amended into its own commit.
- Slice A verification: 30 focused tests and 488 full tests pass; typecheck, build and diff check pass. Exact precommit authored count: 365 lines. B has now been restored after the merged-A/new-branch signal.

- Slice A publication: PR27 merged as `9a7c199c64275b0192dde0368e6a42f7937b5a8f`. Published commit `ed831aaaa4c15d04cbe7ffcd70a3af573362dd17` and merged main share exact tree `2b1e31e369834e93de2d93eda0fb9e44dcb84b18`; parent reports CI/Vercel preview green and bounded actual A QA passed. Production asset verification remains parent-owned and pending.
- Slice B recovery: verified the snapshot manifest hash `c1523c72c94a37f65c7aff9a75618fe11f1d477b8c0e128f17287d69738b4566`, all six saved file hashes, and exact SHA256 equality of all five restored source/test files. Current task document was preserved rather than restored from snapshot.
- Slice B checks: exact authored diff is 147 lines from merged A, including task evidence. 33 focused tests and 491 full tests pass; typecheck, build and diff check pass. Only bounded label quadrants, scoped ControlPanel typography/touch targets, zoom target sizing and their tests differ from merged A. Commit awaits parent approval.

## Next step
Parent completes B browser QA and authorizes its work-unit commit, then handles native candidate assessment, PR, checks, merge and deployment. Keep A/B commit and production proof separate; prior review declines do not authorize this new candidate.

### Slice A production proof
PR #27 merged as `9a7c199c64275b0192dde0368e6a42f7937b5a8f`. Main CI run 39537194047 and Vercel succeeded. Public JS/CSS SHA-256 match the saved slice-A build manifest. Actual public browser at 100% confirms 10/12/11 px annotations, full-panel geometry and Enter/double Enter. B remains a separate pending candidate.
