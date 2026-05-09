/**
 * Data types for the Scroll (jukebox) module.
 */

export interface ScrollNote {
  /** Absolute tick position within the song */
  tick: number;
  /** MIDI note number (0-127) */
  midi: number;
  /** Duration in ticks */
  duration: number;
  /** Velocity normalized to 0-1 */
  velocity: number;
}

export interface ScrollSong {
  id: string;
  title: string;
  artist: string;
  /** Pulses per quarter note (from MIDI header) */
  ticksPerBeat: number;
  /** All notes sorted by tick */
  notes: ScrollNote[];
  /** Total song length in ticks */
  durationTicks: number;
  /** True for bundled songs, false for user-imported */
  builtIn: boolean;
}
