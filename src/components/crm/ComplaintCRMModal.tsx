/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.104.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import ComplaintCRMEngine, {
  Complaint, ComplaintStatus, ComplaintPriority, ComplaintCategory, SLA_MATRIX,
} from "../../utils/complaintCRMEngine";

interface ComplaintCRMModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const STATUS_STYLE: Record<ComplaintStatus, string> = {
  OPEN:             "text-blue-300 bg-blue-500/20 border-blue-500/30",
  ASSIGNED:         "text-sky-300 bg-sky-500/20 border-sky-500/30",
  IN_PROGRESS:      "text-violet-300 bg-violet-500/20 border-violet-500/30",
  PENDING_CUSTOMER: "text-amber-300 bg-amber-500/20 border-amber-500/30",
  RESOLVED:         "text-teal-300 bg-teal-500/20 border-teal-500/30",
  CLOSED:           "text-emerald-300 bg-emerald-500/20 border-emerald-500/30",
  REOPENED:         "text-orange-300 bg-orange-500/20 border-orange-500/30",
  ESCALATED:        "text-rose-300 bg-rose-500/20 border-rose-500/30",
  CANCELLED:        "text-slate-500 bg-slate-800/30 border-slate-700/30",
};

const PRIORITY_STYLE: Record<ComplaintPriority, string> = {
  LOW:      "text-slate-400 bg-slate-700/30 border-slate-600/30",
  MEDIUM:   "text-blue-300 bg-blue-500/20 border-blue-500/30",
  HIGH:     "text-amber-300 bg-amber-500/20 border-amber-500/30",
  CRITICAL: "text-rose-300 bg-rose-500/20 border-rose-500/30",
};

const AGENTS = [
  { id: "AGT-01", name: "Ramesh Verma" },
  { id: "AGT-02", name: "Sunita Rao" },
  { id: "AGT-03", name: "Karthik Nair" },
];

const AS_OF_2H  = (openedAt: string) => new Date(new Date(openedAt).getTime() + 2 * 3600000);
const AS_OF_50H = (openedAt: string) => new Date(new Date(openedAt).getTime() + 50 * 3600000);

function buildSampleComplaints(): Complaint[] {
  const now = new Date().toISOString();

  let c1 = ComplaintCRMEngine.openComplaint({ customerId: "C-001", customerName: "Priya Sharma", customerPhone: "9876543210", branchCode: "BR-MUM-01", category: "PRODUCT_QUALITY", priority: "HIGH", subject: "Defective stitching on jacket", description: "Jacket purchased on 2026-08-25 has defective stitching on the left sleeve.", relatedInvoiceNo: "INV-2026-0841", openedAt: now });
  c1 = ComplaintCRMEngine.assign(c1, "AGT-01", "Ramesh Verma", "SUP-01");
  c1 = ComplaintCRMEngine.recordFirstResponse(c1, "AGT-01", "We have logged your complaint and are investigating.", AS_OF_2H(now));

  let c2 = ComplaintCRMEngine.openComplaint({ customerId: "C-002", customerName: "Arjun Mehta", branchCode: "BR-DEL-01", category: "BILLING_ERROR", priority: "CRITICAL", subject: "Overcharged by ₹5,000", description: "Invoice shows ₹5,000 more than the agreed price.", openedAt: now });
  c2 = ComplaintCRMEngine.checkSLABreaches(c2, AS_OF_50H(now)); // Auto-escalate

  let c3 = ComplaintCRMEngine.openComplaint({ customerId: "C-003", customerName: "Kavya Reddy", branchCode: "BR-MUM-01", category: "REFUND_NOT_RECEIVED", priority: "MEDIUM", subject: "Refund pending for 10 days", description: "Returned item 10 days ago but refund not credited yet.", openedAt: now });
  c3 = ComplaintCRMEngine.assign(c3, "AGT-02", "Sunita Rao", "SUP-01");
  c3 = ComplaintCRMEngine.recordFirstResponse(c3, "AGT-02", "Checking with finance team.", AS_OF_2H(now));
  c3 = ComplaintCRMEngine.resolve(c3, { summary: "Refund processed — will credit in 2 business days.", resolvedBy: "AGT-02", asOf: AS_OF_50H(now) });
  c3 = ComplaintCRMEngine.close(c3, 4, "Good resolution, just took too long.", "AGT-02");

  let c4 = ComplaintCRMEngine.openComplaint({ customerId: "C-004", customerName: "Deepak Gupta", branchCode: "BR-BLR-01", category: "WRONG_ITEM", priority: "HIGH", subject: "Wrong size delivered", description: "Ordered L but received M.", relatedInvoiceNo: "INV-2026-0799", openedAt: now });
  c4 = ComplaintCRMEngine.assign(c4, "AGT-03", "Karthik Nair", "SUP-01");

  let c5 = ComplaintCRMEngine.openComplaint({ customerId: "C-005", customerName: "Meena Pillai", branchCode: "BR-MUM-01", category: "STAFF_BEHAVIOUR", priority: "LOW", subject: "Staff was rude at billing", description: "Counter staff was dismissive and unhelpful.", openedAt: now });

  return [c1, c2, c3, c4, c5];
}

export const ComplaintCRMModal: React.FC<ComplaintCRMModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [complaints, setComplaints] = useState<Complaint[]>(buildSampleComplaints);
  const [selectedId, setSelectedId] = useState(complaints[0]?.complaintId ?? "");
  const [activeTab, setActiveTab] = useState<"DETAIL" | "CSAT">("DETAIL");
  const [filterStatus, setFilterStatus] = useState<ComplaintStatus | "ALL">("ALL");
  const [csatInput, setCsatInput] = useState<number>(5);
  const [csatComment, setCsatComment] = useState("");
  const [resolveNote, setResolveNote] = useState("");

  const selected = complaints.find((c) => c.complaintId === selectedId);
  const update   = (c: Complaint) => setComplaints((prev) => prev.map((x) => x.complaintId === c.complaintId ? c : x));

  const report = useMemo(() => ComplaintCRMEngine.computeCSATReport(complaints), [complaints]);

  const displayed = filterStatus === "ALL" ? complaints : complaints.filter((c) => c.status === filterStatus);

  if (!isOpen) return null;

  const handleAssign = () => {
    if (!selected) return;
    const agent = AGENTS[Math.floor(Math.random() * AGENTS.length)];
    update(ComplaintCRMEngine.assign(selected, agent.id, agent.name, "SUPERVISOR"));
    onNotification?.("Assigned", `${selected.ticketNo} → ${agent.name}`, "info");
  };

  const handleRespond = () => {
    if (!selected) return;
    update(ComplaintCRMEngine.recordFirstResponse(selected, selected.assignedAgentId ?? "AGT-01", "Thank you for contacting us. We are actively working on your issue.", new Date()));
    onNotification?.("First Response Sent", selected.ticketNo, "info");
  };

  const handleResolve = () => {
    if (!selected || !resolveNote) return;
    update(ComplaintCRMEngine.resolve(selected, { summary: resolveNote, resolvedBy: selected.assignedAgentId ?? "AGT-01", asOf: new Date() }));
    setResolveNote("");
    onNotification?.("Resolved", `${selected.ticketNo} marked resolved.`, "success");
  };

  const handleClose = () => {
    if (!selected) return;
    update(ComplaintCRMEngine.close(selected, csatInput, csatComment || undefined, selected.assignedAgentId ?? "AGT-01"));
    setCsatComment("");
    onNotification?.("Closed", `CSAT: ${csatInput}/5`, "success");
  };

  const handleEscalate = () => {
    if (!selected) return;
    update(ComplaintCRMEngine.escalate(selected, "Manual escalation — management review required.", "SUPERVISOR"));
    onNotification?.("Escalated", selected.ticketNo, "error");
  };

  const sla = selected ? SLA_MATRIX[selected.priority] : null;
  const elapsedH = selected ? Math.round((Date.now() - new Date(selected.openedAt).getTime()) / 360000) / 10 : 0;

  const starRow = (score: number) => (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={`text-lg ${s <= score ? "text-yellow-400" : "text-slate-700"}`}>?</span>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <span className="material-symbols-outlined text-2xl">support_agent</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Customer Complaint & After-Sales CRM Engine</h2>
              <p className="text-xs text-slate-400">SLA Matrix · Auto-Escalation · Resolution Workflow · CSAT Scoring</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["DETAIL", "CSAT"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === tab ? "bg-sky-500/20 text-sky-300 border border-sky-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {tab === "CSAT" ? "CSAT & SLA Report" : "Complaint Detail"}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Complaint list */}
          <div className="w-64 border-r border-slate-800 overflow-y-auto bg-slate-950/30 p-3 space-y-2">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-sky-500/60 mb-2">
              <option value="ALL">All Status</option>
              {(["OPEN","ASSIGNED","IN_PROGRESS","PENDING_CUSTOMER","RESOLVED","CLOSED","ESCALATED"] as ComplaintStatus[]).map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
              ))}
            </select>
            {displayed.map((c) => (
              <button key={c.complaintId} onClick={() => { setSelectedId(c.complaintId); setActiveTab("DETAIL"); }}
                className={`w-full text-left p-3 rounded-xl border transition-all ${selectedId === c.complaintId ? "bg-sky-950/20 border-sky-500/40" : "border-transparent hover:bg-slate-800/60"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-slate-400">{c.ticketNo}</span>
                  {c.isEscalated && <span className="text-[9px] text-rose-300">? ESC</span>}
                </div>
                <p className="text-xs font-medium text-slate-200 truncate">{c.subject}</p>
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_STYLE[c.status]}`}>{c.status.replace(/_/g, " ")}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${PRIORITY_STYLE[c.priority]}`}>{c.priority}</span>
                </div>
              </button>
            ))}
          </div>

          {activeTab === "DETAIL" && selected ? (
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono text-slate-500">{selected.ticketNo}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${PRIORITY_STYLE[selected.priority]}`}>{selected.priority}</span>
                    {selected.isEscalated && <span className="text-[9px] font-bold text-rose-300 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded-full">? ESCALATED</span>}
                  </div>
                  <p className="text-base font-bold text-slate-100">{selected.subject}</p>
                  <p className="text-xs text-slate-400">{selected.customerName} · {selected.branchCode} · {selected.category.replace(/_/g, " ")}</p>
                  {selected.relatedInvoiceNo && <p className="text-[10px] text-indigo-400 mt-0.5">Invoice: {selected.relatedInvoiceNo}</p>}
                  {selected.assignedAgentName && <p className="text-[10px] text-sky-400">Agent: {selected.assignedAgentName}</p>}
                </div>
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${STATUS_STYLE[selected.status]}`}>{selected.status.replace(/_/g, " ")}</span>
              </div>

              {/* SLA panel */}
              {sla && (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "First Response SLA", limit: sla.firstResponseHours, breached: selected.firstResponseSLABreached, responded: !!selected.firstResponseAt },
                    { label: "Resolution SLA",      limit: sla.resolutionHours,    breached: selected.resolutionSLABreached,    responded: !!selected.resolvedAt },
                  ].map((s) => (
                    <div key={s.label} className={`rounded-xl border p-3 ${s.breached ? "bg-rose-950/10 border-rose-500/30" : s.responded ? "bg-emerald-950/10 border-emerald-500/30" : "bg-slate-800/30 border-slate-700/50"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-slate-400">{s.label}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${s.breached ? "text-rose-300 bg-rose-500/20 border-rose-500/30" : s.responded ? "text-emerald-300 bg-emerald-500/20 border-emerald-500/30" : "text-slate-400 bg-slate-700/20 border-slate-600/20"}`}>
                          {s.breached ? "BREACHED" : s.responded ? "MET" : "RUNNING"}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-slate-200">{s.limit}h target · {elapsedH}h elapsed</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Description */}
              <div className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Description</p>
                <p className="text-xs text-slate-300">{selected.description}</p>
              </div>

              {/* Action panel */}
              {!["CLOSED", "CANCELLED"].includes(selected.status) && (
                <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {selected.status === "OPEN" && (
                      <button onClick={handleAssign} className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 transition-all">Assign Agent</button>
                    )}
                    {selected.status === "ASSIGNED" && (
                      <button onClick={handleRespond} className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 transition-all">Send First Response</button>
                    )}
                    {["IN_PROGRESS", "PENDING_CUSTOMER", "REOPENED"].includes(selected.status) && (
                      <div className="flex items-center gap-2 w-full">
                        <input value={resolveNote} data-field-key="remarks" onChange={(e) => setResolveNote(e.target.value)} placeholder="Resolution summary..."
                          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500/60" />
                        <button onClick={handleResolve} disabled={!resolveNote} className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-40 transition-all">Resolve</button>
                      </div>
                    )}
                    {selected.status === "RESOLVED" && (
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex gap-1">
                          {[1,2,3,4,5].map((s) => (
                            <button key={s} onClick={() => setCsatInput(s)} className={`text-2xl transition-all ${s <= csatInput ? "text-yellow-400" : "text-slate-700 hover:text-yellow-600"}`}>?</button>
                          ))}
                        </div>
                        <input value={csatComment} data-field-key="remarks" onChange={(e) => setCsatComment(e.target.value)} placeholder="Customer comment (optional)"
                          className="w-52 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/60" />
                        <button onClick={handleClose} className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all">Close with CSAT</button>
                      </div>
                    )}
                    {!selected.isEscalated && !["RESOLVED","CLOSED","ESCALATED"].includes(selected.status) && (
                      <button onClick={handleEscalate} className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-700 hover:bg-rose-600 transition-all">Escalate</button>
                    )}
                  </div>
                </div>
              )}

              {/* CSAT display for closed */}
              {selected.status === "CLOSED" && selected.csatScore && (
                <div className="bg-emerald-950/10 border border-emerald-500/20 rounded-xl p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1">CSAT Score</p>
                  {starRow(selected.csatScore)}
                  {selected.csatComment && <p className="text-xs text-slate-300 mt-1 italic">"{selected.csatComment}"</p>}
                </div>
              )}

              {/* Activity log */}
              {selected.notes.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Activity Log</p>
                  <div className="space-y-2">
                    {[...selected.notes].reverse().map((n) => (
                      <div key={n.noteId} className={`p-3 rounded-xl border text-xs ${n.isInternal ? "bg-slate-900/60 border-slate-800/60" : "bg-slate-800/30 border-slate-700/50"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          {n.isInternal && <span className="text-[9px] font-bold text-slate-500 bg-slate-700/30 px-1.5 py-0.5 rounded-full border border-slate-600/30">Internal</span>}
                          <span className="text-[10px] text-slate-500">{n.addedBy} · {new Date(n.timestamp).toLocaleTimeString("en-IN")}</span>
                        </div>
                        <p className="text-slate-300">{n.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === "CSAT" ? (
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Summary metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Total",            value: report.totalComplaints,                     color: "text-slate-300" },
                  { label: "Avg CSAT",         value: `${report.avgCSATScore}/5`,                color: "text-yellow-400" },
                  { label: "Resolution Breach",value: `${report.slaResolutionBreachRate}%`,      color: report.slaResolutionBreachRate > 20 ? "text-rose-400" : "text-slate-400" },
                  { label: "Escalation Rate",  value: `${report.escalationRate}%`,               color: report.escalationRate > 10 ? "text-orange-400" : "text-slate-400" },
                ].map((m) => (
                  <div key={m.label} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 text-center">
                    <div className={`text-xl font-black font-mono ${m.color}`}>{m.value}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
                  </div>
                ))}
              </div>

              {/* CSAT distribution */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">CSAT Distribution</p>
                <div className="space-y-2">
                  {[5,4,3,2,1].map((s) => {
                    const cnt = report.csatDistribution[s] ?? 0;
                    const pct = report.csatResponses > 0 ? Math.round((cnt / report.csatResponses) * 100) : 0;
                    return (
                      <div key={s} className="flex items-center gap-3">
                        <span className="text-sm text-yellow-400 w-4">{s}?</span>
                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-yellow-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-400 w-8 text-right">{cnt}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Category breakdown */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">By Category</p>
                <div className="space-y-1.5">
                  {Object.entries(report.byCategory).sort(([,a],[,b]) => b-a).map(([cat, cnt]) => (
                    <div key={cat} className="flex items-center gap-3 text-xs">
                      <span className="text-slate-400 w-40 truncate">{cat.replace(/_/g, " ")}</span>
                      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-sky-500 rounded-full" style={{ width: `${Math.round((cnt / report.totalComplaints) * 100)}%` }} />
                      </div>
                      <span className="font-mono text-slate-300 w-4">{cnt}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* SLA performance summary */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Avg Resolution Time", value: `${report.avgResolutionHours}h`, color: "text-sky-400" },
                  { label: "1st Response Breach",  value: `${report.slaFirstResponseBreachRate}%`, color: report.slaFirstResponseBreachRate > 10 ? "text-rose-400" : "text-emerald-400" },
                  { label: "Reopen Rate",          value: `${report.reopenRate}%`, color: report.reopenRate > 5 ? "text-amber-400" : "text-slate-400" },
                  { label: "CSAT Responses",       value: `${report.csatResponses}/${report.closedComplaints}`, color: "text-slate-300" },
                ].map((m) => (
                  <div key={m.label} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide">{m.label}</span>
                    <span className={`font-black font-mono ${m.color}`}>{m.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default ComplaintCRMModal;

