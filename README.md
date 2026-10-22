# ATC Easy Radar

ATC Easy Radar is a React and TypeScript air-traffic-control game. Manage arrivals and departures with heading, altitude, speed, ILS and direct-to clearances across six airports.

## Choose a session

Home offers three destinations: **Jugar libre**, **Retos** and **Learning**, with a separate first-time tutorial link. Choose Jugar libre before configuring airport, runways/ILS and difficulty. Open-ended play is the default; an optional five-minute shift has its own operation goal and does not unlock Retos levels. The launch button stays visible while scrolling preparation.

Cancel, browser Back and returning from a game retain preparation settings for the current app session; reloading the page resets this draft. Learning and Retos keep their existing independent progress storage and URLs. Previous Sessions remains available as a collapsible log, not a saved-game resume action.

- **Guided tutorial:** one arrival teaches selection, heading, descent, speed and ILS capture. Time is stopped while you enter each instruction. After landing, a two-aircraft exercise teaches actual vertical separation, not just cleared altitude. Restart training at any time.
- **Five-minute shift:** complete the selected number of safe operations before five minutes of active running time expire. Menus, pause and tutorial instructions do not consume that time. The default goal is 10; airport challenges range from 6 to 12.
- **Free play:** open-ended practice with your chosen airport, runway setup, difficulty and speed. Existing game links without a mode remain free play.

Airport challenges reuse London Heathrow, Boston Logan, Las Américas, Dubai, Amsterdam Schiphol and Panama Tocumen. The presets choose an airport, goal and traffic ceiling; you can configure runways before starting.

### Scoring and progression

A landing or cleared departure handoff earns 100 points. Each additional clean operation adds 10 bonus points, capped at 50 per operation. A new separation-alert episode costs 25 points and resets the streak; an aircraft leaving without a successful operation costs 50. Points never go below zero. An accident ends a shift. The debrief shows recent events, conflict onset when recorded, the last clearance and practical advice. Use **SAVE RESULT** to retain the operation count and shift points in Previous Sessions.

Shift traffic begins easy, rises to medium after 3 safe operations and hard after 6, never above the difficulty you chose. That also changes the ILS cone width. Free play uses the selected difficulty immediately. Game speed changes aircraft motion and traffic cadence; the shift timer always measures active running time.

## Controls

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
