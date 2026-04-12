# Hex Keys — Building a Harmonic Table Layout

A practical reference for constructing a hexagonal isomorphic keyboard using the Harmonic Table (Tonnetz) note mapping. Focused on the layout geometry and math, independent of any specific framework.

---

## The Core Idea

A flat grid of hexagons where each hex is a musical note. The three axes of the hexagonal grid map to the three fundamental intervals of Western harmony:

| Axis | Interval | Semitones |
|------|----------|-----------|
| Vertical | Minor third | 3 |
| Horizontal (with offset) | Major third | 4 |
| Diagonal (compound) | Perfect fifth | 7 |

This means chords are geometric shapes. The same shape always produces the same chord quality, regardless of where you place it on the grid.

---

## Coordinate System

Use **axial coordinates** `(q, r)` — the standard for hex grid math. Two axes, 60 degrees apart.

### Note Formula

```
midi(q, r) = base + (q * 4) + (r * 3)
```

- `base` = root MIDI note (e.g., C3 = MIDI 48)
- `q` axis = major thirds (4 semitones per step)
- `r` axis = minor thirds (3 semitones per step)
- Moving +1 on `q` and +1 on `r` = +7 semitones = perfect fifth

This is the (4, 3) coordinate system. It encodes the Tonnetz directly.

### Example: Grid around C3 (base = 48)

```
q:  -2    -1     0     1     2

r=2:  42    46    50    54    58      (F#2) (Bb2) (D3)  (F#3) (Bb3)
r=1:  39    43    47    51    55      (Eb2) (G2)  (B2)  (Eb3) (G3)
r=0:  36    40    44    48    52      (C2)  (E2)  (Ab2) (C3)  (E3)
r=-1: 33    37    41    45    49      (A1)  (Db2) (F2)  (A2)  (Db3)
r=-2: 30    34    38    42    46      (F#1) (Bb1) (D2)  (F#2) (Bb2)
```

### Chord Shapes

All chord shapes are position-invariant. Pick any starting hex — these relative offsets always produce the same chord quality:

```
Major triad:   (0,0), (1,0), (0,1)     root + M3 + m3 = root + M3 + P5
Minor triad:   (0,0), (0,1), (1,1)     root + m3 + M3 = root + m3 + P5
Diminished:    (0,0), (0,1), (0,2)     root + m3 + m3
Augmented:     (0,0), (1,0), (2,0)     root + M3 + M3
Major 7th:     (0,0), (1,0), (0,1), (1,1)
Minor 7th:     (0,0), (0,1), (1,1), (1,2)
Dominant 7th:  (0,0), (1,0), (0,1), (0,2)
Sus4:          (0,0), (-1,1), (0,1)    root + P4 + P5
```

---

## Hex Grid Geometry

### Pointy-Top vs Flat-Top

Two orientations exist. Either works — the choice affects rendering but not the note mapping.

**Pointy-top** (vertex points up):
```
  /\
 /  \
|    |
 \  /
  \/
```

**Flat-top** (flat edge on top):
```
 ____
/    \
\    /
 ‾‾‾‾
```

Pointy-top tends to work better for vertical scrolling layouts (phones). Flat-top works better for wide landscape layouts.

### Size and Spacing

Given a hex with **size** `s` (center to vertex distance):

**Pointy-top:**
```
width  = sqrt(3) * s
height = 2 * s
```

**Flat-top:**
```
width  = 2 * s
height = sqrt(3) * s
```

### Axial to Pixel Conversion

**Pointy-top:**
```
pixel_x = s * (sqrt(3) * q + sqrt(3)/2 * r)
pixel_y = s * (3/2 * r)
```

**Flat-top:**
```
pixel_x = s * (3/2 * q)
pixel_y = s * (sqrt(3)/2 * q + sqrt(3) * r)
```

### Hex Vertices

For a hex centered at `(cx, cy)` with size `s`:

**Pointy-top** — vertices at angles 30, 90, 150, 210, 270, 330 degrees:
```
for i in 0..5:
    angle = 60 * i + 30
    vx = cx + s * cos(radians(angle))
    vy = cy + s * sin(radians(angle))
```

**Flat-top** — vertices at angles 0, 60, 120, 180, 240, 300 degrees:
```
for i in 0..5:
    angle = 60 * i
    vx = cx + s * cos(radians(angle))
    vy = cy + s * sin(radians(angle))
```

---

## Hit Testing

Given a touch/click at pixel `(px, py)`, find which hex was touched.

### Approach 1: Nearest Center (Simple)

Calculate pixel center of every hex. Find the one closest to `(px, py)`. If distance < `s`, it's a hit.

```
for each hex (q, r):
    cx, cy = axial_to_pixel(q, r, s)
    dist = sqrt((px - cx)^2 + (py - cy)^2)
    if dist < smallest_dist:
        best = (q, r)
```

Good enough for grids under ~200 hexes. O(n) per touch.

### Approach 2: Pixel to Axial (Fast)

Reverse the axial-to-pixel formula, then round to the nearest hex.

**Pointy-top:**
```
q_frac = (sqrt(3)/3 * px - 1/3 * py) / s
r_frac = (2/3 * py) / s
```

Then **hex round**: convert to cube coordinates `(x, y, z)` where `x = q, z = r, y = -x - z`, round each to nearest integer, and fix the one with the largest rounding error so they sum to zero.

```
rx = round(x), ry = round(y), rz = round(z)
dx = abs(rx - x), dy = abs(ry - y), dz = abs(rz - z)

if dx > dy and dx > dz:
    rx = -ry - rz
elif dy > dz:
    ry = -rx - rz
else:
    rz = -rx - ry

result_q = rx, result_r = rz
```

O(1) per touch. Use this for large grids or frequent touch events.

---

## Color Coding

Color by **pitch class** (note % 12). All C's share one color, all C#'s another, etc. This creates a repeating visual pattern across the grid that makes interval relationships visible.

A 12-color palette mapped to pitch classes:

| Pitch Class | Note | Suggested Hue |
|-------------|------|---------------|
| 0 | C | Red |
| 1 | C# | Deep orange |
| 2 | D | Gold |
| 3 | Eb | Olive |
| 4 | E | Green |
| 5 | F | Teal |
| 6 | F# | Cyan |
| 7 | G | Blue |
| 8 | Ab | Indigo |
| 9 | A | Purple |
| 10 | Bb | Magenta |
| 11 | B | Rose |

Muted/desaturated versions work better than bright primaries — the active (pressed) state should be the bright version, so there's visual contrast between idle and active.

---

## Grid Sizing

### How Many Hexes?

The range in semitones covered by a grid of `Q` columns and `R` rows:

```
range = (Q-1) * 4 + (R-1) * 3  semitones
octaves ≈ range / 12
```

| Grid | Hexes | Semitones | Octaves |
|------|-------|-----------|---------|
| 5 x 5 | 25 | 28 | ~2.3 |
| 7 x 7 | 49 | 42 | ~3.5 |
| 9 x 7 | 63 | 50 | ~4.2 |
| 7 x 9 | 63 | 48 | 4.0 |

For chord exploration, 7x7 (~3.5 octaves) is a sweet spot — enough range to explore inversions and voicings without being overwhelming.

### Touch Target Size

For comfortable finger use on a phone:
- Minimum hex size: ~20px radius (40px vertex-to-vertex)
- Comfortable: ~28px radius (56px vertex-to-vertex)
- A 7x7 grid at 28px radius needs roughly 280 x 270 pixels — fits a phone screen when zoomed

---

## Multi-Touch Considerations

For chord playing, the grid must handle simultaneous touches:

1. **Track touches by identifier** — each finger gets a unique ID from the touch/pointer API
2. **Map each touch to a hex** — use hit testing on touch start and touch move
3. **Note-on when a finger enters a hex** — trigger the note
4. **Note-off when a finger leaves or lifts** — release the note
5. **Sliding between hexes** — finger moves from one hex to another should note-off the old hex and note-on the new one
6. **Prevent browser gestures** — set `touch-action: none` on the grid element to suppress scroll/zoom

### Pointer Events vs Touch Events

Pointer Events are the modern choice — single API handles both mouse and multi-touch. Each pointer has a `pointerId` for tracking. Use `setPointerCapture` to keep a finger's events bound to the grid element even if the finger drifts.

---

## Alternative Layouts

The (4, 3) Harmonic Table is the best choice for chord exploration, but other mappings exist on the same hex grid:

### Wicki-Hayden (2, 5)
```
midi(q, r) = base + (q * 2) + (r * 5)
```
- Horizontal = whole tones, vertical = perfect fourths
- Good for melody and scales (diatonic notes cluster together)
- Less intuitive for chord shapes

### Jankó (1, 2)
```
midi(q, r) = base + (q * 1) + (r * 2)
```
- Chromatic — every adjacent hex is one semitone apart
- Compact range, but chord shapes are less geometric

### Choosing a Layout

Pick based on the primary use case:
- **Chord exploration / harmony** → Harmonic Table (4, 3)
- **Melody / scales** → Wicki-Hayden (2, 5)
- **Chromatic / microtonal** → Jankó (1, 2) or custom

The hex grid geometry stays identical — only the note formula changes.

---

## References

- [Red Blob Games: Hexagonal Grids](https://www.redblobgames.com/grids/hexagons/) — definitive guide to hex grid math
- Euler, L. (1739). *Tentamen novae theoriae musicae* — the original Tonnetz
- [Lumatone](https://www.lumatone.io/) — physical isomorphic keyboard, Harmonic Table mode
- [Wikipedia: Harmonic Table note layout](https://en.wikipedia.org/wiki/Harmonic_table_note_layout)
- [Wikipedia: Isomorphic keyboard](https://en.wikipedia.org/wiki/Isomorphic_keyboard)
