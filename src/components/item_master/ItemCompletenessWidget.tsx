/**
 * Project      : SMRITI Retail OS v7.0
 * Module       : Item Completeness & Quality Score Widget (MDQE Consumer)
 * Author       : Jawahar Ramkripal Mallah & Antigravity AI
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 1.0.0
 */

import React, { useState } from "react";
import { Product } from "../../types.js";
import { MDQE, ProductQualityResult } from "../../kernel/ule/MasterDataQualityEngine.js";
import { ShieldCheck, AlertTriangle, AlertCircle, ChevronDown, ChevronUp, CheckCircle2, ArrowRight } from "lucide-react";

interface ItemCompletenessWidgetProps {
  product: Product | Partial<Product>;
  onNavigateTab?: (tabId: string) => void;
  compact?: boolean;
}

export const ItemCompletenessWidget: React.FC<ItemCompletenessWidgetProps> = ({
  product,
  onNavigateTab,
  compact = false
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const result: ProductQualityResult = MDQE.evaluateProduct(product as Product);
  const { overallScore, grade, gradeLabel, categoryBreakdown, missingGaps } = result;

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    if (score >= 75) return "text-blue-400 border-blue-500/30 bg-blue-500/10";
    if (score >= 60) return "text-amber-400 border-amber-500/30 bg-amber-500/10";
    return "text-rose-400 border-rose-500/30 bg-rose-500/10";
  };

  const getBarColor = (score: number) => {
    if (score >= 90) return "bg-emerald-500";
    if (score >= 75) return "bg-blue-500";
    if (score >= 60) return "bg-amber-500";
    return "bg-rose-500";
  };

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono text-xs font-bold ${getScoreColor(overallScore)}`}>
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>Quality: {overallScore}% ({grade})</span>
      </div>
    );
  }

  return (
    <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl font-mono text-xs space-y-3 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1.5 rounded-lg border font-black text-sm flex items-center gap-1.5 ${getScoreColor(overallScore)}`}>
            <ShieldCheck className="w-4 h-4" />
            <span>{overallScore}% ({grade})</span>
          </div>
          <div>
            <div className="font-bold text-theme-heading text-xs">{gradeLabel}</div>
            <div className="text-[10px] text-theme-muted">Master Data Quality Engine (MDQE)</div>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 px-2.5 py-1 rounded border border-theme-divider text-theme-muted hover:text-theme-heading text-[11px] cursor-pointer"
        >
          <span>{missingGaps.length} Gaps</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* 6 Category Sub-Score Breakdown Bars */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 pt-1 text-[10px]">
        {[
          ["Basic Info", categoryBreakdown.basicInfo],
          ["Pricing", categoryBreakdown.pricing],
          ["Inventory", categoryBreakdown.inventory],
          ["Barcode & Labels", categoryBreakdown.barcodeLabel],
          ["Supplier", categoryBreakdown.supplier],
          ["Images", categoryBreakdown.images],
        ].map(([cat, score]) => (
          <div key={cat as string} className="space-y-1">
            <div className="flex justify-between text-theme-muted">
              <span>{cat}</span>
              <span className="font-bold">{score as number}%</span>
            </div>
            <div className="w-full h-1.5 bg-theme-surface-1 rounded-full overflow-hidden">
              <div className={`h-full ${getBarColor(score as number)} transition-all`} style={{ width: `${score}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Expandable Missing Gaps Checklist */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-theme-divider space-y-2">
          <div className="font-bold text-theme-heading text-[11px] uppercase tracking-wider">Data Completeness Gaps ({missingGaps.length}):</div>
          {missingGaps.length === 0 ? (
            <div className="flex items-center gap-2 text-emerald-400 text-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span>All operational fields complete! Pristine master data record.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {missingGaps.map((gap) => (
                <div
                  key={gap.id}
                  className={`p-2.5 rounded-lg border flex items-start justify-between gap-2 ${
                    gap.severity === "critical"
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                      : gap.severity === "warning"
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                      : "bg-theme-surface-1 border-theme-divider text-theme-muted"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {gap.severity === "critical" ? (
                      <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-bold text-xs">{gap.message}</div>
                      <div className="text-[10px] opacity-80">{gap.category} (-{gap.weightPercent}%)</div>
                    </div>
                  </div>

                  {onNavigateTab && (
                    <button
                      onClick={() => onNavigateTab(gap.targetTab)}
                      className="px-2 py-1 text-[10px] font-bold rounded bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider flex items-center gap-1 cursor-pointer"
                    >
                      <span>Fix</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
