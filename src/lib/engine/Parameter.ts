export type ParameterType = "continuous" | "stepped" | "toggle" | "select";

export interface ParameterDefinition {
  id: string;
  name: string;
  type: ParameterType;
  min?: number;
  max?: number;
  default: number | string;
  unit?: string;
  /** For "select" type: ordered list of option labels */
  steps?: string[];
}

/** Clamp a numeric value to the parameter's min/max bounds */
export function clampParameter(def: ParameterDefinition, value: number): number {
  const lo = def.min ?? -Infinity;
  const hi = def.max ?? Infinity;
  return Math.min(hi, Math.max(lo, value));
}

/** Return the numeric default, or 0 for string defaults (select options handled by caller) */
export function numericDefault(def: ParameterDefinition): number {
  return typeof def.default === "number" ? def.default : 0;
}
