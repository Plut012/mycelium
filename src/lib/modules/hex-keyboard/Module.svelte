<script lang="ts">
  import { Knob, ModulePanel, PortJack } from '$lib/ui';
  import type { HexKeyboardEngine } from './engine.js';

  type Props = {
    engine: HexKeyboardEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  let octave = $state(3);
  let velocity = $state(0.8);
  let fullscreen = $state(false);

  function setOctave(v: number) {
    octave = Math.round(v);
    engine.setParameter('octave', octave);
  }

  function setVelocity(v: number) {
    velocity = v;
    engine.setParameter('velocity', v);
  }

  function handlePortConnect(portId: string) {
    onPortConnect?.(portId);
  }

  // ── Fullscreen mode ───────────────────────────────────────────────────────

  let fullscreenEl: HTMLDivElement | undefined = $state();

  async function openFullscreen() {
    fullscreen = true;
    // Wait for DOM to render, then request browser fullscreen
    await new Promise((r) => requestAnimationFrame(r));
    if (fullscreenEl) {
      try {
        await fullscreenEl.requestFullscreen();
      } catch {
        // Fullscreen API not supported — fixed overlay still works
      }
    }
  }

  function closeFullscreen() {
    fullscreen = false;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    // Release all notes when closing
    for (const [pid, midi] of pointerNotes) {
      engine.noteOff(midi);
    }
    pointerNotes.clear();
  }

  // Listen for browser fullscreen exit (e.g., user presses back button)
  $effect(() => {
    function onFsChange() {
      if (!document.fullscreenElement && fullscreen) {
        fullscreen = false;
        for (const [, midi] of pointerNotes) engine.noteOff(midi);
        pointerNotes.clear();
      }
    }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  });

  // ── Hex grid geometry ─────────────────────────────────────────────────────

  const HEX_SIZE = 24;
  const sqrt3 = Math.sqrt(3);
  const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  const Q_MIN = -5, Q_MAX = 5;   // 11 columns
  const R_MIN = -2, R_MAX = 2;   // 5 rows

  interface HexCell {
    q: number;
    r: number;
    cx: number;
    cy: number;
    midi: number;
    noteName: string;
    noteOctave: number;
    pitchClass: number;
    points: string;
  }

  // Idle: deep muted tones — dark forest floor palette
  const PITCH_COLORS: string[] = [
    '#2e1a1a', // C  — deep ember
    '#2a1e1a', // C# — dark bark
    '#2a251a', // D  — deep moss
    '#222a1a', // D# — shadow fern
    '#1a2a1e', // E  — dark pine
    '#1a2a26', // F  — deep lichen
    '#1a262a', // F# — twilight pool
    '#1a1e2a', // G  — night sky
    '#1e1a2a', // G# — deep violet
    '#261a2a', // A  — dark plum
    '#2a1a24', // A# — shadow rose
    '#2a1a1e', // B  — dark clay
  ];

  // Active: warm bioluminescent glow — gentle, not harsh
  const PITCH_COLORS_ACTIVE: string[] = [
    '#8a4a3a', // C  — warm amber
    '#7a5438', // C# — soft copper
    '#7a6a38', // D  — golden moss
    '#5a7a3a', // D# — spring green
    '#3a7a4a', // E  — forest glow
    '#3a7a68', // F  — jade
    '#3a687a', // F# — ocean
    '#3a4a7a', // G  — dusk blue
    '#4a3a7a', // G# — soft violet
    '#683a7a', // A  — orchid
    '#7a3a60', // A# — warm magenta
    '#7a3a44', // B  — dusty rose
  ];

  function hexPoints(cx: number, cy: number, size: number): string {
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angleDeg = 60 * i + 30;
      const angleRad = (Math.PI / 180) * angleDeg;
      pts.push(`${(cx + size * Math.cos(angleRad)).toFixed(2)},${(cy + size * Math.sin(angleRad)).toFixed(2)}`);
    }
    return pts.join(' ');
  }

  function buildHexes(oct: number): HexCell[] {
    const baseMidi = (oct + 1) * 12;
    const cells: HexCell[] = [];
    for (let r = R_MIN; r <= R_MAX; r++) {
      for (let q = Q_MIN; q <= Q_MAX; q++) {
        const cx = HEX_SIZE * (sqrt3 * q + sqrt3 / 2 * r);
        const cy = HEX_SIZE * (3 / 2 * r);
        const midi = baseMidi + q * 4 + r * 3;
        if (midi < 0 || midi > 127) continue;
        const pitchClass = ((midi % 12) + 12) % 12;
        const noteOctave = Math.floor(midi / 12) - 1;
        cells.push({
          q, r, cx, cy, midi,
          noteName: NOTE_NAMES[pitchClass],
          noteOctave, pitchClass,
          points: hexPoints(cx, cy, HEX_SIZE - 1),
        });
      }
    }
    return cells;
  }

  let hexes = $derived(buildHexes(octave));

  let viewBox = $derived((() => {
    if (hexes.length === 0) return '0 0 100 100';
    const pad = HEX_SIZE + 2;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const h of hexes) {
      if (h.cx - pad < minX) minX = h.cx - pad;
      if (h.cy - pad < minY) minY = h.cy - pad;
      if (h.cx + pad > maxX) maxX = h.cx + pad;
      if (h.cy + pad > maxY) maxY = h.cy + pad;
    }
    return `${minX.toFixed(1)} ${minY.toFixed(1)} ${(maxX - minX).toFixed(1)} ${(maxY - minY).toFixed(1)}`;
  })());

  // ── Active note tracking ──────────────────────────────────────────────────

  let activeNoteSet = $state<Set<number>>(new Set());
  let chordName = $state<string | null>(null);

  let animFrame = 0;
  function pollEngine() {
    activeNoteSet = new Set(engine.getActiveNotes());
    animFrame = requestAnimationFrame(pollEngine);
  }

  $effect(() => {
    animFrame = requestAnimationFrame(pollEngine);
    const unsub = engine.onSpore('note_data', (data) => {
      chordName = (data as any).chordName ?? null;
    });
    return () => { cancelAnimationFrame(animFrame); unsub(); };
  });

  // ── Pointer interaction ───────────────────────────────────────────────────

  const pointerNotes = new Map<number, number>();

  function clientToSvg(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }

  function hitTest(px: number, py: number): HexCell | null {
    let best: HexCell | null = null;
    let bestDist = HEX_SIZE;
    for (const hex of hexes) {
      const dx = px - hex.cx;
      const dy = py - hex.cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestDist) { bestDist = d; best = hex; }
    }
    return best;
  }

  function onPointerDown(e: PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const svg = e.currentTarget as SVGSVGElement;
    svg.setPointerCapture(e.pointerId);
    const { x, y } = clientToSvg(svg, e.clientX, e.clientY);
    const hex = hitTest(x, y);
    if (!hex) return;
    const prev = pointerNotes.get(e.pointerId);
    if (prev !== undefined) engine.noteOff(prev);
    pointerNotes.set(e.pointerId, hex.midi);
    engine.noteOn(hex.midi);
  }

  function onPointerMove(e: PointerEvent) {
    if (!pointerNotes.has(e.pointerId)) return;
    e.preventDefault();
    e.stopPropagation();
    const svg = e.currentTarget as SVGSVGElement;
    const { x, y } = clientToSvg(svg, e.clientX, e.clientY);
    const hex = hitTest(x, y);
    const prev = pointerNotes.get(e.pointerId)!;
    if (!hex || hex.midi === prev) return;
    engine.noteOff(prev);
    pointerNotes.set(e.pointerId, hex.midi);
    engine.noteOn(hex.midi);
  }

  function onPointerUp(e: PointerEvent) {
    const midi = pointerNotes.get(e.pointerId);
    if (midi !== undefined) {
      engine.noteOff(midi);
      pointerNotes.delete(e.pointerId);
    }
    try { (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId); }
    catch { /* already released */ }
  }

  // ── Shared SVG render snippet ─────────────────────────────────────────────

  // Both the inline module view and fullscreen overlay render the same hex grid.
  // We use a function to avoid duplicating the hex rendering logic.
</script>

<!-- Module panel view (in-rack) -->
<ModulePanel title="Hex Keys" gridWidth={12} gridHeight={5}>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <svg
    class="hex-grid"
    {viewBox}
    role="application"
    aria-label="Isomorphic hex keyboard"
    style="touch-action: none;"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
  >
    {#each hexes as hex (hex.q * 100 + hex.r)}
      {@const isActive = activeNoteSet.has(hex.midi)}
      {@const fillColor = isActive ? PITCH_COLORS_ACTIVE[hex.pitchClass] : PITCH_COLORS[hex.pitchClass]}
      <polygon points={hex.points} fill={fillColor} stroke="rgba(0,0,0,0.4)" stroke-width="1" stroke-linejoin="round" />
      {#if isActive}
        <polygon points={hexPoints(hex.cx, hex.cy, HEX_SIZE + 2)} fill="none" stroke={PITCH_COLORS_ACTIVE[hex.pitchClass]} stroke-width="2" stroke-linejoin="round" opacity="0.5" />
      {/if}
      <text x={hex.cx} y={hex.cy - 3} text-anchor="middle" dominant-baseline="middle" class="note-name" class:active-text={isActive}>{hex.noteName}</text>
      <text x={hex.cx} y={hex.cy + 8} text-anchor="middle" dominant-baseline="middle" class="note-oct" class:active-text={isActive}>{hex.noteOctave}</text>
    {/each}
  </svg>

  <div class="bottom-bar">
    <div class="chord-display">
      {#if chordName}<span class="chord-name">{chordName}</span>{:else}<span class="chord-hint">touch to play</span>{/if}
    </div>
    <div class="controls-group">
      <Knob value={octave} min={1} max={7} label="OCT" onChange={setOctave} />
      <Knob value={velocity} min={0} max={1} label="VEL" onChange={setVelocity} />
    </div>
    <div class="ports-group">
      <PortJack id="cv_out" type="control" direction="output" label="CV" connected={connectedPorts.has('cv_out')} onConnect={() => handlePortConnect('cv_out')} {moduleId} />
      <PortJack id="gate_out" type="control" direction="output" label="GATE" connected={connectedPorts.has('gate_out')} onConnect={() => handlePortConnect('gate_out')} {moduleId} />
      <PortJack id="note_data" type="spore" direction="output" label="SPORE" connected={connectedPorts.has('note_data')} onConnect={() => handlePortConnect('note_data')} {moduleId} />
    </div>
    <button class="fullscreen-btn" onclick={openFullscreen} title="Open fullscreen keyboard">PLAY</button>
  </div>
</ModulePanel>

<!-- Fullscreen overlay -->
{#if fullscreen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fs-overlay" bind:this={fullscreenEl}>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <svg
      class="fs-hex-grid"
      {viewBox}
      role="application"
      aria-label="Fullscreen isomorphic hex keyboard"
      style="touch-action: none;"
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerUp}
    >
      {#each hexes as hex (hex.q * 100 + hex.r)}
        {@const isActive = activeNoteSet.has(hex.midi)}
        {@const fillColor = isActive ? PITCH_COLORS_ACTIVE[hex.pitchClass] : PITCH_COLORS[hex.pitchClass]}
        <polygon points={hex.points} fill={fillColor} stroke="rgba(0,0,0,0.35)" stroke-width="0.8" stroke-linejoin="round" />
        {#if isActive}
          <polygon points={hexPoints(hex.cx, hex.cy, HEX_SIZE + 2)} fill="none" stroke={PITCH_COLORS_ACTIVE[hex.pitchClass]} stroke-width="2" stroke-linejoin="round" opacity="0.6" />
        {/if}
        <text x={hex.cx} y={hex.cy - 3} text-anchor="middle" dominant-baseline="middle" class="note-name" class:active-text={isActive}>{hex.noteName}</text>
        <text x={hex.cx} y={hex.cy + 8} text-anchor="middle" dominant-baseline="middle" class="note-oct" class:active-text={isActive}>{hex.noteOctave}</text>
      {/each}
    </svg>

    <!-- Chord name — top center -->
    <div class="fs-chord">
      {#if chordName}<span class="chord-name">{chordName}</span>{/if}
    </div>

    <!-- Octave buttons — bottom left -->
    <div class="fs-octave">
      <button class="fs-btn" onclick={() => setOctave(Math.max(1, octave - 1))}>-</button>
      <span class="fs-octave-label">OCT {octave}</span>
      <button class="fs-btn" onclick={() => setOctave(Math.min(7, octave + 1))}>+</button>
    </div>

    <!-- Close button — bottom right -->
    <button class="fs-close" onclick={closeFullscreen} title="Exit fullscreen">EXIT</button>
  </div>
{/if}

<style>
  .hex-grid {
    width: 100%;
    flex: 1;
    min-height: 0;
    cursor: pointer;
    display: block;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }

  :global(.note-name) {
    font-family: 'Courier New', monospace;
    font-size: 8px;
    font-weight: 600;
    fill: rgba(255, 255, 255, 0.7);
    pointer-events: none;
    user-select: none;
  }
  :global(.note-name.active-text) { fill: rgba(255, 255, 255, 0.95); }

  :global(.note-oct) {
    font-family: 'Courier New', monospace;
    font-size: 6px;
    fill: rgba(255, 255, 255, 0.35);
    pointer-events: none;
    user-select: none;
  }
  :global(.note-oct.active-text) { fill: rgba(255, 255, 255, 0.7); }

  /* Bottom bar */
  .bottom-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    flex-shrink: 0;
    padding: 2px 0;
  }
  .chord-display { min-width: 70px; text-align: center; flex-shrink: 0; }
  .chord-name {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 12px; font-weight: 700;
    color: var(--knob-indicator, #7fba5c);
    letter-spacing: 0.04em;
    text-shadow: 0 0 6px var(--knob-indicator, #7fba5c);
  }
  .chord-hint {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 8px; color: var(--label-color, #a89880); opacity: 0.4;
  }
  .controls-group { display: flex; gap: 8px; }
  .ports-group { display: flex; gap: 6px; margin-left: auto; }

  /* Play/fullscreen button */
  .fullscreen-btn {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 9px;
    color: var(--knob-indicator, #7fba5c);
    background: rgba(127, 186, 92, 0.1);
    border: 1px solid var(--knob-indicator, #7fba5c);
    border-radius: 2px;
    padding: 3px 8px;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    flex-shrink: 0;
    transition: background 0.12s;
  }
  .fullscreen-btn:hover { background: rgba(127, 186, 92, 0.2); }

  /* ── Fullscreen overlay ─────────────────────────────────────────────────── */
  .fs-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: #0a0d0a;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .fs-hex-grid {
    width: 100%;
    height: 100%;
    cursor: pointer;
    display: block;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    padding: 8px;
  }

  .fs-chord {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    pointer-events: none;
  }
  .fs-chord .chord-name {
    font-size: 18px;
    text-shadow: 0 0 12px var(--knob-indicator, #7fba5c);
  }

  .fs-octave {
    position: absolute;
    bottom: 12px;
    left: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .fs-octave-label {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 12px;
    color: var(--label-color, #a89880);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    min-width: 50px;
    text-align: center;
  }

  .fs-btn {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 16px;
    color: var(--label-color, #a89880);
    background: rgba(26, 18, 16, 0.8);
    border: 1px solid var(--port-stroke, #5a4a3a);
    border-radius: 4px;
    width: 36px;
    height: 36px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.12s;
  }
  .fs-btn:hover { border-color: var(--knob-indicator, #7fba5c); }

  .fs-close {
    position: absolute;
    bottom: 12px;
    right: 12px;
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 10px;
    color: var(--label-color, #a89880);
    background: rgba(26, 18, 16, 0.8);
    border: 1px solid var(--port-stroke, #5a4a3a);
    border-radius: 4px;
    padding: 8px 16px;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    transition: border-color 0.12s, color 0.12s;
  }
  .fs-close:hover { border-color: var(--label-color, #a89880); color: var(--module-title-color, #c8b89a); }
</style>
