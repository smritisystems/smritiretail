/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI Platform Notification Engine (ADR-UX-003 Compliant)
 * Standard     : ADR-UX-003 — SMRITI Workspace Shell Architecture
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { NotificationItem } from "../types/workspace.types";
import { INotificationService } from "../interfaces/ISWSContracts";
import { workspaceEventBus } from "../events/workspaceEvents";

class NotificationServiceImpl implements INotificationService {
  private notifications: NotificationItem[] = [];
  private listeners: Set<(notifications: NotificationItem[]) => void> = new Set();

  constructor() {
    this.seedInitialNotifications();
  }

  private seedInitialNotifications(): void {
    this.notifications = [
      {
        id: "notif-1",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        title: "System Synchronization Live",
        message: "Offline local PouchDB catalog synchronized with cloud server.",
        type: "success",
        category: "Sync",
        read: false,
      },
      {
        id: "notif-2",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        title: "Low Inventory Stock Alert",
        message: "SKU-90218 (Men's Denim Jacket XL) has reached safety reorder point (2 units remaining).",
        type: "warning",
        category: "Alerts",
        read: false,
        actionUrl: "/item-master",
        actionLabel: "View Inventory",
      },
    ];
  }

  public publishNotification(notification: Omit<NotificationItem, "id" | "timestamp" | "read">): void {
    const item: NotificationItem = {
      ...notification,
      id: `notif-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      read: false,
    };
    this.notifications.unshift(item);
    this.notify();
    workspaceEventBus.publish("NotificationReceived", item);
  }

  public markAsRead(id: string): void {
    const target = this.notifications.find((n) => n.id === id);
    if (target) {
      target.read = true;
      this.notify();
    }
  }

  public markAllAsRead(): void {
    this.notifications.forEach((n) => (n.read = true));
    this.notify();
  }

  public getNotifications(): NotificationItem[] {
    return [...this.notifications];
  }

  public getUnreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  public subscribe(listener: (notifications: NotificationItem[]) => void): () => void {
    this.listeners.add(listener);
    listener([...this.notifications]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener([...this.notifications]));
  }
}

export const notificationService = new NotificationServiceImpl();
