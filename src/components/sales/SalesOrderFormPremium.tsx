/**
 * Project      : SMRITI Retail OS
 * Module       : Sales Order Form - Premium Edition
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * 
 * Description  : Enterprise-grade Sales Order Form with premium UI/UX
 *                Professional design, smooth interactions, and working lookups
 * 
 * Version      : 3.30.0
 * Created      : 2026-08-31
 * Modified     : 2026-08-31
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Save,
  Plus,
  Trash2,
  FileText,
  User,
  Users,
  Calendar,
  Clock,
  Search,
  Download,
  Upload,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  Eye,
  Edit3,
  Printer,
  X,
  Loader2,
} from "lucide-react";
import { formatCurrency, formatQuantity } from "../../utils/formatters";
import { apiFetchV1 } from "../../lib/apiFetchV1";
import type { SalesLineItem, SalesTransaction } from "../../domain/sales/transaction";
import { calculateLineTotal, recomputeTransaction } from "../../services/sales/transactionCalculator";
import { validateSalesTransaction } from "../../services/sales/transactionValidator";
import { validateSalesOrderItems } from "../../utils/salesOrderValidation";
import { TransactionAttachmentPanel } from "../common/TransactionAttachmentPanel";
import type { TransactionAttachment } from "../../domain/attachment";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface SalesOrderItem {
  id: string;
  stockNo: string;
  description: string;
  hsn?: string;
  rate: number;
  quantity: number;
  uom?: string;
  value: number;
  discCode?: string;
  discQty?: number;
  discPercent?: number;
  discAmount?: number;
  taxPercent?: number;
  taxAmount?: number;
  total: number;
  salesStaff?: string;
  gstRate?: number;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  credit_limit?: number;
  credit_used?: number;
}

export interface StockItem {
  id: string;
  code: string;
  description: string;
  category?: string;
  rate: number;
  onhand?: number;
  hsn?: string;
  uom?: string;
}

export interface SalesOrderFormData {
  docPrefix: string;
  docNumber: string;
  docDate: string;
  docTime: string;
  referenceNo: string;
  deliveryTerms: string;
  paymentTerms: string;
  orderStatus: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  salesStaff: string;
  remarks: string;
  items: SalesOrderItem[];
  totalSalesValue: number;
  totalDiscount: number;
  totalTax: number;
  netAmount: number;
}

interface SalesOrderFormProps {
  initialData?: Partial<SalesOrderFormData>;
  onSubmit?: (data: SalesOrderFormData) => Promise<void>;
  onCancel?: () => void;
  compact?: boolean;
}

const toSharedSalesLineItem = (item: SalesOrderItem): SalesLineItem => ({
  id: item.id || `line-${Math.random().toString(36).slice(2, 9)}`,
  productId: item.id,
  stockNo: item.stockNo,
  barcode: item.stockNo,
  itemDescription: item.description || item.stockNo || "Item",
  qty: Number(item.quantity || 0),
  rate: Number(item.rate || 0),
  value: Number(item.value || 0),
  discPercent: Number(item.discPercent || 0),
  discAmt: Number(item.discAmount || 0),
  taxPercent: Number(item.taxPercent || 0),
  taxAmount: Number(item.taxAmount || 0),
  total: Number(item.total || 0),
});

const getSalesOrderSummary = (items: SalesOrderItem[], formData: Partial<SalesOrderFormData>) => {
  const transaction: SalesTransaction = {
    docType: "sales_order",
    docPrefix: formData.docPrefix || "SO",
    docNumber: formData.docNumber || "",
    docDate: formData.docDate || new Date().toISOString().split("T")[0],
    docTime: formData.docTime || new Date().toTimeString().slice(0, 5),
    customerId: formData.customerId,
    customerCode: formData.customerCode,
    customerName: formData.customerName,
    referenceNo: formData.referenceNo,
    deliveryTerms: formData.deliveryTerms,
    paymentTerms: formData.paymentTerms,
    orderStatus: formData.orderStatus,
    remarks: formData.remarks,
    items: items.map(toSharedSalesLineItem),
    subtotal: 0,
    discountTotal: 0,
    taxTotal: 0,
    netAmount: 0,
  };

  const recomputed = recomputeTransaction(transaction);

  return {
    totalSalesValue: recomputed.subtotal,
    totalDiscount: recomputed.discountTotal,
    totalTax: recomputed.taxTotal,
    netAmount: recomputed.netAmount,
    totalItems: items.length,
    totalQuantity: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER LOOKUP MODAL
// ═══════════════════════════════════════════════════════════════════════════════

const CustomerLookupModal: React.FC<{
  isOpen: boolean;
  onSelect: (customer: Customer) => void;
  onClose: () => void;
}> = ({ isOpen, onSelect, onClose }) => {
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      searchInputRef.current?.focus();
      loadCustomers();
    }
  }, [isOpen]);

  const loadCustomers = async (query = "") => {
    setLoading(true);
    try {
      const data = await apiFetchV1("/crm/customers", {
        params: query ? { search: query } : {},
      });
      setCustomers(Array.isArray(data) ? data : data.data || []);
    } catch (err) {
      console.error("Failed to load customers:", err);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (value: string) => {
    setSearch(value);
    if (value.length >= 2) {
      await loadCustomers(value);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-white" />
                <h2 className="text-lg font-bold text-white">Customer Lookup (F2)</h2>
              </div>
              <button onClick={onClose} className="text-white hover:bg-blue-800 p-1 rounded transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search by code or name... (minimum 2 characters)"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Results */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                </div>
              ) : customers.length === 0 ? (
                <div className="py-8 px-4 text-center text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <p>No customers found. Try a different search.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {customers.map((customer) => (
                    <motion.button
                      key={customer.id}
                      onClick={() => {
                        onSelect(customer);
                        onClose();
                      }}
                      whileHover={{ backgroundColor: "#f0f9ff" }}
                      className="w-full text-left p-4 hover:bg-blue-50 transition flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-slate-900">{customer.name}</div>
                        <div className="text-sm text-slate-500 mt-0.5">
                          {customer.code} • {customer.phone || "—"}
                        </div>
                      </div>
                      <ChevronDown className="w-4 h-4 text-slate-400 rotate-[-90deg]" />
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// STOCK LOOKUP MODAL
// ═══════════════════════════════════════════════════════════════════════════════

const StockLookupModal: React.FC<{
  isOpen: boolean;
  onSelect: (item: StockItem) => void;
  onClose: () => void;
}> = ({ isOpen, onSelect, onClose }) => {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      searchInputRef.current?.focus();
    }
  }, [isOpen]);

  const loadItems = async (query = "") => {
    setLoading(true);
    try {
      const data = await apiFetchV1("/inventory/items", {
        params: query ? { search: query } : {},
      });
      setItems(Array.isArray(data) ? data : data.data || []);
    } catch (err) {
      console.error("Failed to load items:", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (value: string) => {
    setSearch(value);
    if (value.length >= 2) {
      await loadItems(value);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Search className="w-5 h-5 text-white" />
                <h2 className="text-lg font-bold text-white">Stock Item Lookup (F2)</h2>
              </div>
              <button onClick={onClose} className="text-white hover:bg-emerald-800 p-1 rounded transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search by code or description... (minimum 2 characters)"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Results */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                </div>
              ) : items.length === 0 ? (
                <div className="py-8 px-4 text-center text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <p>No items found. Try a different search.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {items.map((item) => (
                    <motion.button
                      key={item.id}
                      onClick={() => {
                        onSelect(item);
                        onClose();
                      }}
                      whileHover={{ backgroundColor: "#f0fdf4" }}
                      className="w-full text-left p-4 hover:bg-emerald-50 transition flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-slate-900">{item.code}</div>
                        <div className="text-sm text-slate-600 mt-1">{item.description}</div>
                        <div className="flex gap-4 mt-2 text-xs text-slate-500">
                          <span>Rate: {formatCurrency(item.rate)}</span>
                          {item.onhand !== undefined && <span>On-hand: {formatQuantity(item.onhand)}</span>}
                        </div>
                      </div>
                      <ChevronDown className="w-4 h-4 text-slate-400 rotate-[-90deg]" />
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORT PDT MODAL
// ═══════════════════════════════════════════════════════════════════════════════

const ImportPDTModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onImport: (formData: Partial<SalesOrderFormData>) => void;
}> = ({ isOpen, onClose, onImport }) => {
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const fileContent = await file.text();
      // Parse JSON or CSV file content
      let importedData: Partial<SalesOrderFormData> = {};
      
      if (file.name.endsWith('.json')) {
        importedData = JSON.parse(fileContent);
      } else if (file.name.endsWith('.csv')) {
        // Basic CSV parsing - would need more robust handling in production
        const lines = fileContent.split('\n');
        // This is a simplified example
        importedData = {
          docPrefix: 'SO',
          items: [],
        };
      }

      onImport(importedData);
      onClose();
    } catch (err) {
      console.error('Failed to import file:', err);
      alert('Failed to import file. Please check the format and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-sky-600 to-blue-700 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Upload className="w-5 h-5 text-white" />
                <h2 className="text-lg font-bold text-white">Import Transaction / PDT</h2>
              </div>
              <button onClick={onClose} className="text-white hover:bg-blue-800 p-1 rounded transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Upload a JSON or CSV file with order details to import a transaction or previous sales order.
              </p>

              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-500 hover:bg-blue-50/30 transition cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={loading}
                />
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-slate-400 group-hover:text-blue-500 transition" />
                  <div>
                    <p className="font-semibold text-slate-900">Click to upload</p>
                    <p className="text-xs text-slate-500">or drag and drop</p>
                  </div>
                  <p className="text-xs text-slate-400">JSON or CSV files</p>
                </div>
              </div>

              <div className="space-y-2 p-3 bg-slate-50 rounded-lg">
                <p className="text-xs font-semibold text-slate-700 uppercase">Expected format:</p>
                <pre className="text-xs text-slate-600 overflow-auto">
{`{
  "customerCode": "CUST001",
  "customerName": "...",
  "items": [
    {"stockNo": "SKU001", ...}
  ]
}`}
                </pre>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 px-6 py-4 flex gap-2 justify-end">
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-bold transition disabled:opacity-50 inline-flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Select File
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// RECALL TRANSACTION MODAL
// ═══════════════════════════════════════════════════════════════════════════════

const RecallTransactionModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onRecall: (formData: Partial<SalesOrderFormData>) => void;
}> = ({ isOpen, onClose, onRecall }) => {
  const [transactions, setTransactions] = useState<Array<{ id: string; docNo: string; date: string; customer: string; amount: number; status: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTransactions();
    }
  }, [isOpen]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      // Fetch suspended/previous orders from API
      const data = await apiFetchV1("/sales/orders", {
        params: { status: "suspended,draft", limit: 50, sort: "-date" },
      });
      setTransactions(
        Array.isArray(data) ? data.slice(0, 10) : data.data?.slice(0, 10) || []
      );
    } catch (err) {
      console.error("Failed to load transactions:", err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRecall = async (transactionId: string) => {
    try {
      const data = await apiFetchV1(`/sales/orders/${transactionId}`);
      if (data) {
        onRecall(data);
        onClose();
      }
    } catch (err) {
      console.error("Failed to recall transaction:", err);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-white" />
                <h2 className="text-lg font-bold text-white">Recall Transaction</h2>
              </div>
              <button onClick={onClose} className="text-white hover:bg-slate-900 p-1 rounded transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="py-12 px-6 text-center text-slate-500">
                  <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No suspended or draft orders found.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {transactions.map((txn) => (
                    <motion.button
                      key={txn.id}
                      onClick={() => handleRecall(txn.id)}
                      whileHover={{ backgroundColor: "#f8fafc" }}
                      className="w-full text-left p-4 hover:bg-slate-50 transition flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-slate-900">{txn.docNo}</div>
                        <div className="text-sm text-slate-600 mt-1">
                          <span>{txn.customer}</span>
                          <span className="mx-2">•</span>
                          <span>{txn.date}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-900">{formatCurrency(txn.amount)}</div>
                        <div className="text-xs text-slate-500 mt-1">{txn.status}</div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 px-6 py-4 flex gap-2 justify-end bg-slate-50">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-white transition"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PREMIUM SALES ORDER HEADER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const PremiumSalesOrderHeader: React.FC<{
  formData: Partial<SalesOrderFormData>;
  onFieldChange: (field: string, value: any) => void;
  errors?: Record<string, string>;
  onImportClick?: () => void;
  onRecallClick?: () => void;
}> = ({ formData, onFieldChange, errors = {}, onImportClick, onRecallClick }) => {
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  const handleCustomerSelect = (customer: Customer) => {
    onFieldChange("customerId", customer.id);
    onFieldChange("customerCode", customer.code);
    onFieldChange("customerName", customer.name);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-2xl shadow-lg overflow-hidden"
      >
        {/* Top Action Bar */}
        <div className="px-6 py-4 bg-white/10 backdrop-blur-sm border-b border-white/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-lg backdrop-blur-sm">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white/90 uppercase tracking-wide">Create Sales Order</h2>
              <p className="text-xs text-white/70 mt-0.5">Header Information & Customer Details</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border border-white/20 bg-white/10 shadow-inner shadow-white/5">
              <button
                type="button"
                onClick={onImportClick}
                className="inline-flex items-center gap-1 px-2 py-1 text-[9px] font-semibold rounded-l-md bg-sky-600/90 hover:bg-sky-500 text-white transition"
                title="Import transaction or PDT file"
              >
                <Upload className="w-3 h-3" />
                Import
              </button>
              <div className="h-4 w-px bg-white/30" />
              <button
                type="button"
                onClick={onRecallClick}
                className="inline-flex items-center gap-1 px-2 py-1 text-[9px] font-semibold rounded-r-md bg-slate-700/80 hover:bg-slate-600 text-white transition"
                title="Recall previous sales order or suspended transaction"
              >
                <Clock className="w-3 h-3" />
                Recall
              </button>
            </div>
            <Eye className="w-4 h-4 text-white/60" />
            <Edit3 className="w-4 h-4 text-white/60" />
            <Printer className="w-4 h-4 text-white/60" />
          </div>
        </div>

        {/* Main Content - Ultra-Compact 2-Line Layout */}
        <div className="p-2 bg-gradient-to-b from-slate-50 to-white space-y-1.5">
          {/* LINE 1: Document Identification Fields */}
          <div className="flex gap-1.5 items-end">
            {/* Prefix */}
            <div className="flex flex-col gap-0.5 min-w-fit">
              <label className="text-[8px] font-bold text-slate-600 uppercase">Prefix</label>
              <input
                type="text"
                value={formData.docPrefix || "SO"}
                onChange={(e) => onFieldChange("docPrefix", e.target.value.toUpperCase())}
                maxLength={3}
                className="w-12 px-1.5 py-1 border border-slate-300 rounded text-xs font-mono bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>

            {/* Doc Number */}
            <div className="flex flex-col gap-0.5 min-w-fit">
              <label className="text-[8px] font-bold text-slate-600 uppercase">Doc No</label>
              <input
                type="text"
                value={formData.docNumber || "Auto"}
                readOnly
                className="w-20 px-1.5 py-1 border border-slate-300 rounded text-xs font-mono bg-slate-100 text-slate-500 cursor-not-allowed"
              />
            </div>

            {/* Date */}
            <div className="flex flex-col gap-0.5 min-w-fit">
              <label className="text-[8px] font-bold text-slate-600 uppercase">Date</label>
              <input
                type="date"
                value={formData.docDate || new Date().toISOString().split("T")[0]}
                onChange={(e) => onFieldChange("docDate", e.target.value)}
                className="w-24 px-1.5 py-1 border border-slate-300 rounded text-xs bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>

            {/* Time */}
            <div className="flex flex-col gap-0.5 min-w-fit">
              <label className="text-[8px] font-bold text-slate-600 uppercase">Time</label>
              <input
                type="time"
                value={formData.docTime || new Date().toTimeString().slice(0, 5)}
                onChange={(e) => onFieldChange("docTime", e.target.value)}
                className="w-20 px-1.5 py-1 border border-slate-300 rounded text-xs bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>

            {/* Ref No */}
            <div className="flex flex-col gap-0.5 flex-1 min-w-[120px]">
              <label className="text-[8px] font-bold text-slate-600 uppercase">Ref No</label>
              <input
                type="text"
                value={formData.referenceNo || ""}
                onChange={(e) => onFieldChange("referenceNo", e.target.value)}
                placeholder="PO"
                className="w-full px-1.5 py-1 border border-slate-300 rounded text-xs bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>

            {/* Status */}
            <div className="flex flex-col gap-0.5 min-w-fit">
              <label className="text-[8px] font-bold text-slate-600 uppercase">Status</label>
              <select
                value={formData.orderStatus || "Open"}
                onChange={(e) => onFieldChange("orderStatus", e.target.value)}
                className="px-1.5 py-1 border border-slate-300 rounded text-xs bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              >
                <option>Open</option>
                <option>Confirmed</option>
                <option>Closed</option>
              </select>
            </div>
          </div>

          {/* LINE 2: Customer & Terms Fields */}
          <div className="flex gap-1.5 items-end">
            {/* Customer Code with Lookup */}
            <div className="flex flex-col gap-0.5 min-w-fit">
              <label className="text-[8px] font-bold text-slate-600 uppercase">Customer Code</label>
              <div className="flex gap-0.5">
                <input
                  type="text"
                  value={formData.customerCode || ""}
                  onChange={(e) => onFieldChange("customerCode", e.target.value)}
                  placeholder="F2"
                  className={`w-24 px-1.5 py-1 border rounded text-xs bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent ${
                    errors.customerCode ? "border-red-500" : "border-slate-300"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(true)}
                  className="px-1.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition"
                >
                  F2
                </button>
              </div>
            </div>

            {/* Customer Name */}
            <div className="flex flex-col gap-0.5 flex-1 min-w-[140px]">
              <label className="text-[8px] font-bold text-slate-600 uppercase">Customer Name</label>
              <input
                type="text"
                value={formData.customerName || ""}
                readOnly
                placeholder="Auto-populated"
                className="w-full px-1.5 py-1 border border-slate-300 rounded text-xs bg-slate-50 text-slate-600 cursor-not-allowed"
              />
            </div>

            {/* Sales Staff */}
            <div className="flex flex-col gap-0.5 min-w-fit">
              <label className="text-[8px] font-bold text-slate-600 uppercase">Staff</label>
              <select
                value={formData.salesStaff || ""}
                onChange={(e) => onFieldChange("salesStaff", e.target.value)}
                className="px-1.5 py-1 border border-slate-300 rounded text-xs bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              >
                <option value="">--</option>
                <option>Sales Team 1</option>
                <option>Sales Team 2</option>
              </select>
            </div>

            {/* Delivery Terms */}
            <div className="flex flex-col gap-0.5 min-w-fit">
              <label className="text-[8px] font-bold text-slate-600 uppercase">Delivery</label>
              <select
                value={formData.deliveryTerms || "Door Delivery"}
                onChange={(e) => onFieldChange("deliveryTerms", e.target.value)}
                className="px-1.5 py-1 border border-slate-300 rounded text-xs bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              >
                <option>Door Delivery</option>
                <option>Self Pickup</option>
                <option>Courier</option>
              </select>
            </div>

            {/* Payment Terms */}
            <div className="flex flex-col gap-0.5 min-w-fit">
              <label className="text-[8px] font-bold text-slate-600 uppercase">Payment</label>
              <select
                value={formData.paymentTerms || "Net 30"}
                onChange={(e) => onFieldChange("paymentTerms", e.target.value)}
                className="px-1.5 py-1 border border-slate-300 rounded text-xs bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              >
                <option>Net 30</option>
                <option>Net 15</option>
                <option>Cash</option>
              </select>
            </div>

            {/* Remarks */}
            <div className="flex flex-col gap-0.5 flex-1 min-w-[100px]">
              <label className="text-[8px] font-bold text-slate-600 uppercase">Remarks</label>
              <input
                type="text"
                value={formData.remarks || ""}
                onChange={(e) => onFieldChange("remarks", e.target.value)}
                placeholder="Notes..."
                className="w-full px-1.5 py-1 border border-slate-300 rounded text-xs bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </motion.div>

      <CustomerLookupModal
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        onSelect={handleCustomerSelect}
      />
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PREMIUM SALES ORDER DETAIL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const PremiumSalesOrderDetail: React.FC<{
  items: SalesOrderItem[];
  onItemsChange: (items: SalesOrderItem[]) => void;
}> = ({ items, onItemsChange }) => {
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockModalCallback, setStockModalCallback] = useState<((item: StockItem) => void) | null>(null);

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
      taxPercent: 18,
      taxAmount: 0,
      total: 0,
    };
    onItemsChange([...items, newItem]);
    setSelectedItemIndex(items.length);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...items];
    const item = updated[index] as Record<string, any>;
    item[field] = value;

    const sharedLine = calculateLineTotal({
      id: item.id || `line-${index}`,
      productId: item.id,
      stockNo: item.stockNo,
      barcode: item.stockNo,
      itemDescription: item.description || item.stockNo || "Item",
      qty: Number(item.quantity || 0),
      rate: Number(item.rate || 0),
      value: Number(item.value || 0),
      discPercent: Number(item.discPercent || 0),
      discAmt: Number(item.discAmount || 0),
      taxPercent: Number(item.taxPercent || 0),
      taxAmount: Number(item.taxAmount || 0),
      total: Number(item.total || 0),
    });

    item.value = sharedLine.value;
    item.discAmount = sharedLine.discAmt;
    item.taxAmount = sharedLine.taxAmount;
    item.total = sharedLine.total;

    onItemsChange(updated);
  };

  const handleDeleteItem = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  const handleStockSelect = (stock: StockItem) => {
    if (selectedItemIndex !== null && stockModalCallback) {
      stockModalCallback(stock);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200 mt-3"
      >
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Plus className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Item Details</h3>
                <p className="text-xs text-slate-500 mt-0.5">{items.length} item(s) added</p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleAddItem}
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </motion.button>
          </div>
        </div>

        {/* Table */}
        {items.length === 0 ? (
          <div className="py-12 px-6 text-center">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No items added yet</p>
            <p className="text-sm text-slate-400 mt-1">Click "Add Item" to start building your sales order</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 border-b border-slate-300 sticky top-0">
                <tr className="text-[10px] font-bold text-slate-700 uppercase">
                  <th className="px-2.5 py-2 text-left w-20">Stock No.</th>
                  <th className="px-2.5 py-2 text-left flex-1">Description</th>
                  <th className="px-2.5 py-2 text-right w-16">Rate</th>
                  <th className="px-2.5 py-2 text-right w-14">Qty</th>
                  <th className="px-2.5 py-2 text-right w-16">Value</th>
                  <th className="px-2.5 py-2 text-right w-16">Disc Code</th>
                  <th className="px-2.5 py-2 text-right w-14">Disc Qty</th>
                  <th className="px-2.5 py-2 text-right w-14">Disc %</th>
                  <th className="px-2.5 py-2 text-right w-16">Disc Amt</th>
                  <th className="px-2.5 py-2 text-right w-14">Tax %</th>
                  <th className="px-2.5 py-2 text-right w-16">Tax Amt</th>
                  <th className="px-2.5 py-2 text-right w-16">Total</th>
                  <th className="px-2.5 py-2 text-center w-20">Sales Staff</th>
                  <th className="px-2.5 py-2 text-center w-12">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item, index) => (
                  <motion.tr
                    key={item.id}
                    onClick={() => setSelectedItemIndex(index)}
                    whileHover={{ backgroundColor: "#f8fafc" }}
                    className={`cursor-pointer transition ${
                      selectedItemIndex === index ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
                    }`}
                  >
                    <td className="px-2.5 py-2">
                      <input
                        type="text"
                        value={item.stockNo}
                        onChange={(e) => handleItemChange(index, "stockNo", e.target.value)}
                        onFocus={() => {
                          setSelectedItemIndex(index);
                          setStockModalCallback(() => (stock: StockItem) => {
                            handleItemChange(index, "stockNo", stock.code);
                            handleItemChange(index, "description", stock.description);
                            handleItemChange(index, "rate", stock.rate);
                          });
                          setShowStockModal(true);
                        }}
                        placeholder="F2 or click"
                        data-field-key="stock_no"
                        data-f2-browse="product"
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs font-mono bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                    </td>
                    <td className="px-2.5 py-2">
                      <div className="text-xs font-medium text-slate-900">{item.description || "—"}</div>
                      {item.hsn && <div className="text-[10px] text-slate-500 mt-0.5">HSN: {item.hsn}</div>}
                    </td>
                    <td className="px-2.5 py-2">
                      <input
                        type="number"
                        value={item.rate}
                        onChange={(e) => handleItemChange(index, "rate", parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs text-right bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        step="0.01"
                      />
                    </td>
                    <td className="px-2.5 py-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, "quantity", parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs text-right bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono text-xs font-semibold text-slate-900">
                      {formatCurrency(item.value || 0)}
                    </td>
                    <td className="px-2.5 py-2">
                      <input
                        type="text"
                        value={item.discCode || ""}
                        onChange={(e) => handleItemChange(index, "discCode", e.target.value)}
                        data-field-key="disc_code"
                        placeholder="—"
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                    </td>
                    <td className="px-2.5 py-2">
                      <input
                        type="number"
                        value={item.discQty || 0}
                        onChange={(e) => handleItemChange(index, "discQty", parseFloat(e.target.value) || 0)}
                        data-field-key="disc_qty"
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs text-right bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        step="0.01"
                      />
                    </td>
                    <td className="px-2.5 py-2">
                      <input
                        type="number"
                        value={item.discPercent || 0}
                        onChange={(e) => handleItemChange(index, "discPercent", parseFloat(e.target.value) || 0)}
                        data-field-key="disc_percent"
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs text-right bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        step="0.01"
                        max="100"
                      />
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono text-xs font-semibold text-slate-900">
                      {formatCurrency(item.discAmount || 0)}
                    </td>
                    <td className="px-2.5 py-2">
                      <input
                        type="number"
                        value={item.taxPercent || 0}
                        onChange={(e) => handleItemChange(index, "taxPercent", parseFloat(e.target.value) || 0)}
                        data-field-key="tax_percent"
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs text-right bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        step="0.01"
                        max="100"
                      />
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono text-xs font-semibold text-slate-900">
                      {formatCurrency(item.taxAmount || 0)}
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono text-xs font-bold text-emerald-700 bg-emerald-50 rounded">
                      {formatCurrency(item.total || 0)}
                    </td>
                    <td className="px-2.5 py-2">
                      <input
                        type="text"
                        value={item.salesStaff || ""}
                        onChange={(e) => handleItemChange(index, "salesStaff", e.target.value)}
                        data-field-key="sales_staff"
                        placeholder="—"
                        className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      <motion.button
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDeleteItem(index)}
                        type="button"
                        className="text-red-500 hover:text-red-700 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <StockLookupModal
        isOpen={showStockModal}
        onClose={() => setShowStockModal(false)}
        onSelect={handleStockSelect}
      />
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PREMIUM SALES ORDER FOOTER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const PremiumSalesOrderFooter: React.FC<{
  summary: {
    totalItems: number;
    totalQuantity: number;
    totalSalesValue: number;
    totalDiscount: number;
    totalTax: number;
    netAmount: number;
  };
}> = ({ summary }) => {
  const { totalItems, totalQuantity, totalSalesValue, totalDiscount, totalTax, netAmount } = summary;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 border-t border-slate-700 shadow-[0_-12px_30px_rgba(15,23,42,0.14)]"
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">Order Summary</h3>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Live
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Items</div>
            <div className="mt-2 text-xl font-bold text-white">{totalItems}</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Qty</div>
            <div className="mt-2 text-xl font-bold text-white">{formatQuantity(totalQuantity)}</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Value</div>
            <div className="mt-2 text-lg font-bold text-blue-300">{formatCurrency(totalSalesValue)}</div>
          </div>

          <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 backdrop-blur-sm">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-200">Discount</div>
            <div className="mt-2 text-lg font-bold text-rose-200">-{formatCurrency(totalDiscount)}</div>
          </div>

          <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 backdrop-blur-sm">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200">Tax</div>
            <div className="mt-2 text-lg font-bold text-amber-200">{formatCurrency(totalTax)}</div>
          </div>

          <div className="rounded-xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500 to-emerald-700 p-3 shadow-lg shadow-emerald-900/20 sm:col-span-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100">Net</div>
            <div className="mt-2 text-lg font-bold text-white">{formatCurrency(netAmount)}</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PREMIUM SALES ORDER FORM COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const SalesOrderFormPremium: React.FC<SalesOrderFormProps> = ({
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
    deliveryTerms: "Door Delivery",
    paymentTerms: "Net 30",
    orderStatus: "Open",
    remarks: "",
    items: [],
    ...initialData,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showImportModal, setShowImportModal] = useState(false);
  const [showRecallModal, setShowRecallModal] = useState(false);
  const [quickEntry, setQuickEntry] = useState({
    stockNo: "",
    description: "",
    rate: "",
    qty: "1",
    discCode: "",
    discQty: "",
    discPercent: "",
    discAmount: "",
    taxPercent: "18",
    taxAmount: "",
    gstRate: "18",
    salesStaff: "",
  });

  const handleFieldChange = useCallback((field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  }, [errors]);

  const handleItemsChange = useCallback((items: SalesOrderItem[]) => {
    setFormData((prev) => {
      const summary = getSalesOrderSummary(items, { ...prev, items });
      return {
        ...prev,
        items,
        ...summary,
      };
    });
  }, []);

  const handleImport = useCallback((importedData: Partial<SalesOrderFormData>) => {
    setFormData((prev) => ({
      ...prev,
      ...importedData,
      // Preserve certain fields
      docPrefix: prev.docPrefix,
      docDate: new Date().toISOString().split("T")[0],
      docTime: new Date().toTimeString().slice(0, 5),
    }));
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  }, []);

  const handleRecall = useCallback((recalledData: Partial<SalesOrderFormData>) => {
    setFormData((prev) => ({
      ...prev,
      ...recalledData,
      // Reset date/time for new entry
      docDate: new Date().toISOString().split("T")[0],
      docTime: new Date().toTimeString().slice(0, 5),
    }));
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  }, []);

  const handleQuickEntryLookup = useCallback(async (term: string) => {
    const cleanTerm = term.trim();
    if (!cleanTerm) {
      setQuickEntry((prev) => ({ ...prev, description: "" }));
      return;
    }

    try {
      const data = await apiFetchV1(`/products?search=${encodeURIComponent(cleanTerm)}`);
      const productList = Array.isArray(data) ? data : data?.data || [];
      const product = productList.find(
        (p: any) =>
          String(p.code || "").toLowerCase() === cleanTerm.toLowerCase() ||
          String(p.barcode || "").toLowerCase() === cleanTerm.toLowerCase() ||
          String(p.stock_no || "").toLowerCase() === cleanTerm.toLowerCase() ||
          String(p.name || "").toLowerCase().includes(cleanTerm.toLowerCase())
      ) || productList[0];

      if (product) {
        setQuickEntry((prev) => ({
          ...prev,
          description: product.description || product.name || prev.description,
          rate: String(product.rate ?? product.selling_price ?? product.price ?? ""),
          gstRate: String(product.gst_percentage ?? product.gst_rate ?? 18),
          taxPercent: String(product.gst_percentage ?? product.gst_rate ?? 18),
        }));
      }
    } catch (error) {
      console.warn("Failed to resolve quick-entry product:", error);
    }
  }, []);

  const handleQuickAddItem = useCallback(() => {
    const stockNo = quickEntry.stockNo.trim();
    const qty = Number(quickEntry.qty || 1);
    const rate = Number(quickEntry.rate || 0);
    const discPercent = Number(quickEntry.discPercent || 0);
    const discAmount = Number(quickEntry.discAmount || 0);
    const taxPercent = Number(quickEntry.taxPercent || 18);
    
    if (!stockNo && !quickEntry.description.trim()) {
      return;
    }

    const calcValue = rate * (Number.isFinite(qty) && qty > 0 ? qty : 1);
    const calcDiscAmount = discAmount || (calcValue * discPercent) / 100;
    const calcTaxAmount = ((calcValue - calcDiscAmount) * taxPercent) / 100;
    const calcTotal = calcValue - calcDiscAmount + calcTaxAmount;

    const newItem: SalesOrderItem = {
      id: `item-${Date.now()}`,
      stockNo: stockNo || `SKU-${Math.random().toString().slice(-4)}`,
      description: quickEntry.description.trim() || "Retail Item",
      rate,
      quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
      value: calcValue,
      discCode: quickEntry.discCode || undefined,
      discQty: quickEntry.discQty ? Number(quickEntry.discQty) : undefined,
      discPercent,
      discAmount: calcDiscAmount,
      taxPercent,
      taxAmount: calcTaxAmount,
      total: calcTotal,
      salesStaff: quickEntry.salesStaff || undefined,
      gstRate: Number(quickEntry.gstRate || 18),
    };

    handleItemsChange([...(formData.items || []), newItem]);
    setQuickEntry({
      stockNo: "",
      description: "",
      rate: "",
      qty: "1",
      discCode: "",
      discQty: "",
      discPercent: "",
      discAmount: "",
      taxPercent: "18",
      taxAmount: "",
      gstRate: "18",
      salesStaff: "",
    });
  }, [quickEntry, formData.items, handleItemsChange]);

  const validateForm = () => {
    const txn: SalesTransaction = {
      docType: "sales_order",
      docPrefix: formData.docPrefix || "SO",
      docNumber: formData.docNumber || "",
      docDate: formData.docDate || new Date().toISOString().split("T")[0],
      docTime: formData.docTime || new Date().toTimeString().slice(0, 5),
      customerId: formData.customerId,
      customerCode: formData.customerCode,
      customerName: formData.customerName,
      referenceNo: formData.referenceNo,
      deliveryTerms: formData.deliveryTerms,
      paymentTerms: formData.paymentTerms,
      orderStatus: formData.orderStatus,
      remarks: formData.remarks,
      items: (formData.items || []).map(toSharedSalesLineItem),
      subtotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      netAmount: 0,
    };

    const validationErrors = validateSalesTransaction(txn);
    const newErrors: Record<string, string> = {};

    if (validationErrors.some((message) => message.toLowerCase().includes("customer"))) {
      newErrors.customerCode = "Customer is required";
    }

    const itemValidationError = validateSalesOrderItems(formData.items || []);
    if (itemValidationError) {
      newErrors.items = itemValidationError;
    }

    if (validationErrors.some((message) => message.toLowerCase().includes("item") && message.toLowerCase().includes("required"))) {
      newErrors.items = "At least one item is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      if (onSubmit) {
        await onSubmit(formData as SalesOrderFormData);
      }
      setSuccess(true);
      setTimeout(() => onCancel?.(), 2000);
    } catch (err: any) {
      setError(err.message || "Failed to save sales order");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`${compact ? "max-w-none mx-0 p-0 bg-slate-900 min-h-screen" : "max-w-[1700px] mx-auto p-4 xl:p-6 bg-[radial-gradient(circle_at_top,_#f8fbff,_#eef3f9_38%,_#e7edf5_100%)] min-h-screen"}`}>
      {!compact && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-blue-700">
                <FileText className="h-3.5 w-3.5" />
                Transaction Workspace
              </div>
              <h1 className="text-3xl xl:text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/20">
                  <FileText className="w-5 h-5" />
                </span>
                Sales Order
              </h1>
            </div>
            <motion.div whileHover={{ scale: 1.02 }} className="flex items-center gap-2 self-start xl:self-auto">
              <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Enterprise Edition
              </div>
              <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                v3.30.0
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700 shadow-sm"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-700 shadow-sm"
          >
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>Sales order saved successfully!</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.12)]">
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200 flex-shrink-0">
          <PremiumSalesOrderHeader
            formData={formData}
            onFieldChange={handleFieldChange}
            errors={errors}
            onImportClick={() => setShowImportModal(true)}
            onRecallClick={() => setShowRecallModal(true)}
          />
        </div>

        <div className="flex flex-col xl:flex-row min-h-[760px]">
          <div className="flex-1 min-w-0 bg-white">
            <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Order Entry
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-1">Pending validation</span>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-1">Auto tax</span>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-1">Barcode ready</span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 bg-white">
              <PremiumSalesOrderDetail
                items={formData.items || []}
                onItemsChange={handleItemsChange}
              />

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="border-t border-slate-200 bg-gradient-to-r from-slate-50 via-emerald-50 to-white px-4 py-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">Quick Add</span>
                  <span className="text-[10px] text-slate-500">F2 lookup + enter to add</span>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-7">
                  <input
                    type="text"
                    value={quickEntry.stockNo}
                    data-field-key="stock_no"
                    data-f2-browse="product"
                    onChange={(e) => setQuickEntry((prev) => ({ ...prev, stockNo: e.target.value }))}
                    onBlur={() => void handleQuickEntryLookup(quickEntry.stockNo)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleQuickAddItem();
                      }
                    }}
                    placeholder="Stock No"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs font-mono bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    value={quickEntry.description}
                    readOnly
                    placeholder="Description"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs bg-slate-100 text-slate-700"
                  />
                  <input
                    type="number"
                    value={quickEntry.rate}
                    data-field-key="rate"
                    onChange={(e) => setQuickEntry((prev) => ({ ...prev, rate: e.target.value }))}
                    placeholder="Rate"
                    step="0.01"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs text-right bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  <input
                    type="number"
                    value={quickEntry.qty}
                    data-field-key="quantity"
                    onChange={(e) => setQuickEntry((prev) => ({ ...prev, qty: e.target.value }))}
                    placeholder="Qty"
                    min="1"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs text-right bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  <input
                    type="number"
                    value={quickEntry.discPercent}
                    data-field-key="disc_percent"
                    onChange={(e) => setQuickEntry((prev) => ({ ...prev, discPercent: e.target.value }))}
                    placeholder="Disc %"
                    step="0.01"
                    max="100"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs text-right bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  <input
                    type="number"
                    value={quickEntry.taxPercent}
                    data-field-key="tax_percent"
                    onChange={(e) => setQuickEntry((prev) => ({ ...prev, taxPercent: e.target.value }))}
                    placeholder="Tax %"
                    step="0.01"
                    max="100"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs text-right bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleQuickAddItem()}
                    type="button"
                    className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition"
                  >
                    Add item
                  </motion.button>
                </div>
              </motion.div>
            </div>
          </div>

          <aside className="w-full xl:w-[340px] border-t xl:border-t-0 xl:border-l border-slate-200 bg-slate-50/80">
            <div className="sticky top-[120px] p-4 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Customer</p>
                    <h3 className="mt-1 text-sm font-bold text-slate-900">{formData.customerName || "Select customer"}</h3>
                  </div>
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-blue-700">
                    {formData.orderStatus || "Open"}
                  </span>
                </div>

                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-2.5 py-2">
                    <span className="font-medium text-slate-500">Customer Code</span>
                    <span className="font-bold text-slate-900">{formData.customerCode || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-2.5 py-2">
                    <span className="font-medium text-slate-500">Delivery</span>
                    <span className="font-bold text-slate-900">{formData.deliveryTerms || "Door Delivery"}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-2.5 py-2">
                    <span className="font-medium text-slate-500">Payment</span>
                    <span className="font-bold text-slate-900">{formData.paymentTerms || "Net 30"}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Action</p>
                  <button
                    type="button"
                    onClick={() => setShowImportModal(true)}
                    className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-sky-700"
                  >
                    Import
                  </button>
                </div>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-3 py-2.5 text-xs font-bold text-white shadow hover:shadow-emerald-900/20 disabled:opacity-60"
                  >
                    {isSubmitting ? "Saving..." : "Save Sales Order"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRecallModal(true)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
                  >
                    Recall draft
                  </button>
                  <button
                    type="button"
                    onClick={onCancel}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <div className="border-t border-slate-200">
          <PremiumSalesOrderFooter summary={getSalesOrderSummary(formData.items || [], formData)} />
        </div>

        <div className="px-4 py-4 bg-white border-t border-slate-200">
          <TransactionAttachmentPanel
            documentType="sales_order"
            documentId={formData.docNumber || "new"}
            onAttachmentAdded={(att: TransactionAttachment) => {
              if (formData.docNumber) {
                console.log("Attachment added:", att.fileName);
              }
            }}
            readOnly={false}
          />
        </div>
      </div>

      <ImportPDTModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
      />
      <RecallTransactionModal
        isOpen={showRecallModal}
        onClose={() => setShowRecallModal(false)}
        onRecall={handleRecall}
      />
    </div>
  );
};

export default SalesOrderFormPremium;
