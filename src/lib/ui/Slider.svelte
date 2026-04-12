<script lang="ts">
  type Props = {
    value: number;
    min: number;
    max: number;
    label: string;
    unit?: string;
    onChange: (value: number) => void;
  };

  let { value, min, max, label, unit = '', onChange }: Props = $props();

  let trackEl: HTMLDivElement | undefined = $state();
  let isDragging = $state(false);

  const TRACK_HEIGHT = 120; // px — matches CSS

  const normalised = $derived((value - min) / (max - min));
  // Thumb position: 0 = bottom, 1 = top. CSS uses top offset, so invert.
  const thumbTop = $derived((1 - normalised) * 100);

  const displayValue = $derived(
    Number.isInteger(value) ? String(value) : value.toFixed(2)
  );

  function clamp(v: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, v));
  }

  function valueFromPointer(e: PointerEvent): number {
    if (!trackEl) return value;
    const rect = trackEl.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const ratio = 1 - clamp(relY / rect.height, 0, 1);
    return min + ratio * (max - min);
  }

  function onpointerdown(e: PointerEvent) {
    e.preventDefault();
    isDragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    onChange(valueFromPointer(e));
  }

  function onpointermove(e: PointerEvent) {
    if (!isDragging) return;
    onChange(valueFromPointer(e));
  }

  function onpointerup(e: PointerEvent) {
    isDragging = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }
</script>

<div class="slider-wrapper">
  <div class="slider-label">{label}</div>
  <div
    class="track"
    bind:this={trackEl}
    role="slider"
    aria-label={label}
    aria-valuemin={min}
    aria-valuemax={max}
    aria-valuenow={value}
    tabindex="0"
    onpointerdown={onpointerdown}
    onpointermove={onpointermove}
    onpointerup={onpointerup}
  >
    <!-- Fill bar from bottom up to thumb -->
    <div class="fill" style:height="{normalised * 100}%"></div>
    <!-- Thumb -->
    <div class="thumb" style:top="{thumbTop}%"></div>
  </div>
  <div class="slider-value">{displayValue}{unit}</div>
</div>

<style>
  .slider-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    user-select: none;
  }

  .slider-label {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: var(--label-size, 11px);
    color: var(--label-color, #a89880);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    line-height: 1;
  }

  .track {
    position: relative;
    width: 12px;
    height: 120px;
    background: var(--knob-body, #2a1f1a);
    border: 1px solid var(--knob-track, #5a4a3a);
    border-radius: 6px;
    cursor: pointer;
    touch-action: none;
    outline: none;
    overflow: visible;
  }

  .track:focus-visible {
    box-shadow: 0 0 0 2px var(--knob-indicator, #7fba5c);
  }

  .fill {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    border-radius: 0 0 5px 5px;
    background: var(--knob-track, #5a4a3a);
    pointer-events: none;
  }

  .thumb {
    position: absolute;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 20px;
    height: 8px;
    border-radius: 3px;
    background: var(--knob-indicator, #7fba5c);
    box-shadow: 0 0 5px var(--knob-indicator, #7fba5c);
    pointer-events: none;
  }

  .slider-value {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: var(--label-size, 11px);
    color: var(--knob-indicator, #7fba5c);
    text-align: center;
    line-height: 1;
  }
</style>
