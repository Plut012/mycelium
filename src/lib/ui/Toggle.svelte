<script lang="ts">
  type Props = {
    value: boolean;
    label: string;
    onChange: (value: boolean) => void;
  };

  let { value, label, onChange }: Props = $props();

  function onclick() {
    onChange(!value);
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(!value);
    }
  }
</script>

<div class="toggle-wrapper">
  <div class="toggle-label">{label}</div>
  <button
    class="toggle"
    class:active={value}
    role="switch"
    aria-checked={value}
    aria-label={label}
    onclick={onclick}
    onkeydown={onkeydown}
  >
    <div class="led" class:lit={value}></div>
    <div class="track">
      <div class="thumb"></div>
    </div>
  </button>
</div>

<style>
  .toggle-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    user-select: none;
  }

  .toggle-label {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: var(--label-size, 11px);
    color: var(--label-color, #a89880);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    line-height: 1;
  }

  .toggle {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    outline: none;
  }

  .toggle:focus-visible .track {
    box-shadow: 0 0 0 2px var(--port-glow, #7fba5c);
  }

  /* LED indicator dot above the track */
  .led {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--knob-track, #4a3828);
    border: 1px solid var(--port-stroke, #5a4a3a);
    transition: background 0.1s, box-shadow 0.1s;
  }

  .led.lit {
    background: var(--port-glow, #7fba5c);
    box-shadow: 0 0 6px var(--port-glow, #7fba5c), 0 0 12px var(--port-glow, #7fba5c);
  }

  /* Toggle track */
  .track {
    width: 32px;
    height: 16px;
    border-radius: 8px;
    background: var(--knob-body, #2a1f1a);
    border: 1px solid var(--knob-track, #5a4a3a);
    position: relative;
    transition: border-color 0.15s;
  }

  .active .track {
    border-color: var(--port-glow, #7fba5c);
  }

  /* Sliding thumb */
  .thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--label-color, #a89880);
    transition: transform 0.15s, background 0.15s;
  }

  .active .thumb {
    transform: translateX(16px);
    background: var(--port-glow, #7fba5c);
  }
</style>
