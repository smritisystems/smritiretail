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
 * Classification: Customer Workspace Portal Master UI Component
 */

import React, { useState } from 'react';
import { UserCheck, Key, Database, LifeBuoy, Building, ShieldCheck, ArrowLeft, Activity, Store, Monitor } from 'lucide-react';
import { LicenseCardManager } from './LicenseCardManager';
import { BackupRestorePanel } from './BackupRestorePanel';
import { SupportTicketDesk } from './SupportTicketDesk';
import { OrganizationBillingSettings } from './OrganizationBillingSettings';

export const CustomerWorkspacePortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'LICENSES' | 'BACKUPS' | 'SUPPORT' | 'SETTINGS'>('DASHBOARD');

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      {/* Workspace Navigation Header */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-6 py-3.5 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <a href="/" className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </a>
          <div className="p-2 bg-indigo-600 rounded-lg text-white">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-lg text-white tracking-tight">Customer Workspace</span>
            <span className="text-xs text-indigo-400 font-semibold ml-1.5 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
              v30.0.0
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('DASHBOARD')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'DASHBOARD' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('LICENSES')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'LICENSES' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Licenses
          </button>
          <button
            onClick={() => setActiveTab('BACKUPS')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'BACKUPS' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Backups
          </button>
          <button
            onClick={() => setActiveTab('SUPPORT')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'SUPPORT' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Support Desk
          </button>
          <button
            onClick={() => setActiveTab('SETTINGS')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'SETTINGS' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Organization
          </button>
        </nav>
      </header>

      {/* Main Workspace Body */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'DASHBOARD' && (
          <div className="space-y-8">
            {/* Health Status Banner */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">AITDL Retail Enterprises</h2>
                <p className="text-slate-400 text-xs">SIP-001 Multi-Tenant Isolation Active • Tenant ID: TENANT-001</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-lg">
                <ShieldCheck className="w-4 h-4" /> System Health 100%
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs text-slate-400 font-medium">Active Licenses</span>
                  <Key className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-2xl font-bold text-white mb-1">1 Enterprise</div>
                <span className="text-[11px] text-slate-500">Valid thru Dec 2027</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs text-slate-400 font-medium">Active Stores</span>
                  <Store className="w-4 h-4 text-sky-400" />
                </div>
                <div className="text-2xl font-bold text-white mb-1">4 / 10 Stores</div>
                <span className="text-[11px] text-slate-500">6 Stores Available</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs text-slate-400 font-medium">POS Terminals</span>
                  <Monitor className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-white mb-1">18 / 50 Terminals</div>
                <span className="text-[11px] text-slate-500">Capacity Allowed</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs text-slate-400 font-medium">Open Support Tickets</span>
                  <LifeBuoy className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-white mb-1">1 Ticket</div>
                <span className="text-[11px] text-amber-400 font-medium">In Progress (SLA 4h)</span>
              </div>
            </div>

            {/* License Management Preview */}
            <LicenseCardManager />
          </div>
        )}

        {activeTab === 'LICENSES' && <LicenseCardManager />}

        {activeTab === 'BACKUPS' && <BackupRestorePanel />}

        {activeTab === 'SUPPORT' && <SupportTicketDesk />}

        {activeTab === 'SETTINGS' && <OrganizationBillingSettings />}
      </div>
    </div>
  );
};

export default CustomerWorkspacePortal;
