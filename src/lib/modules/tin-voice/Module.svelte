<script lang="ts">
  import { Knob, ModulePanel, PortJack, SignalDisplay, Toggle } from '$lib/ui';
  import type { TinVoiceEngine, TinVoiceName } from './engine.js';

  type Props = {
    engine: TinVoiceEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  let voice = $state<TinVoiceName>('sine-pad');
  let sub = $state(false);
  let level = $state(0.8);

  const voices: TinVoiceName[] = ['sine-pad', 'kalimba', 'flute', 'saw', 'bell'];
  const voiceLabels: Record<TinVoiceName, string> = {
    'sine-pad': 'PAD', kalimba: 'KLM', flute: 'FLT', saw: 'SAW', bell: 'BEL',
  };

  function setVoice(v: TinVoiceName) {
    voice = v;
    engine.setParameter('voice', v);
  }

  function setSub(v: boolean) {
    sub = v;
    engine.setParameter('sub', v ? 1 : 0);
  }

  function setLevel(v: number) {
    level = v;
    engine.setParameter('level', v);
  }
</script>

<ModulePanel title="Tin Voice" gridWidth={4} gridHeight={5}>
  <!-- Voice selector -->
  <div class="voice-row">
    {#each voices as v}
      <button
        class="voice-btn"
        class:active={voice === v}
        onclick={() => setVoice(v)}
        title={v}
      >{voiceLabels[v]}</button>
    {/each}
  </div>

  <div class="controls-row">
    <Toggle value={sub} label="SUB" onChange={setSub} />
    <Knob value={level} min={0} max={1} label="LEVEL" onChange={setLevel} />
  </div>

  <SignalDisplay analyserNode={engine.getAnalyserNode()} />

  <div class="ports-row">
    <PortJack
      id="note_in"
      type="spore"
      direction="input"
      label="NOTE"
      connected={connectedPorts.has('note_in')}
      onConnect={() => onPortConnect?.('note_in')}
      {moduleId}
    />
    <PortJack
      id="drift_in"
      type="control"
      direction="input"
      label="DRIFT"
      connected={connectedPorts.has('drift_in')}
      onConnect={() => onPortConnect?.('drift_in')}
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
  .voice-row {
    display: flex;
    gap: 3px;
    justify-content: center;
  }

  .voice-btn {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 9px;
    color: var(--label-color, #a89880);
    background: rgba(26, 18, 16, 0.6);
    border: 1px solid var(--port-stroke, #5a4a3a);
    border-radius: var(--control-radius, 2px);
    padding: 3px 5px;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    transition: border-color 0.1s, color 0.1s;
  }

  .voice-btn.active {
    border-color: var(--knob-indicator, #7fba5c);
    color: var(--knob-indicator, #7fba5c);
    background: rgba(127, 186, 92, 0.1);
  }

  .controls-row {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: center;
  }

  .ports-row {
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding: 0 4px;
    margin-top: auto;
  }
</style>
