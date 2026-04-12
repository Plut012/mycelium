<script lang="ts">
  import { Knob, ModulePanel, PortJack, SignalDisplay } from '$lib/ui';
  import type { OscillatorEngine } from './engine.js';

  type Props = {
    engine: OscillatorEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  let frequency = $state(440);
  let detune = $state(0);
  let waveform = $state('sine');

  const waveforms = ['sine', 'square', 'sawtooth', 'triangle'];
  const waveformLabels: Record<string, string> = {
    sine: 'SIN', square: 'SQR', sawtooth: 'SAW', triangle: 'TRI'
  };

  function setFrequency(v: number) {
    frequency = v;
    engine.setParameter('frequency', v);
  }

  function setDetune(v: number) {
    detune = v;
    engine.setParameter('detune', v);
  }

  function setWaveform(w: string) {
    waveform = w;
    engine.setParameter('waveform', w);
  }

  function handlePortConnect(portId: string) {
    onPortConnect?.(portId);
  }
</script>

<ModulePanel title="Oscillator" gridWidth={3} gridHeight={5}>
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
    <Knob value={frequency} min={20} max={20000} label="FREQ" unit="Hz" onChange={setFrequency} />
    <Knob value={detune} min={-100} max={100} label="DETUNE" unit="ct" onChange={setDetune} />
  </div>

  <SignalDisplay analyserNode={engine.getAnalyserNode()} />

  <div class="ports-row">
    <PortJack
      id="frequency"
      type="control"
      direction="input"
      label="CV"
      connected={connectedPorts.has('frequency')}
      onConnect={() => handlePortConnect('frequency')}
      moduleId={moduleId}
    />
    <PortJack
      id="audio_out"
      type="audio"
      direction="output"
      label="OUT"
      connected={connectedPorts.has('audio_out')}
      onConnect={() => handlePortConnect('audio_out')}
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
    border-radius: 2px;
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
    justify-content: space-between;
    width: 100%;
    padding: 0 4px;
    margin-top: auto;
  }
</style>
