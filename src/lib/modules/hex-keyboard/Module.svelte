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
  let locked = $state(false);

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

  // ── Lock: dispatch to parent page ─────────────────────────────────────────

  function toggleLock() {
    locked = !locked;
    // Dispatch a custom event the page can listen for
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mycelium-lock', { detail: { locked } }));
    }
  }

  // ── Hex grid — landscape layout ───────────────────────────────────────────

  const HEX_SIZE = 24;
  const sqrt3 = Math.sqrt(3);
  const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  // Wide grid: many columns, few rows — landscape phone optimized
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

  const PITCH_COLORS: string[] = [
    '#8b3a2a', '#7a3d1e', '#7a6020', '#5a6628', '#2e6b35', '#1e6658',
    '#1a5c72', '#1e3d7a', '#2e2680', '#5a2680', '#7a2060', '#7a2040',
  ];

  const PITCH_COLORS_ACTIVE: string[] = [
    '#e0604a', '#d46030', '#d4aa38', '#9aac44', '#4eb85a', '#36b89c',
    '#30a0c8', '#3470e0', '#5048e0', '#9848e0', '#d03aaa', '#d03468',
  ];

  function hexPoints(cx: number, cy: number, size: number): string {
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angleDeg = 60 * i + 30; // pointy-top
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
          noteOctave,
          pitchClass,
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

  // ── Pointer interaction (press-and-hold, no toggle) ───────────────────────

  const pointerNotes = new Map<number, number>();
  let svgEl: SVGSVGElement | undefined = $state();

  function clientToSvg(clientX: number, clientY: number): { x: number; y: number } {
    if (!svgEl) return { x: 0, y: 0 };
    const pt = svgEl.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const svgPt = pt.matrixTransform(svgEl.getScreenCTM()!.inverse());
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
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    const { x, y } = clientToSvg(e.clientX, e.clientY);
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
    const { x, y } = clientToSvg(e.clientX, e.clientY);
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
</script>

<ModulePanel title="Hex Keys" gridWidth={12} gridHeight={5}>
  <!-- Hex grid SVG — takes most of the space -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <svg
    class="hex-grid"
    {viewBox}
    bind:this={svgEl}
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
      <g>
        <polygon
          points={hex.points}
          fill={fillColor}
          stroke="rgba(0,0,0,0.4)"
          stroke-width="1"
          stroke-linejoin="round"
        />
        {#if isActive}
          <polygon
            points={hexPoints(hex.cx, hex.cy, HEX_SIZE + 2)}
            fill="none"
            stroke={PITCH_COLORS_ACTIVE[hex.pitchClass]}
            stroke-width="2"
            stroke-linejoin="round"
            opacity="0.5"
          />
        {/if}
        <text
          x={hex.cx}
          y={hex.cy - 3}
          text-anchor="middle"
          dominant-baseline="middle"
          class="note-name"
          class:active-text={isActive}
        >{hex.noteName}</text>
        <text
          x={hex.cx}
          y={hex.cy + 8}
          text-anchor="middle"
          dominant-baseline="middle"
          class="note-oct"
          class:active-text={isActive}
        >{hex.noteOctave}</text>
      </g>
    {/each}
  </svg>

  <!-- Bottom bar: chord name, controls, ports, lock -->
  <div class="bottom-bar">
    <div class="chord-display">
      {#if chordName}
        <span class="chord-name">{chordName}</span>
      {:else}
        <span class="chord-hint">touch to play</span>
      {/if}
    </div>

    <div class="controls-group">
      <Knob value={octave} min={1} max={7} label="OCT" onChange={setOctave} />
      <Knob value={velocity} min={0} max={1} label="VEL" onChange={setVelocity} />
    </div>

    <div class="ports-group">
      <PortJack
        id="cv_out" type="control" direction="output" label="CV"
        connected={connectedPorts.has('cv_out')}
        onConnect={() => handlePortConnect('cv_out')}
        {moduleId}
      />
      <PortJack
        id="gate_out" type="control" direction="output" label="GATE"
        connected={connectedPorts.has('gate_out')}
        onConnect={() => handlePortConnect('gate_out')}
        {moduleId}
      />
      <PortJack
        id="note_data" type="spore" direction="output" label="SPORE"
        connected={connectedPorts.has('note_data')}
        onConnect={() => handlePortConnect('note_data')}
        {moduleId}
      />
    </div>

    <!-- Lock button — disables rack pan/zoom when playing -->
    <button
      class="lock-btn"
      class:locked
      onclick={toggleLock}
      title={locked ? 'Unlock rack pan/zoom' : 'Lock rack — disable pan/zoom for playing'}
    >
      {locked ? 'UNLOCK' : 'LOCK'}
    </button>
  </div>
</ModulePanel>

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

  :global(.note-name.active-text) {
    fill: rgba(255, 255, 255, 0.95);
  }

  :global(.note-oct) {
    font-family: 'Courier New', monospace;
    font-size: 6px;
    fill: rgba(255, 255, 255, 0.35);
    pointer-events: none;
    user-select: none;
  }

  :global(.note-oct.active-text) {
    fill: rgba(255, 255, 255, 0.7);
  }

  /* Bottom bar — horizontal strip below the hex grid */
  .bottom-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    flex-shrink: 0;
    padding: 2px 0;
  }

  .chord-display {
    min-width: 70px;
    text-align: center;
    flex-shrink: 0;
  }

  .chord-name {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 12px;
    font-weight: 700;
    color: var(--knob-indicator, #7fba5c);
    letter-spacing: 0.04em;
    text-shadow: 0 0 6px var(--knob-indicator, #7fba5c);
  }

  .chord-hint {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 8px;
    color: var(--label-color, #a89880);
    opacity: 0.4;
  }

  .controls-group {
    display: flex;
    gap: 8px;
  }

  .ports-group {
    display: flex;
    gap: 6px;
    margin-left: auto;
  }

  .lock-btn {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 8px;
    color: var(--label-color, #a89880);
    background: rgba(26, 18, 16, 0.6);
    border: 1px solid var(--port-stroke, #5a4a3a);
    border-radius: 2px;
    padding: 3px 6px;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    transition: border-color 0.12s, color 0.12s;
    flex-shrink: 0;
  }

  .lock-btn:hover {
    border-color: var(--label-color, #a89880);
  }

  .lock-btn.locked {
    border-color: var(--knob-indicator, #7fba5c);
    color: var(--knob-indicator, #7fba5c);
    background: rgba(127, 186, 92, 0.1);
  }
</style>
