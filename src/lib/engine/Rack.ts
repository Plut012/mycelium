import type { ModuleEngine, ModuleManifest } from "./Module.js";
import type { SporeListener } from "./Port.js";

// ── Types ─────────────────────────────────────────────────────────────────

export interface ModuleInstance {
  id: string;
  type: string;
  engine: ModuleEngine;
  /** Grid coordinates (column, row) — not pixels */
  position: { x: number; y: number };
  /** Size in grid units */
  size: { w: number; h: number };
  manifest: ModuleManifest;
}

export interface PortRef {
  moduleId: string;
  portId: string;
}

export interface Connection {
  id: string;
  from: PortRef;
  to: PortRef;
}

export interface RackState {
  id: string;
  name: string;
  modules: {
    id: string;
    type: string;
    position: { x: number; y: number };
    size: { w: number; h: number };
    parameters: Record<string, number | string>;
  }[];
  connections: {
    id: string;
    from: PortRef;
    to: PortRef;
  }[];
  theme: string;
}

// ── IndexedDB helpers ─────────────────────────────────────────────────────

const DB_NAME = "mycelium";
const DB_VERSION = 1;
const STORE_NAME = "racks";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Compression helpers ───────────────────────────────────────────────────

async function compress(data: string): Promise<string> {
  const bytes = new TextEncoder().encode(data);
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const compressed = await new Response(cs.readable).arrayBuffer();
  // base64url encode
  return btoa(String.fromCharCode(...new Uint8Array(compressed)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function decompress(encoded: string): Promise<string> {
  // base64url decode
  const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const decompressed = await new Response(ds.readable).arrayBuffer();
  return new TextDecoder().decode(decompressed);
}

// ── Rack ──────────────────────────────────────────────────────────────────

/**
 * The Rack owns the AudioContext and manages the full module graph.
 *
 * It keeps two parallel structures in sync:
 *   - modules / connections  — UI/serialization state
 *   - Web Audio API graph     — actual signal routing
 */
export class Rack {
  readonly audioContext: AudioContext;

  modules = new Map<string, ModuleInstance>();
  connections: Connection[] = [];

  /** Stable rack identity — used as the IndexedDB key */
  id: string;
  name: string;
  theme: string;

  constructor(audioContext?: AudioContext) {
    this.audioContext = audioContext ?? new AudioContext();
    this.id = crypto.randomUUID();
    this.name = "Untitled Rack";
    this.theme = "ancient-forest";
  }

  // ── Module management ───────────────────────────────────────────────────

  /**
   * Add a module to the rack. The manifest's registry entry must be passed
   * by the caller (the store or UI layer knows the registry; the Rack doesn't).
   */
  addModule(
    engine: ModuleEngine,
    manifest: ModuleManifest,
    position: { x: number; y: number },
    id?: string
  ): ModuleInstance {
    const instanceId = id ?? crypto.randomUUID();
    engine.create(this.audioContext);

    const instance: ModuleInstance = {
      id: instanceId,
      type: manifest.id,
      engine,
      position,
      size: { w: manifest.gridWidth ?? 3, h: manifest.gridHeight ?? 4 },
      manifest,
    };

    this.modules.set(instanceId, instance);
    return instance;
  }

  removeModule(id: string): void {
    const instance = this.modules.get(id);
    if (!instance) return;

    // Tear down all connections involving this module first
    const affected = this.connections.filter(
      (c) => c.from.moduleId === id || c.to.moduleId === id
    );
    for (const conn of affected) {
      this.disconnect(conn.id);
    }

    instance.engine.destroy();
    this.modules.delete(id);
  }

  // ── Connection management ───────────────────────────────────────────────

  /** Active spore listeners keyed by connection id, for cleanup on disconnect. */
  private sporeCleanup = new Map<string, () => void>();

  connect(from: PortRef, to: PortRef): Connection {
    const srcModule = this.modules.get(from.moduleId);
    const dstModule = this.modules.get(to.moduleId);

    if (!srcModule) throw new Error(`Source module "${from.moduleId}" not found`);
    if (!dstModule) throw new Error(`Destination module "${to.moduleId}" not found`);

    // Prevent duplicate connections
    const existing = this.connections.find(
      (c) =>
        c.from.moduleId === from.moduleId &&
        c.from.portId === from.portId &&
        c.to.moduleId === to.moduleId &&
        c.to.portId === to.portId
    );
    if (existing) return existing;

    // Determine if this is a spore connection
    const srcPort = srcModule.manifest.outputs.find((p) => p.id === from.portId);
    const isSpore = srcPort?.type === "spore";

    const connection: Connection = {
      id: crypto.randomUUID(),
      from,
      to,
    };

    if (isSpore) {
      // Spore connections: wire up callback from source to destination
      // The destination module receives spore data via its onSpore handler.
      // We forward the source's emitSpore to the destination's onSpore.
      const listener: SporeListener = (data) => {
        // Forward spore data — destination module's engine receives it
        const listeners = (dstModule.engine as any).sporeListeners?.get(to.portId);
        if (listeners) {
          for (const fn of listeners) fn(data);
        }
      };
      const unsub = srcModule.engine.onSpore(from.portId, listener);
      this.sporeCleanup.set(connection.id, unsub);
    } else {
      // Audio/control connections: wire through Web Audio API
      srcModule.engine.connect(dstModule.engine, from.portId, to.portId);
    }

    this.connections.push(connection);
    return connection;
  }

  disconnect(connectionId: string): void {
    const idx = this.connections.findIndex((c) => c.id === connectionId);
    if (idx === -1) return;

    const conn = this.connections[idx];

    // Clean up spore subscription if applicable
    const cleanup = this.sporeCleanup.get(connectionId);
    if (cleanup) {
      cleanup();
      this.sporeCleanup.delete(connectionId);
    } else {
      // Audio/control: disconnect Web Audio nodes
      const srcModule = this.modules.get(conn.from.moduleId);
      const dstModule = this.modules.get(conn.to.moduleId);
      if (srcModule && dstModule) {
        srcModule.engine.disconnect(dstModule.engine, conn.from.portId, conn.to.portId);
      }
    }

    this.connections.splice(idx, 1);
  }

  // ── Serialization ───────────────────────────────────────────────────────

  serialize(): RackState {
    const modules: RackState["modules"] = [];

    for (const instance of this.modules.values()) {
      // Collect current parameter values by reading back from the engine.
      // We store them as the manifest's default if not tracked separately —
      // concrete module engines should expose their own getParameters() if
      // they need per-instance persistence. For now we snapshot defaults.
      const parameters: Record<string, number | string> = {};
      for (const param of instance.manifest.parameters) {
        parameters[param.id] = param.default;
      }

      modules.push({
        id: instance.id,
        type: instance.type,
        position: { ...instance.position },
        size: { ...instance.size },
        parameters,
      });
    }

    return {
      id: this.id,
      name: this.name,
      modules,
      connections: this.connections.map((c) => ({
        id: c.id,
        from: { ...c.from },
        to: { ...c.to },
      })),
      theme: this.theme,
    };
  }

  // ── Persistence ─────────────────────────────────────────────────────────

  async save(): Promise<void> {
    const state = this.serialize();
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(state);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  static async loadState(id: string): Promise<RackState | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => resolve((req.result as RackState) ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  static async listSaved(): Promise<{ id: string; name: string }[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        const results = (req.result as RackState[]).map((r) => ({
          id: r.id,
          name: r.name,
        }));
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  }

  static async deleteSaved(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ── URL sharing ─────────────────────────────────────────────────────────

  async toURL(): Promise<string> {
    const state = this.serialize();
    const json = JSON.stringify(state);
    const hash = await compress(json);
    return `#${hash}`;
  }

  static async fromURLHash(hash: string): Promise<RackState> {
    const encoded = hash.startsWith("#") ? hash.slice(1) : hash;
    const json = await decompress(encoded);
    return JSON.parse(json) as RackState;
  }
}
