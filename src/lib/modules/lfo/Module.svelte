<script lang="ts">
  import { Knob, ModulePanel, PortJack, SignalDisplay } from '$lib/ui';
  import type { LFOEngine } from './engine.js';

  type Props = {
    engine: LFOEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  let rate = $state(1);
  let depth = $state(0.5);
  let waveform = $state('sine');

  const waveforms = ['sine', 'square', 'sawtooth', 'triangle'];
  const waveformLabels: Record<string, string> = {
    sine: 'SIN', square: 'SQR', sawtooth: 'SAW', triangle: 'TRI'
  };

  function setRate(v: number) {
    rate = v;
    engine.setParameter('rate', v);
  }

  function setDepth(v: number) {
    depth = v;
    engine.setParameter('depth', v);
  }

  function setWaveform(w: string) {
    waveform = w;
    engine.setParameter('waveform', w);
  }

  function handlePortConnect(portId: string) {
    onPortConnect?.(portId);
  }
</script>

<ModulePanel title="LFO" gridWidth={3} gridHeight={4}>
  <!-- Waveform selector -->
  <div class="wave-row">
    {#each waveforms as w}
      <button
        class="wave-btn"
        class:active={waveform === w}
        onclick={() => setWaveform(w)}
        title={w}
      >
        {waveformLabels[w]}
      </button>
    {/each}
  </div>

  <div class="knobs-row">
    <Knob value={rate} min={0.01} max={20} label="RATE" unit="Hz" onChange={setRate} />
    <Knob value={depth} min={0} max={1} label="DEPTH" onChange={setDepth} />
  </div>

  <SignalDisplay analyserNode={engine.getAnalyserNode()} />

  <div class="ports-row">
    <PortJack
      id="cv_out"
      type="control"
      direction="output"
      label="CV"
      connected={connectedPorts.has('cv_out')}
      onConnect={() => handlePortConnect('cv_out')}
      moduleId={moduleId}
    />
  </div>
</ModulePanel>

<style>
  .wave-row {
    display: flex;
    gap: 3px;
    justify-content: center;
  }

  .wave-btn {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 9px;
    color: var(--label-color, #a89880);
    background: rgba(26, 18, 16, 0.6);
    border: 1px solid var(--port-stroke, #5a4a3a);
    border-radius: var(--control-radius, 2px);
    padding: 2px 5px;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    transition: border-color 0.1s, color 0.1s;
  }

  .wave-btn.active {
    border-color: var(--knob-indicator, #7fba5c);
    color: var(--knob-indicator, #7fba5c);
    background: rgba(127, 186, 92, 0.1);
  }

  .knobs-row {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .ports-row {
    display: flex;
    justify-content: flex-end;
    width: 100%;
    padding: 0 4px;
    margin-top: auto;
  }
</style>
