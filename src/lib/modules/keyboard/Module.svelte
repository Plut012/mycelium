<script lang="ts">
  import { Knob, ModulePanel, PortJack } from '$lib/ui';
  import type { KeyboardEngine } from './engine.js';
  import { KEY_MAP } from './music.js';

  type Props = {
    engine: KeyboardEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  let octave = $state(3);
  let velocity = $state(0.8);
  let activeKeys = $state<Set<string>>(new Set());

  // Poll active notes for visual feedback (lightweight — just reading a Set)
  let animFrame = 0;
  function pollKeys() {
    const notes = engine.getActiveNotes();
    const base = engine.getBaseOctave();
    // Reverse-map active MIDI notes to keyboard keys
    const keys = new Set<string>();
    for (const [key, semitone] of Object.entries(KEY_MAP)) {
      const midi = (base + 1) * 12 + semitone;
      if (notes.includes(midi)) keys.add(key);
    }
    activeKeys = keys;
    animFrame = requestAnimationFrame(pollKeys);
  }

  $effect(() => {
    animFrame = requestAnimationFrame(pollKeys);
    return () => cancelAnimationFrame(animFrame);
  });

  function setOctave(v: number) {
    octave = Math.round(v);
    engine.setParameter('octave', octave);
  }

  function setVelocity(v: number) {
    velocity = v;
    engine.setParameter('velocity', v);
  }

  function handlePortConnect(portId: string) {
    onPortConnect?.(portId);
  }

  // Visual keyboard layout
  const rows = [
    { keys: ['2','3','','5','6','7','','9','0'], type: 'sharp' as const },
    { keys: ['q','w','e','r','t','y','u','i','o','p'], type: 'natural' as const },
    { keys: ['s','d','','g','h','j','','l'], type: 'sharp' as const },
    { keys: ['z','x','c','v','b','n','m',','], type: 'natural' as const },
  ];
</script>

<ModulePanel title="Keyboard" gridWidth={5} gridHeight={5}>
  <!-- Mini keyboard visualization -->
  <div class="keyboard">
    {#each rows as row}
      <div class="key-row" class:sharp-row={row.type === 'sharp'}>
        {#each row.keys as key}
          {#if key === ''}
            <div class="key-spacer"></div>
          {:else}
            <div
              class="key"
              class:sharp={row.type === 'sharp'}
              class:active={activeKeys.has(key)}
            >
              <span class="key-label">{key.toUpperCase()}</span>
            </div>
          {/if}
        {/each}
      </div>
    {/each}
  </div>

  <!-- Controls -->
  <div class="controls-row">
    <Knob value={octave} min={1} max={7} label="OCT" onChange={setOctave} />
    <Knob value={velocity} min={0} max={1} label="VEL" onChange={setVelocity} />
  </div>

  <!-- Ports -->
  <div class="ports-row">
    <PortJack
      id="cv_out"
      type="control"
      direction="output"
      label="CV"
      connected={connectedPorts.has('cv_out')}
      onConnect={() => handlePortConnect('cv_out')}
      moduleId={moduleId}
    />
    <PortJack
      id="gate_out"
      type="control"
      direction="output"
      label="GATE"
      connected={connectedPorts.has('gate_out')}
      onConnect={() => handlePortConnect('gate_out')}
      moduleId={moduleId}
    />
    <PortJack
      id="note_data"
      type="spore"
      direction="output"
      label="SPORE"
      connected={connectedPorts.has('note_data')}
      onConnect={() => handlePortConnect('note_data')}
      moduleId={moduleId}
    />
  </div>
</ModulePanel>

<style>
  .keyboard {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    padding: 4px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 3px;
  }

  .key-row {
    display: flex;
    gap: 2px;
    justify-content: center;
  }

  .sharp-row {
    padding: 0 6px;
  }

  .key {
    width: 22px;
    height: 18px;
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.06s, border-color 0.06s;
    border: 1px solid var(--port-stroke, #5a4a3a);
    background: rgba(42, 31, 26, 0.6);
    cursor: default;
  }

  .key.sharp {
    background: rgba(20, 15, 12, 0.8);
    height: 16px;
    width: 20px;
  }

  .key.active {
    background: var(--knob-indicator, #7fba5c);
    border-color: var(--knob-indicator, #7fba5c);
    box-shadow: 0 0 6px var(--cable-glow, #7fff7f);
  }

  .key.active .key-label {
    color: #1a1210;
  }

  .key-label {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 7px;
    color: var(--label-color, #a89880);
    user-select: none;
    line-height: 1;
  }

  .key-spacer {
    width: 20px;
  }

  .controls-row {
    display: flex;
    gap: 12px;
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
