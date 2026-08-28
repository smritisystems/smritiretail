/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.82.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect } from "react";
import {
  StoreTerminalBroadcastHub,
  StoreBroadcastMessage,
  StoreBroadcastEventType,
} from "../../sync/StoreTerminalBroadcastHub";

interface StoreBroadcastNotificationBannerProps {
  onActionClick?: (msg: StoreBroadcastMessage) => void;
}

export const StoreBroadcastNotificationBanner: React.FC<StoreBroadcastNotificationBannerProps> = ({
  onActionClick,
}) => {
  const [activeMessage, setActiveMessage] = useState<StoreBroadcastMessage | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    const hub = StoreTerminalBroadcastHub.getInstance();
    const unsubscribe = hub.subscribe((msg) => {
      setActiveMessage(msg);
      setUnreadCount((prev) => prev + 1);

      // Auto dismiss informational notices after 8 seconds
      if (msg.eventType !== "MANAGER_OVERRIDE_REQUEST") {
        setTimeout(() => {
          setActiveMessage((current) => (current?.id === msg.id ? null : current));
        }, 8000);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  if (!activeMessage) return null;

  const eventConfig: Record<
    StoreBroadcastEventType,
    { icon: string; bgClass: string; borderClass: string; textClass: string }
  > = {
    MANAGER_OVERRIDE_REQUEST: {
      icon: "shield_person",
      bgClass: "bg-rose-950/90",
      borderClass: "border-rose-500/50",
      textClass: "text-rose-300",
    },
    PRICE_UPDATE_BROADCAST: {
      icon: "price_change",
      bgClass: "bg-cyan-950/90",
      borderClass: "border-cyan-500/50",
      textClass: "text-cyan-300",
    },
    STOCK_OUT_ALERT: {
      icon: "inventory_2",
      bgClass: "bg-amber-950/90",
      borderClass: "border-amber-500/50",
      textClass: "text-amber-300",
    },
    SYSTEM_LOCKOUT_NOTICE: {
      icon: "lock_clock",
      bgClass: "bg-purple-950/90",
      borderClass: "border-purple-500/50",
      textClass: "text-purple-300",
    },
    EMERGENCY_ANNOUNCEMENT: {
      icon: "campaign",
      bgClass: "bg-emerald-950/90",
      borderClass: "border-emerald-500/50",
      textClass: "text-emerald-300",
    },
  };

  const currentCfg = eventConfig[activeMessage.eventType] || eventConfig.EMERGENCY_ANNOUNCEMENT;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md w-full animate-slideInRight">
      <div
        className={`flex items-start gap-3 p-4 rounded-2xl ${currentCfg.bgClass} border ${currentCfg.borderClass} backdrop-blur-xl shadow-2xl text-xs`}
      >
        <div className={`p-2 rounded-xl bg-black/40 border border-white/10 ${currentCfg.textClass}`}>
          <span className="material-symbols-outlined text-xl">{currentCfg.icon}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`font-bold uppercase tracking-wider text-[11px] ${currentCfg.textClass}`}>
              {activeMessage.title}
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              {new Date(activeMessage.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>

          <p className="text-slate-200 mt-1 leading-relaxed">{activeMessage.body}</p>

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10 text-[10px]">
            <span className="text-slate-400 font-mono">
              From: <strong className="text-slate-200">{activeMessage.senderTerminalId}</strong> (
              {activeMessage.senderName})
            </span>

            <div className="flex items-center gap-2">
              {activeMessage.eventType === "MANAGER_OVERRIDE_REQUEST" && (
                <button
                  onClick={() => {
                    onActionClick?.(activeMessage);
                    setActiveMessage(null);
                  }}
                  className="px-2.5 py-1 rounded-lg font-bold bg-rose-600 hover:bg-rose-500 text-white shadow"
                >
                  Review Override
                </button>
              )}
              <button
                onClick={() => setActiveMessage(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreBroadcastNotificationBanner;
