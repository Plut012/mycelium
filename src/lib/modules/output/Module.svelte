<script lang="ts">
  import { Knob, ModulePanel, PortJack, SignalDisplay } from '$lib/ui';
  import type { OutputEngine } from './engine.js';

  type Props = {
    engine: OutputEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  let volume = $state(0.3);

  function setVolume(v: number) {
    volume = v;
    engine.setParameter('volume', v);
  }

  function handlePortConnect(portId: string) {
    onPortConnect?.(portId);
  }
</script>

<ModulePanel title="Output" gridWidth={2} gridHeight={4}>
  <Knob
    value={volume}
    min={0}
    max={1}
    label="VOLUME"
    onChange={setVolume}
  />

  <!-- Shows what is going to speakers -->
  <SignalDisplay analyserNode={engine.getAnalyserNode()} />

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
