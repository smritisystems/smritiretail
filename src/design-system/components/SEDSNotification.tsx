/**
 * Project      : SMRITI Business OS
 * Component    : SEDSNotification (Notification Center & Popover)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 * Classification: SEDS Enterprise Core Component
 */

import React from "react";
import { Bell, CheckCircle2, AlertTriangle, AlertCircle, Info, X } from "lucide-react";

export interface SEDSNotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: "success" | "warning" | "error" | "info";
  read?: boolean;
}

export interface SEDSNotificationProps {
  notifications: SEDSNotificationItem[];
  onDismiss?: (id: string) => void;
  onClearAll?: () => void;
  onClose?: () => void;
}

export const SEDSNotificationCenter: React.FC<SEDSNotificationProps> = ({
  notifications,
  onDismiss,
  onClearAll,
  onClose,
}) => {
  const getIcon = (type: SEDSNotificationItem["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle2 size={16} className="text-emerald-400" />;
      case "warning":
        return <AlertTriangle size={16} className="text-amber-400" />;
      case "error":
        return <AlertCircle size={16} className="text-red-400" />;
      case "info":
      default:
        return <Info size={16} className="text-blue-400" />;
    }
  };

  return (
    <div className="w-80 sm:w-96 bg-theme-surface-1 border border-indigo-500/30 rounded-2xl shadow-2xl overflow-hidden font-sans z-50">
      <div className="px-4 py-3 bg-theme-surface-1 border-b border-theme-divider flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-blue-400" />
          <h3 className="text-xs font-bold text-theme-body uppercase tracking-wider">Notifications</h3>
          <span className="px-2 py-0.5 rounded-full bg-blue-950 border border-blue-800 text-[10px] font-mono text-blue-400 font-bold">
            {notifications.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onClearAll && notifications.length > 0 && (
            <button onClick={onClearAll} className="text-[10px] font-mono text-theme-muted hover:text-theme-body transition">
              Clear All
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="p-1 text-theme-muted hover:text-theme-body">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto divide-y divide-theme-divider/60">
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-xs text-theme-muted">No new notifications.</div>
        ) : (
          notifications.map((item) => (
            <div key={item.id} className="p-3 hover:bg-theme-surface-hover transition flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 shrink-0">{getIcon(item.type)}</div>
                <div>
                  <h4 className="text-xs font-bold text-theme-body">{item.title}</h4>
                  <p className="text-[11px] text-theme-muted leading-relaxed mt-0.5">{item.message}</p>
                  <span className="text-[9px] font-mono text-theme-muted/70 mt-1 block">{item.timestamp}</span>
                </div>
              </div>

              {onDismiss && (
                <button onClick={() => onDismiss(item.id)} className="text-theme-muted hover:text-theme-body p-1">
                  <X size={12} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
