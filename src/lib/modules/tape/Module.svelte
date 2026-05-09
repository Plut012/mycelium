<script lang="ts">
  import { Knob, ModulePanel, PortJack } from '$lib/ui';
  import type { TapeEngine } from './engine.js';
  import type { TapeTrack } from './tracks.js';

  type Props = {
    engine: TapeEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  let volume = $state(0.8);
  let speed = $state(1.0);
  let looping = $state(true);
  let playing = $state(false);
  let selectedIndex = $state(0);
  let tracks = $state<TapeTrack[]>([]);
  let peaks = $state<Float32Array | null>(null);
  let playbackPos = $state(0);
  let loading = $state(false);
  let loadProgress = $state(0);
  let dragging = $state(false);

  let waveformCanvas: HTMLCanvasElement | undefined = $state();
  const CANVAS_WIDTH = 540;
  const CANVAS_HEIGHT = 55;

  // Sync UI state from engine
  function syncState() {
    playing = engine.isPlaying();
    selectedIndex = engine.getSelectedIndex();
    tracks = engine.getTrackList();
    peaks = engine.getPeaks();
    loading = engine.isLoading();
    loadProgress = engine.getLoadProgress();
  }

  // Poll playback position + render waveform
  let animFrame = 0;
  function poll() {
    if (engine.isPlaying()) {
      playbackPos = engine.getPlaybackPosition();
    }
    drawWaveform();
    animFrame = requestAnimationFrame(poll);
  }

  $effect(() => {
    engine.setStateChangeCallback(syncState);
    syncState();
    animFrame = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animFrame);
  });

  // Waveform rendering
  function drawWaveform() {
    if (!waveformCanvas) return;
    const ctx = waveformCanvas.getContext('2d');
    if (!ctx) return;

    const w = CANVAS_WIDTH;
    const h = CANVAS_HEIGHT;
    const mid = h / 2;

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, w, h);

    // Center line
    ctx.strokeStyle = 'rgba(127, 255, 127, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.stroke();

    const currentPeaks = peaks;
    if (!currentPeaks || currentPeaks.length === 0) {
      // Loading state or no track
      if (loading) {
        ctx.fillStyle = 'rgba(127, 186, 92, 0.3)';
        ctx.fillRect(0, h - 3, w * loadProgress, 3);
        ctx.fillStyle = 'rgba(127, 186, 92, 0.5)';
        ctx.font = '9px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('LOADING...', w / 2, mid + 3);
      } else {
        ctx.fillStyle = 'rgba(168, 152, 128, 0.3)';
        ctx.font = '9px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('DROP AUDIO OR SELECT TRACK', w / 2, mid + 3);
      }
      return;
    }

    const buckets = currentPeaks.length / 2;
    const playX = playbackPos * w;

    // Draw peaks
    for (let i = 0; i < buckets; i++) {
      const min = currentPeaks[i * 2];
      const max = currentPeaks[i * 2 + 1];

      const y1 = mid - max * mid;
      const y2 = mid - min * mid;
      const barHeight = Math.max(1, y2 - y1);

      if (i <= playX) {
        // Played portion — bright green
        ctx.fillStyle = 'rgba(127, 186, 92, 0.85)';
      } else {
        // Unplayed — dim
        ctx.fillStyle = 'rgba(127, 186, 92, 0.25)';
      }

      ctx.fillRect(i, y1, 1, barHeight);
    }

    // Playhead line
    if (playing || playbackPos > 0) {
      ctx.strokeStyle = '#7fff7f';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#7fff7f';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(playX, 0);
      ctx.lineTo(playX, h);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  // Seek on click/touch
  function onWaveformPointerDown(e: PointerEvent) {
    if (!peaks) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pos = Math.max(0, Math.min(1, x / CANVAS_WIDTH));
    engine.seek(pos);
    playbackPos = pos;
  }

  // Controls
  function setVolume(v: number) {
    volume = v;
    engine.setParameter('volume', v);
  }

  function setSpeed(v: number) {
    speed = v;
    engine.setParameter('speed', v);
  }

  function toggleLoop() {
    looping = !looping;
    engine.setParameter('loop', looping ? 1 : 0);
  }

  function togglePlay() {
    if (playing) {
      engine.stop();
    } else {
      engine.play();
    }
    playing = engine.isPlaying();
  }

  function handlePortConnect(portId: string) {
    onPortConnect?.(portId);
  }

  // Drag-and-drop
  function onDragOver(e: DragEvent) {
    e.preventDefault();
    dragging = true;
  }

  function onDragLeave() {
    dragging = false;
  }

  async function onDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    const file = e.dataTransfer?.files[0];
    if (!file || !file.name.match(/\.(mp3|wav|ogg|flac|m4a)$/i)) return;
    const buffer = await file.arrayBuffer();
    await engine.importAudio(buffer, file.name);
    syncState();
  }

  // File picker
  let fileInput: HTMLInputElement | undefined = $state();

  function openFilePicker() {
    fileInput?.click();
  }

  async function onFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !file.name.match(/\.(mp3|wav|ogg|flac|m4a)$/i)) return;
    const buffer = await file.arrayBuffer();
    await engine.importAudio(buffer, file.name);
    syncState();
    input.value = '';
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
</script>

<div
  class="tape-drop-zone"
  class:dragging
  role="region"
  aria-label="Tape module — drop audio files here"
  ondragover={onDragOver}
  ondragleave={onDragLeave}
  ondrop={onDrop}
>
  <input
    bind:this={fileInput}
    type="file"
    accept=".mp3,.wav,.ogg,.flac,.m4a"
    class="hidden-file-input"
    onchange={onFileSelected}
  />

  <ModulePanel title="Tape" gridWidth={10} gridHeight={3}>
    <!-- Track selector strip -->
    <div class="track-strip">
      {#each tracks as track, i}
        <button
          class="track-btn"
          class:selected={i === selectedIndex}
          onclick={() => engine.selectTrack(i)}
        >
          {track.title}
        </button>
      {/each}
      <button class="track-btn import-btn" onclick={openFilePicker} title="Import audio file">+</button>
    </div>

    <!-- Waveform display -->
    <div class="waveform-container">
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <canvas
        bind:this={waveformCanvas}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        class="waveform-canvas"
        class:clickable={!peaks && !loading}
        onclick={!peaks && !loading ? openFilePicker : undefined}
        onpointerdown={peaks ? onWaveformPointerDown : undefined}
      ></canvas>
    </div>

    <!-- Bottom bar: transport + time + knobs + port -->
    <div class="bottom-bar">
      <div class="transport">
        <button class="transport-btn" onclick={() => engine.prevTrack()} title="Previous">|&#9664;</button>
        <button class="transport-btn play-btn" class:active={playing} onclick={togglePlay} title={playing ? 'Stop' : 'Play'}>
          {playing ? '&#9632;' : '&#9654;'}
        </button>
        <button class="transport-btn" onclick={() => engine.nextTrack()} title="Next">&#9654;|</button>
        <button class="transport-btn" class:active={looping} onclick={toggleLoop} title="Loop">&#8634;</button>
      </div>

      <div class="time-display">
        {formatTime(engine.getDuration() * playbackPos)} / {formatTime(engine.getDuration())}
      </div>

      <div class="knobs-row">
        <Knob value={volume} min={0} max={1} label="VOL" onChange={setVolume} />
        <Knob value={speed} min={0.25} max={2} label="SPD" onChange={setSpeed} />
      </div>

      <div class="port-area">
        <PortJack id="audio_out" label="OUT" direction="output" type="audio" connected={connectedPorts.has('audio_out')} onConnect={handlePortConnect} {moduleId} />
      </div>
    </div>
  </ModulePanel>
</div>

<style>
  .tape-drop-zone {
    display: contents;
  }

  .tape-drop-zone.dragging :global(.module-panel) {
    outline: 2px solid var(--knob-indicator, #7fba5c);
    outline-offset: -2px;
  }

  .hidden-file-input {
    display: none;
  }

  /* Track strip */
  .track-strip {
    display: flex;
    gap: 3px;
    padding: 0 6px;
    overflow-x: auto;
    overflow-y: hidden;
    width: 100%;
    scrollbar-width: thin;
    scrollbar-color: var(--panel-border, #5a4a3a) transparent;
  }

  .track-btn {
    flex-shrink: 0;
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 7px;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: var(--label-color, #a89880);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 2px;
    padding: 1px 5px;
    cursor: pointer;
    white-space: nowrap;
    transition: border-color 0.12s, color 0.12s;
  }

  .track-btn:hover {
    border-color: var(--panel-border, #5a4a3a);
  }

  .track-btn.selected {
    color: var(--knob-indicator, #7fba5c);
    border-color: var(--knob-indicator, #7fba5c);
    text-shadow: 0 0 6px var(--knob-indicator, #7fba5c);
  }

  .import-btn {
    font-size: 10px;
    font-weight: bold;
    min-width: 18px;
    padding: 1px 4px;
  }

  .import-btn:hover {
    color: var(--knob-indicator, #7fba5c);
    border-color: var(--knob-indicator, #7fba5c);
  }

  /* Waveform */
  .waveform-container {
    width: 100%;
    padding: 0 6px;
    display: flex;
    justify-content: center;
  }

  .waveform-canvas {
    border-radius: 3px;
    border: 1px solid var(--panel-border, #3a2e24);
    cursor: crosshair;
    width: 100%;
    max-width: 540px;
  }

  .waveform-canvas.clickable {
    cursor: pointer;
    height: 55px;
  }

  /* Bottom bar */
  .bottom-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 6px;
    width: 100%;
  }

  .transport {
    display: flex;
    gap: 3px;
    flex-shrink: 0;
  }

  .transport-btn {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 9px;
    color: var(--label-color, #a89880);
    background: var(--port-fill, #1a1210);
    border: 1px solid var(--panel-border, #5a4a3a);
    border-radius: 3px;
    padding: 2px 5px;
    cursor: pointer;
    min-width: 24px;
    min-height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.12s, color 0.12s, box-shadow 0.12s;
  }

  .transport-btn:hover {
    border-color: var(--knob-indicator, #7fba5c);
    color: var(--knob-indicator, #7fba5c);
  }

  .transport-btn.active {
    border-color: var(--knob-indicator, #7fba5c);
    color: var(--knob-indicator, #7fba5c);
    box-shadow: 0 0 6px var(--knob-indicator, #7fba5c);
    background: rgba(127, 186, 92, 0.08);
  }

  .play-btn {
    font-size: 11px;
    min-width: 28px;
  }

  .time-display {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 8px;
    color: var(--knob-indicator, #7fba5c);
    letter-spacing: 0.05em;
    flex-shrink: 0;
    min-width: 60px;
    text-align: center;
  }

  .knobs-row {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-shrink: 0;
  }

  .port-area {
    margin-left: auto;
    flex-shrink: 0;
  }
</style>
