# 橫波傳播模擬器 (Transverse Wave Propagation Simulator)

## Overview
An interactive physics teaching web application that allows students to understand how transverse waves propagate. Users control a wave source by dragging with mouse or touch, and observe how the wave travels at different speeds.

## Architecture
- **Frontend-only app**: Pure React + Canvas-based simulation, no database needed
- **Framework**: React + Vite + Tailwind CSS
- **Rendering**: HTML5 Canvas with requestAnimationFrame for smooth 60fps animation

## Key Features
- Mouse/touch drag to control wave source oscillation
- Three wave speed options (slow/medium/fast)
- 2D transverse wave visualization
- Responsive design for desktop and tablet
- Real-time wave propagation physics

## File Structure
- `client/src/pages/wave-simulator.tsx` - Main wave simulation page with Canvas rendering
- `client/src/App.tsx` - App router setup
- `server/routes.ts` - Express backend (minimal, only serves frontend)

## Tech Details
- Wave data stored as array of y-displacement values
- Propagation implemented by shifting array values right each frame
- Speed controlled by number of shift steps per frame
- Pointer events used for unified mouse/touch handling
