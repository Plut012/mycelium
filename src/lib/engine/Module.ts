import type { PortDefinition, SporePayload, SporeListener } from "./Port.js";
import type { ParameterDefinition } from "./Parameter.js";

export type ModuleCategory =
  | "source"
  | "filter"
  | "effect"
  | "modulation"
  | "utility"
  | "output";

export interface ModuleManifest {
  id: string;
  name: string;
  category: ModuleCategory;
  description: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  parameters: ParameterDefinition[];
  /** Module width in grid units (default 3) */
  gridWidth?: number;
  /** Module height in grid units (default 4) */
  gridHeight?: number;
}

/**
 * Base class for all module audio engines.
 *
 * Subclasses register their AudioNodes/AudioParams by calling
 * registerInputNode / registerOutputNode in create(). The Rack then uses
 * getInputNode / getOutputNode to wire connections without knowing the
 * internal structure of any module.
 *
 * Works identically for stock AudioNodes and AudioWorklet-based modules —
 * both expose their connection points via the same port-keyed maps.
 */
export abstract class ModuleEngine {
  /** AudioNode (or AudioWorkletNode) that receives signal on each input port */
  protected inputNodes = new Map<string, AudioNode | AudioParam>();

  /** AudioNode that emits signal on each output port */
  protected outputNodes = new Map<string, AudioNode>();

  /** Spore listeners: portId -> Set of callbacks (for data ports) */
  private sporeListeners = new Map<string, Set<SporeListener>>();

  // ── Lifecycle ────────────────────────────────────────────────────────────

  /** Create all AudioNodes using the provided context. Called once by the Rack. */
  abstract create(ctx: AudioContext): void;

  /** Release all resources. Called when the module is removed from the rack. */
  abstract destroy(): void;

  // ── Parameters ───────────────────────────────────────────────────────────

  /** Set a named parameter value (knob turn, slider move, etc.). */
  abstract setParameter(name: string, value: number | string): void;

  // ── Visualisation ────────────────────────────────────────────────────────

  /**
   * Optional signal visualisation tap.
   * Return an AnalyserNode if the module wants to expose real-time signal
   * data to the UI. Return null if not needed (zero cost — no allocations).
   */
  abstract getAnalyserNode(): AnalyserNode | null;

  // ── Port registration (called by subclasses inside create()) ─────────────

  protected registerInputNode(portId: string, node: AudioNode | AudioParam): void {
    this.inputNodes.set(portId, node);
  }

  protected registerOutputNode(portId: string, node: AudioNode): void {
    this.outputNodes.set(portId, node);
  }

  // ── Port access (called by the Rack) ─────────────────────────────────────

  /** Return the AudioNode or AudioParam that accepts signal on the given input port. */
  getInputNode(portId: string): AudioNode | AudioParam | undefined {
    return this.inputNodes.get(portId);
  }

  /** Return the AudioNode that emits signal on the given output port. */
  getOutputNode(portId: string): AudioNode | undefined {
    return this.outputNodes.get(portId);
  }

  // ── Spore (data) ports ───────────────────────────────────────────────────

  /** Emit data from a spore output port. All connected listeners receive it. */
  protected emitSpore(portId: string, data: SporePayload): void {
    const listeners = this.sporeListeners.get(portId);
    if (listeners) {
      for (const fn of listeners) fn(data);
    }
  }

  /** Subscribe to spore data on a given port. Returns unsubscribe function. */
  onSpore(portId: string, listener: SporeListener): () => void {
    if (!this.sporeListeners.has(portId)) {
      this.sporeListeners.set(portId, new Set());
    }
    this.sporeListeners.get(portId)!.add(listener);
    return () => {
      this.sporeListeners.get(portId)?.delete(listener);
    };
  }

  /** Remove a specific spore listener. */
  offSpore(portId: string, listener: SporeListener): void {
    this.sporeListeners.get(portId)?.delete(listener);
  }

  // ── Wiring (delegated to the Rack, but convenient to have here too) ──────

  /**
   * Connect one of this module's output ports to an input port on another module.
   * The Rack calls this; subclasses should not need to override it.
   */
  connect(target: ModuleEngine, outputPortId: string, inputPortId: string): void {
    const src = this.outputNodes.get(outputPortId);
    const dst = target.inputNodes.get(inputPortId);

    if (!src) throw new Error(`Output port "${outputPortId}" not found`);
    if (!dst) throw new Error(`Input port "${inputPortId}" not found on target`);

    // AudioNode.connect() accepts both AudioNode and AudioParam
    src.connect(dst as AudioNode);
  }

  /**
   * Disconnect this module's output port from an input port on another module.
   */
  disconnect(target: ModuleEngine, outputPortId: string, inputPortId: string): void {
    const src = this.outputNodes.get(outputPortId);
    const dst = target.inputNodes.get(inputPortId);

    if (!src) return; // already destroyed — silently skip
    if (!dst) return;

    try {
      src.disconnect(dst as AudioNode);
    } catch {
      // disconnect() throws if the connection doesn't exist — ignore
    }
  }
}
