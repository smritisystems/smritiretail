/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.33.0
 * Created      : 2026-09-19
 * Modified     : 2026-09-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability    : @SmritiCapability("PURCHASE", "INWARD_COST_MODAL")
 */

import React, { useState, useEffect } from "react";
import { X, Plus, ShieldCheck, Truck, FileText, Calculator } from "lucide-react";
import { InwardCostTypeOption, InwardCostItem } from "./types/inwardCost.ts";

interface AddCostComponentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (component: InwardCostItem) => void;
  costTypes: InwardCostTypeOption[];
  defaultTransporter?: string;
  defaultLrNumber?: string;
  defaultVehicle?: string;
}

export const AddCostComponentModal: React.FC<AddCostComponentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  costTypes,
  defaultTransporter = "",
  defaultLrNumber = "",
  defaultVehicle = "",
}) => {
  const [componentType, setComponentType] = useState("FREIGHT");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [taxableAmount, setTaxableAmount] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(18);
  const [itcEligible, setItcEligible] = useState<boolean>(true);
  const [isCapitalizable, setIsCapitalizable] = useState<boolean>(true);
  const [allocationMethod, setAllocationMethod] = useState<"VALUE" | "QUANTITY" | "WEIGHT">("VALUE");
  const [transporterName, setTransporterName] = useState(defaultTransporter);
  const [documentType, setDocumentType] = useState("LR");
  const [documentNo, setDocumentNo] = useState(defaultLrNumber);
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().slice(0, 10));
  const [vehicleNo, setVehicleNo] = useState(defaultVehicle);

  useEffect(() => {
    if (costTypes.length > 0 && !componentType) {
      setComponentType(costTypes[0].code);
    }
  }, [costTypes, componentType]);

  // When amount changes, auto-set taxable amount if 0
  const handleAmountChange = (val: number) => {
    setAmount(val);
    setTaxableAmount(val);
  };

  // Sync allocation method and capitalizable default from selected type
  const handleTypeChange = (code: string) => {
    setComponentType(code);
    const found = costTypes.find((c) => c.code === code);
    if (found) {
      setIsCapitalizable(found.is_capitalizable);
      setAllocationMethod(found.default_allocation_method);
      if (found.category === "NON_CREDITABLE") {
        setItcEligible(false);
      }
    }
  };

  const taxAmount = Math.round(((taxableAmount * taxRate) / 100) * 100) / 100;
  const totalAmount = Math.round((taxableAmount + taxAmount) * 100) / 100;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      alert("Please enter an amount greater than 0.");
      return;
    }

    const newItem: InwardCostItem = {
      id: `icc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      component_type: componentType,
      description: description.trim() || `${componentType} Charge`,
      amount,
      taxable_amount: taxableAmount,
      tax_amount: taxAmount,
      tax_rate: taxRate,
      total_amount: totalAmount,
      itc_eligible: itcEligible,
      is_capitalizable: isCapitalizable,
      allocation_method: allocationMethod,
      transporter_name: transporterName.trim() || undefined,
      document_type: documentType,
      document_no: documentNo.trim() || undefined,
      document_date: documentDate || undefined,
      vehicle_no: vehicleNo.trim() || undefined,
      status: "READY",
    };

    onSave(newItem);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Add Inward Cost Component
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Traceable freight, cartage, handling, or statutory duty
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Cost Type */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Cost Component Type <span className="text-rose-500">*</span>
            </label>
            <select
              data-field-key="inward_cost_type"
              value={componentType}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              {costTypes.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name} ({t.category})
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description / Route Reference
            </label>
            <input
              data-field-key="inward_cost_description"
              type="text"
              placeholder="e.g. Transport from Bhiwandi Warehouse to Store"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Amount & Taxable Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <input
                data-field-key="inward_cost_amount"
                type="number"
                min="0"
                step="0.01"
                required
                value={amount || ""}
                onChange={(e) => handleAmountChange(parseFloat(e.target.value) || 0)}
                placeholder="2500.00"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Taxable Base (₹)
              </label>
              <input
                data-field-key="inward_cost_taxable_amount"
                type="number"
                min="0"
                step="0.01"
                value={taxableAmount || ""}
                onChange={(e) => setTaxableAmount(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-mono text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Tax Rate & Tax Amount */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                GST Tax Rate
              </label>
              <select
                data-field-key="inward_cost_tax_rate"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-slate-800 dark:text-slate-200 outline-none"
              >
                <option value={0}>0% (Exempt/Nil)</option>
                <option value={5}>5% (RCM/Freight Standard)</option>
                <option value={12}>12%</option>
                <option value={18}>18% (Service Standard)</option>
                <option value={28}>28%</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                Tax Amount / Gross Total
              </label>
              <div className="flex items-center justify-between text-xs py-1.5 font-mono">
                <span className="text-slate-500">Tax: ₹{taxAmount.toFixed(2)}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Total: ₹{totalAmount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* ITC Treatment & Capitalizability */}
          <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-lg p-3 bg-indigo-50/30 dark:bg-indigo-950/20">
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                data-field-key="inward_cost_itc_eligible"
                type="checkbox"
                checked={itcEligible}
                onChange={(e) => setItcEligible(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Input Tax Credit (ITC) Eligible
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Under Ind-AS 2, creditable GST is an asset (ITC) and excluded from inventory cost.
                  If unchecked (e.g. non-creditable duties), tax is capitalized into landed cost.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2 cursor-pointer select-none pt-1">
              <input
                data-field-key="inward_cost_is_capitalizable"
                type="checkbox"
                checked={isCapitalizable}
                onChange={(e) => setIsCapitalizable(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Capitalize into Inventory Valuation
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Adds directly to product WAC/Batch cost. If unchecked, posted as direct period expense.
                </p>
              </div>
            </label>
          </div>

          {/* Allocation Method */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Allocation Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["VALUE", "QUANTITY", "WEIGHT"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setAllocationMethod(m)}
                  className={`py-2 px-3 rounded-lg border text-center font-medium transition ${
                    allocationMethod === m
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                      : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750"
                  }`}
                >
                  {m === "VALUE" ? "By Value" : m === "QUANTITY" ? "By Qty" : "By Weight"}
                </button>
              ))}
            </div>
          </div>

          {/* Transporter & Logistics Details */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-3">
            <h4 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-slate-500" />
              Transporter & Documentation Reference
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Transporter / Agency
                </label>
                <input
                  data-field-key="inward_cost_transporter_name"
                  type="text"
                  placeholder="e.g. XYZ Logistics"
                  value={transporterName}
                  onChange={(e) => setTransporterName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-slate-800 dark:text-slate-200 outline-none"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  LR / Bilty / Invoice No
                </label>
                <input
                  data-field-key="inward_cost_document_no"
                  type="text"
                  placeholder="e.g. LR-88452"
                  value={documentNo}
                  onChange={(e) => setDocumentNo(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-slate-800 dark:text-slate-200 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Document Date
                </label>
                <input
                  data-field-key="inward_cost_document_date"
                  type="date"
                  value={documentDate}
                  onChange={(e) => setDocumentDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-slate-800 dark:text-slate-200 outline-none"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Vehicle Number
                </label>
                <input
                  data-field-key="inward_cost_vehicle_no"
                  type="text"
                  placeholder="e.g. MH01AB1234"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-slate-800 dark:text-slate-200 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Cost Component
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
