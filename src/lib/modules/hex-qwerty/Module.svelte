<script lang="ts">
  import { Knob, ModulePanel, PortJack } from '$lib/ui';
  import { QWERTY_HEX_LAYOUT, cellToMidi, type QwertyHexEngine } from './engine.js';

  type Props = {
    engine: QwertyHexEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  let octave = $state(3);
  let velocity = $state(0.8);

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

  const HEX_SIZE = 24;
  const sqrt3 = Math.sqrt(3);
  const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  interface HexCell {
    q: number;
    r: number;
    cx: number;
    cy: number;
    midi: number;
    keyLabel: string;
    noteName: string;
    noteOctave: number;
    pitchClass: number;
    isNatural: boolean;
    points: string;
  }

  // Two-color system: naturals (warm) vs accidentals (cool) — same as Hex Keys
  const NATURAL_SET = new Set([0, 2, 4, 5, 7, 9, 11]); // C D E F G A B

  const COLOR_NATURAL     = '#d0ccc4';
  const COLOR_ACCIDENTAL  = '#1a1a1a';
  const COLOR_NATURAL_ACTIVE    = '#f0e8d8';
  const COLOR_ACCIDENTAL_ACTIVE = '#4a4a4a';

  function hexColor(pitchClass: number, active: boolean): string {
    const isNatural = NATURAL_SET.has(pitchClass);
    if (active) return isNatural ? COLOR_NATURAL_ACTIVE : COLOR_ACCIDENTAL_ACTIVE;
    return isNatural ? COLOR_NATURAL : COLOR_ACCIDENTAL;
  }

  function hexGlowColor(pitchClass: number): string {
    return NATURAL_SET.has(pitchClass) ? COLOR_NATURAL_ACTIVE : COLOR_ACCIDENTAL_ACTIVE;
  }

  const INTERVAL_NAMES: string[] = [
    'I', 'bII', 'II', 'bIII', 'III', 'IV',
    'bV', 'V', 'bVI', 'VI', 'bVII', 'VII',
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
    const cells: HexCell[] = [];
    for (const cell of QWERTY_HEX_LAYOUT) {
      const cx = HEX_SIZE * (sqrt3 * cell.q + sqrt3 / 2 * cell.r);
      const cy = HEX_SIZE * (3 / 2 * cell.r);
      const midi = cellToMidi(cell.q, cell.r, oct);
      if (midi < 0 || midi > 127) continue;
      const pitchClass = ((midi % 12) + 12) % 12;
      const noteOctave = Math.floor(midi / 12) - 1;
      cells.push({
        q: cell.q, r: cell.r, cx, cy, midi,
        keyLabel: cell.label,
        noteName: NOTE_NAMES[pitchClass],
        noteOctave, pitchClass,
        isNatural: NATURAL_SET.has(pitchClass),
        points: hexPoints(cx, cy, HEX_SIZE - 1),
      });
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
  let intervalDisplay = $state('');

  function computeIntervals(notes: number[]): string {
    if (notes.length < 2) return '';
    const sorted = [...notes].sort((a, b) => a - b);
    const root = sorted[0];
    return sorted.map((n) => {
      const semitones = ((n - root) % 12 + 12) % 12;
      return INTERVAL_NAMES[semitones];
    }).join('  ');
  }

  let animFrame = 0;
  function pollEngine() {
    const notes = engine.getActiveNotes();
    activeNoteSet = new Set(notes);
    intervalDisplay = computeIntervals(notes);
    animFrame = requestAnimationFrame(pollEngine);
  }

  $effect(() => {
    animFrame = requestAnimationFrame(pollEngine);
    const unsub = engine.onSpore('note_data', (data) => {
      chordName = (data as any).chordName ?? null;
    });
    return () => { cancelAnimationFrame(animFrame); unsub(); };
  });

  // ── Pointer interaction (mouse/touch also works) ──────────────────────────

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
</script>

<ModulePanel title="Hex Qwerty" gridWidth={11} gridHeight={4}>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <svg
    class="hex-grid"
    {viewBox}
    role="application"
    aria-label="QWERTY isomorphic hex keyboard"
    style="touch-action: none;"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
  >
    {#each hexes as hex (hex.q * 100 + hex.r)}
      {@const isActive = activeNoteSet.has(hex.midi)}
      {@const fillColor = hexColor(hex.pitchClass, isActive)}
      <polygon points={hex.points} fill={fillColor} stroke="rgba(0,0,0,0.4)" stroke-width="1" stroke-linejoin="round" />
      {#if isActive}
        <polygon points={hexPoints(hex.cx, hex.cy, HEX_SIZE + 2)} fill="none" stroke={hexGlowColor(hex.pitchClass)} stroke-width="2" stroke-linejoin="round" opacity="0.5" />
      {/if}
      <text x={hex.cx} y={hex.cy - 11} text-anchor="middle" dominant-baseline="middle" class="key-label" class:active-text={isActive} class:dark-text={hex.isNatural}>{hex.keyLabel}</text>
      <text x={hex.cx} y={hex.cy + 2} text-anchor="middle" dominant-baseline="middle" class="note-name" class:active-text={isActive} class:dark-text={hex.isNatural}>{hex.noteName}</text>
      <text x={hex.cx} y={hex.cy + 12} text-anchor="middle" dominant-baseline="middle" class="note-oct" class:active-text={isActive} class:dark-text={hex.isNatural}>{hex.noteOctave}</text>
    {/each}
  </svg>

  <div class="bottom-bar">
    <div class="chord-display">
      {#if intervalDisplay}<span class="interval-text-inline">{intervalDisplay}</span>{/if}
      {#if chordName}<span class="chord-name">{chordName}</span>{:else if !intervalDisplay}<span class="chord-hint">play your keyboard</span>{/if}
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

  :global(.key-label) {
    font-family: 'Courier New', monospace;
    font-size: 7px;
    font-weight: 700;
    fill: rgba(255, 255, 255, 0.45);
    pointer-events: none;
    user-select: none;
  }
  :global(.key-label.dark-text) { fill: rgba(0, 0, 0, 0.45); }
  :global(.key-label.active-text) { fill: rgba(255, 255, 255, 0.85); }
  :global(.key-label.active-text.dark-text) { fill: rgba(0, 0, 0, 0.7); }

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
</style>
