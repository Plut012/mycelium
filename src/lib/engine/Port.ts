export type PortType = "audio" | "control" | "spore";
export type PortDirection = "input" | "output";

export interface PortDefinition {
  id: string;
  name: string;
  type: PortType;
  direction: PortDirection;
}

/**
 * Spore ports carry structured data (not audio signal).
 * Any module can define its own payload shape.
 */
export type SporePayload = Record<string, unknown>;

export type SporeListener = (data: SporePayload) => void;
