# Pedalboard Signal Path — Source Definition

**Companion to** `pedalboard_modules.md`. User's source-of-truth routing definition, preserved
verbatim below the notes.

**Port status (2026-07-06):** implemented as four presets sharing the canonical chain — the sim
has no looper (8) or amp (9) per the scope decision, so the chain terminates
`… → hammertone → output` and §4's commit boundary doesn't apply. The §6 performance states map
to the presets **Pedalboard** (= Foundation), **Pedalboard: Lead**, **Pedalboard: Drums**,
**Pedalboard: Chaos** — same modules, same cables, different engage states and settings, exactly
as §6 frames it. The Sampler (nylon) stands in for GUITAR. §3's FX Order Swap (A/B side reorder)
is not implemented — in the sim it's just repatching two cables.

---

# Source definition (verbatim)

## Signal Path Definition

Companion to the module spec sheet. This defines the **routing** — how the modules connect — so you can clone the exact path we designed, not just the individual modules. Module numbers (1–9) match `pedalboard_module_specs.md`.

The design logic in one line: **comp breathes it → gentle drive feeds the octave → RustBucket voices it → parked wah shapes the vowel → second drive finishes it → delay/reverb add space → looper commits a wet backing → amp is the global master bus.**

## 1. Canonical signal path (the clone target)

In a modular sim there is no internal effects loop — it's all just cables — so the authoritative path is a single linear chain:

```
GUITAR
  → [1 SQUEEZER]        compressor  (sustain / breath)
  → [2 KING]            drive A     (gentle OD — the octave-feeder)
  → [4 RUST BUCKET]     boost+fuzz+octave  (character)
  → [5 WAH]             parked filter (vocal formant)
  → [3 BLUESBREAKER]    drive B     (finish / lead boost)
  → [6 ARP-87]          delay
  → [7 HAMMERTONE]      reverb
  → [8 NUX LOOPER]      ← COMMIT POINT (loop is printed here)
  → [9 SUPRO AMP]       ← GLOBAL MASTER BUS (EQ + spring reverb + power amp)
  → SPEAKER / FINAL OUT
```

Note the deliberate ordering quirk: **Module 2 (King) and Module 3 (Bluesbreaker) are the two halves of one physical pedal, but they are NOT adjacent** — the RustBucket and Wah sit between them. That separation is the whole trick (it puts a gentle drive *upstream* of the octave). In the sim this costs nothing; it's just where the cables go.

## 2. Connection list (authoritative — sim version)

Each row is one patch cable: `source output → destination input`.

| # | From (output)        | To (input)            |
|---|----------------------|-----------------------|
| 1 | Guitar               | 1 Squeezer — IN       |
| 2 | 1 Squeezer — OUT     | 2 King — IN           |
| 3 | 2 King — OUT         | 4 Rust Bucket — IN    |
| 4 | 4 Rust Bucket — OUT  | 5 Wah — IN            |
| 5 | 5 Wah — OUT          | 3 Bluesbreaker — IN   |
| 6 | 3 Bluesbreaker — OUT | 6 ARP-87 — IN         |
| 7 | 6 ARP-87 — OUT       | 7 Hammertone — IN     |
| 8 | 7 Hammertone — OUT   | 8 Looper — IN         |
| 9 | 8 Looper — OUT       | 9 Amp — IN            |
| 10| 9 Amp — SPEAKER OUT  | Final output          |

Everything is **mono, instrument-level**, single path (no parallel/stereo splits).

## 3. Hardware realization (reference — how the real board does it)

On the physical board the King/Bluesbreaker split is achieved with the **Throne of Tone's send/return loop**, which taps between its two drive sides. For fidelity, here's the actual cabling:

```
1 Squeezer OUT ─► ToT INPUT
                    │  [ToT Side A = KING]   ← drive A happens here
                 ToT SEND ─► 4 Rust Bucket IN ─► 5 Wah IN
                                                     │
                 ToT RETURN ◄──────────── 5 Wah OUT ─┘
                    │  [ToT Side B = BLUESBREAKER] ← drive B happens here
                 ToT OUTPUT ─► 6 ARP-87 IN ─► … (rest identical to §2)
```

- **FX Order Swap** switch on the ToT flips which side is "A" (pre-loop) vs "B" (post-loop) without repatching — i.e., swap which voicing feeds the octave. Your sim can expose this as a simple A/B toggle that reorders modules 2 and 3.
- **Bypass caveat (hardware only):** because the RustBucket + Wah live inside the loop, verify signal still passes when a ToT side is bypassed. Irrelevant in the sim (cables are cables), but it's why the physical order matters.

## 4. Commit boundary (critical for cloning behavior)

The path has one hard line that changes how effects behave:

- **Modules 1 → 7 are PRINTED into the loop.** When the looper (8) records, everything upstream — comp, both drives, fuzz, octave, wah, delay, reverb — is baked permanently into that layer. Each overdub captures whatever those modules are doing at record time.
- **Module 9 (amp) is NOT printed.** Its EQ, spring reverb, boost/drive and power-amp voicing are applied **globally at playback**, to the summed loop *plus* whatever you play live. Changing an amp knob reshapes the entire loop in real time; it is never committed.

Practical consequence to model: **per-layer tone lives before the looper; master/global tone lives after it.** (This is why drums recorded dry stay dry in the loop, but the amp's spring reverb washes the whole thing on output — keep amp reverb low, use module 7 per-layer.)

## 5. Gain-staging notes

Signal accumulates gain across several stages in series, so track headroom/noise:

- **Hotspots:** Squeezer (raises noise floor) → King (drive) → RustBucket fuzz (high gain) is the loudest, dirtiest stretch. Bluesbreaker then adds more on the way out.
- **Keep King (Module 2) modest** — its job is to feed the octave rounded harmonics, not to be a wall. Low-to-medium gain.
- **Default voicing = drives do the dirt, fuzz is a guest.** For the controlled/vibey target, the RustBucket fuzz stays OFF by default; the two ToT drives supply the everyday grit. Fuzz engages only for intentional chaos.

## 6. Performance states (the footswitch presets we landed on)

The path supports distinct modes via engage states. These aren't routing changes — just which modules are on — but they're part of "the path we decided on."

| State | 1 Comp | 2 King | 4 Boost | 4 Fuzz | 4 Octave | 5 Wah | 3 Blues | 6 Delay | 7 Verb |
|-------|--------|--------|---------|--------|----------|-------|---------|---------|--------|
| **Foundation / bed** | on (mod) | on (OD, low) | opt | off | off | parked | off/low | to taste | to taste |
| **Lead** | on | on | opt | off | on (single notes) | parked or slow-sweep | on (vol bump) | on | reduce |
| **Drums (dry, punchy)** | light | off/clean | off | off | off | parked | off | off | **off** |
| **Chaos (guest)** | on | on | on | **on** | on | parked | on | opt | opt |

Workflow: build the **bed** dry-to-lightly-wet and commit it → strip delay/reverb and switch to **lead** over the top → record **drums dry first** as a foundation when using them. Chaos is a spot color, not a default.

## Quick reference — one-line path

`Guitar → Comp → King(OD) → RustBucket(fuzz/oct) → Wah(parked) → Bluesbreaker → Delay → Reverb → Looper[commit] → Amp[global] → Out`
