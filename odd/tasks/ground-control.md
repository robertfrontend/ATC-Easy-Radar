# Ground Control

## Objective, problem and why
Add a playable original top-down airport surface-control mode inside ATC Easy Radar, without rebuilding the app or disturbing radar gameplay. Surface clearances, congestion and delays are the challenge; dangerous incompatible clearances are blocked rather than becoming normal collision opportunities.

## Authorized scope and constraints
- Local implementation, checks and work-unit commits only. No push, PR, deployment or destructive operations.
- `/ground-control` with a clear home entry, isolated simulation/state and local original SVG airport/aircraft.
- Two intersecting runways, connected taxi graph, parking stands, explicit state machine, physical movement and resource release.
- Complete departures and arrivals; missed approaches remain visible. Taxi never grants runway entry or crossing.
- Player selection, route display, state/destination/actions, blocked reasons, traffic list, alerts and operations/pending/delay scoreboard.
- Stop/resume taxi, pause/resume all simulation, restart, 1x/2x and cleanup on navigation.
- Eight-minute simulated shifts, progressive bounded traffic, no early defeat, final evaluation and gradual closeout without new traffic.
- Arrivals automatically exit the runway physically, then wait for clearance to taxi to an assigned available stand.
- Conservative runway/shared-intersection reservations from clearance through physical release; no incompatible simultaneous operations.
- Preserve existing package-lock.json changes, .atl/ and .codegraph/. No large dependency or external service.
- Minor engineering defaults must be explicit, recoverable and explained; artifact copy defaults English, existing Spanish landing context may stay Spanish.

## Architecture and design
Delegated direct implementation. Reuse React, router, common styling/icons and Vitest, not radar aircraft model or loop. Keep graph/map, simulation/commands and React/SVG presentation separate. Airport drawing is the main visual: legible grass/pavement, runway markings, taxi labels, hold bars, clear symbols plus text rather than color-only signals. Operational UI uses existing dark aviation language with accessible focus/targets and responsive side panels.

## TDD and checks
- TDD ON retained from project precedent `odd/tasks/home-landing-refresh.md` TDD and checks (explicit retained session configuration). Runner `npm test` (Vitest), focused `npm test -- src/ground/` and integration test paths.
- Observe RED before implementation for new behavior; GREEN then refactor. Do not invent evidence.
- Domain tests: graph validity, states, clearances, shared occupancy, crossings, physical release, separation, missed approach, timer/pause/speed/reset lifecycle, score-once and closeout.
- Functional checks: focused and full tests, `npm run typecheck`, `npm run build`, `git diff --check`.
- Browser: home/ground/radar navigation, full departure and arrival, blocked actions/crossings, controls and restart, route/queues, desktop/tablet when available.

## Delivery
- Strategy `ask-on-risk`, resolved by user to `feature-branch-chain` for this feature.
- Tracker: `feature/ground-control`, branched from `robertfrontend/soldierfish` at 93ccb06.
- Local child chain: `feature/ground-control-01-simulation` -> `feature/ground-control-02-playable` -> `feature/ground-control-03-validation`. No remote PRs.
- Forecast 1,900–2,600 authored additions + deletions. Approximately 400 per task is advisory, not a reason to omit tests, compress code or split incoherently. Record actual counts and honest overages after one slicing pass.
- RDD status observed: OFF, decided by global. All tasks `disabled/unmanaged`; do not start reviews or toggle mode.
- Engram mirror topic `odd/ground-control/tasks`: PENDING, host runtime has no authoritative identity and project search returned unknown_project. No writes permitted until registration is restored. Local document is recovery source; never claim mirror saved.

## Tasks and acceptance
- [x] GC-1 — Implement deterministic airport graph, explicit surface simulation and safe commands with focused tests. Route: delegated, mapping/preparation trigger 4+ files and writer trigger 2+ non-trivial files. Acceptance: both flows can complete on valid routes; runway/crossing resource semantics, separation and lifecycle/score are tested. Rollback: new ground domain/map/tests only. Runtime harness: deterministic domain simulation tests.
- [x] GC-2 — Deliver original playable SVG/React UI, clock controls, home entry and isolated route with integration tests. Route: delegated, writer trigger 2+ non-trivial files. Acceptance: all required valid actions/reasons, selected route, traffic/score/instructions, accessible responsive controls, radar regression preserved. Rollback: ground view/hook/styles and bounded App/Home integration. Runtime harness: browser and DOM integration tests.
- [x] GC-3 — Verify full flows and regressions, fix observed failures, and document play instructions/limits. Route: delegated bounded validation/fixes, writer trigger if multiple files need fixes. Acceptance: evidence for requested scenarios, no falsely claimed checks; final work-unit commit. Rollback: bounded fixes/docs only. Runtime harness: browser + complete test suite.

## Progress and evidence
- Initial exploration: React 19/Vite/Router 7/Vitest; routes src/App.tsx, home src/components/HomePage.tsx, radar src/hooks/useGameLoop.ts and src/types/index.ts. Separate surface model avoids airspace coupling.
- Baseline uncommitted package-lock.json and untracked .atl/, .codegraph/ are unrelated and excluded from staging.
- Current: GC-1, GC-2 and GC-3 complete. All changes remain local on the final child branch; remote delivery remains user-owned.


### GC-1 evidence
- Implemented `src/ground/model.ts`, `airport.ts`, `simulation.ts` and `simulation.test.ts`. Stable immutable API: createGroundState, advanceGround(real seconds), commandGround, getAircraftActions, runwayOccupancy and getGroundAlerts.
- TDD RED: first focused run failed on missing airport module. Added regressions subsequently failed for arrival waiting penalties, turnaround timer, mixed-traffic stand handoff and an on-centerline departure hold. GREEN: `npm test -- src/ground/simulation.test.ts` — 21 passed. `npm run typecheck` and `git diff --check` passed.
- Deterministic runtime harness: mixed traffic autoplay through the eight-minute shift and gradual drain reaches complete, with multiple arrivals/departures, at least 33.9px minimum surface separation and no leaked runway/taxi resources.
- Both runway arrival flows physically exit before resource release. Off-axis holds avoid blocking the landing approach. Takeoffs leave the viewport before removal/scoring; stand reservations persist until physical departure clearance. Completed arrivals turn around into one departure only while traffic is open.
- Minor defaults: 30 simulated seconds free for each continuous waiting episode, then one aircraft-second delay per waiting aircraft per second; approach/circuit waiting is continuous. Turnaround 25 simulated seconds. Traffic starts after 40 seconds and progressively accelerates with at most six active aircraft.
- V1 limitation: taxi movement uses one conservatively owned corridor at a time. Multiple taxi clearances queue with explicit reasons; this prevents junction/head-on deadlocks at the cost of throughput. Crossing, landing and takeoff are protected operations and cannot be stopped mid-runway.
- Authored source/tests: 726 added lines. This cohesive map/simulation/test unit exceeds the advisory per-slice heuristic; it is retained intact rather than removing tests or compressing code. Local chain remains selected; future PR sizing requires an honest smaller split or accepted size exception, not automatic remote publication.
- RDD: disabled/unmanaged (global OFF). Engram mirror remains pending; no session identity is available. Runtime browser/UI checks belong to GC-2/GC-3. Rollback removes the four new domain files without radar changes.
- Next: GC-2 playable UI on the next local child branch; parent owns branch transition. Commit identity will be recorded immediately after commit.

- GC-1 commit: `10524b7` (`feat(ground): add safe deterministic surface simulation`), local slice `feature/ground-control-01-simulation`, 739 additions + 1 deletion including task evidence (740 authored changed lines). Source/test-only additions: 726. Commit identity update remains for the next work-unit documentation commit.


### GC-2 evidence
- Implemented independent `/ground-control` route with `GroundControl.tsx`, original `GroundMap.tsx`, scoped `ground.css` and one-clock `useGroundGame.ts`. Home exposes the fourth experience; its grid adapts to four desktop/two tablet/one mobile columns. Radar setup, scores and routes remain isolated.
- Map renders the authored graph, paved runway-entry/exit connectors, marked runway ends, shared intersection, stand IDs, taxi labels and six hold bars. Aircraft support click/keyboard selection, original oriented silhouettes, selected cleared routes and textual flight-state/action explanations. Sidebar includes physical occupancy versus reservation, flight list, available or blocked actions and reasons.
- Controls: pause/resume, 1x/2x, restart and mode exit. Statistics include operations, active pending flights, aircraft-second delay and explicit performance rule: max(0, 100 per operation minus whole delay seconds). Closing and final evaluation are visible. Brief instructions explain separate taxi/crossing/takeoff permissions, missed approaches and timing.
- TDD RED observed before implementation: missing GroundControl module; home expected fourth link and ground navigation absent. Restart regression then failed because the first post-reset frame inherited five old seconds; fixed by resetting the hook timestamp ref. Go-around explanation regression failed on generic clearance copy; now explains when landing clearance becomes available.
- GREEN: `npm test -- src/ground/GroundControl.test.ts src/components/HomePage.test.ts` — 15 passed (6 ground UI and 9 home integration). The controlled-RAF UI harness completes GC101 taxi/hold/takeoff, GC202 landing/physical exit/taxi/explicit runway crossing/stand arrival and once-only UI counters. It also verifies pause freeze, speed, reset, single-clock cleanup/remount, keyboard selection and radar navigation/storage isolation.
- Checks: `npm run typecheck` and `git diff --check` passed; production build passed with the existing >500 kB chunk advisory before the final copy-only explanation change. GC-3 will rerun the complete suite/build and stable native-browser flow. Parent observed a good desktop original-airport/control rendering; tablet and stable full browser playthrough remain pending, not claimed.
- React/accessibility check: stable functional state dispatch; one RAF with unmount cancellation; no radar/localStorage coupling; semantic main/header/aside/sections/buttons; visible keyboard focus; 44px HTML action targets and flight-list alternatives to small map symbols; labels/text/dashed outlines instead of color alone; responsive layouts and reduced-motion styling. No new dependency.
- Cohesive UI/integration slice naturally exceeds the advisory 400 authored-line heuristic. Keep tests/readable CSS and structure intact; future PR delivery must use a smaller honest review slice or accepted size exception. No PR/push/deployment performed. RDD disabled/unmanaged; Engram mirror pending.
- Rollback boundary: the five new ground UI/hook/style/test files, bounded App/Home entry/test changes and home grid CSS; domain and radar remain independently usable. Commit identity and exact authored count will be recorded after commit.

- GC-2 commit: `5239199` (`feat(ground): add playable surface control mode`), local slice `feature/ground-control-02-playable`, 621 additions + 5 deletions (626 authored changed lines including evidence). Running GC-1 + GC-2 work units: 1,366 authored changed lines, plus 45-line initial tracker. Source stable; next GC-3 validation on final child branch.


### GC-3 evidence
- Functional validation found missing runway deceleration: early and late rollout both measured 55px/s. Parameterized runway 09/36 regressions failed RED; a simple distance-based rollout profile now slows from 55 toward 20px/s before turning onto the exit, without advanced physics or changing physical occupancy/resource rules.
- The changed timing exposed a real mixed-traffic deadlock: an arrival reserved the shared runway while a previous arrival still occupied its exit and was queued behind an aircraft needing a runway crossing. Neither could release the other's resource. A targeted regression failed RED because landing was still allowed. Landing now requires the exit staging area and full separation buffer to be clear, with the blocking aircraft and corrective taxi action named. The existing complete-shift soak then passed again, with no overlap or leaked resources.
- Parent desktop browser observation found the natural-aspect map clipped the lower apron below the playable viewport. Scoped desktop CSS now fits the whole SVG into available viewport height, enlarges map labels and independently scrolls the desk. Final native browser screenshot at 1470x860 logical pixels confirmed both complete runways, all four stands and clearance panel visible together.
- Focused GREEN: `npm test -- src/ground/simulation.test.ts src/ground/GroundControl.test.ts src/components/HomePage.test.ts` — 39 passed (24 domain, 6 UI, 9 home). Full final GREEN: `npm test` — 44 files / 719 tests passed. `npm run typecheck`, `npm run build` and `git diff --check` passed. Existing advisories remain: Node module.register deprecation and minified JS chunk >500kB (about 1.51MB); no new dependency was added.
- Actual production-browser story (parent, pre-GC-3 snapshot): completed GC101 departure and GC202 arrival to its stand (two operations), separately authorized crossing 36, confirmed taxi stops before runway entry, incompatible landing disabled during the shared takeoff reservation, Stop/Resume taxi, 2x, pause unchanged for about 60 wall seconds at 03:57 and delay485, resume, Ground→Home→actual radar free play→Home→fresh Ground, and restart to the initial two flights. Radar rendered actual tracks/menu/exit rather than a mock.
- Final rebuilt-source browser smoke (parent, preview3016): full-airport desktop fit, aircraft selection, taxi36 selected route/actions and pause at00:32 passed. Responsive smoke at140% browser zoom (roughly1020px effective width) reflowed panels below the map with readable controls/messages, scrolling and no observed horizontal overflow. Restored100% zoom and left the shift paused. This was not physical-tablet/touch emulation; real touchscreen validation remains unverified. The full480s browser shift was not manually played; deterministic final-code soak covers its closeout.
- Added README play instructions, both reproducible initial flows, safety/queue explanation, delay/performance rules, closeout, reset/navigation isolation, source/check commands and first-version limits. Updated Home's documented destination count to four.
- RDD remains disabled/unmanaged (global OFF); no review was started or preference changed. Engram mirror remains pending because no authoritative runtime identity is registered; local recovery document is complete. No push, PR or deployment was performed.
- Rollback boundary: GC-3's bounded simulation speed/exit availability changes and regressions, desktop map-fit CSS and README/task evidence; GC-1/GC-2 and radar are otherwise untouched.
- Remaining limitations: deliberately serialized taxi corridor, conservative whole-operation shared runway reservation, simplified approach/turn/braking model, six active aircraft/four stands and no saved Ground shifts. Before future remote PR delivery, oversized GC-1/GC-2 cohesive slices require an honest smaller review slice or explicitly accepted size exception; no size gate is fabricated as passed.
- Next step: user can play `/ground-control`; any push, PR, deployment or broader simulation realism needs separate authorization. Work-unit identity will be recorded immediately after commit.
