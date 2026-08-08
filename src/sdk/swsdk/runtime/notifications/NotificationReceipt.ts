export interface NotificationReceipt {
  notificationId: string;
  adapter: string;
  providerId?: string;
  sentAt: string;
  deliveredAt?: string;
  status: "sent" | "delivered" | "failed";
  attempt: number;
  latency: number;
  metadata?: Record<string, unknown>;
}

export function createNotificationReceipt(input: Omit<NotificationReceipt, "sentAt"> & { sentAt?: string }): NotificationReceipt {
  return {
    sentAt: input.sentAt ?? new Date().toISOString(),
    ...input
  };
}
