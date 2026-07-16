/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.2
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState } from "react";
import { useNotifications, SystemNotification } from "../notifications/notification_store.tsx";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import { motion, AnimatePresence } from "motion/react";

export const AuditActivityFeed: React.FC = () => {
  const { notifications, addNotification, markAllAsRead } = useNotifications();
  const [filterType, setFilterType] = useState<"all" | "activity" | "system" | "approval">("all");

  // Filter notifications for this feed
  const feedItems = React.useMemo(() => {
    return notifications.filter((n) => {
      if (filterType === "all") {
        return n.type === "activity" || n.type === "system" || n.type === "approval";
      }
      return n.type === filterType;
    });
  }, [notifications, filterType]);

  // Format time nicely
  const formatTime = (date: Date | string) => {
    try {
      const d = typeof date === "string" ? new Date(date) : date;
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      
      const diffHrs = Math.floor(diffMins / 60);
      if (diffHrs < 24) return `${diffHrs}h ago`;
      
      return d.toLocaleDateString();
    } catch {
      return "Recently";
    }
  };

  // Helper to map notification type/priority to aesthetic colors and icons
  const getStyleProps = (item: SystemNotification) => {
    if (item.title.toLowerCase().includes("item added") || item.message.toLowerCase().includes("sku")) {
      return {
        icon: "inventory_2",
        colorClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
        pillClass: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
      };
    }
    if (item.title.toLowerCase().includes("pos sync") || item.message.toLowerCase().includes("reconciled") || item.title.toLowerCase().includes("terminal")) {
      return {
        icon: "sync_saved_locally",
        colorClass: "text-blue-400 bg-blue-500/10 border-blue-500/20",
        pillClass: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
      };
    }
    
    switch (item.type) {
      case "approval":
        return {
          icon: "rule",
          colorClass: "text-amber-400 bg-amber-500/10 border-amber-500/20",
          pillClass: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
        };
      case "system":
        return {
          icon: "settings_suggest",
          colorClass: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
          pillClass: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
        };
      default:
        return {
          icon: "bolt",
          colorClass: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
          pillClass: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20",
        };
    }
  };

  // Generate test user actions
  const triggerTestActivity = (actionType: "item" | "sync") => {
    if (actionType === "item") {
      const items = ["Raymond Premium Suit", "Levis Raw Denim", "Zara Slim Shirt", "Nike Air Force 1"];
      const selectedItem = items[Math.floor(Math.random() * items.length)];
      const randomSku = `SKU-RM-${Math.floor(1000 + Math.random() * 9000)}`;
      addNotification({
        title: `Item added: ${selectedItem}`,
        message: `New SKU ${randomSku} registered in Item Master by operator admin.`,
        type: "activity",
        priority: "low",
      });
    } else {
      const terminals = ["Terminal-A", "Terminal-B", "Mobile Checkout-3"];
      const selectedTerminal = terminals[Math.floor(Math.random() * terminals.length)];
      addNotification({
        title: `${selectedTerminal} POS Sync Completed`,
        message: `Successfully reconciled transactions and cached prices with main server.`,
        type: "activity",
        priority: "low",
      });
    }
  };

  return (
    <div className="bg-theme-surface-1 rounded-xl p-5 border border-theme-divider shadow-md flex flex-col h-[380px] justify-between">
      {/* Header */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center space-x-2">
            <span className="material-symbols-outlined text-[#2563EB] animate-pulse">
              browse_activity
            </span>
            <h3 className="font-display font-semibold text-base text-theme-body">
              Real-Time Activity Feed
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] bg-blue-500 bg-opacity-10 text-[#2563EB] font-mono font-semibold px-2 py-0.5 rounded border border-blue-500 border-opacity-20">
              LIVE
            </span>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center justify-between border-b border-theme-divider pb-2 mb-3">
          <div className="flex space-x-1">
            {(["all", "activity", "system", "approval"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`text-[10px] font-mono font-semibold px-2 py-1 rounded transition-colors uppercase ${
                  filterType === t
                    ? "bg-[#2563EB] text-white"
                    : "bg-theme-surface-2 text-theme-muted hover:bg-theme-surface-hover hover:text-theme-body"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <button
            onClick={markAllAsRead}
            className="text-[10px] text-theme-muted hover:text-[#2563EB] transition-colors flex items-center font-semibold"
          >
            <span className="material-symbols-outlined text-xs mr-0.5">done_all</span>
            Clear Badge
          </button>
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 min-h-0">
        <SmritiScrollArea maxHeight="180px" className="h-full">
          {feedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-theme-muted">
              <span className="material-symbols-outlined text-3xl mb-1 text-theme-divider">
                history_toggle_off
              </span>
              <p className="text-xs font-mono">No recent actions recorded.</p>
            </div>
          ) : (
            <div className="space-y-2.5 pr-1.5 pb-2">
              <AnimatePresence initial={false}>
                {feedItems.map((item) => {
                  const props = getStyleProps(item);
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10, scale: 0.98 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="bg-theme-surface-2 hover:bg-theme-surface-hover rounded-lg p-2.5 border border-theme-divider flex items-start space-x-3 transition-colors shadow-sm"
                    >
                      {/* Icon */}
                      <div className={`p-1.5 rounded-lg border flex items-center justify-center shrink-0 ${props.colorClass}`}>
                        <span className="material-symbols-outlined text-sm">
                          {props.icon}
                        </span>
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0 font-sans text-xs">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="font-semibold text-theme-body truncate pr-1">
                            {item.title}
                          </span>
                          <span className="text-[9px] text-theme-muted font-mono whitespace-nowrap shrink-0">
                            {formatTime(item.timestamp)}
                          </span>
                        </div>
                        <p className="text-[11px] text-theme-muted leading-relaxed line-clamp-2">
                          {item.message}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </SmritiScrollArea>
      </div>

      {/* Diagnostics / Simulate Actions Footer */}
      <div className="mt-3 pt-3 border-t border-theme-divider flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono text-theme-muted uppercase tracking-wider">
          Simulation Centre
        </span>
        <div className="flex space-x-1.5">
          <button
            onClick={() => triggerTestActivity("item")}
            className="text-[10px] bg-theme-surface-2 hover:bg-emerald-500/20 hover:text-emerald-400 text-theme-body font-mono font-medium px-2 py-1 rounded border border-theme-divider transition-all flex items-center space-x-1"
          >
            <span className="material-symbols-outlined text-[10px]">add_circle</span>
            <span>+ Item</span>
          </button>
          <button
            onClick={() => triggerTestActivity("sync")}
            className="text-[10px] bg-theme-surface-2 hover:bg-blue-500/20 hover:text-blue-400 text-theme-body font-mono font-medium px-2 py-1 rounded border border-theme-divider transition-all flex items-center space-x-1"
          >
            <span className="material-symbols-outlined text-[10px]">sync</span>
            <span>Sync POS</span>
          </button>
        </div>
      </div>
    </div>
  );
};
