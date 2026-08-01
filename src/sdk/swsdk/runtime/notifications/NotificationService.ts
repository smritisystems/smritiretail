import type { EventEnvelope } from "../events/EventEnvelope.js";
import type { EventService } from "../events/EventService.js";
import type { CapabilityDescriptor } from "../kernel/CapabilityDescriptor.js";
import { createCapabilityDescriptor } from "../kernel/CapabilityDescriptor.js";
import { createServiceContext, type ServiceContext } from "../kernel/ServiceContext.js";
import { createServiceHealth, type ServiceHealth, HealthStatus } from "../kernel/HealthStatus.js";
import { createServiceMetrics, type ServiceMetrics } from "../kernel/ServiceMetrics.js";
import { createValidationResult, type ValidationResult } from "../kernel/ValidationResult.js";
import type { IPlatformService } from "../kernel/IPlatformService.js";
import { createNotificationEnvelope, type NotificationEnvelope } from "./NotificationEnvelope.js";
import { createNotificationLifecycle, NotificationLifecycleStatus } from "./NotificationLifecycle.js";
import { createNotificationReceipt, type NotificationReceipt } from "./NotificationReceipt.js";
import { DefaultDeliveryPolicy, type DeliveryPolicy } from "./DeliveryPolicy.js";
import { NotificationRegistry, type NotificationTemplate } from "./NotificationRegistry.js";
import type { NotificationHealth } from "./NotificationHealth.js";
import { TemplateRenderer } from "./TemplateRenderer.js";

export interface NotificationAdapter {
  readonly kind: string;
  send(template: NotificationTemplate, context: Record<string, unknown>, envelope: NotificationEnvelope): Promise<void>;
}

export class NotificationService implements IPlatformService {
  public id = "notification-service";
  private readonly renderer = new TemplateRenderer();
  private readonly seenIds = new Set<string>();
  private readonly receipts: NotificationReceipt[] = [];
  private readonly policies = new Map<string, DeliveryPolicy>();
  public context: ServiceContext;
  private readonly healthState: NotificationHealth = {
    queued: 0,
    sent: 0,
    failed: 0,
    retried: 0,
    deadLetter: 0,
    suppressed: 0
  };
  private readonly metricsState: ServiceMetrics = createServiceMetrics();

  constructor(
    private readonly eventService: EventService,
    private readonly registry: NotificationRegistry = NotificationRegistry.getInstance(),
    private readonly adapters: NotificationAdapter[] = [],
    context: ServiceContext = createServiceContext()
  ) {
    this.context = context;
    this.eventService.subscribe("workspace.registered", (envelope) => {
      void this.handle(envelope);
    });
  }

  public bind(eventType: string, templateId: string, context: Record<string, unknown>): boolean {
    const template = this.registry.resolveTemplate(templateId);
    if (!template || template.eventType !== eventType) {
      return false;
    }

    this.registry.bind({ eventType, templateId, context });
    return true;
  }

  public initialize(): void {
    this.policies.set("default", DefaultDeliveryPolicy);
  }

  public start(): void {
    this.initialize();
  }

  public stop(): void {
    this.healthState.suppressed = 0;
  }

  public dispose(): void {
    this.healthState.suppressed = 0;
  }

  public health(): ServiceHealth {
    return createServiceHealth({
      status: this.healthState.failed > 0 ? HealthStatus.Degraded : HealthStatus.Healthy,
      dependencies: ["event-service"],
      version: this.version(),
      metrics: {
        queued: this.healthState.queued,
        sent: this.healthState.sent,
        failed: this.healthState.failed,
        suppressed: this.healthState.suppressed
      }
    });
  }

  public metrics(): ServiceMetrics {
    return { ...this.metricsState, success: this.healthState.sent, failure: this.healthState.failed, queueDepth: this.healthState.queued };
  }

  public validate(): ValidationResult {
    const errors = this.adapters.length > 0 ? [] : ["No notification adapters configured"];
    return createValidationResult({ valid: errors.length === 0, errors });
  }

  public version(): string {
    return "1.0.0";
  }

  public capabilities(): CapabilityDescriptor[] {
    return [createCapabilityDescriptor({ id: "notifications", version: this.version(), contracts: ["notification-envelope", "receipt", "delivery-policy"] })];
  }

  public setDeliveryPolicy(templateId: string, policy: DeliveryPolicy): void {
    this.policies.set(templateId, policy);
  }

  public getReceipts(): NotificationReceipt[] {
    return [...this.receipts];
  }

  public async handle(envelope: EventEnvelope): Promise<void> {
    const bindings = this.registry.listBindings();
    const relevant = bindings.filter((binding) => binding.eventType === envelope.eventType);

    for (const binding of relevant) {
      const template = this.registry.resolveTemplate(binding.templateId);
      if (!template) {
        continue;
      }

      const notificationEnvelope = createNotificationEnvelope({
        id: `notification-${envelope.id}`,
        notificationType: envelope.eventType,
        channel: template.channel,
        templateId: template.id,
        priority: "normal",
        audience: [String(binding.context.recipient ?? "unknown")],
        payload: { ...envelope.payload, ...binding.context },
        correlationId: envelope.correlationId,
        tenantId: envelope.tenantId,
      });

      if (this.seenIds.has(notificationEnvelope.id)) {
        this.healthState.suppressed += 1;
        continue;
      }
      this.seenIds.add(notificationEnvelope.id);
      this.healthState.queued += 1;

      const lifecycle = createNotificationLifecycle(NotificationLifecycleStatus.Rendering);
      const policy = this.policies.get(template.id) ?? DefaultDeliveryPolicy;
      const rendered = this.renderer.render(template, notificationEnvelope);
      const adaptedEnvelope = { ...notificationEnvelope, payload: { ...notificationEnvelope.payload, renderedSubject: rendered.subject, renderedBody: rendered.body } };

      for (const adapter of this.adapters) {
        try {
          await adapter.send(template, binding.context, adaptedEnvelope);
          this.healthState.sent += 1;
          this.receipts.push(createNotificationReceipt({
            notificationId: notificationEnvelope.id,
            adapter: adapter.kind,
            status: "delivered",
            attempt: 1,
            latency: 1,
            metadata: { lifecycle: lifecycle.status, policy: policy.kind }
          }));
        } catch {
          this.healthState.failed += 1;
          this.healthState.deadLetter += 1;
          this.receipts.push(createNotificationReceipt({
            notificationId: notificationEnvelope.id,
            adapter: adapter.kind,
            status: "failed",
            attempt: 1,
            latency: 1,
            metadata: { lifecycle: lifecycle.status, policy: policy.kind }
          }));
        }
      }
    }
  }

  public getHealth(): NotificationHealth {
    return { ...this.healthState };
  }
}
