# Intensity challenges: initial balance

Twenty numbered levels per airport, separate from free play, tutorial, Learning and
the original quota-based shift. Each challenge runs for 300,000 ms of active simulation
at the existing 1× game speed. Pauses and menus do not consume active time. Quotas never
end a challenge early. An accident fails immediately; otherwise evaluate at five minutes.

Pass: zero accidents plus at least 1 effective operation at levels 1–5, 2 at 6–10,
3 at 11–15 and 4 at 16–20. An effective operation is a normal successful landing/handoff
of an aircraft given a recognized player clearance during this attempt. Uncommanded
automatic operations do not qualify. Warnings/points do not add a hidden pass condition.

Intake interval decreases from 30,000 to 9,100 ms before airport calibration. The active
traffic cap rises from 3 to 12; departure probability declines from 90% to 42.5%, bringing
more arrivals into the mix. The empty sector's first aircraft is a safe departure. These
are initial adjustable balance values, not a claim of 120 manually playtested levels.

Airport calibration (interval multiplier / cap adjustment): Las Américas 1.10 / 0,
Panama 1.05 / 0, Heathrow 1.00 / +1, Boston 1.20 / −1, Schiphol 1.10 / 0, Dubai 0.95 / +1.
Boston receives the longest interval; Heathrow/Dubai allow an additional active track.
Challenge runway setup uses the airport's first runway for arrivals and departures;
it cannot be disabled. Other runways remain inactive. Free-play settings are unchanged.

Flight motion, commands, separation and ILS rules stay fixed at the existing easy-game
parameters across all challenge levels. These are simplified game geometries, not FAA
training or universal operational minima. Future balancing may adjust intake and quotas.

Progress uses only `atc_challenges_progress_v1`, storing a validated contiguous completion
frontier per airport. Level 1 starts unlocked; only a successful full attempt can advance
the frontier. Replay cannot lower progress or skip a level; level 20 has no level 21.
Existing saves/high scores/Learning storage are not migrated or overwritten.
