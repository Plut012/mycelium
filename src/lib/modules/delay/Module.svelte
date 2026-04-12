<script lang="ts">
  import { Knob, ModulePanel, PortJack } from '$lib/ui';
  import type { DelayEngine } from './engine.js';

  type Props = {
    engine: DelayEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  let delayTime = $state(0.5);
  let feedback = $state(0.3);
  let mix = $state(0.5);

  function setDelayTime(v: number) {
    delayTime = v;
    engine.setParameter('delayTime', v);
  }

  function setFeedback(v: number) {
    feedback = v;
    engine.setParameter('feedback', v);
  }

  function setMix(v: number) {
    mix = v;
    engine.setParameter('mix', v);
  }

  function handlePortConnect(portId: string) {
    onPortConnect?.(portId);
  }
</script>

<ModulePanel title="Delay" gridWidth={3} gridHeight={5}>
  <div class="knobs-row">
    <Knob
      value={delayTime}
      min={0}
      max={2}
      label="TIME"
      unit="s"
      onChange={setDelayTime}
    />
    <Knob
      value={feedback}
      min={0}
      max={0.95}
      label="FDBK"
      onChange={setFeedback}
    />
    <Knob
      value={mix}
      min={0}
      max={1}
      label="MIX"
      onChange={setMix}
    />
  </div>

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
  .knobs-row {
    display: flex;
    gap: 10px;
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
