/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from 'react';
import { 
  Building2, Database, Layers, Settings, Users, Shield, 
  Activity, CheckCircle2, AlertTriangle, Lock, RefreshCw, Eye
} from 'lucide-react';

export interface CompanyControlCenterProps {
  companyId?: string;
  userRole?: string;
  onClose?: () => void;
}

export const CompanyControlCenter: React.FC<CompanyControlCenterProps> = ({
  companyId = 'COMP-001',
  userRole = 'SYSADMIN',
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'company' | 'database' | 'modules' | 'config' | 'users' | 'lifecycle'>('company');

  // Authoritative Frontend View State - ZERO DB Secrets or Credentials Exposed
  const companyData = {
    companyId: companyId,
    companyCode: '001',
    companyName: 'SMRITI Retail Enterprise Default',
    legalName: 'SMRITI Systems Private Limited',
    status: 'READY',
    companyAdmin: 'Jawahar Ramkripal Mallah',
    branches: ['Main Branch - Mumbai', 'Sub-Branch - Delhi'],
    database: {
      databaseName: 'smriti001',
      provisioningStatus: 'READY',
      healthStatus: 'HEALTHY',
      schemaVersion: '3.16.0',
      migrationStatus: 'UP_TO_DATE',
      lastHealthCheck: new Date().toISOString()
    },
    modules: [
      { id: 'pos', name: 'POS Billing & Cash Shift', enabled: true },
      { id: 'sales', name: 'Sales & Invoicing', enabled: true },
      { id: 'purchase', name: 'Procurement & GRN', enabled: true },
      { id: 'inventory', name: 'Inventory & Stock Ledger', enabled: true },
      { id: 'ecommerce', name: 'E-Commerce Channel Sync', enabled: true },
      { id: 'accounting', name: 'Financial Accounting', enabled: true }
    ]
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-800 border-b border-slate-700 p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">SMRITI Company Control Center</h2>
              <p className="text-xs text-slate-400 font-mono">
                Company: {companyData.companyName} | Code: <span className="text-amber-400">{companyData.companyCode}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-full border border-emerald-500/20 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> DB STATUS: READY
            </span>
            {onClose && (
              <button 
                onClick={onClose}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded-md transition"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-850 border-b border-slate-800 px-6 flex space-x-1 overflow-x-auto">
          {[
            { id: 'company', label: 'Company Info', icon: Building2 },
            { id: 'database', label: 'Database Health', icon: Database },
            { id: 'modules', label: 'Modules & Features', icon: Layers },
            { id: 'config', label: 'Configuration', icon: Settings },
            { id: 'users', label: 'Users & Roles', icon: Users },
            { id: 'lifecycle', label: 'Lifecycle Operations', icon: Activity }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition ${
                  isActive 
                    ? 'border-indigo-500 text-indigo-400 bg-slate-800/50' 
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'company' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
                <label className="text-xs text-slate-400 font-medium">Company Code (Alphanumeric 3-Char)</label>
                <p className="text-lg font-bold text-amber-400 font-mono">{companyData.companyCode}</p>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
                <label className="text-xs text-slate-400 font-medium">Company Status</label>
                <p className="text-lg font-bold text-emerald-400">{companyData.status}</p>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
                <label className="text-xs text-slate-400 font-medium">Display Name</label>
                <p className="text-sm font-semibold text-slate-200">{companyData.companyName}</p>
              </div>
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
                <label className="text-xs text-slate-400 font-medium">Legal Name</label>
                <p className="text-sm font-semibold text-slate-200">{companyData.legalName}</p>
              </div>
              <div className="col-span-2 bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
                <label className="text-xs text-slate-400 font-medium mb-1 block">Assigned Branches</label>
                <div className="flex gap-2">
                  {companyData.branches.map((b, idx) => (
                    <span key={idx} className="px-2.5 py-1 bg-slate-700/60 text-slate-300 text-xs rounded border border-slate-600">
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'database' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-900/20 border border-emerald-700/30 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200">Reference Company Business DB</h4>
                    <p className="text-xs text-slate-400 font-mono">Target: {companyData.database.databaseName}</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-semibold rounded-full border border-emerald-500/30">
                  {companyData.database.healthStatus}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 text-xs font-mono">
                <div className="bg-slate-800/50 p-3 rounded border border-slate-700/50">
                  <span className="text-slate-400">Schema Version:</span>
                  <p className="text-slate-200 font-bold mt-1">{companyData.database.schemaVersion}</p>
                </div>
                <div className="bg-slate-800/50 p-3 rounded border border-slate-700/50">
                  <span className="text-slate-400">Migration Status:</span>
                  <p className="text-emerald-400 font-bold mt-1">{companyData.database.migrationStatus}</p>
                </div>
                <div className="bg-slate-800/50 p-3 rounded border border-slate-700/50">
                  <span className="text-slate-400">Last Health Check:</span>
                  <p className="text-slate-300 mt-1">{new Date(companyData.database.lastHealthCheck).toLocaleTimeString()}</p>
                </div>
              </div>

              <div className="p-4 bg-slate-800/30 border border-slate-700/40 rounded-lg">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold mb-1">
                  <Lock className="w-4 h-4" /> Security Isolation Guarantee
                </div>
                <p className="text-xs text-slate-400">
                  PostgreSQL host, port, credentials, and connection strings are managed exclusively server-side by 
                  <code className="text-indigo-400 ml-1">CompanyDatabaseResolver</code>. React never exposes raw credentials.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'modules' && (
            <div className="grid grid-cols-2 gap-4">
              {companyData.modules.map(mod => (
                <div key={mod.id} className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-200">{mod.name}</span>
                  <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-xs rounded border border-emerald-500/20 font-semibold">
                    ENABLED
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'lifecycle' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-800/40 border border-slate-700/40 rounded-lg">
                <h4 className="text-sm font-semibold text-slate-200 mb-2">Lifecycle Management Console</h4>
                <p className="text-xs text-slate-400 mb-4">
                  Lifecycle operations alter tenant database states. Destructive actions require dual administrative authorization.
                </p>
                <div className="grid grid-cols-4 gap-3">
                  <button disabled className="px-3 py-2 bg-slate-800 text-slate-500 text-xs font-semibold rounded border border-slate-700 cursor-not-allowed">
                    Suspend Company
                  </button>
                  <button disabled className="px-3 py-2 bg-slate-800 text-slate-500 text-xs font-semibold rounded border border-slate-700 cursor-not-allowed">
                    Archive Database
                  </button>
                  <button disabled className="px-3 py-2 bg-slate-800 text-slate-500 text-xs font-semibold rounded border border-slate-700 cursor-not-allowed">
                    Decommission DB
                  </button>
                  <button disabled className="px-3 py-2 bg-red-950/40 text-red-500/50 text-xs font-semibold rounded border border-red-900/30 cursor-not-allowed">
                    Delete Database
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-800 border-t border-slate-700 p-4 flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>Control Plane: <strong className="text-slate-200">smritisys</strong></span>
          <span>Role Authorization: <strong className="text-amber-400">{userRole}</strong></span>
        </div>
      </div>
    </div>
  );
};
