<script lang="ts">
  import { Footswitch, Knob, ModulePanel, PortJack } from '$lib/ui';
  import type { ToTDriveEngine, DriveMode, GainLevel } from './engine.js';

  type Props = {
    engine: ToTDriveEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
    /** Panel title override — the Bluesbreaker module reuses this component */
    title?: string;
    footswitchLabel?: string;
  };

  let {
    engine,
    connectedPorts = new Set(),
    onPortConnect,
    moduleId,
    title = 'King of Tone',
    footswitchLabel = 'KING',
  }: Props = $props();

  let volume = $state(0.6);
  let gain = $state(0.4);
  let tone = $state(0.5);
  let presence = $state(0.3);
  let mode = $state<DriveMode>('od');
  let gainLevel = $state<GainLevel>('low');
  let engaged = $state(true);

  function setVolume(v: number) { volume = v; engine.setParameter('volume', v); }
  function setGain(v: number) { gain = v; engine.setParameter('gain', v); }
  function setTone(v: number) { tone = v; engine.setParameter('tone', v); }
  function setPresence(v: number) { presence = v; engine.setParameter('presence', v); }

  function setMode(m: DriveMode) {
    mode = m;
    engine.setParameter('mode', m);
  }

  function toggleGainLevel() {
    gainLevel = gainLevel === 'low' ? 'high' : 'low';
    engine.setParameter('gainLevel', gainLevel);
  }

  function toggleEngaged() {
    engaged = !engaged;
    engine.setParameter('engaged', engaged ? 1 : 0);
  }

  function handlePortConnect(portId: string) {
    onPortConnect?.(portId);
  }

  const modes: { value: DriveMode; label: string }[] = [
    { value: 'boost', label: 'BOOST' },
    { value: 'od',    label: 'OD' },
    { value: 'dist',  label: 'DIST' },
  ];
</script>

<ModulePanel {title} gridWidth={4} gridHeight={5}>
  <div class="knobs-row">
    <Knob value={volume} min={0} max={1} label="VOL" onChange={setVolume} />
    <Knob value={gain} min={0} max={1} label="GAIN" onChange={setGain} />
  </div>
  <div class="knobs-row">
    <Knob value={tone} min={0} max={1} label="TONE" onChange={setTone} />
    <Knob value={presence} min={0} max={1} label="PRES" onChange={setPresence} />
  </div>

  <div class="switch-row">
    {#each modes as m}
      <button class="mode-btn" class:active={mode === m.value} onclick={() => setMode(m.value)}>
        {m.label}
      </button>
    {/each}
    <button class="mode-btn range" class:active={gainLevel === 'high'} onclick={toggleGainLevel} title="Gain range">
      {gainLevel === 'high' ? 'HI' : 'LO'}
    </button>
  </div>

  <div class="bottom-bar">
    <Footswitch {engaged} onToggle={toggleEngaged} label={footswitchLabel} />
    <div class="ports-group">
      <PortJack id="audio_in" type="audio" direction="input" label="IN" connected={connectedPorts.has('audio_in')} onConnect={() => handlePortConnect('audio_in')} {moduleId} />
      <PortJack id="gain_cv" type="control" direction="input" label="G.CV" connected={connectedPorts.has('gain_cv')} onConnect={() => handlePortConnect('gain_cv')} {moduleId} />
      <PortJack id="volume_cv" type="control" direction="input" label="V.CV" connected={connectedPorts.has('volume_cv')} onConnect={() => handlePortConnect('volume_cv')} {moduleId} />
      <PortJack id="audio_out" type="audio" direction="output" label="OUT" connected={connectedPorts.has('audio_out')} onConnect={() => handlePortConnect('audio_out')} {moduleId} />
    </div>
  </div>
</ModulePanel>

<style>
  .knobs-row {
    display: flex;
    gap: 12px;
    justify-content: center;
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
  .mode-btn.range.active {
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
