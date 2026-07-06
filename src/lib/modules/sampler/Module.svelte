<script lang="ts">
  import { Knob, ModulePanel, PortJack, SignalDisplay } from '$lib/ui';
  import type { SamplerEngine, TonePreset, ToneSource } from './engine.js';
  import { instrumentPacks } from '$lib/instruments/index.js';

  type Props = {
    engine: SamplerEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  let tone = $state<ToneSource>('warm-pad');
  let attack = $state(0.02);
  let release = $state(0.8);
  let brightness = $state(0.3);
  let volume = $state(0.6);
  let loading = $state(false);
  let loadProgress = $state(0);
  let loadError = $state<string | null>(null);
  let loadedInstruments = $state<Set<string>>(new Set());

  const synthPresets: { value: TonePreset; label: string }[] = [
    { value: 'warm-pad', label: 'PAD' },
    { value: 'nylon',    label: 'NYL' },
    { value: 'bell',     label: 'BEL' },
    { value: 'soft-keys', label: 'KEY' },
  ];

  function setTone(t: ToneSource) {
    tone = t;
    engine.setParameter('tone', t);
  }

  function setAttack(v: number) { attack = v; engine.setParameter('attack', v); }
  function setRelease(v: number) { release = v; engine.setParameter('release', v); }
  function setBrightness(v: number) { brightness = v; engine.setParameter('brightness', v); }
  function setVolume(v: number) { volume = v; engine.setParameter('volume', v); }

  function handlePortConnect(portId: string) { onPortConnect?.(portId); }

  const instruments = Object.values(instrumentPacks).map(p => ({
    id: p.id,
    label: p.name.split(' ').pop()?.toUpperCase().slice(0, 5) ?? p.id.toUpperCase().slice(0, 5),
    name: p.name,
  }));

  // Poll loading state
  let pollFrame = 0;
  function pollLoading() {
    tone = engine.getCurrentTone();
    loading = engine.isInstrumentLoading();
    loadProgress = engine.getLoadProgress();
    const ids = engine.getLoadedInstrumentIds();
    if (ids.length > 0) {
      loadedInstruments = new Set(ids);
    }
    pollFrame = requestAnimationFrame(pollLoading);
  }

  $effect(() => {
    pollFrame = requestAnimationFrame(pollLoading);
    return () => cancelAnimationFrame(pollFrame);
  });

  async function loadInstrument(id: string) {
    if (loading) return;
    const pack = instrumentPacks[id];
    if (!pack) return;

    loadError = null;

    if (loadedInstruments.has(id)) {
      // Already loaded — just switch to it
      tone = id;
      engine.setParameter('tone', id);
      return;
    }

    loading = true;
    try {
      await engine.loadInstrument(pack);
      loadedInstruments = new Set([...loadedInstruments, id]);
      tone = id;
    } catch (e) {
      console.warn(`Failed to load ${id}:`, e);
      loadError = `Failed to load ${pack.name.split(' ').pop()}`;
      setTimeout(() => { loadError = null; }, 3000);
    }
    loading = false;
  }
</script>

<ModulePanel title="Sampler" gridWidth={4} gridHeight={5}>
  <!-- Synth presets -->
  <div class="tone-row">
    {#each synthPresets as preset}
      <button
        class="tone-btn"
        class:active={tone === preset.value}
        onclick={() => setTone(preset.value)}
        title={preset.value}
      >
        {preset.label}
      </button>
    {/each}
  </div>

  <!-- Instrument samples -->
  {#if loading}
    <div class="instrument-row">
      <div class="load-bar">
        <div class="load-fill" style:width="{loadProgress * 100}%"></div>
        <span class="load-label">Loading {Math.round(loadProgress * 100)}%</span>
      </div>
    </div>
  {:else if loadError}
    <div class="instrument-row">
      <span class="load-error">{loadError}</span>
    </div>
  {:else}
    <div class="tone-row">
      {#each instruments as inst}
        <button
          class="tone-btn instrument"
          class:active={tone === inst.id}
          class:loaded={loadedInstruments.has(inst.id)}
          onclick={() => loadInstrument(inst.id)}
          title={loadedInstruments.has(inst.id) ? `${inst.name} (loaded)` : `Load ${inst.name}`}
        >
          {inst.label}
        </button>
      {/each}
    </div>
  {/if}

  <!-- Knobs -->
  <div class="knobs-row">
    <Knob value={attack} min={0.001} max={1} label="ATK" unit="s" onChange={setAttack} />
    <Knob value={release} min={0.01} max={3} label="REL" unit="s" onChange={setRelease} />
  </div>

  <div class="knobs-row">
    <Knob value={brightness} min={0} max={1} label="BRT" onChange={setBrightness} />
    <Knob value={volume} min={0} max={1} label="VOL" onChange={setVolume} />
  </div>

  <SignalDisplay analyserNode={engine.getAnalyserNode()} />

  <div class="ports-row">
    <PortJack
      id="note_data"
      type="spore"
      direction="input"
      label="NOTES"
      connected={connectedPorts.has('note_data')}
      onConnect={() => handlePortConnect('note_data')}
      moduleId={moduleId}
    />
    <PortJack
      id="audio_out"
      type="audio"
      direction="output"
      label="OUT"
      connected={connectedPorts.has('audio_out')}
      onConnect={() => handlePortConnect('audio_out')}
      moduleId={moduleId}
    />
  </div>
</ModulePanel>

<style>
  .tone-row {
    display: flex;
    gap: 3px;
    justify-content: center;
  }

  .tone-btn {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 9px;
    color: var(--label-color, #a89880);
    background: rgba(26, 18, 16, 0.6);
    border: 1px solid var(--port-stroke, #5a4a3a);
    border-radius: var(--control-radius, 2px);
    padding: 2px 5px;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    transition: border-color 0.1s, color 0.1s, background 0.1s;
  }

  .tone-btn.active {
    border-color: var(--spore-glow, #b490ff);
    color: var(--spore-glow, #b490ff);
    background: rgba(180, 144, 255, 0.1);
  }

  .tone-btn:hover:not(.active) {
    border-color: var(--label-color, #a89880);
  }

  .instrument-row {
    display: flex;
    justify-content: center;
    width: 100%;
    padding: 0 4px;
  }

  .tone-btn.loaded {
    border-style: solid;
    opacity: 0.8;
  }

  .tone-btn.loaded:not(.active) {
    border-color: var(--port-stroke, #5a4a3a);
  }

  .load-error {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 8px;
    color: #ff6b6b;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    text-align: center;
  }

  .load-bar {
    width: 100%;
    height: 20px;
    background: rgba(26, 18, 16, 0.8);
    border: 1px solid var(--port-stroke, #5a4a3a);
    border-radius: var(--control-radius, 2px);
    position: relative;
    overflow: hidden;
  }

  .load-fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: rgba(127, 186, 92, 0.3);
    transition: width 0.15s;
  }

  .load-label {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 8px;
    color: var(--knob-indicator, #7fba5c);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .knobs-row {
    display: flex;
    gap: 8px;
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
