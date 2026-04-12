<script lang="ts">
  import { Knob, ModulePanel, PortJack } from '$lib/ui';
  import type { AudioInputEngine } from './engine.js';

  type Props = {
    engine: AudioInputEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  let gain = $state(1);

  function setGain(v: number) {
    gain = v;
    engine.setParameter('gain', v);
  }

  function handlePortConnect(portId: string) {
    onPortConnect?.(portId);
  }
</script>

<ModulePanel title="Audio In" gridWidth={2} gridHeight={4}>
  <div class="status-row">
    <span class="status-label">MIC</span>
    <div class="status-led"></div>
  </div>

  <Knob
    value={gain}
    min={0}
    max={4}
    label="GAIN"
    onChange={setGain}
  />

  <div class="ports">
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
  .status-row {
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: center;
  }

  .status-label {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: var(--label-size, 11px);
    color: var(--label-color, #a89880);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .status-led {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--port-glow, #7fba5c);
    box-shadow: 0 0 5px var(--port-glow, #7fba5c);
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  .ports {
    display: flex;
    flex-direction: column;
    gap: 5px;
    width: 100%;
    padding: 0 4px;
    margin-top: auto;
  }
</style>
