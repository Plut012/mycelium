import { writable } from 'svelte/store';
import { ancientForest, themes, applyTheme } from '$lib/themes/index.js';
import type { Theme } from '$lib/themes/index.js';

/**
 * The currently active theme.
 * Defaults to Ancient Forest — the signature theme.
 */
export const activeTheme = writable<Theme>(ancientForest);

/**
 * Switch the active theme by id.
 * Throws if the theme id is not found in the registry.
 */
export function setTheme(id: string): void {
  const theme = themes.find((t) => t.id === id);
  if (!theme) {
    throw new Error(`Theme not found: "${id}"`);
  }
  activeTheme.set(theme);
}

/**
 * Apply the current theme to a rack container element.
 * Call this whenever the active theme changes or the rack mounts.
 *
 * Typical usage in the rack component:
 *   $effect(() => applyThemeToElement($activeTheme, rackElement));
 */
export function applyThemeToElement(theme: Theme, element: HTMLElement): void {
  applyTheme(theme, element);
}

export type { Theme };
