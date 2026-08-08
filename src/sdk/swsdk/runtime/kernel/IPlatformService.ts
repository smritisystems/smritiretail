import type { CapabilityDescriptor } from "./CapabilityDescriptor.js";
import type { ServiceContext } from "./ServiceContext.js";
import type { ServiceHealth } from "./HealthStatus.js";
import type { ServiceMetrics } from "./ServiceMetrics.js";
import type { ValidationResult } from "./ValidationResult.js";

export interface IPlatformService {
  id: string;
  initialize(): void;
  start(): void;
  stop(): void;
  dispose(): void;
  health(): ServiceHealth;
  metrics(): ServiceMetrics;
  validate(): ValidationResult;
  version(): string;
  capabilities(): CapabilityDescriptor[];
  context?: ServiceContext;
}
