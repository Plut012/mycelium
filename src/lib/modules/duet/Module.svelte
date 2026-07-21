<script lang="ts">
  import { Knob, ModulePanel, PortJack } from '$lib/ui';
  import { NOTE_NAMES } from '$lib/modules/keyboard/music.js';
  import type { DuetEngine } from './engine.js';

  type Props = {
    engine: DuetEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  let root = $state(2);
  let octave = $state(3);
  let intonation = $state(0.5);
  let vibrato = $state(0);
  let level = $state(0.8);

  function setParam(id: string, v: number) {
    engine.setParameter(id, v);
  }

  // ── Live string state (panel preview + fullscreen readouts) ───────────────

  const STRINGS = [0, 1, 2] as const;

  type StringState = { active: boolean; pos: number; noteName: string; cents: number };
  let states = $state<StringState[]>(
    STRINGS.map(() => ({ active: false, pos: 0, noteName: '', cents: 0 }))
  );
  let openStrings = $state<string[]>(['D3', 'A3', 'E4']);

  let animFrame = 0;
  function poll() {
    states = engine.getStringStates();
    openStrings = engine.getOpenStrings();
    animFrame = requestAnimationFrame(poll);
  }

  $effect(() => {
    animFrame = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animFrame);
  });

  // ── Fullscreen play surface ───────────────────────────────────────────────

  let fullscreen = $state(false);
  let fullscreenEl: HTMLDivElement | undefined = $state();
  let surfaceW = $state(0);
  let surfaceH = $state(0);

  // Finger positions in surface pixels, per string, for rendering
  let fingers = $state<({ x: number; y: number } | null)[]>(STRINGS.map(() => null));

  const pointerString = new Map<number, number>();

  // Bassiest string (index 0) all the way to the right
  const stringX = (i: number) => surfaceW * (0.78 - i * 0.28);
  const BEND_DEAD_PX = 12;

  function surfacePoint(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const rect = fullscreenEl!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function posBend(stringIdx: number, x: number, y: number): { pos: number; bend: number } {
    const pos = Math.min(1, Math.max(0, 1 - y / surfaceH));
    const dx = Math.abs(x - stringX(stringIdx));
    const span = surfaceW * 0.18;
    const bend = Math.min(1, Math.max(0, (dx - BEND_DEAD_PX) / span));
    return { pos, bend };
  }

  function onPointerDown(e: PointerEvent) {
    if (!fullscreenEl) return;
    // Let the EXIT button be a button — preventDefault here would suppress
    // its click event, and the touch would claim a string
    if ((e.target as HTMLElement).closest('.fs-close')) return;
    e.preventDefault();
    fullscreenEl.setPointerCapture(e.pointerId);
    const { x, y } = surfacePoint(e);
    // Claim the nearest free string — capture holds for the whole phrase
    const taken = new Set(pointerString.values());
    const free = STRINGS.filter((i) => !taken.has(i));
    if (free.length === 0) return; // all strings busy
    const idx = free.reduce((best, i) =>
      Math.abs(x - stringX(i)) < Math.abs(x - stringX(best)) ? i : best
    );
    pointerString.set(e.pointerId, idx);
    fingers[idx] = { x, y };
    const { pos, bend } = posBend(idx, x, y);
    engine.stringOn(idx, pos, bend);
  }

  function onPointerMove(e: PointerEvent) {
    const idx = pointerString.get(e.pointerId);
    if (idx === undefined) return;
    e.preventDefault();
    // Coalesced events recover full digitizer-rate samples — this is what
    // lets finger micro-motion (vibrato) survive frame-rate batching
    const samples = e.getCoalescedEvents?.() ?? [e];
    for (const s of samples.length > 0 ? samples : [e]) {
      const { x, y } = surfacePoint(s);
      const { pos, bend } = posBend(idx, x, y);
      engine.stringMove(idx, pos, bend);
    }
    fingers[idx] = surfacePoint(e);
  }

  function onPointerUp(e: PointerEvent) {
    const idx = pointerString.get(e.pointerId);
    if (idx !== undefined) {
      engine.stringOff(idx);
      pointerString.delete(e.pointerId);
      fingers[idx] = null;
    }
    try { fullscreenEl?.releasePointerCapture(e.pointerId); }
    catch { /* already released */ }
  }

  function releaseAllPointers() {
    engine.releaseAll();
    pointerString.clear();
    fingers = STRINGS.map(() => null);
  }

  async function openFullscreen() {
    fullscreen = true;
    await new Promise((r) => requestAnimationFrame(r));
    if (fullscreenEl) {
      try { await fullscreenEl.requestFullscreen(); }
      catch { /* Fullscreen API unsupported — fixed overlay still works */ }
    }
  }

  function closeFullscreen() {
    fullscreen = false;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    releaseAllPointers();
  }

  $effect(() => {
    function onFsChange() {
      if (!document.fullscreenElement && fullscreen) {
        fullscreen = false;
        releaseAllPointers();
      }
    }
    function onBlur() { releaseAllPointers(); }
    document.addEventListener('fullscreenchange', onFsChange);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      window.removeEventListener('blur', onBlur);
    };
  });

  // ── Fingerboard inlays ────────────────────────────────────────────────────
  // Diamonds inlaid in the surface between the strings (strings draw over
  // them). Interval heights are identical on every string, so the marks
  // belong to the fingerboard — like fret inlays. Octave = double diamond
  // (both gaps); fifths = single smaller diamond, alternating gaps so
  // nothing reads as a row.

  const gapX = (g: number) => (stringX(g) + stringX(g + 1)) / 2; // g: 0=right gap, 1=left gap
  const inlayY = (semis: number) => (1 - semis / 24) * surfaceH;

  // [semitones, gap or 'both', half-diagonal px]
  const INLAYS: [number, 0 | 1 | 'both', number][] = [
    [7, 0, 5],
    [12, 'both', 7],
    [19, 1, 5],
  ];

  let inlays = $derived(
    INLAYS.flatMap(([semis, gap, r], row) => {
      const y = inlayY(semis);
      const near = fingers.some((f) => f && Math.abs(f.y - y) < 48);
      const gaps = gap === 'both' ? [0, 1] : [gap];
      return gaps.map((g) => ({ x: gapX(g), y, r, near, row }));
    })
  );

  function diamondPath(x: number, y: number, r: number): string {
    return `M ${x} ${y - r} L ${x + r * 0.7} ${y} L ${x} ${y + r} L ${x - r * 0.7} ${y} Z`;
  }

  /** String path — bows toward the finger while played */
  function stringPath(i: number): string {
    const sx = stringX(i);
    const f = fingers[i];
    if (!f) return `M ${sx} 0 L ${sx} ${surfaceH}`;
    // Visual displacement capped well below the finger's actual drift
    const dx = Math.max(-28, Math.min(28, f.x - sx));
    return `M ${sx} 0 Q ${sx + dx} ${f.y} ${sx} ${surfaceH}`;
  }
</script>

<ModulePanel title="Duet" gridWidth={4} gridHeight={4}>
  <div class="knobs-row">
    <div class="root-group">
      <Knob value={root} min={0} max={11} label="ROOT" onChange={(v) => { root = Math.round(v); setParam('root', root); }} />
      <span class="root-name">{NOTE_NAMES[root]}</span>
    </div>
    <Knob value={octave} min={2} max={5} label="OCT" onChange={(v) => { octave = Math.round(v); setParam('octave', octave); }} />
    <Knob value={intonation} min={0} max={1} label="TUNE" onChange={(v) => { intonation = v; setParam('intonation', v); }} />
  </div>
  <div class="knobs-row">
    <Knob value={vibrato} min={0} max={1} label="VIB" onChange={(v) => { vibrato = v; setParam('vibrato', v); }} />
    <Knob value={level} min={0} max={1} label="LEVEL" onChange={(v) => { level = v; setParam('level', v); }} />
  </div>

  <!-- Mini preview: three strings, bass rightmost, live finger dots -->
  <svg class="preview" viewBox="0 0 80 34">
    {#each STRINGS as i}
      {@const x = 64 - i * 24}
      <line x1={x} y1="2" x2={x} y2="26" class="preview-string" class:sounding={states[i].active} />
      {#if states[i].active}
        <circle cx={x} cy={2 + (1 - states[i].pos) * 24} r="3" class="preview-dot" />
      {/if}
      <text {x} y="33" text-anchor="middle" class="preview-label">{openStrings[i]}</text>
    {/each}
  </svg>

  <div class="bottom-bar">
    <button class="play-btn" onclick={openFullscreen} title="Open fullscreen strings">PLAY</button>
    <div class="ports-group">
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
  </div>
</ModulePanel>

{#if fullscreen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fs-overlay"
    bind:this={fullscreenEl}
    bind:clientWidth={surfaceW}
    bind:clientHeight={surfaceH}
    style="touch-action: none;"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
  >
    <svg class="fs-strings" width={surfaceW} height={surfaceH}>
      <!-- Inlays first: the strings pass over them -->
      {#each inlays as inlay}
        <path
          d={diamondPath(inlay.x, inlay.y, inlay.r)}
          class="fs-inlay"
          class:near={inlay.near}
          style:animation-delay="{inlay.row * -1.7}s"
        />
      {/each}
      {#each STRINGS as i}
        <path d={stringPath(i)} class="fs-string" class:sounding={states[i].active} />
        {#if fingers[i]}
          <circle cx={fingers[i].x} cy={fingers[i].y} r="22" class="fs-finger-halo" />
          <circle cx={fingers[i].x} cy={fingers[i].y} r="7" class="fs-finger" />
          <text
            x={fingers[i].x + (fingers[i].x > surfaceW / 2 ? -44 : 44)}
            y={fingers[i].y + 5}
            text-anchor="middle"
            class="fs-note"
          >{states[i].noteName}{states[i].cents !== 0 ? ` ${states[i].cents > 0 ? '+' : ''}${states[i].cents}` : ''}</text>
        {/if}
        <text x={stringX(i)} y={surfaceH - 14} text-anchor="middle" class="fs-open-label">{openStrings[i]}</text>
      {/each}
    </svg>

    <button class="fs-close" onclick={closeFullscreen} title="Exit fullscreen">EXIT</button>
  </div>
{/if}

<style>
  .knobs-row {
    display: flex;
    gap: 8px;
    justify-content: center;
    align-items: flex-start;
  }

  .root-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
  }

  .root-name {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 9px;
    font-weight: 700;
    color: var(--knob-indicator, #7fba5c);
  }

  .preview {
    width: 80px;
    height: 34px;
    flex-shrink: 0;
  }

  .preview-string {
    stroke: var(--port-stroke, #5a4a3a);
    stroke-width: 1.5;
  }

  .preview-string.sounding {
    stroke: var(--knob-indicator, #7fba5c);
  }

  .preview-dot {
    fill: var(--knob-indicator, #7fba5c);
  }

  .preview-label {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 6px;
    fill: var(--label-color, #a89880);
  }

  .bottom-bar {
    display: flex;
    align-items: center;
    width: 100%;
    margin-top: auto;
  }

  .play-btn {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 9px;
    color: var(--knob-indicator, #7fba5c);
    background: color-mix(in srgb, var(--knob-indicator, #7fba5c) 10%, transparent);
    border: 1px solid var(--knob-indicator, #7fba5c);
    border-radius: var(--control-radius, 2px);
    padding: 3px 10px;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .ports-group {
    margin-left: auto;
  }

  /* ── Fullscreen surface ─────────────────────────────────────────────────── */

  .fs-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: radial-gradient(ellipse at 50% 40%, #16130f 0%, #0b0908 70%);
    overflow: hidden;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .fs-strings {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* Inlaid mother-of-pearl: near-invisible fill, a thin edge catching light,
     breathing slowly. Blooms when a finger's height comes near. */
  .fs-inlay {
    fill: color-mix(in srgb, var(--knob-indicator, #7fba5c) 7%, transparent);
    stroke: color-mix(in srgb, var(--knob-indicator, #7fba5c) 30%, transparent);
    stroke-width: 1;
    animation: inlay-breathe 5.2s ease-in-out infinite alternate;
    transition: fill 0.4s, stroke 0.4s;
  }

  .fs-inlay.near {
    fill: color-mix(in srgb, var(--knob-indicator, #7fba5c) 20%, transparent);
    stroke: color-mix(in srgb, var(--knob-indicator, #7fba5c) 55%, transparent);
  }

  @keyframes inlay-breathe {
    from { opacity: 0.55; }
    to { opacity: 1; }
  }

  .fs-string {
    fill: none;
    stroke: var(--port-stroke, #5a4a3a);
    stroke-width: 2.5;
    transition: stroke 0.15s;
  }

  .fs-string.sounding {
    stroke: var(--knob-indicator, #7fba5c);
    filter: drop-shadow(0 0 6px var(--knob-indicator, #7fba5c));
  }

  .fs-finger {
    fill: var(--knob-indicator, #7fba5c);
  }

  .fs-finger-halo {
    fill: color-mix(in srgb, var(--knob-indicator, #7fba5c) 12%, transparent);
  }

  .fs-note {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 15px;
    font-weight: 700;
    fill: var(--label-color, #a89880);
    pointer-events: none;
  }

  .fs-open-label {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 12px;
    fill: var(--label-color, #a89880);
    opacity: 0.5;
    pointer-events: none;
  }

  .fs-close {
    position: absolute;
    bottom: 12px;
    right: 12px;
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 10px;
    color: var(--label-color, #a89880);
    background: rgba(20, 16, 14, 0.8);
    border: 1px solid var(--port-stroke, #5a4a3a);
    border-radius: var(--control-radius, 4px);
    padding: 8px 16px;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
</style>
