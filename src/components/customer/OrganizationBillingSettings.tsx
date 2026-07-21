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
 * Classification: Organization Billing & Audit Settings UI Component
 */

import React from 'react';
import { Building, CreditCard, Shield, FileText, CheckCircle2 } from 'lucide-react';

export const OrganizationBillingSettings: React.FC = () => {
  const org = {
    name: 'AITDL Retail Enterprises',
    tenantId: 'TENANT-001',
    email: 'support@smritibooks.com',
    phone: '+91 98765 43210',
    plan: 'Enterprise Edition',
    nextBilling: '2027-01-01',
    invoices: [
      { id: 'INV-SMRITI-2026-01', amount: '₹14,990', date: '2026-01-01', status: 'PAID' },
      { id: 'INV-SMRITI-2025-12', amount: '₹14,990', date: '2025-12-01', status: 'PAID' }
    ],
    auditLogs: [
      { action: 'LICENSE_ACTIVATED', user: 'Jawahar Mallah', time: '2026-07-21 09:00', ip: '192.168.1.10' },
      { action: 'MANUAL_BACKUP_CREATED', user: 'System Auto', time: '2026-07-21 18:30', ip: '127.0.0.1' }
    ]
  };

  return (
    <div className="space-y-8">
      {/* Organization Profile Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{org.name}</h2>
            <span className="text-xs text-slate-400 font-mono">Tenant ID: {org.tenantId}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-800">
          <div>
            <span className="block text-[11px] text-slate-500 font-medium">Contact Email</span>
            <span className="text-xs text-slate-200 font-medium">{org.email}</span>
          </div>
          <div>
            <span className="block text-[11px] text-slate-500 font-medium">Contact Phone</span>
            <span className="text-xs text-slate-200 font-medium">{org.phone}</span>
          </div>
          <div>
            <span className="block text-[11px] text-slate-500 font-medium">Subscription Plan</span>
            <span className="text-xs text-emerald-400 font-bold">{org.plan} (Renews {org.nextBilling})</span>
          </div>
        </div>
      </div>

      {/* Invoices & Audit Logs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Billing Invoices */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm text-white">Billing Invoice History</h3>
          </div>

          <div className="space-y-3">
            {org.invoices.map((inv) => (
              <div key={inv.id} className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex justify-between items-center text-xs">
                <div>
                  <span className="font-mono font-bold text-white block">{inv.id}</span>
                  <span className="text-slate-500">{inv.date}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-200">{inv.amount}</span>
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold rounded text-[10px]">
                    {inv.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit Log Events */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm text-white">Security Audit Trail</h3>
          </div>

          <div className="space-y-3">
            {org.auditLogs.map((log, idx) => (
              <div key={idx} className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex justify-between items-center text-xs">
                <div>
                  <span className="font-mono text-indigo-300 font-semibold block">{log.action}</span>
                  <span className="text-slate-500">{log.user} • IP: {log.ip}</span>
                </div>
                <span className="text-slate-400 font-mono text-[11px]">{log.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
