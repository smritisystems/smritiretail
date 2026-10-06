/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-10-06
 * Modified     : 2026-10-06
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal — DataBridge Templates Modal
 * Capability    : databridge.workspace_ux (@SmritiCapability / smriti_capability)
 */

import React from "react";
import { DataBridgeEntityType } from "./databridgeTypes.ts";
import { DataBridgeClientService } from "./databridgeService.ts";

interface DataBridgeTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TemplateCardInfo {
  type: DataBridgeEntityType;
  title: string;
  description: string;
  icon: string;
  badge: string;
  columns: string[];
}

export const DataBridgeTemplatesModal: React.FC<DataBridgeTemplatesModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const templates: TemplateCardInfo[] = [
    {
      type: "CATALOG",
      title: "Complete Catalog Template",
      description: "All-in-one spreadsheet combining Item Master, Variants, Barcodes, and Selling Prices in single rows.",
      icon: "inventory",
      badge: "Recommended",
      columns: ["Article No", "Description", "Brand", "Category", "Department", "Variant SKU", "Color", "Size", "Barcode", "UOM", "Tax Rate", "MRP", "Selling Price", "Cost Price", "HSN Code"],
    },
    {
      type: "ITEM",
      title: "Item Master Template",
      description: "Basic style and product identities without variant dimensions or barcodes.",
      icon: "category",
      badge: "Parent Styles",
      columns: ["Article No", "Description", "Brand", "Category", "Department", "UOM", "Tax Rate", "MRP", "Selling Price", "Cost Price", "HSN Code"],
    },
    {
      type: "VARIANT",
      title: "Variants Template",
      description: "Specific color and size physical variants linked to existing parent item styles.",
      icon: "style",
      badge: "Physical SKUs",
      columns: ["Article No", "Variant SKU", "Color", "Size", "Barcode", "MRP", "Selling Price", "Cost Price"],
    },
    {
      type: "BARCODE",
      title: "Barcodes Template",
      description: "Universal primary and packaging barcode assignments anchored to variant SKUs.",
      icon: "barcode_reader",
      badge: "Scanner Codes",
      columns: ["Variant SKU", "Barcode", "Barcode Type", "Is Primary"],
    },
    {
      type: "PRICEBOOK",
      title: "Price Book Template",
      description: "Commercial selling price points, wholesale price curves, and promotional rates.",
      icon: "payments",
      badge: "Pricing Matrix",
      columns: ["Variant SKU", "Price Book Code", "Min Qty", "MRP", "Selling Price", "Cost Price"],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 select-none">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[24px]">description</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Download DataBridge Templates</h3>
              <p className="text-xs text-slate-500">
                Pre-formatted CSV spreadsheets with approved headers and sample data for SMRITI Retail OS.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content list */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((tpl) => (
              <div
                key={tpl.type}
                className="p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all bg-white flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <span className="material-symbols-outlined text-[18px]">{tpl.icon}</span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-800">{tpl.title}</h4>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {tpl.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    {tpl.description}
                  </p>
                  <div className="mt-3">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Key Columns:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {tpl.columns.slice(0, 5).map((col) => (
                        <span
                          key={col}
                          className="text-[10px] bg-slate-50 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded"
                        >
                          {col}
                        </span>
                      ))}
                      {tpl.columns.length > 5 && (
                        <span className="text-[10px] text-slate-400 self-center">
                          +{tpl.columns.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
                  <button
                    onClick={() => DataBridgeClientService.downloadTemplate(tpl.type)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white text-xs font-semibold transition-colors shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    Download CSV
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="material-symbols-outlined text-amber-500 text-[18px]">lightbulb</span>
            <span>Tip: You can also copy and paste rows directly from Excel into DataBridge!</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
