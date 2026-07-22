/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 2.1.2
 * Created      : 2026-07-10
 * Modified     : 2026-07-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */
import React, { useState } from "react";
import { apiFetchV1 } from "../lib/apiFetchV1";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import { ApiKeyManagementSection } from "./ApiKeyManagementSection.tsx";
import { Plus, Trash2, Edit3, Settings, ShieldAlert, FileText, ChevronRight, Users, CheckCircle2, Copy, AlertCircle, Save, Key } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useNotifications } from "../notifications/notification_store.tsx";

interface ApprovalCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

interface ApprovalLevel {
  id: string;
  level: number;
  approverType: "role" | "user" | "manager";
  approverValue: string;
}

interface ApprovalMatrix {
  id: string;
  name: string;
  documentType: string;
  active: boolean;
  conditions: ApprovalCondition[];
  levels: ApprovalLevel[];
}

const MOCK_MATRICES: ApprovalMatrix[] = [
  {
    id: "AM-001",
    name: "High Value Purchase Orders",
    documentType: "Purchase Order",
    active: true,
    conditions: [
      { id: "c1", field: "Total Amount", operator: ">", value: "50000" }
    ],
    levels: [
      { id: "l1", level: 1, approverType: "role", approverValue: "Procurement Manager" },
      { id: "l2", level: 2, approverType: "role", approverValue: "Finance Director" }
    ]
  },
  {
    id: "AM-002",
    name: "High Discount Sales",
    documentType: "Sales Invoice",
    active: true,
    conditions: [
      { id: "c2", field: "Discount %", operator: ">", value: "15" }
    ],
    levels: [
      { id: "l3", level: 1, approverType: "manager", approverValue: "Reporting Manager" },
      { id: "l4", level: 2, approverType: "role", approverValue: "Regional Head" }
    ]
  }
];

export const ApprovalMatrixTab: React.FC = () => {
  const [activeView, setActiveView] = useState<"dashboard" | "configuration" | "api_keys">("dashboard");
  const [pendingDocs, setPendingDocs] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  React.useEffect(() => {
    if (activeView === "dashboard") {
      fetchPendingApprovals();
    }
  }, [activeView]);

  const fetchPendingApprovals = async () => {
    setLoadingDocs(true);
    try {
      // Fetch real Phase 6 pending approval requests
      const approvalData = await apiFetchV1('/approvals/pending');
      if (Array.isArray(approvalData) && approvalData.length > 0) {
        setPendingDocs(approvalData.map((d: any) => ({
          id: d.id,
          docType: d.document_type,
          status: d.status,
          _title: `${d.document_type} #${d.document_id}`,
          _desc: `Awaiting Step ${d.current_step_order} Approval`,
          grandTotal: d.payload?.amount || 0,
        })));
      } else {
        // Fallback to purchase/sales queries
        const [poData, qData, soData] = await Promise.all([
          apiFetchV1('/purchase/orders/'),
          apiFetchV1('/sales/quotations/'),
          apiFetchV1('/sales/orders/')
        ]);

        const pos = poData?.orders ?? poData ?? [];
        const qs = qData?.quotations ?? qData ?? [];
        const sos = soData?.orders ?? soData ?? [];

        const filteredPos = pos.filter((d: any) => d.status === 'Submitted').map((d: any) => ({ ...d, docType: 'PurchaseOrder', _title: d.orderNo, _desc: d.supplierName }));
        const filteredQs = qs.filter((d: any) => d.status === 'Submitted').map((d: any) => ({ ...d, docType: 'Quotation', _title: d.quotationNo, _desc: d.customerName }));
        const filteredSos = sos.filter((d: any) => d.status === 'Submitted').map((d: any) => ({ ...d, docType: 'SalesOrder', _title: d.orderNo, _desc: d.customerName }));

        setPendingDocs([...filteredPos, ...filteredQs, ...filteredSos]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleWorkflowAction = async (docType: string, id: string, action: string) => {
    try {
      const res = await apiFetchV1(`workflow/${docType}/${id}/${action}`, {
        method: "POST"
      });
      if (res.ok) {
        addNotification({ title: "Success", message: `Document ${action}ed successfully.`, type: "system", priority: "medium" });
        fetchPendingApprovals();
      } else {
        const err = await res.json();
        addNotification({ title: "Error", message: err.error || "Action failed", type: "alert", priority: "high" });
      }
    } catch (e) {
      addNotification({ title: "Error", message: "Network error", type: "alert", priority: "high" });
    }
  };

  const [matrices, setMatrices] = useState<ApprovalMatrix[]>(MOCK_MATRICES);
  const [selectedId, setSelectedId] = useState<string | null>(MOCK_MATRICES[0].id);
  const [isEditing, setIsEditing] = useState(false);
  const { emitEvent, addNotification } = useNotifications();

  const selectedMatrix = matrices.find(m => m.id === selectedId) || null;

  const handleToggleEdit = () => {
    if (isEditing) {
      // Save changes action
      emitEvent({
        module: "ApprovalMatrix",
        event: "MatrixUpdated",
        payload: { matrixId: selectedId }
      });
      addNotification({
        title: "Workflow Updated",
        message: `Approval rules for ${selectedMatrix?.name} have been updated successfully.`,
        type: "system",
        priority: "medium",
        actionUrl: "approval-matrix"
      });
    }
    setIsEditing(!isEditing);
  };

  
  return (
    <div className="flex flex-col h-full bg-theme-base font-sans overflow-hidden text-theme-body">
      <div className="flex items-center px-4 py-2 border-b border-theme-divider bg-theme-surface-1 gap-4 shrink-0">
        <button 
          onClick={() => setActiveView("dashboard")}
          className={`px-4 py-2 text-sm font-bold font-display rounded-lg transition-colors ${activeView === "dashboard" ? "bg-blue-600 text-white" : "text-theme-muted hover:bg-theme-surface-2"}`}
        >
          Approval Dashboard
        </button>
        <button 
          onClick={() => setActiveView("configuration")}
          className={`px-4 py-2 text-sm font-bold font-display rounded-lg transition-colors ${activeView === "configuration" ? "bg-blue-600 text-white" : "text-theme-muted hover:bg-theme-surface-2"}`}
        >
          Matrix Configuration
        </button>
        <button 
          onClick={() => setActiveView("api_keys")}
          className={`px-4 py-2 text-sm font-bold font-display rounded-lg transition-colors flex items-center gap-1.5 ${activeView === "api_keys" ? "bg-emerald-600 text-white" : "text-theme-muted hover:bg-theme-surface-2"}`}
        >
          <Key size={14} /> Service Accounts & API Keys
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {activeView === "dashboard" ? (
          <div className="flex-1 flex flex-col bg-theme-surface-1">
            <div className="px-8 py-5 border-b border-theme-divider bg-theme-surface-2 shrink-0">
              <h1 className="text-xl font-bold font-display text-theme-primary tracking-tight">Pending Approvals</h1>
              <p className="text-xs text-theme-muted mt-1">Review and action documents awaiting your approval.</p>
            </div>
            <SmritiScrollArea className="flex-1 p-8">
              {loadingDocs ? (
                <div className="text-center text-theme-muted p-8">Loading pending documents...</div>
              ) : pendingDocs.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-theme-muted py-20">
                  <CheckCircle2 size={48} className="mb-4 text-emerald-500/50" />
                  <p className="text-lg font-medium">All Caught Up!</p>
                  <p className="text-sm">No documents are currently awaiting your review.</p>
                </div>
              ) : (
                <div className="space-y-4 max-w-5xl mx-auto">
                  {pendingDocs.map(doc => (
                    <div key={doc.id} className="bg-theme-surface-2 p-5 rounded-xl border border-theme-divider shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-950 text-amber-400 border border-amber-800">
                            {doc.status}
                          </span>
                          <span className="text-[10px] font-mono text-theme-muted uppercase tracking-wider bg-theme-surface-3 px-2 py-0.5 rounded border border-theme-divider">
                            {doc.docType.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold font-display text-blue-400">{doc._title}</h3>
                        <p className="text-sm text-theme-muted mt-0.5">{doc._desc}</p>
                        <div className="text-xs text-theme-muted mt-2 font-mono">
                          Value: <span className="font-semibold text-emerald-400">₹{doc.grandTotal?.toLocaleString("en-IN") || '0'}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        <button 
                          onClick={() => handleWorkflowAction(doc.docType, doc.id, "approve")}
                          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs shadow-lg transition-colors"
                        >
                          <CheckCircle2 size={16} /> Approve
                        </button>
                        <button 
                          onClick={() => handleWorkflowAction(doc.docType, doc.id, "reject")}
                          className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold text-xs shadow-lg transition-colors"
                        >
                          <Edit3 size={16} /> Request Changes
                        </button>
                        <button 
                          onClick={() => handleWorkflowAction(doc.docType, doc.id, "reject")}
                          className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold text-xs shadow-lg transition-colors"
                        >
                          <XIcon size={16} /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SmritiScrollArea>
          </div>
        ) : activeView === "configuration" ? (
          <>
            {/* Sidebar - List of Matrices */}

      <div className="w-80 border-r border-theme-divider bg-theme-surface-1 flex flex-col">
        <div className="p-4 border-b border-theme-divider flex justify-between items-center bg-theme-surface-2">
          <div>
            <h2 className="font-bold font-display text-theme-primary">Approval Matrix</h2>
            <p className="text-[10px] text-theme-muted uppercase tracking-wider font-mono">Workflow Engine</p>
          </div>
          <button className="p-1.5 bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500/20 transition-colors">
            <Plus size={16} />
          </button>
        </div>
        
        <SmritiScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {matrices.map(matrix => (
              <button
                key={matrix.id}
                onClick={() => { setSelectedId(matrix.id); setIsEditing(false); }}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedId === matrix.id 
                    ? "bg-theme-surface-3 border-blue-500/30 shadow-sm" 
                    : "bg-transparent border-transparent hover:bg-theme-surface-hover hover:border-theme-divider"
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="font-semibold text-sm truncate pr-2 text-theme-primary">{matrix.name}</span>
                  {matrix.active ? (
                    <span className="shrink-0 w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></span>
                  ) : (
                    <span className="shrink-0 w-2 h-2 rounded-full bg-theme-muted mt-1.5"></span>
                  )}
                </div>
                <div className="text-[10px] text-theme-muted font-mono mt-1 flex items-center gap-1.5">
                  <FileText size={10} />
                  <span>{matrix.documentType}</span>
                  <span>•</span>
                  <span>{matrix.levels.length} Levels</span>
                </div>
              </button>
            ))}
          </div>
        </SmritiScrollArea>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-theme-surface-1 overflow-hidden">
        {selectedMatrix ? (
          <>
            <div className="px-8 py-5 border-b border-theme-divider bg-theme-surface-2 shrink-0 flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold font-display text-theme-primary tracking-tight">{selectedMatrix.name}</h1>
                <div className="flex items-center gap-3 mt-1 text-xs text-theme-muted font-mono uppercase tracking-wider">
                  <span className="flex items-center gap-1"><FileText size={12} /> {selectedMatrix.documentType}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><ShieldAlert size={12} /> {selectedMatrix.id}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleToggleEdit}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors border ${
                    isEditing 
                      ? "bg-blue-500 text-white border-blue-500 hover:bg-blue-600"
                      : "bg-theme-surface-3 text-theme-primary border-theme-divider hover:bg-theme-surface-hover"
                  }`}
                >
                  {isEditing ? <Save size={14} /> : <Edit3 size={14} />}
                  <span>{isEditing ? "Save Changes" : "Edit Workflow"}</span>
                </button>
              </div>
            </div>

            <SmritiScrollArea className="flex-1 p-8">
              <div className="max-w-4xl mx-auto space-y-8">
                
                {/* Configuration Overview */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-theme-surface-2 p-5 rounded-xl border border-theme-divider shadow-sm">
                    <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-theme-muted mb-4 flex items-center gap-2">
                      <Settings size={14} /> Basic Settings
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-mono text-theme-muted block mb-1">Workflow Name</label>
                        {isEditing ? (
                          <input type="text" defaultValue={selectedMatrix.name} className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                        ) : (
                          <div className="text-sm font-semibold">{selectedMatrix.name}</div>
                        )}
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-mono text-theme-muted block mb-1">Document Type</label>
                        {isEditing ? (
                          <select defaultValue={selectedMatrix.documentType} className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                            <option>Purchase Order</option>
                            <option>Sales Invoice</option>
                            <option>Goods Receipt</option>
                            <option>Journal Entry</option>
                          </select>
                        ) : (
                          <div className="text-sm font-semibold">{selectedMatrix.documentType}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${selectedMatrix.active ? 'bg-emerald-500' : 'bg-theme-surface-4'}`}>
                          <div className={`w-3 h-3 rounded-full bg-white transition-transform ${selectedMatrix.active ? 'translate-x-4' : 'translate-x-0'}`}></div>
                        </div>
                        <span className="text-sm font-medium">Active</span>
                      </div>
                    </div>
                  </div>

                  {/* Conditions */}
                  <div className="bg-theme-surface-2 p-5 rounded-xl border border-theme-divider shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-theme-muted flex items-center gap-2">
                        <AlertCircle size={14} /> Trigger Conditions
                      </h3>
                      {isEditing && (
                        <button className="text-blue-400 hover:text-blue-300 text-xs font-mono">+ Add Condition</button>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      {selectedMatrix.conditions.map((cond, idx) => (
                        <div key={cond.id} className="flex items-center gap-2 bg-theme-surface-3 p-3 rounded-lg border border-theme-divider">
                          <div className="w-5 h-5 rounded-full bg-theme-surface-4 flex items-center justify-center text-[10px] font-mono shrink-0">
                            {idx + 1}
                          </div>
                          <div className="flex-1 flex gap-2 items-center text-sm">
                            {isEditing ? (
                              <>
                                <select defaultValue={cond.field} className="flex-1 bg-theme-surface-1 border border-theme-divider rounded px-2 py-1 focus:outline-none">
                                  <option>Total Amount</option>
                                  <option>Discount %</option>
                                </select>
                                <select defaultValue={cond.operator} className="w-16 bg-theme-surface-1 border border-theme-divider rounded px-2 py-1 focus:outline-none text-center">
                                  <option>{">"}</option>
                                  <option>{"<"}</option>
                                  <option>{"="}</option>
                                </select>
                                <input type="text" defaultValue={cond.value} className="flex-1 bg-theme-surface-1 border border-theme-divider rounded px-2 py-1 focus:outline-none" />
                                <button className="text-rose-400 hover:text-rose-300"><Trash2 size={14} /></button>
                              </>
                            ) : (
                              <>
                                <span className="font-semibold text-blue-400">{cond.field}</span>
                                <span className="text-theme-muted font-mono">{cond.operator}</span>
                                <span className="font-semibold bg-theme-surface-4 px-2 py-0.5 rounded font-mono">{cond.value}</span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                      {selectedMatrix.conditions.length === 0 && (
                        <div className="text-sm text-theme-muted italic">Always triggers for {selectedMatrix.documentType}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Approval Hierarchy */}
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold font-display flex items-center gap-2">
                      <Users size={18} className="text-blue-500" />
                      Approval Hierarchy
                    </h2>
                    {isEditing && (
                      <button className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider rounded-lg text-sm font-semibold transition-colors">
                        <Plus size={14} /> Add Level
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    {selectedMatrix.levels.map((level, idx) => (
                      <div key={level.id} className="relative">
                        {idx !== 0 && (
                          <div className="absolute -top-4 left-6 w-0.5 h-4 bg-theme-divider"></div>
                        )}
                        <div className="flex items-start gap-4">
                          <div className="shrink-0 w-12 h-12 rounded-xl bg-theme-surface-2 border border-theme-divider flex flex-col items-center justify-center relative z-10 shadow-sm">
                            <span className="text-[10px] text-theme-muted font-mono uppercase">Lvl</span>
                            <span className="text-lg font-bold font-display leading-none text-blue-400">{level.level}</span>
                          </div>
                          
                          <div className="flex-1 bg-theme-surface-2 border border-theme-divider rounded-xl p-4 shadow-sm group hover:border-blue-500/30 transition-colors">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="text-[10px] font-mono uppercase tracking-wider text-theme-muted mb-1 flex items-center gap-1.5">
                                  {level.approverType === 'role' && <ShieldAlert size={10} />}
                                  {level.approverType === 'manager' && <Users size={10} />}
                                  {level.approverType === 'user' && <CheckCircle2 size={10} />}
                                  {level.approverType.toUpperCase()} APPROVER
                                </div>
                                {isEditing ? (
                                  <div className="flex gap-3 mt-2">
                                    <select defaultValue={level.approverType} className="w-32 bg-theme-surface-3 border border-theme-divider rounded-lg px-3 py-2 text-sm focus:outline-none">
                                      <option value="role">Role</option>
                                      <option value="manager">Manager</option>
                                      <option value="user">Specific User</option>
                                    </select>
                                    <input type="text" defaultValue={level.approverValue} className="flex-1 bg-theme-surface-3 border border-theme-divider rounded-lg px-3 py-2 text-sm focus:outline-none" />
                                  </div>
                                ) : (
                                  <div className="text-base font-semibold mt-0.5">{level.approverValue}</div>
                                )}
                              </div>
                              
                              <div className="flex gap-2">
                                {isEditing && (
                                  <button className="p-2 text-theme-muted hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            {!isEditing && (
                              <div className="mt-4 pt-3 border-t border-theme-divider flex gap-3 text-xs">
                                <span className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded font-semibold">
                                  <CheckCircle2 size={12} /> Can Approve
                                </span>
                                <span className="flex items-center gap-1 text-rose-500 bg-rose-500/10 px-2 py-1 rounded font-semibold">
                                  <XIcon size={12} /> Can Reject
                                </span>
                                <span className="flex items-center gap-1 text-amber-500 bg-amber-500/10 px-2 py-1 rounded font-semibold">
                                  <Edit3 size={12} /> Can Request Changes
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </SmritiScrollArea>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-theme-muted">
            <ShieldAlert size={48} className="mb-4 opacity-20" />
            <p>Select a workflow to view details</p>
          </div>
        )}
            </div>
          </>
        ) : activeView === "api_keys" ? (
          <div className="flex-1 p-6 overflow-auto">
            <ApiKeyManagementSection />
          </div>
        ) : null}
      </div>
    </div>
  );
};

// Simple X icon since we missed it in the main import
const XIcon = ({ size = 24, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);
