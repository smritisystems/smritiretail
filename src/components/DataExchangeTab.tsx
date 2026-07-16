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

import React, { useState, useEffect } from "react";
import { apiFetchV1 } from "../lib/apiFetch.ts";
import {
  Globe,
  Shield,
  Key,
  FileSpreadsheet,
  Upload,
  Download,
  RefreshCw,
  Plus,
  Edit2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  Sliders,
  Database,
  Lock,
  Check,
  Search,
  FileText,
  Settings,
  AlertCircle,
  Eye,
  Activity,
  CheckSquare
} from "lucide-react";

interface Partner {
  id: string;
  code: string;
  name: string;
  type: string;
  communication: string;
  schedule: string;
  apiKey: string;
  ipAllowlist: string;
  allowedBranches: string[];
  allowedFields: string[];
  isActive: boolean;
  expiryDate: string;
  lastSync: string;
  reorderLevel?: number;
}

interface Mapping {
  partnerId: string;
  mappings: Record<string, string>;
}

interface LogEntry {
  id: string;
  partnerId: string;
  partnerName: string;
  timestamp: string;
  direction: string;
  format: string;
  fileName: string;
  rowCount: number;
  successCount: number;
  errorCount: number;
  errors: Array<{ row: number; column: string; message: string }>;
  status: string;
  importedBy: string;
  approvedBy: string;
  checksum: string;
  rowsData: any[];
}

interface DataExchangeTabProps {
  onNotification: (title: string, message: string, type?: "success" | "error") => void;
}

const DEMO_MAPPINGS: Record<string, Record<string, string>> = {
  "PRT-01": {
    "Item Code": "sku",
    "Barcode Code": "barcode",
    "Sales Qty": "quantity",
    "MRP Price": "mrp",
    "Actual Price": "sellingPrice",
    "Branch Code": "storeId",
    "Deduction Amt": "discount"
  },
  "PRT-02": {
    "SKU_ID": "sku",
    "QTY_SOLD": "quantity",
    "RETAIL_PRICE": "mrp",
    "SERIAL_NO": "serialNumber"
  },
  "PRT-03": {
    "PRODUCT_SKU": "sku",
    "EAN_CODE": "barcode",
    "STOCK_LEVEL": "quantity",
    "BATCH_NO": "batchCode"
  }
};

export const DataExchangeTab: React.FC<DataExchangeTabProps> = ({ onNotification }) => {
  const [activeSubTab, setActiveSubTab] = useState<"partners" | "exchange" | "approvals" | "logs">("partners");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Form states for creating/editing partner
  const [isEditingPartner, setIsEditingPartner] = useState(false);
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
  const [partnerForm, setPartnerForm] = useState({
    name: "",
    code: "",
    type: "Mall",
    communication: "CSV",
    schedule: "Daily",
    ipAllowlist: "*",
    allowedBranches: "MUM,DEL",
    expiryDate: "2027-12-31",
    allowedFields: ["sku", "barcode", "quantity", "mrp", "sellingPrice"] as string[],
    mappings: {} as Record<string, string>
  });

  // Key-value pair configuration for custom field mappings
  const [mappingPairs, setMappingPairs] = useState<Array<{ external: string; internal: string }>>([]);

  // Exchange/Upload states
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [selectedFormat, setSelectedFormat] = useState("CSV");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [validationResult, setValidationResult] = useState<{
    checksum: string;
    rowCount: number;
    successCount: number;
    errorCount: number;
    errors: any[];
    rows: any[];
  } | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  const SMRITI_INTERNAL_FIELDS = [
    { value: "sku", label: "Product SKU (Item Code)" },
    { value: "barcode", label: "EAN / Barcode" },
    { value: "quantity", label: "Transaction Quantity" },
    { value: "mrp", label: "MRP Price" },
    { value: "sellingPrice", label: "Actual Selling Price" },
    { value: "storeId", label: "Store ID / Branch Code" },
    { value: "discount", label: "Discount / Deduction Amount" },
    { value: "taxRate", label: "GST Tax Rate" }
  ];

  useEffect(() => {
    fetchPartners();
    fetchLogs();
  }, []);

  const fetchPartners = async () => {
    try {
      const data = await apiFetchV1("/exchange/partners");
      setPartners(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLogs = async () => {
    try {
      const data = await apiFetchV1("/exchange/logs");
      setLogs(data);
    } catch (err) {
      console.error(err);
    }
  };

  const startEditPartner = async (partner: Partner) => {
    setLoading(true);
    try {
      const mapData = await apiFetchV1(`/exchange/mappings/${partner.id}`);
      const pMappings = mapData.mappings || {};
      const pairs = Object.entries(pMappings).map(([external, internal]) => ({
        external,
        internal: internal as string
      }));

      setPartnerForm({
        name: partner.name,
        code: partner.code,
        type: partner.type,
        communication: partner.communication,
        schedule: partner.schedule,
        ipAllowlist: partner.ipAllowlist,
        allowedBranches: partner.allowedBranches.join(","),
        expiryDate: partner.expiryDate.split("T")[0],
        allowedFields: partner.allowedFields,
        mappings: pMappings
      });
      setMappingPairs(pairs.length > 0 ? pairs : [{ external: "", internal: "" }]);
      setEditingPartnerId(partner.id);
      setIsEditingPartner(true);
    } catch (err) {
      console.error(err);
      onNotification("Configuration Error", "Could not load transformation mapping schema.", "error");
    } finally {
      setLoading(false);
    }
  };

  const startNewPartner = () => {
    setEditingPartnerId(null);
    setPartnerForm({
      name: "",
      code: "",
      type: "Mall",
      communication: "CSV",
      schedule: "Daily",
      ipAllowlist: "*",
      allowedBranches: "MUM",
      expiryDate: "2027-12-31",
      allowedFields: ["sku", "barcode", "quantity", "mrp", "sellingPrice"],
      mappings: {}
    });
    setMappingPairs([
      { external: "Item Code", internal: "sku" },
      { external: "Barcode Code", internal: "barcode" },
      { external: "Sales Qty", internal: "quantity" },
      { external: "MRP Price", internal: "mrp" },
      { external: "Actual Price", internal: "sellingPrice" }
    ]);
    setIsEditingPartner(true);
  };

  const savePartner = async () => {
    if (!partnerForm.name || !partnerForm.code) {
      onNotification("Missing Information", "Please enter partner name and code identifier.", "error");
      return;
    }

    setLoading(true);
    const finalMappings: Record<string, string> = {};
    mappingPairs.forEach(pair => {
      if (pair.external.trim() && pair.internal.trim()) {
        finalMappings[pair.external.trim()] = pair.internal;
      }
    });

    const payload = {
      ...partnerForm,
      allowedBranches: partnerForm.allowedBranches.split(",").map(b => b.trim().toUpperCase()),
      mappings: finalMappings
    };

    try {
      const url = editingPartnerId 
        ? `/exchange/partners/${editingPartnerId}`
        : "/exchange/partners";
      const method = editingPartnerId ? "PUT" : "POST";

      await apiFetchV1(url, {
        method,
        body: JSON.stringify(payload)
      });

      onNotification(
        "Profile Saved", 
        `Partner profile '${partnerForm.name}' configured and secure credentials issued successfully.`, 
        "success"
      );
      setIsEditingPartner(false);
      fetchPartners();
    } catch (err) {
      console.error(err);
      onNotification("Setup Failed", "Network transport error occurred.", "error");
    } finally {
      setLoading(false);
    }
  };

  const addMappingPair = () => {
    setMappingPairs([...mappingPairs, { external: "", internal: "" }]);
  };

  const removeMappingPair = (idx: number) => {
    setMappingPairs(mappingPairs.filter((_, i) => i !== idx));
  };

  // Pre-load static templates to make testing beautiful
  const loadTestingTemplate = (type: "reliance" | "smarttech") => {
    if (type === "reliance") {
      setSelectedPartnerId("PRT-01");
      setSelectedFormat("CSV");
      setUploadedFileName("Reliance_POS_Daily_Sales_Fresh.csv");
      const initialRows = [
        { "Item Code": "SKU-MUM-01", "Barcode Code": "8901031201", "Sales Qty": "12", "MRP Price": "1200", "Actual Price": "1150", "Branch Code": "MUM", "Deduction Amt": "50" },
        { "Item Code": "SKU-MUM-02", "Barcode Code": "8901031202", "Sales Qty": "25", "MRP Price": "800", "Actual Price": "800", "Branch Code": "MUM", "Deduction Amt": "0" },
        // Intentionally invalid rows to showcase verification and correction
        { "Item Code": "SKU-UNKNOWN-99", "Barcode Code": "99999999999", "Sales Qty": "-5", "MRP Price": "1500", "Actual Price": "1400", "Branch Code": "MUM", "Deduction Amt": "100" },
        { "Item Code": "SKU-MUM-04", "Barcode Code": "", "Sales Qty": "4", "MRP Price": "350", "Actual Price": "320", "Branch Code": "DEL", "Deduction Amt": "30" }
      ];
      setRawRows(initialRows);
      triggerValidate(initialRows, "PRT-01");
    } else {
      setSelectedPartnerId("PRT-02");
      setSelectedFormat("JSON");
      setUploadedFileName("Franchise_Sync_BLR.json");
      const initialRows = [
        { "SKU_ID": "LAP-MAC-14", "QTY_SOLD": "3", "RETAIL_PRICE": "124900", "SERIAL_NO": "MAC-SN-9912A" },
        { "SKU_ID": "PHN-S23-UL", "QTY_SOLD": "10", "RETAIL_PRICE": "95000", "SERIAL_NO": "S23-UL-1022C" }
      ];
      setRawRows(initialRows);
      triggerValidate(initialRows, "PRT-02");
    }
  };

  const triggerValidate = async (rowsToValidate: any[], partnerId: string) => {
    if (!partnerId) return;
    setLoading(true);
    try {
      const data = await apiFetchV1("/exchange/validate", {
        method: "POST",
        body: JSON.stringify({
          partnerId,
          fileName: uploadedFileName || "direct_exchange_stream.json",
          format: selectedFormat,
          rows: rowsToValidate
        })
      });
      setValidationResult(data);
      onNotification(
        "Validation Completed", 
        `Scanned ${data.rowCount} records. Success: ${data.successCount}, Errors: ${data.errorCount}.`, 
        data.errorCount > 0 ? "error" : "success"
      );
    } catch (err) {
      console.error(err);
      onNotification("Validation Error", "Failed to communicate with validation engine.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Live Inline Editing inside the validation preview grid!
  const handleCellEdit = (rowIdx: number, columnKey: string, newValue: string) => {
    const updatedRaw = [...rawRows];
    updatedRaw[rowIdx] = {
      ...updatedRaw[rowIdx],
      [columnKey]: newValue
    };
    setRawRows(updatedRaw);
    
    // Automatically re-validate on update to give a responsive feedback loop
    triggerValidate(updatedRaw, selectedPartnerId);
  };

  // Commit validated data
  const commitImport = async () => {
    if (!validationResult) return;
    setLoading(true);
    try {
      const data = await apiFetchV1("/exchange/commit", {
        method: "POST",
        headers: {
          "X-User-Name": "Store Manager (Ops)"
        },
        body: JSON.stringify({
          partnerId: selectedPartnerId,
          fileName: uploadedFileName || "Interactive_Import.csv",
          format: selectedFormat,
          rows: validationResult.rows,
          checksum: validationResult.checksum
        })
      });

      onNotification("Sync Submitted", data.message, "success");
      setValidationResult(null);
      setRawRows([]);
      setUploadedFileName("");
      fetchLogs();
      fetchPartners();
      if (data.status === "Pending Approval") {
        setActiveSubTab("approvals");
      } else {
        setActiveSubTab("logs");
      }
    } catch (err) {
      console.error(err);
      onNotification("Import Failed", "Server error dispatching ledger events.", "error");
    } finally {
      setLoading(false);
    }
  };

  const approveLog = async (logId: string) => {
    setLoading(true);
    try {
      await apiFetchV1(`/exchange/approve-log/${logId}`, {
        method: "POST",
        headers: { "X-User-Name": "Store Manager (Ops)" }
      });
      onNotification("Authorized", "Mall consignment batch approved. Stock ledger updated, and Tally export XML queued.", "success");
      fetchLogs();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredPartners = partners.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 bg-[#f8fafc] min-h-screen">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-5 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-slate-900 text-white rounded-md">
              <Activity className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-sans font-medium tracking-tight text-slate-900">
              Data Exchange & Integration Engine
            </h1>
          </div>
          <p className="text-sm text-slate-500 max-w-2xl">
            Secure partner integration hub for SMRITI Retail OS. Manage isolated operational data exchanges with malls, franchises, distributors, and logistics partners.
          </p>
        </div>

        <div className="mt-4 md:mt-0 flex gap-2">
          <button
            onClick={() => { fetchPartners(); fetchLogs(); onNotification("Refresh", "State pulled from SMRITI databases.", "success"); }}
            className="flex items-center gap-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh State
          </button>
          <button
            onClick={startNewPartner}
            className="flex items-center gap-1.5 text-xs font-medium text-white bg-slate-900 px-3 py-2 rounded-lg hover:bg-slate-800 transition"
          >
            <Plus className="h-4 w-4" /> Add Partner Profile
          </button>
        </div>
      </div>

      {/* Main Tabs bar */}
      <div className="flex border-b border-slate-200 mb-6 gap-2">
        <button
          onClick={() => { setActiveSubTab("partners"); setIsEditingPartner(false); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeSubTab === "partners" && !isEditingPartner
              ? "border-slate-900 text-slate-900 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Partner Directory ({partners.length})
        </button>
        <button
          onClick={() => { setActiveSubTab("exchange"); setIsEditingPartner(false); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeSubTab === "exchange"
              ? "border-slate-900 text-slate-900 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Exchange & Import Center
        </button>
        <button
          onClick={() => { setActiveSubTab("approvals"); setIsEditingPartner(false); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition relative ${
            activeSubTab === "approvals"
              ? "border-slate-900 text-slate-900 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Approvals Waiting
          {logs.filter(l => l.status === "Pending Approval").length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-full">
              {logs.filter(l => l.status === "Pending Approval").length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setActiveSubTab("logs"); setIsEditingPartner(false); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeSubTab === "logs"
              ? "border-slate-900 text-slate-900 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Security Audit Logs
        </button>
      </div>

      {/* RENDER ACTIVE TAB */}

      {/* 1. Partner Profile Creation & Listing */}
      {activeSubTab === "partners" && !isEditingPartner && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by partner name, code, type (Mall, Vendor, Distributor, etc.)..."
                className="w-full text-sm pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 bg-slate-50/50"
              />
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-xs text-slate-500 hover:text-slate-900"
              >
                Clear
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPartners.map((partner) => (
              <div key={partner.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition">
                <div className="p-5 flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider rounded-md bg-slate-100 text-slate-800 uppercase">
                        {partner.type}
                      </span>
                      <h3 className="text-base font-sans font-medium text-slate-900 mt-1.5">
                        {partner.name}
                      </h3>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        Code: {partner.code}
                      </p>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      partner.isActive 
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20" 
                        : "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20"
                    }`}>
                      {partner.isActive ? "Active" : "Revoked"}
                    </span>
                  </div>

                  <div className="space-y-3.5 border-t border-slate-100 pt-4 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Sliders className="h-3 w-3" /> Communication:
                      </span>
                      <span className="font-medium bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 font-mono text-slate-800">
                        {partner.communication}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Sync Schedule:
                      </span>
                      <span className="font-medium text-slate-800">
                        {partner.schedule}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Globe className="h-3 w-3" /> IP Restriction:
                      </span>
                      <span className="font-mono text-slate-700 truncate max-w-[150px]" title={partner.ipAllowlist}>
                        {partner.ipAllowlist}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Shield className="h-3 w-3" /> Branches allowed:
                      </span>
                      <span className="font-medium text-slate-800">
                        {partner.allowedBranches.join(", ")}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-2">
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-1">
                        <Key className="h-2.5 w-2.5" /> API Credential
                      </div>
                      <div className="flex items-center justify-between font-mono text-xs bg-white border border-slate-200 rounded px-1.5 py-1 text-slate-700">
                        <span className="truncate max-w-[170px]" title={partner.apiKey}>
                          ••••••••••••{partner.apiKey.slice(-6)}
                        </span>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(partner.apiKey);
                            onNotification("Credential Copied", "API Token copied safely.", "success");
                          }}
                          className="text-[10px] text-blue-600 hover:underline"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    Last sync: {partner.lastSync !== "-" ? new Date(partner.lastSync).toLocaleDateString() : "Never"}
                  </span>
                  <button
                    onClick={() => startEditPartner(partner)}
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                  >
                    <Edit2 className="h-3 w-3" /> Edit Mapping Rules
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editor Screen: New Partner or Existing Edit */}
      {isEditingPartner && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-medium text-slate-900 mb-6">
            {editingPartnerId ? "Edit Mapping Rules & Partner Settings" : "Configure Partner Profile & Schema Mappings"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Identity & Security Column */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b pb-1">
                Identity & Access Credentials
              </h3>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Partner Organization Name *</label>
                <input
                  type="text"
                  value={partnerForm.name}
                  onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })}
                  placeholder="e.g. Phoenix Mall Authority"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Partner Code Identifier *</label>
                  <input
                    type="text"
                    value={partnerForm.code}
                    onChange={(e) => setPartnerForm({ ...partnerForm, code: e.target.value })}
                    placeholder="e.g. PHOENIX-MUM"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50"
                    disabled={!!editingPartnerId}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Partner Type</label>
                  <select
                    value={partnerForm.type}
                    onChange={(e) => setPartnerForm({ ...partnerForm, type: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50"
                  >
                    <option value="Mall">Mall Authority</option>
                    <option value="Franchise">Franchise Store</option>
                    <option value="Distributor">Distributor / Vendor</option>
                    <option value="Logistics">Logistics Provider</option>
                    <option value="Marketplace">E-Commerce Marketplace</option>
                    <option value="ERP">External ERP Partner</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Communication Driver</label>
                  <select
                    value={partnerForm.communication}
                    onChange={(e) => setPartnerForm({ ...partnerForm, communication: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50"
                  >
                    <option value="CSV">CSV File Interchange</option>
                    <option value="API">REST API Endpoint</option>
                    <option value="XML">XML Document Feed</option>
                    <option value="JSON">JSON Stream Payload</option>
                    <option value="SFTP">SFTP Secure Folder</option>
                    <option value="Webhook">Webhook Dispatcher</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Schedules Synchronization</label>
                  <select
                    value={partnerForm.schedule}
                    onChange={(e) => setPartnerForm({ ...partnerForm, schedule: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50"
                  >
                    <option value="Real-Time">Real-Time (Continuous)</option>
                    <option value="Hourly">Hourly Synchronizer</option>
                    <option value="Daily">Daily Operational Close</option>
                    <option value="Weekly">Weekly Interval</option>
                    <option value="Manual">Manual Intervention Only</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Allowed IP Address Allowlist (comma separated)</label>
                <input
                  type="text"
                  value={partnerForm.ipAllowlist}
                  onChange={(e) => setPartnerForm({ ...partnerForm, ipAllowlist: e.target.value })}
                  placeholder="e.g. 192.168.1.1, 10.0.0.0/24 or *"
                  className="w-full font-mono text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Authorized Branches</label>
                  <input
                    type="text"
                    value={partnerForm.allowedBranches}
                    onChange={(e) => setPartnerForm({ ...partnerForm, allowedBranches: e.target.value })}
                    placeholder="e.g. MUM,DEL,BLR"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Contract Expiration Date</label>
                  <input
                    type="date"
                    value={partnerForm.expiryDate}
                    onChange={(e) => setPartnerForm({ ...partnerForm, expiryDate: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50"
                  />
                </div>
              </div>
            </div>

            {/* Field Mapping Engine column */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-1">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Transformation & Field Mapping Engine (No-Code)
                </h3>
                <button
                  type="button"
                  onClick={addMappingPair}
                  className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline font-medium"
                >
                  <Plus className="h-3 w-3" /> Add Row
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Direct the engine how to parse column headers from files uploaded by this partner. Map partner fields on the left to standard SMRITI internal properties on the right.
              </p>

              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2">
                {mappingPairs.map((pair, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200/60">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={pair.external}
                        onChange={(e) => {
                          const updated = [...mappingPairs];
                          updated[idx].external = e.target.value;
                          setMappingPairs(updated);
                        }}
                        placeholder="Partner column header name"
                        className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white font-mono"
                      />
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                    <div className="flex-1">
                      <select
                        value={pair.internal}
                        onChange={(e) => {
                          const updated = [...mappingPairs];
                          updated[idx].internal = e.target.value;
                          setMappingPairs(updated);
                        }}
                        className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white"
                      >
                        <option value="">-- Choose SMRITI Field --</option>
                        {SMRITI_INTERNAL_FIELDS.map(f => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMappingPair(idx)}
                      className="text-red-500 hover:text-red-700 p-1 rounded"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button
              onClick={() => setIsEditingPartner(false)}
              className="px-4 py-2 border border-slate-200 text-sm font-medium rounded-lg text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={savePartner}
              disabled={loading}
              className="px-5 py-2 text-sm font-medium rounded-lg text-white bg-slate-900 hover:bg-slate-800 transition disabled:opacity-50"
            >
              {loading ? "Saving Config..." : "Verify & Issue Policy"}
            </button>
          </div>
        </div>
      )}

      {/* 2. Inbound Data Exchange center */}
      {activeSubTab === "exchange" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left sidebar upload box */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
              <h3 className="text-sm font-medium text-slate-900 border-b pb-2">
                Initiate Inbound Transmission
              </h3>

              <div className="space-y-3">
                <label className="block text-xs font-medium text-slate-600">Select Active Partner</label>
                <select
                  value={selectedPartnerId}
                  onChange={(e) => setSelectedPartnerId(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50"
                >
                  <option value="">-- Select Partner --</option>
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Payload Format</label>
                  <select
                    value={selectedFormat}
                    onChange={(e) => setSelectedFormat(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50/50"
                  >
                    <option value="CSV">CSV Document</option>
                    <option value="JSON">JSON Stream</option>
                    <option value="XML">XML Document</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Source Intermediary</label>
                  <div className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-100 font-mono text-slate-600">
                    SMRITI Gateway Secure-Ingress
                  </div>
                </div>
              </div>

              {/* Sandbox Template quick trigger for easier audit testing */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1">
                  <Sliders className="h-3 w-3" /> Sandbox Quick Load
                </span>
                <p className="text-xs text-slate-500">
                  Select a preloaded testing payload containing clean & faulty rows to trace mapping and instant corrections:
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => loadTestingTemplate("reliance")}
                    className="w-full text-left text-xs bg-white hover:bg-blue-50/50 border border-slate-200 px-3 py-2 rounded-lg flex items-center justify-between text-slate-700 hover:text-blue-700 transition"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                      <span>Reliance Daily Sales (CSV)</span>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => loadTestingTemplate("smarttech")}
                    className="w-full text-left text-xs bg-white hover:bg-emerald-50/50 border border-slate-200 px-3 py-2 rounded-lg flex items-center justify-between text-slate-700 hover:text-emerald-700 transition"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Franchise Store Sales (JSON)</span>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Validation output and interactive live grid */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
              <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-slate-900">
                    Live Field Mapping & Validation Pipeline
                  </h3>
                  <p className="text-xs text-slate-500">
                    Interactive sandbox. Update data inline directly inside table cells to resolve warnings before syncing.
                  </p>
                </div>
                {validationResult && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono text-slate-400">
                      Checksum: {validationResult.checksum.slice(0, 15)}...
                    </span>
                  </div>
                )}
              </div>

              {!validationResult ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3 bg-slate-50/50">
                  <div className="p-4 bg-white rounded-full border border-slate-200 shadow-sm">
                    <Upload className="h-6 w-6 text-slate-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-0.5">No Transmission Loaded</h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Select a partner and click a "Sandbox Quick Load" template above to load test payloads instantly.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-between">
                  {/* Validation stats banner */}
                  <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-4">
                      <span className="text-slate-500 font-medium">
                        Total Rows: <strong className="text-slate-800">{validationResult.rowCount}</strong>
                      </span>
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
                        <CheckCircle className="h-3.5 w-3.5" /> Approved / Valid: {validationResult.successCount}
                      </span>
                      <span className="inline-flex items-center gap-1 text-red-700 font-semibold bg-red-50 border border-red-200 rounded px-2 py-0.5">
                        <XCircle className="h-3.5 w-3.5" /> Faulty Warnings: {validationResult.errorCount}
                      </span>
                    </div>

                    {validationResult.errorCount > 0 && (
                      <span className="text-amber-600 font-medium flex items-center gap-1 animate-pulse">
                        <AlertTriangle className="h-3.5 w-3.5" /> Correct faulty rows below to unlock queue!
                      </span>
                    )}
                  </div>

                  {/* Interactive Editable Preview Grid */}
                  <div className="flex-1 overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                          <th className="p-3 w-12 text-center">Row</th>
                          {Object.keys(rawRows[0] || {}).map((col) => (
                            <th key={col} className="p-3">
                              <div className="flex flex-col">
                                <span className="font-mono text-slate-700">{col}</span>
                                <span className="text-[9px] text-blue-600 uppercase font-bold tracking-wider">
                                  ↓ maps to: {DEMO_MAPPINGS[selectedPartnerId]?.[col] || "Unmapped"}
                                </span>
                              </div>
                            </th>
                          ))}
                          <th className="p-3 text-right">Pipeline Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validationResult.rows.map((row, rowIdx) => {
                          const isError = !!row.__error;
                          return (
                            <tr 
                              key={rowIdx} 
                              className={`border-b border-slate-100 ${
                                isError ? "bg-red-50/20 hover:bg-red-50/40" : "hover:bg-slate-50/50"
                              }`}
                            >
                              <td className="p-3 text-center text-slate-400 font-mono">{rowIdx + 1}</td>
                              {Object.entries(rawRows[rowIdx] || {}).map(([col, val]: any) => (
                                <td key={col} className="p-2 min-w-[120px]">
                                  <input
                                    type="text"
                                    value={val}
                                    onChange={(e) => handleCellEdit(rowIdx, col, e.target.value)}
                                    className={`w-full bg-transparent border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                                      isError && col === "Sales Qty" && parseFloat(val) < 0 
                                        ? "border-red-400 bg-red-50/40 text-red-700"
                                        : isError && col === "Item Code" && val === "SKU-UNKNOWN-99"
                                        ? "border-red-400 bg-red-50/40 text-red-700"
                                        : isError && col === "Barcode Code" && !val
                                        ? "border-red-400 bg-red-50/40"
                                        : "border-transparent hover:border-slate-300 focus:bg-white text-slate-800"
                                    }`}
                                  />
                                </td>
                              ))}
                              <td className="p-3 text-right">
                                {row.__error ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-700 border border-red-200" title={row.__error}>
                                    <AlertTriangle className="h-3 w-3" /> Error
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <Check className="h-3 w-3" /> Validated
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Detail error log if any */}
                  {validationResult.errorCount > 0 && (
                    <div className="p-4 bg-rose-50/50 border-t border-rose-100 max-h-[140px] overflow-y-auto">
                      <div className="text-xs font-semibold text-rose-800 mb-1">
                        Active Validation Warnings ({validationResult.errorCount})
                      </div>
                      <div className="space-y-1">
                        {validationResult.errors.map((err, idx) => (
                          <div key={idx} className="text-[11px] text-rose-700 flex items-center gap-1 font-mono">
                            <span className="font-bold">Row {err.row}, Column [{err.column}]:</span> {err.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions footer */}
                  <div className="bg-slate-50 px-5 py-4 border-t border-slate-200 flex justify-between items-center">
                    <button
                      onClick={() => { setValidationResult(null); setRawRows([]); }}
                      className="px-4 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 text-xs font-medium"
                    >
                      Clear Batch
                    </button>

                    <div className="flex gap-2">
                      <button
                        onClick={() => triggerValidate(rawRows, selectedPartnerId)}
                        className="px-4 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Re-Validate
                      </button>
                      <button
                        onClick={commitImport}
                        disabled={validationResult.errorCount > 0}
                        className="px-5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 disabled:opacity-40 transition flex items-center gap-1"
                      >
                        <CheckSquare className="h-4 w-4" /> Dispatched to Ledger Queue
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Inbound Approval Queue */}
      {activeSubTab === "approvals" && (
        <div className="space-y-6">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex gap-3 text-xs text-slate-600">
            <Shield className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="text-slate-800">Mall Consignment Verification Mode:</strong> 
              <p className="mt-0.5">
                Under MALL rules, validated daily sales files are locked in the approval queue to prevent unauthorized inventory ledger updates or incorrect Tally exports. As a Manager, you must authorize releasing the validated transactions.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <h3 className="text-sm font-medium text-slate-900">
                Pending Manager Approvals
              </h3>
            </div>

            {logs.filter(l => l.status === "Pending Approval").length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <CheckCircle className="h-8 w-8 text-slate-300 mx-auto" />
                <h4 className="text-sm font-medium text-slate-700">Approval Queue Empty</h4>
                <p className="text-xs text-slate-400">All inbound transactions have been synchronized.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {logs.filter(l => l.status === "Pending Approval").map((log) => (
                  <div key={log.id} className="p-5 hover:bg-slate-50/50 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded">
                          {log.status}
                        </span>
                        <h4 className="text-sm font-medium text-slate-900">
                          {log.fileName}
                        </h4>
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs text-slate-500 font-mono">
                        <span>Partner: <strong className="text-slate-800">{log.partnerName}</strong></span>
                        <span>Loaded: {new Date(log.timestamp).toLocaleString()}</span>
                        <span>Rows: {log.rowCount} (Success: {log.successCount}, Warnings: {log.errorCount})</span>
                      </div>
                      <div className="text-xs text-slate-400 font-mono">
                        Checksum SHA-256: {log.checksum}
                      </div>

                      {/* Show detail rows for transparency */}
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mt-2 max-w-xl">
                        <span className="text-[10px] text-slate-400 font-mono uppercase font-bold tracking-wide">
                          Mapped Data Preview
                        </span>
                        <div className="space-y-1 mt-1 font-mono text-[11px] text-slate-600">
                          {log.rowsData?.slice(0, 3).map((r, i) => (
                            <div key={i} className="truncate">
                              SKU: {r.__mapped?.sku || r["Item Code"]} | Qty: {r.__mapped?.quantity || r["Sales Qty"]} | MRP: {r.__mapped?.mrp || r["MRP Price"]} | Store: {r.__mapped?.storeId || r["Branch Code"]}
                            </div>
                          ))}
                          {log.rowsData?.length > 3 && (
                            <div className="text-[10px] text-slate-400">...and {log.rowsData.length - 3} more records</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => approveLog(log.id)}
                        disabled={loading}
                        className="px-4 py-2 bg-slate-950 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition shadow-sm flex items-center gap-1"
                      >
                        <Check className="h-3.5 w-3.5" /> Approve & Update Ledgers
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Security Audit Logs & Traceability */}
      {activeSubTab === "logs" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <h3 className="text-sm font-medium text-slate-900">
                Data Exchange & Synchronization Log
              </h3>
              <p className="text-xs text-slate-500">
                Fully traceable operational event flow: Inbound File &rarr; Validation &rarr; Ledgers &rarr; Tally Queue.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                    <th className="p-3">Reference ID</th>
                    <th className="p-3">Partner Name</th>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Direction</th>
                    <th className="p-3">Filename</th>
                    <th className="p-3 text-center">Batch Size</th>
                    <th className="p-3 text-center">Failure Rate</th>
                    <th className="p-3">Operator</th>
                    <th className="p-3">Approver</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-3 font-mono font-bold text-slate-700">{log.id}</td>
                      <td className="p-3 font-medium text-slate-800">{log.partnerName}</td>
                      <td className="p-3 text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="p-3">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          log.direction === "Inbound" 
                            ? "bg-blue-50 text-blue-700 border border-blue-200" 
                            : "bg-purple-50 text-purple-700 border border-purple-200"
                        }`}>
                          {log.direction}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-600 truncate max-w-[150px]" title={log.fileName}>
                        {log.fileName}
                      </td>
                      <td className="p-3 text-center text-slate-800 font-mono">{log.rowCount} rows</td>
                      <td className="p-3 text-center font-mono">
                        {log.errorCount > 0 ? (
                          <span className="text-red-600 font-bold">{((log.errorCount / log.rowCount) * 100).toFixed(0)}% ({log.errorCount})</span>
                        ) : (
                          <span className="text-emerald-600">0%</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-600">{log.importedBy}</td>
                      <td className="p-3 text-slate-600">{log.approvedBy}</td>
                      <td className="p-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          log.status === "Success"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            : log.status === "Pending Approval"
                            ? "bg-amber-50 text-amber-700 border border-amber-100"
                            : "bg-red-50 text-red-700 border border-red-100"
                        }`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
