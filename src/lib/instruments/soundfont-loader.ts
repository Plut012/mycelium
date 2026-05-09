/**
 * Loader for midi-js-soundfonts JS bundles.
 *
 * The gleitz/midi-js-soundfonts repo serves soundfonts as JS files where
 * each note is a base64-encoded data URI:
 *   MIDI.Soundfont.instrument_name = { "A0": "data:audio/ogg;base64,...", ... }
 *
 * This module fetches the JS file, extracts the data URIs, and returns
 * them as SampleMapping arrays that the standard loader can handle.
 */

import type { SampleMapping } from './types.js';

const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function noteNameToMidi(name: string): number {
  const match = name.match(/^([A-G][b#]?)(-?\d)$/);
  if (!match) return -1;
  let note = match[1];
  const octave = parseInt(match[2]);
  // Normalize sharp to flat
  if (note === 'C#') note = 'Db';
  if (note === 'D#') note = 'Eb';
  if (note === 'F#') note = 'Gb';
  if (note === 'G#') note = 'Ab';
  if (note === 'A#') note = 'Bb';
  const noteIndex = NOTE_NAMES.indexOf(note);
  if (noteIndex === -1) return -1;
  return (octave + 1) * 12 + noteIndex;
}

/** Cache of parsed soundfont data: instrument URL -> note->dataURI map */
const soundfontCache = new Map<string, Map<string, string>>();

/**
 * Fetch and parse a midi-js-soundfonts JS file.
 * Returns a Map of note name -> data URI.
 */
async function fetchSoundfont(url: string): Promise<Map<string, string>> {
  const cached = soundfontCache.get(url);
  if (cached) return cached;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load soundfont: ${url} (${response.status})`);
  }

  const text = await response.text();
  const noteMap = new Map<string, string>();

  // Parse: "NoteName": "data:audio/ogg;base64,..."
  const regex = /"([A-G][b#]?\d)"\s*:\s*"(data:audio\/[^"]+)"/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    noteMap.set(match[1], match[2]);
  }

  soundfontCache.set(url, noteMap);
  return noteMap;
}

/**
 * Build SampleMapping array from a soundfont JS URL.
 * Samples every `step` semitones within the given MIDI range.
 */
export async function buildSoundfontLayer(
  jsUrl: string,
  rangeLow: number,
  rangeHigh: number,
  step = 3,
): Promise<SampleMapping[]> {
  const noteMap = await fetchSoundfont(jsUrl);
  const mappings: SampleMapping[] = [];

  // Try all notes in the map that fall within range
  for (const [noteName, dataUri] of noteMap) {
    const midi = noteNameToMidi(noteName);
    if (midi < rangeLow || midi > rangeHigh) continue;
    // Only include every `step` semitones for reasonable load
    if ((midi - rangeLow) % step !== 0) continue;
    mappings.push({ midi, url: dataUri });
  }

  // Sort by MIDI note
  mappings.sort((a, b) => a.midi - b.midi);
  return mappings;
}
