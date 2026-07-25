/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Version    : 3.37.0 (9-Tier PRN Script Rule Mapping Matrix Sub-Component)
 * Created    : 2026-07-25
 * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License    : Proprietary Commercial Software
 */

import React, { useState } from "react";
import { GitMerge, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { 
  PRNMappingRule, 
  PRNRulePriorityTier, 
  getStoredPRNMappingRules, 
  savePRNMappingRules 
} from "../../services/print_labels/prnMappingService.ts";

export const PRNMappingPanel: React.FC = () => {
  const [rules, setRules] = useState<PRNMappingRule[]>(() => getStoredPRNMappingRules());
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newTier, setNewTier] = useState<PRNRulePriorityTier>("Brand");
  const [newPattern, setNewPattern] = useState<string>("");
  const [newTemplate, setNewTemplate] = useState<string>("Garment_Label.prn");

  const handleAddRule = () => {
    if (!newPattern.trim()) return;
    const rule: PRNMappingRule = {
      id: `rule-${Date.now()}`,
      tier: newTier,
      matchPattern: newPattern,
      templateName: newTemplate,
      templateScript: "^XA^PR4,4...^XZ",
      protocol: "ZPL",
      description: `${newTier} matching rule for ${newPattern}`,
      isActive: true
    };

    const updated = [rule, ...rules];
    setRules(updated);
    savePRNMappingRules(updated);
    setNewPattern("");
    setShowAddModal(false);
  };

  const handleDeleteRule = (id: string) => {
    const updated = rules.filter(r => r.id !== id);
    setRules(updated);
    savePRNMappingRules(updated);
  };

  return (
    <div className="bg-[#141726] border border-slate-800 rounded-2xl p-4 space-y-4 shadow-xl font-mono text-xs max-w-5xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div>
          <h2 className="text-sm font-bold text-white uppercase flex items-center gap-2">
            <GitMerge size={18} className="text-amber-400" />
            9-Tier Automatic PRN Rule Mapping Matrix (SMRITI Priority Engine)
          </h2>
          <p className="text-[11px] text-slate-400">First matching rule in priority order automatically resolves PRN template for item</p>
        </div>

        <button 
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg"
        >
          <Plus size={14} /> Add Mapping Rule
        </button>
      </div>

      {/* 9-Tier Hierarchy Indicator Ribbon */}
      <div className="bg-[#0a0c14] border border-slate-800 rounded-xl p-2.5 flex flex-wrap items-center gap-1 text-[10px] text-slate-300">
        <span className="text-slate-500 font-bold uppercase mr-1">Rule Hierarchy:</span>
        {["Item", "Barcode", "Variant", "Style", "Brand", "Category", "Department", "Company", "Default"].map((tier, idx) => (
          <span key={tier} className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded text-amber-300 font-bold">
            {idx + 1}. {tier}
            {idx < 8 && <span className="text-slate-600">→</span>}
          </span>
        ))}
      </div>

      {/* Rules Table */}
      <div className="overflow-x-auto border border-slate-800 rounded-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-[#0a0c14] text-slate-400 uppercase text-[10px]">
            <tr>
              <th className="p-2.5 border border-slate-800">Priority Tier</th>
              <th className="p-2.5 border border-slate-800">Match Pattern</th>
              <th className="p-2.5 border border-slate-800">Assigned PRN Template</th>
              <th className="p-2.5 border border-slate-800">Protocol</th>
              <th className="p-2.5 border border-slate-800">Status</th>
              <th className="p-2.5 border border-slate-800 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-200">
            {rules.map(rule => (
              <tr key={rule.id} className="hover:bg-slate-800/40">
                <td className="p-2.5 border border-slate-800 font-bold text-amber-300">
                  <span className="bg-amber-950/60 text-amber-300 px-2 py-0.5 rounded border border-amber-800/40">
                    {rule.tier}
                  </span>
                </td>
                <td className="p-2.5 border border-slate-800 font-bold text-indigo-300">{rule.matchPattern}</td>
                <td className="p-2.5 border border-slate-800 text-emerald-300 font-bold">{rule.templateName}</td>
                <td className="p-2.5 border border-slate-800 font-bold text-purple-300">{rule.protocol}</td>
                <td className="p-2.5 border border-slate-800">
                  <span className="text-[10px] bg-emerald-950/60 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800/40 font-bold flex items-center gap-1 w-max">
                    <CheckCircle2 size={10} /> Active
                  </span>
                </td>
                <td className="p-2.5 border border-slate-800 text-right">
                  {rule.tier !== "Default" && (
                    <button onClick={() => handleDeleteRule(rule.id)} className="p-1 text-red-400 hover:text-red-300 bg-red-950/40 rounded">
                      <Trash2 size={13} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal: Add PRN Rule */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141726] border border-amber-500/40 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white uppercase">Add PRN Rule Mapping</h3>

            <div className="space-y-3">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Select Priority Tier:</span>
                <select value={newTier} onChange={e => setNewTier(e.target.value as PRNRulePriorityTier)} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2.5 py-1 text-amber-300 font-bold">
                  {["Item", "Barcode", "Variant", "Style", "Brand", "Category", "Department", "Company"].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Match Pattern (SKU / Brand / Category name):</span>
                <input type="text" value={newPattern} onChange={e => setNewPattern(e.target.value)} placeholder="e.g. Nike or SHT-001" className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2.5 py-1 text-slate-200" />
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Assigned PRN Template Name:</span>
                <input type="text" value={newTemplate} onChange={e => setNewTemplate(e.target.value)} className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2.5 py-1 text-emerald-300" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAddModal(false)} className="px-3 py-1.5 bg-slate-800 text-slate-300 font-bold rounded-lg">Cancel</button>
              <button onClick={handleAddRule} className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg">Save Rule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
