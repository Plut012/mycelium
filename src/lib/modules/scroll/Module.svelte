<script lang="ts">
  import { Knob, ModulePanel, PortJack } from '$lib/ui';
  import type { ScrollEngine } from './engine.js';
  import type { ScrollSong } from './types.js';

  type Props = {
    engine: ScrollEngine;
    connectedPorts?: Set<string>;
    onPortConnect?: (portId: string) => void;
    moduleId?: string;
  };

  let { engine, connectedPorts = new Set(), onPortConnect, moduleId }: Props = $props();

  let tempo = $state(120);
  let transpose = $state(0);
  let looping = $state(true);
  let playing = $state(false);
  let selectedIndex = $state(0);
  let songs = $state<ScrollSong[]>([]);
  let activeNotes = $state<number[]>([]);
  let playbackPos = $state(0);
  let dragging = $state(false);

  // Pitch class names for the activity display
  const PITCH_CLASSES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  // Sync UI state from engine
  function syncState() {
    playing = engine.isPlaying();
    selectedIndex = engine.getSelectedIndex();
    songs = engine.getSongList();
  }

  // Poll playback state for display
  let animFrame = 0;
  function poll() {
    if (engine.isPlaying()) {
      activeNotes = engine.getCurrentNotes();
      playbackPos = engine.getPlaybackPosition();
    }
    animFrame = requestAnimationFrame(poll);
  }

  $effect(() => {
    engine.setStateChangeCallback(syncState);
    syncState();
    animFrame = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animFrame);
  });

  function setTempo(v: number) {
    tempo = v;
    engine.setParameter('tempo', v);
  }

  function setTranspose(v: number) {
    transpose = Math.round(v);
    engine.setParameter('transpose', transpose);
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

  // Drag-and-drop MIDI import
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
    if (!file || !file.name.match(/\.midi?$/i)) return;
    const buffer = await file.arrayBuffer();
    await engine.importMidi(buffer, file.name);
    syncState();
  }

  // Check if a pitch class is active
  function isPitchActive(pitchClass: number): boolean {
    return activeNotes.some(n => n % 12 === pitchClass);
  }
</script>

<div
  class="scroll-drop-zone"
  class:dragging
  role="region"
  aria-label="Scroll module — drop MIDI files here"
  ondragover={onDragOver}
  ondragleave={onDragLeave}
  ondrop={onDrop}
>
  <ModulePanel title="Scroll" gridWidth={3} gridHeight={6}>
    <!-- Song list -->
    <div class="song-list">
      {#each songs as song, i}
        <button
          class="song-entry"
          class:selected={i === selectedIndex}
          onclick={() => engine.selectSong(i)}
        >
          <span class="song-title">{song.title}</span>
          <span class="song-artist">{song.artist}</span>
        </button>
      {/each}
      {#if songs.length === 0}
        <div class="song-empty">NO SONGS</div>
      {/if}
    </div>

    <!-- Progress bar -->
    <div class="progress-bar">
      <div class="progress-fill" style="width: {playbackPos * 100}%"></div>
    </div>

    <!-- Note activity: 12 pitch class cells -->
    <div class="note-activity">
      {#each PITCH_CLASSES as pc, i}
        <div
          class="pitch-cell"
          class:active={isPitchActive(i)}
          class:accidental={pc.includes('#')}
        >
          {pc.replace('#', '#')}
        </div>
      {/each}
    </div>

    <!-- Transport controls -->
    <div class="transport">
      <button class="transport-btn" onclick={() => engine.prevSong()} title="Previous">|&#9664;</button>
      <button class="transport-btn play-btn" class:active={playing} onclick={togglePlay} title={playing ? 'Stop' : 'Play'}>
        {playing ? '&#9632;' : '&#9654;'}
      </button>
      <button class="transport-btn" onclick={() => engine.nextSong()} title="Next">&#9654;|</button>
      <button class="transport-btn" class:active={looping} onclick={toggleLoop} title="Loop">&#8634;</button>
    </div>

    <!-- Knobs -->
    <div class="knobs-row">
      <Knob value={tempo} min={40} max={240} label="BPM" unit="bpm" onChange={setTempo} />
      <Knob value={transpose} min={-24} max={24} label="TRANS" onChange={setTranspose} />
    </div>

    <!-- Ports -->
    <div class="ports">
      <PortJack id="cv_out" label="CV" direction="output" type="control" connected={connectedPorts.has('cv_out')} onConnect={handlePortConnect} {moduleId} />
      <PortJack id="gate_out" label="GATE" direction="output" type="control" connected={connectedPorts.has('gate_out')} onConnect={handlePortConnect} {moduleId} />
      <PortJack id="clock_out" label="CLK" direction="output" type="control" connected={connectedPorts.has('clock_out')} onConnect={handlePortConnect} {moduleId} />
      <PortJack id="note_data" label="SPORE" direction="output" type="spore" connected={connectedPorts.has('note_data')} onConnect={handlePortConnect} {moduleId} />
    </div>
  </ModulePanel>
</div>

<style>
  .scroll-drop-zone {
    display: contents;
  }

  .scroll-drop-zone.dragging :global(.module-panel) {
    outline: 2px solid var(--knob-indicator, #7fba5c);
    outline-offset: -2px;
  }

  /* Song list */
  .song-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    max-height: 72px;
    overflow-y: auto;
    overflow-x: hidden;
    width: 100%;
    padding: 0 4px;
    scrollbar-width: thin;
    scrollbar-color: var(--panel-border, #5a4a3a) transparent;
  }

  .song-entry {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 4px;
    padding: 2px 4px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 2px;
    cursor: pointer;
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 8px;
    letter-spacing: 0.03em;
    color: var(--label-color, #a89880);
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    transition: border-color 0.12s, color 0.12s, background 0.12s;
  }

  .song-entry:hover {
    border-color: var(--panel-border, #5a4a3a);
  }

  .song-entry.selected {
    color: var(--knob-indicator, #7fba5c);
    border-color: var(--knob-indicator, #7fba5c);
    background: rgba(127, 186, 92, 0.06);
    text-shadow: 0 0 6px var(--knob-indicator, #7fba5c);
  }

  .song-title {
    overflow: hidden;
    text-overflow: ellipsis;
    text-transform: uppercase;
  }

  .song-artist {
    font-size: 7px;
    opacity: 0.5;
    flex-shrink: 0;
  }

  .song-empty {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 8px;
    color: var(--label-color, #a89880);
    text-align: center;
    opacity: 0.4;
    padding: 8px;
  }

  /* Progress bar */
  .progress-bar {
    width: calc(100% - 8px);
    height: 3px;
    background: var(--port-fill, #1a1210);
    border-radius: 1.5px;
    margin: 2px 4px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--knob-indicator, #7fba5c);
    border-radius: 1.5px;
    transition: width 0.05s linear;
    box-shadow: 0 0 4px var(--knob-indicator, #7fba5c);
  }

  /* Note activity */
  .note-activity {
    display: flex;
    gap: 1px;
    justify-content: center;
    padding: 2px 4px;
    width: 100%;
  }

  .pitch-cell {
    width: 12px;
    height: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 6px;
    color: var(--label-color, #a89880);
    background: var(--port-fill, #1a1210);
    border: 1px solid var(--panel-border, #5a4a3a);
    border-radius: 1px;
    transition: background 0.08s, color 0.08s, box-shadow 0.08s;
  }

  .pitch-cell.accidental {
    opacity: 0.7;
  }

  .pitch-cell.active {
    color: var(--knob-indicator, #7fba5c);
    background: rgba(127, 186, 92, 0.15);
    box-shadow: 0 0 4px var(--knob-indicator, #7fba5c);
    opacity: 1;
  }

  /* Transport */
  .transport {
    display: flex;
    gap: 4px;
    justify-content: center;
    padding: 2px 4px;
  }

  .transport-btn {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 10px;
    color: var(--label-color, #a89880);
    background: var(--port-fill, #1a1210);
    border: 1px solid var(--panel-border, #5a4a3a);
    border-radius: 3px;
    padding: 3px 6px;
    cursor: pointer;
    min-width: 28px;
    min-height: 24px;
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
    font-size: 12px;
    min-width: 32px;
  }

  /* Knobs */
  .knobs-row {
    display: flex;
    gap: 12px;
    justify-content: center;
  }

  /* Ports */
  .ports {
    display: flex;
    gap: 6px;
    justify-content: center;
    flex-wrap: wrap;
    width: 100%;
    padding: 0 4px;
  }
</style>
