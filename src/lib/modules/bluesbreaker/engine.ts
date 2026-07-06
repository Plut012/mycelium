import { ToTDriveEngine, BLUES_VOICING } from '../king-of-tone/engine.js';

/**
 * BluesbreakerEngine — Throne of Tone, Bluesbreaker voicing.
 *
 * Same op-amp + feedback-diode topology as the King side (shared
 * ToTDriveEngine core); voicing constants give it the mid push, softer
 * clip knee, darker tone sweep and post-clip squish. The finisher:
 * re-saturates the parked-wah peak, bump Volume for a lead jump.
 */
export class BluesbreakerEngine extends ToTDriveEngine {
  constructor() {
    super(BLUES_VOICING);
  }
}
