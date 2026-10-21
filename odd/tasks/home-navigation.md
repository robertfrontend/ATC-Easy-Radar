# Home navigation

## Objective, problem and why
Make Home a clear entry point to free play, challenges and Learning, instead of showing configuration before the user chooses an experience.

## Authorized scope and constraints
User authorized implementation, draft PR, green checks, merge to main and production verification. Preserve all modes, progress, controls and existing URLs where possible. Tutorial secondary; five-minute shift remains secondary inside preparation. Preserve settings on cancel, browser Back and return from game. Do not modify unrelated .atl or commit .codegraph. UI entry labels explicitly requested in Spanish; existing configuration copy remains English.

## Execution
- Route: delegated direct. Mapping required 4+ files; writer touches multiple non-trivial files.
- TDD: ON, explicitly directed by the user in this chat. Runner: `npm test` (`vitest run`). Observe RED, GREEN, then refactor.
- RDD: ON by global configuration. Candidate consent remains separate. Initial boundary: bae112f43ac72b02ccd5a2fb6bee84150fffb238.
- Delivery: ask-on-risk; forecast 350 authored additions + deletions, generated files excluded. No chain strategy selected.
- Memory mirror: PENDING, runtime explicitly forbids attributed writes without a registered identity. Topic reserved: odd/home-navigation/tasks.

## Tasks
- [ ] HOME-1 (delegated): Implement clear Home destinations and free-play preparation with retained draft, regression tests and relevant documentation. Observe focused RED/GREEN; run full tests, typecheck, build and diff check. Commit behavior and tests as one coherent work unit; record SHA and authored count. Rollback: Home navigation, App-lifted preparation draft and corresponding tests/docs only; no engine/progress changes.
- [ ] HOME-2 (delegated verification, parent release): Verify browser desktop/mobile: repeated entry, cancel/Back, free/shift/tutorial, challenges, Learning and Enter; focus, CTA visibility and overflow. Assess committed work via native RDD; follow returned transitions and consent. Create draft PR, attach, wait for checks, ready and merge only within protections; verify deployed commit/build.

## Acceptance
Three clear destinations and secondary tutorial on Home; configuration appears only inside free-play preparation. Five-minute shift secondary, distinct from challenges. Configuration survives cancellation and route changes. Existing progress and engine behavior retained. CTA usable on desktop/mobile; semantic controls and visible focus.

## Progress and evidence
Checkout clean at known main; CodeGraph initialized successfully, local index excluded from commits. Existing Home defaults to shift and loses settings on remount. Current-change RDD assessment unavailable due to local untracked CodeGraph inventory; must not infer low risk. Use committed candidate for actual work unit.

### HOME-1 verification
- Bounded delegated writer implemented navigation and regression tests; no simulation engines or progress stores changed.
- Draft architecture: typed state lifted to App, retained across cancel, browser route history and game remount. No new storage; full page reload resets preparation, documented in README.
- RED: `npm test -- src/components/HomePage.test.ts` observed 3/3 failures before behavior changes (missing destinations/setup entry).
- GREEN: focused Home suite 3/3 passed; full `npm test` passed 440 tests across 25 files. Additional same-airport preservation assertions subsequently passed focused Home 3/3.
- `npm run typecheck`, `npm run build` and `git diff --check` passed. Node emitted a non-blocking `module.register()` deprecation warning.
- React checklist: lazy typed state initialization, functional state updates, no effect-driven runway resets, semantic navigation/buttons, pressed states, focus restoration and mobile touch targets checked in source.
- Browser desktop/mobile QA remains pending HOME-2; automated game navigation uses a GamePage stub, while challenge integration retains the real loop and Enter regression.
- Parent confirms the connected GitHub connector is now explicitly authorized for the requested PR/checks/merge operations. Writer performs no remote operations.
- Behavior commit and native RDD assessment pending; no approval receipt claimed.

## Next step
Commit HOME-1 locally, then parent verifies browser flows and follows native RDD and authorized release operations.
