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

  const ROTATION_RANGE = 270;
  const ROTATION_MIN = -135;

  let knobEl: HTMLDivElement | undefined = $state();
  let isDragging = $state(false);
  let dragStartValue = $state(0);
  let dragAccum = $state(0);

  // Touch slider overlay
  let showSlider = $state(false);
  let sliderTrackEl: HTMLDivElement | undefined = $state();
  let isSliderDragging = $state(false);

  // Track whether last interaction was touch (to avoid pointer event conflicts)
  let lastWasTouch = false;

  const normalised = $derived((value - min) / (max - min));
  const rotation = $derived(ROTATION_MIN + normalised * ROTATION_RANGE);
  const displayValue = $derived(
    Number.isInteger(value) ? String(value) : value.toFixed(2)
  );
  const sliderThumbTop = $derived((1 - normalised) * 100);

  function clamp(v: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, v));
  }

  // ── Desktop pointer-lock drag ──────────────────────────────────────────────

  function onpointerdown(e: PointerEvent) {
    if (lastWasTouch) { lastWasTouch = false; return; }
    e.preventDefault();
    isDragging = true;
    dragStartValue = value;
    dragAccum = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    (e.currentTarget as HTMLElement).requestPointerLock?.();
  }

  function onpointermove(e: PointerEvent) {
    if (!isDragging) return;
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
    onChange((min + max) / 2);
  }

  // ── Touch: open/close slider overlay ──────────────────────────────────────

  function onknobtouch(e: TouchEvent) {
    e.preventDefault();
    e.stopPropagation();
    lastWasTouch = true;
    showSlider = !showSlider;
    isSliderDragging = false;
  }

  function dismissSlider(e?: Event) {
    e?.preventDefault();
    e?.stopPropagation();
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

  function onslidertouch(e: TouchEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.touches.length === 0) return;
    isSliderDragging = true;
    onChange(valueFromClientY(e.touches[0].clientY));
  }

  function onslidermove(e: TouchEvent) {
    if (!isSliderDragging) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.touches.length === 0) return;
    onChange(valueFromClientY(e.touches[0].clientY));
  }

  function onsliderend() {
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
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="slider-backdrop"
    ontouchstart={dismissSlider}
    onclick={dismissSlider}
    style="touch-action: none;"
  ></div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="slider-panel" style="touch-action: none;">
    <div class="slider-info">
      <div class="slider-info-label">{label}</div>
      <div class="slider-info-value">{displayValue}{unit}</div>
    </div>

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="slider-track"
      bind:this={sliderTrackEl}
      ontouchstart={onslidertouch}
      ontouchmove={onslidermove}
      ontouchend={onsliderend}
      style="touch-action: none;"
    >
      <div class="slider-fill" style:height="{normalised * 100}%"></div>
      <div class="slider-thumb" style:top="{sliderThumbTop}%"></div>
    </div>

    <button class="slider-close" onclick={dismissSlider}>DONE</button>
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

  .knob.dragging { cursor: none; }

  .track-ring {
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    border: 2px solid var(--knob-track, #5a4a3a);
    pointer-events: none;
  }

  .indicator {
    position: absolute;
    inset: 0;
    border-radius: 50%;
  }

  .dot {
    position: absolute;
    top: 15%;
    left: 50%;
    transform: translateX(-50%);
    width: 3px;
    height: 30%;
    border-radius: var(--control-radius, 2px);
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

  /* ── Slider overlay ──────────────────────────────────────────────────────── */

  .slider-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 999;
  }

  .slider-panel {
    position: fixed;
    right: 0;
    top: 0;
    height: 100vh;
    width: 70px;
    background: rgba(10, 13, 10, 0.95);
    border-left: 1px solid var(--port-stroke, #5a4a3a);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px 8px;
    gap: 12px;
  }

  .slider-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .slider-info-label {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 10px;
    color: var(--label-color, #a89880);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .slider-info-value {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 12px;
    color: var(--knob-indicator, #7fba5c);
    font-weight: 600;
  }

  .slider-track {
    flex: 1;
    width: 32px;
    background: var(--knob-track, #5a4a3a);
    border-radius: var(--control-radius, 4px);
    position: relative;
    overflow: hidden;
  }

  .slider-fill {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--knob-indicator, #7fba5c);
    opacity: 0.3;
    border-radius: var(--control-radius, 4px);
  }

  .slider-thumb {
    position: absolute;
    left: 0;
    right: 0;
    height: 4px;
    background: var(--knob-indicator, #7fba5c);
    border-radius: var(--control-radius, 2px);
    box-shadow: 0 0 6px var(--knob-indicator, #7fba5c);
    transform: translateY(-50%);
  }

  .slider-close {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 9px;
    color: var(--label-color, #a89880);
    background: rgba(26, 18, 16, 0.8);
    border: 1px solid var(--port-stroke, #5a4a3a);
    border-radius: var(--control-radius, 3px);
    padding: 6px 12px;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    flex-shrink: 0;
  }
</style>
