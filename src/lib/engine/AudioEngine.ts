export type AudioContextState = "suspended" | "running" | "closed";

/**
 * Thin wrapper around the global AudioContext.
 *
 * Browsers require a user gesture before audio can play. This class starts
 * the context in a suspended state and resumes it on the first user
 * interaction. The Rack owns the AudioContext instance; this class just
 * manages its lifecycle.
 */
export class AudioEngine {
  private context: AudioContext;
  private _onStateChange: ((state: AudioContextState) => void) | null = null;

  constructor() {
    this.context = new AudioContext();
    this.context.addEventListener("statechange", () => {
      this._onStateChange?.(this.state);
    });
  }

  get audioContext(): AudioContext {
    return this.context;
  }

  get state(): AudioContextState {
    return this.context.state as AudioContextState;
  }

  get isRunning(): boolean {
    return this.context.state === "running";
  }

  get isSuspended(): boolean {
    return this.context.state === "suspended";
  }

  get isClosed(): boolean {
    return this.context.state === "closed";
  }

  /**
   * Resume the AudioContext. Call this in response to a user gesture (click,
   * keydown, etc.) to satisfy browser autoplay policy.
   */
  async resume(): Promise<void> {
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  async suspend(): Promise<void> {
    if (this.context.state === "running") {
      await this.context.suspend();
    }
  }

  async close(): Promise<void> {
    if (this.context.state !== "closed") {
      await this.context.close();
    }
  }

  /** Register a callback that fires whenever the context state changes. */
  onStateChange(cb: (state: AudioContextState) => void): void {
    this._onStateChange = cb;
  }

  /**
   * Attach a one-time resume listener to a DOM element.
   * Useful for wiring autoplay unlock to a button or the document body.
   */
  attachResumeListener(target: EventTarget = document): () => void {
    const handler = () => {
      this.resume();
    };
    target.addEventListener("click", handler, { once: true });
    target.addEventListener("keydown", handler, { once: true });
    // Return a cleanup function
    return () => {
      target.removeEventListener("click", handler);
      target.removeEventListener("keydown", handler);
    };
  }
}
