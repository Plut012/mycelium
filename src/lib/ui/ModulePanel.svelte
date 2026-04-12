<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    title: string;
    gridWidth?: number;
    gridHeight?: number;
    children: Snippet;
  };

  let { title, gridWidth = 3, gridHeight = 4, children }: Props = $props();

  // Grid cell size in px — must match GRID_CELL in +page.svelte
  const CELL = 60;
  const GAP = 8; // internal padding allowance

  let panelWidth = $derived(gridWidth * CELL - GAP);
  let panelHeight = $derived(gridHeight * CELL - GAP);
</script>

<div class="module-panel" style:width="{panelWidth}px" style:height="{panelHeight}px">
  <div class="module-title">{title}</div>
  <div class="module-body">
    {@render children()}
  </div>
</div>

<style>
  .module-panel {
    background: var(--panel-bg, linear-gradient(135deg, #2a1f1a, #3d2e24));
    border: var(--panel-border, 1px solid #5a4a3a);
    border-radius: var(--panel-radius, 6px);
    box-shadow: var(--panel-shadow, 0 4px 12px rgba(0, 0, 0, 0.5));
    padding: 8px 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow: hidden;
  }

  .module-title {
    font-family: var(--module-title-font, 'Courier New', monospace);
    font-size: 10px;
    color: var(--module-title-color, #c8b89a);
    text-transform: uppercase;
    letter-spacing: 0.12em;
    text-align: center;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--panel-border-color, #3a2e24);
    user-select: none;
    flex-shrink: 0;
  }

  .module-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    flex: 1;
    overflow: hidden;
  }
</style>
