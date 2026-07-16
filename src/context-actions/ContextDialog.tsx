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

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ShieldCheck, Terminal, Star, Pin, Keyboard, HelpCircle, Eye } from "lucide-react";

interface ContextDialogProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}

export const ContextDialog: React.FC<ContextDialogProps> = ({ isOpen, onClose, isAdmin = true }) => {
  const [activeTab, setActiveTab] = useState<"shortcuts" | "audit" | "favorites">("shortcuts");
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      try {
        const logs = JSON.parse(localStorage.getItem("smriti_acas_audit_logs") || "[]");
        setAuditLogs(logs.reverse()); // Show newest first
      } catch (e) {
        setAuditLogs([]);
      }
    }
  }, [isOpen]);

  const clearAuditLogs = () => {
    try {
      localStorage.removeItem("smriti_acas_audit_logs");
      setAuditLogs([]);
    } catch (_) {}
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative bg-theme-surface-1 border border-theme-divider w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden pointer-events-auto"
        role="dialog"
        aria-modal="true"
        aria-label="ACAS Configuration Dashboard"
      >
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-theme-divider flex justify-between items-center bg-slate-50 dark:bg-slate-900/40">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg">
              <ShieldCheck size={18} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                Adaptive Context Action System (ACAS) Control Panel
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Centralized governance, audit trail logs, and workspace mapping
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab navigation bar */}
        <div className="flex border-b border-theme-divider bg-slate-50/50 dark:bg-slate-900/20 px-4 gap-2">
          <button
            onClick={() => setActiveTab("shortcuts")}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition ${
              activeTab === "shortcuts"
                ? "border-blue-500 text-blue-500"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Keyboard size={14} />
              <span>Keyboard & Gestures</span>
            </div>
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab("audit")}
              className={`px-4 py-3 text-xs font-semibold border-b-2 transition ${
                activeTab === "audit"
                  ? "border-blue-500 text-blue-500"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Terminal size={14} />
                <span>Audit Logs (Admin)</span>
              </div>
            </button>
          )}

          <button
            onClick={() => setActiveTab("favorites")}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition ${
              activeTab === "favorites"
                ? "border-blue-500 text-blue-500"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Star size={14} />
              <span>Favorites & Pins</span>
            </div>
          </button>
        </div>

        {/* Tab Content Panel */}
        <div className="p-6 max-h-[400px] overflow-y-auto">
          {activeTab === "shortcuts" && (
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Responsive Devices Shortcuts Configuration
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/50 flex items-start gap-2.5">
                  <div className="p-1 bg-purple-500/10 text-purple-500 rounded">
                    <Keyboard size={14} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Open Context Operations
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Right Click (Mouse), Shift + F10 (Keyboard), Menu Key, or Touch Long Press.
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/50 flex items-start gap-2.5">
                  <div className="p-1 bg-blue-500/10 text-blue-500 rounded">
                    <Keyboard size={14} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Menu Traversal & Action
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Use Up / Down Arrow Keys to scroll, and press Enter to execute. Escape closes menu.
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/50 flex items-start gap-2.5">
                  <div className="p-1 bg-amber-500/10 text-amber-500 rounded">
                    <Keyboard size={14} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Mobile & Tablet Swiping
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Drag downward on mobile bottom sheets to collapse quickly with tactile ease.
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/50 flex items-start gap-2.5">
                  <div className="p-1 bg-green-500/10 text-green-500 rounded">
                    <Keyboard size={14} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Haptic Buzz Confirmation
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Touchscreens buzz briefly upon executing key-hold operations for instant validation.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "audit" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Real-time System Action Auditing
                </h4>
                {auditLogs.length > 0 && (
                  <button
                    onClick={clearAuditLogs}
                    className="text-[11px] font-semibold text-red-500 hover:text-red-700 transition"
                  >
                    Clear Audit Trails
                  </button>
                )}
              </div>

              {auditLogs.length > 0 ? (
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {auditLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-slate-100 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800 rounded-lg flex items-start justify-between text-[11px]"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 font-mono font-medium text-slate-800 dark:text-slate-200">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              log.event === "ACAS_ACTION_EXECUTE" ? "bg-green-500" : "bg-blue-500"
                            }`}
                          />
                          <span>{log.event}</span>
                        </div>
                        <div className="text-slate-400 font-sans">
                          {log.label ? `Executed "${log.label}" (${log.actionId})` : `Menu Opened`}
                          <span className="mx-1">•</span>
                          <span>Module: {log.module} ({log.type})</span>
                        </div>
                      </div>
                      <div className="text-right text-slate-400 font-mono text-[10px]">
                        <div>{log.role}</div>
                        <div>{new Date(log.timestamp).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center gap-1">
                  <Terminal size={18} className="text-slate-300 dark:text-slate-800" />
                  <span>No audit entries recorded yet. Try triggering some menu actions.</span>
                </div>
              )}
            </div>
          )}

          {activeTab === "favorites" && (
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                My Context System Preferences
              </h4>
              <p className="text-xs text-slate-500">
                You can mark highly repetitive operations as favorites (★) or pin them (📌) to place them permanently in easily accessible areas of contextual menus on all devices.
              </p>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">Offline Preference Synchronization:</span>
                <span className="font-semibold text-green-500 font-mono">ACTIVE (Syncs to localStorage)</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-theme-divider flex justify-end bg-slate-50 dark:bg-slate-900/20 text-xs text-slate-400">
          Governance service powered by SMRITI Retail OS Core V2
        </div>
      </motion.div>
    </div>
  );
};
