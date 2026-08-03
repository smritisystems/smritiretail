/**
 * Project      : SMRITI Retail OS v6.5 â€” Platform Architecture Constitution
 * Module       : LineageGraph (SUNEF-GOV-015 Infinite Transaction Lineage Engine)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : Â© SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 3.2.0
 */

import React from "react";
import { SUNEFKernel } from "../../navigation/SUNEFKernel.ts";
import { ChevronRight, FileText, ShoppingBag, Truck, DollarSign, BookOpen, ShieldCheck, Layers, Package } from "lucide-react";

export interface LineageNode {
  id: string;
  type: string;
  label: string;
  subtitle?: string;
  amount?: string;
  status?: string;
}

interface LineageGraphProps {
  nodes: LineageNode[];
  activeId?: string;
  onSelectNode?: (node: LineageNode) => void;
}

export const LineageGraph: React.FC<LineageGraphProps> = ({ nodes, activeId, onSelectNode }) => {
  const getNodeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "quotation":
      case "order":
      case "salesorder": return <ShoppingBag className="w-4 h-4 text-blue-400" />;
      case "invoice":
      case "salesinvoice": return <FileText className="w-4 h-4 text-emerald-400" />;
      case "shipment":
      case "grn": return <Truck className="w-4 h-4 text-amber-400" />;
      case "payment":
      case "receipt": return <DollarSign className="w-4 h-4 text-purple-400" />;
      case "ledger": return <BookOpen className="w-4 h-4 text-cyan-400" />;
      case "batch": return <Layers className="w-4 h-4 text-indigo-400" />;
      case "item": return <Package className="w-4 h-4 text-teal-400" />;
      default: return <ShieldCheck className="w-4 h-4 text-gray-400" />;
    }
  };

  const handleNodeClick = (node: LineageNode) => {
    if (onSelectNode) {
      onSelectNode(node);
    } else {
      SUNEFKernel.open({ type: node.type, id: node.id });
    }
  };

  return (
    <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-3 font-sans select-none shadow-md">
      <div className="flex items-center justify-between border-b border-theme-divider/60 pb-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-theme-heading flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-[var(--c-seef-accent)]">account_tree</span>
          <span>SUNEF Transaction Lineage (Infinite Drill-Down)</span>
        </h4>
        <span className="text-[10px] text-theme-muted font-mono">{nodes.length} Lineage Nodes</span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto py-2 scrollbar-thin scrollbar-thumb-theme-divider">
        {nodes.map((node, index) => {
          const isActive = activeId === node.id;
          return (
            <React.Fragment key={node.id}>
              <div
                onClick={() => handleNodeClick(node)}
                className={`flex-none min-w-[140px] p-3 rounded-lg border transition-all cursor-pointer ${
                  isActive
                    ? "bg-[var(--c-seef-accent)]/10 border-[var(--c-seef-accent)] shadow-xs"
                    : "bg-theme-surface-1 border-theme-divider hover:border-theme-muted hover:bg-theme-surface-hover"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="p-1 rounded bg-theme-surface-3">
                    {getNodeIcon(node.type)}
                  </div>
                  {node.status && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {node.status}
                    </span>
                  )}
                </div>
                <div className="text-xs font-bold text-theme-heading truncate">{node.label}</div>
                <div className="text-[10px] text-theme-muted font-mono truncate">{node.subtitle || `${node.type} ${node.id}`}</div>
                {node.amount && (
                  <div className="text-xs font-bold text-emerald-400 font-mono mt-1">{node.amount}</div>
                )}
              </div>

              {index < nodes.length - 1 && (
                <ChevronRight className="w-4 h-4 text-theme-muted shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
