import { ModuleEngine } from '$lib/engine/Module.js';

/**
 * Degree spore — scale degrees with no key attached.
 * The `kind` discriminant lets downstream modules ignore payloads
 * they don't understand (Compass consumes these; NoteSpore consumers skip them).
 */
export interface DegreeSpore {
  kind: 'degree';
  /** Active pads: scale degree 1–7 + octave row 0 (bottom) or 1 (top) */
  active: { degree: number; octave: number }[];
}

/** Stable identity for a pad — "octave:degree" */
export type PadId = `${number}:${number}`;

export function padId(degree: number, octave: number): PadId {
  return `${octave}:${degree}`;
}

/**
 * QWERTY mapping mirrors the 2×7 pad layout:
 * home row a–j = bottom row (degrees I–VII), q–u = top row (octave up).
 */
const KEY_TO_PAD: Record<string, { degree: number; octave: number }> = {
  a: { degree: 1, octave: 0 }, s: { degree: 2, octave: 0 }, d: { degree: 3, octave: 0 },
  f: { degree: 4, octave: 0 }, g: { degree: 5, octave: 0 }, h: { degree: 6, octave: 0 },
  j: { degree: 7, octave: 0 },
  q: { degree: 1, octave: 1 }, w: { degree: 2, octave: 1 }, e: { degree: 3, octave: 1 },
  r: { degree: 4, octave: 1 }, t: { degree: 5, octave: 1 }, y: { degree: 6, octave: 1 },
  u: { degree: 7, octave: 1 },
};

/**
 * Tin Keys engine — emits DegreeSpore data, no AudioNodes at all.
 *
 * Pads can be held by two sources at once (touch + QWERTY), so holds are
 * refcounted: a pad stays active until every source releases it.
 */
export class TinKeysEngine extends ModuleEngine {
  private holds = new Map<PadId, number>();

  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private boundKeyUp: ((e: KeyboardEvent) => void) | null = null;
  private boundBlur: (() => void) | null = null;

  create(_ctx: AudioContext): void {
    this.boundKeyDown = (e) => this.handleKeyDown(e);
    this.boundKeyUp = (e) => this.handleKeyUp(e);
    // Releasing everything on blur guarantees no stuck pads (same guard as Keyboard)
    this.boundBlur = () => this.releaseAll();
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    window.addEventListener('blur', this.boundBlur);
  }

  // ── Pad interaction (called by UI pointer handlers and QWERTY) ───────────

  padOn(degree: number, octave: number): void {
    const id = padId(degree, octave);
    const count = this.holds.get(id) ?? 0;
    this.holds.set(id, count + 1);
    if (count === 0) this.emit();
  }

  padOff(degree: number, octave: number): void {
    const id = padId(degree, octave);
    const count = this.holds.get(id) ?? 0;
    if (count <= 1) {
      this.holds.delete(id);
      if (count === 1) this.emit();
    } else {
      this.holds.set(id, count - 1);
    }
  }

  releaseAll(): void {
    if (this.holds.size === 0) return;
    this.holds.clear();
    this.emit();
  }

  /** Active pad ids, for the UI to highlight pads. */
  getActivePads(): Set<PadId> {
    return new Set(this.holds.keys());
  }

  // ── QWERTY ───────────────────────────────────────────────────────────────

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    const pad = KEY_TO_PAD[e.key.toLowerCase()];
    if (!pad) return;
    e.preventDefault();
    this.padOn(pad.degree, pad.octave);
  }

  private handleKeyUp(e: KeyboardEvent): void {
    const pad = KEY_TO_PAD[e.key.toLowerCase()];
    if (!pad) return;
    this.padOff(pad.degree, pad.octave);
  }

  // ── Spore emission ───────────────────────────────────────────────────────

  private emit(): void {
    const active = [...this.holds.keys()].map((id) => {
      const [octave, degree] = id.split(':').map(Number);
      return { degree, octave };
    });
    const spore: DegreeSpore = { kind: 'degree', active };
    this.emitSpore('degree_out', spore as unknown as Record<string, unknown>);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  setParameter(_name: string, _value: number | string): void {
    // No parameters — all musical configuration lives in Compass
  }

  getAnalyserNode(): AnalyserNode | null {
    return null;
  }

  destroy(): void {
    if (this.boundKeyDown) window.removeEventListener('keydown', this.boundKeyDown);
    if (this.boundKeyUp) window.removeEventListener('keyup', this.boundKeyUp);
    if (this.boundBlur) window.removeEventListener('blur', this.boundBlur);
    this.boundKeyDown = null;
    this.boundKeyUp = null;
    this.boundBlur = null;
    this.holds.clear();
    this.inputNodes.clear();
    this.outputNodes.clear();
  }
}
