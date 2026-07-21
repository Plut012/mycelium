<script lang="ts">
  import { ModulePanel, PortJack } from '$lib/ui';
  import type { TinKeysEngine, PadId } from './engine.js';
  import { padId } from './engine.js';

  type Props = {
    engine: TinKeysEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  // Top row rendered first = upper octave (octave 1), like the hardware panel
  const ROWS = [1, 0];

  let activePads = $state<Set<PadId>>(new Set());

  $effect(() => {
    const unsub = engine.onSpore('degree_out', () => {
      activePads = engine.getActivePads();
    });
    return unsub;
  });

  // ── Pointer interaction — capture on the grid, hit-test pads, glide across ──

  const pointerPads = new Map<number, PadId>();

  function padAt(clientX: number, clientY: number): { degree: number; octave: number } | null {
    const el = document.elementFromPoint(clientX, clientY);
    const pad = el?.closest('[data-degree]') as HTMLElement | null;
    if (!pad) return null;
    return { degree: Number(pad.dataset.degree), octave: Number(pad.dataset.octave) };
  }

  function onPointerDown(e: PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const pad = padAt(e.clientX, e.clientY);
    if (!pad) return;
    pointerPads.set(e.pointerId, padId(pad.degree, pad.octave));
    engine.padOn(pad.degree, pad.octave);
  }

  function onPointerMove(e: PointerEvent) {
    const prev = pointerPads.get(e.pointerId);
    if (prev === undefined) return;
    e.preventDefault();
    const pad = padAt(e.clientX, e.clientY);
    const next = pad ? padId(pad.degree, pad.octave) : null;
    if (next === prev) return;
    const [pOct, pDeg] = prev.split(':').map(Number);
    engine.padOff(pDeg, pOct);
    if (pad && next) {
      pointerPads.set(e.pointerId, next);
      engine.padOn(pad.degree, pad.octave);
    } else {
      pointerPads.delete(e.pointerId);
    }
  }

  function onPointerUp(e: PointerEvent) {
    const prev = pointerPads.get(e.pointerId);
    if (prev !== undefined) {
      const [pOct, pDeg] = prev.split(':').map(Number);
      engine.padOff(pDeg, pOct);
      pointerPads.delete(e.pointerId);
    }
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); }
    catch { /* already released */ }
  }
</script>

<ModulePanel title="Tin Keys" gridWidth={5} gridHeight={3}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="pad-grid"
    style="touch-action: none;"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
  >
    {#each ROWS as octave}
      <div class="pad-row">
        {#each ROMAN as numeral, i}
          {@const active = activePads.has(padId(i + 1, octave))}
          <div
            class="pad"
            class:upper={octave === 1}
            class:active
            data-degree={i + 1}
            data-octave={octave}
          >
            <span class="numeral">{numeral}</span>
          </div>
        {/each}
      </div>
    {/each}
  </div>

  <div class="bottom-bar">
    <span class="hint">a–j / q–u</span>
    <div class="ports-group">
      <PortJack
        id="degree_out"
        type="spore"
        direction="output"
        label="DEG"
        connected={connectedPorts.has('degree_out')}
        onConnect={() => onPortConnect?.('degree_out')}
        {moduleId}
      />
    </div>
  </div>
</ModulePanel>

<style>
  .pad-grid {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    flex: 1;
    min-height: 0;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .pad-row {
    display: flex;
    gap: 4px;
    flex: 1;
    min-height: 0;
  }

  .pad {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(26, 18, 16, 0.7);
    border: 1px solid var(--port-stroke, #5a4a3a);
    border-radius: var(--control-radius, 3px);
    cursor: pointer;
    transition: background 0.08s, border-color 0.08s, box-shadow 0.08s;
  }

  .pad.upper {
    background: rgba(26, 18, 16, 0.45);
  }

  .pad.active {
    background: color-mix(in srgb, var(--knob-indicator, #7fba5c) 18%, transparent);
    border-color: var(--knob-indicator, #7fba5c);
    box-shadow: 0 0 8px color-mix(in srgb, var(--knob-indicator, #7fba5c) 35%, transparent) inset;
  }

  .numeral {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--label-color, #a89880);
    pointer-events: none;
  }

  .pad.active .numeral {
    color: var(--knob-indicator, #7fba5c);
  }

  .bottom-bar {
    display: flex;
    align-items: center;
    width: 100%;
    flex-shrink: 0;
  }

  .hint {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 8px;
    color: var(--label-color, #a89880);
    opacity: 0.4;
  }

  .ports-group {
    margin-left: auto;
  }
</style>
