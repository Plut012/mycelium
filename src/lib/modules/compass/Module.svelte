<script lang="ts">
  import { Knob, ModulePanel, PortJack } from '$lib/ui';
  import type { CompassEngine } from './engine.js';
  import { CIRCLE_OF_FIFTHS, MODE_NAMES, type RootName, type ModeName } from './theory.js';

  type Props = {
    engine: CompassEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  let root = $state<RootName>('C');
  let mode = $state<ModeName>('Ionian');
  let octave = $state(4);

  function setRoot(r: RootName) {
    root = r;
    engine.setParameter('root', r);
  }

  function setMode(m: ModeName) {
    mode = m;
    engine.setParameter('mode', m);
  }

  function setOctave(v: number) {
    octave = Math.round(v);
    engine.setParameter('octave', octave);
  }

  // ── Compass face geometry ─────────────────────────────────────────────────

  const CX = 60, CY = 60;
  const LABEL_R = 50;
  const NEEDLE_R = 36;

  function angleOf(index: number): number {
    // C at north, clockwise in fifths
    return (index * 30 - 90) * (Math.PI / 180);
  }

  const positions = CIRCLE_OF_FIFTHS.map((name, i) => ({
    name,
    x: CX + LABEL_R * Math.cos(angleOf(i)),
    y: CY + LABEL_R * Math.sin(angleOf(i)),
  }));

  let needleAngle = $derived(angleOf(CIRCLE_OF_FIFTHS.indexOf(root)));
  let needleX = $derived(CX + NEEDLE_R * Math.cos(needleAngle));
  let needleY = $derived(CY + NEEDLE_R * Math.sin(needleAngle));

  const MODE_SHORT: Record<ModeName, string> = {
    Ionian: 'ION', Dorian: 'DOR', Phrygian: 'PHR',
    Lydian: 'LYD', Mixolydian: 'MIX', Aeolian: 'AEO',
  };
</script>

<ModulePanel title="Compass" gridWidth={3} gridHeight={5}>
  <!-- Circle of Fifths root dial -->
  <svg class="compass-face" viewBox="0 0 120 120" role="application" aria-label="Circle of fifths root selector">
    <circle cx={CX} cy={CY} r="56" class="face-ring" />
    <circle cx={CX} cy={CY} r="3" class="face-hub" />
    <line x1={CX} y1={CY} x2={needleX} y2={needleY} class="needle" />
    {#each positions as pos}
      <text
        x={pos.x}
        y={pos.y}
        text-anchor="middle"
        dominant-baseline="middle"
        class="root-label"
        class:selected={pos.name === root}
        role="button"
        tabindex="0"
        onpointerdown={(e) => { e.stopPropagation(); setRoot(pos.name); }}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRoot(pos.name); } }}
      >{pos.name}</text>
    {/each}
  </svg>

  <!-- Mode selector -->
  <div class="mode-grid">
    {#each MODE_NAMES as m}
      <button
        class="mode-btn"
        class:active={mode === m}
        onclick={() => setMode(m)}
        title={m}
      >{MODE_SHORT[m]}</button>
    {/each}
  </div>

  <div class="bottom-row">
    <Knob value={octave} min={2} max={6} label="OCT" onChange={setOctave} />
    <div class="ports-group">
      <PortJack
        id="degree_in"
        type="spore"
        direction="input"
        label="DEG"
        connected={connectedPorts.has('degree_in')}
        onConnect={() => onPortConnect?.('degree_in')}
        {moduleId}
      />
      <PortJack
        id="note_out"
        type="spore"
        direction="output"
        label="NOTE"
        connected={connectedPorts.has('note_out')}
        onConnect={() => onPortConnect?.('note_out')}
        {moduleId}
      />
    </div>
  </div>
</ModulePanel>

<style>
  .compass-face {
    width: 100%;
    max-height: 150px;
    flex-shrink: 0;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .face-ring {
    fill: rgba(26, 18, 16, 0.5);
    stroke: var(--port-stroke, #5a4a3a);
    stroke-width: 1;
  }

  .face-hub {
    fill: var(--knob-indicator, #7fba5c);
  }

  .needle {
    stroke: var(--knob-indicator, #7fba5c);
    stroke-width: 2;
    stroke-linecap: round;
    transition: all 0.15s ease-out;
  }

  .root-label {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 10px;
    font-weight: 600;
    fill: var(--label-color, #a89880);
    cursor: pointer;
  }

  .root-label.selected {
    fill: var(--knob-indicator, #7fba5c);
    font-weight: 700;
  }

  .mode-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 3px;
    width: 100%;
    flex-shrink: 0;
  }

  .mode-btn {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 9px;
    color: var(--label-color, #a89880);
    background: rgba(26, 18, 16, 0.6);
    border: 1px solid var(--port-stroke, #5a4a3a);
    border-radius: var(--control-radius, 2px);
    padding: 3px 0;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    transition: border-color 0.1s, color 0.1s;
  }

  .mode-btn.active {
    border-color: var(--knob-indicator, #7fba5c);
    color: var(--knob-indicator, #7fba5c);
    background: rgba(127, 186, 92, 0.1);
  }

  .bottom-row {
    display: flex;
    align-items: flex-end;
    width: 100%;
    margin-top: auto;
  }

  .ports-group {
    display: flex;
    gap: 6px;
    margin-left: auto;
  }
</style>
