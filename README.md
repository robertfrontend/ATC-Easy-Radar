# ATC Easy Radar

Air Traffic Control radar simulation game. Guide aircraft to a safe landing on Runway 36 without causing collisions.

## How to Play

1. **Select** an aircraft by clicking on it in the radar
2. **Issue commands** using the side panel: set heading, altitude, and speed, then press **TRANSMIT COMMANDS**
3. **Click anywhere** on the radar to instantly point the selected aircraft in that direction
4. **Navigate via waypoints** — click any waypoint triangle while a plane is selected to route it there
5. Once a plane enters the ILS cone at the right altitude and heading, it will **auto-land**

### Landing Requirements (Runway 36)

| Parameter | Requirement          |
|-----------|----------------------|
| Heading   | 330° – 030° (North)  |
| Altitude  | <= 3,000 ft          |
| Speed     | <= 200 kts           |

### Aircraft Status Colors

| Color  | Meaning                              |
|--------|--------------------------------------|
| Yellow | Uncontrolled (no instructions given) |
| Green  | Controlled                           |
| Blue   | Established on ILS approach          |
| Orange | Proximity warning or bad approach    |
| Red    | Crashed                              |

## Running Locally

**Prerequisites:** Node.js

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── types/
│   └── index.ts            # Shared TypeScript interfaces (Plane, Difficulty)
├── hooks/
│   └── useGameLoop.ts      # Game engine: physics, spawning, collision detection
└── components/
    ├── RadarDisplay.tsx    # SVG radar view with interactive plane selection
    └── ControlPanel.tsx    # Side panel for issuing ATC commands
```

## Game Mechanics

- Planes spawn outside the radar field aimed roughly at the center
- Turn rate: 0.5 deg/tick | Climb rate: 15 ft/tick | Acceleration: 0.2 kt/tick
- Tick rate: 50ms (sped up by the simulation speed multiplier)
- Collision warning: < 40px lateral + < 1,500 ft vertical separation
- Collision accident: < 20px lateral + < 1,000 ft vertical separation
- Score: +1 per successful landing, tracked across sessions via localStorage
