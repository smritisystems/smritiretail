import { beforeEach, describe, expect, it } from "vitest";
import { EventService } from "../sdk/swsdk/runtime/events/EventService.js";
import { EventRegistry } from "../sdk/swsdk/runtime/events/EventRegistry.js";
import { createEventEnvelope } from "../sdk/swsdk/runtime/events/EventEnvelope.js";
import { NotificationService } from "../sdk/swsdk/runtime/notifications/NotificationService.js";
import { NotificationRegistry } from "../sdk/swsdk/runtime/notifications/NotificationRegistry.js";
import { MemoryNotificationAdapter } from "../sdk/swsdk/runtime/notifications/adapters/MemoryNotificationAdapter.js";

describe("SWSDK notification service", () => {
  let eventService: EventService;
  let notificationService: NotificationService;
  let adapter: MemoryNotificationAdapter;

  beforeEach(() => {
    eventService = new EventService();
    adapter = new MemoryNotificationAdapter();
    const registry = EventRegistry.getInstance();
    registry.clear();
    const registration = registry.register("workspace.registered", "1.0");
    registry.markPublishable("workspace.registered", registration.version);

    const notificationRegistry = NotificationRegistry.getInstance();
    notificationRegistry.clear();
    notificationRegistry.registerDefinition({
      id: "welcome-definition",
      code: "workspace.welcome",
      category: "workspace",
      priority: "normal",
      channels: ["email"],
      requiredCapabilities: ["notifications"],
      templateVersion: "1.0",
      schemaVersion: "1.0"
    });
    notificationRegistry.registerChannel("email");
    notificationRegistry.registerTemplate({
      id: "welcome-template",
      name: "workspace-welcome",
      eventType: "workspace.registered",
      channel: "email",
      subject: "Welcome {{workspaceId}}",
      body: "Hello {{workspaceId}}"
    });

    notificationService = new NotificationService(eventService, notificationRegistry, [adapter]);
    notificationService.bind("workspace.registered", "welcome-template", { recipient: "ops@example.com", workspaceId: "demo.workspace" });
  });

  it("delivers notifications from stage 4 events through notification envelopes", async () => {
    await eventService.publish({
      eventType: "workspace.registered",
      payload: { workspaceId: "demo.workspace" },
      source: "test",
      tenantId: "tenant-a"
    });

    const sent = adapter.getSentNotifications();
    expect(sent).toHaveLength(1);
    expect(sent[0].notificationType).toBe("workspace.registered");
    expect(sent[0].channel).toBe("email");
    expect(sent[0].renderedBody).toContain("demo.workspace");
    expect(sent[0].recipient).toBe("ops@example.com");
  });

  it("rejects unknown notification templates", async () => {
    const freshAdapter = new MemoryNotificationAdapter();
    const freshRegistry = NotificationRegistry.getInstance();
    freshRegistry.clear();
    const freshService = new NotificationService(eventService, freshRegistry, [freshAdapter]);

    const result = freshService.bind("workspace.registered", "missing-template", { recipient: "ops@example.com" });
    expect(result).toBe(false);

    await eventService.publish({
      eventType: "workspace.registered",
      payload: { workspaceId: "demo.workspace" },
      source: "test",
      tenantId: "tenant-a"
    });
    await Promise.resolve();

    expect(freshAdapter.getSentNotifications()).toHaveLength(0);
  });

  it("suppresses duplicate notifications and tracks health", async () => {
    const envelope = createEventEnvelope({
      eventType: "workspace.registered",
      payload: { workspaceId: "demo.workspace" },
      source: "test",
      tenantId: "tenant-a"
    });

    await notificationService.handle(envelope);
    await notificationService.handle(envelope);

    expect(adapter.getSentNotifications()).toHaveLength(1);
    expect(notificationService.getHealth().sent).toBe(1);
    expect(notificationService.getHealth().failed).toBe(0);
    expect(notificationService.getReceipts()).toHaveLength(1);
    expect(notificationService.validate().valid).toBe(true);
  });
});
