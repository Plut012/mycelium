<script lang="ts">
  import { ModulePanel, PortJack } from '$lib/ui';
  import type { MonitorEngine } from './engine.js';

  type Props = {
    engine: MonitorEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  function handlePortConnect(portId: string) {
    onPortConnect?.(portId);
  }

  // ── Musical constants ─────────────────────────────────────────────────────

  const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const F_MIN = 65.406;   // C2 — spectrogram bottom
  const OCTAVES = 5;      // C2..C7
  const SPEC_W = 480;     // scrolling history buffer size
  const SPEC_H = 240;

  // ── Reactive display state ────────────────────────────────────────────────

  let chroma = $state<number[]>(new Array(12).fill(0));
  let strongestPc = $state<number | null>(null);
  let level = $state(0);        // 0..1 smoothed RMS
  let peak = $state(0);
  let fifths = $state(false);   // chroma ring arrangement
  let fullscreen = $state(false);

  // Circle position for a pitch class: chromatic circle or circle of fifths
  function pcSlot(pc: number): number {
    return fifths ? (pc * 7) % 12 : pc;
  }

  // ── Canvases ──────────────────────────────────────────────────────────────

  let waveCanvas = $state<HTMLCanvasElement>();
  let specCanvas = $state<HTMLCanvasElement>();
  let fsWaveCanvas = $state<HTMLCanvasElement>();
  let fsSpecCanvas = $state<HTMLCanvasElement>();

  // Persistent scrolling spectrogram history, shared by inline + fullscreen
  let specBuffer: HTMLCanvasElement | null = null;

  let timeData: Uint8Array<ArrayBuffer> | null = null;
  let freqData: Uint8Array<ArrayBuffer> | null = null;

  // ── Color LUT for the spectrogram (black → theme green → warm white) ─────

  let lut: Uint8ClampedArray | null = null;
  let lutColor = '';

  function hexToRgb(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function buildLut(color: string) {
    if (color === lutColor && lut) return;
    lutColor = color;
    let mid: [number, number, number];
    try { mid = hexToRgb(color); } catch { mid = [127, 186, 92]; }
    const hi: [number, number, number] = [240, 232, 216];
    lut = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
      const t = Math.pow(i / 255, 1.4);
      let r: number, g: number, b: number;
      if (t < 0.6) {
        const u = t / 0.6;
        r = mid[0] * u; g = mid[1] * u; b = mid[2] * u;
      } else {
        const u = (t - 0.6) / 0.4;
        r = mid[0] + (hi[0] - mid[0]) * u;
        g = mid[1] + (hi[1] - mid[1]) * u;
        b = mid[2] + (hi[2] - mid[2]) * u;
      }
      lut[i * 3] = r; lut[i * 3 + 1] = g; lut[i * 3 + 2] = b;
    }
  }

  // ── Analysis + drawing loop ───────────────────────────────────────────────

  let animFrame = 0;

  function accentColor(): string {
    if (!waveCanvas) return '#7fba5c';
    const c = getComputedStyle(waveCanvas).getPropertyValue('--knob-indicator').trim();
    return c || '#7fba5c';
  }

  function drawWave(canvas: HTMLCanvasElement, data: Uint8Array, color: string) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(127, 255, 127, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 5;
    ctx.beginPath();
    const step = w / data.length;
    for (let i = 0; i < data.length; i++) {
      const y = (data[i] / 255) * h;
      if (i === 0) ctx.moveTo(0, y);
      else ctx.lineTo(i * step, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function pushSpecColumn(freq: Uint8Array) {
    if (!specBuffer || !lut) return;
    const ctx = specBuffer.getContext('2d');
    if (!ctx) return;

    // Scroll left one pixel
    ctx.drawImage(specBuffer, -1, 0);

    const sr = engine.getSampleRate();
    const binHz = sr / 4096; // analyser fftSize
    const col = ctx.createImageData(1, SPEC_H);
    const px = col.data;

    for (let y = 0; y < SPEC_H; y++) {
      // Log-frequency: bottom row = C2, top row = C7 — equal space per octave
      const f = F_MIN * Math.pow(2, (OCTAVES * (SPEC_H - 1 - y)) / (SPEC_H - 1));
      const bin = Math.min(Math.round(f / binHz), freq.length - 1);
      const v = freq[bin];
      const o = y * 4;
      px[o] = lut[v * 3];
      px[o + 1] = lut[v * 3 + 1];
      px[o + 2] = lut[v * 3 + 2];
      px[o + 3] = 255;
      // Octave gridlines (each C) as faint persistent streaks
      const octPos = ((SPEC_H - 1 - y) / (SPEC_H - 1)) * OCTAVES;
      if (Math.abs(octPos - Math.round(octPos)) < 0.008 && v < 40) {
        px[o] += 26; px[o + 1] += 26; px[o + 2] += 22;
      }
    }
    ctx.putImageData(col, SPEC_W - 1, 0);
  }

  function blitSpec(canvas: HTMLCanvasElement) {
    if (!specBuffer) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(specBuffer, 0, 0, canvas.width, canvas.height);
  }

  function analyse() {
    const analyser = engine.getAnalyserNode();
    if (!analyser) {
      animFrame = requestAnimationFrame(analyse);
      return;
    }

    if (!timeData || timeData.length !== analyser.fftSize) timeData = new Uint8Array(analyser.fftSize);
    if (!freqData || freqData.length !== analyser.frequencyBinCount) freqData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(timeData);
    analyser.getByteFrequencyData(freqData);

    const color = accentColor();
    buildLut(color);

    // Waveform — display a slice for readability
    const slice = timeData.subarray(0, 1024);
    if (waveCanvas && !fullscreen) drawWave(waveCanvas, slice, color);
    if (fsWaveCanvas && fullscreen) drawWave(fsWaveCanvas, slice, color);

    // Spectrogram
    pushSpecColumn(freqData);
    if (specCanvas && !fullscreen) blitSpec(specCanvas);
    if (fsSpecCanvas && fullscreen) blitSpec(fsSpecCanvas);

    // Chroma — fold spectrum into 12 pitch classes
    const sr = engine.getSampleRate();
    const binHz = sr / 4096;
    const energy = new Array(12).fill(0);
    const loBin = Math.ceil(F_MIN / binHz);
    const hiBin = Math.min(Math.floor(5000 / binHz), freqData.length - 1);
    for (let b = loBin; b <= hiBin; b++) {
      const m = freqData[b] / 255;
      if (m < 0.08) continue;
      const midi = Math.round(12 * Math.log2((b * binHz) / 440) + 69);
      energy[((midi % 12) + 12) % 12] += m * m;
    }
    const maxE = Math.max(...energy);
    const next = chroma.map((prev, i) => {
      const target = maxE > 0.001 ? energy[i] / maxE : 0;
      return Math.max(target, prev * 0.88);
    });
    chroma = next;
    strongestPc = maxE > 0.02 ? energy.indexOf(maxE) : null;

    // Level meter — RMS with slow decay + peak hold
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) {
      const v = (timeData[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / timeData.length);
    level = Math.max(rms, level * 0.92);
    peak = Math.max(level, peak * 0.996);

    animFrame = requestAnimationFrame(analyse);
  }

  $effect(() => {
    specBuffer = document.createElement('canvas');
    specBuffer.width = SPEC_W;
    specBuffer.height = SPEC_H;
    const ctx = specBuffer.getContext('2d');
    if (ctx) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SPEC_W, SPEC_H); }

    animFrame = requestAnimationFrame(analyse);
    return () => cancelAnimationFrame(animFrame);
  });

  // ── Fullscreen ────────────────────────────────────────────────────────────

  let fullscreenEl = $state<HTMLDivElement>();

  async function openFullscreen() {
    fullscreen = true;
    await new Promise((r) => requestAnimationFrame(r));
    if (fullscreenEl) {
      try { await fullscreenEl.requestFullscreen(); }
      catch { /* Fullscreen API not supported — fixed overlay still works */ }
    }
  }

  function closeFullscreen() {
    fullscreen = false;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  $effect(() => {
    function onFsChange() {
      if (!document.fullscreenElement && fullscreen) fullscreen = false;
    }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  });

  // ── Chroma ring geometry ──────────────────────────────────────────────────

  function ringArc(slot: number, r: number): string {
    const a0 = (slot / 12) * Math.PI * 2 - Math.PI / 2 - Math.PI / 12 + 0.045;
    const a1 = (slot / 12) * Math.PI * 2 - Math.PI / 2 + Math.PI / 12 - 0.045;
    const x0 = 100 + r * Math.cos(a0), y0 = 100 + r * Math.sin(a0);
    const x1 = 100 + r * Math.cos(a1), y1 = 100 + r * Math.sin(a1);
    return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }

  function labelPos(slot: number, r: number): { x: number; y: number } {
    const a = (slot / 12) * Math.PI * 2 - Math.PI / 2;
    return { x: 100 + r * Math.cos(a), y: 100 + r * Math.sin(a) };
  }

  const levelDb = $derived(level > 0 ? Math.max(-48, 20 * Math.log10(level)) : -48);
  const peakDb = $derived(peak > 0 ? Math.max(-48, 20 * Math.log10(peak)) : -48);
</script>

{#snippet chromaRing()}
  <svg class="chroma" viewBox="0 0 200 200" role="img" aria-label="Chroma ring — energy per pitch class">
    {#each Array.from({ length: 12 }, (_, pc) => pc) as pc}
      {@const slot = pcSlot(pc)}
      {@const v = chroma[pc]}
      {@const lp = labelPos(slot, 88)}
      <path
        class="chroma-arc"
        class:lit={v > 0.06}
        d={ringArc(slot, 66)}
        style:stroke-opacity={0.12 + v * 0.88}
        style:stroke-width={10 + v * 8}
      />
      <text class="chroma-label" class:lit={v > 0.3} x={lp.x} y={lp.y + 3}>{NOTE_NAMES[pc]}</text>
    {/each}
    <text class="chroma-center" x="100" y="106">
      {strongestPc !== null ? NOTE_NAMES[strongestPc] : '·'}
    </text>
  </svg>
{/snippet}

{#snippet meter()}
  <div class="meter">
    <div class="meter-track">
      <div class="meter-fill" style:height="{((levelDb + 48) / 48) * 100}%"></div>
      <div class="meter-peak" style:bottom="{((peakDb + 48) / 48) * 100}%"></div>
    </div>
    <span class="meter-label">{levelDb <= -47.5 ? '-∞' : levelDb.toFixed(0)}dB</span>
  </div>
{/snippet}

{#snippet octaveLabels()}
  <div class="oct-labels">
    {#each [7, 6, 5, 4, 3, 2] as oct, i}
      <span style:top="{(i / 5) * 100}%">C{oct}</span>
    {/each}
  </div>
{/snippet}

<ModulePanel title="Monitor" gridWidth={5} gridHeight={6}>
  {#if !fullscreen}
    <canvas class="wave" bind:this={waveCanvas} width="330" height="64"></canvas>

    <div class="spec-wrap">
      <canvas class="spec" bind:this={specCanvas} width="330" height="150"></canvas>
      {@render octaveLabels()}
    </div>

    <div class="analysis-row">
      {@render chromaRing()}
      <div class="side-col">
        {@render meter()}
        <button class="mode-btn" class:on={fifths} onclick={() => (fifths = !fifths)} title="Arrange the chroma circle chromatically or by fifths">
          5THS
        </button>
        <button class="full-btn" onclick={openFullscreen} title="Open fullscreen visuals">FULL</button>
      </div>
    </div>
  {:else}
    <div class="placeholder">visuals are fullscreen</div>
  {/if}

  <div class="ports-row">
    <PortJack id="audio_in" type="audio" direction="input" label="IN" connected={connectedPorts.has('audio_in')} onConnect={() => handlePortConnect('audio_in')} {moduleId} />
    <PortJack id="audio_out" type="audio" direction="output" label="THRU" connected={connectedPorts.has('audio_out')} onConnect={() => handlePortConnect('audio_out')} {moduleId} />
  </div>
</ModulePanel>

{#if fullscreen}
  <div class="fs-overlay" bind:this={fullscreenEl}>
    <div class="fs-left">
      <canvas class="fs-wave" bind:this={fsWaveCanvas} width="1400" height="260"></canvas>
      <div class="fs-spec-wrap">
        <canvas class="fs-spec" bind:this={fsSpecCanvas} width="1400" height="620"></canvas>
        {@render octaveLabels()}
      </div>
    </div>
    <div class="fs-right">
      {@render chromaRing()}
      <div class="fs-meter-row">
        {@render meter()}
        <button class="mode-btn" class:on={fifths} onclick={() => (fifths = !fifths)}>5THS</button>
      </div>
      <button class="fs-close" onclick={closeFullscreen}>EXIT</button>
    </div>
  </div>
{/if}

<style>
  .wave {
    width: 100%;
    height: 64px;
    border-radius: var(--control-radius, 3px);
    border: 1px solid var(--panel-border-color, #3a2e24);
    background: #000;
    flex-shrink: 0;
  }

  .spec-wrap {
    position: relative;
    width: 100%;
    flex: 1;
    min-height: 0;
  }

  .spec {
    width: 100%;
    height: 100%;
    border-radius: var(--control-radius, 3px);
    border: 1px solid var(--panel-border-color, #3a2e24);
    background: #000;
    display: block;
  }

  .oct-labels {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .oct-labels span {
    position: absolute;
    left: 3px;
    transform: translateY(-1px);
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 7px;
    color: var(--label-color, #a89880);
    opacity: 0.55;
    letter-spacing: 0.06em;
  }

  .analysis-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    flex-shrink: 0;
    height: 130px;
  }

  .chroma {
    height: 100%;
    flex: 1;
    min-width: 0;
  }

  .chroma-arc {
    fill: none;
    stroke: var(--knob-indicator, #7fba5c);
    stroke-linecap: round;
    transition: stroke-width 0.08s;
  }
  .chroma-arc:not(.lit) {
    stroke: var(--port-stroke, #5a4a3a);
  }

  .chroma-label {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 9px;
    fill: var(--label-color, #a89880);
    text-anchor: middle;
    opacity: 0.6;
  }
  .chroma-label.lit {
    fill: var(--knob-indicator, #7fba5c);
    opacity: 1;
  }

  .chroma-center {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 22px;
    font-weight: 700;
    fill: var(--module-title-color, #c8b89a);
    text-anchor: middle;
  }

  .side-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    height: 100%;
    padding: 4px 0;
  }

  .meter {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    flex: 1;
    min-height: 0;
  }

  .meter-track {
    position: relative;
    width: 10px;
    flex: 1;
    min-height: 20px;
    background: rgba(0, 0, 0, 0.7);
    border: 1px solid var(--panel-border-color, #3a2e24);
    border-radius: var(--control-radius, 2px);
    overflow: hidden;
  }

  .meter-fill {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(to top, var(--knob-indicator, #7fba5c) 70%, #e8c860 90%, #e06050);
  }

  .meter-peak {
    position: absolute;
    left: 0;
    right: 0;
    height: 1.5px;
    background: #f0e8d8;
    opacity: 0.9;
  }

  .meter-label {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 7px;
    color: var(--label-color, #a89880);
    opacity: 0.7;
  }

  .mode-btn, .full-btn {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 8px;
    color: var(--label-color, #a89880);
    background: rgba(26, 18, 16, 0.6);
    border: 1px solid var(--port-stroke, #5a4a3a);
    border-radius: var(--control-radius, 2px);
    padding: 3px 7px;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    transition: border-color 0.12s, color 0.12s;
  }
  .mode-btn.on {
    color: var(--spore-glow, #b490ff);
    border-color: var(--spore-glow, #b490ff);
  }
  .full-btn {
    color: var(--knob-indicator, #7fba5c);
    border-color: var(--knob-indicator, #7fba5c);
    background: rgba(127, 186, 92, 0.08);
  }
  .full-btn:hover { background: rgba(127, 186, 92, 0.18); }

  .placeholder {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 9px;
    color: var(--label-color, #a89880);
    opacity: 0.4;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .ports-row {
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding: 0 4px;
    margin-top: auto;
    flex-shrink: 0;
  }

  /* ── Fullscreen overlay ─────────────────────────────────────────────────── */

  .fs-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: #050805;
    display: flex;
    gap: 16px;
    padding: 16px;
  }

  .fs-left {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .fs-wave {
    width: 100%;
    height: 26%;
    border-radius: var(--control-radius, 4px);
    border: 1px solid var(--panel-border-color, #3a2e24);
    background: #000;
  }

  .fs-spec-wrap {
    position: relative;
    width: 100%;
    flex: 1;
    min-height: 0;
  }

  .fs-spec {
    width: 100%;
    height: 100%;
    border-radius: var(--control-radius, 4px);
    border: 1px solid var(--panel-border-color, #3a2e24);
    background: #000;
    display: block;
  }

  .fs-spec-wrap :global(.oct-labels span),
  .fs-spec-wrap .oct-labels span {
    font-size: 11px;
    left: 6px;
  }

  .fs-right {
    width: 300px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .fs-right .chroma {
    width: 100%;
    height: auto;
    flex: 0 0 auto;
  }

  .fs-meter-row {
    display: flex;
    align-items: stretch;
    gap: 16px;
    flex: 1;
    min-height: 0;
    padding: 8px 0;
  }

  .fs-close {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 10px;
    color: var(--label-color, #a89880);
    background: rgba(26, 18, 16, 0.8);
    border: 1px solid var(--port-stroke, #5a4a3a);
    border-radius: var(--control-radius, 4px);
    padding: 8px 16px;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    transition: border-color 0.12s, color 0.12s;
  }
  .fs-close:hover { border-color: var(--label-color, #a89880); color: var(--module-title-color, #c8b89a); }
</style>
