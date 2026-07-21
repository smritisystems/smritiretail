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
 * Classification: Support Ticket Desk UI Component
 */

import React, { useState } from 'react';
import { LifeBuoy, Plus, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const SupportTicketDesk: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [tickets, setTickets] = useState([
    {
      id: 'TCK-8801',
      subject: 'E-Way Bill NIC Gateway Auth Renewal',
      category: 'GST Compliance',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      slaHours: 4,
      createdAt: '2026-07-21 10:00'
    }
  ]);

  const [newTicket, setNewTicket] = useState({
    subject: '',
    category: 'POS_BILLING',
    priority: 'MEDIUM',
    description: ''
  });

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    const created = {
      id: `TCK-${Math.floor(1000 + Math.random() * 9000)}`,
      subject: newTicket.subject,
      category: newTicket.category,
      priority: newTicket.priority,
      status: 'NEW',
      slaHours: newTicket.priority === 'HIGH' ? 4 : 24,
      createdAt: '2026-07-22 02:54'
    };
    setTickets([created, ...tickets]);
    setShowForm(false);
    setNewTicket({ subject: '', category: 'POS_BILLING', priority: 'MEDIUM', description: '' });
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Technical Support Desk & SLA Tracker</h2>
          <p className="text-slate-400 text-xs">Submit support tickets, track SLA resolution progress, and escalate critical issues.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Create Support Ticket
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateTicket} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white mb-2">New Support Ticket</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">Subject</label>
              <input
                type="text"
                required
                value={newTicket.subject}
                onChange={e => setNewTicket({ ...newTicket, subject: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                placeholder="Brief ticket summary..."
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">Category</label>
              <select
                value={newTicket.category}
                onChange={e => setNewTicket({ ...newTicket, category: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="POS_BILLING">POS & Billing</option>
                <option value="WMS_INVENTORY">WMS & Inventory</option>
                <option value="GST_COMPLIANCE">GST Compliance & E-Invoice</option>
                <option value="HARDWARE">Thermal Printers & Scanners</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">Priority</label>
              <select
                value={newTicket.priority}
                onChange={e => setNewTicket({ ...newTicket, priority: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="LOW">Low (24h SLA)</option>
                <option value="MEDIUM">Medium (12h SLA)</option>
                <option value="HIGH">High (4h SLA)</option>
                <option value="CRITICAL">Critical (2h SLA)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1">Issue Details</label>
            <textarea
              rows={3}
              required
              value={newTicket.description}
              onChange={e => setNewTicket({ ...newTicket, description: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
              placeholder="Describe the technical issue in detail..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
            >
              Submit Ticket
            </button>
          </div>
        </form>
      )}

      {/* Ticket List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="font-semibold text-sm text-white mb-4">Active & Recent Tickets</h3>

        <div className="space-y-3">
          {tickets.map((tck) => (
            <div key={tck.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
                  <LifeBuoy className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-white">{tck.id}</span>
                    <span className="font-semibold text-sm text-slate-200">{tck.subject}</span>
                  </div>
                  <span className="text-xs text-slate-400">{tck.category} • Created: {tck.createdAt}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded border ${
                  tck.priority === 'HIGH' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                }`}>
                  {tck.priority} Priority
                </span>
                <span className="px-2.5 py-1 text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 rounded-lg flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> SLA: {tck.slaHours}h
                </span>
                <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg">
                  {tck.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
