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
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { AuditLogEntry } from "../types.js";
import { SmritiScrollArea } from "./SmritiScrollArea.js";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";

export const AuditLogsTab: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetchV1("/audit-logs")
      .then(data => {
        const logsData = Array.isArray(data) ? data : data?.logs || [];
        setLogs(logsData);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load audit logs:", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">System Audit Logs</h1>
        <p className="text-sm text-slate-500 mt-1">Global security and modification trail</p>
      </div>

      <SmritiScrollArea className="flex-1 p-6">
        <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-medium">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">Loading audit logs...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">No audit logs found.</td></tr>
              ) : (
                logs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{log.userName}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{log.module}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-[10px] uppercase font-bold tracking-wider rounded bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{log.targetName} <span className="text-xs text-slate-400">({log.targetId})</span></td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {log.oldValue && log.newValue && (
                        <div className="flex flex-col space-y-1">
                          <span className="line-through text-rose-500">{log.oldValue}</span>
                          <span className="text-emerald-500">{log.newValue}</span>
                        </div>
                      )}
                      {!log.oldValue && log.newValue && <span className="text-emerald-500">{log.newValue}</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SmritiScrollArea>
    </div>
  );
};
