<script lang="ts">
  import { Knob, ModulePanel, PortJack, SignalDisplay } from '$lib/ui';
  import type { XFactorEngine } from './engine.js';

  type Props = {
    engine: XFactorEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  let x = $state(0.3);
  let driftValue = $state(0);

  function setX(v: number) {
    x = v;
    engine.setParameter('x', v);
  }

  // Wandering needle: follow the engine's drift walk target
  $effect(() => {
    const timer = setInterval(() => {
      driftValue = engine.getDriftTarget();
    }, 150);
    return () => clearInterval(timer);
  });
</script>

<ModulePanel title="X-Factor" gridWidth={3} gridHeight={4}>
  <div class="x-knob">
    <Knob value={x} min={0} max={1} label="X" onChange={setX} />
  </div>

  <!-- Drift needle — the wandering control voltage, made visible -->
  <div class="drift-meter" data-drift={driftValue.toFixed(3)}>
    <div class="drift-scale">
      <div class="drift-needle" style:left="{50 + driftValue * 48}%"></div>
    </div>
    <span class="drift-label">DRIFT</span>
  </div>

  <SignalDisplay analyserNode={engine.getAnalyserNode()} />

  <div class="ports-row">
    <PortJack
      id="audio_in"
      type="audio"
      direction="input"
      label="IN"
      connected={connectedPorts.has('audio_in')}
      onConnect={() => onPortConnect?.('audio_in')}
      {moduleId}
    />
    <PortJack
      id="drift_out"
      type="control"
      direction="output"
      label="DRIFT"
      connected={connectedPorts.has('drift_out')}
      onConnect={() => onPortConnect?.('drift_out')}
      {moduleId}
    />
    <PortJack
      id="audio_out"
      type="audio"
      direction="output"
      label="OUT"
      connected={connectedPorts.has('audio_out')}
      onConnect={() => onPortConnect?.('audio_out')}
      {moduleId}
    />
  </div>
</ModulePanel>

<style>
  .x-knob {
    display: flex;
    justify-content: center;
    /* X-Factor is the Tin's other big performance knob, a peer of Time */
    --knob-size: 64px;
  }

  .drift-meter {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    width: 100%;
  }

  .drift-scale {
    position: relative;
    width: 70%;
    height: 6px;
    background: rgba(26, 18, 16, 0.7);
    border: 1px solid var(--port-stroke, #5a4a3a);
    border-radius: 3px;
  }

  .drift-needle {
    position: absolute;
    top: -2px;
    width: 2px;
    height: 8px;
    background: var(--knob-indicator, #7fba5c);
    box-shadow: 0 0 4px var(--knob-indicator, #7fba5c);
    transition: left 0.15s linear;
  }

  .drift-label {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 7px;
    letter-spacing: 0.1em;
    color: var(--label-color, #a89880);
    opacity: 0.6;
  }

  .ports-row {
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding: 0 4px;
    margin-top: auto;
  }
</style>
