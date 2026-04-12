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

  // Rotation range: 270 degrees, from -135deg (7 o'clock) to +135deg (5 o'clock)
  const ROTATION_RANGE = 270;
  const ROTATION_MIN = -135;

  let knobEl: HTMLDivElement | undefined = $state();
  let isDragging = $state(false);
  let dragStartValue = $state(0);
  let dragAccum = $state(0);

  // Touch slider overlay state
  let isTouchDevice = $state(false);
  let showSlider = $state(false);
  let sliderTrackEl: HTMLDivElement | undefined = $state();
  let isSliderDragging = $state(false);

  $effect(() => {
    isTouchDevice = 'ontouchstart' in window;
  });

  const normalised = $derived((value - min) / (max - min));
  const rotation = $derived(ROTATION_MIN + normalised * ROTATION_RANGE);

  const displayValue = $derived(
    Number.isInteger(value) ? String(value) : value.toFixed(2)
  );

  // Thumb top percentage: 0% = top (max), 100% = bottom (min)
  const sliderThumbTop = $derived((1 - normalised) * 100);

  function clamp(v: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, v));
  }

  // ── Desktop pointer-lock drag ──────────────────────────────────────────────

  function onpointerdown(e: PointerEvent) {
    if (isTouchDevice) return;
    e.preventDefault();
    isDragging = true;
    dragStartValue = value;
    dragAccum = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    (e.currentTarget as HTMLElement).requestPointerLock?.();
  }

  function onpointermove(e: PointerEvent) {
    if (!isDragging) return;
    // movementY: drag up = negative = increase value
    // sensitivity: full range across ~200px vertical drag
    const sensitivity = (max - min) / 200;
    dragAccum -= e.movementY * sensitivity;
    const newValue = clamp(dragStartValue + dragAccum, min, max);
    onChange(newValue);
  }

  function onpointerup(e: PointerEvent) {
    if (!isDragging) return;
    isDragging = false;
    document.exitPointerLock?.();
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }

  function ondblclick() {
    // Reset to midpoint on double-click
    onChange((min + max) / 2);
  }

  // ── Touch: open/close slider overlay ──────────────────────────────────────

  function onknobtouch(e: TouchEvent) {
    e.preventDefault();
    showSlider = !showSlider;
    isSliderDragging = false;
  }

  function dismissSlider() {
    showSlider = false;
    isSliderDragging = false;
  }

  // ── Touch slider track interaction ────────────────────────────────────────

  function valueFromClientY(clientY: number): number {
    if (!sliderTrackEl) return value;
    const rect = sliderTrackEl.getBoundingClientRect();
    const relY = clientY - rect.top;
    const ratio = 1 - clamp(relY / rect.height, 0, 1);
    return clamp(min + ratio * (max - min), min, max);
  }

  function onslidertracktouch(e: TouchEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.touches.length === 0) return;
    isSliderDragging = true;
    onChange(valueFromClientY(e.touches[0].clientY));
  }

  function onslidertracktouchmove(e: TouchEvent) {
    if (!isSliderDragging) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.touches.length === 0) return;
    onChange(valueFromClientY(e.touches[0].clientY));
  }

  function onslidertracktouchend(e: TouchEvent) {
    isSliderDragging = false;
  }
</script>

<div class="knob-wrapper">
  <div
    class="knob"
    class:dragging={isDragging}
    bind:this={knobEl}
    role="slider"
    aria-label={label}
    aria-valuemin={min}
    aria-valuemax={max}
    aria-valuenow={value}
    tabindex="0"
    onpointerdown={onpointerdown}
    onpointermove={onpointermove}
    onpointerup={onpointerup}
    ondblclick={ondblclick}
    ontouchstart={onknobtouch}
  >
    <div
      class="indicator"
      style:transform="rotate({rotation}deg)"
    >
      <div class="dot"></div>
    </div>
    <div class="track-ring"></div>
  </div>
  <div class="knob-value">{displayValue}{unit}</div>
  <div class="knob-label">{label}</div>
</div>

{#if showSlider}
  <!-- Full-screen backdrop catches taps to dismiss -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="slider-backdrop"
    onclick={dismissSlider}
    ontouchstart={dismissSlider}
  ></div>

  <!-- Right-edge slider panel -->
  <div class="slider-panel" onclick={(e) => e.stopPropagation()}>
    <!-- Label + value info -->
    <div class="slider-info">
      <div class="slider-info-label">{label}</div>
      <div class="slider-info-value">{displayValue}{unit}</div>
    </div>

    <!-- Vertical track -->
    <div
      class="slider-track"
      bind:this={sliderTrackEl}
      ontouchstart={onslidertracktouch}
      ontouchmove={onslidertracktouchmove}
      ontouchend={onslidertracktouchend}
    >
      <!-- Fill bar -->
      <div class="slider-fill" style:height="{normalised * 100}%"></div>
      <!-- Thumb -->
      <div class="slider-thumb" style:top="{sliderThumbTop}%"></div>
    </div>

    <!-- Dismiss button -->
    <button class="slider-close" onclick={dismissSlider} aria-label="Close">✕</button>
  </div>
{/if}

<style>
  .knob-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    user-select: none;
  }

  .knob {
    width: var(--knob-size, 48px);
    height: var(--knob-size, 48px);
    border-radius: 50%;
    background: var(--knob-body, radial-gradient(circle, #4a3828, #2a1f1a));
    position: relative;
    cursor: grab;
    box-shadow:
      0 2px 6px rgba(0, 0, 0, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
    touch-action: none;
    outline: none;
  }

  .knob:focus-visible {
    box-shadow:
      0 2px 6px rgba(0, 0, 0, 0.5),
      0 0 0 2px var(--knob-indicator, #7fba5c);
  }

  .knob.dragging {
    cursor: none;
  }

  .track-ring {
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    border: 2px solid var(--knob-track, #5a4a3a);
    pointer-events: none;
  }

  /* The indicator arm rotates around the knob centre */
  .indicator {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    /* transform-origin is centre by default */
  }

  /* The dot sits at the top of the indicator, offset toward the edge */
  .dot {
    position: absolute;
    top: 15%;
    left: 50%;
    transform: translateX(-50%);
    width: 3px;
    height: 30%;
    border-radius: 2px;
    background: var(--knob-indicator, #7fba5c);
    box-shadow: 0 0 4px var(--knob-indicator, #7fba5c);
  }

  .knob-value {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: var(--label-size, 11px);
    color: var(--knob-indicator, #7fba5c);
    min-width: 40px;
    text-align: center;
    line-height: 1;
  }

  .knob-label {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: var(--label-size, 11px);
    color: var(--label-color, #a89880);
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    line-height: 1;
  }

  /* ── Touch slider overlay ───────────────────────────────────────────────── */

  .slider-backdrop {
    position: fixed;
    inset: 0;
    z-index: 999;
    background: rgba(0, 0, 0, 0.35);
    /* Prevents scroll-through on iOS */
    touch-action: none;
  }

  .slider-panel {
    position: fixed;
    top: 0;
    right: 0;
    height: 100vh;
    width: 60px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px 0;
    box-sizing: border-box;
    background: var(--rack-bg, rgba(20, 14, 10, 0.96));
    border-left: 1px solid var(--knob-track, #5a4a3a);
    gap: 8px;
  }

  .slider-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    width: 100%;
    padding: 0 4px;
    box-sizing: border-box;
  }

  .slider-info-label {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 9px;
    color: var(--label-color, #a89880);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    text-align: center;
    word-break: break-all;
    line-height: 1.2;
  }

  .slider-info-value {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 10px;
    color: var(--knob-indicator, #7fba5c);
    text-align: center;
    line-height: 1;
  }

  .slider-track {
    flex: 1;
    width: 16px;
    position: relative;
    background: var(--knob-body, #2a1f1a);
    border: 1px solid var(--knob-track, #5a4a3a);
    border-radius: 8px;
    touch-action: none;
    overflow: visible;
  }

  .slider-fill {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    border-radius: 0 0 7px 7px;
    background: var(--knob-track, #5a4a3a);
    pointer-events: none;
  }

  .slider-thumb {
    position: absolute;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 28px;
    height: 10px;
    border-radius: 4px;
    background: var(--knob-indicator, #7fba5c);
    box-shadow: 0 0 6px var(--knob-indicator, #7fba5c);
    pointer-events: none;
  }

  .slider-close {
    background: none;
    border: 1px solid var(--knob-track, #5a4a3a);
    border-radius: 50%;
    color: var(--label-color, #a89880);
    font-size: 12px;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    line-height: 1;
    flex-shrink: 0;
  }

  .slider-close:active {
    background: var(--knob-track, #5a4a3a);
    color: var(--knob-indicator, #7fba5c);
  }
</style>
