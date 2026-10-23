# Airport implementation reference

The shared navy presentation applies to all six airport preparation/game views. Boston uses its documented geographic/navigation package; Las Americas uses approximate real terrain/runway placement with explicitly simplified navigation. The other four maps remain legacy until their individual rollout. Treat each migration as a separate rollout using the shared radar engine and an independently sourced package. Boston is the working reference for presentation and integration, not a geographic template for other airports. This document does not authorize implementation, publication, or changes to airport priority.

## Quick path

1. Confirm the airport, authorized scope, acceptance criteria, and delivery permissions.
2. Verify source data, reuse rights, datum, coverage, and operational inventory.
3. Prepare one immutable derived airport consumed consistently by UI and simulation; keep approximate terrain/runway maps separate from verified navigation facts.
4. Verify the airport locally, then follow the authorized review and release process.
5. Validate one additional airport before batching the remaining migrations.

## Airport inventory

Status below describes geographic migration, not whether an airport is playable. Recheck the current checkout before starting work.

| Airport | ICAO | Existing project ID | Geographic rollout status |
| --- | --- | --- | --- |
| London Heathrow | EGLL | `london-lhr` | Legacy playable layout; new geographic sources not verified |
| Logan Intl Airport | KBOS | `logan-int` | Geographic reference implementation |
| Las Américas Intl | MDSD | `las-americas` | Published approximate real coast and runway17/35 placement; synthetic navigation |
| Dubai Intl Airport | OMDB | `dubai-int` | Legacy playable layout; new geographic sources not verified |
| Amsterdam Schiphol | EHAM | `amsterdam-ams` | Legacy playable layout; new geographic sources not verified |
| Panama Tocumen | MPTO | `panama-pty` | Legacy playable layout; new geographic sources not verified |

Accepted rollout order: polish MDSD, then MPTO, EGLL, EHAM and OMDB. Preserve Boston. This order comes from the approved plan, not table order.

## Shared foundation versus proposed generalization

| Already available | Proposed work before scaling |
| --- | --- |
| [Geographic contracts](../src/geography/types.ts), terrain reconstruction, immutable cached KBOS/MDSD adapter | Register packages by ICAO and bind each operative runway to its own sourced surface/end |
| [Shared rendering](../src/components/GeographicSector.tsx), active-only localizers, Home/game reuse | Keep shared navy presentation independent of terrain; preserve airport-specific source notices and documented KBOS exceptions |
| [Heading conversions](../src/geography/headings.ts) and [runway/LOC frames](../src/geography/navigation.ts) | Make per-airport range and simplified vector-target policies explicit |
| Fixed responsive camera and frozen session domain | Measure package bytes/load costs; add selected-only loading only if measurements require it, before session mounting |
| [NAD83/GRS80 and WGS84 projections](../src/geography/projection.ts) and integrity tests | Verify each new source datum and transform it deliberately; NAD83 is not a universal input assumption |

These proposed changes are not already implemented. The current KBOS loader eagerly imports its terrain. Adding five equivalent eager imports would increase the initial bundle; measure load time, transferred bytes, parse cost, and memory before setting the next package's budget.

## Common visual and interaction contract

- Preserve the navy/black composition: no decorative grid or default range rings. Keep optional distance guides distinct from operational boundaries.
- Use white/light-gray normal aircraft, readable labels, and short thin heading arrows. Preserve selected, alert, and conflict priority; do not solve contrast by hiding traffic or enlarging everything.
- All airport radar views use a `0.75` minimum opacity for normal uncontrolled-track blinking, generalized from the tested KBOS readability policy. Selected, alert and conflict states retain their existing priority.
- Keep the complete frozen sector visible with uniform coordinate scaling. No game zoom or pan; browser accessibility zoom and scrolling remain available.
- Reserve stable console, feedback, and action-button footprints before selection and first-character typing. Use scroll-preserving programmatic focus and at least 16px mobile command-input text.
- Show a complete ILS guide group only when its existing operative runway is present, the reference is not `referenceOnly`, and that runway's `landing` flag is true. Hide line, caption, hit area, and interactive title together when inactive.
- Apply the same active-ILS rule to Home preparation, runtime rendering, and active reference notices. Departure-only or missing configurations must not expose landing guides.
- Preserve free play, quick shifts, Retos, Learning, tutorial behavior, saved progress keys, airport IDs, and the existing operative runway inventory unless a separate scope change authorizes otherwise.

## What each airport package must establish

For the accepted map-only rollout, navigation/ILS/hold rows below apply only when real operational facts are incorporated. Otherwise preserve clearly labelled synthetic gameplay, retain IDs/functions, and do not fabricate equipment, magnetic variation or threshold displacement. Synthetic-layout coordinates belong in gameplay data, not source-derived terrain facts.

| Concern | Required evidence |
| --- | --- |
| Terrain | Real land/water geometry, clipping coverage, source dates, generalization limits, and explicit unknown areas |
| Rights | Exact provider/item terms and attribution; distinguish factual extraction from permission to redistribute a full dataset or chart |
| Coordinates | Source datum/CRS, units, axis order, airport reference point, and tested transformation into the shared world |
| Runways | Physical endpoints, displaced thresholds, existing operative IDs, and runway versus localizer bearings |
| Navigation | Verified core fixes, noninteractive context fixes, and clear eligibility for departure exits |
| ILS | Actual equipment, antenna coordinates, true/magnetic course, variation, status, restrictions, and active-runway association |
| Holds | Verified existence only unless separately authorized, sourced pattern geometry and functional behavior are available |
| Runtime | Per-airport coverage/range, immutable package identity, source notices, and bounded asset-loading cost |

Keep `22.4 world units/NM` and existing motion/separation profiles unless a separately approved change requires otherwise. Use the same derived airport object for rendering, command parsing, controls, spawning, navigation, safety checks, and prediction.

Do not copy Boston's 35-NM core, six physical runway surfaces, four operative IDs, nine core fixes, 15R offset, 33L restriction, or reference-only 22L to another airport. Inland airports must not gain invented coastline or ocean. Unverified terrain remains neutral black; missing data must not be classified as water.

## Per-airport execution sequence

### 1. Establish the evidence and scope

Read repository instructions and the current implementation. Record the actual branch/base and preserve unrelated work. Confirm which runway controls and progression identifiers must remain compatible. Select only sources whose datum, coverage, freshness, and reuse conditions can be verified; disclose unavailable evidence rather than inventing procedures.

### 2. Build the independent package

Extract a narrow, independently structured fact subset with source URLs, effective dates, checksums, attribution, and limitations. Generate projected terrain offline; preserve topology and holes. Keep large geometry as transparent data assets rather than a large executable source literal. Verify every fragment/index/path hash and deterministic reconstruction.

### 3. Integrate through shared consumers

Adapt the canonical airport immutably and cache its result. Keep physical pavement, thresholds, localizer axes, and simplified capture behavior distinct. Never let viewport changes relocate fixes or resize the frozen simulation domain. Home and runtime must agree on the selected airport and operative runway state.

### 4. Verify behavior and presentation

Use the applicable project TDD mode. When enabled, require observed RED, GREEN, then REFACTOR; do not invent a failure for verification-only tests of existing behavior. Reuse shared test infrastructure, adding airport-specific controls for source facts, projection distances/bearings, magnetic conversions, active ILS, runway inventory, direct-to/exit behavior, and landing/departure flows. Numeric forecast/live agreement proves shared-core consistency, not real-world flight or procedure accuracy.

At desktop and mobile widths, test 100% browser scale, selection, first-character typing, deletion, Escape, Enter, autocomplete, runway switching, and repeated sessions. Compare SVG bounds/viewBox and actual scroll/focus movement separately. Test all ILS off, departure-only, missing configuration, reference-only equipment, and active restricted equipment without treating a restriction as blanket unavailability.

```sh
npm test -- --maxWorkers=1
npm run typecheck
npm run build
git diff --check
```

Keep the existing Node/Vitest toolchain; do not introduce another runner without need. Run legacy-airport and Learning/tutorial regressions. Record failed, skipped, or unavailable checks explicitly, including physical-device keyboard tests, live alert/conflict observation, or long-running traffic checks not actually performed. Previous Boston test counts are not evidence for a future airport.

### 5. Release only within the authorized boundary

Follow the current user-owned review setting and candidate consent. A one-off omission or decline is not a global opt-out. When publication is authorized, create the requested PR, verify CI on the exact expected head, respect protections, and merge only as permitted. After deployment, verify the published source revision, actual public assets, and desktop/mobile behavior; a local build or successful deployment status alone is insufficient.

Keep rollback bounded to the airport package and its integration changes. Preserve unrelated airports, user progress, and source attribution. Do not disable protections or change access settings to complete delivery.

## Reusable airport brief

```text
Airport / ICAO / existing ID:
Authorized scope and delivery boundary:
Current baseline and operative inventory to preserve:
Sources, effective dates, rights/attribution, and unresolved gaps:
Datum/projection, coverage, and proposed frozen range:
Core fixes, context references, physical runways, and active ILS policy:
Shared changes needed versus airport-only data:
Asset budget, loading strategy, and integrity evidence:
Acceptance tests, observed results, and unavailable checks:
Rollback boundary and next user-owned decision:
```

## Definition of done

- [ ] Sources, datum, attribution, coverage, and factual limitations are documented.
- [ ] UI and simulation use the same immutable airport package; no invented operational features.
- [ ] Aircraft remain legible; selection/typing do not move the frame; only active operative ILS appears.
- [ ] Existing modes, progression IDs, canonical airports, and unrelated work remain compatible.
- [ ] Tests, typecheck, build, asset integrity, and desktop/mobile checks have observed evidence.
- [ ] Loading cost and unknown-terrain handling meet the agreed budget and coverage policy.
- [ ] Any authorized release is verified publicly, with a bounded rollback and honest remaining limitations.

Next implementation phase: polish MDSD, prepare explicit multipista bindings, then complete each remaining airport in the accepted order. Shared presentation does not imply real geography or verified navigation for legacy airports.
