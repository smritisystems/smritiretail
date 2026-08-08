import type { CapabilityDescriptor } from "./CapabilityDescriptor.js";
import type { ServiceContext } from "./ServiceContext.js";
import type { ServiceHealth } from "./HealthStatus.js";
import type { ServiceMetrics } from "./ServiceMetrics.js";
import type { ValidationResult } from "./ValidationResult.js";

export interface IPlatformService {
  initialize(): void;
  start(): void;
  stop(): void;
  dispose(): void;
}

export interface IHealthProvider {
  health(): ServiceHealth;
}

export interface IMetricsProvider {
  metrics(): ServiceMetrics;
}

export interface IValidationProvider {
  validate(): ValidationResult;
}

export interface ICapabilityProvider {
  capabilities(): CapabilityDescriptor[];
}

export interface IVersionProvider {
  version(): string;
}

export interface IServiceContextAware {
  context: ServiceContext;
}
