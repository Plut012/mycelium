<script lang="ts">
  import { Footswitch, Knob, ModulePanel, PortJack } from '$lib/ui';
  import { RATIO_LABELS, type Arp87Engine, type DelayProgram } from './engine.js';

  type Props = {
    engine: Arp87Engine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  let level = $state(0.5);
  let dampen = $state(0.5);
  let repeats = $state(0.4);
  let ratioIdx = $state(2);
  let x = $state(0.2);
  let program = $state<DelayProgram>('digital');
  let trails = $state(true);
  let engaged = $state(true);

  function setLevel(v: number) { level = v; engine.setParameter('level', v); }
  function setDampen(v: number) { dampen = v; engine.setParameter('dampen', v); }
  function setRepeats(v: number) { repeats = v; engine.setParameter('repeats', v); }
  function setX(v: number) { x = v; engine.setParameter('x', v); }

  function setRatio(v: number) {
    ratioIdx = Math.round(v);
    engine.setParameter('ratio', ratioIdx);
  }

  function setProgram(p: DelayProgram) {
    program = p;
    engine.setParameter('program', p);
  }

  function toggleTrails() {
    trails = !trails;
    engine.setParameter('trails', trails ? 1 : 0);
  }

  function toggleEngaged() {
    engaged = !engaged;
    engine.setParameter('engaged', engaged ? 1 : 0);
  }

  function handlePortConnect(portId: string) {
    onPortConnect?.(portId);
  }

  // ── TAP button: short press = tap tempo, hold = feedback runaway ─────────

  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let holding = $state(false);

  function tapDown() {
    holdTimer = setTimeout(() => {
      holding = true;
      engine.setOscillate(true);
    }, 400);
  }

  function tapUp() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    if (holding) {
      holding = false;
      engine.setOscillate(false);
    } else {
      engine.tap();
    }
  }

  // Tempo LED blink + delay-time readout
  let delayMs = $state(250);
  let blink = $state(false);
  let animFrame = 0;

  function poll() {
    delayMs = engine.getDelayMs();
    blink = (performance.now() % delayMs) / delayMs < 0.15;
    animFrame = requestAnimationFrame(poll);
  }

  $effect(() => {
    animFrame = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animFrame);
  });

  const programs: { value: DelayProgram; label: string }[] = [
    { value: 'digital', label: 'DIG' },
    { value: 'analog',  label: 'ANA' },
    { value: 'lofi',    label: 'LOFI' },
    { value: 'slap',    label: 'SLAP' },
  ];
</script>

<ModulePanel title="ARP-87" gridWidth={4} gridHeight={5}>
  <div class="knobs-row">
    <Knob value={level} min={0} max={1} label="LEVEL" onChange={setLevel} />
    <Knob value={dampen} min={0} max={1} label="DAMP" onChange={setDampen} />
    <Knob value={repeats} min={0} max={1} label="REP" onChange={setRepeats} />
  </div>
  <div class="knobs-row">
    <Knob value={ratioIdx} min={0} max={4} label="RATIO" onChange={setRatio} />
    <Knob value={x} min={0} max={1} label="X" onChange={setX} />
    <div class="readout">
      <span class="ms">{Math.round(delayMs)}ms</span>
      <span class="div">{program === 'slap' ? 'TIME' : RATIO_LABELS[ratioIdx]}</span>
    </div>
  </div>

  <div class="switch-row">
    {#each programs as p}
      <button class="mode-btn" class:active={program === p.value} onclick={() => setProgram(p.value)}>
        {p.label}
      </button>
    {/each}
    <button class="mode-btn trails" class:active={trails} onclick={toggleTrails} title="Tail rings out on bypass">
      TRLS
    </button>
  </div>

  <div class="bottom-bar">
    <Footswitch {engaged} onToggle={toggleEngaged} label="DELAY" />
    <button
      class="tap-btn"
      class:holding
      onpointerdown={tapDown}
      onpointerup={tapUp}
      onpointerleave={tapUp}
      title="Tap tempo — hold for runaway feedback"
    >
      <span class="tap-led" class:on={blink && engaged}></span>
      TAP
    </button>
    <div class="ports-group">
      <PortJack id="audio_in" type="audio" direction="input" label="IN" connected={connectedPorts.has('audio_in')} onConnect={() => handlePortConnect('audio_in')} {moduleId} />
      <PortJack id="time_cv" type="control" direction="input" label="T.CV" connected={connectedPorts.has('time_cv')} onConnect={() => handlePortConnect('time_cv')} {moduleId} />
      <PortJack id="repeats_cv" type="control" direction="input" label="R.CV" connected={connectedPorts.has('repeats_cv')} onConnect={() => handlePortConnect('repeats_cv')} {moduleId} />
      <PortJack id="x_cv" type="control" direction="input" label="X.CV" connected={connectedPorts.has('x_cv')} onConnect={() => handlePortConnect('x_cv')} {moduleId} />
      <PortJack id="audio_out" type="audio" direction="output" label="OUT" connected={connectedPorts.has('audio_out')} onConnect={() => handlePortConnect('audio_out')} {moduleId} />
    </div>
  </div>
</ModulePanel>

<style>
  .knobs-row {
    display: flex;
    gap: 8px;
    justify-content: center;
    align-items: center;
  }

  .readout {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    min-width: 44px;
  }
  .ms {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 10px;
    font-weight: 700;
    color: var(--knob-indicator, #7fba5c);
  }
  .div {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 7px;
    color: var(--label-color, #a89880);
    opacity: 0.7;
  }

  .switch-row {
    display: flex;
    gap: 3px;
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
    padding: 3px 5px;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    transition: border-color 0.1s, color 0.1s;
  }
  .mode-btn.active {
    color: var(--knob-indicator, #7fba5c);
    border-color: var(--knob-indicator, #7fba5c);
    background: rgba(127, 186, 92, 0.08);
  }
  .mode-btn.trails.active {
    color: var(--spore-glow, #b490ff);
    border-color: var(--spore-glow, #b490ff);
    background: rgba(180, 144, 255, 0.08);
  }
  .mode-btn:hover:not(.active) {
    border-color: var(--label-color, #a89880);
  }

  .tap-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 8px;
    color: var(--label-color, #a89880);
    background: rgba(26, 18, 16, 0.6);
    border: 1px solid var(--port-stroke, #5a4a3a);
    border-radius: var(--control-radius, 2px);
    padding: 4px 7px;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    user-select: none;
    transition: border-color 0.1s, color 0.1s;
  }
  .tap-btn.holding {
    color: #e06050;
    border-color: #e06050;
    background: rgba(224, 96, 80, 0.1);
  }

  .tap-led {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid var(--port-stroke, #5a4a3a);
  }
  .tap-led.on {
    background: var(--knob-indicator, #7fba5c);
    box-shadow: 0 0 4px var(--knob-indicator, #7fba5c);
  }

  .bottom-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    flex-shrink: 0;
    padding: 0 2px;
    margin-top: auto;
    gap: 4px;
  }

  .ports-group {
    display: flex;
    gap: 5px;
  }
</style>
