/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 30.0.0
 * Created      : 2026-07-22
 * Modified     : 2026-07-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Backup Restore Panel UI Component
 */

import React, { useState } from 'react';
import { Database, Download, RefreshCw, CheckCircle2, ShieldCheck, HardDrive } from 'lucide-react';

export const BackupRestorePanel: React.FC = () => {
  const [creating, setCreating] = useState(false);
  const [snapshots, setSnapshots] = useState([
    {
      id: 'SNAP-20260722-01',
      type: 'SCHEDULED',
      timestamp: '2026-07-22 02:00:00',
      size: '142.5 MB',
      status: 'PASSED',
      retention: '30 Days'
    },
    {
      id: 'SNAP-20260721-01',
      type: 'MANUAL',
      timestamp: '2026-07-21 18:30:00',
      size: '141.8 MB',
      status: 'PASSED',
      retention: '30 Days'
    }
  ]);

  const handleCreateBackup = () => {
    setCreating(true);
    setTimeout(() => {
      const newSnap = {
        id: `SNAP-20260722-${snapshots.length + 1}`,
        type: 'MANUAL',
        timestamp: '2026-07-22 02:54:00',
        size: '143.2 MB',
        status: 'PASSED',
        retention: '30 Days'
      };
      setSnapshots([newSnap, ...snapshots]);
      setCreating(false);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Database Snapshots & Cloud Restores</h2>
          <p className="text-slate-400 text-xs">Automated daily backups, verified checksums, and one-click cloud restore triggers.</p>
        </div>
        <button
          onClick={handleCreateBackup}
          disabled={creating}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${creating ? 'animate-spin' : ''}`} />
          {creating ? 'Creating Snapshot...' : 'Create Manual Backup'}
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="font-semibold text-sm text-white mb-4">Available Backup Snapshots</h3>

        <div className="space-y-3">
          {snapshots.map((snap) => (
            <div key={snap.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-white">{snap.id}</span>
                    <span className="px-2 py-0.5 text-[10px] uppercase font-semibold bg-slate-800 text-slate-300 rounded border border-slate-700">
                      {snap.type}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">{snap.timestamp} • Size: {snap.size} • Retention: {snap.retention}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                </span>
                <button className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-medium rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
                <button className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-medium rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5" /> Restore
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
