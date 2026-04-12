<script lang="ts">
  import { Knob, ModulePanel, PortJack, SignalDisplay } from '$lib/ui';
  import type { ReverbEngine } from './engine.js';

  type RoomSize = 'small' | 'medium' | 'large' | 'hall';

  type Props = {
    engine: ReverbEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  const SIZE_LABELS: { value: RoomSize; label: string }[] = [
    { value: 'small',  label: 'SM'   },
    { value: 'medium', label: 'MD'   },
    { value: 'large',  label: 'LG'   },
    { value: 'hall',   label: 'HALL' },
  ];

  let size    = $state<RoomSize>('medium');
  let decay   = $state(2);
  let mix     = $state(0.35);
  let damping = $state(0.5);

  function setSize(v: RoomSize) {
    size = v;
    engine.setParameter('size', v);
  }

  function setDecay(v: number) {
    decay = v;
    engine.setParameter('decay', v);
  }

  function setMix(v: number) {
    mix = v;
    engine.setParameter('mix', v);
  }

  function setDamping(v: number) {
    damping = v;
    engine.setParameter('damping', v);
  }

  function handlePortConnect(portId: string) {
    onPortConnect?.(portId);
  }
</script>

<ModulePanel title="Reverb" gridWidth={3} gridHeight={4}>
  <!-- Size selector -->
  <div class="size-row">
    {#each SIZE_LABELS as s}
      <button
        class="size-btn"
        class:active={size === s.value}
        onclick={() => setSize(s.value)}
      >
        {s.label}
      </button>
    {/each}
  </div>

  <!-- Knobs -->
  <div class="knobs-row">
    <Knob
      value={decay}
      min={0.1}
      max={6}
      label="DEC"
      unit="s"
      onChange={setDecay}
    />
    <Knob
      value={mix}
      min={0}
      max={1}
      label="MIX"
      onChange={setMix}
    />
    <Knob
      value={damping}
      min={0}
      max={1}
      label="DMP"
      onChange={setDamping}
    />
  </div>

  <!-- Signal display -->
  <SignalDisplay analyserNode={engine.getAnalyserNode()} width={152} height={28} />

  <!-- Ports -->
  <div class="ports">
    <PortJack
      id="audio_in"
      label="IN"
      direction="input"
      type="audio"
      connected={connectedPorts.has('audio_in')}
      onConnect={handlePortConnect}
      {moduleId}
    />
    <PortJack
      id="audio_out"
      label="OUT"
      direction="output"
      type="audio"
      connected={connectedPorts.has('audio_out')}
      onConnect={handlePortConnect}
      {moduleId}
    />
  </div>
</ModulePanel>

<style>
  .size-row {
    display: flex;
    gap: 4px;
    width: 100%;
    justify-content: center;
  }

  .size-btn {
    flex: 1;
    padding: 3px 0;
    background: var(--panel-bg, #2a1f1a);
    border: 1px solid var(--panel-border-color, #3a2e24);
    border-radius: 3px;
    color: var(--label-color, #a89880);
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: background 0.1s, color 0.1s, border-color 0.1s;
    user-select: none;
  }

  .size-btn:hover {
    border-color: var(--port-glow, #7fba5c);
    color: var(--port-glow, #7fba5c);
  }

  .size-btn.active {
    background: rgba(127, 186, 92, 0.15);
    border-color: var(--port-glow, #7fba5c);
    color: var(--port-glow, #7fba5c);
  }

  .knobs-row {
    display: flex;
    gap: 6px;
    justify-content: center;
  }

  .ports {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    padding: 0 4px;
  }
</style>
