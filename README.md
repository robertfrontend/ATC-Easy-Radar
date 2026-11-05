# ATC Easy Radar

ATC Easy Radar is a React and TypeScript air-traffic-control game. Manage arrivals and departures with heading, altitude, speed, ILS and direct-to clearances across six airports.

## Choose a session

Home offers four destinations: **Jugar libre**, **Ground Control**, **Retos** and **Learning**, with a separate first-time tutorial link. Choose Jugar libre before configuring airport, runways/ILS and difficulty. Open-ended play is the default; an optional five-minute shift has its own operation goal and does not unlock Retos levels. The launch button stays visible while scrolling preparation.

Cancel, browser Back and returning from a game retain preparation settings for the current app session; reloading the page resets this draft. Learning and Retos keep their existing independent progress storage and URLs. Previous Sessions remains available as a collapsible log, not a saved-game resume action.

- **Guided tutorial:** one arrival teaches selection, heading, descent, speed and ILS capture. Time is stopped while you enter each instruction. After landing, a two-aircraft exercise teaches actual vertical separation, not just cleared altitude. Restart training at any time.
- **Five-minute shift:** complete the selected number of safe operations before five minutes of active running time expire. Menus, pause and tutorial instructions do not consume that time. The default goal is 10; airport challenges range from 6 to 12.
- **Free play:** open-ended practice with your chosen airport, runway setup, difficulty and speed. Existing game links without a mode remain free play.

Airport challenges reuse London Heathrow, Boston Logan, Las Américas, Dubai, Amsterdam Schiphol and Panama Tocumen. The presets choose an airport, goal and traffic ceiling; you can configure runways before starting.

### Scoring and progression

A landing or cleared departure handoff earns 100 points. Each additional clean operation adds 10 bonus points, capped at 50 per operation. A new separation-alert episode costs 25 points and resets the streak; an aircraft leaving without a successful operation costs 50. Points never go below zero. An accident ends a shift. The debrief shows recent events, conflict onset when recorded, the last clearance and practical advice. Use **SAVE RESULT** to retain the operation count and shift points in Previous Sessions.

Shift traffic begins easy, rises to medium after 3 safe operations and hard after 6, never above the difficulty you chose. That also changes the ILS cone width. Free play uses the selected difficulty immediately. Game speed changes aircraft motion and traffic cadence; the shift timer always measures active running time.

## Ground Control

Choose **Ground Control** on Home, or open `/ground-control`, to manage the fictional Willow Field airport from above. This is a separate eight-minute surface-control shift, not a replacement for radar. Aircraft use connected taxiways, explicit clearances and two intersecting runways; no external map or paid service is needed.

### Complete the initial two flights

1. Select **GC101** on the map or in **Flights**. Choose **Taxi to runway 09**. The cyan dashed route follows the plain grey pavement and ends outside the runway at its white hold bars; taxi clearance never grants takeoff.
2. Once GC101 says **Holding short**, choose **Clear takeoff 09**. The shared runway reservation remains until its departure is complete. The operation is counted once, after the aircraft leaves the map.
3. Select **GC202**. Choose **Clear landing 09** when it is on approach and the action is available. Without clearance it flies a visible go-around circuit and returns; wait for the next approach rather than trying to clear it mid-circuit.
4. GC202 lands, slows on the runway and exits automatically. **Exiting runway** still counts as occupied: wait for **Runway clear · awaiting taxi**. Choose **Taxi to stand 2** to send the initial arrival toward its reserved boarding gate. Landing clearance alone never sends it to the terminal.
5. At the marked crossing it stops again. Choose **Cross runway 36** when available. Reaching its stand completes the arrival and adds exactly one operation.

The enlarged view includes grass beyond both runway ends, the approach circuits and the terminal. Aircraft use the existing radar mode's star target, heading cue, dotted leader and monospace data block. The readout shows the flight ID, current surface state and assigned runway or gate—not airborne altitude or speed. Labels keep a readable screen size and nearby gate blocks are staggered. Selecting a target opens its compact floating command panel. **Gate 1–4** labels and terminal connections identify the destination; arriving aircraft remain visible while waiting for your next clearance.

The initial approach lasts about 54 simulated seconds on runway 09 and 62 on runway 36 before a missed approach. Select the arrival and authorize landing during that window, or wait for its visible circuit to return. **Landing → taxi to stand → runway crossing** are three separate permissions; the selected flight and flight list explain which one is needed.

**Stop taxi** and **Resume taxi** preserve an aircraft's route. An aircraft already landing, taking off or crossing cannot be stopped mid-runway. Map aircraft can be selected with Tab then Enter/Space; the flight list provides larger touch targets.

### Timing, safety and results

- **Pause/Resume** freezes or resumes movement, spawning, waiting penalties and the shift clock together. **1×/2×** changes simulated time for all of those equally. **Restart** clears aircraft, reservations, counters and clock, returning to the same initial flights. **Back to modes** discards this shift without changing radar records or saved sessions.
- Each continuous wait allows 30 simulated seconds free; every later second adds one aircraft-second of delay. Moving resets the waiting allowance; a missed approach does not. Performance is `max(0, 100 × completed operations − whole delay seconds)`; there is no early defeat.
- At eight simulated minutes, no new traffic is generated. Resolve the pending flights to finish the gradual closeout and see the final evaluation. Arrivals at their stand are complete; while the traffic window is still open, they can turn around into a departure after 25 simulated seconds.
- A landing reserves a free stand in advance. A physically occupied runway exit blocks the next landing until its aircraft taxis clear, preventing a runway/crossing queue deadlock. Runway reservations and physical occupancy are shown separately.
- Both runways share one conservative operational reservation. Landing, takeoff and crossing clearances are blocked when incompatible, even before an aircraft physically reaches the intersection. Disabled actions state the reason and the flight that must move first.

### First-version limits and checks

Willow Field is an original hand-authored airport with four stands. Taxi pavement is deliberately unlabelled grey without yellow centerlines; runway identifiers, white safety holds and cyan selected routes remain visible. Traffic is deterministic, increases gradually and is capped at six active aircraft. Taxi movement uses one shared corridor queue: additional clearances wait with an explanation rather than attempting simultaneous opposing or junction movements. This favors recoverable, understandable play over maximum airport throughput. Approach circuits, braking and turning are simplified; this is entertainment, not operational ATC training. Results are local to the current shift and are not saved.

Run `npm test -- src/ground/simulation.test.ts src/ground/GroundControl.test.ts src/components/HomePage.test.ts` for focused checks. Domain tests cover both runway flows, mandatory crossings, shared reservations, physical runway/stand release, separation, rollout deceleration, pause/speed/reset, once-only scoring and mixed traffic through closeout. DOM integration tests use the real simulation and controlled animation frames to complete both initial flights and check navigation/clock cleanup. Use `npm test`, `npm run typecheck` and `npm run build` for the full project checks.

## Radar controls

1. Select an aircraft by clicking its symbol/data block or focusing it with Tab and pressing Enter/Space.
2. The side panel **prepares** heading, altitude, speed and approach instructions. Press **TRANSMIT CLEARANCE** to apply them. A draft badge distinguishes planned changes from the active clearance.
3. The console sends immediately on Enter: `H270`, `D3000`, `C5000`, `S180`, or combined `H270 D3000 S180`. `DEP` clears a departure to its assigned exit. A named fix clears direct to that fix.
4. Clicking empty radar space with an aircraft selected transmits a heading to that point. Clicking a fix transmits direct-to; clicking the ILS marker assigns that runway and vectors toward its outer fix without changing altitude/speed.
5. **PLAN ILS** stages a heading to the outer fix with 3,000 ft and 180 kt. It is not an automatic final intercept: transmit, then turn toward the runway heading inside the cone.
6. Use the visible Pause control or the menu. Opening/closing a menu does not clear a manual pause. The radar uses one fitted view with no in-game zoom or pan. Browser zoom and scrolling remain available; dragging does not issue a clearance.

### Approach help and prediction

Select an arrival to see the exact ILS capture checklist: an active eligible runway, position inside its cone, actual altitude at or below 10,000 ft, and heading less than 50° from runway heading. The cone is 20–520 radar units behind the runway and narrows with difficulty. Once established, the simulation provides automatic heading, descent and speed guidance.

With vectors enabled, the selected track shows a **30-second running-time forecast** based on the actual turn, speed, direct-to and ILS simulation. It refreshes twice per second and immediately after a new clearance. The forecast excludes other traffic, collision effects, later commands and later runway changes; it is not a separation guarantee. Its explanation appears in the selected flight controls, outside the radar layout, so selecting a track does not resize the fitted scope. Navigation-fix symbols and labels retain constant screen-pixel sizes without moving their real airport coordinates.

Departures initially climb on runway heading. They do not turn toward their assigned exit until you transmit `DEP`, the exit fix name or the strip’s **TRANSMIT DIRECT** button. The operation counts on handoff at a fix, not just on leaving the radar.

### Radar world bounds

Random free/shift/Retos sessions freeze an airport-centered rectangular world from the first valid radar panel measurement. Intake is sampled uniformly along all four edges, 20 world units inside the initial visible perimeter, with inward headings. Wider panels therefore offer more maneuvering room and longer transit paths; identical effective density or difficulty across devices is not guaranteed.

Resize and rotation never change this domain. A single fitted camera always shows the whole frozen sector with uniform coordinate scaling; there are no game zoom/pan controls or camera gestures. Browser accessibility zoom and scrolling remain unchanged. Uncleared departures leave beyond its operational edges; distant culling retains the existing 2,500/600 extent ratio. Standalone callers keep the legacy 600-unit square default. The radar and Home preview use plain black map backgrounds without decorative grids; real airport and navigation-fix coordinates remain unchanged. Range rings are off by default and remain optional distance guides in the Radar Overlays menu, not survival boundaries. Real separation halos and airport geometry are unchanged.

Spawn cadence, traffic caps/mix, separation, flight physics, level goals and the strict 35-unit cleared exit-fix handoff are unchanged. Tutorial and Learning retain their intentional scripted positions. Existing plane state needs no migration.

### Separation rules

The game uses radar units, not regulatory ATC separation standards:

- Alert: less than 55 units laterally **and** less than 1,000 ft vertically.
- Collision: less than 20 units laterally **and** less than 1,000 ft vertically.
- A pair with both aircraft below 1,000 ft is exempt.

The scope’s map scale is 22.4 units per NM. The 2-NM visual halo is only a reference, not the alert threshold. Training and the debrief use the simulation’s real thresholds.

## Development

Use Node 22 (current patch release) or newer.

```sh
npm ci
npm run dev
```

Open the Vite address printed by the command (default `http://localhost:3000`).

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

`lint` currently runs the TypeScript check, not a separate style linter. Tests cover physics, capture/separation boundaries, spawn/departure rules, commands, scoring, all-airport tutorial trajectories, path prediction and session UI/loop regressions. CI runs typecheck, tests and build for pull requests and pushes to main.

## Architecture

- `src/components`: session chooser, radar, flight controls and game UI.
- `src/hooks/useGameLoop.ts`: active-time simulation, spawning, event history and session lifecycle.
- `src/utils`: motion, navigation, approach, separation, prediction, tutorial and scoring rules.
- `src/config`: shared airport geometry and challenge presets.

Weather and emergencies are deliberately left for later. This game is for entertainment, not operational ATC training.

### Local KBOS geographic integration

KBOS uses a shared NAD83/GRS80 world for traffic, commands, prediction and presentation, with a frozen35-NM shortest span. Enter KBOS headings magnetically; navigation/render angles remain true internally. Other airports keep their existing conventions. Source localizer axes and displaced thresholds are distinct; offset15R uses a simplified last-NM transition, not a published approach or certified glideslope. Existing runway/progress IDs and traffic goals remain. Source and coverage limitations are documented in `src/geography/SOURCES.md`.
