<script lang="ts">
  import { Knob, ModulePanel, PortJack } from '$lib/ui';
  import { euclideanPattern, type EuclidEngine } from './engine.js';

  type Props = {
    engine: EuclidEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  let tempo = $state(120);
  let steps = $state(8);
  let fills = $state(3);
  let rotate = $state(0);
  let running = $state(true);

  function setTempo(v: number) { tempo = Math.round(v); engine.setParameter('tempo', tempo); }
  function setSteps(v: number) { steps = Math.round(v); engine.setParameter('steps', steps); }
  function setFills(v: number) { fills = Math.round(v); engine.setParameter('fills', fills); }
  function setRotate(v: number) { rotate = Math.round(v); engine.setParameter('rotate', rotate); }

  function toggleRunning() {
    running = !running;
    engine.setParameter('running', running ? 1 : 0);
  }

  function handlePortConnect(portId: string) {
    onPortConnect?.(portId);
  }

  // ── Ring geometry ─────────────────────────────────────────────────────────

  const CX = 100, CY = 100, R = 74;

  function stepAngle(i: number, total: number): number {
    return (i / total) * Math.PI * 2 - Math.PI / 2; // step 0 at 12 o'clock
  }

  function dotX(i: number, total: number): number {
    return CX + R * Math.cos(stepAngle(i, total));
  }

  function dotY(i: number, total: number): number {
    return CY + R * Math.sin(stepAngle(i, total));
  }

  let pattern = $derived(euclideanPattern(steps, fills, rotate));

  // The hits, joined in order, form a near-regular polygon — the signature
  // geometry of Euclidean rhythms
  let polygonPoints = $derived(
    pattern
      .map((hit, i) => (hit ? `${dotX(i, steps).toFixed(1)},${dotY(i, steps).toFixed(1)}` : null))
      .filter((p): p is string => p !== null)
      .join(' ')
  );

  // ── Playhead + hit flashes ────────────────────────────────────────────────

  let playhead = $state(0);          // [0, 1) around the ring
  let flashes = $state<number[]>([]); // per-step flash intensity, decaying

  let prevPlayhead = 0;
  let animFrame = 0;

  function crossed(target: number, from: number, to: number): boolean {
    if (from === to) return false;
    return from < to
      ? target > from && target <= to
      : target > from || target <= to; // wrapped past 12 o'clock
  }

  function poll() {
    playhead = engine.getPlayhead();

    const decayed = (flashes.length === steps ? flashes : new Array(steps).fill(0))
      .map((f) => f * 0.88);

    if (running) {
      for (let i = 0; i < steps; i++) {
        if (pattern[i] && crossed(i / steps, prevPlayhead, playhead)) {
          decayed[i] = 1;
        }
      }
    }

    flashes = decayed;
    prevPlayhead = playhead;
    animFrame = requestAnimationFrame(poll);
  }

  $effect(() => {
    animFrame = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animFrame);
  });

  let playheadX = $derived(CX + R * Math.cos(playhead * Math.PI * 2 - Math.PI / 2));
  let playheadY = $derived(CY + R * Math.sin(playhead * Math.PI * 2 - Math.PI / 2));
</script>

<ModulePanel title="Euclid" gridWidth={4} gridHeight={5}>
  <svg class="ring" viewBox="0 0 200 200" role="img" aria-label="Euclidean rhythm ring">
    <!-- Step circle guide -->
    <circle class="guide" cx={CX} cy={CY} r={R} />

    <!-- Hit polygon -->
    {#if fills >= 2}
      <polygon class="hit-polygon" points={polygonPoints} />
    {/if}

    <!-- Playhead: beam from center + comet on the ring -->
    {#if running}
      <line class="playhead-beam" x1={CX} y1={CY} x2={playheadX} y2={playheadY} />
    {/if}
    <circle class="playhead-dot" class:paused={!running} cx={playheadX} cy={playheadY} r="3.5" />

    <!-- Step dots -->
    {#each pattern as hit, i (i)}
      {@const flash = flashes[i] ?? 0}
      {@const x = dotX(i, steps)}
      {@const y = dotY(i, steps)}
      {#if hit && flash > 0.02}
        <circle class="flash-halo" cx={x} cy={y} r={8 + flash * 10} style:opacity={flash * 0.55} />
      {/if}
      <circle
        class="step-dot"
        class:hit
        cx={x} cy={y}
        r={hit ? 6.5 + flash * 2.5 : 2.5}
      />
    {/each}

    <!-- Center readout -->
    <text class="notation" x={CX} y={CY - 4}>E({Math.min(fills, steps)},{steps})</text>
    <text class="bpm" x={CX} y={CY + 14}>{tempo} BPM</text>
  </svg>

  <div class="knobs-row">
    <Knob value={tempo} min={40} max={240} label="TEMPO" onChange={setTempo} />
    <Knob value={steps} min={1} max={16} label="STEPS" onChange={setSteps} />
    <Knob value={fills} min={0} max={16} label="FILLS" onChange={setFills} />
    <Knob value={rotate} min={0} max={15} label="ROT" onChange={setRotate} />
  </div>

  <div class="bottom-row">
    <button class="run-btn" class:running onclick={toggleRunning}>
      {running ? 'RUN' : 'STOP'}
    </button>
    <PortJack
      id="gate_out"
      type="control"
      direction="output"
      label="GATE"
      connected={connectedPorts.has('gate_out')}
      onConnect={() => handlePortConnect('gate_out')}
      {moduleId}
    />
  </div>
</ModulePanel>

<style>
  .ring {
    width: 100%;
    flex: 1;
    min-height: 0;
    display: block;
    user-select: none;
  }

  .guide {
    fill: none;
    stroke: var(--port-stroke, #5a4a3a);
    stroke-width: 1;
    stroke-dasharray: 2 4;
    opacity: 0.5;
  }

  .hit-polygon {
    fill: var(--knob-indicator, #7fba5c);
    fill-opacity: 0.07;
    stroke: var(--knob-indicator, #7fba5c);
    stroke-width: 1;
    stroke-linejoin: round;
    opacity: 0.65;
  }

  .playhead-beam {
    stroke: var(--knob-indicator, #7fba5c);
    stroke-width: 1;
    opacity: 0.3;
  }

  .playhead-dot {
    fill: var(--knob-indicator, #7fba5c);
    opacity: 0.9;
  }
  .playhead-dot.paused {
    opacity: 0.3;
  }

  .step-dot {
    fill: var(--port-stroke, #5a4a3a);
    transition: r 0.06s;
  }
  .step-dot.hit {
    fill: var(--knob-indicator, #7fba5c);
  }

  .flash-halo {
    fill: none;
    stroke: var(--knob-indicator, #7fba5c);
    stroke-width: 2;
  }

  .notation {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 16px;
    font-weight: 700;
    fill: var(--module-title-color, #c8b89a);
    text-anchor: middle;
    letter-spacing: 0.04em;
  }

  .bpm {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 8px;
    fill: var(--label-color, #a89880);
    text-anchor: middle;
    opacity: 0.7;
    letter-spacing: 0.08em;
  }

  .knobs-row {
    display: flex;
    gap: 6px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .bottom-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0 4px;
    margin-top: auto;
  }

  .run-btn {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 9px;
    color: var(--label-color, #a89880);
    background: rgba(26, 18, 16, 0.6);
    border: 1px solid var(--port-stroke, #5a4a3a);
    border-radius: var(--control-radius, 2px);
    padding: 3px 10px;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    transition: border-color 0.12s, color 0.12s;
  }
  .run-btn.running {
    color: var(--knob-indicator, #7fba5c);
    border-color: var(--knob-indicator, #7fba5c);
    background: rgba(127, 186, 92, 0.08);
  }
  .run-btn:hover {
    border-color: var(--label-color, #a89880);
  }
</style>
