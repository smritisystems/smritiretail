/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Standard     : SCS-WST-001 (Workspace State Standard)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 */

export type WorkspaceStatusState = "saved" | "saving" | "unsaved" | "error" | "sync_pending" | "importing" | "idle";

export interface WorkspaceStatusPayload {
  state: WorkspaceStatusState;
  message?: string;
  unsavedCount?: number;
  lastSavedTime?: string;
}

export interface WorkspaceNotification {
  id: string;
  title: string;
  type: "info" | "success" | "warning" | "error";
  timestamp: number;
}

type StatusListener = (status: WorkspaceStatusPayload) => void;
type NotificationListener = (notification: WorkspaceNotification) => void;

class WorkspaceStatusServiceImpl {
  private currentStatus: WorkspaceStatusPayload = { state: "saved", message: "Saved" };
  private statusListeners: Set<StatusListener> = new Set();
  private notificationListeners: Set<NotificationListener> = new Set();

  publishStatus(payload: WorkspaceStatusPayload): void {
    this.currentStatus = { ...payload };
    this.statusListeners.forEach((fn) => fn(this.currentStatus));
  }

  getStatus(): WorkspaceStatusPayload {
    return this.currentStatus;
  }

  onStatusChange(fn: StatusListener): () => void {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }

  // Notification Dock stream
  notify(title: string, type: "info" | "success" | "warning" | "error" = "info"): void {
    const notification: WorkspaceNotification = {
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title,
      type,
      timestamp: Date.now(),
    };
    this.notificationListeners.forEach((fn) => fn(notification));
  }

  onNotification(fn: NotificationListener): () => void {
    this.notificationListeners.add(fn);
    return () => this.notificationListeners.delete(fn);
  }
}

export const WorkspaceStatusService = new WorkspaceStatusServiceImpl();
export const WorkspaceStatus = {
  publish: (payload: WorkspaceStatusPayload) => WorkspaceStatusService.publishStatus(payload),
  notify: (title: string, type?: "info" | "success" | "warning" | "error") => WorkspaceStatusService.notify(title, type),
};
