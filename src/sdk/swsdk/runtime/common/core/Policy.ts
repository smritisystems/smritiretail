import type { IPolicy } from "../api/IPolicy.js";

export class Policy implements IPolicy {
  public readonly kind: string;
  public readonly enabled: boolean;
  public readonly version: string;

  constructor(kind: string, overrides: Partial<IPolicy> = {}) {
    this.kind = kind;
    this.enabled = overrides.enabled ?? true;
    this.version = overrides.version ?? "1.0.0";
  }
}

export function createPolicy(kind: string, overrides: Partial<IPolicy> = {}): Policy {
  return new Policy(kind, overrides);
}
