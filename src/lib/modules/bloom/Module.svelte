<script lang="ts">
  import { Knob, ModulePanel, PortJack } from '$lib/ui';
  import type { BloomEngine } from './engine.js';
  import { bloomZone, bloomRate } from './engine.js';

  type Props = {
    engine: BloomEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  let time = $state(0);
  let emittedNames = $state('');

  function setTime(v: number) {
    time = v;
    engine.setParameter('time', v);
  }

  let zone = $derived(bloomZone(time));
  let rate = $derived(bloomRate(time));
  let zoneLabel = $derived(
    zone === 'drone' ? 'DRONE' : zone === 'arp' ? `ARP ${rate.toFixed(1)}Hz` : `WASH ${rate.toFixed(0)}Hz`
  );

  $effect(() => {
    const unsub = engine.onSpore('note_out', (data) => {
      const names = (data as { noteNames?: string[] }).noteNames;
      emittedNames = names && names.length > 0 ? names.join(' ') : '';
    });
    return unsub;
  });
</script>

<ModulePanel title="Bloom" gridWidth={3} gridHeight={4}>
  <div class="time-knob">
    <Knob value={time} min={0} max={1} label="TIME" onChange={setTime} />
  </div>

  <div class="zone-display">
    <span class="zone-label" class:moving={zone !== 'drone'}>{zoneLabel}</span>
    <span class="emitted">{emittedNames || ' '}</span>
  </div>

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
      id="note_out"
      type="spore"
      direction="output"
      label="NOTE"
      connected={connectedPorts.has('note_out')}
      onConnect={() => onPortConnect?.('note_out')}
      {moduleId}
    />
  </div>
</ModulePanel>

<style>
  .time-knob {
    display: flex;
    justify-content: center;
    /* The Time knob is one of the Tin's two big performance knobs */
    --knob-size: 64px;
  }

  .zone-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .zone-label {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--label-color, #a89880);
  }

  .zone-label.moving {
    color: var(--knob-indicator, #7fba5c);
  }

  .emitted {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 9px;
    color: var(--knob-indicator, #7fba5c);
    opacity: 0.75;
    min-height: 11px;
  }

  .ports-row {
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding: 0 4px;
    margin-top: auto;
  }
</style>
