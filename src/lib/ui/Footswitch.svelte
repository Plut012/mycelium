<script lang="ts">
  type Props = {
    engaged: boolean;
    onToggle: () => void;
    label?: string;
  };

  let { engaged, onToggle, label = 'ON' }: Props = $props();
</script>

<div class="footswitch">
  <span class="led" class:lit={engaged}></span>
  <button
    class="stomp"
    class:engaged
    onclick={onToggle}
    title={engaged ? 'Bypass' : 'Engage'}
    aria-pressed={engaged}
    aria-label="{label} footswitch"
  ></button>
  <span class="fs-label">{label}</span>
</div>

<style>
  .footswitch {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
  }

  .led {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid var(--port-stroke, #5a4a3a);
    transition: background 0.1s, box-shadow 0.1s;
  }
  .led.lit {
    background: var(--knob-indicator, #7fba5c);
    border-color: var(--knob-indicator, #7fba5c);
    box-shadow: 0 0 6px var(--knob-indicator, #7fba5c);
  }

  .stomp {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    cursor: pointer;
    background:
      radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.18), transparent 55%),
      linear-gradient(160deg, #4a4440, #2a2624);
    border: 2px solid var(--port-stroke, #5a4a3a);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.08);
    transition: transform 0.05s, box-shadow 0.05s, border-color 0.1s;
  }
  .stomp:active {
    transform: translateY(1px);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }
  .stomp.engaged {
    border-color: var(--knob-indicator, #7fba5c);
  }

  .fs-label {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 7px;
    color: var(--label-color, #a89880);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    user-select: none;
  }
</style>
