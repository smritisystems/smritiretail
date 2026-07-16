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
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNotifications, SystemNotification } from "./notification_store.tsx";
import { SmritiScrollArea } from "../components/SmritiScrollArea.tsx";
import { Bell, Check, Info, ShieldAlert, Activity, AlertTriangle } from "lucide-react";

export const NotificationCenter: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tabId: string) => void;
}> = ({ isOpen, onClose, onNavigate }) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const filtered = notifications.filter(n => filter === "all" || !n.read);

  const getIcon = (type: string, priority: string) => {
    switch (type) {
      case "approval": return <ShieldAlert size={16} className="text-amber-500" />;
      case "system": return <Info size={16} className="text-blue-500" />;
      case "alert": return <AlertTriangle size={16} className={priority === "critical" ? "text-rose-500" : "text-amber-500"} />;
      default: return <Activity size={16} className="text-theme-muted" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-40"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: -20, x: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20, x: 20 }}
            className="absolute top-14 right-6 w-80 bg-theme-surface-1 border border-theme-divider shadow-2xl rounded-xl z-50 flex flex-col font-sans overflow-hidden"
            style={{ maxHeight: '80vh' }}
          >
            <div className="flex justify-between items-center p-4 border-b border-theme-divider bg-theme-surface-2">
              <h3 className="font-bold text-theme-primary flex items-center gap-2">
                <Bell size={16} /> Notifications
                {unreadCount > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </h3>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="text-[10px] uppercase font-mono tracking-wider text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                >
                  <Check size={12} /> Mark All Read
                </button>
              )}
            </div>
            
            <div className="flex bg-theme-surface-2 border-b border-theme-divider">
              <button 
                onClick={() => setFilter("all")}
                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider font-mono border-b-2 transition-colors ${
                  filter === "all" ? "border-blue-500 text-blue-400" : "border-transparent text-theme-muted hover:text-theme-primary"
                }`}
              >
                All
              </button>
              <button 
                onClick={() => setFilter("unread")}
                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider font-mono border-b-2 transition-colors ${
                  filter === "unread" ? "border-blue-500 text-blue-400" : "border-transparent text-theme-muted hover:text-theme-primary"
                }`}
              >
                Unread
              </button>
            </div>

            <SmritiScrollArea className="flex-1 bg-theme-surface-1 max-h-[400px]">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-theme-muted flex flex-col items-center">
                  <Bell size={32} className="opacity-20 mb-3" />
                  <p className="text-sm">You're all caught up!</p>
                </div>
              ) : (
                <div className="divide-y divide-theme-divider">
                  {filtered.map(n => (
                    <div 
                      key={n.id} 
                      className={`p-4 transition-colors ${n.read ? 'opacity-70 bg-transparent' : 'bg-blue-500/5 hover:bg-blue-500/10'}`}
                      onClick={() => {
                        if (!n.read) markAsRead(n.id);
                        if (n.actionUrl) {
                          onNavigate(n.actionUrl);
                          onClose();
                        }
                      }}
                    >
                      <div className="flex gap-3">
                        <div className="shrink-0 mt-0.5">
                          {getIcon(n.type, n.priority)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className={`text-sm truncate pr-2 ${n.read ? 'font-medium text-theme-body' : 'font-bold text-theme-primary'}`}>
                              {n.title}
                            </h4>
                            <span className="text-[10px] text-theme-muted font-mono shrink-0">
                              {n.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-theme-muted line-clamp-2">
                            {n.message}
                          </p>
                          {n.actionUrl && (
                            <div className="mt-2 text-xs font-bold text-blue-400 font-mono tracking-wider uppercase flex items-center gap-1">
                              View Details &rarr;
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SmritiScrollArea>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
