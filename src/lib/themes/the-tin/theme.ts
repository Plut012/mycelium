import type { Theme } from '../types.js';

/**
 * The Tin — retro-futurist pocket synth.
 *
 * The hardware it echoes: matte black PETG panel, chrome bat-handle toggles,
 * engraved metal knobs, and one warm amber LED breathing beside the power
 * switch. Calm, tactile, warm.
 *
 * 60/30/10:
 *   60% surfaces  — matte near-black, the printed panel
 *   30% structure — brushed-steel strokes, engraved warm-gray text
 *   10% accent    — amber lamp glow: knob pointers, port halos, the signal
 *
 * Spore ports go copper — the capacitive pads are copper tape under the
 * panel, and spores are the touch data they carry.
 */
export const theTin: Theme = {
  id: 'the-tin',
  name: 'The Tin',
  properties: {
    // Rack — a dark desk under one warm lamp
    '--rack-bg': 'radial-gradient(ellipse at 50% 35%, #191614 0%, #100e0d 55%, #0a0908 100%)',
    '--grid-line': 'rgba(255, 214, 160, 0.05)',

    // Panels — matte black print, faint sheen where light grazes
    '--panel-bg': 'linear-gradient(165deg, #262322 0%, #1a1817 55%, #141312 100%)',
    '--panel-bg-solid': '#1a1817',
    '--panel-border': '1px solid #46413d',
    '--panel-border-color': '#332f2c',
    '--panel-radius': '10px',
    '--panel-shadow': '0 5px 14px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 240, 220, 0.05)',

    // Small controls — tight machine-cut corners
    '--control-radius': '3px',

    // Knobs — brushed metal, amber-engraved pointer
    '--knob-body': 'radial-gradient(circle at 36% 34%, #8d8781 0%, #5b5651 48%, #2f2c29 100%)',
    '--knob-indicator': '#ffb454',
    '--knob-track': '#4a4541',
    '--knob-size': '48px',

    // Cables — dark rubber leads, amber-lit when signal flows
    '--cable-stroke': '#6b6259',
    '--cable-width': '3px',
    '--cable-opacity': '0.85',
    '--cable-droop': '0.45',
    '--cable-glow': '#ffc87a',

    // Ports — chrome-ringed wells, warm halo when patched
    '--port-fill': '#0d0c0b',
    '--port-stroke': '#77716b',
    '--port-glow': '#ffb454',

    // Labels — engraved into the panel
    '--label-font': "'Courier New', monospace",
    '--label-color': '#aca396',
    '--label-size': '11px',

    // Signal visualization — the amber lamp, breathing
    '--signal-color': '#ffc87a',

    // Module titles — stamped metal tags
    '--module-title-color': '#d6ccbc',
    '--module-title-font': "'Courier New', monospace",

    // Spore ports — copper tape under the printed panel
    '--spore-stroke': '#a86b42',
    '--spore-glow': '#e0925a',
  },
};
