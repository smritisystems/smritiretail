export interface NotificationEnvelope {
  id: string;
  notificationType: string;
  channel: string;
  templateId: string;
  priority: "low" | "normal" | "high";
  audience: string[];
  payload: Record<string, unknown>;
  correlationId?: string;
  tenantId?: string;
  createdAt: string;
}

export function createNotificationEnvelope(input: Omit<NotificationEnvelope, "id" | "createdAt"> & { id?: string; createdAt?: string }): NotificationEnvelope {
  return {
    id: input.id ?? `notification-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: input.createdAt ?? new Date().toISOString(),
    ...input
  };
}
