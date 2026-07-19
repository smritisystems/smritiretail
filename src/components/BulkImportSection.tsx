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
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-13
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { 
  FileSpreadsheet, Download, Upload, CheckCircle2, 
  AlertTriangle, RefreshCw, Plus, Trash2, ArrowRight
} from "lucide-react";
import { AttributeGroup, AttributeDefinition } from "../types.js";
import { apiFetchV1 } from "../lib/apiFetchV1";

interface BulkImportSectionProps {
  onRefreshProducts: () => Promise<void>;
  onNotification: (title: string, message: string, type?: "success" | "error") => void;
}

export const BulkImportSection: React.FC<BulkImportSectionProps> = ({ 
  onRefreshProducts, 
  onNotification 
}) => {
  const [groups, setGroups] = useState<AttributeGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [validationResults, setValidationResults] = useState<any[]>([]);
  const [hasValidated, setHasValidated] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch groups on mount
  useEffect(() => {
    apiFetchV1("/attributes/groups")
      .then(data => {
        setGroups(data);
        if (data.length > 0) {
          setSelectedGroupId(data[0].id);
        }
      })
      .catch(err => {
        console.error("Error loading groups:", err);
      });
  }, []);

  // Fetch headers whenever group changes
  useEffect(() => {
    if (!selectedGroupId) return;
    setLoading(true);
    apiFetchV1(`/attributes/import-headers/${selectedGroupId}`)
      .then(data => {
        setHeaders(data.headers);
        // Initialize with 2 empty sample rows
        const initialRows = Array.from({ length: 3 }, (_, i) => {
          const row: Record<string, string> = {};
          data.headers.forEach((h: string) => {
            row[h] = "";
          });
          // Pre-populate some defaults for the first row to make it simple for the user
          if (i === 0) {
            row["TemplateStyleCode"] = "TSH-COT";
            row["BaseName"] = "Classic Cotton T-Shirt";
            row["Brand"] = "SMRITI";
            row["Category"] = "Apparel";
            row["HSN"] = "61091000";
            row["Price"] = "799";
            row["MRP"] = "999";
            row["GST_Percentage"] = "18";
            row["PricingMode"] = "Fixed";
            row["TrackingMode"] = "Standard";
            row["Stock"] = "50";
            row["Barcode"] = `SMR-B${Math.floor(10000 + Math.random() * 90000)}`;
            // Preload attr color & size if present in headers
            const colColor = data.headers.find((h: string) => h.toLowerCase() === "attr_color");
            const colSize = data.headers.find((h: string) => h.toLowerCase() === "attr_size");
            if (colColor) row[colColor] = "Navy";
            if (colSize) row[colSize] = "L";
          }
          return row;
        });
        setRows(initialRows);
        setValidationResults([]);
        setHasValidated(false);
        setLoading(false);
      });
  }, [selectedGroupId]);

  const handleAddRow = () => {
    const newRow: Record<string, string> = {};
    headers.forEach(h => {
      newRow[h] = "";
    });
    setRows(prev => [...prev, newRow]);
    setHasValidated(false);
  };

  const handleRemoveRow = (index: number) => {
    setRows(prev => prev.filter((_, idx) => idx !== index));
    setValidationResults(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleCellChange = (rowIndex: number, colName: string, val: string) => {
    setRows(prev => prev.map((r, idx) => idx === rowIndex ? { ...r, [colName]: val } : r));
    setHasValidated(false);
  };

  const handleValidate = async () => {
    if (rows.length === 0) return;
    setLoading(true);
    try {
      const data = await apiFetchV1("/attributes/import-validate", {
        method: "POST",
        body: JSON.stringify({
          groupId: selectedGroupId,
          rows
        })
      });
      setValidationResults(data.results);
      setHasValidated(true);
      if (data.hasErrors) {
        onNotification("Validation Failed", "Check highlighted cells for validation/formatting mismatches.", "error");
      } else {
        onNotification("Passed Validation", "All spreadsheet rows are valid and formatted perfectly.", "success");
      }
    } catch (e: any) {
      onNotification("Connection Error", e.message || "Failed to validate records with SMRITI.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCommitImport = async () => {
    if (!hasValidated) return;
    const invalidRows = validationResults.filter(r => !r.valid);
    if (invalidRows.length > 0) {
      onNotification("Errors Present", "Cannot commit import while cells have active formatting errors.", "error");
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetchV1("/attributes/import-commit", {
        method: "POST",
        body: JSON.stringify({
          groupId: selectedGroupId,
          rows
        })
      });

      onNotification("Import Complete", `Successfully imported ${data.count} items into SMRITI Catalog.`, "success");
      setRows([]);
      setValidationResults([]);
      setHasValidated(false);
      await onRefreshProducts();
    } catch (e: any) {
      onNotification("Import Error", e.message || "Failed to write imported rows.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Check if any row has errors
  const isImportable = hasValidated && validationResults.every(r => r.valid) && rows.length > 0;

  return (
    <div className="space-y-6">
      
      {/* Dynamic Selector Header */}
      <div className="bg-theme-surface-1 p-5 rounded-2xl border border-theme-divider flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h4 className="font-display font-bold text-sm text-theme-body flex items-center space-x-2">
            <FileSpreadsheet size={16} className="text-[#38bdf8]" />
            <span>Attribute-Aware Bulk Spreadsheet Importer</span>
          </h4>
          <p className="text-[11px] text-theme-muted mt-0.5">Select your business attribute group to compile a bespoke, validated CSV import sheet</p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-theme-muted whitespace-nowrap">Attribute Group:</span>
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono"
          >
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Spreadsheet Workspace */}
      <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-theme-divider/50 pb-3">
          <span className="text-xs font-bold font-display uppercase tracking-wider text-theme-body">Spreadsheet Data Workspace</span>
          <div className="flex space-x-2">
            <button
              onClick={handleAddRow}
              className="px-3 py-1 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-body rounded text-xs flex items-center space-x-1 cursor-pointer transition-colors"
            >
              <Plus size={13} />
              <span>Add Row</span>
            </button>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="p-16 text-center text-theme-muted text-xs">
             spreadsheet is empty. Click "Add Row" to begin entering items.
          </div>
        ) : (
          <div className="overflow-x-auto border border-theme-divider/70 rounded-xl max-h-96">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-theme-surface-2 border-b border-theme-divider text-theme-muted font-mono text-[9px] tracking-wider uppercase">
                  <th className="p-3 text-center w-12 border-r border-theme-divider/40">#</th>
                  {headers.map(h => (
                    <th key={h} className="p-3 border-r border-theme-divider/40 min-w-[140px]">
                      {h}
                    </th>
                  ))}
                  <th className="p-3 text-center w-12">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => {
                  const validation = validationResults.find(v => v.index === rowIndex);
                  const isRowValid = validation ? validation.valid : true;
                  const rowErrors = validation ? validation.errors : [];

                  return (
                    <tr 
                      key={rowIndex} 
                      className={`border-b border-theme-divider/40 hover:bg-theme-surface-2/15 ${
                        !isRowValid ? "bg-rose-950/15" : ""
                      }`}
                    >
                      <td className="p-3 text-center border-r border-theme-divider/40 bg-theme-surface-2/20 font-mono text-[10px] text-theme-muted">
                        {rowIndex + 1}
                      </td>
                      {headers.map(h => {
                        // Is this cell having an error? (Simplified attribute check)
                        const hasCellErr = rowErrors.some((err: string) => 
                          (h.startsWith("Attr_") && err.includes(h.slice(5))) || 
                          (h === "TemplateStyleCode" && err.includes("TemplateStyleCode")) ||
                          (h === "BaseName" && err.includes("BaseName")) ||
                          (h === "Price" && err.includes("Price"))
                        );

                        return (
                          <td key={h} className="p-1.5 border-r border-theme-divider/40">
                            <input
                              type="text"
                              value={row[h] || ""}
                              onChange={(e) => handleCellChange(rowIndex, h, e.target.value)}
                              className={`w-full bg-theme-surface-2 border rounded text-xs px-2.5 py-1.5 text-white placeholder-[#5b6576] focus:outline-none focus:border-blue-500 font-mono ${
                                hasCellErr ? "border-rose-500 bg-rose-950/20" : "border-theme-divider"
                              }`}
                            />
                          </td>
                        );
                      })}
                      <td className="p-1.5 text-center">
                        <button 
                          onClick={() => handleRemoveRow(rowIndex)}
                          className="p-1.5 hover:bg-rose-950/40 text-rose-400 rounded transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Validation Errors panel */}
        {hasValidated && validationResults.some(r => !r.valid) && (
          <div className="bg-[#241316] border border-rose-900/40 p-4 rounded-xl space-y-2 text-rose-400">
            <div className="flex items-center space-x-2 font-bold text-xs">
              <AlertTriangle size={15} />
              <span>Validation Formatting Errors Detected</span>
            </div>
            <ul className="text-[11px] list-disc pl-5 space-y-1 font-mono">
              {validationResults.map((r, idx) => {
                if (r.valid) return null;
                return (
                  <li key={idx}>
                    Row {r.index + 1}: {r.errors.join(" | ")}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Workspace Operations */}
        <div className="flex items-center justify-between pt-2 border-t border-theme-divider/40">
          <span className="text-[10px] font-mono text-theme-muted">
            Data validation is strictly active. SMRITI checks value options instantly.
          </span>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleValidate}
              disabled={loading || rows.length === 0}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5"
            >
              {loading ? <RefreshCw className="animate-spin" size={12} /> : <CheckCircle2 size={12} />}
              <span>Validate Cells</span>
            </button>
            <button
              onClick={handleCommitImport}
              disabled={!isImportable || loading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs rounded-lg transition-all shadow-lg flex items-center space-x-1.5 cursor-pointer"
            >
              <CheckCircle2 size={12} />
              <span>Commit valid items</span>
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};
