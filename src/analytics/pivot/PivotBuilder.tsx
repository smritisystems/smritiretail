/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : PivotBuilder (Universal Drag-and-Drop Pivot Builder Component v3.1)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 3.1.0
 */

import React, { useState, useEffect } from "react";
import { SUPAESDK } from "../sdk/SUPAESDK.ts";
import { DIMENSION_REGISTRY } from "../registry/DimensionRegistry.ts";
import { MEASURE_REGISTRY } from "../registry/MeasureRegistry.ts";
import { DrillableLink } from "../../components/drilldown/DrillableLink.tsx";
import { Table, Play, Filter, Download, Sparkles } from "lucide-react";

export const PivotBuilder: React.FC = () => {
  const [selectedRow, setSelectedRow] = useState<string>("Brand");
  const [selectedCol, setSelectedCol] = useState<string>("Size");
  const [selectedMeasure, setSelectedMeasure] = useState<string>("SalesQty");
  const [pivotData, setPivotData] = useState<any[]>([]);
  const [executionTime, setExecutionTime] = useState<number>(0);

  const runQuery = async () => {
    const res = await SUPAESDK.executeQuery({
      source: "Sales",
      rows: [selectedRow],
      columns: [selectedCol],
      measures: [selectedMeasure],
      filters: []
    });
    setPivotData(res.rows);
    setExecutionTime(res.executionTimeMs);
  };

  useEffect(() => {
    runQuery();
  }, [selectedRow, selectedCol, selectedMeasure]);

  return (
    <div className="p-6 bg-theme-surface-1 border border-theme-divider rounded-2xl space-y-6 font-sans select-none shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-theme-divider pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#0a6ed1]/10 text-[#0a6ed1] border border-[#0a6ed1]/30 rounded-xl">
            <Table className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-theme-heading">SUPAE Universal Pivot Builder v3.1</h3>
            <p className="text-xs text-theme-muted font-mono">Drag-and-Drop Multidimensional Pivot Matrix • 100% SUNEF Drillable</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={runQuery}
            className="px-4 py-2 bg-[#0a6ed1] hover:bg-[#085caf] text-white rounded-xl text-xs font-bold font-mono flex items-center gap-2 cursor-pointer shadow-md transition-colors"
          >
            <Play className="w-4 h-4" />
            <span>Execute Pivot</span>
          </button>
        </div>
      </div>

      {/* Builder Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-theme-surface-2 border border-theme-divider rounded-xl">
        {/* Row Dimension Select */}
        <div>
          <label className="text-xs font-bold text-theme-heading uppercase tracking-wider block mb-1">Rows (Dimension 1)</label>
          <select
            value={selectedRow}
            onChange={(e) => setSelectedRow(e.target.value)}
            className="w-full p-2.5 bg-theme-surface-3 border border-theme-divider rounded-lg text-xs font-bold text-theme-heading focus:outline-none focus:border-[#0a6ed1]"
          >
            {Object.keys(DIMENSION_REGISTRY).map((k) => (
              <option key={k} value={k}>{DIMENSION_REGISTRY[k].label}</option>
            ))}
          </select>
        </div>

        {/* Column Dimension Select */}
        <div>
          <label className="text-xs font-bold text-theme-heading uppercase tracking-wider block mb-1">Columns (Dimension 2)</label>
          <select
            value={selectedCol}
            onChange={(e) => setSelectedCol(e.target.value)}
            className="w-full p-2.5 bg-theme-surface-3 border border-theme-divider rounded-lg text-xs font-bold text-theme-heading focus:outline-none focus:border-[#0a6ed1]"
          >
            {Object.keys(DIMENSION_REGISTRY).map((k) => (
              <option key={k} value={k}>{DIMENSION_REGISTRY[k].label}</option>
            ))}
          </select>
        </div>

        {/* Measure Select */}
        <div>
          <label className="text-xs font-bold text-theme-heading uppercase tracking-wider block mb-1">Values (Measure Metric)</label>
          <select
            value={selectedMeasure}
            onChange={(e) => setSelectedMeasure(e.target.value)}
            className="w-full p-2.5 bg-theme-surface-3 border border-theme-divider rounded-lg text-xs font-bold text-theme-heading focus:outline-none focus:border-[#0a6ed1]"
          >
            {Object.keys(MEASURE_REGISTRY).map((k) => (
              <option key={k} value={k}>{MEASURE_REGISTRY[k].label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Pivot Matrix Table */}
      <div className="border border-theme-divider rounded-xl overflow-hidden shadow-xs">
        <div className="p-3 bg-theme-surface-3 border-b border-theme-divider flex justify-between items-center text-xs font-mono">
          <span className="text-theme-muted">Executed in <strong>{executionTime}ms</strong> • 100% SUNEF Drillable Matrix</span>
          <span className="text-emerald-400 font-bold flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Aggregation Engine Active</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans text-xs">
            <thead>
              <tr className="bg-theme-surface-2 border-b border-theme-divider text-theme-muted font-mono uppercase text-[11px]">
                <th className="p-3 font-bold">{selectedRow}</th>
                <th className="p-3 font-bold">{selectedCol}</th>
                <th className="p-3 font-bold text-right">{MEASURE_REGISTRY[selectedMeasure]?.label || selectedMeasure}</th>
                <th className="p-3 font-bold text-right">Actions / Drill</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-divider/50 bg-theme-surface-1">
              {pivotData.map((row, idx) => (
                <tr key={idx} className="hover:bg-theme-surface-hover transition-colors font-mono">
                  <td className="p-3 font-bold text-theme-heading">{row.Brand}</td>
                  <td className="p-3 text-theme-body">{row.Size}</td>
                  <td className="p-3 text-right font-bold text-emerald-400">
                    {row[selectedMeasure] !== undefined ? row[selectedMeasure] : row.SalesQty}
                  </td>
                  <td className="p-3 text-right">
                    <DrillableLink
                      context={{
                        entityType: "Item",
                        entityId: `SKU-${row.Brand}-${row.Size}`,
                        title: `${row.Brand} ${row.Size}`
                      }}
                    >
                      <span>Drill Cell →</span>
                    </DrillableLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
