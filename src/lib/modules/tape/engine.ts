/**
 * Tape engine — audio file player with waveform peaks and playhead tracking.
 *
 * Audio graph: AudioBufferSourceNode → GainNode → AnalyserNode → [output]
 *
 * AudioBufferSourceNode is one-shot — a new one is created each time
 * playback starts or the user seeks. This is standard Web Audio practice.
 * Playhead position is tracked manually from ctx.currentTime.
 */

import { ModuleEngine } from '$lib/engine/Module.js';
import { computePeaks } from './waveform.js';
import type { TapeTrack } from './tracks.js';
import { BUILT_IN_TRACKS } from './tracks.js';
import { loadAllUserTracks, loadTrackData, saveTrack, type StoredTrack } from './tape-store.js';

const WAVEFORM_BUCKETS = 540;

export class TapeEngine extends ModuleEngine {
  private ctx: AudioContext | null = null;

  // Audio nodes
  private gainNode: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;

  // Track library
  private tracks: TapeTrack[] = [...BUILT_IN_TRACKS];
  private selectedIndex = 0;
  private userTracksLoaded = false;

  // Audio data
  private audioBuffer: AudioBuffer | null = null;
  private peaks: Float32Array | null = null;
  private loading = false;
  private loadProgress = 0;

  // Playback state
  private playing = false;
  private looping = true;
  private volume = 0.8;
  private speed = 1.0;
  private startTime = 0;     // ctx.currentTime when playback began
  private startOffset = 0;   // offset in seconds into the buffer

  // UI callback
  private onStateChange: (() => void) | null = null;

  create(ctx: AudioContext): void {
    this.ctx = ctx;

    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = this.volume;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.4;

    this.gainNode.connect(this.analyser);

    this.registerOutputNode('audio_out', this.analyser);

    this.loadUserTracks();
  }

  destroy(): void {
    this.stop();
    if (this.gainNode) { this.gainNode.disconnect(); this.gainNode = null; }
    if (this.analyser) { this.analyser.disconnect(); this.analyser = null; }
    this.ctx = null;
    this.inputNodes.clear();
    this.outputNodes.clear();
  }

  setParameter(name: string, value: number | string): void {
    switch (name) {
      case 'volume':
        this.volume = value as number;
        if (this.gainNode && this.ctx) {
          this.gainNode.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
        }
        break;
      case 'speed': {
        const newSpeed = value as number;
        // Snapshot current position before changing speed
        if (this.playing && this.ctx) {
          this.startOffset = this.getCurrentOffset();
          this.startTime = this.ctx.currentTime;
          if (this.sourceNode) {
            this.sourceNode.playbackRate.value = newSpeed;
          }
        }
        this.speed = newSpeed;
        break;
      }
      case 'loop':
        this.looping = value === 1;
        if (this.sourceNode) {
          this.sourceNode.loop = this.looping;
        }
        break;
    }
  }

  getAnalyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  play(): void {
    if (this.playing || !this.ctx || !this.audioBuffer || !this.gainNode) return;
    this.startPlayback(this.startOffset);
  }

  stop(): void {
    if (this.sourceNode) {
      try { this.sourceNode.stop(); } catch { /* already stopped */ }
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.playing && this.ctx) {
      // Remember position for resume
      this.startOffset = this.getCurrentOffset();
    }
    this.playing = false;
    this.notifyStateChange();
  }

  seek(normalizedPos: number): void {
    if (!this.audioBuffer) return;
    const offset = normalizedPos * this.audioBuffer.duration;
    if (this.playing) {
      // Restart playback at new position
      if (this.sourceNode) {
        try { this.sourceNode.stop(); } catch { /* ok */ }
        this.sourceNode.disconnect();
        this.sourceNode = null;
      }
      this.startPlayback(offset);
    } else {
      this.startOffset = offset;
      this.notifyStateChange();
    }
  }

  selectTrack(index: number): void {
    if (index < 0 || index >= this.tracks.length) return;
    const wasPlaying = this.playing;
    this.stop();
    this.startOffset = 0;
    this.selectedIndex = index;
    this.audioBuffer = null;
    this.peaks = null;
    this.notifyStateChange();
    this.loadSelectedTrack().then(() => {
      if (wasPlaying) this.play();
    });
  }

  nextTrack(): void {
    this.selectTrack((this.selectedIndex + 1) % this.tracks.length);
  }

  prevTrack(): void {
    this.selectTrack((this.selectedIndex - 1 + this.tracks.length) % this.tracks.length);
  }

  async importAudio(arrayBuffer: ArrayBuffer, filename: string): Promise<void> {
    if (!this.ctx) return;

    const title = filename.replace(/\.(mp3|wav|ogg|flac|m4a)$/i, '');
    const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ext = filename.split('.').pop()?.toLowerCase() ?? 'mp3';
    const mimeMap: Record<string, string> = {
      mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
      flac: 'audio/flac', m4a: 'audio/mp4',
    };

    // Save to IndexedDB
    await saveTrack({
      id,
      title,
      artist: 'Imported',
      data: arrayBuffer,
      mimeType: mimeMap[ext] ?? 'audio/mpeg',
    });

    // Add to track list
    this.tracks.push({
      id,
      title,
      artist: 'Imported',
      url: '',
      builtIn: false,
    });

    // Decode and select
    this.selectedIndex = this.tracks.length - 1;
    this.audioBuffer = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
    this.peaks = computePeaks(this.audioBuffer, WAVEFORM_BUCKETS);
    this.startOffset = 0;
    this.notifyStateChange();
  }

  /**
   * Load an audio file from a local dev-server path (e.g., 'music/Artist/track.flac').
   * Used by the library browser in dev mode.
   */
  async loadFromPath(path: string, displayTitle: string): Promise<void> {
    if (!this.ctx) return;

    const wasPlaying = this.playing;
    this.stop();

    this.loading = true;
    this.loadProgress = 0;
    this.notifyStateChange();

    try {
      // Fetch from Vite dev server (path is relative to project root)
      const response = await fetch(`/${path}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const arrayBuffer = await response.arrayBuffer();
      this.audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.peaks = computePeaks(this.audioBuffer, WAVEFORM_BUCKETS);

      // Add to track list if not already there
      const existingIdx = this.tracks.findIndex(t => t.url === path);
      if (existingIdx >= 0) {
        this.selectedIndex = existingIdx;
      } else {
        const parts = displayTitle.split(' - ');
        this.tracks.push({
          id: `local-${Date.now()}`,
          title: parts.length > 1 ? parts[1] : displayTitle,
          artist: parts.length > 1 ? parts[0] : 'Library',
          url: path,
          builtIn: false,
        });
        this.selectedIndex = this.tracks.length - 1;
      }

      this.startOffset = 0;
      this.loadProgress = 1;
      if (wasPlaying) this.play();
    } catch (e) {
      console.warn('Tape: failed to load from path:', e);
      this.audioBuffer = null;
      this.peaks = null;
    } finally {
      this.loading = false;
      this.notifyStateChange();
    }
  }

  getPlaybackPosition(): number {
    if (!this.audioBuffer) return 0;
    const duration = this.audioBuffer.duration;
    if (duration === 0) return 0;

    if (!this.playing) {
      return Math.min(1, this.startOffset / duration);
    }

    const offset = this.getCurrentOffset();
    if (this.looping) {
      return (offset % duration) / duration;
    }
    return Math.min(1, offset / duration);
  }

  getPeaks(): Float32Array | null {
    return this.peaks;
  }

  getDuration(): number {
    return this.audioBuffer?.duration ?? 0;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  isLoading(): boolean {
    return this.loading;
  }

  getLoadProgress(): number {
    return this.loadProgress;
  }

  getTrackList(): TapeTrack[] {
    return this.tracks;
  }

  getSelectedIndex(): number {
    return this.selectedIndex;
  }

  setStateChangeCallback(cb: () => void): void {
    this.onStateChange = cb;
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private startPlayback(offset: number): void {
    if (!this.ctx || !this.audioBuffer || !this.gainNode) return;

    const source = this.ctx.createBufferSource();
    source.buffer = this.audioBuffer;
    source.playbackRate.value = this.speed;
    source.loop = this.looping;
    source.connect(this.gainNode);

    // Handle playback end (non-looping)
    source.onended = () => {
      if (!this.looping && this.playing) {
        this.playing = false;
        this.startOffset = 0;
        this.sourceNode = null;
        this.notifyStateChange();
      }
    };

    const clampedOffset = Math.max(0, Math.min(offset, this.audioBuffer.duration - 0.01));
    source.start(0, clampedOffset);

    this.sourceNode = source;
    this.startTime = this.ctx.currentTime;
    this.startOffset = clampedOffset;
    this.playing = true;
    this.notifyStateChange();
  }

  private getCurrentOffset(): number {
    if (!this.ctx) return this.startOffset;
    const elapsed = (this.ctx.currentTime - this.startTime) * this.speed;
    return this.startOffset + elapsed;
  }

  private async loadSelectedTrack(): Promise<void> {
    if (!this.ctx) return;
    const track = this.tracks[this.selectedIndex];
    if (!track) return;

    this.loading = true;
    this.loadProgress = 0;
    this.notifyStateChange();

    try {
      let arrayBuffer: ArrayBuffer;

      if (track.builtIn) {
        // Fetch from URL
        const response = await fetch(track.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;

        if (total > 0 && response.body) {
          // Stream with progress
          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let received = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;
            this.loadProgress = received / total;
            this.notifyStateChange();
          }

          arrayBuffer = new Uint8Array(received).buffer;
          let offset = 0;
          const merged = new Uint8Array(arrayBuffer);
          for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
          }
          arrayBuffer = merged.buffer;
        } else {
          arrayBuffer = await response.arrayBuffer();
        }
      } else {
        // Load from IndexedDB
        const stored = await loadTrackData(track.id);
        if (!stored) throw new Error('Track not found in storage');
        arrayBuffer = stored.data;
      }

      this.audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.peaks = computePeaks(this.audioBuffer, WAVEFORM_BUCKETS);
      this.loadProgress = 1;
    } catch (e) {
      console.warn('Tape: failed to load track:', e);
      this.audioBuffer = null;
      this.peaks = null;
    } finally {
      this.loading = false;
      this.notifyStateChange();
    }
  }

  private async loadUserTracks(): Promise<void> {
    if (this.userTracksLoaded) return;
    try {
      const stored = await loadAllUserTracks();
      for (const s of stored) {
        this.tracks.push({
          id: s.id,
          title: s.title,
          artist: s.artist,
          url: '',
          builtIn: false,
        });
      }
      this.userTracksLoaded = true;
      this.notifyStateChange();
    } catch {
      // IndexedDB may not be available
    }
  }

  private notifyStateChange(): void {
    this.onStateChange?.();
  }
}
