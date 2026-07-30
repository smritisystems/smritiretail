/**
 * Project      : SMRITI Business OS
 * Component    : StatutoryComplianceWorkspace (SCP Compliance Studio)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 * Classification: SMRITI Compliance Platform (SCP v1.0 Kernel)
 */

import React, { useState } from "react";
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  Download, 
  Send, 
  Settings, 
  RefreshCw, 
  PlayCircle,
  HelpCircle,
  Database,
  Layers
} from "lucide-react";
import { ExceptionWorkbenchModal } from "./ExceptionWorkbenchModal";
import { IWorkspace } from "../../sdk/IWorkspace";

interface StatutoryComplianceWorkspaceProps {
  period?: string;
}

export const StatutoryComplianceWorkspace: React.FC<StatutoryComplianceWorkspaceProps> & {
  manifestId?: string;
} = ({ period = "2026-07" }) => {
  const [selectedReturn, setSelectedReturn] = useState<"GSTR-1" | "GSTR-3B" | "TDS-26Q">("GSTR-1");
  const [isWorkbenchOpen, setIsWorkbenchOpen] = useState<boolean>(false);
  const [isSimulatingSandbox, setIsSimulatingSandbox] = useState<boolean>(false);
  const [activeFeatureToggles, setActiveFeatureToggles] = useState<Record<string, boolean>>({
    gst_b2b: true,
    tds_194c: true,
    tcs_207c: false,
    einvoice_irn: true,
    eway_bill: true,
    msme_45day: true,
  });

  const toggleFeature = (key: string) => {
    setActiveFeatureToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="w-full h-full bg-[#0B0F17] text-theme-body flex flex-col overflow-hidden font-sans">
      {/* Workspace Header */}
      <div className="px-6 py-4 border-b border-theme-divider bg-[#121824] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-950/80 border border-indigo-500/40 rounded-xl text-indigo-400 shadow-md">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold font-display text-theme-heading flex items-center gap-2">
              <span>SMRITI Compliance Platform (SCP v1.0)</span>
              <span className="px-2.5 py-0.5 text-xs font-mono bg-indigo-950/60 border border-indigo-500/30 text-indigo-400 rounded-full">
                Kernel Stage 4
              </span>
            </h2>
            <p className="text-xs text-theme-muted">
              5-Stage Statutory Compliance Pipeline (Config ──► Validate ──► Calculate ──► Comply ──► File)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsWorkbenchOpen(true)}
            className="px-3.5 py-2 bg-rose-950/40 border border-rose-500/40 hover:bg-rose-900/60 text-rose-300 text-xs font-semibold rounded-xl transition flex items-center gap-2 shadow-md"
          >
            <AlertTriangle size={15} />
            <span>Exception Workbench (2 Errors)</span>
          </button>

          <button
            onClick={() => {
              setIsSimulatingSandbox(true);
              setTimeout(() => setIsSimulatingSandbox(false), 800);
            }}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md transition flex items-center gap-2"
          >
            <PlayCircle size={15} className={isSimulatingSandbox ? "animate-spin" : ""} />
            <span>Simulate Sandbox</span>
          </button>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Telemetry Counter Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-theme-surface-1 border border-theme-divider flex items-center justify-between">
            <div>
              <span className="text-xs text-theme-muted font-semibold uppercase tracking-wider">Ready to File</span>
              <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">1,248</div>
              <span className="text-[11px] text-theme-muted">Clean Vouchers (98.4%)</span>
            </div>
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-400">
              <CheckCircle2 size={24} />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-theme-surface-1 border border-theme-divider flex items-center justify-between">
            <div>
              <span className="text-xs text-theme-muted font-semibold uppercase tracking-wider">Blocking Errors</span>
              <div className="text-2xl font-bold font-mono text-rose-400 mt-1">2</div>
              <span className="text-[11px] text-theme-muted">Requires Fix in Workbench</span>
            </div>
            <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-rose-400">
              <XCircle size={24} />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-theme-surface-1 border border-theme-divider flex items-center justify-between">
            <div>
              <span className="text-xs text-theme-muted font-semibold uppercase tracking-wider">Warnings</span>
              <div className="text-2xl font-bold font-mono text-amber-400 mt-1">5</div>
              <span className="text-[11px] text-theme-muted">Non-Blocking Alerts</span>
            </div>
            <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl text-amber-400">
              <AlertTriangle size={24} />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-theme-surface-1 border border-theme-divider flex items-center justify-between">
            <div>
              <span className="text-xs text-theme-muted font-semibold uppercase tracking-wider">Net GST Liability</span>
              <div className="text-2xl font-bold font-mono text-indigo-400 mt-1">₹4,28,450</div>
              <span className="text-[11px] text-theme-muted">Period {period} Set-Off</span>
            </div>
            <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-indigo-400">
              <FileText size={24} />
            </div>
          </div>
        </div>

        {/* 2-Column Splitter: Return Reconciler Studio & Statutory Feature Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Return Reconciler Studio */}
          <div className="lg:col-span-2 space-y-4">
            <div className="p-5 rounded-2xl bg-theme-surface-1 border border-theme-divider space-y-4">
              <div className="flex items-center justify-between border-b border-theme-divider pb-3">
                <div className="flex items-center gap-2">
                  <Layers size={18} className="text-indigo-400" />
                  <h3 className="font-bold text-sm text-theme-heading">4-Bucket Return Reconciler Studio</h3>
                </div>

                <div className="flex items-center gap-2">
                  {(["GSTR-1", "GSTR-3B", "TDS-26Q"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setSelectedReturn(r)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                        selectedReturn === r
                          ? "bg-indigo-600 text-white shadow-md"
                          : "bg-theme-surface-2 text-theme-muted hover:text-theme-body"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-theme-surface-2 text-theme-muted uppercase font-mono text-[10px]">
                    <tr>
                      <th className="px-3 py-2.5 rounded-l-xl">Section / Table</th>
                      <th className="px-3 py-2.5">Records</th>
                      <th className="px-3 py-2.5 text-right">Taxable Value (₹)</th>
                      <th className="px-3 py-2.5 text-right">CGST (₹)</th>
                      <th className="px-3 py-2.5 text-right">SGST (₹)</th>
                      <th className="px-3 py-2.5 text-right rounded-r-xl">IGST (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-divider/60">
                    <tr>
                      <td className="px-3 py-3 font-semibold text-theme-heading">4A - B2B Registered Sales</td>
                      <td className="px-3 py-3 font-mono">420</td>
                      <td className="px-3 py-3 font-mono text-right">18,50,000.00</td>
                      <td className="px-3 py-3 font-mono text-right text-emerald-400">1,66,500.00</td>
                      <td className="px-3 py-3 font-mono text-right text-emerald-400">1,66,500.00</td>
                      <td className="px-3 py-3 font-mono text-right text-indigo-400">0.00</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-3 font-semibold text-theme-heading">5 - B2CL Large Interstate Sales</td>
                      <td className="px-3 py-3 font-mono">18</td>
                      <td className="px-3 py-3 font-mono text-right">5,20,000.00</td>
                      <td className="px-3 py-3 font-mono text-right">0.00</td>
                      <td className="px-3 py-3 font-mono text-right">0.00</td>
                      <td className="px-3 py-3 font-mono text-right text-indigo-400">93,600.00</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-3 font-semibold text-theme-heading">7 - B2CS Small Consumer Sales</td>
                      <td className="px-3 py-3 font-mono">810</td>
                      <td className="px-3 py-3 font-mono text-right">12,10,000.00</td>
                      <td className="px-3 py-3 font-mono text-right text-emerald-400">1,08,900.00</td>
                      <td className="px-3 py-3 font-mono text-right text-emerald-400">1,08,900.00</td>
                      <td className="px-3 py-3 font-mono text-right">0.00</td>
                    </tr>
                    <tr className="bg-indigo-950/20 font-bold">
                      <td className="px-3 py-3 text-indigo-300">Total {selectedReturn} Outward Liability</td>
                      <td className="px-3 py-3 font-mono text-indigo-300">1,248</td>
                      <td className="px-3 py-3 font-mono text-right text-indigo-300">35,80,000.00</td>
                      <td className="px-3 py-3 font-mono text-right text-emerald-400">2,75,400.00</td>
                      <td className="px-3 py-3 font-mono text-right text-emerald-400">2,75,400.00</td>
                      <td className="px-3 py-3 font-mono text-right text-indigo-400">93,600.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button className="px-3.5 py-2 bg-theme-surface-2 border border-theme-divider hover:border-theme-muted text-theme-body text-xs font-semibold rounded-xl transition flex items-center gap-1.5">
                  <Download size={14} />
                  <span>Export Government JSON</span>
                </button>
                <button className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-md transition flex items-center gap-1.5">
                  <Send size={14} />
                  <span>Direct NIC Portal Push</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Col: Statutory Feature Matrix */}
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-theme-surface-1 border border-theme-divider space-y-4">
              <div className="flex items-center gap-2 border-b border-theme-divider pb-3">
                <Settings size={18} className="text-indigo-400" />
                <h3 className="font-bold text-sm text-theme-heading">Statutory Feature Activation</h3>
              </div>

              <div className="space-y-3 text-xs">
                {[
                  { key: "gst_b2b", label: "GST B2B & Interstate Tax Engine", desc: "Mandatory CGST/SGST/IGST calculation" },
                  { key: "tds_194c", label: "Income Tax TDS 194C / 194J", desc: "Contractor & Professional tax deduction" },
                  { key: "tcs_207c", label: "TCS Section 206C(1H)", desc: "Tax collection on high-value sale of goods" },
                  { key: "einvoice_irn", label: "E-Invoice SHA-256 IRN & QR", desc: "Government e-invoicing > ₹5 Cr turnover" },
                  { key: "eway_bill", label: "Statutory E-Way Bill Gateway", desc: "E-way bill generation > ₹50,000 threshold" },
                  { key: "msme_45day", label: "MSME 45-Day Payment Rule", desc: "Strict Sec 43B(h) deduction monitoring" },
                ].map((feat) => (
                  <div key={feat.key} className="flex items-center justify-between p-2.5 rounded-xl bg-theme-surface-2 border border-theme-divider">
                    <div>
                      <div className="font-semibold text-theme-heading">{feat.label}</div>
                      <div className="text-[10px] text-theme-muted">{feat.desc}</div>
                    </div>

                    <button
                      onClick={() => toggleFeature(feat.key)}
                      className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
                        activeFeatureToggles[feat.key] ? "bg-indigo-600" : "bg-theme-surface-3"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          activeFeatureToggles[feat.key] ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Exception Workbench Modal */}
      <ExceptionWorkbenchModal
        isOpen={isWorkbenchOpen}
        onClose={() => setIsWorkbenchOpen(false)}
        period={period}
      />
    </div>
  );
};

StatutoryComplianceWorkspace.manifestId = "statutory-compliance";
