import type { Theme } from '../types.js';

export const ancientForest: Theme = {
  id: 'ancient-forest',
  name: 'Ancient Forest',
  properties: {
    // Rack — dark forest floor, deep earth
    '--rack-bg': 'radial-gradient(ellipse at center, #0d1a0d 0%, #080f08 60%, #050c05 100%)',

    // Panels — dark bark-like gradients, wood grain feel
    '--panel-bg': 'linear-gradient(135deg, #2a1f1a 0%, #3d2e24 50%, #2e2318 100%)',
    '--panel-border': '1px solid #5a4a3a',
    '--panel-radius': '6px',
    '--panel-shadow': '0 4px 12px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.04)',

    // Knobs — tree-ring radial gradients, living green indicator
    '--knob-body': 'radial-gradient(circle at 38% 38%, #5c4230 0%, #3d2b1e 40%, #2a1f15 100%)',
    '--knob-indicator': '#7fba5c',
    '--knob-track': '#4a3828',
    '--knob-size': '48px',

    // Cables — vine green body, bioluminescent glow on signal
    '--cable-stroke': '#4a7a3a',
    '--cable-width': '3px',
    '--cable-opacity': '0.85',
    '--cable-droop': '0.4',
    '--cable-glow': '#7fff7f',

    // Ports — dark hollows, green glow when active
    '--port-fill': '#1a1210',
    '--port-stroke': '#5a4a3a',
    '--port-glow': '#7fba5c',

    // Labels — earthy muted tones, monospace
    '--label-font': "'Courier New', monospace",
    '--label-color': '#a89880',
    '--label-size': '11px',

    // Signal visualization — bioluminescent green
    '--signal-color': '#7fff7f',

    // Module title
    '--module-title-color': '#c8b89a',
    '--module-title-font': "'Courier New', monospace",

    // Spore ports — mycorrhizal purple, distinct from green audio/control
    '--spore-stroke': '#6a4a8f',
    '--spore-glow': '#b490ff',
  },
};
