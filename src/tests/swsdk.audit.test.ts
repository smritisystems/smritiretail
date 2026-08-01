import { describe, expect, it } from "vitest";
import { AuditService } from "../sdk/swsdk/runtime/audit/AuditService.js";
import { createPlatformMessage } from "../sdk/swsdk/runtime/kernel/PlatformMessage.js";

describe("AuditService", () => {
  it("records kernel platform messages as audit records", () => {
    const service = new AuditService();
    const record = service.record(createPlatformMessage("KernelEvent", { serviceId: "notification-service", payload: { status: "started" } }));

    expect(record.type).toBe("KernelEvent");
    expect(record.source).toBe("kernel");
    expect(record.payload).toMatchObject({ status: "started" });
    expect(service.list()).toHaveLength(1);
  });

  it("serializes and deserializes records", () => {
    const service = new AuditService();
    const record = service.record(createPlatformMessage("EventEnvelope", { serviceId: "events", correlationId: "corr-1" }));
    const serialized = service.serialize(record);
    const roundTripped = service.deserialize(serialized);

    expect(roundTripped.correlationId).toBe("corr-1");
    expect(roundTripped.type).toBe("EventEnvelope");
  });

  it("exposes the generic storage contract for audit data", () => {
    const service = new AuditService();
    service.record(createPlatformMessage("KernelEvent", { serviceId: "notifications", payload: { status: "started" } }));

    expect(service.readAll()).toHaveLength(1);
    service.clear();
    expect(service.readAll()).toHaveLength(0);
  });

  it("accepts injected storage and serializer implementations", () => {
    const storage = new Map<string, unknown>();
    const customStorage = {
      write: (value: unknown) => storage.set(String((value as { id: string }).id), value),
      readAll: () => Array.from(storage.values()) as unknown[],
      clear: () => storage.clear(),
    };
    const customSerializer = {
      serialize: (value: unknown) => JSON.stringify(value),
      deserialize: (raw: string) => JSON.parse(raw),
    };

    const service = new AuditService(customStorage as any, customSerializer as any);
    const record = service.record(createPlatformMessage("NotificationEnvelope", { serviceId: "notifications", payload: { status: "accepted" } }));

    expect(record.type).toBe("NotificationEnvelope");
    expect(service.list()).toHaveLength(1);
  });
});
