import type { IPlatformService } from "./IPlatformService.js";
import { createServiceDescriptor, type ServiceDescriptor } from "./ServiceDescriptor.js";
import type { DependencyDescriptor } from "./DependencyDescriptor.js";
import type { ServiceHealth } from "./HealthStatus.js";
import type { ServiceMetrics } from "./ServiceMetrics.js";

export class ServiceRegistry {
  private readonly services = new Map<string, IPlatformService>();
  private readonly descriptorMap = new Map<string, ServiceDescriptor>();

  public register(service: IPlatformService, id: string, descriptor: ServiceDescriptor = createServiceDescriptor({
    id,
    name: id,
    version: service.version(),
    capabilities: service.capabilities().map((capability) => capability.id),
    dependencies: (service.health().dependencies ?? []).map((dependencyId) => ({
      serviceId: dependencyId,
      minimumVersion: "0.0.0",
      optional: false,
      reason: "runtime dependency"
    })),
    contracts: service.capabilities().flatMap((capability) => capability.contracts)
  })): void {
    if (this.services.has(id)) {
      throw new Error(`Duplicate service registration: ${id}`);
    }
    this.services.set(id, service);
    this.descriptorMap.set(id, descriptor);
  }

  public unregister(id: string): boolean {
    const removed = this.services.delete(id);
    this.descriptorMap.delete(id);
    return removed;
  }

  public resolve(id: string): IPlatformService | undefined {
    return this.services.get(id);
  }

  public resolveAll(): IPlatformService[] {
    return Array.from(this.services.values());
  }

  public describe(id: string): ServiceDescriptor | undefined {
    return this.descriptorMap.get(id);
  }

  public descriptors(): ServiceDescriptor[] {
    return Array.from(this.descriptorMap.values());
  }

  public dependencies(): DependencyDescriptor[] {
    return Array.from(this.descriptorMap.values()).flatMap((descriptor) => descriptor.dependencies);
  }

  public health(): Record<string, ServiceHealth> {
    return Array.from(this.services.entries()).reduce<Record<string, ServiceHealth>>((accumulator, entry) => {
      const [id, service] = entry as [string, IPlatformService];
      accumulator[id] = service.health();
      return accumulator;
    }, {});
  }

  public metrics(): Record<string, ServiceMetrics> {
    return Array.from(this.services.entries()).reduce<Record<string, ServiceMetrics>>((accumulator, entry) => {
      const [id, service] = entry as [string, IPlatformService];
      accumulator[id] = service.metrics();
      return accumulator;
    }, {});
  }

  public has(id: string): boolean {
    return this.services.has(id);
  }

  public all(): IPlatformService[] {
    return Array.from(this.services.values());
  }

  public allDescriptors(): ServiceDescriptor[] {
    return Array.from(this.descriptorMap.values());
  }

  public ids(): string[] {
    return Array.from(this.services.keys());
  }
}
