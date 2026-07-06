import type { Theme } from './types.js';
import { ancientForest } from './ancient-forest/theme.js';
import { tiffanyPeacock } from './tiffany-peacock/theme.js';

export type { Theme };
export { applyTheme } from './types.js';

export const themes: Theme[] = [ancientForest, tiffanyPeacock];

export { ancientForest, tiffanyPeacock };
