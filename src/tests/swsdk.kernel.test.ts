import { describe, expect, it } from "vitest";
import type { IPlatformService } from "../sdk/swsdk/runtime/kernel/IPlatformService.js";
import { PlatformKernel } from "../sdk/swsdk/runtime/kernel/PlatformKernel.js";
import { createServiceHealth, HealthStatus } from "../sdk/swsdk/runtime/kernel/HealthStatus.js";
import { createValidationResult } from "../sdk/swsdk/runtime/kernel/ValidationResult.js";
import { createCapabilityDescriptor } from "../sdk/swsdk/runtime/kernel/CapabilityDescriptor.js";
import { createServiceDescriptor } from "../sdk/swsdk/runtime/kernel/ServiceDescriptor.js";
import { createDependencyDescriptor } from "../sdk/swsdk/runtime/kernel/DependencyDescriptor.js";
import { LifecycleManager } from "../sdk/swsdk/runtime/kernel/LifecycleManager.js";
import { createKernelManifest } from "../sdk/swsdk/runtime/kernel/KernelManifest.js";
import { KernelBootstrap } from "../sdk/swsdk/runtime/kernel/KernelBootstrap.js";
import { createPlatformMessage, type PlatformMessage } from "../sdk/swsdk/runtime/kernel/PlatformMessage.js";

const createTestService = (id: string, dependencies: string[] = []): IPlatformService => ({
  id,
  initialize: () => undefined,
  start: () => undefined,
  stop: () => undefined,
  dispose: () => undefined,
  health: () => createServiceHealth({ status: HealthStatus.Healthy, dependencies, version: "1.0.0" }),
  metrics: () => ({ requests: 1, success: 1, failure: 0, latency: 1, throughput: 1, memory: 1, queueDepth: 0 }),
  validate: () => createValidationResult({ valid: true }),
  version: () => "1.0.0",
  capabilities: () => [createCapabilityDescriptor({ id, version: "1.0.0", contracts: ["kernel" ] })],
  context: undefined
});

describe("PlatformKernel", () => {
  it("tracks descriptors and validates service dependencies", () => {
    const kernel = new PlatformKernel();
    const registry = createTestService("registry");
    const notifier = createTestService("notification-service", ["registry"]);

    kernel.register(registry, "registry", createServiceDescriptor({
      id: "registry",
      name: "registry",
      version: "1.0.0",
      capabilities: ["lookup"],
      dependencies: []
    }));

    kernel.register(notifier, "notification-service", createServiceDescriptor({
      id: "notification-service",
      name: "notification-service",
      version: "1.0.0",
      capabilities: ["notification"],
      dependencies: [createDependencyDescriptor({ serviceId: "registry", reason: "needs registry" })]
    }));

    const dependencyCheck = kernel.validateDependencies();
    expect(dependencyCheck.valid).toBe(true);
    expect(kernel.resolve("notification-service")?.id).toBe("notification-service");
    expect(kernel.describe("notification-service")?.dependencies.map((dependency) => dependency.serviceId)).toContain("registry");
  });

  it("rejects duplicate service registration", () => {
    const kernel = new PlatformKernel();
    kernel.register(createTestService("svc"), "svc");

    expect(() => kernel.register(createTestService("svc2"), "svc")).toThrow();
  });

  it("aggregates the overall system health status", () => {
    const kernel = new PlatformKernel();
    kernel.register(createTestService("a"), "a");
    kernel.register(createTestService("b"), "b");

    const health = kernel.overallHealth();
    expect(health.status).toBe(HealthStatus.Healthy);
    expect(health.services).toHaveLength(2);
  });

  it("runs lifecycle steps in the correct order", async () => {
    const calls: string[] = [];
    const lifecycle = new LifecycleManager([
      {
        id: "svc",
        initialize: () => calls.push("initialize"),
        start: () => calls.push("start"),
        stop: () => calls.push("stop"),
        dispose: () => calls.push("dispose"),
        validate: () => ({ valid: true, warnings: [], errors: [], recommendations: [] }),
        health: () => createServiceHealth({ status: HealthStatus.Healthy }),
        metrics: () => ({ requests: 0, success: 0, failure: 0, latency: 0, throughput: 0, memory: 0, queueDepth: 0 }),
        version: () => "1.0.0",
        capabilities: () => [],
        context: undefined,
      }
    ]);

    await lifecycle.initialize();
    await lifecycle.start();
    await lifecycle.stop();
    await lifecycle.dispose();

    expect(calls).toEqual(["initialize", "start", "stop", "dispose"]);
  });

  it("builds a kernel manifest snapshot", () => {
    const kernel = new PlatformKernel();
    kernel.register(createTestService("svc"), "svc");

    const manifest = createKernelManifest({ kernelVersion: "1.0.0-dev", services: kernel.listServices() });
    expect(manifest.kernelVersion).toBe("1.0.0-dev");
    expect(manifest.services.map((service) => service.id)).toContain("svc");
  });

  it("bootstraps a kernel with a configured context", async () => {
    const kernel = await KernelBootstrap.bootstrap({
      config: { runtime: { environment: "test" } },
      services: [{ id: "svc", service: createTestService("svc") }]
    });

    expect(kernel.resolve("svc")?.id).toBe("svc");
    expect(kernel.contextValue().config?.runtime).toEqual({ environment: "test" });
    expect(KernelBootstrap.API_VERSION).toBe("1.0.0");
  });

  it("validates platform kernel document orchestration metadata", () => {
    const validation = PlatformKernelValidator.validate();
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it("uses a shared platform message contract", () => {
    const message = createPlatformMessage("KernelEvent", { serviceId: "svc" });
    expect(message.type).toBe("KernelEvent");
    expect(message.serviceId).toBe("svc");
    expect(typeof message.timestamp).toBe("string");
  });
});
