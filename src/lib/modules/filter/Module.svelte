<script lang="ts">
  import { Knob, ModulePanel, PortJack } from '$lib/ui';
  import type { FilterEngine } from './engine.js';

  type Props = {
    engine: FilterEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  let frequency = $state(1000);
  let Q = $state(1);
  let filterType = $state('lowpass');

  const filterTypes = ['lowpass', 'highpass', 'bandpass', 'notch'];

  function setFrequency(v: number) {
    frequency = v;
    engine.setParameter('frequency', v);
  }

  function setQ(v: number) {
    Q = v;
    engine.setParameter('Q', v);
  }

  function setType(t: string) {
    filterType = t;
    engine.setParameter('type', t);
  }

  function handlePortConnect(portId: string) {
    onPortConnect?.(portId);
  }
</script>

<ModulePanel title="Filter" gridWidth={3} gridHeight={5}>
  <!-- Type selector -->
  <div class="type-row">
    {#each filterTypes as t}
      <button
        class="type-btn"
        class:active={filterType === t}
        onclick={() => setType(t)}
        title={t}
      >
        {t.slice(0, 2).toUpperCase()}
      </button>
    {/each}
  </div>

  <!-- Knobs -->
  <div class="knobs-row">
    <Knob
      value={frequency}
      min={20}
      max={20000}
      label="CUTOFF"
      unit="Hz"
      onChange={setFrequency}
    />
    <Knob
      value={Q}
      min={0.0001}
      max={30}
      label="RES"
      onChange={setQ}
    />
  </div>

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
      id="cutoff_cv"
      label="CV"
      direction="input"
      type="control"
      connected={connectedPorts.has('cutoff_cv')}
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
  .type-row {
    display: flex;
    gap: 3px;
    justify-content: center;
  }

  .type-btn {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 9px;
    color: var(--label-color, #a89880);
    background: var(--port-fill, #1a1210);
    border: 1px solid var(--port-stroke, #5a4a3a);
    border-radius: var(--control-radius, 3px);
    padding: 3px 5px;
    cursor: pointer;
    letter-spacing: 0.05em;
    transition: border-color 0.12s, color 0.12s, box-shadow 0.12s;
  }

  .type-btn:hover {
    border-color: var(--port-glow, #7fba5c);
    color: var(--port-glow, #7fba5c);
  }

  .type-btn.active {
    border-color: var(--knob-indicator, #7fba5c);
    color: var(--knob-indicator, #7fba5c);
    box-shadow: 0 0 6px var(--knob-indicator, #7fba5c);
    background: rgba(127, 186, 92, 0.08);
  }

  .knobs-row {
    display: flex;
    gap: 12px;
    justify-content: center;
  }

  .ports {
    display: flex;
    flex-direction: column;
    gap: 5px;
    width: 100%;
    padding: 0 4px;
  }
</style>
