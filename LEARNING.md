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
