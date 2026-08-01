import type { IPlatformService } from "./IPlatformService.js";
import { createServiceHealth, HealthStatus, type ServiceHealth } from "./HealthStatus.js";
import { createServiceMetrics, type ServiceMetrics } from "./ServiceMetrics.js";
import { createServiceContext, type ServiceContext } from "./ServiceContext.js";
import { createValidationResult, type ValidationResult } from "./ValidationResult.js";
import { ServiceRegistry } from "./ServiceRegistry.js";
import { createServiceDescriptor, type ServiceDescriptor } from "./ServiceDescriptor.js";
import { createDependencyDescriptor, type DependencyDescriptor } from "./DependencyDescriptor.js";

export class PlatformKernel {
  private readonly services = new ServiceRegistry();
  private readonly context: ServiceContext;

  constructor(context: ServiceContext = createServiceContext()) {
    this.context = context;
  }

  public register(service: IPlatformService, id: string, descriptor: ServiceDescriptor = createServiceDescriptor({
    id,
    name: id,
    version: service.version(),
    capabilities: service.capabilities().map((capability) => capability.id),
    dependencies: (service.health().dependencies ?? []).map((dependencyId) => createDependencyDescriptor({
      serviceId: dependencyId,
      minimumVersion: service.version(),
      reason: "runtime dependency"
    })),
    contracts: service.capabilities().flatMap((capability) => capability.contracts)
  })): void {
    this.services.register(service, id, descriptor);
  }

  public unregister(id: string): boolean {
    return this.services.unregister(id);
  }

  public resolve(id: string): IPlatformService | undefined {
    return this.services.resolve(id);
  }

  public resolveAll(): IPlatformService[] {
    return this.services.resolveAll();
  }

  public describe(id: string): ServiceDescriptor | undefined {
    return this.services.describe(id);
  }

  public listServices(): ServiceDescriptor[] {
    return this.services.descriptors();
  }

  public dependencies(): DependencyDescriptor[] {
    return this.services.dependencies();
  }

  public async initializeAll(): Promise<void> {
    for (const service of this.services.all()) {
      service.initialize();
    }
  }

  public async startAll(): Promise<void> {
    for (const service of this.services.all()) {
      service.start();
    }
  }

  public async stopAll(): Promise<void> {
    for (const service of this.services.all()) {
      service.stop();
    }
  }

  public async disposeAll(): Promise<void> {
    for (const service of this.services.all()) {
      service.dispose();
    }
  }

  public health(): Record<string, ServiceHealth> {
    return this.services.health();
  }

  public metrics(): Record<string, ServiceMetrics> {
    return this.services.metrics();
  }

  public validateDescriptors(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const seen = new Set<string>();

    for (const descriptor of this.services.descriptors()) {
      if (seen.has(descriptor.id)) {
        errors.push(`Duplicate descriptor id: ${descriptor.id}`);
      }
      seen.add(descriptor.id);

      if (!descriptor.name || !descriptor.version) {
        errors.push(`Descriptor missing identity metadata for service: ${descriptor.id}`);
      }
    }

    return createValidationResult({ valid: errors.length === 0, errors, warnings });
  }

  public validateDependencies(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const service of this.services.all()) {
      const descriptor = this.services.describe(service.id);
      const dependencies = descriptor?.dependencies ?? [];

      for (const dependency of dependencies) {
        if (!this.services.has(dependency.serviceId)) {
          errors.push(`${service.id} depends on missing service: ${dependency.serviceId}`);
        }
      }
    }

    return createValidationResult({ valid: errors.length === 0, errors, warnings });
  }

  public validateCapabilities(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const service of this.services.all()) {
      const capabilities = service.capabilities();
      const seen = new Set<string>();
      for (const capability of capabilities) {
        if (seen.has(capability.id)) {
          errors.push(`Duplicate capability id for service ${service.id}: ${capability.id}`);
        }
        seen.add(capability.id);
      }
    }

    return createValidationResult({ valid: errors.length === 0, errors, warnings });
  }

  public validateConfiguration(): ValidationResult {
    return createValidationResult({ valid: true, warnings: [], errors: [], recommendations: [] });
  }

  public async start(): Promise<ValidationResult> {
    const descriptorValidation = this.validateDescriptors();
    if (!descriptorValidation.valid) {
      return createValidationResult({ valid: false, errors: descriptorValidation.errors, warnings: descriptorValidation.warnings });
    }

    const dependencyValidation = this.validateDependencies();
    if (!dependencyValidation.valid) {
      return createValidationResult({ valid: false, errors: dependencyValidation.errors, warnings: dependencyValidation.warnings });
    }

    const capabilityValidation = this.validateCapabilities();
    if (!capabilityValidation.valid) {
      return createValidationResult({ valid: false, errors: capabilityValidation.errors, warnings: capabilityValidation.warnings });
    }

    const configValidation = this.validateConfiguration();
    if (!configValidation.valid) {
      return createValidationResult({ valid: false, errors: configValidation.errors, warnings: configValidation.warnings });
    }

    await this.initializeAll();
    await this.startAll();
    return createValidationResult({ valid: true, warnings: [], errors: [], recommendations: [] });
  }

  public overallHealth(): { status: HealthStatus; services: Array<{ id: string; health: ServiceHealth }> } {
    const services = this.services.all().map((service) => ({ id: service.id, health: service.health() }));
    const overallStatus = services.some((entry) => entry.health.status === HealthStatus.Unavailable)
      ? HealthStatus.Unavailable
      : services.some((entry) => entry.health.status === HealthStatus.Degraded)
        ? HealthStatus.Degraded
        : HealthStatus.Healthy;

    return {
      status: overallStatus,
      services: services.map((entry) => ({
        id: entry.id,
        health: entry.health
      }))
    };
  }

  public validate(): ValidationResult {
    const errors: string[] = [];
    const dependencyValidation = this.validateDependencies();
    if (!dependencyValidation.valid) {
      errors.push(...dependencyValidation.errors);
    }

    const descriptorValidation = this.validateDescriptors();
    if (!descriptorValidation.valid) {
      errors.push(...descriptorValidation.errors);
    }

    for (const service of this.services.all()) {
      const validation = service.validate();
      if (!validation.valid) {
        errors.push(...validation.errors);
      }
    }

    return createValidationResult({ valid: errors.length === 0, errors, warnings: [] });
  }

  public contextValue(): ServiceContext {
    return this.context;
  }
}
