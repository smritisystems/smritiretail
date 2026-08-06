/**
 * Project      : SMRITI Retail OS
 * System       : Universal Document Experience Platform (DXP)
 * Component    : PrintCenterTab (Print Fleet & Queue Management Console)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Standard     : SCS-DXP-002 Enterprise Operational Printing v2.1
 * Version      : 2.1.0
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState } from "react";
import { PrinterProfileRegistry, FleetPrinter } from "../core/PrinterProfileRegistry.ts";
import { PrintRoutingEngine, PrintRoutingRule } from "../core/PrintRoutingEngine.ts";
import { PrintAuditLogService, PermanentPrintAuditRecord } from "../core/PrintAuditLogService.ts";
import { PrintAgentManager } from "../agents/PrintAgentManager.ts";
import { DocumentQueueRegistry, DxpDocumentJob } from "../core/DocumentQueueRegistry.ts";
import { Printer, RefreshCw, AlertTriangle, CheckCircle2, Server, Play, ShieldAlert, Cpu, ListOrdered } from "lucide-react";

export const PrintCenterTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<"FLEET" | "QUEUE" | "AUDIT" | "ROUTING" | "AGENTS">("FLEET");
  const [printers, setPrinters] = useState<FleetPrinter[]>(PrinterProfileRegistry.list());
  const [jobs, setJobs] = useState<DxpDocumentJob[]>(DocumentQueueRegistry.listJobs());
  const [auditLogs, setAuditLogs] = useState<PermanentPrintAuditRecord[]>(PrintAuditLogService.list());
  const [routingRules, setRoutingRules] = useState<PrintRoutingRule[]>(PrintRoutingEngine.listRules());
  const [agents, setAgents] = useState(PrintAgentManager.getAgentStatuses());

  const handleRefresh = () => {
    setPrinters(PrinterProfileRegistry.list());
    setJobs(DocumentQueueRegistry.listJobs());
    setAuditLogs(PrintAuditLogService.list());
    setRoutingRules(PrintRoutingEngine.listRules());
    setAgents(PrintAgentManager.getAgentStatuses());
  };

  return (
    <div className="p-6 bg-slate-900 text-slate-100 min-h-screen font-sans">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-cyan-400 uppercase">
            <span>SCS-DXP-002 Enterprise Printing Platform v2.1</span>
          </div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3 mt-1">
            <Printer className="w-7 h-7 text-cyan-400" />
            Printing Center & Fleet Management Console
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition border border-slate-700"
          >
            <RefreshCw className="w-4 h-4 text-cyan-400" />
            Refresh Fleet
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-800 mt-6 gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveSubTab("FLEET")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeSubTab === "FLEET" ? "border-cyan-500 text-cyan-400" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Server className="w-4 h-4" /> Fleet Printers ({printers.length})
        </button>

        <button
          onClick={() => setActiveSubTab("QUEUE")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeSubTab === "QUEUE" ? "border-cyan-500 text-cyan-400" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <ListOrdered className="w-4 h-4" /> Active Queue & DLQ ({jobs.length})
        </button>

        <button
          onClick={() => setActiveSubTab("AUDIT")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeSubTab === "AUDIT" ? "border-cyan-500 text-cyan-400" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <CheckCircle2 className="w-4 h-4" /> Permanent Audit Logs
        </button>

        <button
          onClick={() => setActiveSubTab("ROUTING")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeSubTab === "ROUTING" ? "border-cyan-500 text-cyan-400" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Play className="w-4 h-4" /> Routing Rules ({routingRules.length})
        </button>

        <button
          onClick={() => setActiveSubTab("AGENTS")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeSubTab === "AGENTS" ? "border-cyan-500 text-cyan-400" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Cpu className="w-4 h-4" /> Intelligence Agents ({agents.length})
        </button>
      </div>

      {/* Tab Contents */}
      <div className="mt-6">
        {activeSubTab === "FLEET" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {printers.map((printer) => (
              <div key={printer.id} className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-5 shadow-lg">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-cyan-950/80 border border-cyan-700/50 rounded-lg">
                      <Printer className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white">{printer.friendlyName}</h3>
                      <p className="text-xs text-slate-400">{printer.location} • {printer.department}</p>
                    </div>
                  </div>
                  {printer.isDefault && (
                    <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] uppercase font-bold rounded">
                      DEFAULT
                    </span>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-700/50 text-xs space-y-2 text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Protocol:</span>
                    <span className="font-mono text-slate-200">{printer.protocol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Transport:</span>
                    <span className="font-mono text-slate-200">{printer.transportType} ({printer.targetAddress})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">DPI / Paper Width:</span>
                    <span className="text-slate-200">{printer.dpi} DPI / {printer.paperWidthMm}mm</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSubTab === "QUEUE" && (
          <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl overflow-hidden shadow-lg">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800 text-xs uppercase text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="p-4">Job ID</th>
                  <th className="p-4">Document Type</th>
                  <th className="p-4">Channel</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Attempts</th>
                  <th className="p-4">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">No active queued jobs in print spooler.</td>
                  </tr>
                ) : (
                  jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-slate-800/40">
                      <td className="p-4 font-mono text-cyan-400">{job.id}</td>
                      <td className="p-4 font-medium text-white">{job.documentType}</td>
                      <td className="p-4 text-slate-300">{job.channel}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 text-xs rounded font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          {job.status}
                        </span>
                      </td>
                      <td className="p-4 font-mono">{job.attempts} / {job.maxRetries}</td>
                      <td className="p-4 text-xs text-slate-400">{new Date(job.createdTimestamp).toLocaleTimeString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeSubTab === "AUDIT" && (
          <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl overflow-hidden shadow-lg">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800 text-xs uppercase text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Job ID</th>
                  <th className="p-4">Document</th>
                  <th className="p-4">Printer</th>
                  <th className="p-4">Duration</th>
                  <th className="p-4">Payload Size</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500">No audit log records recorded yet.</td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.jobId} className="hover:bg-slate-800/40">
                      <td className="p-4 text-xs text-slate-400">{log.timestamp}</td>
                      <td className="p-4 font-mono text-cyan-400">{log.jobId}</td>
                      <td className="p-4 font-medium text-white">{log.documentType}</td>
                      <td className="p-4 text-slate-300">{log.printerId}</td>
                      <td className="p-4 font-mono">{log.durationMs} ms</td>
                      <td className="p-4 font-mono">{log.payloadByteLength} B</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 text-xs rounded font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeSubTab === "ROUTING" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {routingRules.map((rule) => (
              <div key={rule.ruleId} className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white">{rule.name}</h3>
                  <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded font-mono">
                    Priority {rule.priority}
                  </span>
                </div>
                <div className="mt-3 text-xs space-y-1 text-slate-400">
                  <p>Matches Document: <span className="text-cyan-400 font-mono">{rule.documentType || "ANY"}</span></p>
                  <p>Target Fleet Printer: <span className="text-slate-200 font-medium">{rule.targetPrinterId}</span></p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSubTab === "AGENTS" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <div key={agent.agentId} className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white">{agent.name}</h3>
                  <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] uppercase font-bold rounded">
                    {agent.category}
                  </span>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-700/50 text-xs space-y-1.5 text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Agent ID:</span>
                    <span className="font-mono text-slate-200">{agent.agentId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Processed Jobs:</span>
                    <span className="font-mono text-emerald-400">{agent.metrics.successfulJobs} success / {agent.metrics.failedJobs} failed</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
