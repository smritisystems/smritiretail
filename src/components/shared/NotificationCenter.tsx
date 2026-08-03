/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 — NotificationCenter (SWEF P-009)
 * Standard     : SXP Constitution v1.0 / SWEF v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * 6 Notification Categories (SXP v1.0):
 *   stock       — Low Stock, Expiry, Out of Stock
 *   order       — New Order, Order Confirmed, Dispatch
 *   payment     — Payment Received, Overdue
 *   system      — Session Expiry, License, DB Health
 *   approval    — Pending Approvals, Rejected
 *   ai          — AI Advisory (always isAdvisoryOnly per UAR-003)
 *
 * GOVERNANCE (UAR-003): AI notifications MUST specify isAdvisoryOnly: true.
 * Events arrive via WorkspaceEventBus subscription.
 */

import React, { useState, useEffect } from "react";
import { WorkspaceEventBus } from "../../layout_engine/WorkspaceEventBus.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotificationCategory = "stock" | "order" | "payment" | "system" | "approval" | "ai";
export type NotificationSeverity = "info" | "warning" | "critical";

export interface Notification {
  id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  message?: string;
  timestamp: string;
  isRead: boolean;
  /** UAR-003: AI notifications must always set this true */
  isAdvisoryOnly?: boolean;
  action?: { label: string; onClick(): void };
}

// ── Category metadata ─────────────────────────────────────────────────────────

const CATEGORY_META: Record<NotificationCategory, { icon: string; label: string }> = {
  stock:    { icon: "📦", label: "Stock" },
  order:    { icon: "🛒", label: "Orders" },
  payment:  { icon: "💳", label: "Payments" },
  system:   { icon: "⚙️", label: "System" },
  approval: { icon: "✅", label: "Approvals" },
  ai:       { icon: "🤖", label: "AI Advisory" },
};

const SEVERITY_COLORS = {
  info:     { bg: "rgba(99,102,241,0.08)",  border: "rgba(99,102,241,0.2)",  badge: "#818cf8" },
  warning:  { bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.2)",  badge: "#f59e0b" },
  critical: { bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.25)",  badge: "#ef4444" },
};

// ── Panel Component ───────────────────────────────────────────────────────────

interface NotificationCenterProps {
  isOpen: boolean;
  onClose(): void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: "n1",
      category: "stock",
      severity: "warning",
      title: "Stock Below Reorder Point",
      message: "Nike Air Max 270 (Size 9) — 3 units remaining",
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      isRead: false,
      action: { label: "View Item", onClick: () => console.log("navigate to item") },
    },
    {
      id: "n2",
      category: "approval",
      severity: "info",
      title: "Stock Transfer Pending Approval",
      message: "Transfer of 50 units to Branch 2 requires your approval",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      isRead: false,
      action: { label: "Review", onClick: () => console.log("open approval") },
    },
    {
      id: "n3",
      category: "ai",
      severity: "info",
      title: "Reorder Advisory",
      message: "Based on sales trends, consider ordering 200 units of Adidas Stan Smith by Friday",
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      isRead: true,
      isAdvisoryOnly: true,
    },
  ]);

  const [activeCategory, setActiveCategory] = useState<NotificationCategory | "all">("all");

  // Listen to WorkspaceEventBus for new notifications
  useEffect(() => {
    return WorkspaceEventBus.subscribe("SyncCompleted", (event) => {
      const payload = event.payload as { notifications?: Notification[] };
      if (payload.notifications?.length) {
        setNotifications((prev) => [...payload.notifications!, ...prev]);
      }
    });
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const visible = activeCategory === "all"
    ? notifications
    : notifications.filter((n) => n.category === activeCategory);

  const markAllRead = () => setNotifications((n) => n.map((x) => ({ ...x, isRead: true })));
  const dismiss = (id: string) => setNotifications((n) => n.filter((x) => x.id !== id));

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 8990 }} />

      {/* Panel */}
      <div style={{
        position: "fixed",
        top: 48,
        right: 0,
        bottom: 0,
        width: 380,
        background: "var(--c-surface-elevated, #1e1e3a)",
        borderLeft: "1px solid var(--c-border, rgba(255,255,255,0.08))",
        display: "flex",
        flexDirection: "column",
        zIndex: 9000,
        boxShadow: "-8px 0 32px rgba(0,0,0,0.4)",
        animation: `slideInRight var(--sxp-motion-panel, 250ms) ease`,
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--c-border, rgba(255,255,255,0.08))", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--c-text-primary, #e2e8f0)" }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 10, background: "rgba(239,68,68,0.15)", color: "#ef4444", fontWeight: 700 }}>
                {unreadCount}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, border: "1px solid var(--c-border)", background: "transparent", color: "var(--c-text-muted, #64748b)", cursor: "pointer" }}>
                Mark all read
              </button>
            )}
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted, #64748b)", fontSize: 20 }}>×</button>
          </div>
        </div>

        {/* Category Filter */}
        <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--c-border, rgba(255,255,255,0.06))", display: "flex", gap: 6, overflowX: "auto" }}>
          {(["all", ...Object.keys(CATEGORY_META)] as Array<"all" | NotificationCategory>).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid var(--c-border)",
                background: activeCategory === cat ? "rgba(99,102,241,0.15)" : "transparent",
                color: activeCategory === cat ? "#818cf8" : "var(--c-text-muted, #64748b)",
                fontSize: 11,
                fontWeight: 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {cat === "all" ? "All" : CATEGORY_META[cat].icon + " " + CATEGORY_META[cat].label}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {visible.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: "var(--c-text-muted, #64748b)", fontSize: 13 }}>
              No notifications
            </div>
          )}
          {visible.map((notif) => {
            const s = SEVERITY_COLORS[notif.severity];
            const catMeta = CATEGORY_META[notif.category];
            return (
              <div
                key={notif.id}
                style={{
                  padding: "12px 16px",
                  margin: "4px 12px",
                  borderRadius: 10,
                  border: `1px solid ${s.border}`,
                  background: notif.isRead ? "transparent" : s.bg,
                  position: "relative",
                  transition: "background var(--sxp-motion-action, 150ms)",
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{catMeta.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: notif.isRead ? 400 : 600, color: "var(--c-text-primary, #e2e8f0)" }}>
                        {notif.title}
                      </span>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        {!notif.isRead && (
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.badge, display: "inline-block", marginTop: 3 }} />
                        )}
                        <button onClick={() => dismiss(notif.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--c-text-muted, #64748b)", fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
                      </div>
                    </div>
                    {notif.message && (
                      <div style={{ fontSize: 12, color: "var(--c-text-secondary, #94a3b8)", marginTop: 3, lineHeight: 1.5 }}>{notif.message}</div>
                    )}
                    {notif.isAdvisoryOnly && (
                      <div style={{ fontSize: 10, color: "var(--c-text-muted, #64748b)", marginTop: 4, fontStyle: "italic" }}>
                        🤖 Advisory only — no automatic action taken
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: "var(--c-text-muted, #64748b)" }}>
                        {new Date(notif.timestamp).toLocaleTimeString()}
                      </span>
                      {notif.action && (
                        <button onClick={notif.action.onClick} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, border: `1px solid ${s.border}`, background: "transparent", color: s.badge, cursor: "pointer" }}>
                          {notif.action.label}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};
