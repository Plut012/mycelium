<script lang="ts">
  import { Knob, ModulePanel, PortJack, SignalDisplay } from '$lib/ui';
  import type { EnvelopeEngine } from './engine.js';

  type Props = {
    engine: EnvelopeEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  let attack  = $state(0.01);
  let decay   = $state(0.2);
  let sustain = $state(0.7);
  let release = $state(0.3);

  function setAttack(v: number)  { attack  = v; engine.setParameter('attack',  v); }
  function setDecay(v: number)   { decay   = v; engine.setParameter('decay',   v); }
  function setSustain(v: number) { sustain = v; engine.setParameter('sustain', v); }
  function setRelease(v: number) { release = v; engine.setParameter('release', v); }

  function handlePortConnect(portId: string) {
    onPortConnect?.(portId);
  }
</script>

<ModulePanel title="Envelope" gridWidth={3} gridHeight={5}>
  <div class="knobs-grid">
    <Knob
      value={attack}
      min={0.001}
      max={2}
      label="ATK"
      unit="s"
      onChange={setAttack}
    />
    <Knob
      value={decay}
      min={0.001}
      max={2}
      label="DEC"
      unit="s"
      onChange={setDecay}
    />
    <Knob
      value={sustain}
      min={0}
      max={1}
      label="SUS"
      onChange={setSustain}
    />
    <Knob
      value={release}
      min={0.001}
      max={3}
      label="REL"
      unit="s"
      onChange={setRelease}
    />
  </div>

  <SignalDisplay analyserNode={engine.getAnalyserNode()} width={156} height={36} />

  <div class="ports">
    <PortJack
      id="gate_in"
      label="GATE"
      direction="input"
      type="control"
      connected={connectedPorts.has('gate_in')}
      onConnect={handlePortConnect}
      {moduleId}
    />
    <PortJack
      id="cv_out"
      label="CV"
      direction="output"
      type="control"
      connected={connectedPorts.has('cv_out')}
      onConnect={handlePortConnect}
      {moduleId}
    />
  </div>
</ModulePanel>

<style>
  .knobs-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 8px;
    width: 100%;
    padding: 0 4px;
    justify-items: center;
  }

  .ports {
    display: flex;
    flex-direction: column;
    gap: 5px;
    width: 100%;
    padding: 0 4px;
  }
</style>
