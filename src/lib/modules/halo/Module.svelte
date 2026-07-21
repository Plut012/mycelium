<script lang="ts">
  import { Knob, ModulePanel, PortJack, SignalDisplay, Toggle } from '$lib/ui';
  import type { HaloEngine } from './engine.js';

  type Props = {
    engine: HaloEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  let decay = $state(6);
  let mix = $state(0.5);
  let damping = $state(0.4);
  let shimmer = $state(false);
  let shimmerAmount = $state(0.5);

  function setParam(id: string, v: number) {
    engine.setParameter(id, v);
  }
</script>

<ModulePanel title="Halo" gridWidth={3} gridHeight={5}>
  <div class="knobs-row">
    <Knob value={decay} min={1} max={20} label="DECAY" unit="s" onChange={(v) => { decay = v; setParam('decay', v); }} />
    <Knob value={mix} min={0} max={1} label="MIX" onChange={(v) => { mix = v; setParam('mix', v); }} />
    <Knob value={damping} min={0} max={1} label="DAMP" onChange={(v) => { damping = v; setParam('damping', v); }} />
  </div>

  <div class="shimmer-row" class:lit={shimmer}>
    <Toggle value={shimmer} label="SHIMMER" onChange={(v) => { shimmer = v; setParam('shimmer', v ? 1 : 0); }} />
    <Knob value={shimmerAmount} min={0} max={1} label="AMT" onChange={(v) => { shimmerAmount = v; setParam('shimmer_amount', v); }} />
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
  .knobs-row {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .shimmer-row {
    display: flex;
    gap: 14px;
    align-items: center;
    justify-content: center;
    padding: 4px 8px;
    border-radius: var(--control-radius, 4px);
    transition: box-shadow 0.2s, background 0.2s;
  }

  /* Celestial upward transformation, glowing when engaged */
  .shimmer-row.lit {
    background: color-mix(in srgb, var(--knob-indicator, #7fba5c) 7%, transparent);
    box-shadow: 0 0 12px color-mix(in srgb, var(--knob-indicator, #7fba5c) 20%, transparent);
  }

  .ports-row {
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding: 0 4px;
    margin-top: auto;
  }
</style>
