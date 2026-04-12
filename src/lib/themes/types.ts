export interface Theme {
  id: string;
  name: string;
  properties: Record<string, string>; // CSS custom property map
}

/**
 * Applies a theme by setting all its CSS custom properties on the given element.
 * Call this on the rack container element — the CSS cascade handles the rest.
 */
export function applyTheme(theme: Theme, element: HTMLElement): void {
  for (const [property, value] of Object.entries(theme.properties)) {
    element.style.setProperty(property, value);
  }
}
