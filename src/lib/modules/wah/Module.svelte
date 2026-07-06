<script lang="ts">
  import { Footswitch, ModulePanel, PortJack } from '$lib/ui';
  import { positionToFreq, type WahEngine } from './engine.js';

  type Props = {
    engine: WahEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  let position = $state(0.45);
  let engaged = $state(true);

  function handlePortConnect(portId: string) {
    onPortConnect?.(portId);
  }

  function toggleEngaged() {
    engaged = !engaged;
    engine.setParameter('engaged', engaged ? 1 : 0);
  }

  // ── Lever interaction — grab and rock the treadle ────────────────────────

  let dragging = false;
  let startY = 0;
  let startPos = 0;

  function onPointerDown(e: PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    dragging = true;
    startY = e.clientY;
    startPos = position;
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    e.preventDefault();
    e.stopPropagation();
    // Drag up = toe down = brighter
    const next = Math.min(1, Math.max(0, startPos + (startY - e.clientY) / 140));
    position = next;
    engine.setParameter('position', next);
  }

  function onPointerUp(e: PointerEvent) {
    dragging = false;
    try { (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId); }
    catch { /* already released */ }
  }

  // Treadle rocks ±14° around its hinge; toe (right) dips as position rises
  let angle = $derived((position - 0.5) * 28);
  let freq = $derived(positionToFreq(position));
</script>

<ModulePanel title="Wah" gridWidth={3} gridHeight={4}>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <svg
    class="treadle"
    viewBox="0 0 120 100"
    role="slider"
    aria-label="Wah treadle position"
    aria-valuenow={Math.round(position * 100)}
    style="touch-action: none;"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
  >
    <!-- Base wedge -->
    <path class="base" d="M 18 88 L 102 88 L 96 72 L 24 72 Z" />
    <!-- Hinge -->
    <circle class="hinge" cx="60" cy="68" r="4" />
    <!-- Rocking plate -->
    <g transform="rotate({angle} 60 64)">
      <rect class="plate" x="16" y="56" width="88" height="12" rx="3" />
      {#each [28, 40, 52, 64, 76, 88] as gx}
        <line class="grip" x1={gx} y1="58.5" x2={gx} y2="65.5" />
      {/each}
      <text class="toe-label" x="97" y="52">TOE</text>
    </g>
    <!-- Frequency readout -->
    <text class="freq" x="60" y="22">{Math.round(freq)} Hz</text>
  </svg>

  <div class="bottom-bar">
    <Footswitch {engaged} onToggle={toggleEngaged} label="WAH" />
    <div class="ports-group">
      <PortJack id="audio_in" type="audio" direction="input" label="IN" connected={connectedPorts.has('audio_in')} onConnect={() => handlePortConnect('audio_in')} {moduleId} />
      <PortJack id="position_cv" type="control" direction="input" label="CV" connected={connectedPorts.has('position_cv')} onConnect={() => handlePortConnect('position_cv')} {moduleId} />
      <PortJack id="audio_out" type="audio" direction="output" label="OUT" connected={connectedPorts.has('audio_out')} onConnect={() => handlePortConnect('audio_out')} {moduleId} />
    </div>
  </div>
</ModulePanel>

<style>
  .treadle {
    width: 100%;
    flex: 1;
    min-height: 0;
    cursor: grab;
    display: block;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .treadle:active { cursor: grabbing; }

  .base {
    fill: rgba(26, 18, 16, 0.8);
    stroke: var(--port-stroke, #5a4a3a);
    stroke-width: 1;
  }

  .hinge {
    fill: var(--port-stroke, #5a4a3a);
  }

  .plate {
    fill: var(--panel-bg-solid, #3d2e24);
    stroke: var(--label-color, #a89880);
    stroke-width: 1.2;
  }

  .grip {
    stroke: var(--label-color, #a89880);
    stroke-width: 1;
    opacity: 0.35;
  }

  .toe-label {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 6px;
    fill: var(--label-color, #a89880);
    opacity: 0.55;
    text-anchor: middle;
  }

  .freq {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 10px;
    font-weight: 700;
    fill: var(--knob-indicator, #7fba5c);
    text-anchor: middle;
    letter-spacing: 0.04em;
  }

  .bottom-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    flex-shrink: 0;
    padding: 0 2px;
  }

  .ports-group {
    display: flex;
    gap: 5px;
  }
</style>
