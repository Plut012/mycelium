<script lang="ts">
  import { Footswitch, Knob, ModulePanel, PortJack } from '$lib/ui';
  import type { HammertoneEngine } from './engine.js';

  type Props = {
    engine: HammertoneEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  let time = $state(0.4);
  let damp = $state(0.5);
  let level = $state(0.35);
  let revType = $state<'hall' | 'room' | 'plate'>('hall');
  let toneCut = $state(false);
  let engaged = $state(true);

  function setTime(v: number) { time = v; engine.setParameter('time', v); }
  function setDamp(v: number) { damp = v; engine.setParameter('damp', v); }
  function setLevel(v: number) { level = v; engine.setParameter('level', v); }

  function setType(t: 'hall' | 'room' | 'plate') {
    revType = t;
    engine.setParameter('type', t);
  }

  function toggleTone() {
    toneCut = !toneCut;
    engine.setParameter('tone', toneCut ? 1 : 0);
  }

  function toggleEngaged() {
    engaged = !engaged;
    engine.setParameter('engaged', engaged ? 1 : 0);
  }

  function handlePortConnect(portId: string) {
    onPortConnect?.(portId);
  }

  const types: { value: 'hall' | 'room' | 'plate'; label: string }[] = [
    { value: 'hall',  label: 'HALL' },
    { value: 'room',  label: 'ROOM' },
    { value: 'plate', label: 'PLATE' },
  ];
</script>

<ModulePanel title="Hammertone" gridWidth={4} gridHeight={4}>
  <div class="knobs-row">
    <Knob value={time} min={0} max={1} label="TIME" onChange={setTime} />
    <Knob value={damp} min={0} max={1} label="DAMP" onChange={setDamp} />
    <Knob value={level} min={0} max={1} label="LEVEL" onChange={setLevel} />
  </div>

  <div class="switch-row">
    {#each types as t}
      <button class="mode-btn" class:active={revType === t.value} onclick={() => setType(t.value)}>
        {t.label}
      </button>
    {/each}
    <button class="mode-btn tone" class:active={toneCut} onclick={toggleTone} title="High-frequency dampen — sit-in-mix darkening">
      TONE
    </button>
  </div>

  <div class="bottom-bar">
    <Footswitch {engaged} onToggle={toggleEngaged} label="VERB" />
    <div class="ports-group">
      <PortJack id="audio_in" type="audio" direction="input" label="IN" connected={connectedPorts.has('audio_in')} onConnect={() => handlePortConnect('audio_in')} {moduleId} />
      <PortJack id="level_cv" type="control" direction="input" label="L.CV" connected={connectedPorts.has('level_cv')} onConnect={() => handlePortConnect('level_cv')} {moduleId} />
      <PortJack id="audio_out" type="audio" direction="output" label="OUT" connected={connectedPorts.has('audio_out')} onConnect={() => handlePortConnect('audio_out')} {moduleId} />
    </div>
  </div>
</ModulePanel>

<style>
  .knobs-row {
    display: flex;
    gap: 8px;
    justify-content: center;
    margin-top: 2px;
  }

  .switch-row {
    display: flex;
    gap: 4px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .mode-btn {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 8px;
    color: var(--label-color, #a89880);
    background: rgba(26, 18, 16, 0.6);
    border: 1px solid var(--port-stroke, #5a4a3a);
    border-radius: var(--control-radius, 2px);
    padding: 3px 6px;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    transition: border-color 0.1s, color 0.1s;
  }
  .mode-btn.active {
    color: var(--knob-indicator, #7fba5c);
    border-color: var(--knob-indicator, #7fba5c);
    background: rgba(127, 186, 92, 0.08);
  }
  .mode-btn.tone.active {
    color: var(--spore-glow, #b490ff);
    border-color: var(--spore-glow, #b490ff);
    background: rgba(180, 144, 255, 0.08);
  }
  .mode-btn:hover:not(.active) {
    border-color: var(--label-color, #a89880);
  }

  .bottom-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    flex-shrink: 0;
    padding: 0 2px;
    margin-top: auto;
  }

  .ports-group {
    display: flex;
    gap: 5px;
  }
</style>
