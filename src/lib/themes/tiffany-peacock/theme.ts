import type { Theme } from '../types.js';

/**
 * Tiffany Peacock — Art Nouveau stained glass.
 *
 * 60/30/10 rule:
 *   60% surfaces  — deep peacock teal, like looking into lamp glass
 *   30% structure — verdigris bronze strokes, weathered opal text
 *   10% accent    — gilded amber: knob pointers, port glows, the signal itself
 *
 * Curves: asymmetric panel corners (nothing quite parallel, hand-formed),
 * soft inner glow like leaded glass, italic serif titles, and a generous
 * control radius on buttons/chips. The catenary patch cables were always
 * the most Art Nouveau thing in this app — this is their context.
 */
export const tiffanyPeacock: Theme = {
  id: 'tiffany-peacock',
  name: 'Tiffany Peacock',
  properties: {
    // Rack — deep lamp-lit teal, glowing faintly at the center
    '--rack-bg': 'radial-gradient(ellipse at center, #10262c 0%, #0b1a1e 55%, #071114 100%)',
    '--grid-line': 'rgba(95, 125, 110, 0.10)',

    // Panels — peacock glass, subtle diagonal sheen, organic corners
    '--panel-bg': 'linear-gradient(150deg, #123037 0%, #0e242b 45%, #14343a 100%)',
    '--panel-bg-solid': '#123037',
    '--panel-border': '1px solid #5f7d6e',
    '--panel-border-color': '#3c5850',
    '--panel-radius': '20px 8px 18px 10px',
    '--panel-shadow': '0 6px 16px rgba(0, 0, 0, 0.55), inset 0 0 22px rgba(230, 180, 90, 0.05), inset 0 1px 0 rgba(184, 196, 178, 0.08)',

    // Curvature for small controls — buttons, chips, meters
    '--control-radius': '9px',

    // Knobs — patinated bronze bodies, gilded pointer
    '--knob-body': 'radial-gradient(circle at 38% 38%, #2e5049 0%, #1c3a38 45%, #122528 100%)',
    '--knob-indicator': '#e6b45a',
    '--knob-track': '#2f4a44',
    '--knob-size': '48px',

    // Cables — bronze vines, molten gold when signal flows
    '--cable-stroke': '#6e8a5e',
    '--cable-width': '3px',
    '--cable-opacity': '0.85',
    '--cable-droop': '0.5',
    '--cable-glow': '#f0c878',

    // Ports — dark glass wells, amber halo when patched
    '--port-fill': '#0a1518',
    '--port-stroke': '#5f7d6e',
    '--port-glow': '#e6b45a',

    // Labels — weathered opal, kept monospace for readability
    '--label-font': "'Courier New', monospace",
    '--label-color': '#b8c4b2',
    '--label-size': '11px',

    // Signal visualization — molten gold on teal
    '--signal-color': '#f0c878',

    // Module titles — flowing serif, the hand-lettered touch
    '--module-title-color': '#d8c9a3',
    '--module-title-font': "Georgia, 'Times New Roman', serif",

    // Spore ports — iris violet, the Mucha flower in the corner
    '--spore-stroke': '#7a5a96',
    '--spore-glow': '#b48ac8',
  },
};
