export enum NotificationLifecycleStatus {
  Draft = "draft",
  Queued = "queued",
  Rendering = "rendering",
  Ready = "ready",
  Sending = "sending",
  Delivered = "delivered",
  Failed = "failed",
  Retrying = "retrying",
  DeadLetter = "dead-letter",
  Expired = "expired",
  Cancelled = "cancelled"
}

export interface NotificationLifecycle {
  status: NotificationLifecycleStatus;
  updatedAt: string;
}

export function createNotificationLifecycle(status: NotificationLifecycleStatus = NotificationLifecycleStatus.Queued): NotificationLifecycle {
  return {
    status,
    updatedAt: new Date().toISOString()
  };
}
