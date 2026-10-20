# Learning: first delivery

Learning is a Spanish introduction to US terminal radar with gradual aviation English.
It is an educational simulation, not accredited instruction or FAA certification.
The fictional single-runway sector is not an official chart. No professional review is claimed.

The eight-module route lives in `src/learning/content.ts`; sections reference it without
duplicating lessons. Modules 1–3 have guided demonstrations. Modules 4–8 are conceptual
introductions with advanced practice explicitly pending. Departures, uncertain identity
variants, arrival compression, coordinated transfer, replay and debrief are future work.

Evidence is local, versioned and separate from game saves: consulted, started and
demonstrated in a guided exercise. Reading never awards demonstration. Unknown or corrupt
storage cannot unlock a practice. This is exercise completion, not operational mastery.

Sources checked on 2026-10-20: FAA JO 7110.65BB Change 3 and Pilot/Controller Glossary
Change 3, effective 2026-07-09. Each lesson links its section; use the live FAA publications
and applicable notices for real operations. Existing game thresholds are not universal FAA minima.

Delivery boundaries: content/progress → deterministic practice → Home/Learning integration.
Each can be reverted independently in reverse order without altering the game engine.
Foundation validation: progress tests and TypeScript; no runtime UI exists in this slice.

## Verification receipt (2026-10-20)

- `npm test`: 180 tests passed across 19 files, including 11 Learning tests.
- `npm run typecheck` and `npm run build`: passed.
- Chrome local flow: Home → Learning → modules 1–3, all practices completed, wrong
  callsign and wrong readback rejected, IDENT observation, delayed turn 060/075/090.
- Reload retained 3/3 demonstrations; interrupted attempts restart deterministically.
  Automated integration checks additionally cover corrupt/quota storage, direct practice
  prerequisites, wrong selected aircraft, repeated practice and Back/Forward focus.
- Browser Back/Forward and reload verified on Fundamentos. Mobile 393px: collapsible
  seven-section menu, radar and controls usable. Visible keyboard focus and labels checked.
- Chrome Console: zero visible messages/errors and no issues during Learning navigation.
- Existing tutorial opens and advances after selecting TRN101; free play spawns live
  traffic; Caribbean challenge opens a five-minute shift with its six-operation goal.
- Review found and corrected the completion display reverting assigned heading to 060,
  wrong-aircraft selection validation, and IDENT position reporting (FAA 5-3-6).
- Runtime path is entirely browser → versioned localStorage → evidence UI. No API,
  credentials, database or external service is required for Learning.
