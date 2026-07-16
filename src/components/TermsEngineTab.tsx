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
import { motion, AnimatePresence } from "motion/react";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";
import {
  Gavel,
  BookOpen,
  Settings,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Edit,
  Trash2,
  HelpCircle,
  ArrowRight,
  RefreshCw,
  Eye,
  Languages,
  ShieldCheck,
  Download,
  History,
  FileSignature,
  FileCode,
  AlertTriangle
} from "lucide-react";

interface Clause {
  id: string;
  code: string;
  title: string;
  category: string;
  content: string;
  isActive: boolean;
  version: number;
  lastUpdated: string;
  updatedBy: string;
  status: "Draft" | "Pending Approval" | "Approved" | "Archived";
  language: string;
}

interface DefaultConfig {
  id: string;
  level: "Company" | "Branch" | "Document" | "Customer" | "Supplier";
  refId: string;
  clauseIds: string[];
  isActive: boolean;
  lastUpdated: string;
  updatedBy: string;
}

interface ApprovalLog {
  id: string;
  clauseId: string;
  title: string;
  version: number;
  submittedBy: string;
  submittedAt: string;
  status: "Pending" | "Approved" | "Rejected";
  approvedBy: string;
  approvedAt: string;
  proposedChanges?: {
    title: string;
    content: string;
    category: string;
  };
  comments: string;
}

interface Snapshot {
  id: string;
  documentType: string;
  documentNo: string;
  snapshotAt: string;
  clausesSnapshot: {
    category: string;
    title: string;
    content: string;
    order: number;
  }[];
}

export const TermsEngineTab: React.FC = () => {
  // Navigation tabs within terms engine
  const [activeSubTab, setActiveSubTab] = useState<"library" | "inheritance" | "sandbox" | "approvals" | "snapshots">("library");

  // Core lists
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [defaults, setDefaults] = useState<DefaultConfig[]>([]);
  const [approvalLogs, setApprovalLogs] = useState<ApprovalLog[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Search and Filters
  const [libraryFilter, setLibraryFilter] = useState<string>("All");
  const [librarySearch, setLibrarySearch] = useState<string>("");

  // Sandbox resolution variables
  const [sandboxCompany, setSandboxCompany] = useState<string>("SMRITI_IND");
  const [sandboxBranch, setSandboxBranch] = useState<string>("MUM");
  const [sandboxDocType, setSandboxDocType] = useState<string>("Retail Invoice");
  const [sandboxPartyId, setSandboxPartyId] = useState<string>("P001");
  const [sandboxVariables, setSandboxVariables] = useState({
    InvoiceNo: "INV/26-27/MUM/009412",
    CustomerName: "Mahanagar Traders Ltd",
    Store: "SMRITI Mumbai Premium Hub",
    Amount: "INR 1,84,500.00",
    DueDate: "30-August-2026",
    Date: "10-July-2026"
  });

  const [resolvedPreview, setResolvedPreview] = useState<{
    resolvedList: any[];
    inheritanceTrace: any;
  } | null>(null);

  // Form states
  const [editingClause, setEditingClause] = useState<Clause | null>(null);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [formCategory, setFormCategory] = useState<string>("Payment");
  const [formTitle, setFormTitle] = useState<string>("");
  const [formCode, setFormCode] = useState<string>("");
  const [formContent, setFormContent] = useState<string>("");
  const [formLanguage, setFormLanguage] = useState<string>("English");
  const [formSubmitApproval, setFormSubmitApproval] = useState<boolean>(false);
  const [formComments, setFormComments] = useState<string>("");

  // Quick audit/approval notes
  const [auditNotes, setAuditNotes] = useState<string>("");

  // Default Mapper Modal / Form State
  const [isDefaultFormOpen, setIsDefaultFormOpen] = useState<boolean>(false);
  const [mapLevel, setMapLevel] = useState<"Company" | "Branch" | "Document" | "Customer" | "Supplier">("Company");
  const [mapRefId, setMapRefId] = useState<string>("");
  const [mapSelectedClauses, setMapSelectedClauses] = useState<string[]>([]);

  // Categories list
  const CATEGORIES = [
    "Payment",
    "Delivery",
    "Warranty",
    "Returns",
    "Taxes",
    "Ownership",
    "Risk",
    "Installation",
    "Jurisdiction",
    "Packaging",
    "Transport"
  ];

  // Industry Preset Templates
  const INDUSTRY_PRESETS = [
    {
      name: "Standard B2C Retail",
      description: "Optimized for quick counter sales, 7-day returns, and spot payment models.",
      clauses: [
        { title: "Standard Counter Sales Return Policy", category: "Returns", code: "RET-B2C", content: "Unopened goods in original box can be returned or exchanged within 7 days. Receipt {InvoiceNo} is mandatory." },
        { title: "Point of Sale Immediate Settling", category: "Payment", code: "PAY-B2C", content: "Cash, Card or Digital UPI payment is settled immediately at terminal {Store}. Possession of goods is transferred upon billing receipt validation." },
        { title: "B2C Consumer Protection Jurisdiction", category: "Jurisdiction", code: "JUR-B2C", content: "All disputes under this sale are governed strictly under consumer dispute forums in the state of {Branch}." }
      ]
    },
    {
      name: "Wholesale Procurement (B2B)",
      description: "Geared for large distributor shipments, Net-30 credit terms, and freight on board delivery.",
      clauses: [
        { title: "B2B Net 30 Post Credit Interest", category: "Payment", code: "PAY-B2B", content: "Payment must be wired to the bank within 30 days. Late settlement incurs simple interest calculated at 2% simple monthly rate starting from {DueDate}." },
        { title: "FOB Origin Logistics", category: "Transport", code: "TRA-FOB-B2B", content: "Consignments are loaded FOB origin from {Store}. All transport risks are fully assumed by {CustomerName} post dispatch gatepass validation." },
        { title: "Commercial Tax Declaration Guarantee", category: "Taxes", code: "TAX-GST-B2B", content: "Recipient {CustomerName} guarantees active status of GSTIN. Any input tax credit losses due to filing delays must be indemnified fully by the buyer." }
      ]
    },
    {
      name: "High-Value Consumer Electronics",
      description: "Extended warranty, strict serial tracking, and zero clearance return rules.",
      clauses: [
        { title: "Extended Electronic Structural Warranty", category: "Warranty", code: "WAR-EL-PRE", content: "Provides limited local repair warranty of 1 Year on circuit parts. Does not cover screen cracks or external voltage burn damage." },
        { title: "Special Electronic Return & Exchange Restocking Fee", category: "Returns", code: "RET-EL", content: "Electronics opened from sealed packaging can only be returned if dead on arrival. Restocking fees of 15% apply if box seal is broken." },
        { title: "Device Ownership Clause", category: "Ownership", code: "OWN-DEVICE", content: "Title of electronic equipment remains exclusively with SMRITI until full payment {Amount} is confirmed by merchant bank clearings." }
      ]
    }
  ];

  // Load everything
  const fetchData = async () => {
    setLoading(true);
    try {
      const [cRes, dRes, lRes, sRes] = await Promise.all([
        apiFetchV1("/terms/clauses"),
        apiFetchV1("/terms/defaults"),
        apiFetchV1("/terms/logs"),
        apiFetchV1("/terms/snapshots")
      ]);

      setClauses(cRes);
      setDefaults(dRes);
      setApprovalLogs(lRes);
      setSnapshots(sRes);
    } catch (e) {
      console.error("Error loading Terms Engine data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Sandbox live preview resolver
  const runSandboxPreview = async () => {
    try {
      const resolved = await apiFetchV1("/terms/resolve", {
        method: "POST",
        body: JSON.stringify({
          companyCode: sandboxCompany,
          branchCode: sandboxBranch,
          documentType: sandboxDocType,
          partyId: sandboxPartyId,
          variables: sandboxVariables
        })
      });
      setResolvedPreview(resolved);
    } catch (e) {
      console.error("Failed to run sandbox resolve", e);
    }
  };

  useEffect(() => {
    runSandboxPreview();
  }, [sandboxCompany, sandboxBranch, sandboxDocType, sandboxPartyId, sandboxVariables, clauses, defaults]);

  // Handle Create/Update Clause
  const handleSaveClause = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formContent) return;

    const payload = {
      code: formCode || `CL-${formCategory.substring(0,3).toUpperCase()}-${Date.now().toString().slice(-4)}`,
      title: formTitle,
      category: formCategory,
      content: formContent,
      language: formLanguage,
      submitForApproval: formSubmitApproval,
      comments: formComments,
      status: formSubmitApproval ? "Pending Approval" : "Approved"
    };

    try {
      let url = "/terms/clauses";
      let method = "POST";

      if (editingClause) {
        url = `/terms/clauses/${editingClause.id}`;
        method = "PUT";
      }

      await apiFetchV1(url, {
        method,
        body: JSON.stringify(payload)
      });

      setIsFormOpen(false);
      setEditingClause(null);
      setFormTitle("");
      setFormCode("");
      setFormContent("");
      setFormComments("");
      setFormSubmitApproval(false);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // Approval actions
  const handleApprove = async (id: string) => {
    try {
      await apiFetchV1(`/terms/clauses/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ comments: auditNotes || "Meets corporate compliance guidelines." })
      });
      setAuditNotes("");
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await apiFetchV1(`/terms/clauses/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ comments: auditNotes || "Rejected due to syntax inaccuracy." })
      });
      setAuditNotes("");
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // Seed Presets
  const handleImportPreset = async (presetIdx: number) => {
    const selected = INDUSTRY_PRESETS[presetIdx];
    try {
      for (const cl of selected.clauses) {
        await apiFetchV1("/terms/clauses", {
          method: "POST",
          body: JSON.stringify({
            title: cl.title,
            category: cl.category,
            code: cl.code,
            content: cl.content,
            isActive: true,
            status: "Approved",
            language: "English"
          })
        });
      }
      fetchData();
    } catch (e) {
      console.error("Failed to seed industry preset", e);
    }
  };

  // Add/Modify Defaults Config Mapping
  const handleSaveDefaultMap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapRefId || mapSelectedClauses.length === 0) return;

    try {
      await apiFetchV1("/terms/defaults", {
        method: "POST",
        body: JSON.stringify({
          level: mapLevel,
          refId: mapRefId,
          clauseIds: mapSelectedClauses,
          isActive: true
        })
      });

      setIsDefaultFormOpen(false);
      setMapRefId("");
      setMapSelectedClauses([]);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // Filter clauses for rendering
  const filteredClauses = clauses.filter(c => {
    const matchesCat = libraryFilter === "All" || c.category === libraryFilter;
    const matchesSearch = c.title.toLowerCase().includes(librarySearch.toLowerCase()) || 
                          c.content.toLowerCase().includes(librarySearch.toLowerCase()) ||
                          c.code.toLowerCase().includes(librarySearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="w-full h-full bg-slate-900 text-slate-100 flex flex-col overflow-hidden" id="terms-engine-main-container">
      {/* Module Title Banner */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex flex-col md:flex-row md:items-center md:justify-between shrink-0" id="terms-header-banner">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <Gavel className="w-5 h-5 animate-pulse" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-white font-display">Terms & Conditions (T&C) Engine</h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Legal compliance & centralized clause compiler. Supports category inheritance ladder, version control, and dynamic field substitutions.
          </p>
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center space-x-3 mt-3 md:mt-0" id="terms-global-toolbar">
          <button
            onClick={fetchData}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
            title="Refresh Data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload</span>
          </button>
          <button
            onClick={() => {
              setEditingClause(null);
              setFormTitle("");
              setFormCode("");
              setFormContent("");
              setFormCategory("Payment");
              setFormLanguage("English");
              setFormSubmitApproval(false);
              setIsFormOpen(true);
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition shadow-md shadow-indigo-600/10"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Draft New Clause</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="px-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0" id="terms-sub-nav">
        <div className="flex space-x-1 overflow-x-auto py-1 scrollbar-none">
          <button
            onClick={() => setActiveSubTab("library")}
            className={`px-3 py-3 text-xs font-semibold border-b-2 transition flex items-center space-x-1.5 ${
              activeSubTab === "library"
                ? "border-indigo-500 text-indigo-400 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Clause Library</span>
            <span className="ml-1 bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-400 font-normal">{clauses.length}</span>
          </button>

          <button
            onClick={() => setActiveSubTab("inheritance")}
            className={`px-3 py-3 text-xs font-semibold border-b-2 transition flex items-center space-x-1.5 ${
              activeSubTab === "inheritance"
                ? "border-indigo-500 text-indigo-400 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Inheritance Ladder</span>
          </button>

          <button
            onClick={() => setActiveSubTab("sandbox")}
            className={`px-3 py-3 text-xs font-semibold border-b-2 transition flex items-center space-x-1.5 ${
              activeSubTab === "sandbox"
                ? "border-indigo-500 text-indigo-400 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Resolution Sandbox</span>
          </button>

          <button
            onClick={() => setActiveSubTab("approvals")}
            className={`px-3 py-3 text-xs font-semibold border-b-2 transition flex items-center space-x-1.5 ${
              activeSubTab === "approvals"
                ? "border-indigo-500 text-indigo-400 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Regulatory Approvals</span>
            {approvalLogs.filter(l => l.status === "Pending").length > 0 && (
              <span className="bg-amber-500/10 text-amber-400 px-1.5 py-0.2 rounded-full text-[9px] font-bold border border-amber-500/20">
                {approvalLogs.filter(l => l.status === "Pending").length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab("snapshots")}
            className={`px-3 py-3 text-xs font-semibold border-b-2 transition flex items-center space-x-1.5 ${
              activeSubTab === "snapshots"
                ? "border-indigo-500 text-indigo-400 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Historical Snapshots</span>
          </button>
        </div>

        <div className="hidden lg:flex items-center text-[11px] text-slate-400 font-mono space-x-4">
          <span className="flex items-center space-x-1">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
            <span>Policy Status: Active</span>
          </span>
          <span>Version Lock: v2.4.1</span>
        </div>
      </div>

      {/* Main Container Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-900" id="terms-main-viewport">
        
        {/* SUBTAB 1: CLAUSE LIBRARY */}
        {activeSubTab === "library" && (
          <div className="space-y-6" id="subtab-library-root">
            {/* Seed presets advice */}
            {clauses.length === 0 && (
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-white">Clause Library Empty</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      No active terms or conditions found in the compiler database. Kickstart your SMRITI compliance system setup by loading one of the pre-drafted legal presets below.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  {INDUSTRY_PRESETS.map((preset, idx) => (
                    <div key={idx} className="bg-slate-900 border border-slate-800 p-3 rounded-lg hover:border-indigo-500/50 transition flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center space-x-1">
                          <FileSignature className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{preset.name}</span>
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{preset.description}</p>
                      </div>
                      <button
                        onClick={() => handleImportPreset(idx)}
                        className="mt-3 w-full bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/20 text-[11px] py-1 rounded transition text-center"
                      >
                        Load Preset Clauses
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Presets Utility (always accessible for demo/setup) */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start space-x-3">
                <FileSignature className="w-5 h-5 text-indigo-400 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-white">Load Industry Templates</h3>
                  <p className="text-[11px] text-slate-400">Import structured standards for Retail, B2B, and high-value electronics into your active library list.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {INDUSTRY_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleImportPreset(idx)}
                    className="bg-slate-800 hover:bg-indigo-600 hover:text-white border border-slate-700 text-[10px] px-2.5 py-1.5 rounded-lg transition"
                  >
                    + {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Controls Filter Bar */}
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-2.5 text-slate-500 text-xs material-symbols-outlined">search</span>
                <input
                  type="text"
                  placeholder="Search title, code, or content..."
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-indigo-500 text-slate-100 placeholder-slate-500"
                />
              </div>

              {/* Categories horizontally */}
              <div className="flex items-center space-x-1.5 overflow-x-auto py-1 scrollbar-none">
                <button
                  onClick={() => setLibraryFilter("All")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0 ${
                    libraryFilter === "All"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  All Categories
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setLibraryFilter(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0 ${
                      libraryFilter === cat
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Clause Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {filteredClauses.map((clause) => (
                <div
                  key={clause.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          {clause.category}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {clause.code}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="flex items-center space-x-1 text-slate-400 text-[10px]">
                          <Languages className="w-3 h-3" />
                          <span>{clause.language}</span>
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          clause.status === "Approved"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : clause.status === "Pending Approval"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-slate-800 text-slate-400"
                        }`}>
                          {clause.status}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-sm font-bold text-white mt-3">{clause.title}</h3>
                    <div className="mt-2 bg-slate-900 border border-slate-800/60 p-3 rounded-lg text-xs text-slate-300 leading-relaxed font-mono select-all">
                      {clause.content}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/50 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>v{clause.version} • {new Date(clause.lastUpdated).toLocaleDateString()} by {clause.updatedBy}</span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => {
                          setEditingClause(clause);
                          setFormTitle(clause.title);
                          setFormCode(clause.code);
                          setFormContent(clause.content);
                          setFormCategory(clause.category);
                          setFormLanguage(clause.language);
                          setFormSubmitApproval(false);
                          setIsFormOpen(true);
                        }}
                        className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-indigo-400 transition"
                        title="Edit Clause"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {filteredClauses.length === 0 && (
                <div className="col-span-full py-12 text-center bg-slate-950 border border-slate-800 rounded-xl">
                  <p className="text-slate-400 text-xs">No clauses found matching your filter parameters.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SUBTAB 2: INHERITANCE MAPPER */}
        {activeSubTab === "inheritance" && (
          <div className="space-y-6" id="subtab-inheritance-root">
            {/* Visual Priority Explanation Card */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Priority Inheritance Ladder (Precedence Mechanics)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                When generating printable vouchers or invoices, SMRITI checks multiple mapping defaults. The system overlays terms based on specificity. Below is the active precedence chain, starting from the baseline and scaling to specific Customer or Supplier overrides.
              </p>

              {/* Graphical Ladder */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-4 relative">
                <div className="bg-indigo-950/20 border border-indigo-500/15 p-3 rounded-lg text-center flex flex-col justify-between">
                  <span className="text-[10px] text-indigo-400 font-mono">STEP 1 (Baseline)</span>
                  <h4 className="text-xs font-bold text-white mt-1">Company Defaults</h4>
                  <p className="text-[10px] text-slate-400 mt-1">Global backup defaults applied corporate-wide</p>
                </div>

                <div className="bg-slate-950 p-3 text-center flex items-center justify-center text-slate-600 hidden md:flex">
                  <ArrowRight className="w-5 h-5" />
                </div>

                <div className="bg-indigo-950/30 border border-indigo-500/25 p-3 rounded-lg text-center flex flex-col justify-between">
                  <span className="text-[10px] text-indigo-400 font-mono">STEP 2</span>
                  <h4 className="text-xs font-bold text-white mt-1">Branch Specific</h4>
                  <p className="text-[10px] text-slate-400 mt-1">Overrides Company defaults for specific warehouses</p>
                </div>

                <div className="bg-slate-950 p-3 text-center flex items-center justify-center text-slate-600 hidden md:flex">
                  <ArrowRight className="w-5 h-5" />
                </div>

                <div className="bg-indigo-950/40 border border-indigo-500/35 p-3 rounded-lg text-center flex flex-col justify-between">
                  <span className="text-[10px] text-indigo-400 font-mono">STEP 3</span>
                  <h4 className="text-xs font-bold text-white mt-1">Document Type</h4>
                  <p className="text-[10px] text-slate-400 mt-1">Customizes terms for Quotations vs Retail Bills</p>
                </div>

                <div className="bg-slate-950 p-3 text-center flex items-center justify-center text-slate-600 hidden md:flex md:col-start-2">
                  <ArrowRight className="w-5 h-5" />
                </div>

                <div className="bg-indigo-950/50 border border-indigo-400/50 p-3 rounded-lg text-center flex flex-col justify-between md:col-start-3">
                  <span className="text-[10px] text-indigo-400 font-mono">STEP 4</span>
                  <h4 className="text-xs font-bold text-white mt-1">Customer / Supplier</h4>
                  <p className="text-[10px] text-slate-400 mt-1">VIP trade overrides for dedicated corporate parties</p>
                </div>

                <div className="bg-slate-950 p-3 text-center flex items-center justify-center text-slate-600 hidden md:flex">
                  <ArrowRight className="w-5 h-5" />
                </div>

                <div className="bg-emerald-950/30 border border-emerald-500/30 p-3 rounded-lg text-center flex flex-col justify-between">
                  <span className="text-[10px] text-emerald-400 font-mono">STEP 5 (Absolute)</span>
                  <h4 className="text-xs font-bold text-emerald-300 mt-1">Manual Override</h4>
                  <p className="text-[10px] text-slate-400 mt-1">Direct cashier edits at the exact billing screen</p>
                </div>
              </div>
            </div>

            {/* Configured Defaults Section */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Active Mapping Presets</h3>
              <button
                onClick={() => {
                  setMapSelectedClauses([]);
                  setMapRefId("");
                  setIsDefaultFormOpen(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-xs text-white px-3 py-1.5 rounded-lg font-medium transition"
              >
                + Define Default Set
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {defaults.map((def) => (
                <div key={def.id} className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        def.level === "Company" ? "bg-blue-500/15 text-blue-400 border border-blue-500/30" :
                        def.level === "Branch" ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" :
                        def.level === "Document" ? "bg-purple-500/15 text-purple-400 border border-purple-500/30" :
                        "bg-teal-500/15 text-teal-400 border border-teal-500/30"
                      }`}>
                        {def.level} Specific
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-300">Ref: {def.refId}</span>
                    </div>

                    {/* Active Clauses assigned */}
                    <div className="mt-4 space-y-2">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Associated Clauses ({def.clauseIds.length})</span>
                      <div className="space-y-1.5">
                        {def.clauseIds.map((cId) => {
                          const cl = clauses.find(c => c.id === cId);
                          return (
                            <div key={cId} className="flex items-center justify-between bg-slate-900 border border-slate-800/80 px-2.5 py-1.5 rounded-lg text-xs">
                              <span className="font-medium text-slate-300">{cl ? cl.title : cId}</span>
                              <span className="text-[10px] text-slate-500 font-mono">{cl ? cl.code : "N/A"}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-850 flex items-center justify-between text-[10px] text-slate-500">
                    <span>Last modified: {new Date(def.lastUpdated).toLocaleDateString()}</span>
                    <span>By: {def.updatedBy}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUBTAB 3: RESOLUTION SANDBOX */}
        {activeSubTab === "sandbox" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="subtab-sandbox-root">
            {/* Context Inputs Column */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                <FileCode className="w-4 h-4 text-indigo-400" />
                <span>Compiler Context Simulator</span>
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Alter variables to simulate how SMRITI resolves the inheritance ladder and translates templates at the time of print.
              </p>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] text-slate-400 font-bold uppercase mb-1">Company Code</label>
                  <select
                    value={sandboxCompany}
                    onChange={(e) => setSandboxCompany(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="SMRITI_IND">SMRITI India Operations Ltd (SMRITI_IND)</option>
                    <option value="SMRITI_US">SMRITI International LLC (SMRITI_US)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 font-bold uppercase mb-1">Warehouse / Branch</label>
                  <select
                    value={sandboxBranch}
                    onChange={(e) => setSandboxBranch(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="MUM">Mumbai Prem Warehouse (MUM)</option>
                    <option value="DEL">Delhi Terminal Store (DEL)</option>
                    <option value="BLR">Bangalore Tech Depo (BLR)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 font-bold uppercase mb-1">Document Type</label>
                  <select
                    value={sandboxDocType}
                    onChange={(e) => setSandboxDocType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Retail Invoice">Retail Invoice</option>
                    <option value="Quotation">Quotation</option>
                    <option value="Sales Order">Sales Order</option>
                    <option value="Purchase Order">Purchase Order</option>
                    <option value="Goods Received Note">Goods Received Note</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 font-bold uppercase mb-1">Customer / Supplier Code</label>
                  <select
                    value={sandboxPartyId}
                    onChange={(e) => setSandboxPartyId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="P001">VIP Dealer: Mahanagar Traders (P001)</option>
                    <option value="P002">Walk-In Standard Retail (P002)</option>
                    <option value="SUP-01">Wholesale Electronics Sourcing (SUP-01)</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Variables Form */}
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <span className="text-[10px] text-indigo-400 font-mono uppercase font-bold">Substitute Dynamic Placeholders</span>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] text-slate-500 font-bold uppercase">Invoice No</label>
                    <input
                      type="text"
                      value={sandboxVariables.InvoiceNo}
                      onChange={(e) => setSandboxVariables({...sandboxVariables, InvoiceNo: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs focus:outline-none text-slate-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-500 font-bold uppercase">Customer Name</label>
                    <input
                      type="text"
                      value={sandboxVariables.CustomerName}
                      onChange={(e) => setSandboxVariables({...sandboxVariables, CustomerName: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs focus:outline-none text-slate-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] text-slate-500 font-bold uppercase">Store / Depot</label>
                    <input
                      type="text"
                      value={sandboxVariables.Store}
                      onChange={(e) => setSandboxVariables({...sandboxVariables, Store: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs focus:outline-none text-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-500 font-bold uppercase">Total Amount</label>
                    <input
                      type="text"
                      value={sandboxVariables.Amount}
                      onChange={(e) => setSandboxVariables({...sandboxVariables, Amount: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs focus:outline-none text-slate-300 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] text-slate-500 font-bold uppercase">Due Date</label>
                    <input
                      type="text"
                      value={sandboxVariables.DueDate}
                      onChange={(e) => setSandboxVariables({...sandboxVariables, DueDate: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs focus:outline-none text-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-500 font-bold uppercase">Voucher Date</label>
                    <input
                      type="text"
                      value={sandboxVariables.Date}
                      onChange={(e) => setSandboxVariables({...sandboxVariables, Date: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs focus:outline-none text-slate-300"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Resolved Preview and Inheritance Trace Columns */}
            <div className="lg:col-span-2 space-y-4">
              {resolvedPreview && (
                <>
                  {/* Inheritance trace debug bar */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                    <span className="text-[10px] font-mono text-indigo-400 font-bold block uppercase tracking-wider mb-2">Resolution Audit Trace</span>
                    <div className="flex flex-wrap items-center gap-3">
                      {resolvedPreview.inheritanceTrace?.levels?.map((lvl: any, idx: number) => (
                        <div key={idx} className="flex items-center space-x-1.5 text-xs bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                          <span className={`w-2 h-2 rounded-full ${lvl.active ? "bg-emerald-500" : "bg-slate-700"}`}></span>
                          <span className="text-slate-400 font-medium">{lvl.level}:</span>
                          <span className="text-slate-200 font-mono">{lvl.active ? `${lvl.count} active clauses` : "None"}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Interactive Printable Voucher Preview Box */}
                  <div className="bg-white text-slate-900 rounded-xl shadow-2xl p-8 border border-slate-300 font-sans min-h-[400px] flex flex-col justify-between">
                    {/* Fake Document Header */}
                    <div>
                      <div className="flex justify-between items-start border-b pb-4">
                        <div>
                          <h2 className="text-xl font-black text-indigo-950 uppercase tracking-tight">{sandboxDocType}</h2>
                          <p className="text-[11px] text-slate-500 font-mono mt-1">SMRITI Ledger Reference Voucher</p>
                        </div>
                        <div className="text-right text-xs">
                          <p className="font-bold">Doc No: <span className="font-mono text-indigo-600">{sandboxVariables.InvoiceNo}</span></p>
                          <p className="text-slate-500 mt-1">Date: {sandboxVariables.Date}</p>
                        </div>
                      </div>

                      {/* Client information */}
                      <div className="grid grid-cols-2 gap-4 py-4 text-xs">
                        <div>
                          <p className="text-slate-400 uppercase font-bold text-[9px] tracking-wider">Billed To</p>
                          <p className="font-bold text-slate-800 mt-0.5">{sandboxVariables.CustomerName}</p>
                          <p className="text-slate-500 font-mono text-[10px] mt-0.5">Party Ref: {sandboxPartyId}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-slate-400 uppercase font-bold text-[9px] tracking-wider">Point of Origin</p>
                          <p className="font-bold text-slate-800 mt-0.5">{sandboxVariables.Store}</p>
                          <p className="text-slate-500 text-[10px] mt-0.5">Branch Code: {sandboxBranch}</p>
                        </div>
                      </div>

                      {/* Fake Items block */}
                      <div className="border border-slate-100 rounded-lg overflow-hidden my-4 text-xs">
                        <div className="bg-slate-50 px-3 py-1.5 font-bold text-slate-600 flex justify-between border-b">
                          <span>Particulars / Line Item Description</span>
                          <span>Total Amount</span>
                        </div>
                        <div className="p-3 flex justify-between font-bold text-indigo-950 border-b">
                          <span>Consolidated Commercial Merchandise & Logistics</span>
                          <span className="font-mono">{sandboxVariables.Amount}</span>
                        </div>
                      </div>

                      {/* THE HERO: Resolved dynamic terms and conditions */}
                      <div className="mt-8 pt-4 border-t border-dashed border-slate-200">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b pb-1 mb-3">Terms & Conditions</h4>
                        <ol className="list-decimal pl-4 space-y-2 text-[11px] text-slate-700 leading-relaxed font-sans">
                          {resolvedPreview.resolvedList?.map((clause, idx) => (
                            <li key={idx} className="pl-1">
                              <span className="font-semibold text-slate-900">{clause.title}:</span>{" "}
                              {clause.resolvedContent}
                              <span className="text-[9px] font-mono ml-2 text-slate-400 bg-slate-50 px-1 py-0.2 rounded border">
                                (Inherited: {clause.category})
                              </span>
                            </li>
                          ))}
                          {resolvedPreview.resolvedList?.length === 0 && (
                            <p className="text-slate-400 text-xs italic">No Terms & Conditions matched or resolved for this configuration.</p>
                          )}
                        </ol>
                      </div>
                    </div>

                    {/* Snapshot Save Trigger */}
                    <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 text-[11px] text-slate-500">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        <span>Lock and post to immutable ledger snapshot.</span>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await apiFetchV1("/terms/snapshots", {
                              method: "POST",
                              body: JSON.stringify({
                                documentType: sandboxDocType,
                                documentNo: sandboxVariables.InvoiceNo,
                                clauses: resolvedPreview.resolvedList.map(c => ({
                                  category: c.category,
                                  title: c.title,
                                  content: c.resolvedContent,
                                  order: c.order
                                }))
                              })
                            });
                            fetchData();
                            alert(`Successfully posted legal terms snapshot for ${sandboxVariables.InvoiceNo}!`);
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg transition flex items-center space-x-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Freeze Terms Snapshot</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* SUBTAB 4: REGULATORY APPROVALS PIPELINE */}
        {activeSubTab === "approvals" && (
          <div className="space-y-6" id="subtab-approvals-root">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>Auditing Workflow Pipeline</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Under retail internal security protocols, changes made to terms and conditions must go through rigorous compliance checks before becoming globally active defaults.
              </p>

              {/* Quick audit tools */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex flex-col md:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Enter audit/compliance decision comments..."
                  value={auditNotes}
                  onChange={(e) => setAuditNotes(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* List of pending approvals */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Workflow Log List</h3>

              <div className="space-y-3">
                {approvalLogs.map((log) => {
                  const cl = clauses.find(c => c.id === log.clauseId);
                  return (
                    <div key={log.id} className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-indigo-400">ID: {log.id}</span>
                            <span className="text-[10px] text-slate-500">Proposed Version: v{log.version}</span>
                          </div>
                          <h4 className="text-sm font-bold text-white mt-1">Clause: {log.title}</h4>
                        </div>
                        <span className={`px-2.5 py-1 rounded text-[10px] font-bold self-start md:self-auto ${
                          log.status === "Approved" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                          log.status === "Rejected" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                          "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse"
                        }`}>
                          {log.status}
                        </span>
                      </div>

                      {/* Details of changes */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-800/80">
                          <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider mb-1">Proposed Content Change</span>
                          <p className="text-xs text-slate-300 font-mono leading-relaxed bg-slate-950 p-2.5 rounded border border-slate-850">{log.proposedChanges?.content || cl?.content}</p>
                        </div>
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-800/80 flex flex-col justify-between">
                          <div>
                            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider mb-1">Submission Information</span>
                            <p className="text-xs text-slate-300">Submitted By: <span className="font-bold">{log.submittedBy}</span></p>
                            <p className="text-xs text-slate-400 mt-1">Submitted At: {new Date(log.submittedAt).toLocaleString()}</p>
                          </div>
                          {log.comments && (
                            <div className="mt-4 p-2 bg-slate-950 rounded border border-slate-850 text-[11px] text-slate-400">
                              <span className="font-bold text-slate-300 block mb-0.5">Audit comments:</span>
                              {log.comments}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Approval triggers */}
                      {log.status === "Pending" && (
                        <div className="pt-3 border-t border-slate-800 flex justify-end space-x-2">
                          <button
                            onClick={() => handleReject(log.clauseId)}
                            className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 px-3 py-1.5 rounded-lg text-xs font-semibold border border-rose-500/20 transition flex items-center space-x-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject & Draft back</span>
                          </button>
                          <button
                            onClick={() => handleApprove(log.clauseId)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Verify & Approve</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {approvalLogs.length === 0 && (
                  <div className="py-12 text-center bg-slate-950 border border-slate-800 rounded-xl">
                    <p className="text-slate-400 text-xs">No active regulatory approval workflows registered.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 5: IMMUTABLE TERMS SNAPSHOTS */}
        {activeSubTab === "snapshots" && (
          <div className="space-y-6" id="subtab-snapshots-root">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                <History className="w-4 h-4 text-indigo-400" />
                <span>Posted Document Snapshots Ledger</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                When an invoice or voucher is finalized and posted to Tally or SMRITI's general ledger, the terms are instantly "snapshotted." This prevents subsequent updates to template terms from retroactively modifying the legal wording printed on historical documents.
              </p>
            </div>

            {/* List of locked snapshots */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {snapshots.map((snap) => (
                <div key={snap.id} className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <span className="text-[10px] font-mono bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-indigo-400">
                        {snap.documentType}
                      </span>
                      <h4 className="text-xs font-bold text-white mt-1.5">No: {snap.documentNo}</h4>
                    </div>
                    <span className="text-[10px] text-slate-500 flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(snap.snapshotAt).toLocaleDateString()}</span>
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">Snapshotted Legal Clauses</span>
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {snap.clausesSnapshot.map((cl, i) => (
                        <div key={i} className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/80">
                          <span className="text-[10px] font-bold text-slate-300 font-sans">{cl.title}</span>
                          <p className="text-[11px] text-slate-400 mt-1 font-mono leading-relaxed">{cl.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] text-emerald-400 flex items-center space-x-1 justify-end">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Cryptographically Locked (Immutable)</span>
                  </div>
                </div>
              ))}

              {snapshots.length === 0 && (
                <div className="col-span-full py-12 text-center bg-slate-950 border border-slate-800 rounded-xl">
                  <p className="text-slate-400 text-xs">No posted document terms snapshots found in the audit store.</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* DIALOG 1: NEW/EDIT CLAUSE FORM MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                <Gavel className="w-4 h-4 text-indigo-400" />
                <span>{editingClause ? "Revise Existing Clause" : "Draft New Clause"}</span>
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClause} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Clause Code</label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="e.g. PAY-NET30"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Legal Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Clause Title</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Standard Wire Settlement Terms"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Legal Language</label>
                <select
                  value={formLanguage}
                  onChange={(e) => setFormLanguage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi (हिंदी)</option>
                  <option value="German">German</option>
                  <option value="Spanish">Spanish</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-400 uppercase">Clause Content Template</label>
                  <span className="text-[9px] text-slate-500 font-bold">Variables: {"{InvoiceNo}"}, {"{Amount}"}, {"{DueDate}"}, {"{Store}"}</span>
                </div>
                <textarea
                  rows={4}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Delayed payments will incur interest of 1.5% per month."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              {/* Approval workflow check */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
                <label className="flex items-center space-x-2 text-xs text-slate-300 font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formSubmitApproval}
                    onChange={(e) => setFormSubmitApproval(e.target.checked)}
                    className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-0"
                  />
                  <span>Submit to Compliance Workflow Pipeline (Requires Sign-off)</span>
                </label>

                {formSubmitApproval && (
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Revision comments for Auditors</label>
                    <input
                      type="text"
                      value={formComments}
                      onChange={(e) => setFormComments(e.target.value)}
                      placeholder="Added correct bank clearance provisions"
                      className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 px-4 py-2 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-semibold px-4 py-2 rounded-lg transition"
                >
                  Save & Commit
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* DIALOG 2: MAP DEFAULTS FORM MODAL */}
      {isDefaultFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <h3 className="text-sm font-bold text-white">Define Default Mapping Set</h3>
              <button
                onClick={() => setIsDefaultFormOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDefaultMap} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Mapping Level</label>
                <select
                  value={mapLevel}
                  onChange={(e: any) => setMapLevel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="Company">Company Default</option>
                  <option value="Branch">Branch Override</option>
                  <option value="Document">Document Type Default</option>
                  <option value="Customer">Customer Specific Override</option>
                  <option value="Supplier">Supplier Specific Override</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Reference ID / Key value</label>
                <input
                  type="text"
                  value={mapRefId}
                  onChange={(e) => setMapRefId(e.target.value)}
                  placeholder="e.g. MUM (for Branch) or Retail Invoice (for Document)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Select Clauses for Association</label>
                <div className="space-y-2 max-h-[180px] overflow-y-auto border border-slate-850 p-3 rounded-lg bg-slate-950">
                  {clauses.map(clause => (
                    <label key={clause.id} className="flex items-start space-x-2 text-xs text-slate-300 hover:text-white cursor-pointer select-none py-0.5">
                      <input
                        type="checkbox"
                        checked={mapSelectedClauses.includes(clause.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setMapSelectedClauses([...mapSelectedClauses, clause.id]);
                          } else {
                            setMapSelectedClauses(mapSelectedClauses.filter(id => id !== clause.id));
                          }
                        }}
                        className="rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-0 mt-0.5"
                      />
                      <div>
                        <span className="font-semibold block">{clause.title}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{clause.category} • {clause.code}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDefaultFormOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 px-4 py-2 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-semibold px-4 py-2 rounded-lg transition"
                >
                  Confirm defaults mapping
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
