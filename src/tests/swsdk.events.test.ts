import { beforeEach, describe, expect, it } from "vitest";
import { EventService } from "../sdk/swsdk/runtime/events/EventService.js";
import { EventRegistry } from "../sdk/swsdk/runtime/events/EventRegistry.js";
import { RetryStrategy } from "../sdk/swsdk/runtime/events/RetryPolicy.js";
import { createEventEnvelope } from "../sdk/swsdk/runtime/events/EventEnvelope.js";
import { EventValidator } from "../sdk/swsdk/runtime/events/EventValidator.js";
import { WorkspaceRegistry, type WorkspaceBundle } from "../sdk/swsdk/runtime/WorkspaceRegistry.js";
import { createRegistrationSignature, type RegistrationManifest } from "../sdk/swsdk/runtime/RegistrationService.js";

describe("SWSDK platform event service", () => {
  let eventService: EventService;

  beforeEach(() => {
    eventService = new EventService();
    const registry = EventRegistry.getInstance();
    registry.clear();
    ["workspace.registered", "workspace.failed", "workspace.retry"].forEach((eventType) => {
      const registration = registry.register(eventType, "1.0");
      registry.markPublishable(eventType, registration.version);
    });
  });

  it("publishes envelopes to registered subscribers", () => {
    const seen: string[] = [];

    eventService.subscribe("workspace.registered", (event) => {
      seen.push(event.payload.workspaceId as string);
    });

    const result = eventService.publish({
      eventType: "workspace.registered",
      payload: { workspaceId: "demo.workspace" },
      source: "test",
      tenantId: "tenant-a"
    });

    expect(result.delivered).toBe(1);
    expect(result.failed).toBe(0);
    expect(seen).toEqual(["demo.workspace"]);
  });

  it("captures dead letters for failing handlers", () => {
    eventService.subscribe("workspace.failed", () => {
      throw new Error("handler exploded");
    });

    const result = eventService.publish({
      eventType: "workspace.failed",
      payload: { workspaceId: "demo.workspace" },
      source: "test",
      tenantId: "tenant-a"
    });

    expect(result.delivered).toBe(0);
    expect(result.failed).toBe(1);
    expect(eventService.getDeadLetters()).toHaveLength(1);
    expect(eventService.getDeadLetters()[0].eventEnvelope.eventType).toBe("workspace.failed");
  });

  it("supports multiple subscribers and preserves ordering", () => {
    const seen: string[] = [];
    eventService.subscribe("workspace.registered", (event) => {
      seen.push(`first:${event.payload.workspaceId as string}`);
    });
    eventService.subscribe("workspace.registered", (event) => {
      seen.push(`second:${event.payload.workspaceId as string}`);
    });

    eventService.publish({
      eventType: "workspace.registered",
      payload: { workspaceId: "demo.workspace" },
      source: "test",
      tenantId: "tenant-a"
    });

    expect(seen).toEqual(["first:demo.workspace", "second:demo.workspace"]);
  });

  it("serializes and deserializes event envelopes", () => {
    const envelope = createEventEnvelope({
      eventType: "workspace.registered",
      payload: { workspaceId: "demo.workspace" },
      source: "test",
      tenantId: "tenant-a"
    });

    const serialized = eventService.serialize(envelope);
    const roundTripped = eventService.deserialize(serialized);

    expect(roundTripped.eventType).toBe(envelope.eventType);
    expect(roundTripped.payload.workspaceId).toBe("demo.workspace");
  });

  it("validates event registry definitions and rejects unknown versions", () => {
    const registry = EventRegistry.getInstance();
    const registration = registry.register("workspace.registered", "1.0");

    expect(registration.lifecycle).toBe("Register");
    expect(registry.validate(createEventEnvelope({
      eventType: "workspace.registered",
      payload: { workspaceId: "demo.workspace" },
      source: "test",
      tenantId: "tenant-a"
    }))).toBe(false);

    registry.markPublishable("workspace.registered", "1.0");
    expect(registry.resolve("workspace.registered", "1.0")?.version).toBe("1.0");
    expect(registry.resolve("workspace.registered", "1.0")?.lifecycle).toBe("Publishable");
  });

  it("rejects unknown events and validates envelopes before publication", () => {
    const registry = EventRegistry.getInstance();
    const envelope = createEventEnvelope({
      eventType: "workspace.unknown",
      payload: { workspaceId: "demo.workspace" },
      source: "test",
      tenantId: "tenant-a"
    });

    expect(registry.validate(envelope)).toBe(false);
    expect(() => eventService.publish({
      eventType: "workspace.unknown",
      payload: { workspaceId: "demo.workspace" },
      source: "test",
      tenantId: "tenant-a"
    })).toThrow(/not registered/);
  });

  it("supports serializer substitution and records metrics", () => {
    const serializationSeen = eventService.serialize(createEventEnvelope({
      eventType: "workspace.registered",
      payload: { workspaceId: "demo.workspace" },
      source: "test",
      tenantId: "tenant-a"
    }));

    expect(serializationSeen).toContain("workspace.registered");
    expect(eventService.getMetrics().published).toBe(0);
  });

  it("verifies the full registration-to-subscriber integration path", () => {
    const workspaceRegistry = WorkspaceRegistry.getInstance();
    workspaceRegistry.clear();

    const bundle: WorkspaceBundle = {
      manifest: {
        schemaVersion: "1.0",
        workspaceId: "demo.workspace",
        title: "Demo Workspace",
        module: "Platform",
        icon: "cube",
        route: "/demo",
        category: "Operations",
        supports: {
          drafts: false,
          resume: false,
          tabs: true,
          attachments: false,
          workflow: false,
          timeline: false,
          print: false,
          export: false,
          analytics: false,
          barcode: false,
          notifications: false
        }
      },
      capabilities: {
        schemaVersion: "1.0",
        workspaceId: "demo.workspace",
        capabilities: ["analytics"]
      }
    };

    const registration: RegistrationManifest = {
      workspaceId: "demo.workspace",
      manifestVersion: "1.0",
      registeredAt: "2026-08-01T00:00:00.000Z",
      publisher: "smriti-platform",
      signature: {
        algorithm: "sha256",
        value: "",
        key: "test-secret"
      },
      compatibility: {
        constitution: "1.x",
        spc: "1.x",
        sdk: "1.x",
        designSystem: "1.x"
      }
    };
    registration.signature.value = createRegistrationSignature(registration);

    const registrationResult = workspaceRegistry.registerWorkspace(bundle, registration);
    expect(registrationResult.valid).toBe(true);
    expect(workspaceRegistry.getRegistrationRecord("demo.workspace")?.status).toBe("registered");

    const deliveries: string[] = [];
    eventService.subscribe("workspace.registered", (event) => {
      deliveries.push(event.payload.workspaceId as string);
    });

    const result = eventService.publish({
      eventType: "workspace.registered",
      payload: { workspaceId: "demo.workspace" },
      source: "test",
      tenantId: "tenant-a",
      correlationId: "corr-portal"
    });

    const serialized = eventService.serialize(createEventEnvelope({
      eventType: "workspace.registered",
      payload: { workspaceId: "demo.workspace" },
      source: "test",
      tenantId: "tenant-a"
    }));
    const roundTripped = eventService.deserialize(serialized);

    expect(result.delivered).toBe(1);
    expect(result.failed).toBe(0);
    expect(deliveries).toEqual(["demo.workspace"]);
    expect(roundTripped.eventType).toBe("workspace.registered");
    expect(roundTripped.payload.workspaceId).toBe("demo.workspace");
  });

  it("rejects duplicate idempotency keys and exposes health metrics", () => {
    eventService.publish({
      eventType: "workspace.registered",
      payload: { workspaceId: "demo.workspace" },
      source: "test",
      tenantId: "tenant-a",
      idempotencyKey: "dup-1"
    });

    expect(() => eventService.publish({
      eventType: "workspace.registered",
      payload: { workspaceId: "demo.workspace" },
      source: "test",
      tenantId: "tenant-a",
      idempotencyKey: "dup-1"
    })).toThrow(/Duplicate event idempotency key/);

    expect(eventService.getMetrics().published).toBe(1);
    expect(eventService.getHealth().status).toBe("healthy");
  });

  it("rejects envelopes that fail validator rules", () => {
    const envelope = createEventEnvelope({
      eventType: "workspace.registered",
      payload: { workspaceId: "demo.workspace" },
      source: "test",
      tenantId: "tenant-a"
    });

    delete (envelope as Partial<Record<string, unknown>>).correlationId;
    const validation = EventValidator.validate(envelope);

    expect(validation.valid).toBe(false);
    expect(validation.errors.some((error) => error.includes("correlationId"))).toBe(true);
  });

  it("rejects deprecated events and incompatible versions", () => {
    const registry = EventRegistry.getInstance();
    const registration = registry.register("workspace.deprecated", "1.0", { deprecated: true, replacement: "workspace.registered", compatibility: "none" });
    registry.markDeprecated("workspace.deprecated", registration.version);

    const envelope = createEventEnvelope({
      eventType: "workspace.deprecated",
      payload: { workspaceId: "demo.workspace" },
      source: "test",
      tenantId: "tenant-a"
    });

    expect(registry.validate(envelope)).toBe(true);
    expect(registry.resolve("workspace.deprecated", "1.0")?.deprecated).toBe(true);
  });

  it("propagates correlation metadata and isolates tenants", () => {
    const seen: Array<{ correlationId: string; tenantId: string }> = [];
    eventService.subscribe("workspace.registered", (event) => {
      seen.push({ correlationId: event.correlationId, tenantId: event.tenantId });
    });

    eventService.publish({
      eventType: "workspace.registered",
      payload: { workspaceId: "demo.workspace" },
      source: "test",
      tenantId: "tenant-a",
      correlationId: "corr-123"
    });

    expect(seen[0].correlationId).toBe("corr-123");
    expect(seen[0].tenantId).toBe("tenant-a");
  });

  it("uses the configured retry policy for transient failures", () => {
    const service = new EventService(undefined, {
      strategy: RetryStrategy.Fixed,
      maxAttempts: 2,
      baseDelayMs: 0,
      maxDelayMs: 0
    });

    let attempts = 0;
    service.subscribe("workspace.retry", () => {
      attempts += 1;
      if (attempts < 2) {
        throw new Error("transient");
      }
    });

    const result = service.publish({
      eventType: "workspace.retry",
      payload: { workspaceId: "demo.workspace" },
      source: "test",
      tenantId: "tenant-a"
    });

    expect(result.delivered).toBe(1);
    expect(result.failed).toBe(0);
    expect(attempts).toBe(2);
  });
});
