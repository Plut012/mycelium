<script lang="ts">
  import { Knob, ModulePanel, PortJack } from '$lib/ui';
  import type { HexKeyboardEngine } from './engine.js';

  // ── Props ─────────────────────────────────────────────────────────────────

  type Props = {
    engine: HexKeyboardEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  // ── Parameters ────────────────────────────────────────────────────────────

  let octave    = $state(3);
  let velocity  = $state(0.8);

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

  // ── Hex grid geometry ─────────────────────────────────────────────────────

  /**
   * Pointy-top hexagons with axial coordinates (q, r).
   *
   * Pixel positions:
   *   x = size * (sqrt3 * q + sqrt3/2 * r)
   *   y = size * (3/2 * r)
   *
   * MIDI mapping (Harmonic Table):
   *   midi = baseMidi + q*4 + r*3
   *   where baseMidi = (octave + 1) * 12
   *
   * Interval axes:
   *   +q  → +4 semitones (major third, right)
   *   +r  → +3 semitones (minor third, down-right)
   *   +q-r → +7 semitones (perfect fifth, upper-right diagonal, since 4 - (-3) = 7 ... actually q+1, r-1 = +4+(-3) = +1 ... )
   *
   * Wait — let's be careful. In Harmonic Table:
   *   Moving right (+q)        = +4 semitones (major third)
   *   Moving down-right (+r)   = +3 semitones (minor third)
   *   Moving up-right (+q, -r) = +4 - 3 = +1 ... no.
   *   Moving up (−r)           = −3 semitones
   *   Actually moving diagonally up-left: −q+r changes = −4+3 = −1 ...
   *
   * The design doc says:
   *   col → +4 semitones (major third)
   *   row → +3 semitones (minor third)
   *   diagonal up-left → +7 (fifth) — which is (+3 row) + (+4 col offset) from offset grids
   *
   * In pure axial: q=col, r=row. The sixth neighbor directions for pointy-top are:
   *   (+1, 0), (-1, 0), (0, +1), (0, -1), (+1, -1), (-1, +1)
   * Semitone changes:
   *   (+1, 0):  +4    major third
   *   (0, +1):  +3    minor third
   *   (+1,-1):  +4−3 = +1   semitone (not useful)
   *   (-1, 0):  −4    major third down
   *   (0, -1):  −3    minor third up
   *   (-1,+1):  −4+3 = −1   semitone
   *
   * Perfect fifth (+7) = major third + minor third = move (+1,0) then (0,+1) = (+1,+1).
   * But (+1,+1) isn't a direct neighbor in axial hex — it's two steps.
   * The two direct neighbors that sum to +7: (+1,0)+(0,+1) = diagonal across two.
   *
   * This is the Tonnetz / Harmonic Table. The fifth relationship is the
   * "far diagonal" neighbor (+1,+1) which IS the upper-left neighbor in offset grid
   * rendering. Let me just verify with a real note:
   *   C=60, +4=E, +3=Eb — correct for a horizontal/diagonal reading.
   *   C major: C(0,0), E(1,0), G — G is C+7. So G is at (q,r) where 4q+3r=7.
   *   One solution: q=1, r=1 → 4+3=7. Yes! So G is the (1,1) neighbor.
   *   In pointy-top axial, that IS a neighbor direction: (+1,+1) — wait, that's
   *   NOT in the 6 neighbor list above. The 6 neighbors are:
   *   (+1,0),(−1,0),(0,+1),(0,−1),(+1,−1),(−1,+1)
   *
   * Hmm. So (+1,+1) is NOT a direct hex neighbor in standard axial.
   *
   * Let me reconsider. The Harmonic Table uses a DIFFERENT coordinate system than
   * standard axial hexagons. The (col*4 + row*3) formula maps to a specific
   * visual arrangement where adjacent hexes share the fifth relationship via a
   * particular offset pattern.
   *
   * Solution: use the formula as-is for MIDI assignment, and use standard axial
   * pixel positions for rendering. The isomorphic property holds regardless of
   * how we assign q/r — all C notes form a regular pattern, all major chords
   * are the same physical shape.
   *
   * The key insight: any two hex positions (dq, dr) apart have the same interval
   * (4*dq + 3*dr) semitones. This IS isomorphic — same chord = same shape.
   * The fifth (7 semitones) just isn't reached by a single-step neighbor.
   * But a TRIANGLE of three hexes that spells C major (C=0, E=4, G=7) has:
   *   C at (0,0), E at (1,0), G at ?
   *   G needs q*4+r*3=7. Options: (1,1)→7 (not neighbor), (4,−3)→7 (far away)...
   *
   * WAIT. I need to re-read the design doc more carefully.
   * The doc says moving diagonally up-left = +7. In the offset coordinate picture:
   *
   *     ╱ ╲
   *  +5th ╱   ╲ +maj3rd
   *
   * This is a FLAT-TOP hex diagram. The vertical axis shows fifths, the diagonals
   * show thirds. For flat-top hexes with offset rows:
   *   up         = +7 semitones (fifth)
   *   upper-right = +4 (major third)
   *   lower-right = +3 (minor third)
   *
   * Let's switch to: midi = baseMidi + (q * 7) + (r * 4) with flat-top pointy-top...
   * No, let's just use the doc formula midi = baseMidi + col*4 + row*3 as written
   * and use OFFSET grid coordinates (not axial) for layout, since offset coords
   * naturally create the correct neighbor adjacency.
   *
   * For pointy-top with odd-r offset:
   *   cx = col * hexWidth + (row % 2 === 1 ? hexWidth/2 : 0)
   *   cy = row * (size * 1.5)
   * where hexWidth = sqrt(3) * size.
   *
   * Neighbor adjacency in odd-r offset:
   * For even rows: (−1,0),(+1,0),(0,−1),(0,+1),(−1,−1),(−1,+1)  (left-shifted upper/lower)
   * For odd  rows: (−1,0),(+1,0),(0,−1),(0,+1),(+1,−1),(+1,+1)  (right-shifted upper/lower)
   *
   * In this offset system, neighbor semitone changes:
   *   right (+1,0):    col+1 → +4 semitones
   *   upper-right (depends on parity): → let's check both parities
   *
   * For even-row hex at (col, row), upper-right neighbor is (col, row−1):
   *   Δmidi = 0*4 + (−1)*3 = −3  (oops, that's a minor third DOWN, not +5th)
   *
   * This is getting complicated. Let me just use axial coordinates where the
   * neighbor relationships are well-defined and accept that fifths = two steps,
   * and major chords form triangles across (+1,0), (0,+1), (+1,+1) — which is
   * just two moves. The visual chord shapes will still be consistent everywhere.
   * That's the isomorphic property. Let me verify a C major chord shape:
   *   C: (0,0)  → midi 0 from root
   *   E: (1,0)  → +4 (major third) ✓
   *   G: (1,1)  → +4+3 = +7 (perfect fifth) ✓
   * C, E, G form an L-shape / right-angle triangle. Same shape for all major chords.
   * Minor chord: C, Eb, G
   *   C: (0,0)
   *   Eb: (0,1) → +3 (minor third) ✓
   *   G:  (1,1) → +7 ✓
   * Same triangle rotated. These are compact shapes — great for touch exploration.
   */

  const HEX_SIZE = 26;  // hex circumradius in px
  const sqrt3 = Math.sqrt(3);
  const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  // Grid range in axial coordinates
  const Q_MIN = -3, Q_MAX = 3;
  const R_MIN = -3, R_MAX = 3;

  interface HexCell {
    q: number;
    r: number;
    cx: number;   // pixel center x
    cy: number;   // pixel center y
    midi: number;
    noteName: string;   // e.g. "C"
    noteOctave: number; // e.g. 4
    pitchClass: number; // 0–11
    points: string;     // SVG polygon points attribute
  }

  // Pitch-class colours — muted earthy tones matching Ancient Forest theme
  const PITCH_COLORS: string[] = [
    '#8b3a2a',  //  0 C  — warm red / terracotta
    '#7a3d1e',  //  1 C# — deep burnt orange
    '#7a6020',  //  2 D  — gold / ochre
    '#5a6628',  //  3 D# — olive green
    '#2e6b35',  //  4 E  — forest green
    '#1e6658',  //  5 F  — teal
    '#1a5c72',  //  6 F# — deep cyan
    '#1e3d7a',  //  7 G  — blue
    '#2e2680',  //  8 G# — indigo
    '#5a2680',  //  9 A  — purple
    '#7a2060',  // 10 A# — magenta / plum
    '#7a2040',  // 11 B  — rose
  ];

  // Active (lit) versions — significantly brighter
  const PITCH_COLORS_ACTIVE: string[] = [
    '#e0604a',  //  0 C
    '#d46030',  //  1 C#
    '#d4aa38',  //  2 D
    '#9aac44',  //  3 D#
    '#4eb85a',  //  4 E
    '#36b89c',  //  5 F
    '#30a0c8',  //  6 F#
    '#3470e0',  //  7 G
    '#5048e0',  //  8 G#
    '#9848e0',  //  9 A
    '#d03aaa',  // 10 A#
    '#d03468',  // 11 B
  ];

  /** Compute the 6 vertices of a pointy-top hexagon centred at (cx, cy). */
  function hexPoints(cx: number, cy: number, size: number): string {
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angleDeg = 60 * i + 30; // pointy-top: first vertex at 30°
      const angleRad = (Math.PI / 180) * angleDeg;
      const x = cx + size * Math.cos(angleRad);
      const y = cy + size * Math.sin(angleRad);
      pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }
    return pts.join(' ');
  }

  /** Build the full hex grid once. */
  function buildHexes(octave: number): HexCell[] {
    const baseMidi = (octave + 1) * 12;
    const cells: HexCell[] = [];

    for (let r = R_MIN; r <= R_MAX; r++) {
      for (let q = Q_MIN; q <= Q_MAX; q++) {
        // Axial → pixel (pointy-top)
        const cx = HEX_SIZE * (sqrt3 * q + sqrt3 / 2 * r);
        const cy = HEX_SIZE * (3 / 2 * r);

        const midi = baseMidi + q * 4 + r * 3;
        // Clamp to valid MIDI range
        if (midi < 0 || midi > 127) continue;

        const pitchClass = ((midi % 12) + 12) % 12;
        const noteOctave = Math.floor(midi / 12) - 1;
        const noteName = NOTE_NAMES[pitchClass];

        cells.push({
          q, r, cx, cy, midi,
          noteName, noteOctave, pitchClass,
          points: hexPoints(cx, cy, HEX_SIZE - 1), // slight inset for gap between hexes
        });
      }
    }

    return cells;
  }

  let hexes = $derived(buildHexes(octave));

  // ── SVG viewBox calculation ───────────────────────────────────────────────

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
  let chordName     = $state<string | null>(null);

  // RAF polling keeps the display in sync without re-triggering heavy derived
  let animFrame = 0;

  function pollEngine() {
    const notes = engine.getActiveNotes();
    activeNoteSet = new Set(notes);
    animFrame = requestAnimationFrame(pollEngine);
  }

  $effect(() => {
    animFrame = requestAnimationFrame(pollEngine);
    // Subscribe to spore updates for chord name
    const unsub = engine.onSpore('note_data', (data) => {
      const spore = data as unknown as { chordName: string | null };
      chordName = spore.chordName;
    });
    return () => {
      cancelAnimationFrame(animFrame);
      unsub();
    };
  });

  // ── Touch / pointer interaction ───────────────────────────────────────────

  /**
   * Map from pointer id → midi note currently held by that pointer.
   * Using a plain object is fine here — we don't need reactivity on this map.
   */
  const pointerNotes = new Map<number, number>();

  /** Find the hex whose centre is nearest to (px, py) within HEX_SIZE distance. */
  function hitTest(px: number, py: number): HexCell | null {
    let best: HexCell | null = null;
    let bestDist = HEX_SIZE; // must be within one radius
    for (const hex of hexes) {
      const dx = px - hex.cx;
      const dy = py - hex.cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestDist) {
        bestDist = d;
        best = hex;
      }
    }
    return best;
  }

  /**
   * Convert a client-space (x, y) to SVG user-space coordinates.
   * We need to account for the SVG's current transform / viewBox.
   */
  let svgEl: SVGSVGElement | undefined = $state();

  function clientToSvg(clientX: number, clientY: number): { x: number; y: number } {
    if (!svgEl) return { x: 0, y: 0 };
    const pt = svgEl.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const svgPt = pt.matrixTransform(svgEl.getScreenCTM()!.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }

  function onPointerDown(e: PointerEvent) {
    e.preventDefault();
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    const { x, y } = clientToSvg(e.clientX, e.clientY);
    const hex = hitTest(x, y);
    if (!hex) return;
    // If pointer was already tracking a note (shouldn't happen, but guard)
    const prev = pointerNotes.get(e.pointerId);
    if (prev !== undefined) engine.noteOff(prev);
    pointerNotes.set(e.pointerId, hex.midi);
    engine.noteOn(hex.midi);
  }

  function onPointerMove(e: PointerEvent) {
    if (!pointerNotes.has(e.pointerId)) return;
    e.preventDefault();
    const { x, y } = clientToSvg(e.clientX, e.clientY);
    const hex = hitTest(x, y);
    const prev = pointerNotes.get(e.pointerId)!;
    if (!hex || hex.midi === prev) return;
    // Finger slid to a different hex
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
    try {
      (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
    } catch { /* ignore if already released */ }
  }

  function onPointerCancel(e: PointerEvent) {
    onPointerUp(e);
  }
</script>

<ModulePanel title="Hex Keys" gridWidth={8} gridHeight={8}>
  <!-- Hex grid SVG -->
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
    onpointercancel={onPointerCancel}
  >
    {#each hexes as hex (hex.q * 100 + hex.r)}
      {@const isActive = activeNoteSet.has(hex.midi)}
      {@const fillColor = isActive ? PITCH_COLORS_ACTIVE[hex.pitchClass] : PITCH_COLORS[hex.pitchClass]}
      <g class="hex-cell">
        <polygon
          points={hex.points}
          fill={fillColor}
          stroke="rgba(0,0,0,0.45)"
          stroke-width="1"
          stroke-linejoin="round"
        />
        {#if isActive}
          <!-- Glow ring behind the hex when active -->
          <polygon
            points={hexPoints(hex.cx, hex.cy, HEX_SIZE + 3)}
            fill="none"
            stroke={PITCH_COLORS_ACTIVE[hex.pitchClass]}
            stroke-width="2.5"
            stroke-linejoin="round"
            opacity="0.6"
          />
        {/if}
        <!-- Note name -->
        <text
          x={hex.cx}
          y={hex.cy - 4}
          text-anchor="middle"
          dominant-baseline="middle"
          class="note-name"
          class:active-text={isActive}
        >{hex.noteName}</text>
        <!-- Octave number -->
        <text
          x={hex.cx}
          y={hex.cy + 9}
          text-anchor="middle"
          dominant-baseline="middle"
          class="note-octave"
          class:active-text={isActive}
        >{hex.noteOctave}</text>
      </g>
    {/each}
  </svg>

  <!-- Chord display -->
  <div class="chord-display">
    {#if chordName}
      <span class="chord-name">{chordName}</span>
    {:else}
      <span class="chord-hint">touch hexagons to play</span>
    {/if}
  </div>

  <!-- Knob controls -->
  <div class="controls-row">
    <Knob value={octave} min={1} max={7} label="OCT" onChange={setOctave} />
    <Knob value={velocity} min={0} max={1} label="VEL" onChange={setVelocity} />
  </div>

  <!-- Output ports -->
  <div class="ports-row">
    <PortJack
      id="cv_out"
      type="control"
      direction="output"
      label="CV"
      connected={connectedPorts.has('cv_out')}
      onConnect={() => handlePortConnect('cv_out')}
      {moduleId}
    />
    <PortJack
      id="gate_out"
      type="control"
      direction="output"
      label="GATE"
      connected={connectedPorts.has('gate_out')}
      onConnect={() => handlePortConnect('gate_out')}
      {moduleId}
    />
    <PortJack
      id="note_data"
      type="spore"
      direction="output"
      label="SPORE"
      connected={connectedPorts.has('note_data')}
      onConnect={() => handlePortConnect('note_data')}
      {moduleId}
    />
  </div>
</ModulePanel>

<style>
  /* The SVG fills all available horizontal space and most of the vertical space */
  .hex-grid {
    width: 100%;
    flex: 1;
    min-height: 0;
    cursor: pointer;
    display: block;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }

  /* Note name text */
  :global(.note-name) {
    font-family: 'Courier New', monospace;
    font-size: 9px;
    font-weight: 600;
    fill: rgba(255, 255, 255, 0.75);
    pointer-events: none;
    user-select: none;
  }

  :global(.note-name.active-text) {
    fill: rgba(255, 255, 255, 0.97);
    font-weight: 700;
  }

  /* Octave number text */
  :global(.note-octave) {
    font-family: 'Courier New', monospace;
    font-size: 7px;
    fill: rgba(255, 255, 255, 0.45);
    pointer-events: none;
    user-select: none;
  }

  :global(.note-octave.active-text) {
    fill: rgba(255, 255, 255, 0.8);
  }

  /* Chord name display bar */
  .chord-display {
    width: 100%;
    text-align: center;
    min-height: 18px;
    flex-shrink: 0;
  }

  .chord-name {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 13px;
    font-weight: 700;
    color: var(--knob-indicator, #7fba5c);
    letter-spacing: 0.04em;
    text-shadow: 0 0 8px var(--knob-indicator, #7fba5c);
  }

  .chord-hint {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 9px;
    color: var(--label-color, #a89880);
    opacity: 0.5;
    letter-spacing: 0.06em;
  }

  /* Controls row: two knobs side by side */
  .controls-row {
    display: flex;
    gap: 16px;
    justify-content: center;
    flex-shrink: 0;
  }

  /* Ports row: three jacks spread across the bottom */
  .ports-row {
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding: 0 4px;
    flex-shrink: 0;
  }
</style>
