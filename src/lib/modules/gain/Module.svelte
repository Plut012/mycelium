<script lang="ts">
  import { Knob, ModulePanel, PortJack, SignalDisplay } from '$lib/ui';
  import type { GainEngine } from './engine.js';

  type Props = {
    engine: GainEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  let gain = $state(0.5);

  function setGain(v: number) {
    gain = v;
    engine.setParameter('gain', v);
  }

  function handlePortConnect(portId: string) {
    onPortConnect?.(portId);
  }
</script>

<ModulePanel title="Gain" gridWidth={2} gridHeight={4}>
  <Knob
    value={gain}
    min={0}
    max={2}
    label="GAIN"
    onChange={setGain}
  />

  <SignalDisplay analyserNode={engine.getAnalyserNode()} width={96} height={32} />

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
      id="gain"
      label="GAIN CV"
      direction="input"
      type="control"
      connected={connectedPorts.has('gain')}
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
  .ports {
    display: flex;
    flex-direction: column;
    gap: 5px;
    width: 100%;
    padding: 0 4px;
  }
</style>
