# ATC Easy Radar

**ATC Easy Radar** is a high-performance Air Traffic Control (ATC) simulation built with React and TypeScript. Take command of the skies, managing both incoming arrivals and departing traffic in a high-stakes environment where every degree and foot of altitude matters.

<img width="1465" height="832" alt="Screenshot 2026-03-07 at 11 33 00 PM" src="https://github.com/user-attachments/assets/ee206919-19a8-4cf1-b399-71dda2543bf6" />

---

## 🎮 How to Play

### 1. Selection & Command
- **Select an aircraft** by clicking its icon on the radar.
- **Issue orders** via the **Control Panel** (Heading, Altitude, Speed) and press **TRANSMIT COMMANDS**.
- **Keyboard Shortcuts:** Use the Command Console at the bottom for professional ATC inputs (e.g., `H250` for heading, `A5000` for altitude).

### 2. Mouse Interaction (Advanced)
- **Direct Heading:** With a plane selected, simply **click anywhere on the radar** to instantly set its heading towards that point. The plane will automatically deselect after the command, allowing for rapid-fire sequencing.
- **Visual Preview:** A dotted guide line follows your mouse when a plane is selected, showing the intended flight path.

### 3. Flight Operations
- **Arrivals (ARR - Green):** Guide them into the **blue ILS cone** below 10,000ft. Once established, they will auto-land.
- **Departures (DEP - Purple):** These aircraft spawn at the airport and climb automatically. Their mission is to **reach their assigned exit waypoint** to be handed over to the next sector.

---

## 🛠️ Flight Mechanics & Requirements

### Landing Requirements (Runway 36)
| Parameter | Requirement |
| :--- | :--- |
| **Heading** | Aligned with Runway (approx. 360°/000°) |
| **Altitude** | ≤ 3,000 ft |
| **Speed** | ≤ 200 kts |

### Departure Mission
| Parameter | Requirement |
| :--- | :--- |
| **Objective** | Reach assigned Waypoint (Triangle icons) |
| **Automation** | Auto-climb and Auto-navigation (unless overridden) |
| **Handover** | Automatic removal upon reaching waypoint |

### Aircraft Status Colors
| Color | Status | Meaning |
| :--- | :--- | :--- |
| 🟢 **Green** | ARR - Controlled | Arrival with active instructions. |
| 🟡 **Yellow** | ARR - Uncontrolled | Arrival awaiting initial instructions. |
| 🟣 **Purple** | DEP - Departure | Aircraft taking off and climbing. |
| 🔵 **Blue** | Established | Aircraft locked onto the ILS glideslope. |
| 🟠 **Orange** | Warning | Proximity alert or unstable approach. |
| 🔴 **Red** | Emergency | Collision or crash occurred. |

---

## ⚙️ Technical Specifications

- **Physics Engine:** Custom 50ms tick-rate loop with realistic turn rates (0.5°/tick), climb rates (15ft/tick), and acceleration.
- **Separation Standards:** 
  - **Warning:** < 40px lateral + < 1,500ft vertical.
  - **Collision:** < 20px lateral + < 1,000ft vertical.
- **Responsive Radar:** SVG-based display with smooth zooming and panning.

---

## 🚀 Getting Started

1. **Clone the repo**
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Run the development server:**
   ```bash
   npm run dev
   ```
4. **Open your browser:** `http://localhost:5173` (or your local Vite port).

---

## 📂 Project Architecture

```text
src/
├── components/
│   ├── RadarDisplay.tsx    # SVG Engine & Mouse Interactions
│   ├── ControlPanel.tsx    # Manual Command Interface
│   └── GamePage.tsx        # Command Parsing & State Management
├── hooks/
│   └── useGameLoop.ts      # Core Engine: Physics, Collisions, Spawning
├── types/
│   └── index.ts            # Type definitions for Planes, Airports, etc.
└── utils/
    └── audio.ts            # Sound effects manager
```

---

*Good luck, Controller. Keep the skies safe.*
