import type { IPlatformObject } from "../api/IPlatformObject.js";

export abstract class PlatformObject implements IPlatformObject {
  public readonly id: string;
  public readonly createdAt: string;
  public readonly updatedAt: string;
  public readonly version: string;
  public readonly metadata?: Record<string, unknown>;

  protected constructor(overrides: Partial<IPlatformObject> = {}) {
    this.id = overrides.id ?? `obj-${Date.now()}`;
    this.createdAt = overrides.createdAt ?? new Date().toISOString();
    this.updatedAt = overrides.updatedAt ?? this.createdAt;
    this.version = overrides.version ?? "1.0.0";
    this.metadata = overrides.metadata ?? {};
  }
}
