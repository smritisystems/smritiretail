/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.1
 * Created      : 2026-07-10
 * Modified     : 2026-10-24
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";

export type NotificationPriority = "low" | "medium" | "high" | "critical";
export type NotificationType = "alert" | "approval" | "activity" | "system";

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  timestamp: Date;
  read: boolean;
  actionUrl?: string; // Optional context or tab to jump to
  metadata?: any;
}

export interface NotificationEvent {
  module: string;
  event: string;
  payload: any;
}

interface NotificationState {
  notifications: SystemNotification[];
  unreadCount: number;
  addNotification: (n: Omit<SystemNotification, "id" | "timestamp" | "read">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  emitEvent: (event: NotificationEvent) => void;
  subscribe: (module: string, event: string, callback: (payload: any) => void) => () => void;
}

const NotificationContext = createContext<NotificationState | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used within a NotificationProvider");
  return context;
};

export const useOptionalNotifications = (): NotificationState =>
  useContext(NotificationContext) ?? {
    notifications: [],
    unreadCount: 0,
    addNotification: () => {},
    markAsRead: () => {},
    markAllAsRead: () => {},
    emitEvent: () => {},
    subscribe: () => () => {},
  };

// Module-level counter to guarantee unique system notification IDs
let systemNotifIdCounter = 0;

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  
  // Basic Event Bus implementation
  const [listeners, setListeners] = useState<Record<string, Array<(payload: any) => void>>>({});

  const unreadCount = notifications.filter(n => !n.read).length;

  const addNotification = (n: Omit<SystemNotification, "id" | "timestamp" | "read">) => {
    const uniqueId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `notif-${Date.now()}-${++systemNotifIdCounter}-${Math.random().toString(36).substring(2, 9)}`;
    const newNotification: SystemNotification = {
      ...n,
      id: uniqueId,
      timestamp: new Date(),
      read: false
    };
    setNotifications(prev => [newNotification, ...prev]);
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const emitEvent = (event: NotificationEvent) => {
    const eventKey = `${event.module}:${event.event}`;
    console.log(`[Event Emitted] ${eventKey}`, event.payload);
    
    // Auto-generate activities for certain events
    if (event.event === "created" || event.event === "approved" || event.event === "rejected") {
      addNotification({
        title: `Action: ${event.event}`,
        message: `${event.module} event triggered.`,
        type: "activity",
        priority: "low",
      });
    }

    if (listeners[eventKey]) {
      listeners[eventKey].forEach(cb => cb(event.payload));
    }
  };

  const subscribe = (module: string, event: string, callback: (payload: any) => void) => {
    const eventKey = `${module}:${event}`;
    setListeners(prev => {
      const current = prev[eventKey] || [];
      return { ...prev, [eventKey]: [...current, callback] };
    });

    return () => {
      setListeners(prev => {
        const current = prev[eventKey] || [];
        return { ...prev, [eventKey]: current.filter(cb => cb !== callback) };
      });
    };
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      addNotification,
      markAsRead,
      markAllAsRead,
      emitEvent,
      subscribe
    }}>
      {children}
    </NotificationContext.Provider>
  );
};
