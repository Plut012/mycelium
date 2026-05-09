/**
 * Minimal Standard MIDI File parser.
 *
 * Handles Format 0 and Format 1 SMF files. Extracts note-on/off events
 * and merges multi-track files into a single ScrollNote array.
 */

import type { ScrollNote, ScrollSong } from './types.js';

interface RawNote {
  tick: number;
  midi: number;
  velocity: number;
  channel: number;
}

/** Read a variable-length quantity from a DataView at the given offset. */
function readVLQ(view: DataView, offset: number): { value: number; length: number } {
  let value = 0;
  let length = 0;
  let byte: number;
  do {
    byte = view.getUint8(offset + length);
    value = (value << 7) | (byte & 0x7f);
    length++;
  } while (byte & 0x80);
  return { value, length };
}

/** Read a 4-byte ASCII chunk id. */
function readChunkId(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3)
  );
}

interface TrackEvent {
  noteOns: RawNote[];
  noteOffs: RawNote[];
}

/** Parse a single MIDI track chunk into raw note events. */
function parseTrack(view: DataView, start: number, length: number): TrackEvent {
  const noteOns: RawNote[] = [];
  const noteOffs: RawNote[] = [];

  let pos = start;
  const end = start + length;
  let tick = 0;
  let runningStatus = 0;

  while (pos < end) {
    // Delta time
    const dt = readVLQ(view, pos);
    tick += dt.value;
    pos += dt.length;

    if (pos >= end) break;

    let status = view.getUint8(pos);

    // Meta event
    if (status === 0xff) {
      pos++; // skip 0xFF
      if (pos >= end) break;
      const metaType = view.getUint8(pos);
      pos++;
      const metaLen = readVLQ(view, pos);
      pos += metaLen.length;
      // Skip meta event data (we don't need tempo for parsing — applied at playback)
      void metaType;
      pos += metaLen.value;
      continue;
    }

    // SysEx
    if (status === 0xf0 || status === 0xf7) {
      pos++;
      const sysLen = readVLQ(view, pos);
      pos += sysLen.length + sysLen.value;
      continue;
    }

    // Channel message
    if (status & 0x80) {
      runningStatus = status;
      pos++;
    } else {
      // Running status — reuse previous status byte
      status = runningStatus;
    }

    const msgType = status & 0xf0;
    const channel = status & 0x0f;

    if (msgType === 0x90) {
      // Note On
      const note = view.getUint8(pos);
      const vel = view.getUint8(pos + 1);
      pos += 2;
      if (vel === 0) {
        // Note On with velocity 0 = Note Off
        noteOffs.push({ tick, midi: note, velocity: 0, channel });
      } else {
        noteOns.push({ tick, midi: note, velocity: vel / 127, channel });
      }
    } else if (msgType === 0x80) {
      // Note Off
      const note = view.getUint8(pos);
      const vel = view.getUint8(pos + 1);
      pos += 2;
      noteOffs.push({ tick, midi: note, velocity: vel / 127, channel });
    } else if (msgType === 0xc0 || msgType === 0xd0) {
      // Program Change / Channel Pressure — 1 data byte
      pos += 1;
    } else {
      // All other channel messages — 2 data bytes
      pos += 2;
    }
  }

  return { noteOns, noteOffs };
}

/** Match note-ons to note-offs to produce ScrollNote array. */
function matchNotes(noteOns: RawNote[], noteOffs: RawNote[]): ScrollNote[] {
  const notes: ScrollNote[] = [];
  // Track pending note-ons per MIDI pitch
  const pending = new Map<number, RawNote[]>();

  // Sort by tick for processing
  const ons = [...noteOns].sort((a, b) => a.tick - b.tick);
  const offs = [...noteOffs].sort((a, b) => a.tick - b.tick);

  for (const on of ons) {
    const key = on.midi;
    if (!pending.has(key)) pending.set(key, []);
    pending.get(key)!.push(on);
  }

  for (const off of offs) {
    const key = off.midi;
    const queue = pending.get(key);
    if (queue && queue.length > 0) {
      const on = queue.shift()!;
      notes.push({
        tick: on.tick,
        midi: on.midi,
        duration: Math.max(1, off.tick - on.tick),
        velocity: on.velocity,
      });
    }
  }

  // Any unmatched note-ons: give them a default duration of 1 beat
  for (const [, queue] of pending) {
    for (const on of queue) {
      notes.push({
        tick: on.tick,
        midi: on.midi,
        duration: 480, // default 1 beat at 480 PPQ
        velocity: on.velocity,
      });
    }
  }

  return notes.sort((a, b) => a.tick - b.tick);
}

/**
 * Parse a Standard MIDI File buffer into a ScrollSong.
 *
 * @param buffer — Raw ArrayBuffer of the .mid file
 * @param title — Display title (defaults to 'Untitled')
 */
export function parseMidi(buffer: ArrayBuffer, title = 'Untitled'): ScrollSong {
  const view = new DataView(buffer);

  // Header chunk
  const headerChunkId = readChunkId(view, 0);
  if (headerChunkId !== 'MThd') {
    throw new Error('Not a valid MIDI file: missing MThd header');
  }

  const headerLength = view.getUint32(4);
  const format = view.getUint16(8);
  const numTracks = view.getUint16(10);
  const ticksPerBeat = view.getUint16(12);

  if (format > 1) {
    throw new Error(`MIDI format ${format} not supported (only 0 and 1)`);
  }

  // Parse all track chunks
  let offset = 8 + headerLength;
  const allNoteOns: RawNote[] = [];
  const allNoteOffs: RawNote[] = [];

  for (let t = 0; t < numTracks; t++) {
    if (offset + 8 > buffer.byteLength) break;

    const trackChunkId = readChunkId(view, offset);
    const trackLength = view.getUint32(offset + 4);
    offset += 8;

    if (trackChunkId === 'MTrk') {
      const events = parseTrack(view, offset, trackLength);
      allNoteOns.push(...events.noteOns);
      allNoteOffs.push(...events.noteOffs);
    }

    offset += trackLength;
  }

  const notes = matchNotes(allNoteOns, allNoteOffs);
  const durationTicks = notes.length > 0
    ? Math.max(...notes.map(n => n.tick + n.duration))
    : 0;

  return {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    artist: 'Imported',
    ticksPerBeat,
    notes,
    durationTicks,
    builtIn: false,
  };
}
