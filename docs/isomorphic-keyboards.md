# Isomorphic Keyboards

How hexagonal note layouts change the way you think about music.

---

## What Is an Isomorphic Keyboard?

An isomorphic keyboard is a grid of notes where **every chord, scale, and interval has the same shape regardless of which note you start on**. This property is called *transpositional invariance*.

On a piano, C major and F# major require completely different fingerings. On an isomorphic keyboard, they are the same shape — you just move your hand. Learn one fingering, play in all 12 keys.

---

## Why Hexagons?

Hexagons have 6 neighbors. Squares have 4. More neighbors means more musical relationships can be expressed as adjacent movements.

In a hexagonal grid, three pairs of opposing directions can each represent a different musical interval. This is enough to encode the three fundamental intervals of Western harmony: the perfect fifth, the major third, and the minor third. No other regular tiling can do this.

Hexagons also tessellate the plane uniformly — every cell is identical, which is exactly what "isomorphic" requires.

---

## The Harmonic Table Layout

The Harmonic Table is the most intuitive isomorphic layout for understanding harmony. It dates back to Leonhard Euler's *Tonnetz* (1739) — a 250-year-old mathematical model of how harmony actually works, rediscovered as a keyboard layout.

### Interval Mapping

Each hexagon has 6 neighbors. The three directional axes map to:

```
        ╱ ╲
  +5th ╱   ╲ +maj3rd
      ╱     ╲
 ────       ────
      ╲     ╱
 -5th  ╲   ╱ -min3rd
        ╲ ╱
```

- **Vertical axis**: Perfect fifths (7 semitones) — up is ascending fifth, down is descending
- **Upper-right diagonal**: Major thirds (4 semitones)
- **Lower-right diagonal**: Minor thirds (3 semitones)

### Why This Works for Chords

A major triad is: root + major third + perfect fifth.
A minor triad is: root + minor third + perfect fifth.

On the Harmonic Table, these are **triangles**:

```
Major chord (pointing up-right):     Minor chord (pointing down-right):

    ●                                     ●
   ╱ ╲                                   ╱ ╲
  5th  M3                              5th  m3
 ╱     ╲                              ╱     ╲
●───────●                            ●───────●
```

Every major chord is the same triangle shape. Every minor chord is the same (mirrored) triangle shape. Move the triangle anywhere on the grid — it's always the same chord quality, just a different root.

### The Coordinate Formula

Given a hexagonal grid position `(col, row)` and a root MIDI note:

```
midi = root + (col * 4) + (row * 3)
```

Where:
- Moving one column right = +4 semitones (major third)
- Moving one row up = +3 semitones (minor third)
- Moving diagonally up-left = +7 semitones (perfect fifth: +3 from row, +4 from col offset)

---

## The Lumatone

The Lumatone is the most well-known physical isomorphic keyboard. It has:

- **280 hexagonal keys** arranged in a honeycomb grid
- **Per-key color LEDs** — each note can be color-coded
- **Velocity sensitivity and polyphonic aftertouch** via Hall-Effect sensors
- **5 sections** of 56 keys each, independently configurable
- Multiple layout modes: Classic (semitone-based), Melodic (Wicki-Hayden), and Harmonic (Tonnetz)

The Harmonic mode is the most distinctive — it enables chord shapes that are physically identical regardless of key, making it a powerful tool for understanding harmony.

---

## Why This Matters for Learning

### Every Chord Shape Is the Same

On a piano, you learn 12 different fingerings for major chords, 12 for minor, 12 for diminished, and so on. That's hundreds of patterns to memorize before you can play freely.

On an isomorphic keyboard, you learn:
- **1 shape** for major chords
- **1 shape** for minor chords
- **1 shape** for each chord quality

Then you move that shape to any starting note. Done.

### Harmony Becomes Visual

On the Harmonic Table, harmonic relationships are spatial relationships:
- **Closely related keys** are physically close together
- **The circle of fifths** is a straight vertical line
- **Relative major/minor** keys share two of three chord tones and sit adjacent
- **Voice leading** (smooth chord transitions) corresponds to small physical movements

You can *see* music theory on the surface of the instrument.

### Research Confirms It

Studies show musicians perform 40-57% better on isomorphic layouts compared to non-isomorphic equivalents. The benefit comes from reduced cognitive load — your brain focuses on musical intent rather than adapting finger patterns to different keys.

---

## Our Implementation: The Hex Keyboard Module

Mycelium implements a Harmonic Table layout as a touchscreen-optimized module:

- **Hexagonal grid** using the (4, 3) coordinate system
- **Color-coded by note class** — all C's one color, all D's another, etc.
- **Multi-touch** — press multiple hexagons simultaneously for chords
- **Large grid size** — designed to be zoomed to fill the phone screen
- **Spore output** — emits NoteSpore data (active notes, intervals, chord names) for downstream theory visualization modules
- **CV/Gate outputs** — compatible with the existing modular signal chain

The module is intentionally large on the grid (8x8 units) so that when zoomed on a phone, individual hexagons are comfortably finger-sized.

---

## References

- Euler, L. (1739). *Tentamen novae theoriae musicae* — original Tonnetz
- Wicki, K. (1896). Patent for the Wicki keyboard layout
- Hayden, B. (1986). Refinement of Wicki layout for concertinas
- Davies, P. (1990). Patent for the Harmonic Table note layout
- [Lumatone](https://www.lumatone.io/) — the leading physical isomorphic keyboard
- [Red Blob Games: Hexagonal Grids](https://www.redblobgames.com/grids/hexagons/) — essential hex grid math reference
