/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Metadata-Driven Document Accordion Panels
 */

import React, { useState } from "react";
import { ChevronDown, ChevronRight, User, Building, Truck, FileText, Percent, ShieldCheck, DollarSign, Layers } from "lucide-react";
import { SAWFPanelMeta, SAWFExperienceMode } from "../types/sawf.ts";

interface DocumentPanelsProps {
  panels: SAWFPanelMeta[];
  mode: SAWFExperienceMode;
  renderPanelContent: (panelId: string) => React.ReactNode;
}

export const DocumentPanels: React.FC<DocumentPanelsProps> = ({
  panels,
  mode,
  renderPanelContent,
}) => {
  // Filter panels visible in current experience mode
  const visiblePanels = panels.filter((p) => p.modes.includes(mode));

  const [expandedState, setExpandedState] = useState<Record<string, boolean>>({
    customer: true,
    commercial: true,
    tax: true,
  });

  const togglePanel = (panelId: string) => {
    setExpandedState((prev) => ({
      ...prev,
      [panelId]: !prev[panelId],
    }));
  };

  const getPanelIcon = (id: string) => {
    switch (id) {
      case "customer":
        return <User size={15} className="text-indigo-400" />;
      case "commercial":
        return <Building size={15} className="text-sky-400" />;
      case "inventory":
        return <Layers size={15} className="text-emerald-400" />;
      case "pricing":
        return <DollarSign size={15} className="text-amber-400" />;
      case "tax":
        return <Percent size={15} className="text-amber-400" />;
      case "accounting":
        return <FileText size={15} className="text-purple-400" />;
      case "shipping":
        return <Truck size={15} className="text-blue-400" />;
      case "compliance":
        return <ShieldCheck size={15} className="text-rose-400" />;
      default:
        return <Layers size={15} className="text-slate-400" />;
    }
  };

  return (
    <div className="space-y-4">
      {visiblePanels.map((panel) => {
        const isExpanded = !!expandedState[panel.id];
        return (
          <div
            key={panel.id}
            className="bg-[#161E2E] border border-[#1E293B] rounded-2xl overflow-hidden shadow-lg transition-all"
          >
            {/* Accordion Header */}
            <button
              type="button"
              onClick={() => togglePanel(panel.id)}
              className="w-full bg-[#121824] px-5 py-3.5 flex items-center justify-between hover:bg-[#1A2333] transition cursor-pointer select-none"
            >
              <div className="flex items-center space-x-3">
                {getPanelIcon(panel.id)}
                <span className="font-bold text-xs font-display text-slate-100 uppercase tracking-wider">
                  {panel.label}
                </span>
              </div>
              <div className="text-slate-400">
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>
            </button>

            {/* Accordion Content */}
            {isExpanded && (
              <div className="p-5 border-t border-[#1E293B] animate-in fade-in duration-150">
                {renderPanelContent(panel.id)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
