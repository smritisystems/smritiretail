/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : MyWork (Fiori-Style Unified "My Work" Home Studio Component v2.1)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 2.1.0
 */

import React, { useState, useEffect } from "react";
import { SUWINESDK } from "../sdk/SUWINESDK.ts";
import { UniversalWorkItem } from "../queue/UniversalWorkQueue.ts";
import { DrillableLink } from "../../components/drilldown/DrillableLink.tsx";
import { ProcessMonitor } from "../monitoring/ProcessMonitor.tsx";
import { Inbox, CheckCircle, XCircle, Clock, AlertTriangle, Play, Sparkles, Filter, RefreshCw, Activity } from "lucide-react";

export const MyWork: React.FC = () => {
  const [items, setItems] = useState<UniversalWorkItem[]>([]);
  const [filterType, setFilterType] = useState<string>("All");
  const [simulationResult, setSimulationResult] = useState<any>(null);

  const loadQueue = async () => {
    const data = await SUWINESDK.getWorkQueue("PER-1001");
    setItems(data);
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const handleApprove = async (id: string) => {
    await SUWINESDK.approve(id);
    await loadQueue();
  };

  const handleReject = async (id: string) => {
    await SUWINESDK.reject(id, "Rejected via My Work Studio");
    await loadQueue();
  };

  const runSimulation = async () => {
    const res = await SUWINESDK.simulate("Workflow-PO-v2", { amount: 250000 });
    setSimulationResult(res);
  };

  const filteredItems = items.filter((i) => {
    if (filterType === "All") return true;
    return i.type === filterType;
  });

  return (
    <div className="p-6 bg-theme-surface-1 border border-theme-divider rounded-2xl space-y-6 font-sans select-none shadow-xl">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-theme-divider pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#0a6ed1]/10 text-[#0a6ed1] border border-[#0a6ed1]/30 rounded-xl shadow-xs">
            <Inbox className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-theme-heading">SUWINE "My Work" Fiori Studio v2.1</h3>
            <p className="text-xs text-theme-muted font-mono">Polymorphic Universal Work Queue • BPMN Parallel Engine • SUSJE Scheduler Link</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={runSimulation}
            className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold font-mono flex items-center gap-2 cursor-pointer shadow-md transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Simulate PO Workflow</span>
          </button>
        </div>
      </div>

      {/* Simulation Result Drawer (if triggered) */}
      {simulationResult && (
        <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl space-y-2 font-mono text-xs text-purple-300">
          <div className="flex justify-between items-center font-bold">
            <span className="flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> Workflow Simulator Active</span>
            <button onClick={() => setSimulationResult(null)} className="hover:text-white">✕</button>
          </div>
          <div>Execution Path: <strong>{simulationResult.executionPath.join(" → ")}</strong></div>
          <div>Estimated SLA: <strong>{simulationResult.slaEstimatedHours} hours</strong></div>
        </div>
      )}

      {/* SUWINE Live Process Monitor */}
      <ProcessMonitor />

      {/* Queue Filter Bar */}
      <div className="flex items-center justify-between p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-theme-muted" />
          <span className="text-xs font-bold text-theme-heading font-mono uppercase">Filter Queue:</span>
          {(["All", "Approval", "Task", "Escalation"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1 rounded-lg text-xs font-bold font-mono cursor-pointer transition-colors ${
                filterType === t
                  ? "bg-[#0a6ed1] text-white shadow-xs"
                  : "bg-theme-surface-3 text-theme-muted hover:text-theme-heading"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <span className="text-xs font-mono text-theme-muted font-bold">Total: {filteredItems.length} items</span>
      </div>

      {/* Work Item List */}
      <div className="space-y-3">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl hover:border-theme-border-hover transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                    item.type === "Approval"
                      ? "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                      : item.type === "Escalation"
                      ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                  }`}
                >
                  {item.type}
                </span>
                <span className="text-xs font-mono text-theme-muted">[{item.module}]</span>
                <h4 className="text-sm font-bold text-theme-heading">{item.title}</h4>
              </div>

              <div className="text-xs font-mono text-theme-body flex items-center gap-3">
                {item.amount && <span className="text-emerald-400 font-bold">Amount: ₹ {item.amount.toLocaleString("en-IN")}</span>}
                <span className="flex items-center gap-1 text-theme-muted">
                  <Clock className="w-3.5 h-3.5" /> SLA Due: {new Date(item.slaDueDate).toLocaleDateString()}
                </span>
                <span className="text-amber-400 font-bold">Status: {item.status}</span>
              </div>
            </div>

            {/* Quick Action Buttons & SUNEF Link */}
            <div className="flex items-center gap-2">
              <DrillableLink
                context={{
                  entityType: item.module === "Purchase" ? "PurchaseOrder" : "Item",
                  entityId: item.documentId,
                  title: item.title
                }}
              >
                <span className="mr-2">Drill Item →</span>
              </DrillableLink>

              {item.status === "Pending" && (
                <>
                  <button
                    onClick={() => handleApprove(item.id)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold font-mono flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button
                    onClick={() => handleReject(item.id)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold font-mono flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
