<script lang="ts">
  import { Footswitch, Knob, ModulePanel, PortJack } from '$lib/ui';
  import type { SqueezerEngine } from './engine.js';

  type Props = {
    engine: SqueezerEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  let sustain = $state(0.5);
  let level = $state(0.7);
  let engaged = $state(true);

  function setSustain(v: number) { sustain = v; engine.setParameter('sustain', v); }
  function setLevel(v: number) { level = v; engine.setParameter('level', v); }

  function toggleEngaged() {
    engaged = !engaged;
    engine.setParameter('engaged', engaged ? 1 : 0);
  }

  function handlePortConnect(portId: string) {
    onPortConnect?.(portId);
  }

  // Gain-reduction meter — poll the compressor
  let reduction = $state(0);
  let animFrame = 0;

  function poll() {
    reduction = engine.getReduction(); // dB, negative while squishing
    animFrame = requestAnimationFrame(poll);
  }

  $effect(() => {
    animFrame = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animFrame);
  });

  // Meter shows 0 → -24 dB of reduction
  let meterPct = $derived(Math.min(1, Math.max(0, -reduction / 24)) * 100);
</script>

<ModulePanel title="Squeezer" gridWidth={3} gridHeight={4}>
  <div class="knobs-row">
    <Knob value={sustain} min={0} max={1} label="SUST" onChange={setSustain} />
    <Knob value={level} min={0} max={1} label="LEVEL" onChange={setLevel} />
  </div>

  <!-- Gain-reduction meter: fills right-to-left as the compressor squishes -->
  <div class="gr-meter" title="Gain reduction">
    <span class="gr-label">GR</span>
    <div class="gr-track">
      <div class="gr-fill" style:width="{meterPct}%"></div>
    </div>
    <span class="gr-db">{reduction < -0.5 ? reduction.toFixed(0) : '0'}</span>
  </div>

  <div class="bottom-bar">
    <Footswitch {engaged} onToggle={toggleEngaged} label="COMP" />
    <div class="ports-group">
      <PortJack id="audio_in" type="audio" direction="input" label="IN" connected={connectedPorts.has('audio_in')} onConnect={() => handlePortConnect('audio_in')} {moduleId} />
      <PortJack id="sustain_cv" type="control" direction="input" label="S.CV" connected={connectedPorts.has('sustain_cv')} onConnect={() => handlePortConnect('sustain_cv')} {moduleId} />
      <PortJack id="level_cv" type="control" direction="input" label="L.CV" connected={connectedPorts.has('level_cv')} onConnect={() => handlePortConnect('level_cv')} {moduleId} />
      <PortJack id="audio_out" type="audio" direction="output" label="OUT" connected={connectedPorts.has('audio_out')} onConnect={() => handlePortConnect('audio_out')} {moduleId} />
    </div>
  </div>
</ModulePanel>

<style>
  .knobs-row {
    display: flex;
    gap: 10px;
    justify-content: center;
    margin-top: 4px;
  }

  .gr-meter {
    display: flex;
    align-items: center;
    gap: 5px;
    width: 100%;
    padding: 0 4px;
  }

  .gr-label, .gr-db {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 7px;
    color: var(--label-color, #a89880);
    opacity: 0.7;
    min-width: 14px;
  }
  .gr-db { text-align: right; }

  .gr-track {
    flex: 1;
    height: 7px;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid var(--panel-border-color, #3a2e24);
    border-radius: var(--control-radius, 2px);
    overflow: hidden;
    direction: rtl; /* reduction grows leftward, VU-style */
  }

  .gr-fill {
    height: 100%;
    background: var(--knob-indicator, #7fba5c);
    opacity: 0.85;
    transition: width 0.05s linear;
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
