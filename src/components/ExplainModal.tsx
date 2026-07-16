/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React from "react";
import { Formula } from "../types";

interface ExplainModalProps {
  formula: Formula | null;
  onClose: () => void;
}

export const ExplainModal: React.FC<ExplainModalProps> = ({ formula, onClose }) => {
  if (!formula) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-hidden">
        {/* Background backdrop */}
        <div 
          className="absolute inset-0 bg-[#0c1224] bg-opacity-75 transition-opacity cursor-pointer" 
          onClick={onClose} 
        />

        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
          <div className="pointer-events-auto w-screen max-w-xl">
            <div className="flex h-full flex-col overflow-y-scroll bg-theme-surface-1 border-l border-theme-divider py-6 shadow-2xl">
              <div className="px-6 border-b border-theme-divider pb-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="material-symbols-outlined text-[#2563EB]">info</span>
                    <h2 className="text-xl font-semibold font-display text-theme-body" id="slide-over-title">
                      Formula Explanation
                    </h2>
                  </div>
                  <button
                    onClick={onClose}
                    className="rounded-md text-theme-muted hover:text-theme-body focus:outline-none"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                <p className="mt-1 text-sm text-theme-muted">
                  Registered KPI ID: <span className="font-mono text-theme-body text-xs">{formula.id}</span>
                </p>
              </div>

              <div className="relative mt-6 flex-1 px-6 space-y-6">
                {/* Name & Category */}
                <div>
                  <span className="inline-flex items-center rounded-full bg-theme-surface-3 px-2.5 py-0.5 text-xs font-medium text-[#2563EB] border border-theme-divider">
                    {formula.category}
                  </span>
                  <h3 className="mt-2 text-2xl font-bold font-display text-theme-body">{formula.name}</h3>
                </div>

                {/* Business Meaning */}
                <div className="bg-theme-surface-3 bg-opacity-50 rounded-lg p-4 border border-theme-divider">
                  <h4 className="text-xs font-semibold text-theme-muted uppercase tracking-wider font-display">Business Meaning</h4>
                  <p className="mt-2 text-sm text-theme-primary leading-relaxed">{formula.meaning}</p>
                </div>

                {/* Exact Formula */}
                <div>
                  <h4 className="text-xs font-semibold text-theme-muted uppercase tracking-wider font-display">Mathematical Expression</h4>
                  <div className="mt-2 rounded-lg bg-[#0c1224] p-4 border border-theme-divider font-mono text-sm text-[#22c55e] flex items-center justify-center text-center">
                    {formula.expression}
                  </div>
                </div>

                {/* Worked Example */}
                <div>
                  <h4 className="text-xs font-semibold text-theme-muted uppercase tracking-wider font-display">Worked Example (Real Retail Numbers)</h4>
                  <div className="mt-2 rounded-lg bg-theme-surface-3 p-4 border border-theme-divider">
                    <p className="font-mono text-sm text-theme-primary leading-relaxed whitespace-pre-wrap">{formula.workedExample}</p>
                  </div>
                </div>

                {/* Data Sources */}
                <div>
                  <h4 className="text-xs font-semibold text-theme-muted uppercase tracking-wider font-display">Source Document Paths</h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {formula.dataSources.map((source, index) => (
                      <span key={index} className="inline-flex items-center rounded bg-[#0c1224] px-2 py-1 text-xs font-mono text-theme-muted border border-theme-divider">
                        {source}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Interpretation Guide */}
                <div>
                  <h4 className="text-xs font-semibold text-theme-muted uppercase tracking-wider font-display">Interpretation Bands</h4>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center space-x-3 text-sm bg-theme-surface-3 bg-opacity-40 p-2.5 rounded border-l-4 border-red-500">
                      <span className="font-semibold text-red-500">Critical:</span>
                      <span className="text-theme-primary">{formula.interpretation.critical}</span>
                    </div>
                    <div className="flex items-center space-x-3 text-sm bg-theme-surface-3 bg-opacity-40 p-2.5 rounded border-l-4 border-amber-500">
                      <span className="font-semibold text-amber-500">Monitor:</span>
                      <span className="text-theme-primary">{formula.interpretation.monitor}</span>
                    </div>
                    <div className="flex items-center space-x-3 text-sm bg-theme-surface-3 bg-opacity-40 p-2.5 rounded border-l-4 border-emerald-500">
                      <span className="font-semibold text-emerald-500">Healthy:</span>
                      <span className="text-theme-primary">{formula.interpretation.healthy}</span>
                    </div>
                  </div>
                </div>

                {/* Recommended Action */}
                <div className="bg-theme-surface-3 bg-opacity-70 border-l-4 border-[#2563EB] rounded p-4">
                  <h4 className="text-xs font-semibold text-[#2563EB] uppercase tracking-wider font-display">Recommended Action</h4>
                  <p className="mt-2 text-sm text-theme-primary font-medium leading-relaxed">{formula.recommendedAction}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
