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
 * Classification: License Card Manager UI Component
 */

import React from 'react';
import { Key, ShieldCheck, Store, HardDrive, Monitor, CheckCircle2 } from 'lucide-react';

export const LicenseCardManager: React.FC = () => {
  const licenses = [
    {
      key: 'SMRITI-ENT-2026-99A8-44BC',
      edition: 'ENTERPRISE EDITION',
      status: 'ACTIVE',
      activationDate: '2026-01-01',
      expiryDate: '2027-12-31',
      stores: { used: 4, max: 10 },
      warehouses: { used: 2, max: 5 },
      terminals: { used: 18, max: 50 },
      modules: ['POS Billing', 'WMS Inventory', 'Pharma Engine', 'Apparel 3D Matrix', 'NIC GST', 'Franchise Royalty', 'Loyalty Rewards']
    }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Active Software Licenses</h2>
          <p className="text-slate-400 text-xs">Manage active license keys, store allocations, and terminal caps.</p>
        </div>
        <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs rounded-full">
          1 Active Enterprise License
        </span>
      </div>

      {licenses.map((lic, idx) => (
        <div key={idx} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div>
              <span className="text-[10px] font-bold text-indigo-400 tracking-wider uppercase mb-1 block">
                {lic.edition}
              </span>
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-400" />
                <span className="font-mono text-lg font-bold text-white tracking-wide">{lic.key}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-emerald-300 font-semibold">{lic.status} (Valid thru {lic.expiryDate})</span>
            </div>
          </div>

          {/* Resource Usage Bars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-indigo-400" /> Stores Allocated
                </span>
                <span className="text-white font-bold">{lic.stores.used} / {lic.stores.max}</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${(lic.stores.used / lic.stores.max) * 100}%` }} />
              </div>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-sky-400" /> Warehouses Allocated
                </span>
                <span className="text-white font-bold">{lic.warehouses.used} / {lic.warehouses.max}</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-sky-500 h-full rounded-full" style={{ width: `${(lic.warehouses.used / lic.warehouses.max) * 100}%` }} />
              </div>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Monitor className="w-4 h-4 text-emerald-400" /> POS Terminals Active
                </span>
                <span className="text-white font-bold">{lic.terminals.used} / {lic.terminals.max}</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(lic.terminals.used / lic.terminals.max) * 100}%` }} />
              </div>
            </div>
          </div>

          {/* Enabled Modules */}
          <div>
            <span className="block text-xs font-semibold text-slate-400 mb-3">Licensed Platform Modules:</span>
            <div className="flex flex-wrap gap-2">
              {lic.modules.map((m, i) => (
                <span key={i} className="px-3 py-1 bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> {m}
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
