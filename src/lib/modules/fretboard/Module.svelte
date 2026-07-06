<script lang="ts">
  import { Knob, ModulePanel, PortJack } from '$lib/ui';
  import { buildFretboardLayout, STRING_COUNT, positionToMidi, type FretboardEngine } from './engine.js';

  type Props = {
    engine: FretboardEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  let octave = $state(2);
  let velocity = $state(0.8);
  let mirrored = $state(false);

  function toggleMirror() {
    mirrored = !mirrored;
    engine.setParameter('mirror', mirrored ? 1 : 0);
  }

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

  // ── Fretboard geometry ────────────────────────────────────────────────────

  const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  const PAD_L = 12;
  const OPEN_X = PAD_L + 12;        // open-string column, left of the nut
  const NUT_X = PAD_L + 24;
  const FRET_W = 42;
  const MAX_FRET = 11;
  const PAD_T = 14;
  const STRING_GAP = 30;
  const BOARD_W = NUT_X + MAX_FRET * FRET_W + 12;
  const BOARD_H = PAD_T * 2 + (STRING_COUNT - 1) * STRING_GAP;

  // Rows always mirror the physical keyboard: in standard mode the low string
  // (Z-row) sits at the bottom; in guitar/mirror mode it's the number row, top.
  function stringY(s: number): number {
    return PAD_T + (mirrored ? s : STRING_COUNT - 1 - s) * STRING_GAP;
  }

  function fretX(fret: number): number {
    const x = fret === 0 ? OPEN_X : NUT_X + (fret - 0.5) * FRET_W;
    return mirrored ? BOARD_W - x : x; // guitar mode: nut on the right
  }

  let nutX = $derived(mirrored ? BOARD_W - NUT_X : NUT_X);

  function inlayX(fret: number): number {
    const x = NUT_X + (fret - 0.5) * FRET_W;
    return mirrored ? BOARD_W - x : x;
  }

  function fretLineX(fret: number): number {
    const x = NUT_X + fret * FRET_W;
    return mirrored ? BOARD_W - x : x;
  }

  const INLAY_FRETS = [3, 5, 7, 9];
  const INLAY_Y = (stringY(0) + stringY(STRING_COUNT - 1)) / 2;

  interface BoardPosition {
    string: number;
    fret: number;
    cx: number;
    cy: number;
    midi: number;
    keyLabel: string;
    noteName: string;
  }

  function buildPositions(oct: number, mir: boolean): BoardPosition[] {
    const out: BoardPosition[] = [];
    for (const pos of buildFretboardLayout(mir)) {
      const midi = positionToMidi(pos.string, pos.fret, oct);
      if (midi < 0 || midi > 127) continue;
      out.push({
        string: pos.string,
        fret: pos.fret,
        cx: fretX(pos.fret),
        cy: stringY(pos.string),
        midi,
        keyLabel: pos.label,
        noteName: NOTE_NAMES[((midi % 12) + 12) % 12],
      });
    }
    return out;
  }

  let positions = $derived(buildPositions(octave, mirrored));

  const OPEN_NAMES = ['E', 'A', 'D', 'G'];

  // ── Active note tracking ──────────────────────────────────────────────────

  let activePosSet = $state<Set<string>>(new Set());
  let activeStrings = $state<Set<number>>(new Set());
  let chordName = $state<string | null>(null);
  let intervalDisplay = $state('');

  const INTERVAL_NAMES: string[] = [
    'I', 'bII', 'II', 'bIII', 'III', 'IV',
    'bV', 'V', 'bVI', 'VI', 'bVII', 'VII',
  ];

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
    const sounding = engine.getSoundingPositions();
    activePosSet = new Set(sounding.map((p) => `${p.string}:${p.fret}`));
    activeStrings = new Set(sounding.map((p) => p.string));
    intervalDisplay = computeIntervals(engine.getActiveNotes());
    animFrame = requestAnimationFrame(pollEngine);
  }

  $effect(() => {
    animFrame = requestAnimationFrame(pollEngine);
    const unsub = engine.onSpore('note_data', (data) => {
      chordName = (data as any).chordName ?? null;
    });
    return () => { cancelAnimationFrame(animFrame); unsub(); };
  });

  // ── Pointer interaction — click frets, drag to slide ─────────────────────

  const pointerHolds = new Map<number, { string: number; fret: number }>();

  function clientToSvg(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }

  function hitTest(px: number, py: number): BoardPosition | null {
    let best: BoardPosition | null = null;
    let bestDist = 16;
    for (const pos of positions) {
      const dx = px - pos.cx;
      const dy = py - pos.cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestDist) { bestDist = d; best = pos; }
    }
    return best;
  }

  function onPointerDown(e: PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const svg = e.currentTarget as SVGSVGElement;
    svg.setPointerCapture(e.pointerId);
    const { x, y } = clientToSvg(svg, e.clientX, e.clientY);
    const pos = hitTest(x, y);
    if (!pos) return;
    const prev = pointerHolds.get(e.pointerId);
    if (prev) engine.releaseFret(prev.string, prev.fret);
    pointerHolds.set(e.pointerId, { string: pos.string, fret: pos.fret });
    engine.pressFret(pos.string, pos.fret);
  }

  function onPointerMove(e: PointerEvent) {
    if (!pointerHolds.has(e.pointerId)) return;
    e.preventDefault();
    e.stopPropagation();
    const svg = e.currentTarget as SVGSVGElement;
    const { x, y } = clientToSvg(svg, e.clientX, e.clientY);
    const pos = hitTest(x, y);
    const prev = pointerHolds.get(e.pointerId)!;
    if (!pos || (pos.string === prev.string && pos.fret === prev.fret)) return;
    engine.releaseFret(prev.string, prev.fret);
    pointerHolds.set(e.pointerId, { string: pos.string, fret: pos.fret });
    engine.pressFret(pos.string, pos.fret);
  }

  function onPointerUp(e: PointerEvent) {
    const held = pointerHolds.get(e.pointerId);
    if (held) {
      engine.releaseFret(held.string, held.fret);
      pointerHolds.delete(e.pointerId);
    }
    try { (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId); }
    catch { /* already released */ }
  }
</script>

<ModulePanel title="Fretboard" gridWidth={11} gridHeight={3}>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <svg
    class="board"
    viewBox="0 0 {BOARD_W} {BOARD_H}"
    role="application"
    aria-label="QWERTY fretboard, all-fourths tuning"
    style="touch-action: none;"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
  >
    <!-- Fret lines -->
    {#each Array.from({ length: MAX_FRET }, (_, i) => i + 1) as fret}
      <line
        class="fret-line"
        x1={fretLineX(fret)} y1={PAD_T - 10}
        x2={fretLineX(fret)} y2={PAD_T + (STRING_COUNT - 1) * STRING_GAP + 10}
      />
    {/each}

    <!-- Inlay dots -->
    {#each INLAY_FRETS as fret}
      <circle class="inlay" cx={inlayX(fret)} cy={INLAY_Y} r="3.5" />
    {/each}

    <!-- Nut — right side in guitar/mirror mode -->
    <line class="nut" x1={nutX} y1={PAD_T - 12} x2={nutX} y2={PAD_T + (STRING_COUNT - 1) * STRING_GAP + 12} />

    <!-- Strings — low E thickest; bottom in standard mode, top in guitar mode -->
    {#each Array.from({ length: STRING_COUNT }, (_, s) => s) as s}
      <line
        class="string"
        class:sounding={activeStrings.has(s)}
        x1="4" y1={stringY(s)}
        x2={BOARD_W - 4} y2={stringY(s)}
        stroke-width={2.6 - s * 0.5}
      />
      <text class="open-name" x={mirrored ? BOARD_W - OPEN_X + 10 : OPEN_X - 10} y={stringY(s) - 8}>{OPEN_NAMES[s]}</text>
    {/each}

    <!-- Playable positions -->
    {#each positions as pos (pos.string * 100 + pos.fret)}
      {@const isActive = activePosSet.has(`${pos.string}:${pos.fret}`)}
      {#if isActive}
        <circle class="pos-glow" cx={pos.cx} cy={pos.cy} r="12" />
      {/if}
      <circle class="pos" class:active={isActive} class:open={pos.fret === 0} cx={pos.cx} cy={pos.cy} r={isActive ? 10 : 8} />
      <text class="pos-label" class:active={isActive} x={pos.cx} y={pos.cy + 0.5}>
        {isActive ? pos.noteName : pos.keyLabel}
      </text>
    {/each}
  </svg>

  <div class="bottom-bar">
    <div class="chord-display">
      {#if intervalDisplay}<span class="interval-text-inline">{intervalDisplay}</span>{/if}
      {#if chordName}<span class="chord-name">{chordName}</span>{:else if !intervalDisplay}<span class="chord-hint">play your keyboard</span>{/if}
    </div>
    <div class="controls-group">
      <Knob value={octave} min={1} max={5} label="OCT" onChange={setOctave} />
      <Knob value={velocity} min={0} max={1} label="VEL" onChange={setVelocity} />
    </div>
    <button
      class="dir-btn"
      class:gtr={mirrored}
      onclick={toggleMirror}
      title={mirrored
        ? 'Guitar direction: low E on the number row, open strings on = ] \' / — click for standard'
        : 'Standard direction: low E on the Z-row, open strings on Z A Q 1 — click for guitar'}
    >
      {mirrored ? '◄ GTR' : 'STD ►'}
    </button>
    <div class="ports-group">
      <PortJack id="cv_out" type="control" direction="output" label="CV" connected={connectedPorts.has('cv_out')} onConnect={() => handlePortConnect('cv_out')} {moduleId} />
      <PortJack id="gate_out" type="control" direction="output" label="GATE" connected={connectedPorts.has('gate_out')} onConnect={() => handlePortConnect('gate_out')} {moduleId} />
      <PortJack id="note_data" type="spore" direction="output" label="SPORE" connected={connectedPorts.has('note_data')} onConnect={() => handlePortConnect('note_data')} {moduleId} />
    </div>
  </div>
</ModulePanel>

<style>
  .board {
    width: 100%;
    flex: 1;
    min-height: 0;
    cursor: pointer;
    display: block;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }

  .fret-line {
    stroke: var(--port-stroke, #5a4a3a);
    stroke-width: 1;
    opacity: 0.6;
  }

  .nut {
    stroke: var(--label-color, #a89880);
    stroke-width: 3;
    opacity: 0.8;
  }

  .inlay {
    fill: var(--label-color, #a89880);
    opacity: 0.25;
  }

  .string {
    stroke: var(--label-color, #a89880);
    opacity: 0.55;
    transition: opacity 0.08s;
  }
  .string.sounding {
    stroke: var(--knob-indicator, #7fba5c);
    opacity: 0.95;
  }

  .open-name {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 7px;
    fill: var(--label-color, #a89880);
    opacity: 0.5;
    text-anchor: middle;
    pointer-events: none;
    user-select: none;
  }

  .pos {
    fill: rgba(26, 18, 16, 0.75);
    stroke: var(--port-stroke, #5a4a3a);
    stroke-width: 1;
  }
  .pos.open {
    stroke-dasharray: 2 2;
  }
  .pos.active {
    fill: var(--knob-indicator, #7fba5c);
    stroke: none;
  }

  .pos-glow {
    fill: none;
    stroke: var(--knob-indicator, #7fba5c);
    stroke-width: 2;
    opacity: 0.45;
  }

  .pos-label {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 7px;
    font-weight: 700;
    fill: var(--label-color, #a89880);
    text-anchor: middle;
    dominant-baseline: middle;
    pointer-events: none;
    user-select: none;
  }
  .pos-label.active {
    fill: #0a0d0a;
    font-size: 8px;
  }

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
  .interval-text-inline {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 9px;
    color: var(--label-color, #a89880);
    letter-spacing: 0.04em;
    margin-right: 6px;
  }
  .controls-group { display: flex; gap: 8px; }
  .ports-group { display: flex; gap: 6px; margin-left: auto; }

  .dir-btn {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 8px;
    color: var(--label-color, #a89880);
    background: rgba(26, 18, 16, 0.6);
    border: 1px solid var(--port-stroke, #5a4a3a);
    border-radius: var(--control-radius, 2px);
    padding: 3px 6px;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    flex-shrink: 0;
    transition: border-color 0.1s, color 0.1s;
  }
  .dir-btn.gtr {
    color: var(--spore-glow, #b490ff);
    border-color: var(--spore-glow, #b490ff);
    background: rgba(180, 144, 255, 0.08);
  }
  .dir-btn:hover:not(.gtr) {
    border-color: var(--label-color, #a89880);
  }
</style>
