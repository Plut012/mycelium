# Architecture

Technical foundation for Mycelium.

---

## Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Framework** | SvelteKit + TypeScript | Minimal boilerplate, compiled reactivity, scoped CSS per component — ideal for per-module theming |
| **Audio Engine** | Web Audio API + AudioWorklet | Native browser audio graph for stock nodes; AudioWorklet for custom analog modeling (tube saturation, drift, tape) on a dedicated audio thread |
| **Persistence** | IndexedDB | Client-side storage for rack state and preferences. No backend needed |
| **Sharing** | URL-encoded state | Rack state compressed and encoded in URL hash — share a patch by sharing a link |
| **Containerization** | Docker + nginx | Static build served by nginx. Simple, fast, portable |
| **Build** | Vite (via SvelteKit) | Fast dev server, optimized production builds |

---

## Repository Structure

```
mycelium/
├── docs/
│   ├── overview.md              # Vision and philosophy
│   ├── architecture.md          # This document
│   └── todo_tasks/              # Implementation plans
│
├── src/
│   ├── lib/
│   │   ├── engine/              # Audio engine core
│   │   │   ├── AudioEngine.ts   # AudioContext lifecycle, global state
│   │   │   ├── Module.ts        # Base module class
│   │   │   ├── Port.ts          # Input/Output port types
│   │   │   ├── Parameter.ts     # Automatable parameter definition
│   │   │   └── Rack.ts          # Module graph + patch management
│   │   │
│   │   ├── modules/             # Module library (grows over time)
│   │   │   ├── registry.ts      # Auto-discovers and indexes modules
│   │   │   ├── oscillator/
│   │   │   │   ├── engine.ts    # Audio engine (wraps OscillatorNode)
│   │   │   │   ├── Module.svelte # UI component
│   │   │   │   └── manifest.ts  # Metadata, ports, parameters
│   │   │   ├── filter/
│   │   │   ├── gain/
│   │   │   ├── delay/
│   │   │   ├── audio-input/
│   │   │   └── output/
│   │   │
│   │   ├── ui/                  # Shared UI primitives
│   │   │   ├── Knob.svelte      # Rotary control
│   │   │   ├── Slider.svelte    # Linear control
│   │   │   ├── Toggle.svelte    # On/off switch
│   │   │   ├── PatchCable.svelte # SVG catenary cable between ports
│   │   │   ├── PortJack.svelte  # Clickable port connector
│   │   │   └── ModulePanel.svelte # Module frame/housing
│   │   │
│   │   ├── themes/              # Theme definitions
│   │   │   ├── types.ts         # Theme = CSS custom property map
│   │   │   └── ancient-forest/  # First theme
│   │   │       ├── theme.ts     # Custom property values + assets
│   │   │       └── assets/      # Textures, SVG patterns
│   │   │
│   │   └── store/               # Svelte stores
│   │       ├── rack.ts          # Rack state (modules, connections, positions, save/load)
│   │       └── theme.ts         # Active theme
│   │
│   ├── routes/
│   │   └── +page.svelte         # Main rack workspace
│   │
│   └── app.html
│
├── static/                      # Static assets
├── Dockerfile
├── package.json
├── svelte.config.js
├── tsconfig.json
├── vite.config.ts
└── CLAUDE.md
```

---

## Core Abstractions

### Module

The fundamental unit. Every module has three layers:

```
┌─────────────────────────────────┐
│  Manifest (metadata)            │  Category, name, description,
│                                 │  port definitions, parameter defs
├─────────────────────────────────┤
│  Engine (audio)                 │  Creates/connects AudioNodes or
│                                 │  AudioWorklets, exposes parameters
├─────────────────────────────────┤
│  Component (UI)                 │  Svelte component, themed via CSS
│                                 │  custom properties, renders controls
└─────────────────────────────────┘
```

**Manifest** — declares what the module is:
```typescript
interface ModuleManifest {
  id: string;                          // e.g. "oscillator"
  name: string;                        // e.g. "Oscillator"
  category: ModuleCategory;            // "source" | "filter" | "effect" | ...
  description: string;
  inputs: PortDefinition[];            // typed audio/control inputs
  outputs: PortDefinition[];           // typed audio/control outputs
  parameters: ParameterDefinition[];   // knobs, switches, selectors
}
```

**Engine** — wraps Web Audio API nodes:
```typescript
abstract class ModuleEngine {
  abstract create(ctx: AudioContext): void;
  abstract connect(target: ModuleEngine, outputPort: string, inputPort: string): void;
  abstract disconnect(target: ModuleEngine, outputPort: string, inputPort: string): void;
  abstract setParameter(name: string, value: number): void;
  abstract getAnalyserNode(): AnalyserNode | null;  // optional signal visualization tap
  abstract destroy(): void;
}
```

The interface is identical whether a module uses stock AudioNodes or a custom AudioWorklet. Modules that need custom DSP (tube saturation, analog drift, tape degradation) register an AudioWorkletProcessor — the engine class wraps it the same way it wraps an OscillatorNode. This keeps the module boundary clean: the rack doesn't know or care what's inside.

**Component** — Svelte component that receives engine instance, themed via CSS cascade:
```svelte
<script lang="ts">
  export let engine: OscillatorEngine;
  // Theme flows through CSS custom properties — no prop needed
</script>

<div class="module oscillator">
  <Knob value={engine.frequency} />  <!-- inherits --knob-body, --knob-indicator from theme -->
</div>
```

### Port

Ports are typed connection points:

```typescript
interface PortDefinition {
  id: string;              // e.g. "audio_out"
  name: string;            // e.g. "Output"
  type: "audio" | "control";  // audio = signal, control = parameter modulation
  direction: "input" | "output";
}
```

- **Audio ports** carry signal (connect AudioNode outputs to inputs)
- **Control ports** carry modulation (connect to AudioParam for automation — e.g., LFO -> filter cutoff)

### Parameter

User-controllable values exposed as knobs/sliders:

```typescript
interface ParameterDefinition {
  id: string;              // e.g. "frequency"
  name: string;            // e.g. "Freq"
  type: "continuous" | "stepped" | "toggle" | "select";
  min?: number;
  max?: number;
  default: number | string;
  unit?: string;           // e.g. "Hz", "dB", "ms"
  steps?: string[];        // for "select" type: ["sine", "square", "saw", "triangle"]
}
```

### Rack

The workspace that manages everything:

```typescript
class Rack {
  modules: Map<string, ModuleInstance>;    // placed modules
  connections: Connection[];               // patch cables
  audioContext: AudioContext;

  addModule(type: string, position: {x, y}): ModuleInstance;
  removeModule(id: string): void;
  connect(from: PortRef, to: PortRef): Connection;
  disconnect(connectionId: string): void;

  // Persistence — simple functions, not a layer
  serialize(): RackState;
  save(name: string): Promise<void>;           // serialize -> IndexedDB
  static load(name: string): Promise<Rack>;    // IndexedDB -> deserialize
  toURL(): string;                              // serialize -> compressed URL hash
  static fromURL(hash: string): Rack;          // URL hash -> deserialize
}
```

---

## Theming via CSS Custom Properties

Themes are CSS custom property maps, not JS objects passed through props. A theme sets properties on the rack container, and every child component inherits them through the natural CSS cascade.

```typescript
interface Theme {
  id: string;
  name: string;
  properties: Record<string, string>;  // CSS custom property map
}
```

A theme applies like this:

```typescript
// ancient-forest/theme.ts
export const ancientForest: Theme = {
  id: "ancient-forest",
  name: "Ancient Forest",
  properties: {
    // Rack
    "--rack-bg": "url('/themes/ancient-forest/moss-floor.webp')",

    // Panels
    "--panel-bg": "linear-gradient(135deg, #2a1f1a, #3d2e24)",
    "--panel-border": "1px solid #5a4a3a",
    "--panel-radius": "6px",
    "--panel-shadow": "0 4px 12px rgba(0,0,0,0.5)",

    // Knobs
    "--knob-body": "radial-gradient(circle, #4a3828, #2a1f1a)",  // tree rings
    "--knob-indicator": "#7fba5c",           // living green
    "--knob-track": "#5a4a3a",
    "--knob-size": "48px",

    // Cables
    "--cable-stroke": "#4a7a3a",             // vine green
    "--cable-width": "3px",
    "--cable-opacity": "0.85",
    "--cable-droop": "0.4",                  // catenary sag factor
    "--cable-glow": "#7fff7f",               // bioluminescent signal

    // Ports
    "--port-fill": "#1a1210",
    "--port-stroke": "#5a4a3a",
    "--port-glow": "#7fba5c",

    // Labels
    "--label-font": "'Courier New', monospace",
    "--label-color": "#a89880",
    "--label-size": "11px",
  }
};
```

UI primitives consume these directly:

```svelte
<!-- Knob.svelte -->
<div class="knob"
  style:width="var(--knob-size)"
  style:background="var(--knob-body)">
  <div class="indicator" style:background="var(--knob-indicator)" />
</div>
```

Modules can override locally by setting properties on their own container — the cascade handles the rest. No prop threading, no context API, no theme provider. Just CSS doing what CSS does.

---

## Patch Cables — Catenary Curves

Cables render as SVG overlays using catenary curves — the shape a real cable makes hanging under gravity. Not bezier (which is an approximation), but the real equation:

```
y = a * cosh((x - x₀) / a) + y₀
```

Where `a` controls sag (themed via `--cable-droop`). The result is subtle but feels physically correct — cables droop heavier when longer, tighter when shorter.

When signal flows through a connection, the cable pulses with `--cable-glow` — in Ancient Forest, this is a bioluminescent green traveling along vine-like cables. The mycelium network, alive with signal.

Cables are toggled globally (on/off). When on, they're part of the aesthetic. When off, connections still exist — just invisible.

---

## Signal Visualization

Every module can optionally expose an `AnalyserNode` tap. This lets the UI render real-time signal data — waveforms, frequency spectra, signal level — directly on the module face.

This is the key advantage of digital over analog: **you can see your signal**. On a physical rack, signal is invisible. Here, each module can show what's passing through it.

In the Ancient Forest theme, this manifests as bioluminescent patterns — signal intensity mapped to glow brightness, waveform shape rendered as organic light patterns on the module panel. The forest floor pulses with the music.

The AnalyserNode tap is zero-cost when not rendered (no UI component = no `getByteTimeDomainData` calls). Modules that don't need visualization return `null` from `getAnalyserNode()`.

---

## Signal Flow

```
Audio Input ──┐
              ▼
         ┌─────────┐    ┌─────────┐    ┌─────────┐
         │  Source  │───▶│ Filter  │───▶│ Effect  │───▶ Output
         └─────────┘    └─────────┘    └─────────┘
                              ▲
                         ┌────┘
                    ┌─────────┐
                    │   LFO   │  (control port -> filter cutoff)
                    └─────────┘

         AnalyserNode taps ═══════════════════════ signal visualization
```

All signal routing happens through the Web Audio API graph. The Rack mirrors this graph for UI purposes (positions, cable rendering, serialization) but the audio path is native browser audio.

Stock modules use built-in AudioNodes (OscillatorNode, BiquadFilterNode, GainNode, DelayNode). Custom analog modeling modules use AudioWorklet for real-time DSP on a dedicated thread — tube warmth, component drift, tape saturation. Both look identical from the outside.

---

## Persistence & Sharing

### Rack State

```typescript
interface RackState {
  id: string;
  name: string;
  modules: {
    id: string;
    type: string;            // manifest id
    position: { x: number; y: number };
    parameters: Record<string, number | string>;
  }[];
  connections: {
    id: string;
    from: { moduleId: string; portId: string };
    to: { moduleId: string; portId: string };
  }[];
  theme: string;             // active theme id
}
```

### Save/Load

Save and load are functions on the Rack, not a separate persistence layer. `rack.save("my patch")` serializes to IndexedDB. `Rack.load("my patch")` deserializes. Simple.

### URL Sharing

`rack.toURL()` compresses the RackState and encodes it as a URL hash. Send someone `mycelium.app/#eJzLz...` and they open your exact rack — modules, connections, parameters, theme. Zero infrastructure sharing.

---

## Data Flow

```
User Interaction (drag, knob turn, cable patch)
       │
       ▼
┌─────────────┐         ┌─────────────┐
│  Svelte UI  │────────▶│  Rack Store │
│  Components │         │  (state)    │
│             │◀────────│             │
└─────────────┘         └──────┬──────┘
                               │
                    parameter   │  connect/
                    changes     │  disconnect
                               ▼
                        ┌─────────────┐
                        │  Web Audio  │
                        │  API Graph  │
                        └──────┬──────┘
                               │
                        ┌──────┴──────┐
                        │ AnalyserNode│── signal data ──▶ UI visualization
                        │    taps     │
                        └──────┬──────┘
                               │
                               ▼
                          speakers /
                          recorder
```

Svelte stores are the single source of truth for UI state. The Web Audio API graph is the single source of truth for audio state. The Rack keeps them in sync.

---

## Extending Mycelium

### Adding a Module

1. Create `src/lib/modules/{name}/`
2. Write `manifest.ts` — declare ports, parameters, category
3. Write `engine.ts` — extend `ModuleEngine`, wrap AudioNodes (or AudioWorklet for custom DSP)
4. Write `Module.svelte` — UI component using shared primitives (Knob, Slider, etc.)
5. The registry auto-discovers it. It appears in the module browser.

No core code changes. No registration boilerplate.

### Adding a Theme

1. Create `src/lib/themes/{name}/`
2. Write `theme.ts` — define CSS custom property map
3. Add any texture/pattern assets to `assets/`
4. The theme appears in the theme selector.

No core code changes.

### Adding Custom DSP (AudioWorklet)

1. Write the processor: `src/lib/modules/{name}/processor.ts` (runs on audio thread)
2. Register it in the engine's `create()` method via `audioContext.audioWorklet.addModule()`
3. Wrap the `AudioWorkletNode` the same way you'd wrap any AudioNode
4. From the outside, it's just another module.

### Adding a Module Category

1. Add to the `ModuleCategory` type
2. Add filter option in module browser UI
3. That's it.
