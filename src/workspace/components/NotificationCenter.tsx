/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI Platform Notification Center (ADR-UX-003 Compliant)
 * Standard     : ADR-UX-003 — SMRITI Workspace Shell Architecture
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import React, { useState, useEffect } from "react";
import { Bell, X, CheckCheck, Info, AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
import { notificationService } from "../services/NotificationService";
import { NotificationItem } from "../types/workspace.types";

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    return notificationService.subscribe((list) => {
      setNotifications(list);
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleGlobalEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleGlobalEsc, true);
    return () => window.removeEventListener("keydown", handleGlobalEsc, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const renderIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle2 size={16} className="text-emerald-400" />;
      case "warning":
        return <AlertTriangle size={16} className="text-amber-400" />;
      case "error":
        return <AlertCircle size={16} className="text-rose-400" />;
      default:
        return <Info size={16} className="text-sky-400" />;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-theme-surface-1 border-l border-theme-divider shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 text-theme-body font-sans"
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
      >
      {/* Header Bar */}
      <div className="p-4 border-b border-theme-divider flex items-center justify-between bg-theme-surface-2/40">
        <div className="flex items-center gap-2.5">
          <Bell size={18} className="text-[var(--c-seef-accent)]" />
          <h3 className="font-bold text-sm text-theme-heading">Notification Center</h3>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[var(--c-seef-accent)]/20 text-[var(--c-seef-accent)]">
            {notificationService.getUnreadCount()} new
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => notificationService.markAllAsRead()}
            className="p-1.5 rounded-lg hover:bg-theme-surface-hover text-theme-muted hover:text-theme-body text-xs flex items-center gap-1 cursor-pointer"
            title="Mark all as read"
          >
            <CheckCheck size={14} />
            <span className="hidden sm:inline">Mark read</span>
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-theme-surface-hover text-theme-muted hover:text-theme-body cursor-pointer">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 smriti-hide-scrollbar">
        {notifications.length === 0 ? (
          <div className="py-16 text-center text-xs text-theme-muted">No system notifications</div>
        ) : (
          notifications.map((item) => (
            <div
              key={item.id}
              onClick={() => notificationService.markAsRead(item.id)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                !item.read
                  ? "bg-theme-surface-2 border-[var(--c-seef-accent)]/30 text-theme-heading shadow-xs"
                  : "bg-theme-surface-2/30 border-theme-divider text-theme-muted hover:bg-theme-surface-2/60"
              }`}
            >
              {!item.read && <span className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-[var(--c-seef-accent)]" />}

              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-theme-surface-2 border border-theme-divider shrink-0 mt-0.5">{renderIcon(item.type)}</div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between text-xs font-semibold text-theme-heading pr-4">
                    <span className="truncate">{item.title}</span>
                    <span className="text-[10px] font-mono text-theme-muted shrink-0 ml-2">{item.timestamp}</span>
                  </div>
                  <p className="text-xs text-theme-muted mt-1 leading-relaxed">{item.message}</p>

                  {item.actionLabel && (
                    <button className="mt-2.5 px-3 py-1 rounded-lg text-xs font-semibold bg-[var(--c-seef-accent)] text-white hover:opacity-90 transition-opacity">
                      {item.actionLabel}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-theme-divider bg-theme-surface-2/20 text-center text-[11px] text-theme-muted font-mono">
        Platform Event Bus Connected • Live
      </div>
    </div>
    </>
  );
};
