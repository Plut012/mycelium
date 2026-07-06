<script lang="ts">
  import { Footswitch, Knob, ModulePanel, PortJack } from '$lib/ui';
  import type { RustBucketEngine } from './engine.js';

  type Props = {
    engine: RustBucketEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  let volume = $state(0.7);
  let boostOn = $state(true);
  let fuzzOn = $state(false);
  let octaveOn = $state(false);

  function setVolume(v: number) { volume = v; engine.setParameter('volume', v); }

  function toggleBoost() { boostOn = !boostOn; engine.setParameter('boost', boostOn ? 1 : 0); }
  function toggleFuzz() { fuzzOn = !fuzzOn; engine.setParameter('fuzz', fuzzOn ? 1 : 0); }
  function toggleOctave() { octaveOn = !octaveOn; engine.setParameter('octave', octaveOn ? 1 : 0); }

  function handlePortConnect(portId: string) {
    onPortConnect?.(portId);
  }
</script>

<ModulePanel title="Rust Bucket" gridWidth={4} gridHeight={4}>
  <div class="top-row">
    <Knob value={volume} min={0} max={1} label="VOL" onChange={setVolume} />
    <span class="flow-hint">BOOST → FUZZ → OCT</span>
  </div>

  <div class="stomps-row">
    <Footswitch engaged={boostOn} onToggle={toggleBoost} label="BOOST" />
    <Footswitch engaged={fuzzOn} onToggle={toggleFuzz} label="FUZZ" />
    <Footswitch engaged={octaveOn} onToggle={toggleOctave} label="OCT" />
  </div>

  <div class="ports-row">
    <PortJack id="audio_in" type="audio" direction="input" label="IN" connected={connectedPorts.has('audio_in')} onConnect={() => handlePortConnect('audio_in')} {moduleId} />
    <PortJack id="audio_out" type="audio" direction="output" label="OUT" connected={connectedPorts.has('audio_out')} onConnect={() => handlePortConnect('audio_out')} {moduleId} />
  </div>
</ModulePanel>

<style>
  .top-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin-top: 2px;
  }

  .flow-hint {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 7px;
    color: var(--label-color, #a89880);
    opacity: 0.5;
    letter-spacing: 0.05em;
  }

  .stomps-row {
    display: flex;
    gap: 18px;
    justify-content: center;
    margin-top: 4px;
  }

  .ports-row {
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding: 0 4px;
    margin-top: auto;
    flex-shrink: 0;
  }
</style>
