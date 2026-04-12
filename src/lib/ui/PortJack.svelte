<script lang="ts">
  import type { PortType, PortDirection } from '../engine/Port.js';

  type Props = {
    id: string;
    type: PortType;
    direction: PortDirection;
    label: string;
    connected: boolean;
    onConnect: (id: string) => void;
    moduleId?: string;
  };

  let { id, type, direction, label, connected, onConnect, moduleId }: Props = $props();

  let hovered = $state(false);

  const isControl = $derived(type === 'control');
  const isSpore = $derived(type === 'spore');
  const isOutput = $derived(direction === 'output');

  function onclick() {
    onConnect(id);
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onConnect(id);
    }
  }
</script>

<!--
  Layout: input ports place the label to the right; output ports to the left.
  This matches the typical synth panel convention where outputs are on the right
  edge and inputs on the left edge of a module, labels reading inward.
-->
<div class="port-row" class:output={isOutput}>
  <button
    class="port-jack"
    class:connected
    class:control={isControl}
    class:spore={isSpore}
    class:hovered
    aria-label="{direction} {type} port: {label}"
    aria-pressed={connected}
    data-port-jack
    data-port-id={id}
    data-module-id={moduleId}
    onclick={onclick}
    onkeydown={onkeydown}
    onmouseenter={() => { hovered = true; }}
    onmouseleave={() => { hovered = false; }}
  >
    <!-- Outer decorative ring visible on audio ports -->
    {#if !isControl && !isSpore}
      <div class="ring"></div>
    {/if}
    <!-- Dark socket hole -->
    <div class="port-hole">
      {#if connected}
        <div class="plug"></div>
      {/if}
    </div>
  </button>
  <span class="port-label">{label}</span>
</div>

<style>
  .port-row {
    display: flex;
    align-items: center;
    gap: 6px;
    user-select: none;
  }

  /* Output rows: reverse so label sits on the left, jack on the right */
  .port-row.output {
    flex-direction: row-reverse;
  }

  .port-jack {
    flex-shrink: 0;
    position: relative;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--port-fill, #1a1210);
    border: 2px solid var(--port-stroke, #5a4a3a);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    outline: none;
    transition: border-color 0.12s, box-shadow 0.12s;
  }

  /* Control ports are square to distinguish from audio */
  .port-jack.control {
    border-radius: 4px;
    width: 20px;
    height: 20px;
  }

  /* Spore ports are diamond-shaped — data/information */
  .port-jack.spore {
    width: 22px;
    height: 22px;
    border-radius: 3px;
    transform: rotate(45deg);
    border-color: var(--spore-stroke, #8a6abf);
  }

  .port-jack.spore .port-hole {
    transform: rotate(-45deg);
  }

  .port-jack.spore.hovered,
  .port-jack.spore:hover {
    border-color: var(--spore-glow, #b490ff);
    box-shadow: 0 0 6px var(--spore-glow, #b490ff);
  }

  .port-jack.spore.connected {
    border-color: var(--spore-glow, #b490ff);
    box-shadow: 0 0 8px var(--spore-glow, #b490ff);
  }

  .port-jack.spore .plug {
    background: var(--spore-glow, #b490ff);
    box-shadow: 0 0 3px var(--spore-glow, #b490ff);
  }

  .port-jack:focus-visible {
    box-shadow: 0 0 0 2px var(--port-glow, #7fba5c);
  }

  .port-jack.hovered,
  .port-jack:hover {
    border-color: var(--port-glow, #7fba5c);
    box-shadow: 0 0 6px var(--port-glow, #7fba5c);
  }

  .port-jack.connected {
    border-color: var(--port-glow, #7fba5c);
    box-shadow: 0 0 8px var(--port-glow, #7fba5c);
  }

  /* Decorative bevelled ring inside audio jacks */
  .ring {
    position: absolute;
    inset: 3px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.07);
    pointer-events: none;
  }

  /* The dark socket hole */
  .port-hole {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #0a0806;
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .port-jack.control .port-hole {
    border-radius: 2px;
    width: 7px;
    height: 7px;
  }

  /* Small plug nub shown when a cable is connected */
  .plug {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--port-glow, #7fba5c);
    box-shadow: 0 0 3px var(--port-glow, #7fba5c);
  }

  .port-jack.control .plug {
    border-radius: 1px;
    width: 3px;
    height: 3px;
  }

  .port-label {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: var(--label-size, 11px);
    color: var(--label-color, #a89880);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    line-height: 1;
    white-space: nowrap;
  }
</style>
