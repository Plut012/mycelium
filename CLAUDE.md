# Mycelium — Development Rules

## What This Is
A modular synth simulator — digital sandbox for analog signal paths. Web Audio API is the audio engine. Svelte is the UI. Modules are the building blocks.

## Stack
- **Frontend:** SvelteKit + TypeScript
- **Audio:** Web Audio API (native browser)
- **Persistence:** IndexedDB (client-side)
- **Container:** Docker + nginx (static build)

## Core Rules

- **Simple, robust, clever — in that order.** Always.
- **No backend.** This is a pure frontend application.
- **Web Audio API is the signal path.** Never build a custom DSP layer. Wrap AudioNodes, don't replace them.
- **Modules are self-contained.** Each module lives in `src/lib/modules/{name}/` with three files: `manifest.ts`, `engine.ts`, `Module.svelte`. No exceptions.
- **Themes are CSS custom property maps.** A theme sets custom properties on the rack container; components inherit them through the CSS cascade. No prop drilling, no theme context. See `src/lib/themes/types.ts` for the contract.
- **Grid-based layout.** Modules snap to a 60px grid. Positions are grid coordinates (col, row), not pixels. Modules declare `gridWidth`/`gridHeight` in their manifest. No overlapping — collision detection enforced.
- **No core changes for extensions.** Adding a module or theme must never require modifying engine code or other modules.
- **Patch cables use catenary curves.** `y = a * cosh(x/a)` — the real physics of a hanging cable, not bezier approximations.
- **AudioWorklet for custom DSP.** Stock modules use built-in AudioNodes. Custom analog modeling (tube saturation, drift, tape) uses AudioWorklet on a dedicated audio thread. Both look identical from the outside.
- **URL-encoded sharing.** Rack state compresses into a URL hash. No backend needed to share a patch.

## Module Creation Checklist
1. `manifest.ts` — id, name, category, ports, parameters, `gridWidth`, `gridHeight`
2. `engine.ts` — extends `ModuleEngine`, creates AudioNodes in `create()`, cleans up in `destroy()`
3. `Module.svelte` — uses shared UI primitives (Knob, Slider, Toggle), passes `gridWidth`/`gridHeight` to `ModulePanel`
4. Add to `src/lib/modules/registry.ts`
5. Test: module appears in browser, snaps to grid, connects, produces/processes signal

## What NOT to Build
- No preset/patch sharing system (yet)
- No MIDI support (yet)
- No plugin format compatibility (VST, AU, etc.)
- No custom DSP — use Web Audio API nodes and their built-in parameters
- No user accounts or authentication
- No backend API

## Code Style
- TypeScript strict mode
- Svelte components: one component per file, props over context where possible
- Stores: minimal, derived where possible
- CSS: scoped per component, theme values consumed via CSS custom properties (not props)
- Grid: CELL constant = 60px, keep in sync between `ModulePanel.svelte` and `+page.svelte`

## Directory Reference
```
src/lib/engine/     — Core audio engine classes
src/lib/modules/    — Module library (each module = own directory)
src/lib/ui/         — Shared UI primitives (Knob, Slider, PatchCable, etc.)
src/lib/themes/     — Theme definitions
src/lib/store/      — Svelte stores (rack state with save/load, theme)
docs/               — Overview, architecture, implementation plans
docs/todo_tasks/    — Active and completed task plans
```
