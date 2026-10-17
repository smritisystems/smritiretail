/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * Websites     : aitdl.com | erpnbook.com | smritibooks.com
 * Version      : 6.45.2
 * Created      : 2026-09-26
 * Modified     : 2026-09-26
 * Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Description  : Modal Warning Dialog for Session Inactivity Timeout with Real-Time Countdown
 */

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, Clock, LogOut, CheckCircle2, ShieldAlert } from "lucide-react";

export interface InactivityWarningModalProps {
  remainingSeconds: number;
  totalWarningSeconds?: number;
  onStayLoggedIn: () => void;
  onLogoutNow: () => void;
}

export const InactivityWarningModal: React.FC<InactivityWarningModalProps> = ({
  remainingSeconds,
  totalWarningSeconds = 60,
  onStayLoggedIn,
  onLogoutNow,
}) => {
  // Format remaining seconds as mm:ss
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const formattedTime = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  // Progress percentage (0 to 100)
  const percentRemaining = Math.max(0, Math.min(100, (remainingSeconds / totalWarningSeconds) * 100));

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inactivity-warning-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="w-full max-w-md bg-slate-900/95 border border-amber-500/40 rounded-2xl shadow-2xl shadow-amber-500/10 overflow-hidden text-slate-100 backdrop-blur-xl"
        >
          {/* Header Banner */}
          <div className="p-6 pb-4 flex items-start gap-4">
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  Security Guard
                </span>
              </div>
              <h2
                id="inactivity-warning-title"
                className="text-lg font-bold font-display text-white mt-1 leading-snug"
              >
                Session Inactivity Warning
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                No activity detected. To protect terminal transactions and store records, this session will automatically close.
              </p>
            </div>
          </div>

          {/* Countdown & Progress Display */}
          <div className="mx-6 p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col items-center justify-center text-center">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-widest">
              Automatic Logout In
            </span>
            <div className="mt-1 font-mono text-4xl font-black tracking-tight text-amber-400 flex items-center gap-2">
              <span>{formattedTime}</span>
              <span className="text-xs font-sans font-medium text-slate-400 self-end mb-1.5">
                ({remainingSeconds}s)
              </span>
            </div>

            {/* Countdown progress bar */}
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full"
                animate={{ width: `${percentRemaining}%` }}
                transition={{ duration: 0.9, ease: "linear" }}
              />
            </div>
            <p className="text-[10.5px] text-slate-400 mt-2 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              Pressing any key or moving your mouse will keep you signed in.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="p-6 pt-4 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={onStayLoggedIn}
              className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition cursor-pointer min-h-[44px]"
            >
              <CheckCircle2 className="w-4 h-4" />
              Stay Logged In
            </button>

            <button
              type="button"
              onClick={onLogoutNow}
              className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700/80 flex items-center justify-center gap-2 transition cursor-pointer min-h-[44px]"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              Logout Now
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
