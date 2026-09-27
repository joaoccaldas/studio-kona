# KONA · IRONMAN® World Championship Living 3D World & Canyon Speedmax Museum

> **Caldas Studio Flagship Experience**  
> An interactive, photorealistic WebGL game world celebrating the sacred spirit of Kailua-Kona, Hawaiʻi, its 500,000-year living heritage, and 45 years of IRONMAN® endurance racing and aerodynamic superbike evolution.

---

## 🌺 Overview

Step onto the sunlit deck of **Kailua Pier** on race week morning. Explore the sacred leeward coast of the Big Island on foot, or mount the world-record-setting **Canyon Speedmax CFR** superbike to cruise along Aliʻi Drive, tackle the infamous Palani Road climb, and race past the volcanic lava fields of the Queen K Highway.

Uncover the island’s rich history beyond triathlon through the **Hawaiian Heritage Odyssey**—from deep geological basalt formations and ancient Polynesian wayfinding star compasses to King Kamehameha’s Ahuʻena Heiau sanctuary and modern athletic milestones.

---

## ⚡ Key Features

### 1. Dual-Mode Locomotion & Physics Engine
- **Athlete Walk Mode**: Fluid first-person locomotion across Kailua Pier, Dig Me Beach, and Aliʻi Drive with BVH-accelerated downward raycasting, physical jumping, and footstep audio.
- **Speedmax CFR Aero Cruise**: Press `[B]` anywhere on dry land to mount the Speedmax CFR superbike. Cruise at **43 km/h (95 RPM)** or hold `Shift` to sprint at **67 km/h (147 RPM)** in aero tuck, featuring realistic lean-angle banking roll dynamics on turns.
- **Ocean Swimming**: Wade into Kailua Bay for procedural buoyant swimming with Gerstner wave bobbing and water splash soundscapes.
- **Aerial Drone Mode**: Press `[M]` to smoothly switch between first-person ground exploration and smooth cinematic orbit controls across the entire island.

### 2. Canyon Speedmax 3D Museum Studio
- **Photo-Calibrated Geometry**: Exact 0.834 mm/pixel silhouette match against official Canyon studio photography with 0.988 IoU precision.
- **Procedural 4K Carbon Textures**: Canvas-synthesized DT Swiss ARC 1100 carbon twill weave with authentic vector typography, and Continental Grand Prix 5000 S TR sidewalls.
- **Aero Wheelset Switching**: Real-time lathe-generated carbon rear disc wheel vs. dual 80mm deep-section spoked wheelsets.
- **Physical Material Customizer**: Semantic paint swatches (Kona Gold, Stealth Carbon, Flash Coral, Pacific Cyan, Arctic White, Canyon Mint, Island Sage) with matte/gloss finish toggles that preserve carbon weaves and component decals.
- **Historical Pedestals**: Walk up to iconic championship bikes on Kailua Pier (Jan Frodeno 2019, Lucy Charles-Barclay 2023, Patrick Lange 2024-2027) and press `[E]` to inspect in the 3D studio.

### 3. Hawaiian Heritage Scavenger Hunt & Quest Progression
- **12 Epoch Lore Codex**: Interactive historical discoveries spanning from ~500,000 BP (Madame Pele's basalt) and ~800 CE (Wayfinder Star Compass) to 1812 (Ahuʻena Heiau) and 1982 ("The Crawl" Julie Moss).
- **Race Week Quests**: 7-day progression system with directional compass navigation, in-world beacon beams, audio chimes, and checklist tasks that unlock championship superbikes and historical artifacts.

---

## 🕹️ Controls Guide

| Control | Action |
| :--- | :--- |
| **W / A / S / D** (or Arrows) | Move / Pedal & Steer |
| **Mouse Drag / Pointer Lock** | Look around (Yaw & Pitch) |
| **Shift** (Hold) | Sprint on foot / Aero Speedmax Sprint (67 km/h) |
| **Space** | Physical Jump |
| **B** | Mount / Dismount Speedmax CFR Superbike |
| **E** | Enter 3D Studio when near a pedestal or beacon |
| **M** | Toggle between First-Person Locomotion & Drone Fly |
| **Landmark Buttons** | Quick travel to Kailua Pier, Dig Me Beach, Finish Line, Hāwī, Energy Lab |

---

## 🏗️ Technology Stack

- **Graphics Core**: Three.js (r160), custom GLSL Gerstner wave ocean shaders, procedural canvas textures.
- **Collision & Physics**: `three-mesh-bvh` BVH raycasting with ground surface hugging.
- **Audio Engine**: Synthesized Web Audio API procedural soundscapes (footsteps, water splashes, conch horn, chime fanfare).
- **Bundler & Tooling**: Node.js, Esbuild (`build.mjs`), Meshopt Decoder for glTF/GLB models.

---

## 🚀 Running Locally

```bash
# Clone the repository
git clone https://github.com/joaoccaldas/studio-kona.git
cd studio-kona

# Install dependencies
npm install

# Build client bundle
npm run build

# Start local server
python3 web/serve.py
```

Open `http://localhost:8791` in your browser.

---

## 📜 License & Credits

Built with pride by **João Caldas** for the **Caldas Studio** collection.  
Inspired by the sacred lands of Kailua-Kona, the athletes of the IRONMAN® World Championship, and Canyon Bicycles engineering.
