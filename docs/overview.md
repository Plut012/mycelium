# Mycelium

A digital sandbox for simulating analog signal paths through a modular synth interface.

---

## Core Concept

Mycelium is the fungal network beneath an ancient forest — invisible threads connecting living things, passing signals between them. This is a modular synthesizer simulator where each module is an organism, patch cables are hyphae, and the rack is a forest floor you cultivate.

It is not a DAW. It is not a plugin host. It is a sandbox where you build signal paths from scratch, module by module, cable by cable — and where every piece of it feels like yours.

The framework simulates analog signal behavior in a digital environment. Web Audio API provides the real signal path. The UI provides the hands.

---

## What Makes It Different

**It's a simulator, not a preset machine.** You build from primitives — oscillators, filters, envelopes, delays — the way you'd build a physical rack. No presets, no magic. Understanding the signal path *is* the experience.

**Modules are a living library.** The module collection grows over time. Each module is self-contained: an audio engine, a UI component, and a manifest. New modules can be created rapidly through Claude Code — describe what you want, scaffold it, patch it in.

**Themes are environments, not skins.** A theme transforms the entire feel — knob textures, cable appearance, panel materials, signal indicators. The first theme is Ancient Forest: tree-ring knobs, vine cables, bark panels, bioluminescent signal flow.

**The rack is a grid you compose.** Modules are physical blocks that snap to a grid — like stones arranged in a garden. You choose where each module lives. No overlapping, no chaos — just deliberate placement. Two people with the same modules will have different-looking instruments. The spatial arrangement itself is creative expression.

**Patch cables are visible signal.** When enabled, cables render between connected ports. They carry the theme's visual language. They can be toggled on/off globally. When on, they're part of the aesthetic — not just plumbing.

---

## Principles

1. **Analog heart, digital power.** Simulate analog behavior faithfully, but leverage the digital environment for things analog can't do — infinite modules, instant recall, custom creations.

2. **Simple, robust, clever — in that order.** Every architectural choice must justify its complexity. The module system is simple to extend. The audio engine is robust under load. Clever optimizations come last.

3. **Framework-first.** The module and theme systems are first-class architectural concerns. Adding a new module or theme should never require touching core code.

4. **The builder is the instrument.** Configuring the rack, choosing modules, patching signals, tweaking themes — this is the creative act. The UI should make this feel like play, not work.

5. **The grid is the canvas.** Modules snap to a grid and occupy a defined footprint (width x height in grid units). Placement is free — any open space on the grid — but no overlapping. The grid itself is part of the theme aesthetic.

---

## Module Categories

| Category | Purpose | Examples |
|----------|---------|---------|
| **Source** | Generate or capture signal | Oscillator, Noise, Audio Input (guitar/mic) |
| **Filter** | Shape frequency content | Low-pass, High-pass, Band-pass, Parametric EQ |
| **Effect** | Transform signal | Delay, Reverb, Distortion, Chorus, Flanger, Phaser, Tremolo |
| **Modulation** | Control other parameters | LFO, Envelope, Envelope Follower, Sequencer |
| **Utility** | Route and measure | Mixer, Splitter, Gain, Meter, Tuner |
| **Output** | Deliver signal | Speaker Output, Recorder |

Categories are filterable in the module browser. The library grows over time.

---

## Development Workflow

1. **DISCUSSION** — Align on what we're building and why
2. **QUESTIONS / IDEAS** — Explore implementation approaches together, always favoring simplicity
3. **IMPACT ANALYSIS** — Consider what's affected and what depends on what
4. **TODO PLAN** — Create a clear technical plan in `docs/todo_tasks/`
5. **IMPLEMENTATION** — Build it. If a decision point arises, surface options and decide together
6. **DOCUMENTATION** — Finalize the plan with overview, deviations, and lessons learned

---

## Module Creation Workflow (Claude Code)

Creating a new module follows a repeatable pattern:

1. Describe the module's behavior and signal characteristics
2. Claude scaffolds: audio engine class, Svelte component, manifest, and theme variant
3. The module is placed in `src/lib/modules/{name}/`
4. It self-registers via its manifest — no core code changes needed
5. It appears in the module browser under its category, ready to patch

The same workflow applies to themes — describe the aesthetic, scaffold the theme definition, apply it.
