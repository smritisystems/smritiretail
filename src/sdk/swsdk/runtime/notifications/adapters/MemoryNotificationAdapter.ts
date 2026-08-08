import type { NotificationEnvelope } from "../NotificationEnvelope.js";
import type { NotificationAdapter } from "../NotificationService.js";
import type { NotificationTemplate } from "../NotificationRegistry.js";

export interface SentNotification {
  templateId: string;
  recipient: string;
  channel: string;
  notificationType: string;
  renderedBody: string;
  payload: Record<string, unknown>;
}

export class MemoryNotificationAdapter implements NotificationAdapter {
  public readonly kind = "memory";
  private readonly sentNotifications: SentNotification[] = [];

  public async send(template: NotificationTemplate, context: Record<string, unknown>, envelope: NotificationEnvelope): Promise<void> {
    const renderedBody = String((envelope.payload as Record<string, unknown>).renderedBody ?? "");
    this.sentNotifications.push({
      templateId: template.id,
      recipient: String(context.recipient ?? "unknown"),
      channel: template.channel,
      notificationType: envelope.notificationType,
      renderedBody,
      payload: { template, context, envelope }
    });
  }

  public getSentNotifications(): SentNotification[] {
    return [...this.sentNotifications];
  }
}
