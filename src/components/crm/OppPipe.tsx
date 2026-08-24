/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-13
 * Modified     : 2026-07-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React from "react";
import { Lead } from "../../services/crmService.ts";

interface OpportunityPipelineProps {
  leads: Lead[];
}

export const OpportunityPipeline: React.FC<OpportunityPipelineProps> = ({ leads }) => {
  const stages = ["New", "Contacted", "Qualified"];

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-bold text-theme-primary font-display uppercase tracking-wider">
        Opportunity Pipeline
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stages.map((stage) => {
          const items = leads.filter(l => l.status === stage);
          return (
            <div key={stage} className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 flex flex-col h-[400px] shadow-lg">
              <div className="flex items-center justify-between mb-4 border-b border-theme-divider pb-2">
                <span className="font-bold text-xs uppercase tracking-wider font-mono text-theme-primary">
                  {stage}
                </span>
                <span className="bg-theme-surface-3 text-[10px] px-2 py-0.5 rounded text-theme-muted font-mono font-bold">
                  {items.length}
                </span>
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto">
                {items.map(l => (
                  <div key={l.id} className="p-3 bg-theme-surface-3 border border-theme-divider rounded-lg hover:border-blue-500/50 transition-colors">
                    <div className="font-bold text-xs text-theme-body font-display">{l.name}</div>
                    <div className="text-[10px] text-theme-muted mt-1 font-mono">{l.phone}</div>
                    <div className="text-[9px] bg-theme-surface-2 text-theme-muted mt-2 inline-block px-1.5 py-0.2 rounded border border-theme-divider font-mono">
                      Source: {l.source}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
