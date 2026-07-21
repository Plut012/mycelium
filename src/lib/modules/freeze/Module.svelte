<script lang="ts">
  import { Knob, ModulePanel, PortJack, Toggle } from '$lib/ui';
  import type { FreezeEngine } from './engine.js';

  type Props = {
    engine: FreezeEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  let frozen = $state(false);
  let bedLevel = $state(0.7);

  function setFrozen(v: boolean) {
    frozen = v;
    engine.setParameter('freeze', v ? 1 : 0);
  }

  function setBedLevel(v: number) {
    bedLevel = v;
    engine.setParameter('bed_level', v);
  }
</script>

<ModulePanel title="Freeze" gridWidth={2} gridHeight={4}>
  <div class="freeze-toggle" class:lit={frozen} data-frozen={frozen}>
    <Toggle value={frozen} label="FREEZE" onChange={setFrozen} />
  </div>

  <Knob value={bedLevel} min={0} max={1} label="BED" onChange={setBedLevel} />

  <div class="ports-row">
    <PortJack
      id="audio_in"
      type="audio"
      direction="input"
      label="IN"
      connected={connectedPorts.has('audio_in')}
      onConnect={() => onPortConnect?.('audio_in')}
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
  .freeze-toggle {
    padding: 4px 6px;
    border-radius: var(--control-radius, 4px);
    transition: box-shadow 0.2s, background 0.2s;
  }

  /* The captured bed glows while it sustains */
  .freeze-toggle.lit {
    background: color-mix(in srgb, var(--knob-indicator, #7fba5c) 8%, transparent);
    box-shadow: 0 0 10px color-mix(in srgb, var(--knob-indicator, #7fba5c) 25%, transparent);
  }

  .ports-row {
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding: 0 4px;
    margin-top: auto;
  }
</style>
