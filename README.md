# Mycelium

A modular synth simulator — build analog signal paths in a digital sandbox.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`

## What Is This?

Mycelium is a browser-based modular synthesizer where you build signal paths from scratch. Drag modules onto the rack, patch them together with cables, shape your sound.

Each module simulates an analog component — oscillators, filters, effects, modulation sources. The signal path runs through the Web Audio API. The interface runs through Svelte.

## Features

- Drag-and-drop modular rack
- Real audio signal path via Web Audio API
- Patch cables with visual signal flow
- Per-module theming
- Growing module library (sources, filters, effects, modulation, utilities)
- Save/load rack configurations
- Containerized deployment

## Module Library

| Category | Modules |
|----------|---------|
| Source | Oscillator, Noise, Audio Input |
| Filter | Low-pass, High-pass, Band-pass |
| Effect | Delay, Reverb, Distortion |
| Modulation | LFO, Envelope |
| Utility | Mixer, Gain, Meter |
| Output | Speaker, Recorder |

## Themes

Themes transform the entire look and feel — not just colors, but textures, shapes, and atmosphere.

- **Ancient Forest** — Tree-ring knobs, vine cables, bark panels, bioluminescent signal glow

## Development

```bash
npm run dev       # Dev server
npm run build     # Production build
npm run preview   # Preview production build
```

## Docker

```bash
docker build -t mycelium .
docker run -p 8080:80 mycelium
```

## Creating Modules

See `docs/architecture.md` for the module creation guide. Each module is three files:

```
src/lib/modules/{name}/
├── manifest.ts    # Metadata, ports, parameters
├── engine.ts      # Audio engine (wraps Web Audio nodes)
└── Module.svelte  # UI component
```
