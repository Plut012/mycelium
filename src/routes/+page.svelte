<script lang="ts">
  import { onMount } from 'svelte';
  import { activeTheme, applyThemeToElement, setTheme } from '$lib/store/theme.js';
  import {
    modules,
    connections,
    addModule,
    removeModule,
    updateModulePosition,
    connectPorts,
    getConnectedPorts,
    saveRack,
    listSaves,
    loadRack,
    toggleAudio,
    getAudioState,
    getRackURL,
    loadFromURL,
    setRackTheme,
  } from '$lib/store/rack.svelte.js';
  import { moduleRegistry } from '$lib/modules/registry.js';
  import { themes } from '$lib/themes/index.js';
  import PatchCable from '$lib/ui/PatchCable.svelte';
  import type { ModuleInstance, PortRef, Connection } from '$lib/engine/Rack.js';
  import type { RegistryEntry } from '$lib/modules/registry.js';
  import { instrumentPacks } from '$lib/instruments/index.js';
  import type { SamplerEngine } from '$lib/modules/sampler/engine.js';

  // ── Grid constants ──────────────────────────────────────────────────────────
  const CELL = 72;       // px per grid unit — must match ModulePanel.svelte
  const GRID_COLS = 24;  // total grid columns
  const GRID_ROWS = 16;  // total grid rows

  // ── Theme application ───────────────────────────────────────────────────────
  let rackContainer: HTMLElement | undefined = $state();

  $effect(() => {
    if (rackContainer) {
      applyThemeToElement($activeTheme, rackContainer);
    }
  });

  // ── Audio state ─────────────────────────────────────────────────────────────
  let audioStateLabel = $state('Audio Off');
  let audioRunning = $state(false);

  function refreshAudioState() {
    const s = getAudioState();
    audioRunning = s === 'running';
    audioStateLabel = s === 'running' ? 'Audio On' : s === 'uninitialized' ? 'Audio Off' : 'Paused';
  }

  async function handleAudioToggle() {
    await toggleAudio();
    refreshAudioState();
  }

  // ── Zoom / pan state ────────────────────────────────────────────────────────
  let zoom = $state(1);     // 1 = 100%, range 0.3 to 2
  let panX = $state(0);     // px offset
  let panY = $state(0);     // px offset
  let rackLocked = $state(false); // reserved for future use

  let rackViewport: HTMLElement | undefined = $state();
  let rackTransformEl: HTMLElement | undefined = $state();

  // Touch tracking
  let touchState: {
    // pinch
    pinchInitialDist: number;
    pinchInitialZoom: number;
    // pan
    panTouchId: number;
    panStartX: number;
    panStartY: number;
    panStartPanX: number;
    panStartPanY: number;
    // double-tap
    lastTapTime: number;
  } = {
    pinchInitialDist: 0,
    pinchInitialZoom: 1,
    panTouchId: -1,
    panStartX: 0,
    panStartY: 0,
    panStartPanX: 0,
    panStartPanY: 0,
    lastTapTime: 0,
  };
  let activePinch = false;

  function clampZoom(z: number): number {
    return Math.max(0.3, Math.min(2, z));
  }

  function pinchDist(t1: Touch, t2: Touch): number {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function onViewportTouchStart(e: TouchEvent) {
    if (rackLocked) return;
    const target = e.target as HTMLElement;
    const onModule = !!target.closest('.module-wrapper');

    if (e.touches.length === 2) {
      // Pinch start
      activePinch = true;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      touchState.pinchInitialDist = pinchDist(t1, t2);
      touchState.pinchInitialZoom = zoom;
      touchState.panTouchId = -1; // cancel any active single-finger pan
    } else if (e.touches.length === 1 && !onModule) {
      // Single-finger pan on canvas background
      activePinch = false;
      const t = e.touches[0];
      touchState.panTouchId = t.identifier;
      touchState.panStartX = t.clientX;
      touchState.panStartY = t.clientY;
      touchState.panStartPanX = panX;
      touchState.panStartPanY = panY;

      // Double-tap detection
      const now = Date.now();
      if (now - touchState.lastTapTime < 300) {
        zoom = 1;
        panX = 0;
        panY = 0;
        touchState.lastTapTime = 0;
      } else {
        touchState.lastTapTime = now;
      }
    }
  }

  function onViewportTouchMove(e: TouchEvent) {
    if (rackLocked) return;
    e.preventDefault();
    if (e.touches.length === 2 && activePinch) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = pinchDist(t1, t2);
      const newZoom = clampZoom(touchState.pinchInitialZoom * (dist / touchState.pinchInitialDist));

      // Zoom toward midpoint between fingers
      if (rackViewport) {
        const vr = rackViewport.getBoundingClientRect();
        const midX = ((t1.clientX + t2.clientX) / 2) - vr.left;
        const midY = ((t1.clientY + t2.clientY) / 2) - vr.top;
        // Point in local space stays fixed: (midX - panX) / zoom == (midX - newPanX) / newZoom
        panX = midX - (midX - panX) * (newZoom / zoom);
        panY = midY - (midY - panY) * (newZoom / zoom);
      }
      zoom = newZoom;
    } else if (e.touches.length === 1 && !activePinch) {
      const t = Array.from(e.touches).find(touch => touch.identifier === touchState.panTouchId);
      if (t) {
        panX = touchState.panStartPanX + (t.clientX - touchState.panStartX);
        panY = touchState.panStartPanY + (t.clientY - touchState.panStartY);
      }
    }
  }

  function onViewportTouchEnd(e: TouchEvent) {
    if (e.touches.length < 2) {
      activePinch = false;
    }
    if (e.touches.length === 0) {
      touchState.panTouchId = -1;
    }
  }

  function onViewportWheel(e: WheelEvent) {
    if (rackLocked) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newZoom = clampZoom(zoom * factor);
    if (rackViewport) {
      const vr = rackViewport.getBoundingClientRect();
      const cursorX = e.clientX - vr.left;
      const cursorY = e.clientY - vr.top;
      panX = cursorX - (cursorX - panX) * (newZoom / zoom);
      panY = cursorY - (cursorY - panY) * (newZoom / zoom);
    }
    zoom = newZoom;
  }

  // ── Mobile menu ─────────────────────────────────────────────────────────────
  let menuOpen = $state(false);

  function handleOutsideClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.mobile-menu') && !target.closest('.header-hamburger')) {
      menuOpen = false;
    }
  }

  // ── Cable visibility ────────────────────────────────────────────────────────
  let showCables = $state(true);

  // ── Module browser ──────────────────────────────────────────────────────────
  let browserOpen = $state(true);
  const categoryOrder = ['source', 'filter', 'effect', 'modulation', 'utility', 'output'];

  const orderedCategories = $derived.by(() => {
    const cats = new Map<string, RegistryEntry[]>();
    for (const entry of moduleRegistry.values()) {
      const cat = entry.manifest.category;
      if (!cats.has(cat)) cats.set(cat, []);
      cats.get(cat)!.push(entry);
    }
    return categoryOrder
      .filter((c) => cats.has(c))
      .map((c): [string, RegistryEntry[]] => [c, cats.get(c)!]);
  });

  // ── Grid collision detection ────────────────────────────────────────────────

  function isOccupied(col: number, row: number, w: number, h: number, excludeId?: string): boolean {
    for (const m of modules.value) {
      if (m.id === excludeId) continue;
      const mx = m.position.x, my = m.position.y;
      const mw = m.size.w, mh = m.size.h;
      // AABB overlap test
      if (col < mx + mw && col + w > mx && row < my + mh && row + h > my) {
        return true;
      }
    }
    return false;
  }

  function isInBounds(col: number, row: number, w: number, h: number): boolean {
    return col >= 0 && row >= 0 && col + w <= GRID_COLS && row + h <= GRID_ROWS;
  }

  function findFreePosition(w: number, h: number): { x: number; y: number } {
    for (let row = 0; row <= GRID_ROWS - h; row++) {
      for (let col = 0; col <= GRID_COLS - w; col++) {
        if (!isOccupied(col, row, w, h)) {
          return { x: col, y: row };
        }
      }
    }
    // Fallback — just place at 0,0
    return { x: 0, y: 0 };
  }

  // ── Adding modules ──────────────────────────────────────────────────────────

  function handleAddModule(typeId: string) {
    const entry = moduleRegistry.get(typeId);
    if (!entry) return;
    const w = entry.manifest.gridWidth ?? 3;
    const h = entry.manifest.gridHeight ?? 4;
    const pos = findFreePosition(w, h);
    addModule(typeId, pos);
    refreshAudioState();
  }

  // ── Drag to move modules (grid-snapped) ─────────────────────────────────────

  let dragging: {
    moduleId: string;
    startMouseX: number;
    startMouseY: number;
    startCol: number;
    startRow: number;
    w: number;
    h: number;
    currentCol: number;
    currentRow: number;
    valid: boolean;
  } | null = $state(null);

  function onModulePointerDown(e: PointerEvent, instance: ModuleInstance) {
    // Only drag from the title bar — everything else is interactive
    const target = e.target as HTMLElement;
    if (!target.closest('.module-title')) return;

    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    dragging = {
      moduleId: instance.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startCol: instance.position.x,
      startRow: instance.position.y,
      w: instance.size.w,
      h: instance.size.h,
      currentCol: instance.position.x,
      currentRow: instance.position.y,
      valid: true,
    };
  }

  function onCanvasPointerMove(e: PointerEvent) {
    if (!dragging) return;
    const dx = e.clientX - dragging.startMouseX;
    const dy = e.clientY - dragging.startMouseY;
    const newCol = Math.round(dragging.startCol + dx / (CELL * zoom));
    const newRow = Math.round(dragging.startRow + dy / (CELL * zoom));
    const clampedCol = Math.max(0, Math.min(GRID_COLS - dragging.w, newCol));
    const clampedRow = Math.max(0, Math.min(GRID_ROWS - dragging.h, newRow));

    dragging.currentCol = clampedCol;
    dragging.currentRow = clampedRow;
    dragging.valid = !isOccupied(clampedCol, clampedRow, dragging.w, dragging.h, dragging.moduleId);
  }

  function onCanvasPointerUp() {
    if (!dragging) return;
    if (dragging.valid) {
      updateModulePosition(dragging.moduleId, {
        x: dragging.currentCol,
        y: dragging.currentRow,
      });
    }
    dragging = null;
  }

  // ── Port patching ───────────────────────────────────────────────────────────

  let pendingPort: { moduleId: string; portId: string; direction: 'input' | 'output' } | null = $state(null);
  let mousePos = $state({ x: 0, y: 0 });
  const portPositions = new Map<string, { x: number; y: number }>();

  function portKey(moduleId: string, portId: string): string {
    return `${moduleId}::${portId}`;
  }

  function getPortPosition(moduleId: string, portId: string): { x: number; y: number } | null {
    return portPositions.get(portKey(moduleId, portId)) ?? null;
  }

  function handlePortConnect(moduleId: string, portId: string) {
    const instance = modules.value.find((m) => m.id === moduleId);
    if (!instance) return;

    const allPorts = [
      ...instance.manifest.inputs.map((p) => ({ ...p, direction: 'input' as const })),
      ...instance.manifest.outputs.map((p) => ({ ...p, direction: 'output' as const })),
    ];
    const portDef = allPorts.find((p) => p.id === portId);
    if (!portDef) return;

    if (!pendingPort) {
      pendingPort = { moduleId, portId, direction: portDef.direction };
      return;
    }

    if (pendingPort.moduleId === moduleId && pendingPort.portId === portId) {
      pendingPort = null;
      return;
    }

    if (pendingPort.direction === portDef.direction) {
      pendingPort = { moduleId, portId, direction: portDef.direction };
      return;
    }

    if (pendingPort.moduleId === moduleId) {
      pendingPort = null;
      return;
    }

    const from: PortRef = pendingPort.direction === 'output'
      ? { moduleId: pendingPort.moduleId, portId: pendingPort.portId }
      : { moduleId, portId };
    const to: PortRef = pendingPort.direction === 'input'
      ? { moduleId: pendingPort.moduleId, portId: pendingPort.portId }
      : { moduleId, portId };

    connectPorts(from, to);
    pendingPort = null;
  }

  function cancelPatch(e: MouseEvent) {
    if (e.button === 2 && pendingPort) {
      e.preventDefault();
      pendingPort = null;
    }
  }

  function onRackMouseMove(e: MouseEvent) {
    if (!rackTransformEl) return;
    const rect = rackTransformEl.getBoundingClientRect();
    mousePos = {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    };
  }

  // ── Port position tracking ──────────────────────────────────────────────────

  function updatePortPositions() {
    if (!rackTransformEl) return;
    const wrapperRect = rackTransformEl.getBoundingClientRect();
    const jackEls = rackTransformEl.querySelectorAll<HTMLElement>('[data-port-jack]');
    for (const el of jackEls) {
      const mid = el.dataset.moduleId;
      const pid = el.dataset.portId;
      if (!mid || !pid) continue;
      const rect = el.getBoundingClientRect();
      const screenX = rect.left + rect.width / 2;
      const screenY = rect.top + rect.height / 2;
      portPositions.set(portKey(mid, pid), {
        x: (screenX - wrapperRect.left) / zoom,
        y: (screenY - wrapperRect.top) / zoom,
      });
    }
  }

  $effect(() => {
    void modules.value.length;
    void connections.value.length;
    void zoom; void panX; void panY;
    Promise.resolve().then(updatePortPositions);
  });

  // ── Cable endpoints ─────────────────────────────────────────────────────────

  function cableEndpoints(conn: Connection): { x1: number; y1: number; x2: number; y2: number } | null {
    const from = getPortPosition(conn.from.moduleId, conn.from.portId);
    const to = getPortPosition(conn.to.moduleId, conn.to.portId);
    if (!from || !to) return null;
    return { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
  }

  function pendingCableEndpoints(): { x1: number; y1: number; x2: number; y2: number } | null {
    if (!pendingPort) return null;
    const portPos = getPortPosition(pendingPort.moduleId, pendingPort.portId);
    if (!portPos) return null;
    return { x1: portPos.x, y1: portPos.y, x2: mousePos.x, y2: mousePos.y };
  }

  // ── Save / Load dialog ──────────────────────────────────────────────────────

  let saveLoadOpen = $state(false);
  let savedRacks = $state<{ id: string; name: string }[]>([]);
  let saveLoadMode = $state<'save' | 'load'>('save');

  async function openSave() {
    saveLoadMode = 'save';
    saveLoadOpen = true;
  }

  async function openLoad() {
    saveLoadMode = 'load';
    savedRacks = await listSaves();
    saveLoadOpen = true;
  }

  async function handleSave() {
    await saveRack();
    saveLoadOpen = false;
  }

  async function handleLoad(id: string) {
    await loadRack(id);
    saveLoadOpen = false;
    refreshAudioState();
  }

  // ── Theme selection ─────────────────────────────────────────────────────────

  function handleThemeChange(e: Event) {
    const sel = e.currentTarget as HTMLSelectElement;
    setTheme(sel.value);
    setRackTheme(sel.value);
  }

  // ── Presets ─────────────────────────────────────────────────────────────────

  interface Preset {
    name: string;
    description: string;
    // `key` aliases a module instance when a preset uses the same type more
    // than once (e.g. The Tin's three Freezes); connections reference it via
    // their `type` field. Defaults to `type`.
    modules: { type: string; key?: string; position: { x: number; y: number }; params?: Record<string, number | string>; instrument?: string }[];
    connections: { from: { type: string; port: string }; to: { type: string; port: string } }[];
  }

  // ── Pedalboard performance states ──────────────────────────────────────────
  // One canonical chain (docs/todo_tasks/pedalboard_signal_path.md §1–2), four
  // engage-state recipes (§6). Same modules, same cables — only params differ.

  function pedalboardPreset(
    name: string,
    description: string,
    p: Record<string, Record<string, number | string>>,
  ): Preset {
    const layout: { type: string; position: { x: number; y: number } }[] = [
      { type: 'fretboard', position: { x: 0, y: 0 } },
      { type: 'sampler', position: { x: 0, y: 3 } },
      { type: 'squeezer', position: { x: 4, y: 3 } },
      { type: 'king-of-tone', position: { x: 7, y: 3 } },
      { type: 'rust-bucket', position: { x: 11, y: 3 } },
      { type: 'wah', position: { x: 15, y: 3 } },
      { type: 'bluesbreaker', position: { x: 18, y: 3 } },
      { type: 'arp87', position: { x: 0, y: 8 } },
      { type: 'hammertone', position: { x: 4, y: 8 } },
      { type: 'output', position: { x: 8, y: 8 } },
    ];
    const chain = [
      'sampler', 'squeezer', 'king-of-tone', 'rust-bucket', 'wah',
      'bluesbreaker', 'arp87', 'hammertone', 'output',
    ];
    return {
      name,
      description,
      modules: layout.map((m) => ({ ...m, params: p[m.type] })),
      connections: [
        { from: { type: 'fretboard', port: 'note_data' }, to: { type: 'sampler', port: 'note_data' } },
        ...chain.slice(0, -1).map((type, i) => ({
          from: { type, port: 'audio_out' },
          to: { type: chain[i + 1], port: 'audio_in' },
        })),
      ],
    };
  }

  // Params shared by every state
  const pbCommon = {
    fretboard: { octave: 2 },
    sampler: { tone: 'nylon', attack: 0.005, release: 0.8, brightness: 0.5, volume: 0.6 },
    output: { volume: 0.4 },
  };

  const presets: Preset[] = [
    {
      // Layout echoes the hardware panel: setup rotaries left, performance
      // knobs center, freeze layering station right column, keys lower half
      name: 'The Tin',
      description: 'The Tin pocket synth — Keys → Compass → Bloom → Tin Voice → X-Factor → Freeze ×3 → Halo → Output, drift cable patched',
      modules: [
        { type: 'compass', position: { x: 0, y: 0 }, params: { root: 'C', mode: 'Ionian', octave: 4 } },
        { type: 'tin-voice', position: { x: 4, y: 0 }, params: { voice: 'sine-pad', sub: 0, level: 0.8 } },
        { type: 'x-factor', position: { x: 8, y: 0 }, params: { x: 0.35 } },
        { type: 'bloom', position: { x: 11, y: 0 }, params: { time: 0 } },
        { type: 'tin-keys', position: { x: 4, y: 6 } },
        { type: 'freeze', key: 'freeze1', position: { x: 15, y: 0 }, params: { freeze: 0, bed_level: 0.7 } },
        { type: 'freeze', key: 'freeze2', position: { x: 15, y: 4 }, params: { freeze: 0, bed_level: 0.7 } },
        { type: 'freeze', key: 'freeze3', position: { x: 15, y: 8 }, params: { freeze: 0, bed_level: 0.7 } },
        { type: 'halo', position: { x: 18, y: 0 }, params: { decay: 6, mix: 0.5, damping: 0.4, shimmer: 0, shimmer_amount: 0.5 } },
        { type: 'output', position: { x: 21, y: 0 }, params: { volume: 0.4 } },
      ],
      connections: [
        { from: { type: 'tin-keys', port: 'degree_out' }, to: { type: 'compass', port: 'degree_in' } },
        { from: { type: 'compass', port: 'note_out' }, to: { type: 'bloom', port: 'note_in' } },
        { from: { type: 'bloom', port: 'note_out' }, to: { type: 'tin-voice', port: 'note_in' } },
        { from: { type: 'x-factor', port: 'drift_out' }, to: { type: 'tin-voice', port: 'drift_in' } },
        { from: { type: 'tin-voice', port: 'audio_out' }, to: { type: 'x-factor', port: 'audio_in' } },
        { from: { type: 'x-factor', port: 'audio_out' }, to: { type: 'freeze1', port: 'audio_in' } },
        { from: { type: 'freeze1', port: 'audio_out' }, to: { type: 'freeze2', port: 'audio_in' } },
        { from: { type: 'freeze2', port: 'audio_out' }, to: { type: 'freeze3', port: 'audio_in' } },
        { from: { type: 'freeze3', port: 'audio_out' }, to: { type: 'halo', port: 'audio_in' } },
        { from: { type: 'halo', port: 'audio_out' }, to: { type: 'output', port: 'audio_in' } },
      ],
    },
    {
      name: 'Tape Lounge',
      description: 'Tape → Filter → Delay → Reverb → Output — warm vinyl lounge with slow filter drift',
      modules: [
        { type: 'tape', position: { x: 0, y: 0 }, params: { volume: 0.8, speed: 1.0, loop: 1 } },
        { type: 'filter', position: { x: 0, y: 3 }, params: { frequency: 3500, Q: 0.8, type: 'lowpass' } },
        { type: 'lfo', position: { x: 3, y: 3 }, params: { rate: 0.15, depth: 0.3, waveform: 'sine' } },
        { type: 'delay', position: { x: 6, y: 3 }, params: { delayTime: 0.4, feedback: 0.2, mix: 0.15 } },
        { type: 'reverb', position: { x: 9, y: 3 }, params: { size: 'hall', decay: 3.5, mix: 0.3, damping: 0.5 } },
        { type: 'output', position: { x: 12, y: 3 }, params: { volume: 0.5 } },
      ],
      connections: [
        { from: { type: 'tape', port: 'audio_out' }, to: { type: 'filter', port: 'audio_in' } },
        { from: { type: 'lfo', port: 'cv_out' }, to: { type: 'filter', port: 'cutoff_cv' } },
        { from: { type: 'filter', port: 'audio_out' }, to: { type: 'delay', port: 'audio_in' } },
        { from: { type: 'delay', port: 'audio_out' }, to: { type: 'reverb', port: 'audio_in' } },
        { from: { type: 'reverb', port: 'audio_out' }, to: { type: 'output', port: 'audio_in' } },
      ],
    },
    {
      name: 'Jukebox',
      description: 'Scroll → Sampler (Grand Piano) → Delay → Reverb → Output — auto-playing song library',
      modules: [
        { type: 'scroll', position: { x: 0, y: 0 }, params: { tempo: 100, transpose: 0, loop: 1 } },
        { type: 'sampler', position: { x: 3, y: 0 }, params: { attack: 0.005, release: 1.5, brightness: 0.5, volume: 0.7 }, instrument: 'salamander-piano' },
        { type: 'delay', position: { x: 7, y: 0 }, params: { delayTime: 0.35, feedback: 0.25, mix: 0.2 } },
        { type: 'reverb', position: { x: 10, y: 0 }, params: { size: 'large', decay: 2.5, mix: 0.3, damping: 0.4 } },
        { type: 'output', position: { x: 13, y: 0 }, params: { volume: 0.5 } },
      ],
      connections: [
        { from: { type: 'scroll', port: 'note_data' }, to: { type: 'sampler', port: 'note_data' } },
        { from: { type: 'sampler', port: 'audio_out' }, to: { type: 'delay', port: 'audio_in' } },
        { from: { type: 'delay', port: 'audio_out' }, to: { type: 'reverb', port: 'audio_in' } },
        { from: { type: 'reverb', port: 'audio_out' }, to: { type: 'output', port: 'audio_in' } },
      ],
    },
    {
      name: 'Simple Tone',
      description: 'Oscillator → Output',
      modules: [
        { type: 'oscillator', position: { x: 2, y: 2 }, params: { waveform: 'sine', frequency: 440 } },
        { type: 'output', position: { x: 6, y: 2 } },
      ],
      connections: [
        { from: { type: 'oscillator', port: 'audio_out' }, to: { type: 'output', port: 'audio_in' } },
      ],
    },
    {
      name: 'Warm Lead',
      description: 'Keyboard → Oscillator → Filter → Output + LFO on filter',
      modules: [
        { type: 'keyboard', position: { x: 0, y: 0 }, params: { octave: 3 } },
        { type: 'oscillator', position: { x: 5, y: 0 }, params: { waveform: 'sawtooth' } },
        { type: 'filter', position: { x: 8, y: 0 }, params: { frequency: 1200, Q: 3, type: 'lowpass' } },
        { type: 'lfo', position: { x: 5, y: 5 }, params: { rate: 0.4, depth: 0.5, waveform: 'sine' } },
        { type: 'output', position: { x: 11, y: 0 }, params: { volume: 0.3 } },
      ],
      connections: [
        { from: { type: 'keyboard', port: 'cv_out' }, to: { type: 'oscillator', port: 'frequency' } },
        { from: { type: 'oscillator', port: 'audio_out' }, to: { type: 'filter', port: 'audio_in' } },
        { from: { type: 'lfo', port: 'cv_out' }, to: { type: 'filter', port: 'cutoff_cv' } },
        { from: { type: 'filter', port: 'audio_out' }, to: { type: 'output', port: 'audio_in' } },
      ],
    },
    {
      name: 'Full Patch',
      description: 'Keyboard + Envelope + Oscillator → Filter → Gain → Delay → Output',
      modules: [
        { type: 'keyboard', position: { x: 0, y: 0 }, params: { octave: 3 } },
        { type: 'envelope', position: { x: 0, y: 5 }, params: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.4 } },
        { type: 'oscillator', position: { x: 5, y: 0 }, params: { waveform: 'sawtooth' } },
        { type: 'filter', position: { x: 8, y: 0 }, params: { frequency: 1000, Q: 4, type: 'lowpass' } },
        { type: 'lfo', position: { x: 8, y: 5 }, params: { rate: 0.3, depth: 0.4, waveform: 'triangle' } },
        { type: 'gain', position: { x: 11, y: 0 }, params: { gain: 0 } },
        { type: 'delay', position: { x: 13, y: 0 }, params: { delayTime: 0.35, feedback: 0.4, mix: 0.3 } },
        { type: 'output', position: { x: 16, y: 0 }, params: { volume: 0.3 } },
      ],
      connections: [
        { from: { type: 'keyboard', port: 'cv_out' }, to: { type: 'oscillator', port: 'frequency' } },
        { from: { type: 'keyboard', port: 'gate_out' }, to: { type: 'envelope', port: 'gate_in' } },
        { from: { type: 'envelope', port: 'cv_out' }, to: { type: 'gain', port: 'gain' } },
        { from: { type: 'oscillator', port: 'audio_out' }, to: { type: 'filter', port: 'audio_in' } },
        { from: { type: 'lfo', port: 'cv_out' }, to: { type: 'filter', port: 'cutoff_cv' } },
        { from: { type: 'filter', port: 'audio_out' }, to: { type: 'gain', port: 'audio_in' } },
        { from: { type: 'gain', port: 'audio_out' }, to: { type: 'delay', port: 'audio_in' } },
        { from: { type: 'delay', port: 'audio_out' }, to: { type: 'output', port: 'audio_in' } },
      ],
    },
    {
      name: 'Sampler Keys',
      description: 'Keyboard → Sampler → Reverb → Monitor → Output — pick a tone or instrument on the sampler',
      modules: [
        { type: 'keyboard', position: { x: 0, y: 1 }, params: { octave: 3 } },
        { type: 'sampler', position: { x: 5, y: 0 }, params: { tone: 'nylon', attack: 0.01, release: 1.2, brightness: 0.35, volume: 0.7 } },
        { type: 'reverb', position: { x: 9, y: 0 }, params: { size: 'medium', decay: 2.5, mix: 0.3, damping: 0.5 } },
        { type: 'monitor', position: { x: 12, y: 0 } },
        { type: 'output', position: { x: 17, y: 0 }, params: { volume: 0.4 } },
      ],
      connections: [
        { from: { type: 'keyboard', port: 'note_data' }, to: { type: 'sampler', port: 'note_data' } },
        { from: { type: 'sampler', port: 'audio_out' }, to: { type: 'reverb', port: 'audio_in' } },
        { from: { type: 'reverb', port: 'audio_out' }, to: { type: 'monitor', port: 'audio_in' } },
        { from: { type: 'monitor', port: 'audio_out' }, to: { type: 'output', port: 'audio_in' } },
      ],
    },
    {
      name: 'Hex Chords',
      description: 'Hex Keys → Sampler (warm pad) → Reverb → Monitor → Output — touch isomorphic keyboard',
      modules: [
        { type: 'hex-keyboard', position: { x: 0, y: 0 }, params: { octave: 3 } },
        { type: 'sampler', position: { x: 0, y: 5 }, params: { tone: 'warm-pad', attack: 0.02, release: 1.0, brightness: 0.35, volume: 0.7 } },
        { type: 'reverb', position: { x: 4, y: 5 }, params: { size: 'large', decay: 2.5, mix: 0.3, damping: 0.4 } },
        { type: 'monitor', position: { x: 7, y: 5 } },
        { type: 'output', position: { x: 12, y: 5 }, params: { volume: 0.4 } },
      ],
      connections: [
        { from: { type: 'hex-keyboard', port: 'note_data' }, to: { type: 'sampler', port: 'note_data' } },
        { from: { type: 'sampler', port: 'audio_out' }, to: { type: 'reverb', port: 'audio_in' } },
        { from: { type: 'reverb', port: 'audio_out' }, to: { type: 'monitor', port: 'audio_in' } },
        { from: { type: 'monitor', port: 'audio_out' }, to: { type: 'output', port: 'audio_in' } },
      ],
    },
    {
      name: 'Hex Qwerty',
      description: 'Hex Qwerty → Sampler (warm pad) → Reverb → Monitor → Output — isomorphic chords on your physical keys',
      modules: [
        { type: 'hex-qwerty', position: { x: 0, y: 0 }, params: { octave: 3 } },
        { type: 'sampler', position: { x: 0, y: 4 }, params: { tone: 'warm-pad', attack: 0.02, release: 1.0, brightness: 0.35, volume: 0.7 } },
        { type: 'reverb', position: { x: 4, y: 4 }, params: { size: 'large', decay: 2.5, mix: 0.3, damping: 0.4 } },
        { type: 'monitor', position: { x: 7, y: 4 } },
        { type: 'output', position: { x: 12, y: 4 }, params: { volume: 0.4 } },
      ],
      connections: [
        { from: { type: 'hex-qwerty', port: 'note_data' }, to: { type: 'sampler', port: 'note_data' } },
        { from: { type: 'sampler', port: 'audio_out' }, to: { type: 'reverb', port: 'audio_in' } },
        { from: { type: 'reverb', port: 'audio_out' }, to: { type: 'monitor', port: 'audio_in' } },
        { from: { type: 'monitor', port: 'audio_out' }, to: { type: 'output', port: 'audio_in' } },
      ],
    },
    {
      name: 'Fretboard',
      description: 'Fretboard → Sampler (nylon) → Reverb → Monitor → Output — four strings in fourths, play the QWERTY rows',
      modules: [
        { type: 'fretboard', position: { x: 0, y: 0 }, params: { octave: 2 } },
        { type: 'sampler', position: { x: 0, y: 3 }, params: { tone: 'nylon', attack: 0.005, release: 0.9, brightness: 0.45, volume: 0.7 } },
        { type: 'reverb', position: { x: 4, y: 3 }, params: { size: 'medium', decay: 2, mix: 0.25, damping: 0.5 } },
        { type: 'monitor', position: { x: 7, y: 3 } },
        { type: 'output', position: { x: 12, y: 3 }, params: { volume: 0.4 } },
      ],
      connections: [
        { from: { type: 'fretboard', port: 'note_data' }, to: { type: 'sampler', port: 'note_data' } },
        { from: { type: 'sampler', port: 'audio_out' }, to: { type: 'reverb', port: 'audio_in' } },
        { from: { type: 'reverb', port: 'audio_out' }, to: { type: 'monitor', port: 'audio_in' } },
        { from: { type: 'monitor', port: 'audio_out' }, to: { type: 'output', port: 'audio_in' } },
      ],
    },
    {
      name: 'Euclid Groove',
      description: 'Euclid gates a filtered saw — hold keyboard keys for pitch, watch the pulse on the Monitor',
      modules: [
        { type: 'euclid', position: { x: 0, y: 0 }, params: { tempo: 116, steps: 16, fills: 5, rotate: 0 } },
        { type: 'keyboard', position: { x: 4, y: 0 }, params: { octave: 2 } },
        { type: 'oscillator', position: { x: 9, y: 0 }, params: { waveform: 'sawtooth' } },
        { type: 'filter', position: { x: 12, y: 0 }, params: { frequency: 1100, Q: 4, type: 'lowpass' } },
        { type: 'gain', position: { x: 15, y: 0 }, params: { gain: 0 } },
        { type: 'delay', position: { x: 17, y: 0 }, params: { delayTime: 0.32, feedback: 0.35, mix: 0.25 } },
        { type: 'envelope', position: { x: 0, y: 5 }, params: { attack: 0.005, decay: 0.12, sustain: 0.25, release: 0.2 } },
        { type: 'monitor', position: { x: 4, y: 5 } },
        { type: 'output', position: { x: 10, y: 5 }, params: { volume: 0.4 } },
      ],
      connections: [
        { from: { type: 'keyboard', port: 'cv_out' }, to: { type: 'oscillator', port: 'frequency' } },
        { from: { type: 'euclid', port: 'gate_out' }, to: { type: 'envelope', port: 'gate_in' } },
        { from: { type: 'envelope', port: 'cv_out' }, to: { type: 'gain', port: 'gain' } },
        { from: { type: 'oscillator', port: 'audio_out' }, to: { type: 'filter', port: 'audio_in' } },
        { from: { type: 'filter', port: 'audio_out' }, to: { type: 'gain', port: 'audio_in' } },
        { from: { type: 'gain', port: 'audio_out' }, to: { type: 'delay', port: 'audio_in' } },
        { from: { type: 'delay', port: 'audio_out' }, to: { type: 'monitor', port: 'audio_in' } },
        { from: { type: 'monitor', port: 'audio_out' }, to: { type: 'output', port: 'audio_in' } },
      ],
    },
    pedalboardPreset(
      'Pedalboard',
      'Foundation / bed — comp breathes, King feeds, wah parked, Blues resting. Build the wet backing here.',
      {
        ...pbCommon,
        squeezer: { sustain: 0.45, level: 0.7, engaged: 1 },
        'king-of-tone': { volume: 0.6, gain: 0.3, tone: 0.5, presence: 0.3, mode: 'od', engaged: 1 },
        'rust-bucket': { volume: 0.7, boost: 0, fuzz: 0, octave: 0 },
        wah: { position: 0.45, engaged: 1 },
        bluesbreaker: { volume: 0.65, gain: 0.4, tone: 0.45, presence: 0.15, mode: 'od', engaged: 0 },
        arp87: { level: 0.4, dampen: 0.45, repeats: 0.3, ratio: 2, x: 0.25, program: 'analog', engaged: 1 },
        hammertone: { time: 0.35, damp: 0.5, level: 0.3, type: 'room', engaged: 1 },
      },
    ),
    {
      name: 'Hex Haze',
      description: 'Chill hex chords — breathing comp, LFO-swept wah, dark analog repeats, long hall. Stomp the Bluesbreaker for grit.',
      modules: [
        { type: 'hex-qwerty', position: { x: 0, y: 0 }, params: { octave: 3 } },
        { type: 'monitor', position: { x: 11, y: 0 } },
        { type: 'lfo', position: { x: 16, y: 0 }, params: { rate: 0.13, depth: 0.35, waveform: 'sine' } },
        { type: 'sampler', position: { x: 0, y: 4 }, params: { tone: 'warm-pad', attack: 0.08, release: 1.6, brightness: 0.3, volume: 0.65 } },
        { type: 'squeezer', position: { x: 4, y: 4 }, params: { sustain: 0.55, level: 0.7, engaged: 1 } },
        { type: 'bluesbreaker', position: { x: 7, y: 4 }, params: { volume: 0.6, gain: 0.5, tone: 0.4, presence: 0.1, mode: 'od', engaged: 0 } },
        { type: 'wah', position: { x: 16, y: 4 }, params: { position: 0.35, engaged: 1 } },
        { type: 'arp87', position: { x: 19, y: 4 }, params: { level: 0.5, dampen: 0.35, repeats: 0.45, ratio: 1, x: 0.4, program: 'analog', trails: 1, engaged: 1 } },
        { type: 'hammertone', position: { x: 0, y: 9 }, params: { time: 0.6, damp: 0.4, level: 0.4, type: 'hall', tone: 1, engaged: 1 } },
        { type: 'output', position: { x: 4, y: 9 }, params: { volume: 0.45 } },
      ],
      connections: [
        { from: { type: 'hex-qwerty', port: 'note_data' }, to: { type: 'sampler', port: 'note_data' } },
        { from: { type: 'sampler', port: 'audio_out' }, to: { type: 'squeezer', port: 'audio_in' } },
        { from: { type: 'squeezer', port: 'audio_out' }, to: { type: 'bluesbreaker', port: 'audio_in' } },
        { from: { type: 'bluesbreaker', port: 'audio_out' }, to: { type: 'wah', port: 'audio_in' } },
        { from: { type: 'lfo', port: 'cv_out' }, to: { type: 'wah', port: 'position_cv' } },
        { from: { type: 'wah', port: 'audio_out' }, to: { type: 'arp87', port: 'audio_in' } },
        { from: { type: 'arp87', port: 'audio_out' }, to: { type: 'hammertone', port: 'audio_in' } },
        { from: { type: 'hammertone', port: 'audio_out' }, to: { type: 'monitor', port: 'audio_in' } },
        { from: { type: 'monitor', port: 'audio_out' }, to: { type: 'output', port: 'audio_in' } },
      ],
    },
    pedalboardPreset(
      'Pedalboard: Lead',
      'Lead — octave singing on single notes, Blues volume bump finishing, reverb pulled back.',
      {
        ...pbCommon,
        squeezer: { sustain: 0.5, level: 0.7, engaged: 1 },
        'king-of-tone': { volume: 0.6, gain: 0.35, tone: 0.5, presence: 0.3, mode: 'od', engaged: 1 },
        'rust-bucket': { volume: 0.7, boost: 1, fuzz: 0, octave: 1 },
        wah: { position: 0.45, engaged: 1 },
        bluesbreaker: { volume: 0.75, gain: 0.45, tone: 0.45, presence: 0.15, mode: 'od', engaged: 1 },
        arp87: { level: 0.45, dampen: 0.45, repeats: 0.35, ratio: 2, x: 0.25, program: 'analog', engaged: 1 },
        hammertone: { time: 0.35, damp: 0.5, level: 0.15, type: 'room', engaged: 1 },
      },
    ),
  ];

  // instrumentPacks imported from '$lib/instruments/index.js'

  async function loadPreset(preset: Preset) {
    // Clear existing modules
    for (const m of [...modules.value]) {
      removeModule(m.id);
    }

    // Add modules and track instance ids by key (alias) or type
    const instanceByType = new Map<string, string>();
    const instrumentLoads: Promise<void>[] = [];

    for (const mod of preset.modules) {
      const instance = addModule(mod.type, mod.position);
      if (instance) {
        instanceByType.set(mod.key ?? mod.type, instance.id);
        if (mod.params) {
          for (const [k, v] of Object.entries(mod.params)) {
            instance.engine.setParameter(k, v);
          }
        }
        // Queue instrument loading if specified
        if (mod.instrument && instrumentPacks[mod.instrument]) {
          const samplerEngine = instance.engine as SamplerEngine;
          instrumentLoads.push(samplerEngine.loadInstrument(instrumentPacks[mod.instrument]));
        }
      }
    }

    // Connect — resolve type references to instance ids
    for (const conn of preset.connections) {
      const fromId = instanceByType.get(conn.from.type);
      const toId = instanceByType.get(conn.to.type);
      if (fromId && toId) {
        connectPorts(
          { moduleId: fromId, portId: conn.from.port },
          { moduleId: toId, portId: conn.to.port },
        );
      }
    }

    refreshAudioState();

    // Load instruments in background (samples stream in, playable once loaded)
    if (instrumentLoads.length > 0) {
      await Promise.all(instrumentLoads).catch(console.warn);
    }
  }

  // ── URL sharing ─────────────────────────────────────────────────────────────

  async function handleShare() {
    const url = await getRackURL();
    if (url) {
      const full = window.location.origin + window.location.pathname + url;
      await navigator.clipboard.writeText(full).catch(() => {});
      alert(`Patch URL copied to clipboard:\n${full}`);
    }
  }

  // ── On mount ────────────────────────────────────────────────────────────────

  onMount(() => {
    const hash = window.location.hash;
    if (hash && hash.length > 1) {
      loadFromURL(hash).catch(console.warn);
    }

    // Wheel and touchmove need { passive: false } so preventDefault() works
    function attachNonPassive() {
      if (!rackViewport) return;
      rackViewport.addEventListener('wheel', onViewportWheel, { passive: false });
      rackViewport.addEventListener('touchmove', onViewportTouchMove, { passive: false });
    }
    Promise.resolve().then(attachNonPassive);

    // Listen for lock events from hex keyboard module
    function onLockEvent(e: Event) {
      rackLocked = (e as CustomEvent).detail.locked;
    }
    window.addEventListener('mycelium-lock', onLockEvent);

    return () => {
      if (!rackViewport) return;
      rackViewport.removeEventListener('wheel', onViewportWheel);
      rackViewport.removeEventListener('touchmove', onViewportTouchMove);
      window.removeEventListener('mycelium-lock', onLockEvent);
    };
  });

  // ── Helpers for rendering ───────────────────────────────────────────────────

  function modulePixelPos(instance: ModuleInstance) {
    // If this module is being dragged, show it at the drag position
    if (dragging && dragging.moduleId === instance.id) {
      return {
        left: dragging.currentCol * CELL,
        top: dragging.currentRow * CELL,
      };
    }
    return {
      left: instance.position.x * CELL,
      top: instance.position.y * CELL,
    };
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="workspace"
  bind:this={rackContainer}
  oncontextmenu={cancelPatch}
  onclick={handleOutsideClick}
>

  <!-- ── Header ────────────────────────────────────────────────────────────── -->
  <header class="header">
    <div class="header-brand">
      <span class="brand-name">Mycelium</span>
      <span class="brand-sub">modular</span>
    </div>

    <!-- Mobile: audio + hamburger -->
    <div class="header-controls-mobile">
      <button
        class="header-btn audio-btn"
        class:audio-on={audioRunning}
        onclick={handleAudioToggle}
        title="Toggle audio engine"
      >
        <span class="btn-led" class:led-on={audioRunning}></span>
        {audioStateLabel}
      </button>
      <button
        class="header-btn header-hamburger"
        onclick={() => { menuOpen = !menuOpen; }}
        title="Menu"
      >&#9776;</button>
    </div>

    <div class="header-controls header-controls-desktop">
      <button
        class="header-btn audio-btn"
        class:audio-on={audioRunning}
        onclick={handleAudioToggle}
        title="Toggle audio engine"
      >
        <span class="btn-led" class:led-on={audioRunning}></span>
        {audioStateLabel}
      </button>

      <button
        class="header-btn"
        class:active={showCables}
        onclick={() => { showCables = !showCables; }}
        title="Toggle patch cables"
      >
        Cables {showCables ? 'On' : 'Off'}
      </button>

      <button
        class="header-btn"
        class:active={browserOpen}
        onclick={() => { browserOpen = !browserOpen; }}
        title="Toggle module browser"
      >
        Modules
      </button>

      <button class="header-btn" onclick={openSave} title="Save rack">Save</button>
      <button class="header-btn" onclick={openLoad} title="Load rack">Load</button>
      <button class="header-btn" onclick={handleShare} title="Share rack as URL">Share</button>

      <select
        class="theme-select"
        onchange={(e) => {
          const sel = e.currentTarget as HTMLSelectElement;
          const idx = parseInt(sel.value);
          if (!isNaN(idx)) {
            loadPreset(presets[idx]);
            sel.value = '';
          }
        }}
        title="Load a preset patch"
      >
        <option value="" disabled selected>Presets</option>
        {#each presets as preset, i}
          <option value={i}>{preset.name}</option>
        {/each}
      </select>

      <select class="theme-select" onchange={handleThemeChange} title="Select theme">
        {#each themes as theme (theme.id)}
          <option value={theme.id} selected={$activeTheme.id === theme.id}>
            {theme.name}
          </option>
        {/each}
      </select>
    </div>

    <!-- Mobile dropdown menu -->
    {#if menuOpen}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div class="mobile-menu" onclick={(e) => e.stopPropagation()}>
        <button
          class="header-btn mobile-menu-btn"
          class:active={showCables}
          onclick={() => { showCables = !showCables; }}
        >Cables {showCables ? 'On' : 'Off'}</button>
        <button
          class="header-btn mobile-menu-btn"
          class:active={browserOpen}
          onclick={() => { browserOpen = !browserOpen; menuOpen = false; }}
        >Modules</button>
        <button class="header-btn mobile-menu-btn" onclick={() => { openSave(); menuOpen = false; }}>Save</button>
        <button class="header-btn mobile-menu-btn" onclick={() => { openLoad(); menuOpen = false; }}>Load</button>
        <button class="header-btn mobile-menu-btn" onclick={() => { handleShare(); menuOpen = false; }}>Share</button>
        <select
          class="theme-select mobile-menu-select"
          onchange={(e) => {
            const sel = e.currentTarget as HTMLSelectElement;
            const idx = parseInt(sel.value);
            if (!isNaN(idx)) {
              loadPreset(presets[idx]);
              sel.value = '';
              menuOpen = false;
            }
          }}
          title="Load a preset patch"
        >
          <option value="" disabled selected>Presets</option>
          {#each presets as preset, i}
            <option value={i}>{preset.name}</option>
          {/each}
        </select>
        <select class="theme-select mobile-menu-select" onchange={(e) => { handleThemeChange(e); menuOpen = false; }} title="Select theme">
          {#each themes as theme (theme.id)}
            <option value={theme.id} selected={$activeTheme.id === theme.id}>
              {theme.name}
            </option>
          {/each}
        </select>
      </div>
    {/if}
  </header>

  <!-- ── Main area ─────────────────────────────────────────────────────────── -->
  <div class="main">

    <!-- Module browser sidebar -->
    {#if browserOpen}
      <aside class="module-browser">
        <div class="browser-title">Modules</div>
        {#each orderedCategories as [category, entries]}
          <div class="browser-category">
            <div class="category-label">{category}</div>
            <div class="category-modules">
              {#each entries as entry}
                <button
                  class="module-card"
                  onclick={() => handleAddModule(entry.manifest.id)}
                  title={entry.manifest.description}
                >
                  <span class="module-card-name">{entry.manifest.name}</span>
                  <span class="module-card-desc">{entry.manifest.description}</span>
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </aside>
    {/if}

    <!-- Rack viewport (clips overflow, handles zoom/pan gestures) -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="rack-viewport"
      bind:this={rackViewport}
      onpointermove={onCanvasPointerMove}
      onpointerup={onCanvasPointerUp}
      onmousemove={onRackMouseMove}
      ontouchstart={onViewportTouchStart}
      ontouchend={onViewportTouchEnd}
    >
      <!-- Transform wrapper — everything inside scales/pans together -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="rack-canvas rack-transform"
        bind:this={rackTransformEl}
        style:transform="translate({panX}px, {panY}px) scale({zoom})"
        style:width="{GRID_COLS * CELL}px"
        style:height="{GRID_ROWS * CELL}px"
      >

        <!-- Grid lines -->
        <svg class="grid-lines" width={GRID_COLS * CELL} height={GRID_ROWS * CELL}>
          {#each Array(GRID_COLS + 1) as _, i}
            <line
              x1={i * CELL} y1={0}
              x2={i * CELL} y2={GRID_ROWS * CELL}
              stroke="var(--grid-line, rgba(90, 74, 58, 0.12))"
              stroke-width="1"
            />
          {/each}
          {#each Array(GRID_ROWS + 1) as _, i}
            <line
              x1={0} y1={i * CELL}
              x2={GRID_COLS * CELL} y2={i * CELL}
              stroke="var(--grid-line, rgba(90, 74, 58, 0.12))"
              stroke-width="1"
            />
          {/each}
        </svg>

        <!-- Drag ghost (shows target position while dragging) -->
        {#if dragging}
          <div
            class="drag-ghost"
            class:invalid={!dragging.valid}
            style:left="{dragging.currentCol * CELL}px"
            style:top="{dragging.currentRow * CELL}px"
            style:width="{dragging.w * CELL}px"
            style:height="{dragging.h * CELL}px"
          ></div>
        {/if}

        <!-- Module instances -->
        {#each modules.value as instance (instance.id)}
          {@const entry = moduleRegistry.get(instance.type)}
          {@const pos = modulePixelPos(instance)}
          {#if entry}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="module-wrapper"
              class:dragging={dragging?.moduleId === instance.id}
              style:left="{pos.left}px"
              style:top="{pos.top}px"
              style:width="{instance.size.w * CELL}px"
              style:height="{instance.size.h * CELL}px"
              data-module-id={instance.id}
              onpointerdown={(e) => onModulePointerDown(e, instance)}
            >
              <entry.component
                engine={instance.engine}
                moduleId={instance.id}
                connectedPorts={getConnectedPorts(instance.id)}
                onPortConnect={(portId: string) => handlePortConnect(instance.id, portId)}
              />

              <button
                class="module-remove"
                title="Remove module"
                onclick={() => removeModule(instance.id)}
              >&times;</button>
            </div>
          {/if}
        {/each}

        <!-- Cable SVG overlays -->
        {#if showCables}
          {#each connections.value as conn (conn.id)}
            {@const ep = cableEndpoints(conn)}
            {#if ep}
              <PatchCable x1={ep.x1} y1={ep.y1} x2={ep.x2} y2={ep.y2} signalActive={true} />
            {/if}
          {/each}

          {#if pendingPort}
            {@const pep = pendingCableEndpoints()}
            {#if pep}
              <PatchCable x1={pep.x1} y1={pep.y1} x2={pep.x2} y2={pep.y2} signalActive={false} />
            {/if}
          {/if}
        {/if}

        <!-- Empty state hint -->
        {#if modules.value.length === 0}
          <div class="empty-hint">
            <p>Select a module from the panel to place it on the grid.</p>
            <p class="empty-hint-sub">Modules snap to the grid. Click ports to patch cables.</p>
          </div>
        {/if}

      </div>
    </div>
  </div>

  <!-- ── Pending patch indicator ───────────────────────────────────────────── -->
  {#if pendingPort}
    <div class="patch-hint">
      Patching from <strong>{pendingPort.portId}</strong> — click a compatible port to connect.
      Right-click to cancel.
    </div>
  {/if}

  <!-- ── Save/Load dialog ──────────────────────────────────────────────────── -->
  {#if saveLoadOpen}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="dialog-overlay" onclick={() => { saveLoadOpen = false; }}>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div class="dialog" onclick={(e) => e.stopPropagation()}>
        <div class="dialog-title">
          {saveLoadMode === 'save' ? 'Save Rack' : 'Load Rack'}
        </div>

        {#if saveLoadMode === 'save'}
          <p class="dialog-text">Save current rack to browser storage.</p>
          <div class="dialog-actions">
            <button class="dialog-btn primary" onclick={handleSave}>Save</button>
            <button class="dialog-btn" onclick={() => { saveLoadOpen = false; }}>Cancel</button>
          </div>
        {:else}
          {#if savedRacks.length === 0}
            <p class="dialog-text">No saved racks found.</p>
          {:else}
            <div class="saved-list">
              {#each savedRacks as saved}
                <button class="saved-item" onclick={() => handleLoad(saved.id)}>
                  {saved.name}
                </button>
              {/each}
            </div>
          {/if}
          <div class="dialog-actions">
            <button class="dialog-btn" onclick={() => { saveLoadOpen = false; }}>Cancel</button>
          </div>
        {/if}
      </div>
    </div>
  {/if}

</div>

<style>
  /* ── Reset ────────────────────────────────────────────────────────────────── */
  :global(*, *::before, *::after) { box-sizing: border-box; }
  :global(body) { margin: 0; padding: 0; overflow: hidden; background: #050c05; }

  /* ── Workspace ────────────────────────────────────────────────────────────── */
  .workspace {
    display: flex;
    flex-direction: column;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background: var(--rack-bg, radial-gradient(ellipse at center, #0d1a0d 0%, #080f08 60%, #050c05 100%));
    font-family: var(--label-font, 'Courier New', monospace);
    color: var(--label-color, #a89880);
  }

  /* ── Header ───────────────────────────────────────────────────────────────── */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: rgba(0, 0, 0, 0.6);
    border-bottom: 1px solid rgba(90, 74, 58, 0.4);
    flex-shrink: 0;
    z-index: 10;
    gap: 12px;
    position: relative;
  }

  .header-brand { display: flex; align-items: baseline; gap: 8px; }
  .brand-name {
    font-size: 18px; font-weight: 600;
    color: var(--module-title-color, #c8b89a);
    letter-spacing: 0.12em; text-transform: uppercase;
  }
  .brand-sub {
    font-size: 11px; color: var(--label-color, #a89880);
    letter-spacing: 0.2em; text-transform: uppercase; opacity: 0.6;
  }

  .header-controls { display: flex; align-items: center; gap: 8px; flex-wrap: nowrap; }

  /* Mobile-only controls row (audio + hamburger) */
  .header-controls-mobile {
    display: none;
    align-items: center;
    gap: 8px;
  }

  /* Hamburger button */
  .header-hamburger { font-size: 16px; padding: 4px 10px; }

  /* Mobile dropdown menu */
  .mobile-menu {
    position: absolute;
    top: 100%;
    right: 0;
    background: rgba(0, 0, 0, 0.95);
    border: 1px solid rgba(90, 74, 58, 0.4);
    border-top: none;
    border-radius: 0 0 6px 6px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    z-index: 50;
    min-width: 180px;
  }

  .mobile-menu-btn { width: 100%; justify-content: flex-start; }
  .mobile-menu-select { width: 100%; }

  @media (max-width: 640px) {
    .header-controls-desktop { display: none !important; }
    .header-controls-mobile { display: flex; }
    .module-browser {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      width: 100%;
      height: 40vh;
      border-right: none;
      border-top: 1px solid rgba(90, 74, 58, 0.4);
      z-index: 20;
    }
  }

  @media (min-width: 641px) {
    .header-controls-mobile { display: none !important; }
    .header-controls-desktop { display: flex; }
  }

  .header-btn {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 11px; color: var(--label-color, #a89880);
    background: rgba(26, 18, 16, 0.8);
    border: 1px solid var(--port-stroke, #5a4a3a);
    border-radius: 3px; padding: 4px 10px; cursor: pointer;
    text-transform: uppercase; letter-spacing: 0.08em;
    display: flex; align-items: center; gap: 6px;
    transition: border-color 0.12s, color 0.12s; white-space: nowrap;
  }
  .header-btn:hover { border-color: var(--port-glow, #7fba5c); color: var(--module-title-color, #c8b89a); }
  .header-btn.active {
    border-color: var(--knob-indicator, #7fba5c);
    color: var(--knob-indicator, #7fba5c);
    background: rgba(127, 186, 92, 0.08);
  }
  .audio-btn.audio-on { border-color: var(--knob-indicator, #7fba5c); color: var(--knob-indicator, #7fba5c); }

  .btn-led {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--port-stroke, #5a4a3a);
    transition: background 0.15s, box-shadow 0.15s;
  }
  .btn-led.led-on { background: var(--port-glow, #7fba5c); box-shadow: 0 0 5px var(--port-glow, #7fba5c); }

  .theme-select {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 11px; color: var(--label-color, #a89880);
    background: rgba(26, 18, 16, 0.8);
    border: 1px solid var(--port-stroke, #5a4a3a);
    border-radius: 3px; padding: 4px 8px; cursor: pointer;
    text-transform: uppercase; letter-spacing: 0.06em; outline: none;
  }
  .theme-select:focus { border-color: var(--port-glow, #7fba5c); }
  .theme-select option { background: #1a1210; }

  /* ── Main area ────────────────────────────────────────────────────────────── */
  .main { display: flex; flex: 1; overflow: hidden; }

  /* ── Module browser ───────────────────────────────────────────────────────── */
  .module-browser {
    width: 200px; flex-shrink: 0;
    background: rgba(0, 0, 0, 0.5);
    border-right: 1px solid rgba(90, 74, 58, 0.4);
    overflow-y: auto; padding: 12px 8px;
    display: flex; flex-direction: column; gap: 12px;
  }
  .module-browser::-webkit-scrollbar { width: 4px; }
  .module-browser::-webkit-scrollbar-track { background: transparent; }
  .module-browser::-webkit-scrollbar-thumb { background: var(--port-stroke, #5a4a3a); border-radius: 2px; }

  .browser-title {
    font-size: 10px; color: var(--module-title-color, #c8b89a);
    text-transform: uppercase; letter-spacing: 0.15em;
    padding-bottom: 6px; border-bottom: 1px solid rgba(90, 74, 58, 0.4);
  }
  .browser-category { display: flex; flex-direction: column; gap: 4px; }
  .category-label {
    font-size: 9px; color: var(--label-color, #a89880);
    text-transform: uppercase; letter-spacing: 0.18em; opacity: 0.6; padding: 2px 4px;
  }
  .category-modules { display: flex; flex-direction: column; gap: 3px; }

  .module-card {
    display: flex; flex-direction: column; gap: 2px;
    background: rgba(42, 31, 26, 0.6);
    border: 1px solid var(--port-stroke, #5a4a3a);
    border-radius: 4px; padding: 7px 10px; cursor: pointer; text-align: left;
    transition: border-color 0.12s, background 0.12s;
  }
  .module-card:hover { border-color: var(--port-glow, #7fba5c); background: rgba(127, 186, 92, 0.06); }
  .module-card-name {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 11px; color: var(--module-title-color, #c8b89a);
    text-transform: uppercase; letter-spacing: 0.08em;
  }
  .module-card-desc {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 9px; color: var(--label-color, #a89880);
    opacity: 0.7; line-height: 1.3; white-space: normal;
  }

  /* ── Rack viewport ────────────────────────────────────────────────────────── */
  .rack-viewport {
    flex: 1;
    position: relative;
    overflow: hidden;
    touch-action: none;
  }

  /* ── Rack canvas (grid) ───────────────────────────────────────────────────── */
  .rack-canvas {
    position: relative;
    cursor: default;
  }

  .rack-transform {
    transform-origin: 0 0;
    position: absolute;
    top: 0;
    left: 0;
  }

  .grid-lines {
    position: absolute;
    top: 0; left: 0;
    pointer-events: none;
    z-index: 0;
  }

  /* ── Drag ghost ───────────────────────────────────────────────────────────── */
  .drag-ghost {
    position: absolute;
    border: 2px dashed var(--port-glow, #7fba5c);
    border-radius: var(--panel-radius, 6px);
    background: rgba(127, 186, 92, 0.06);
    pointer-events: none;
    z-index: 90;
    transition: left 0.08s, top 0.08s;
  }
  .drag-ghost.invalid {
    border-color: #c04040;
    background: rgba(192, 64, 64, 0.08);
  }

  /* ── Module wrapper ───────────────────────────────────────────────────────── */
  .module-wrapper {
    position: absolute;
    cursor: grab;
    user-select: none;
    z-index: 1;
    padding: 4px;
  }
  .module-wrapper.dragging {
    cursor: grabbing;
    z-index: 100;
    opacity: 0.8;
  }

  .module-remove {
    position: absolute; top: 0; right: 0;
    width: 18px; height: 18px; border-radius: 50%;
    background: rgba(26, 18, 16, 0.9);
    border: 1px solid var(--port-stroke, #5a4a3a);
    color: var(--label-color, #a89880);
    font-size: 13px; line-height: 1;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; opacity: 0;
    transition: opacity 0.15s, border-color 0.12s, color 0.12s;
    z-index: 10; padding: 0;
  }
  .module-wrapper:hover .module-remove { opacity: 1; }
  .module-remove:hover { border-color: #c04040; color: #c04040; }

  /* ── Empty hint ───────────────────────────────────────────────────────────── */
  .empty-hint {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 8px; pointer-events: none; user-select: none;
  }
  .empty-hint p {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 13px; color: var(--label-color, #a89880); opacity: 0.4; margin: 0; text-align: center;
  }
  .empty-hint-sub { font-size: 11px !important; opacity: 0.25 !important; }

  /* ── Patch hint ───────────────────────────────────────────────────────────── */
  .patch-hint {
    position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    border: 1px solid var(--port-glow, #7fba5c);
    border-radius: 4px; padding: 6px 16px;
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 11px; color: var(--label-color, #a89880);
    box-shadow: 0 0 12px rgba(127, 255, 127, 0.15);
    pointer-events: none; z-index: 100;
  }
  .patch-hint strong { color: var(--port-glow, #7fba5c); }

  /* ── Dialog ───────────────────────────────────────────────────────────────── */
  .dialog-overlay {
    position: fixed; inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex; align-items: center; justify-content: center; z-index: 200;
  }
  .dialog {
    background: linear-gradient(135deg, #2a1f1a, #1e1510);
    border: 1px solid var(--port-stroke, #5a4a3a);
    border-radius: 6px; padding: 24px;
    min-width: 300px; max-width: 480px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);
  }
  .dialog-title {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 13px; color: var(--module-title-color, #c8b89a);
    text-transform: uppercase; letter-spacing: 0.12em;
    margin-bottom: 16px; padding-bottom: 10px;
    border-bottom: 1px solid rgba(90, 74, 58, 0.4);
  }
  .dialog-text {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 11px; color: var(--label-color, #a89880); margin: 0 0 16px;
  }
  .dialog-actions { display: flex; gap: 8px; justify-content: flex-end; }

  .dialog-btn {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 11px; color: var(--label-color, #a89880);
    background: rgba(26, 18, 16, 0.8);
    border: 1px solid var(--port-stroke, #5a4a3a);
    border-radius: 3px; padding: 5px 14px; cursor: pointer;
    text-transform: uppercase; letter-spacing: 0.08em;
    transition: border-color 0.12s, color 0.12s;
  }
  .dialog-btn:hover { border-color: var(--port-glow, #7fba5c); color: var(--module-title-color, #c8b89a); }
  .dialog-btn.primary { border-color: var(--knob-indicator, #7fba5c); color: var(--knob-indicator, #7fba5c); }
  .dialog-btn.primary:hover { background: rgba(127, 186, 92, 0.12); }

  .saved-list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 16px; max-height: 240px; overflow-y: auto; }
  .saved-item {
    font-family: var(--label-font, 'Courier New', monospace);
    font-size: 11px; color: var(--label-color, #a89880);
    background: rgba(42, 31, 26, 0.5);
    border: 1px solid var(--port-stroke, #5a4a3a);
    border-radius: 3px; padding: 6px 12px; cursor: pointer; text-align: left;
    transition: border-color 0.12s, color 0.12s;
  }
  .saved-item:hover { border-color: var(--port-glow, #7fba5c); color: var(--module-title-color, #c8b89a); }
</style>
