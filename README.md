# Mycelium

A modular synth simulator — build analog signal paths in a digital sandbox.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`

## What Is This?

Mycelium is a browser-based modular synthesizer where you build signal paths from scratch. Place modules on a grid, patch them together with cables, shape your sound. The spatial arrangement is yours — each rack is a personal instrument.

Each module simulates an analog component — oscillators, filters, effects, modulation sources. The signal path runs through the Web Audio API. The interface runs through Svelte.

## Features

- Grid-based modular rack — snap modules to a grid, arrange freely, no overlapping
- Real audio signal path via Web Audio API
- Patch cables with catenary curves and visual signal flow
- Deep theming via CSS custom properties (environments, not skins)
- Growing module library (sources, filters, effects, modulation, utilities)
- Save/load rack configurations to browser storage
- Share patches via URL (zero-infrastructure sharing)
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
├── manifest.ts    # Metadata, ports, parameters, grid size
├── engine.ts      # Audio engine (wraps Web Audio nodes)
└── Module.svelte  # UI component (sized to grid units)
```

Modules declare their grid footprint (`gridWidth` x `gridHeight`) in the manifest. The `ModulePanel` component sizes itself accordingly.
