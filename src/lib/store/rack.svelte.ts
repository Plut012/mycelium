/**
 * Rack store — the single source of truth for UI state.
 *
 * Wraps the Rack class from the engine layer and exposes reactive state
 * via Svelte 5 runes. The Rack handles audio graph management; this store
 * handles UI reactivity and serialization triggers.
 */

import { Rack } from '$lib/engine/Rack.js';
import { moduleRegistry } from '$lib/modules/registry.js';
import type { ModuleInstance, Connection, PortRef } from '$lib/engine/Rack.js';

// ── Audio context ─────────────────────────────────────────────────────────────

let audioContext: AudioContext | null = null;
let rack: Rack | null = null;

export function initAudio(): void {
  if (audioContext) {
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    return;
  }
  audioContext = new AudioContext();
  rack = new Rack(audioContext);
}

export function getAudioState(): 'uninitialized' | 'suspended' | 'running' | 'closed' {
  if (!audioContext) return 'uninitialized';
  return audioContext.state as 'suspended' | 'running' | 'closed';
}

export async function toggleAudio(): Promise<void> {
  if (!audioContext) {
    initAudio();
    return;
  }
  if (audioContext.state === 'running') {
    await audioContext.suspend();
  } else if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
}

// ── Reactive state ────────────────────────────────────────────────────────────

// Svelte 5 doesn't allow exporting reassigned $state. Use an object wrapper.
const rackState = $state({
  modules: [] as ModuleInstance[],
  connections: [] as Connection[],
  name: 'Untitled Rack',
  themeId: 'ancient-forest',
});

// Export readonly accessors
export const modules = {
  get value() { return rackState.modules; }
};
export const connections = {
  get value() { return rackState.connections; }
};
export const rackName = {
  get value() { return rackState.name; }
};
export const activeThemeId = {
  get value() { return rackState.themeId; }
};

function syncFromRack(): void {
  if (!rack) return;
  rackState.modules = [...rack.modules.values()];
  rackState.connections = [...rack.connections];
  rackState.name = rack.name;
  rackState.themeId = rack.theme;
}

// ── Module management ─────────────────────────────────────────────────────────

export function addModule(typeId: string, position: { x: number; y: number }): ModuleInstance | null {
  if (!rack) {
    initAudio();
  }
  if (!rack) return null;

  const entry = moduleRegistry.get(typeId);
  if (!entry) {
    console.warn(`Unknown module type: "${typeId}"`);
    return null;
  }

  const engine = entry.createEngine();
  const instance = rack.addModule(engine, entry.manifest, position);
  syncFromRack();
  return instance;
}

export function removeModule(id: string): void {
  if (!rack) return;
  rack.removeModule(id);
  syncFromRack();
}

export function updateModulePosition(id: string, position: { x: number; y: number }): void {
  if (!rack) return;
  const instance = rack.modules.get(id);
  if (!instance) return;
  instance.position = { ...position };
  rackState.modules = [...rack.modules.values()];
}

export function updateParameter(moduleId: string, paramId: string, value: number | string): void {
  if (!rack) return;
  const instance = rack.modules.get(moduleId);
  if (!instance) return;
  instance.engine.setParameter(paramId, value);
}

// ── Connection management ─────────────────────────────────────────────────────

export function connectPorts(from: PortRef, to: PortRef): Connection | null {
  if (!rack) return null;
  try {
    const conn = rack.connect(from, to);
    syncFromRack();
    return conn;
  } catch (e) {
    console.warn('Connection failed:', e);
    return null;
  }
}

export function disconnectPorts(connectionId: string): void {
  if (!rack) return;
  rack.disconnect(connectionId);
  syncFromRack();
}

// ── Derived helpers ───────────────────────────────────────────────────────────

export function getConnectedPorts(moduleId: string): Set<string> {
  const portIds = new Set<string>();
  for (const conn of rackState.connections) {
    if (conn.from.moduleId === moduleId) portIds.add(conn.from.portId);
    if (conn.to.moduleId === moduleId) portIds.add(conn.to.portId);
  }
  return portIds;
}

// ── Persistence ───────────────────────────────────────────────────────────────

export async function saveRack(): Promise<void> {
  if (!rack) return;
  await rack.save();
}

export async function listSaves(): Promise<{ id: string; name: string }[]> {
  return Rack.listSaved();
}

export async function loadRack(id: string): Promise<void> {
  const state = await Rack.loadState(id);
  if (!state) {
    console.warn(`No saved rack with id "${id}"`);
    return;
  }

  if (!audioContext) initAudio();
  if (!rack || !audioContext) return;

  for (const existing of [...rack.modules.keys()]) {
    rack.removeModule(existing);
  }

  rack.id = state.id;
  rack.name = state.name;
  rack.theme = state.theme;

  for (const saved of state.modules) {
    const entry = moduleRegistry.get(saved.type);
    if (!entry) {
      console.warn(`Unknown module type in saved rack: "${saved.type}" — skipping`);
      continue;
    }
    const engine = entry.createEngine();
    rack.addModule(engine, entry.manifest, saved.position, saved.id);
    for (const [paramId, value] of Object.entries(saved.parameters)) {
      engine.setParameter(paramId, value);
    }
  }

  for (const saved of state.connections) {
    try {
      rack.connect(saved.from, saved.to);
    } catch (e) {
      console.warn('Could not restore connection:', saved, e);
    }
  }

  syncFromRack();
}

export async function getRackURL(): Promise<string> {
  if (!rack) return '';
  return rack.toURL();
}

export async function loadFromURL(hash: string): Promise<void> {
  try {
    const state = await Rack.fromURLHash(hash);
    if (!audioContext) initAudio();
    if (!rack || !audioContext) return;

    for (const existing of [...rack.modules.keys()]) {
      rack.removeModule(existing);
    }

    rack.id = state.id;
    rack.name = state.name;
    rack.theme = state.theme;

    for (const saved of state.modules) {
      const entry = moduleRegistry.get(saved.type);
      if (!entry) continue;
      const engine = entry.createEngine();
      rack.addModule(engine, entry.manifest, saved.position, saved.id);
      for (const [paramId, value] of Object.entries(saved.parameters)) {
        engine.setParameter(paramId, value);
      }
    }

    for (const saved of state.connections) {
      try {
        rack.connect(saved.from, saved.to);
      } catch (e) {
        console.warn('Could not restore connection from URL:', saved, e);
      }
    }

    syncFromRack();
  } catch (e) {
    console.warn('Failed to load rack from URL:', e);
  }
}

export function setRackName(name: string): void {
  if (!rack) return;
  rack.name = name;
  rackState.name = name;
}

export function setRackTheme(themeId: string): void {
  if (!rack) return;
  rack.theme = themeId;
  rackState.themeId = themeId;
}
