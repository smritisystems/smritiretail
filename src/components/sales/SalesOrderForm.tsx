/**
 * Project      : SMRITI Retail OS
 * Module       : Sales Order Form
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * 
 * Description  : Complete Sales Order Form with Header, Detail, and Footer sections
 *                based on distributor-style sales order processing
 * 
 * Version      : 3.30.0
 * Created      : 2026-08-31
 * Modified     : 2026-08-31
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useCallback } from "react";
import { motion } from "motion/react";
import {
  Save,
  Plus,
  Trash2,
  FileText,
  User,
  Users,
  Calendar,
  Search,
  Download,
  Upload,
  ChevronDown,
  AlertCircle,
} from "lucide-react";
import { formatCurrency, formatQuantity } from "../../utils/formatters";
import { apiFetchV1 } from "../../lib/apiFetchV1";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface SalesOrderItem {
  id: string;
  stockNo: string;
  description: string;
  rate: number;
  quantity: number;
  value: number;
  discCode?: string;
  discQty?: number;
  discPercent?: number;
  discAmount?: number;
  total: number;
  salesStaff?: string;
}

export interface SalesOrderFormData {
  // Header
  docPrefix: string;
  docNumber: string;
  docDate: string;
  docTime: string;
  referenceNo: string;
  deliveryTerms: string;
  paymentTerms: string;
  orderStatus: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  salesStaff: string;
  remarks: string;

  // Detail
  items: SalesOrderItem[];

  // Footer (computed)
  totalSalesValue: number;
  totalDiscount: number;
  totalTax: number;
  netAmount: number;
  totalItems: number;
  totalQuantity: number;
}

interface SalesOrderFormProps {
  initialData?: Partial<SalesOrderFormData>;
  onSubmit?: (data: SalesOrderFormData) => Promise<void>;
  onCancel?: () => void;
  compact?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SALES ORDER HEADER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const SalesOrderHeader: React.FC<{
  formData: Partial<SalesOrderFormData>;
  onFieldChange: (field: string, value: any) => void;
}> = ({ formData, onFieldChange }) => {
  const [showCustomerBrowse, setShowCustomerBrowse] = useState(false);

  const handleCustomerSearch = async (query: string) => {
    if (query.length < 2) return;
    try {
      const customers = await apiFetchV1("/crm/customers");
      console.log("Customers:", customers);
    } catch (err) {
      console.error("Failed to load customers:", err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-lg p-5 shadow-sm"
    >
      <div className="flex items-center justify-between border-b border-slate-300 pb-2 mb-4">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
          <button type="button" className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100">View</button>
          <button type="button" className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100">Edit</button>
          <button type="button" className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100">Print</button>
          <button type="button" className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100">Exit</button>
        </div>
        <div className="text-[11px] font-bold tracking-[0.22em] text-slate-500 uppercase">Sales Order</div>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-4">
        <div>
          <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-2">
            <FileText className="inline w-3 h-3 mr-1" />
            Doc. Prefix
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={formData.docPrefix || "SO"}
              onChange={(e) => onFieldChange("docPrefix", e.target.value)}
              className="w-16 px-3 py-2 border border-slate-300 rounded font-mono text-sm bg-white focus:ring-2 focus:ring-blue-400"
              maxLength={3}
            />
            <input
              type="text"
              value={formData.docNumber || ""}
              placeholder="Auto-generated"
              readOnly
              className="flex-1 px-3 py-2 border border-slate-300 rounded font-mono text-sm bg-slate-100"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-2">
            <Calendar className="inline w-3 h-3 mr-1" />
            Date
          </label>
          <input
            type="date"
            value={formData.docDate || new Date().toISOString().split("T")[0]}
            onChange={(e) => onFieldChange("docDate", e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-2">
            Time
          </label>
          <input
            type="time"
            value={formData.docTime || new Date().toTimeString().slice(0, 5)}
            onChange={(e) => onFieldChange("docTime", e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-2">
            Ref. No.
          </label>
          <input
            type="text"
            value={formData.referenceNo || ""}
            onChange={(e) => onFieldChange("referenceNo", e.target.value)}
            placeholder="PO / order ref"
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-2">
            Status
          </label>
          <select
            value={formData.orderStatus || "Open"}
            onChange={(e) => onFieldChange("orderStatus", e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white focus:ring-2 focus:ring-blue-400"
          >
            <option value="Open">Open</option>
            <option value="Confirmed">Confirmed</option>
            <option value="In Dispatch">In Dispatch</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-1">
          <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-2">
            <User className="inline w-3 h-3 mr-1" />
            Customer
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={formData.customerCode || ""}
              onChange={(e) => onFieldChange("customerCode", e.target.value)}
              onKeyUp={(e) => handleCustomerSearch(e.currentTarget.value)}
              placeholder="Enter code or F2"
              className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm bg-white focus:ring-2 focus:ring-blue-400"
            />
            <button
              type="button"
              onClick={() => setShowCustomerBrowse(true)}
              className="px-3 py-2 bg-slate-200 hover:bg-slate-300 rounded text-sm font-medium transition"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="col-span-1">
          <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-2">
            Customer Name
          </label>
          <input
            type="text"
            value={formData.customerName || ""}
            readOnly
            placeholder="Auto-populated"
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-slate-100"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-2">
            Delivery Terms
          </label>
          <input
            type="text"
            value={formData.deliveryTerms || ""}
            onChange={(e) => onFieldChange("deliveryTerms", e.target.value)}
            placeholder="FOB / Ex-Works / Door delivery"
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-2">
            <Users className="inline w-3 h-3 mr-1" />
            Sales Staff
          </label>
          <select
            value={formData.salesStaff || ""}
            onChange={(e) => onFieldChange("salesStaff", e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white focus:ring-2 focus:ring-blue-400"
          >
            <option value="">Select staff...</option>
            <option value="STAFF001">John Smith</option>
            <option value="STAFF002">Jane Doe</option>
            <option value="STAFF003">Mike Johnson</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>
          <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-2">
            Payment Terms
          </label>
          <input
            type="text"
            value={formData.paymentTerms || ""}
            onChange={(e) => onFieldChange("paymentTerms", e.target.value)}
            placeholder="Cash / Credit / Net 30"
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-2">
            Remarks
          </label>
          <input
            type="text"
            value={formData.remarks || ""}
            onChange={(e) => onFieldChange("remarks", e.target.value)}
            placeholder="Special instructions / notes"
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-300 flex gap-2">
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition"
        >
          <Upload className="w-4 h-4" />
          Import from File
        </button>
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition"
        >
          <Upload className="w-4 h-4" />
          Import from Transaction
        </button>
      </div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SALES ORDER DETAIL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const SalesOrderDetail: React.FC<{
  items: SalesOrderItem[];
  onItemsChange: (items: SalesOrderItem[]) => void;
}> = ({ items, onItemsChange }) => {
  const [directEntryMode, setDirectEntryMode] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);

  const handleAddItem = () => {
    const newItem: SalesOrderItem = {
      id: `item-${Date.now()}`,
      stockNo: "",
      description: "",
      rate: 0,
      quantity: 0,
      value: 0,
      discPercent: 0,
      discAmount: 0,
      total: 0,
    };
    onItemsChange([...items, newItem]);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...items];
    const item = updated[index];
    item[field as keyof SalesOrderItem] = value;

    // Calculate value and total
    if (field === "rate" || field === "quantity") {
      item.value = (item.rate || 0) * (item.quantity || 0);
      item.total = item.value - (item.discAmount || 0);
    }

    if (field === "discPercent" || field === "discAmount") {
      item.discAmount = field === "discPercent"
        ? (item.value * (value || 0)) / 100
        : value;
      item.total = item.value - (item.discAmount || 0);
    }

    onItemsChange(updated);
  };

  const handleDeleteItem = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden mt-6"
    >
      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50">
        <button
          onClick={() => setDirectEntryMode(false)}
          className={`flex-1 px-4 py-3 font-medium text-sm transition ${
            !directEntryMode
              ? "bg-white text-blue-600 border-b-2 border-blue-600"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Item Details Grid
        </button>
        <button
          onClick={() => setDirectEntryMode(true)}
          className={`flex-1 px-4 py-3 font-medium text-sm transition ${
            directEntryMode
              ? "bg-white text-blue-600 border-b-2 border-blue-600"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Direct Entry (F11)
        </button>
      </div>

      {/* Items Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 border-b border-slate-200 sticky top-0">
            <tr className="text-xs font-semibold text-slate-700 uppercase">
              <th className="px-4 py-3 text-left w-20">Stock No.</th>
              <th className="px-4 py-3 text-left flex-1">Description</th>
              <th className="px-4 py-3 text-right w-24">Rate</th>
              <th className="px-4 py-3 text-right w-24">Qty</th>
              <th className="px-4 py-3 text-right w-24">Value</th>
              <th className="px-4 py-3 text-left w-20">Disc Code</th>
              <th className="px-4 py-3 text-right w-24">Disc %</th>
              <th className="px-4 py-3 text-right w-24">Disc Amt</th>
              <th className="px-4 py-3 text-right w-24">Total</th>
              <th className="px-4 py-3 text-center w-20">Staff</th>
              <th className="px-4 py-3 text-center w-12">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr
                key={item.id}
                onClick={() => setSelectedItemIndex(index)}
                className={`border-b border-slate-200 hover:bg-blue-50 transition cursor-pointer ${
                  selectedItemIndex === index ? "bg-blue-100" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={item.stockNo}
                    onChange={(e) => handleItemChange(index, "stockNo", e.target.value)}
                    placeholder="F2"
                    className="w-full px-2 py-1 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-400"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={item.description}
                    readOnly
                    className="w-full px-2 py-1 bg-slate-100 rounded text-xs"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    value={item.rate}
                    onChange={(e) => handleItemChange(index, "rate", parseFloat(e.target.value))}
                    className="w-full px-2 py-1 border border-slate-200 rounded text-xs text-right focus:ring-1 focus:ring-blue-400"
                    step="0.01"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, "quantity", parseFloat(e.target.value))}
                    className="w-full px-2 py-1 border border-slate-200 rounded text-xs text-right focus:ring-1 focus:ring-blue-400"
                  />
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatCurrency(item.value || 0)}
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={item.discCode || ""}
                    onChange={(e) => handleItemChange(index, "discCode", e.target.value)}
                    className="w-full px-2 py-1 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-400"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    value={item.discPercent || 0}
                    onChange={(e) => handleItemChange(index, "discPercent", parseFloat(e.target.value))}
                    className="w-full px-2 py-1 border border-slate-200 rounded text-xs text-right focus:ring-1 focus:ring-blue-400"
                    step="0.01"
                  />
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatCurrency(item.discAmount || 0)}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                  {formatCurrency(item.total || 0)}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={item.salesStaff || ""}
                    onChange={(e) => handleItemChange(index, "salesStaff", e.target.value)}
                    className="w-full px-2 py-1 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-400"
                  >
                    <option value="">—</option>
                    <option value="STAFF001">John</option>
                    <option value="STAFF002">Jane</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteItem(index);
                    }}
                    className="text-red-600 hover:text-red-900 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Item Button */}
      <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex gap-2">
        <button
          onClick={handleAddItem}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700 transition"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
        <button
          onClick={() => setDirectEntryMode(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded font-medium hover:bg-slate-700 transition"
        >
          F11 - Direct Entry
        </button>
      </div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SALES ORDER FOOTER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const SalesOrderFooter: React.FC<{
  items: SalesOrderItem[];
}> = ({ items }) => {
  // Calculate totals
  const totalSalesValue = items.reduce((sum, item) => sum + (item.value || 0), 0);
  const totalDiscount = items.reduce((sum, item) => sum + (item.discAmount || 0), 0);
  const totalTax = totalSalesValue * 0.05; // Assuming 5% tax for display
  const netAmount = totalSalesValue - totalDiscount + totalTax;
  const totalItems = items.length;
  const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-6 grid grid-cols-2 gap-6"
    >
      {/* Left: Import/Clear Section */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase">Import Details</h3>
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Import from..."
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
          />
          <div className="flex gap-2">
            <button className="flex-1 px-3 py-2 bg-slate-200 hover:bg-slate-300 rounded text-sm font-medium transition">
              Clear
            </button>
            <button className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition">
              Load Item(s)
            </button>
          </div>
        </div>
      </div>

      {/* Right: Summary Totals */}
      <div className="bg-gradient-to-br from-blue-50 to-slate-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase">Order Summary</h3>
        <table className="w-full text-sm">
          <tbody className="space-y-2">
            <tr className="border-b border-slate-200">
              <td className="px-2 py-2 font-medium text-slate-600">Total No. of Items</td>
              <td className="px-2 py-2 text-right font-mono font-semibold">{totalItems}</td>
            </tr>
            <tr className="border-b border-slate-200">
              <td className="px-2 py-2 font-medium text-slate-600">Total Qty</td>
              <td className="px-2 py-2 text-right font-mono font-semibold">{formatQuantity(totalQuantity)}</td>
            </tr>
            <tr className="border-b border-slate-200">
              <td className="px-2 py-2 font-medium text-slate-600">Sales Value</td>
              <td className="px-2 py-2 text-right font-mono font-semibold">{formatCurrency(totalSalesValue)}</td>
            </tr>
            <tr className="border-b border-slate-200">
              <td className="px-2 py-2 font-medium text-slate-600">Item Level Discount</td>
              <td className="px-2 py-2 text-right font-mono font-semibold text-red-600">
                -{formatCurrency(totalDiscount)}
              </td>
            </tr>
            <tr className="border-b border-slate-200">
              <td className="px-2 py-2 font-medium text-slate-600">Total Tax</td>
              <td className="px-2 py-2 text-right font-mono font-semibold">{formatCurrency(totalTax)}</td>
            </tr>
            <tr className="bg-blue-100">
              <td className="px-2 py-2 font-bold text-slate-900">Net Amount</td>
              <td className="px-2 py-2 text-right font-mono font-bold text-lg text-blue-900">
                {formatCurrency(netAmount)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SALES ORDER FORM COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const SalesOrderForm: React.FC<SalesOrderFormProps> = ({
  initialData = {},
  onSubmit,
  onCancel,
  compact = false,
}) => {
  const [formData, setFormData] = useState<Partial<SalesOrderFormData>>({
    docPrefix: "SO",
    docDate: new Date().toISOString().split("T")[0],
    docTime: new Date().toTimeString().slice(0, 5),
    referenceNo: "",
    deliveryTerms: "",
    paymentTerms: "",
    orderStatus: "Open",
    remarks: "",
    items: [],
    ...initialData,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFieldChange = useCallback((field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleItemsChange = useCallback((items: SalesOrderItem[]) => {
    setFormData((prev) => ({
      ...prev,
      items,
    }));
  }, []);

  const handleSubmit = async () => {
    if (!formData.customerCode) {
      setError("Please select a customer");
      return;
    }

    if (!formData.items || formData.items.length === 0) {
      setError("Please add at least one item");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (onSubmit) {
        await onSubmit(formData as SalesOrderFormData);
      }
    } catch (err: any) {
      setError(err.message || "Failed to save sales order");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`${compact ? "max-w-none mx-0 p-0 bg-slate-50 min-h-screen" : "max-w-7xl mx-auto p-6 bg-slate-50 min-h-screen"}`}>
      {!compact && (
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            Generation of a New Sales Order
          </h1>
          <p className="text-slate-600 mt-2">Distributor Sales Order Processing</p>
        </motion.div>
      )}

      {/* Error Alert */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </motion.div>
      )}

      {/* Form Sections */}
      <SalesOrderHeader formData={formData} onFieldChange={handleFieldChange} />
      <SalesOrderDetail items={formData.items || []} onItemsChange={handleItemsChange} />
      <SalesOrderFooter items={formData.items || []} />

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-8 flex gap-3 justify-end"
      >
        <button
          onClick={onCancel}
          className="px-6 py-3 bg-slate-300 text-slate-900 rounded font-medium hover:bg-slate-400 transition"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded font-medium hover:bg-green-700 transition disabled:bg-green-400"
        >
          <Save className="w-5 h-5" />
          {isSubmitting ? "Saving..." : "Save Sales Order (F7)"}
        </button>
      </motion.div>
    </div>
  );
};

export default SalesOrderForm;
