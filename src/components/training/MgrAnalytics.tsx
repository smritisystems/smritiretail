/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-14
 * Modified     : 2026-08-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from 'react';
import { Users, Award, ShieldCheck, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';

export const ManagerAnalyticsCo: React.FC = () => {
  const staffRoster = [
    { id: 'EMP-101', name: 'Rajesh Sharma', role: 'Cashier', progress: 100, status: 'Level 1 — Certified', score: 96.0, session: 'TRAIN-2026-101' },
    { id: 'EMP-102', name: 'Priya Verma', role: 'Inventory Clerk', progress: 72, status: 'In Training (Day 4)', score: 88.0, session: 'TRAIN-2026-102' },
    { id: 'EMP-103', name: 'Amit Patel', role: 'Store Assistant', progress: 40, status: 'In Training (Day 2)', score: 82.0, session: 'TRAIN-2026-103' },
  ];

  return (
    <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            Store Manager Staff Training Roster
          </h3>
          <p className="text-xs text-slate-400">Track employee onboarding completion, scores, and certification levels.</p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 bg-slate-700 rounded text-slate-300 border border-slate-600">
          Total Trainees: {staffRoster.length}
        </span>
      </div>

      <div className="space-y-2.5">
        {staffRoster.map((emp) => (
          <div key={emp.id} className="bg-slate-900/80 border border-slate-700/80 p-3 rounded-lg text-xs flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="font-bold text-white flex items-center gap-2">
                <span>{emp.name}</span>
                <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/60 px-1.5 py-0.5 rounded">{emp.role}</span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                Session: {emp.session} • Score: <span className="text-emerald-400 font-bold">{emp.score}%</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className={`text-[10px] font-semibold block ${emp.progress === 100 ? 'text-emerald-400' : 'text-indigo-300'}`}>
                  {emp.status}
                </span>
                <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${emp.progress}%` }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
