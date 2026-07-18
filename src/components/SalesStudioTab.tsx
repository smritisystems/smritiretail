/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.27.0
 * Created      : 2026-07-10
 * Modified     : 2026-07-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */
import React, { useState, useEffect, useCallback } from "react";
import { Printer, MessageCircle, Mail, AlignJustify, 
  FileText, Plus, Search, Grid, Trash2, Edit3, 
  RefreshCw, User, Calendar, DollarSign, Percent, 
  ArrowRight, FileCheck, AlertCircle, ShoppingCart, 
  CheckCircle2, X, Eye, Layers, Undo2, Ban, ShieldAlert,
  UserCheck, UserX, CreditCard, Check, MoreVertical,
  Upload, Download, AlertTriangle, XCircle, Info, FileSpreadsheet
} from "lucide-react";
import { motion } from "motion/react";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import { Product, Quotation, SalesOrder, SalesItemLine, SalesInvoice, SalesReturn, Customer, CustomerGroup } from "../types.js";
import { SmartFilter, FilterDefinition } from "./SmartFilter.tsx";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";
import { getCustomers, getCustomerGroups, saveCustomers } from "../services/customerStore.ts";
import { recordAuditAction } from "../lib/apiFetch.ts";
import { ProductImage } from "./common/ProductImage.tsx";
import { formatDate, formatDateTime, formatCurrency } from "../utils/formatters.ts";
import { isValidMobile } from "../utils/validators.ts";
import { useACAS } from "../context-actions/ContextProvider.tsx";

interface ParsedRow {
  name: string;
  mobile: string;
  email: string;
  gstNumber: string;
  pan: string;
  customerGroupId: string;
  status: "Active" | "Inactive" | "Blocked";
  outstanding: number;
  rowNumber: number;
  warnings: string[];
  errors: string[];
}

function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentValue = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentValue.trim());
      currentValue = "";
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      row.push(currentValue.trim());
      currentValue = "";
      if (row.length > 0 || row.some(cell => cell !== "")) {
        lines.push(row);
      }
      row = [];
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n
      }
    } else {
      currentValue += char;
    }
  }
  if (currentValue || row.length > 0) {
    row.push(currentValue.trim());
    if (row.some(cell => cell !== "")) {
      lines.push(row);
    }
  }
  return lines;
}

function generateNextCustomerId(existing: Customer[], indexOffset: number = 0): string {
  let maxNum = 0;
  existing.forEach(c => {
    const match = c.id.match(/^CUST-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  });
  const nextNum = maxNum + 1 + indexOffset;
  return `CUST-${String(nextNum).padStart(3, "0")}`;
}

function processParsedRows(headers: string[], dataRows: string[][], groups: CustomerGroup[], existingCustomers: Customer[]): ParsedRow[] {
  const headerMap: Record<string, number> = {};
  
  headers.forEach((h, idx) => {
    const clean = h.trim().toLowerCase();
    if (clean === "name" || clean === "customer name" || clean === "full name" || clean === "client" || clean === "party") {
      headerMap["name"] = idx;
    } else if (clean === "mobile" || clean === "phone" || clean === "mobile no" || clean === "mobile number" || clean === "contact") {
      headerMap["mobile"] = idx;
    } else if (clean === "email" || clean === "email address" || clean === "email_id" || clean === "email id") {
      headerMap["email"] = idx;
    } else if (clean === "gst" || clean === "gstin" || clean === "gst number" || clean === "gstnumber" || clean === "tax id") {
      headerMap["gstNumber"] = idx;
    } else if (clean === "pan" || clean === "pan number" || clean === "pan no") {
      headerMap["pan"] = idx;
    } else if (clean === "group" || clean === "group id" || clean === "customergroupid" || clean === "customer group id" || clean === "tier") {
      headerMap["customerGroupId"] = idx;
    } else if (clean === "status" || clean === "state" || clean === "active") {
      headerMap["status"] = idx;
    } else if (clean === "outstanding" || clean === "outstanding balance" || clean === "balance" || clean === "due") {
      headerMap["outstanding"] = idx;
    }
  });

  if (headerMap["name"] === undefined && headers.length > 0) headerMap["name"] = 0;
  if (headerMap["mobile"] === undefined && headers.length > 1) headerMap["mobile"] = 1;
  if (headerMap["email"] === undefined && headers.length > 2) headerMap["email"] = 2;
  if (headerMap["gstNumber"] === undefined && headers.length > 3) headerMap["gstNumber"] = 3;
  if (headerMap["pan"] === undefined && headers.length > 4) headerMap["pan"] = 4;
  if (headerMap["customerGroupId"] === undefined && headers.length > 5) headerMap["customerGroupId"] = 5;
  if (headerMap["status"] === undefined && headers.length > 6) headerMap["status"] = 6;
  if (headerMap["outstanding"] === undefined && headers.length > 7) headerMap["outstanding"] = 7;

  // Track duplicates within the current batch to prevent double-upload
  const batchMobiles = new Set<string>();
  const batchEmails = new Set<string>();

  return dataRows.map((row, rowIdx) => {
    const getValue = (field: string, fallback: string = ""): string => {
      const idx = headerMap[field];
      return (idx !== undefined && row[idx] !== undefined) ? row[idx].trim() : fallback;
    };

    const rawName = getValue("name");
    const name = rawName || `Unnamed Customer ${rowIdx + 1}`;
    const mobile = getValue("mobile");
    const email = getValue("email");
    const gstNumber = getValue("gstNumber");
    const pan = getValue("pan");
    const groupInput = getValue("customerGroupId");
    const statusInput = getValue("status");
    const outstandingInput = getValue("outstanding");

    const warnings: string[] = [];
    const errors: string[] = [];

    // 1. Name Validation
    if (!rawName) {
      errors.push("Customer Name is required.");
    }

    // 2. Mobile Validation
    if (!mobile) {
      errors.push("Mobile number is required.");
    } else {
      const cleanMobile = mobile.replace(/[- ]/g, "");
      if (!isValidMobile(cleanMobile)) {
        errors.push("Mobile number must be exactly 10 digits.");
      } else {
        const isDupExisting = existingCustomers.some(c => c.mobile === cleanMobile || c.mobile === mobile);
        if (isDupExisting) {
          errors.push(`Mobile number '${mobile}' matches an existing Customer in the database.`);
        }
        if (batchMobiles.has(cleanMobile)) {
          errors.push(`Duplicate mobile number '${mobile}' within this import batch.`);
        } else {
          batchMobiles.add(cleanMobile);
        }
      }
    }

    // 3. Email Validation
    if (!email) {
      errors.push("Email address is required.");
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push("Invalid email address format.");
      } else {
        const isDupEmailExisting = existingCustomers.some(c => c.email && c.email.toLowerCase() === email.toLowerCase());
        if (isDupEmailExisting) {
          errors.push(`Email address '${email}' matches an existing Customer in the database.`);
        }
        const lowerEmail = email.toLowerCase();
        if (batchEmails.has(lowerEmail)) {
          errors.push(`Duplicate email '${email}' within this import batch.`);
        } else {
          batchEmails.add(lowerEmail);
        }
      }
    }

    // 4. Customer Group Validation
    let resolvedGroup = "CG-Retail";
    if (!groupInput) {
      errors.push("Customer Group is required.");
    } else {
      const normalizedGroup = groupInput.toLowerCase();
      const groupFound = groups.find(g => 
        g.id.toLowerCase() === normalizedGroup || 
        g.name.toLowerCase() === normalizedGroup ||
        g.name.toLowerCase().includes(normalizedGroup)
      );
      if (groupFound) {
        resolvedGroup = groupFound.id;
      } else {
        errors.push(`Customer Group '${groupInput}' is invalid or not found.`);
      }
    }

    let resolvedStatus: "Active" | "Inactive" | "Blocked" = "Active";
    if (statusInput) {
      const normalizedStatus = statusInput.toLowerCase();
      if (normalizedStatus === "inactive") resolvedStatus = "Inactive";
      else if (normalizedStatus === "blocked") resolvedStatus = "Blocked";
    }

    let resolvedOutstanding = 0;
    if (outstandingInput) {
      const parsedOut = parseFloat(outstandingInput.replace(/[^\d.-]/g, ""));
      if (!isNaN(parsedOut)) {
        resolvedOutstanding = parsedOut;
      }
    }

    return {
      name,
      mobile,
      email,
      gstNumber,
      pan,
      customerGroupId: resolvedGroup,
      status: resolvedStatus,
      outstanding: resolvedOutstanding,
      rowNumber: rowIdx + 2,
      warnings,
      errors
    };
  });
}

interface SalesStudioTabProps {
  products: Product[];
  onNotification: (title: string, message: string, type?: "success" | "error") => void;
  currentUser?: { role: string; name: string; companyId?: string; branchId?: string } | null;
}

export const SalesStudioTab: React.FC<SalesStudioTabProps> = ({ products, onNotification, currentUser }) => {
  const { openMenu } = useACAS();
  const isReadOnly = currentUser?.role === "Report User";
  const hasTenantContext = Boolean(currentUser?.companyId && currentUser?.branchId);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<SalesInvoice[]>([]);
  const [salesReturns, setSalesReturns] = useState<SalesReturn[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [subView, setSubView] = useState<"quotations" | "orders" | "invoices" | "returns" | "customers">("quotations");
  const [density, setDensity] = useState<"compact" | "comfortable" | "relaxed">("comfortable");
  const densityPadding = density === "compact" ? "py-1.5" : density === "comfortable" ? "py-3" : "py-4";
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});

  // Selection states for detail view
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [selectedReturn, setSelectedReturn] = useState<SalesReturn | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Editor states (for creating/editing Quotations)
  const [isCreatingQuotation, setIsCreatingQuotation] = useState<boolean>(false);
  const [editorCustomerName, setEditorCustomerName] = useState<string>("");
  const [editorItems, setEditorItems] = useState<any[]>([]); // items in current draft
  const [editorStatus, setEditorStatus] = useState<"Draft" | "Submitted">("Draft");

  // Editor states (for creating Sales Invoices)
  const [isCreatingInvoice, setIsCreatingInvoice] = useState<boolean>(false);
  const [invoiceCustomerId, setInvoiceCustomerId] = useState<string>("");
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
  const [invoiceStatus, setInvoiceStatus] = useState<"Draft" | "Submitted">("Draft");
  const [invoiceIsInterstate, setInvoiceIsInterstate] = useState<boolean>(false);
  const [invoiceEWayBill, setInvoiceEWayBill] = useState<string>("");

  // Editor states (for creating Sales Returns)
  const [isCreatingReturn, setIsCreatingReturn] = useState<boolean>(false);
  const [returnOriginalInvoiceId, setReturnOriginalInvoiceId] = useState<string>("");
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [returnReason, setReturnReason] = useState<string>("Standard Return");
  const [returnIsInterstate, setReturnIsInterstate] = useState<boolean>(false);
  const [returnStatus, setReturnStatus] = useState<"Draft" | "Submitted">("Draft");

  // CSV Import States
  const [isImportingCustomers, setIsImportingCustomers] = useState<boolean>(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [rawCsvText, setRawCsvText] = useState<string>("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [firstRowHeader, setFirstRowHeader] = useState<boolean>(true);
  const [isValidatingOnServer, setIsValidatingOnServer] = useState<boolean>(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>("");
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("");
  const [selectedAttributeGroup, setSelectedAttributeGroup] = useState<string>("");

  // Manual Customer addition states
  const [isAddingCustomer, setIsAddingCustomer] = useState<boolean>(false);
  const [newCustomerName, setNewCustomerName] = useState<string>("");
  const [newCustomerMobile, setNewCustomerMobile] = useState<string>("");
  const [newCustomerEmail, setNewCustomerEmail] = useState<string>("");
  const [newCustomerGst, setNewCustomerGst] = useState<string>("");
  const [newCustomerPan, setNewCustomerPan] = useState<string>("");
  const [newCustomerGroup, setNewCustomerGroup] = useState<string>("CG-Retail");
  const [newCustomerStatus, setNewCustomerStatus] = useState<"Active" | "Inactive" | "Blocked">("Active");
  const [newCustomerTags, setNewCustomerTags] = useState<string>("");
  const [manualValidationErrors, setManualValidationErrors] = useState<string[]>([]);
  const [isManualValidatingOnServer, setIsManualValidatingOnServer] = useState<boolean>(false);

  // Quick Edit Customer states
  const [quickEditingCustomer, setQuickEditingCustomer] = useState<Customer | null>(null);
  const [quickEditMobile, setQuickEditMobile] = useState<string>("");
  const [quickEditEmail, setQuickEditEmail] = useState<string>("");
  const [quickEditErrors, setQuickEditErrors] = useState<string[]>([]);
  const [isQuickEditSaving, setIsQuickEditSaving] = useState<boolean>(false);

  // Dual entry mode state
  const [entryMode, setEntryMode] = useState<"manual" | "matrix">("manual");
  
  // Manual entry fields
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [manualQty, setManualQty] = useState<number>(1);
  const [manualTax, setManualTax] = useState<number>(18);

  // Matrix entry fields
  const [selectedBaseArticle, setSelectedBaseArticle] = useState<string>("");
  const [selectedBaseColor, setSelectedBaseColor] = useState<string>("");
  const [matrixQuantities, setMatrixQuantities] = useState<Record<string, number>>({}); // productId -> qty

  useEffect(() => {
    if (!hasTenantContext) {
      return;
    }
    fetchQuotations();
    fetchSalesOrders();
    fetchSalesInvoices();
    fetchSalesReturns();
    fetchCustomers();
  }, [hasTenantContext]);

  // CSV live-reparsing and validation effect
  useEffect(() => {
    if (!rawCsvText) {
      setParsedRows([]);
      setIsValidatingOnServer(false);
      return;
    }

    let isCurrent = true;

    try {
      const parsedLines = parseCSV(rawCsvText);
      if (parsedLines.length === 0) {
        setParsedRows([]);
        setIsValidatingOnServer(false);
        return;
      }

      let headers: string[] = [];
      let dataRows: string[][] = [];

      if (firstRowHeader && parsedLines.length > 0) {
        headers = parsedLines[0];
        dataRows = parsedLines.slice(1);
      } else {
        const maxCols = Math.max(...parsedLines.map(line => line.length));
        headers = Array.from({ length: maxCols }, (_, i) => `Column ${i + 1}`);
        dataRows = parsedLines;
      }

      // Step 1: Client-side validation for instant UI feedback
      const processedClient = processParsedRows(headers, dataRows, customerGroups, customers);
      setParsedRows(processedClient);

      // Step 2: Server-side validation
      setIsValidatingOnServer(true);
      
      const runServerValidation = async () => {
        try {
          const data = await apiFetchV1("/attributes/import-validate", {
            method: "POST",
            body: JSON.stringify({
              groupId: selectedAttributeGroup,
              rows: processedClient
            })
          });

          if (isCurrent) {
        if (Array.isArray(data.results)) {
          setParsedRows(data.results);
        }
        setIsValidatingOnServer(false);
      }
        } catch (serverErr) {
          console.error("Server-side customer validation failed:", serverErr);
          if (isCurrent) {
            setIsValidatingOnServer(false);
          }
        }
      };

      runServerValidation();

    } catch (err) {
      console.error("Failed to parse CSV raw text:", err);
      onNotification("Parser Error", "Failed to process the CSV file syntax.", "error");
      setIsValidatingOnServer(false);
    }

    return () => {
      isCurrent = false;
    };
  }, [rawCsvText, firstRowHeader, customerGroups, customers]);

  const fetchSalesInvoices = async (filters: Record<string, any> = activeFilters) => {
    setLoading(true);
    try {
      // Migrated: GET /api/sales/invoices (Express) → GET /api/v1/sales/invoices (FastAPI)
      const params = new URLSearchParams();
      if (filters.customer) params.append("customer", filters.customer);
      if (filters.status && filters.status.length > 0) params.append("status", filters.status.join(","));
      if (filters.date?.start) params.append("startDate", filters.date.start);
      if (filters.date?.end) params.append("endDate", filters.date.end);
      const data = await apiFetchV1(`/sales/invoices${params.toString() ? `?${params.toString()}` : ""}`);
      setSalesInvoices(data);
    } catch (e) {
      onNotification("Sync Error", "Failed to load sales invoices.", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesReturns = async (filters: Record<string, any> = activeFilters) => {
    setLoading(true);
    try {
      // Migrated: GET /api/sales/returns (Express) → GET /api/v1/sales/returns (FastAPI)
      const params = new URLSearchParams();
      if (filters.customer) params.append("customer", filters.customer);
      if (filters.status && filters.status.length > 0) params.append("status", filters.status.join(","));
      if (filters.date?.start) params.append("startDate", filters.date.start);
      if (filters.date?.end) params.append("endDate", filters.date.end);
      const data = await apiFetchV1(`/sales/returns/${params.toString() ? `?${params.toString()}` : ""}`);
      setSalesReturns(data);
    } catch (e) {
      onNotification("Sync Error", "Failed to load sales returns.", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = () => {
    try {
      const custs = getCustomers();
      const groups = getCustomerGroups();
      setCustomers(custs);
      setCustomerGroups(groups);
    } catch (e) {
      onNotification("Local Error", "Failed to load customer profiles.", "error");
    }
  };

  // Selection changes audit logging
  useEffect(() => {
    if (selectedQuotation) {
      recordAuditAction("TRANSACTION_VIEW", "quotations", selectedQuotation.id, `Viewed quotation details: ${selectedQuotation.quotationNo}`);
    }
  }, [selectedQuotation]);

  useEffect(() => {
    if (selectedOrder) {
      recordAuditAction("TRANSACTION_VIEW", "sales_orders", selectedOrder.id, `Viewed sales order details: ${selectedOrder.orderNo}`);
    }
  }, [selectedOrder]);

  useEffect(() => {
    if (selectedInvoice) {
      recordAuditAction("TRANSACTION_VIEW", "sales_invoices", selectedInvoice.id, `Viewed sales invoice details: ${selectedInvoice.invoiceNo}`);
    }
  }, [selectedInvoice]);

  useEffect(() => {
    if (selectedReturn) {
      recordAuditAction("TRANSACTION_VIEW", "sales_returns", selectedReturn.id, `Viewed sales return details: ${selectedReturn.returnNo}`);
    }
  }, [selectedReturn]);

  useEffect(() => {
    if (selectedCustomer) {
      recordAuditAction("TRANSACTION_VIEW", "customers", selectedCustomer.id, `Viewed customer profile details: ${selectedCustomer.name}`);
    }
  }, [selectedCustomer]);

  if (!hasTenantContext) {
    return (
      <div className="p-8">
        <div className="rounded-3xl border border-rose-500/20 bg-rose-950/10 p-8 shadow-sm">
          <div className="mb-4 text-2xl font-semibold text-rose-200">Sales Studio requires tenant assignment</div>
          <p className="mb-3 text-sm text-rose-300 leading-relaxed">
            Your current operator account is not assigned to a company and branch. Sales Studio is a tenant-scoped business module and requires a tenant-scoped user to access sales invoices, orders, quotations, returns and customer-ledger data.
          </p>
          <p className="text-sm text-rose-300 leading-relaxed">
            Please ask a SYSADMIN to assign your account to a company and branch, or log in with a tenant-scoped sales operator account.
          </p>
        </div>
      </div>
    );
  }

  // ACAS Global Event Handlers — hoisted to component scope so they can be
  // used both as window event listeners (ACAS) and as direct onClick handlers in JSX.
  const handlePrintInvoice = useCallback((e: any) => {
    const inv = e?.detail ?? e;
    if (inv && inv.id) {
      window.open(`/invoice-print?id=${inv.id}`, "_blank", "width=920,height=1200,menubar=no,toolbar=no,location=no,status=no");
      onNotification("Print Action", `Sales Invoice ${inv.invoiceNo ?? ""} opened in print popout.`, "success");
    } else {
      onNotification("Print Error", "Could not locate invoice ID for print operation.", "error");
    }
  }, [onNotification]);

  const handleWhatsAppInvoice = useCallback((e: any) => {
    const inv = e?.detail ?? e;
    onNotification("WhatsApp Shared", `Sales Invoice ${inv.invoiceNo ?? ""} successfully dispatched.`, "success");
  }, [onNotification]);

  const handleApproveInvoice = useCallback(async (e: any) => {
    const inv = e?.detail ?? e;
    try {
      // Migrated: invoice approve → apiFetchV1 (FastAPI workflow)
      await apiFetchV1(`/workflow/SalesInvoice/${inv.id}/approve`, { method: "POST" });
      onNotification("Invoice Approved", `Sales Invoice ${inv.invoiceNo ?? ""} is now approved and written to financial ledgers.`, "success");
      fetchSalesInvoices();
      if (selectedInvoice && selectedInvoice.id === inv.id) {
        setSelectedInvoice({ ...selectedInvoice, status: "Approved" });
      }
    } catch (err: any) {
      onNotification("Network Error", err.message || "Workflow transaction failed.", "error");
    }
  }, [onNotification, selectedInvoice]);

  const handleCancelInvoice = useCallback(async (e: any) => {
    const inv = e?.detail ?? e;
    try {
      // Migrated: invoice cancel → apiFetchV1 (FastAPI workflow)
      await apiFetchV1(`/workflow/SalesInvoice/${inv.id}/cancel`, { method: "POST" });
      onNotification("Invoice Cancelled", `Sales Invoice ${inv.invoiceNo ?? ""} is now marked as Cancelled.`, "success");
      fetchSalesInvoices();
      if (selectedInvoice && selectedInvoice.id === inv.id) {
        setSelectedInvoice({ ...selectedInvoice, status: "Cancelled" });
      }
    } catch (err: any) {
      onNotification("Network Error", err.message || "Workflow transaction failed.", "error");
    }
  }, [onNotification, selectedInvoice]);

  // ACAS Global Event Listeners — attach the stable callbacks to window events
  useEffect(() => {
    window.addEventListener("SMRITI_PRINT_SALES_INVOICE", handlePrintInvoice);
    window.addEventListener("SMRITI_WHATSAPP_SALES_INVOICE", handleWhatsAppInvoice);
    window.addEventListener("SMRITI_APPROVE_SALES_INVOICE", handleApproveInvoice);
    window.addEventListener("SMRITI_CANCEL_SALES_INVOICE", handleCancelInvoice);

    return () => {
      window.removeEventListener("SMRITI_PRINT_SALES_INVOICE", handlePrintInvoice);
      window.removeEventListener("SMRITI_WHATSAPP_SALES_INVOICE", handleWhatsAppInvoice);
      window.removeEventListener("SMRITI_APPROVE_SALES_INVOICE", handleApproveInvoice);
      window.removeEventListener("SMRITI_CANCEL_SALES_INVOICE", handleCancelInvoice);
    };
  }, [handlePrintInvoice, handleWhatsAppInvoice, handleApproveInvoice, handleCancelInvoice]);

  // Listener for row-level Quick Edit Customer
  useEffect(() => {
    const handleQuickEditCustomer = (e: any) => {
      const cust = e.detail;
      if (cust) {
        setQuickEditingCustomer(cust);
        setQuickEditMobile(cust.mobile || "");
        setQuickEditEmail(cust.email || "");
        setQuickEditErrors([]);
      }
    };
    window.addEventListener("SMRITI_QUICK_EDIT_CUSTOMER", handleQuickEditCustomer);
    return () => {
      window.removeEventListener("SMRITI_QUICK_EDIT_CUSTOMER", handleQuickEditCustomer);
    };
  }, []);

  const fetchQuotations = async (filters: Record<string, any> = activeFilters) => {
    setLoading(true);
    try {
      // Migrated: GET /api/sales/quotations (Express unmounted) → GET /api/v1/sales/quotations/ (FastAPI)
      const params = new URLSearchParams();
      if (filters.customer) params.append("customer", filters.customer);
      if (filters.status && filters.status.length > 0) params.append("status", filters.status.join(","));
      if (filters.date?.start) params.append("startDate", filters.date.start);
      if (filters.date?.end) params.append("endDate", filters.date.end);
      const data = await apiFetchV1(`/sales/quotations/${params.toString() ? `?${params.toString()}` : ""}`);
      setQuotations(data);
    } catch (e) {
      onNotification("Sync Error", "Failed to load quotations ledger.", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesOrders = async (filters: Record<string, any> = activeFilters) => {
    try {
      // Migrated: GET /api/sales/orders (Express unmounted) → GET /api/v1/sales/orders/ (FastAPI)
      const params = new URLSearchParams();
      if (filters.customer) params.append("customer", filters.customer);
      if (filters.status && filters.status.length > 0) params.append("status", filters.status.join(","));
      if (filters.date?.start) params.append("startDate", filters.date.start);
      if (filters.date?.end) params.append("endDate", filters.date.end);
      const data = await apiFetchV1(`/sales/orders/${params.toString() ? `?${params.toString()}` : ""}`);
      setSalesOrders(data);
    } catch (e) {
      onNotification("Sync Error", "Failed to load sales orders ledger.", "error");
    }
  };

  // Group products for Matrix Mode
  // articleNames are distinct names (e.g. Classic Cotton T-Shirt, Retro Leather Sneakers)
  const baseArticles = Array.from(new Set(products.map(p => p.name)));

  // Get colors available for the selected base article
  const availableColors = Array.from(
    new Set(
      products
        .filter(p => p.name === selectedBaseArticle)
        .map(p => p.color || "N/A")
    )
  );

  // Get variants (sizes) for selected base article & color
  const matrixVariants = products.filter(
    p => p.name === selectedBaseArticle && (p.color || "N/A") === selectedBaseColor
  );

  const handleAddManualItem = () => {
    const prod = products.find(p => p.id === selectedProduct);
    if (!prod) {
      onNotification("Invalid Product", "Please select a product variant.", "error");
      return;
    }
    if (manualQty <= 0) {
      onNotification("Invalid Quantity", "Quantity must be greater than zero.", "error");
      return;
    }

    const currentItems = isCreatingInvoice ? invoiceItems : editorItems;
    const setCurrentItems = isCreatingInvoice ? setInvoiceItems : setEditorItems;

    // Check if variant already exists in current draft items list
    const existingIndex = currentItems.findIndex(item => item.productId === prod.id);
    if (existingIndex > -1) {
      const updated = [...currentItems];
      updated[existingIndex].quantity += manualQty;
      updated[existingIndex].totalAmount = updated[existingIndex].quantity * updated[existingIndex].price * (1 + updated[existingIndex].taxRate/100);
      setCurrentItems(updated);
    } else {
      setCurrentItems([
        ...currentItems,
        {
          productId: prod.id,
          code: prod.code,
          name: prod.name,
          color: prod.color,
          size: prod.size,
          quantity: manualQty,
          price: prod.price,
          taxRate: manualTax
        }
      ]);
    }

    // Reset inputs
    setSelectedProduct("");
    setManualQty(1);
    onNotification("Item Added", `${prod.name} (${prod.size}) added to draft items list.`, "success");
  };

  const handleAddMatrixItems = () => {
    const itemsToAdd: any[] = [];
    let addedCount = 0;

    matrixVariants.forEach(variant => {
      const qty = matrixQuantities[variant.id] || 0;
      if (qty > 0) {
        itemsToAdd.push({
          productId: variant.id,
          code: variant.code,
          name: variant.name,
          color: variant.color,
          size: variant.size,
          quantity: qty,
          price: variant.price,
          taxRate: 18 // standard retail tax
        });
        addedCount += qty;
      }
    });

    if (itemsToAdd.length === 0) {
      onNotification("No Quantities Entered", "Please enter quantities for at least one size variant.", "error");
      return;
    }

    const currentItems = isCreatingInvoice ? invoiceItems : editorItems;
    const setCurrentItems = isCreatingInvoice ? setInvoiceItems : setEditorItems;

    // Merge into current list
    const updated = [...currentItems];
    itemsToAdd.forEach(newItem => {
      const existingIdx = updated.findIndex(item => item.productId === newItem.productId);
      if (existingIdx > -1) {
        updated[existingIdx].quantity += newItem.quantity;
      } else {
        updated.push(newItem);
      }
    });

    setCurrentItems(updated);
    // Reset matrix inputs
    setMatrixQuantities({});
    onNotification("Matrix Items Added", `Successfully loaded ${addedCount} units from matrix grid to draft.`, "success");
  };

  const handleRemoveDraftItem = (index: number) => {
    if (isCreatingInvoice) {
      setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
    } else {
      setEditorItems(editorItems.filter((_, i) => i !== index));
    }
  };

  const handleSaveQuotation = async () => {
    if (isReadOnly) {
      onNotification("Access Denied", "Operating under a Read-Only Report User role. Write operations are prohibited.", "error");
      return;
    }
    if (!editorCustomerName.trim()) {
      onNotification("Validation Error", "Please specify Customer Name.", "error");
      return;
    }
    if (editorItems.length === 0) {
      onNotification("Validation Error", "Please add at least one item line.", "error");
      return;
    }

    try {
      // Migrated: POST /api/sales/quotations (Express) → POST /api/v1/sales/quotations (FastAPI)
      await apiFetchV1("/sales/quotations", {
        method: "POST",
        body: JSON.stringify({
          customerName: editorCustomerName,
          items: editorItems,
          status: editorStatus
        })
      });
      onNotification("Success", "Quotation generated successfully and written to ledger.", "success");
      setIsCreatingQuotation(false);
      setEditorCustomerName("");
      setEditorItems([]);
      fetchQuotations();
    } catch (e: any) {
      onNotification("Network Error", e.message || "Connection failed while writing quotation.", "error");
    }
  };

  
  const handleWorkflowAction = async (docType: string, id: string, action: string) => {
    try {
      // Migrated: workflow actions → apiFetchV1 (FastAPI)
      await apiFetchV1(`/workflow/${docType}/${id}/${action}`, { method: "POST" });
      onNotification("Success", `Document ${action}ed successfully.`, "success");
      if (docType === "Quotation") fetchQuotations();
      else if (docType === "SalesOrder") fetchSalesOrders();
      else if (docType === "SalesInvoice") fetchSalesInvoices();
      else if (docType === "SalesReturn") fetchSalesReturns();
    } catch (e: any) {
      console.error(e);
      onNotification("Error", e.message || "Network error", "error");
    }
  };

  const handleSaveInvoice = async () => {
    if (isReadOnly) {
      onNotification("Access Denied", "Operating under a Read-Only Report User role. Write operations are prohibited.", "error");
      return;
    }
    if (!invoiceCustomerId) {
      onNotification("Validation Error", "Please select a Customer.", "error");
      return;
    }
    if (invoiceItems.length === 0) {
      onNotification("Validation Error", "Please add at least one item line.", "error");
      return;
    }

    try {
      // Migrated: POST /api/sales/invoices (Express) → POST /api/v1/sales/invoices (FastAPI)
      await apiFetchV1("/sales/invoices", {
        method: "POST",
        body: JSON.stringify({
          customerId: invoiceCustomerId,
          items: invoiceItems,
          status: invoiceStatus,
          isInterstate: invoiceIsInterstate,
          eWayBillNo: invoiceEWayBill || undefined
        })
      });
      onNotification("Success", "Sales Invoice written to database ledger.", "success");
      setIsCreatingInvoice(false);
      setInvoiceCustomerId("");
      setInvoiceItems([]);
      setInvoiceEWayBill("");
      fetchSalesInvoices();
    } catch (e: any) {
      onNotification("Network Error", e.message || "Connection failed while writing Invoice.", "error");
    }
  };

  const handleSaveReturn = async () => {
    if (isReadOnly) {
      onNotification("Access Denied", "Operating under a Read-Only Report User role. Write operations are prohibited.", "error");
      return;
    }
    if (!returnOriginalInvoiceId) {
      onNotification("Validation Error", "Please select the original Sales Invoice.", "error");
      return;
    }
    if (returnItems.length === 0) {
      onNotification("Validation Error", "Please specify at least one return quantity.", "error");
      return;
    }

    try {
      // Migrated: POST /api/sales/returns (Express) → POST /api/v1/sales/returns (FastAPI)
      await apiFetchV1("/sales/returns/", {
        method: "POST",
        body: JSON.stringify({
          originalInvoiceId: returnOriginalInvoiceId,
          items: returnItems,
          reason: returnReason,
          isInterstate: returnIsInterstate,
          status: returnStatus
        })
      });
      onNotification("Success", "Sales Return written to database ledger.", "success");
      setIsCreatingReturn(false);
      setReturnOriginalInvoiceId("");
      setReturnItems([]);
      setReturnReason("Standard Return");
      fetchSalesReturns();
    } catch (e: any) {
      onNotification("Network Error", e.message || "Connection failed while writing Sales Return.", "error");
    }
  };

  const handleConvertQuotation = async (qId: string) => {
    try {
      // Migrated: quotation convert → apiFetchV1 (FastAPI)
      const data = await apiFetchV1(`/sales/quotations/convert/${qId}`, { method: "POST" });
      onNotification("Order Confirmed", `Quotation converted successfully to ${data.salesOrder.orderNo}!`, "success");
      fetchQuotations();
      fetchSalesOrders();
      setSelectedQuotation(null);
    } catch (e: any) {
      onNotification("Network Error", e.message || "Connection failed during conversion.", "error");
    }
  };

  const handleDeleteQuotation = async (qId: string) => {
    if (!confirm("Are you sure you want to permanently delete this quotation draft?")) return;
    try {
      // Migrated: quotation delete → apiFetchV1 (FastAPI)
      await apiFetchV1(`/sales/quotations/${qId}`, { method: "DELETE" });
      onNotification("Success", "Quotation draft deleted.", "success");
      setSelectedQuotation(null);
      fetchQuotations();
    } catch (e: any) {
      onNotification("Network Error", e.message || "Failed to connect to backend.", "error");
    }
  };

  const filteredCustomers = customers.filter(c => {
    if (selectedTagFilter) {
      const hasTag = (c.tags || []).includes(selectedTagFilter);
      if (!hasTag) return false;
    }

    if (!customerSearchQuery) return true;
    const query = customerSearchQuery.toLowerCase();
    const nameMatch = c.name.toLowerCase().includes(query);
    const emailMatch = c.email ? c.email.toLowerCase().includes(query) : false;
    const phoneMatch = c.mobile ? c.mobile.toLowerCase().includes(query) : false;
    const tagMatch = (c.tags || []).some(t => t.toLowerCase().includes(query));
    return nameMatch || emailMatch || phoneMatch || tagMatch;
  });

  // Quick Stats
  const activeDrafts = quotations.filter(q => q.status === "Draft").length;
  const submittedQuotations = quotations.filter(q => q.status === "Submitted").length;
  const convertedQuotations = quotations.filter(q => q.status === "Converted").length;

  const totalSalesOrdered = salesOrders.reduce((sum, so) => sum + so.grandTotal, 0);

  const filterConfig: FilterDefinition[] = [
    {
      id: "customer",
      label: "Customer Name",
      type: "text",
      placeholder: "Search by customer..."
    },
    {
      id: "status",
      label: "Status",
      type: "multi-select",
      options: [
        { value: "Draft", label: "Draft" },
        { value: "Submitted", label: "Submitted" },
        { value: "Converted", label: "Converted" },
        { value: "Confirmed", label: "Confirmed" }
      ]
    },
    {
      id: "date",
      label: "Date Range",
      type: "date-range"
    }
  ];

  return (
    <div className="flex flex-col h-full bg-theme-surface-1 text-theme-primary font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-theme-divider bg-theme-surface-2 px-6 py-4">
        <div>
          <h2 className="text-xl font-bold font-display text-theme-primary tracking-tight">
            Sales & Commerce Studio
          </h2>
          <p className="text-xs text-theme-muted mt-1 max-w-2xl">
            Manage and track customer quotations, process incoming sales orders, issue GST commercial invoices, handle credit returns, and manage customer directory.
          </p>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center px-6 bg-theme-surface-2 border-b border-theme-divider gap-2 overflow-x-auto">
        {(["quotations", "orders", "invoices", "returns", "customers"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { 
              setSubView(tab); 
              setSelectedIds(new Set()); 
              setSelectedQuotation(null); 
              setSelectedOrder(null); 
              setSelectedInvoice(null);
              setSelectedReturn(null);
              setSelectedCustomer(null);
              setIsCreatingQuotation(false);
              setIsCreatingInvoice(false);
              setIsCreatingReturn(false);
              setIsImportingCustomers(false);
              if (tab === "quotations") fetchQuotations(activeFilters);
              else if (tab === "orders") fetchSalesOrders(activeFilters);
              else if (tab === "invoices") fetchSalesInvoices(activeFilters);
              else if (tab === "returns") fetchSalesReturns(activeFilters);
              else if (tab === "customers") fetchCustomers();
            }}
            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider font-mono border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              subView === tab
                ? "border-blue-500 text-blue-400 bg-theme-surface-3"
                : "border-transparent text-theme-muted hover:text-theme-primary hover:bg-theme-surface-hover"
            }`}
          >
            {tab === "quotations" && "Quotations"}
            {tab === "orders" && "Sales Orders"}
            {tab === "invoices" && "Sales Invoices"}
            {tab === "returns" && "Sales Returns"}
            {tab === "customers" && "Customers"}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <SmritiScrollArea className="flex-1 bg-theme-base p-6">
        {isReadOnly && (
          <div className="bg-amber-950/60 border border-amber-500/30 text-amber-300 rounded-xl p-3 px-4 flex items-center space-x-3 mb-5 shadow-lg">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="text-xs">
              <span className="font-bold">Read-Only Verification Mode</span>: You are currently operating under the <span className="font-mono bg-amber-900/60 px-1 py-0.5 rounded text-amber-200">Report User</span> role. All data creation, modification, deletion, and workflow actions are locked.
            </div>
          </div>
        )}
        <motion.div
          key={subView}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          
          {/* Overview Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-theme-surface-1 p-5 rounded-2xl border border-theme-divider shadow-lg flex items-center justify-between">
              <div>
                <span className="text-[10px] text-theme-muted block font-mono font-bold tracking-wider uppercase">ACTIVE QUOTATIONS</span>
                <span className="text-2xl font-bold font-display text-theme-body mt-1 block">
                  {quotations.length} <span className="text-xs font-normal text-theme-muted">Docs</span>
                </span>
                <span className="text-[11px] text-indigo-400 mt-1 block font-medium">
                  {activeDrafts} Drafts â€¢ {submittedQuotations} Submitted
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-950 flex items-center justify-center text-indigo-400 border border-indigo-900">
                <FileText size={22} />
              </div>
            </div>

            <div className="bg-theme-surface-1 p-5 rounded-2xl border border-theme-divider shadow-lg flex items-center justify-between">
              <div>
                <span className="text-[10px] text-theme-muted block font-mono font-bold tracking-wider uppercase">SALES ORDERS GENERATED</span>
                <span className="text-2xl font-bold font-display text-emerald-400 mt-1 block">
                  {salesOrders.length} <span className="text-xs font-normal text-theme-muted">Orders</span>
                </span>
                <span className="text-[11px] text-theme-muted mt-1 block">
                  {convertedQuotations} converted from Quotations
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-950 flex items-center justify-center text-emerald-400 border border-emerald-900">
                <ShoppingCart size={22} />
              </div>
            </div>

            <div className="bg-theme-surface-1 p-5 rounded-2xl border border-theme-divider shadow-lg flex items-center justify-between">
              <div>
                <span className="text-[10px] text-theme-muted block font-mono font-bold tracking-wider uppercase">TOTAL BOOKED REVENUE</span>
                <span className="text-2xl font-bold font-display text-theme-body mt-1 block">
                  â‚¹{(totalSalesOrdered).toLocaleString("en-IN")}
                </span>
                <span className="text-[11px] text-theme-muted mt-1 block">
                  Total sales booking in ledger
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-sky-950 flex items-center justify-center text-sky-400 border border-sky-900">
                <DollarSign size={22} />
              </div>
            </div>

            <div className="bg-theme-surface-1 p-5 rounded-2xl border border-theme-divider shadow-lg flex items-center justify-between">
              <div>
                <span className="text-[10px] text-theme-muted block font-mono font-bold tracking-wider uppercase">CONVERSION EFFICIENCY</span>
                <span className="text-2xl font-bold font-display text-violet-400 mt-1 block">
                  {quotations.length > 0 ? Math.round((convertedQuotations / quotations.length) * 100) : 0}%
                </span>
                <span className="text-[11px] text-theme-muted mt-1 block">
                  Quotations converted to SO
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-violet-950 flex items-center justify-center text-violet-400 border border-violet-900">
                <CheckCircle2 size={22} />
              </div>
            </div>
          </div>

          {/* Sub-navigation & Header Controls */}
          <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-4 flex flex-col xl:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wide text-theme-muted">
                Active: {subView === "quotations" ? "Quotations Desk" : subView === "orders" ? "Orders Book" : subView === "invoices" ? "Invoices Desk" : subView === "returns" ? "Returns Desk" : "Customers Directory"}
              </span>
            </div>

            <div className="flex items-center space-x-3 w-full xl:w-auto justify-end">
              <SmartFilter 
                filters={filterConfig} 
                onApply={(filters) => {
                  setActiveFilters(filters);
                  recordAuditAction("FILTER", "sales", subView, `Applied sales filters: ${JSON.stringify(filters)}`);
                  if (subView === "quotations") fetchQuotations(filters);
                  else if (subView === "orders") fetchSalesOrders(filters);
                  else if (subView === "invoices") fetchSalesInvoices(filters);
                  else if (subView === "returns") fetchSalesReturns(filters);
                }} 
              />
              <button
                onClick={() => {
                  if (subView === "quotations") fetchQuotations();
                  else if (subView === "orders") fetchSalesOrders();
                  else if (subView === "invoices") fetchSalesInvoices();
                  else if (subView === "returns") fetchSalesReturns();
                  else if (subView === "customers") fetchCustomers();
                }}
                className="p-2.5 rounded-lg bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-muted hover:text-theme-body transition-colors cursor-pointer"
                title="Refresh Ledger"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
              {subView === "quotations" && (
            <button
              onClick={() => setIsCreatingQuotation(true)}
              disabled={isReadOnly}
              className={`px-4 py-2 bg-[#2563EB] hover:bg-blue-600 active:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center space-x-2 shadow-lg hover:shadow-blue-900/30 transition-all ${isReadOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <Plus size={14} />
              <span>Generate Quotation</span>
            </button>
          )}
          {subView === "invoices" && (
            <button
              onClick={() => {
                setIsCreatingInvoice(true);
                setInvoiceCustomerId("");
                setInvoiceItems([]);
                setInvoiceEWayBill("");
              }}
              disabled={isReadOnly}
              className={`px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center space-x-2 shadow-lg hover:shadow-emerald-900/30 transition-all ${isReadOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <Plus size={14} />
              <span>Generate Sales Invoice</span>
            </button>
          )}
          {subView === "returns" && (
            <button
              onClick={() => {
                setIsCreatingReturn(true);
                setReturnOriginalInvoiceId("");
                setReturnItems([]);
                setReturnReason("Standard Return");
              }}
              disabled={isReadOnly}
              className={`px-4 py-2 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center space-x-2 shadow-lg hover:shadow-rose-900/30 transition-all ${isReadOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <Plus size={14} />
              <span>Record Sales Return</span>
            </button>
          )}
          {subView === "customers" && (
            <div className="flex items-center space-x-2 animate-in fade-in duration-200">
              <button
                onClick={() => {
                  setIsAddingCustomer(true);
                  setIsImportingCustomers(false);
                  setNewCustomerName("");
                  setNewCustomerMobile("");
                  setNewCustomerEmail("");
                  setNewCustomerGst("");
                  setNewCustomerPan("");
                  setNewCustomerGroup("CG-Retail");
                  setNewCustomerStatus("Active");
                  setManualValidationErrors([]);
                }}
                disabled={isReadOnly}
                className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center space-x-2 shadow-lg hover:shadow-indigo-900/30 transition-all ${isReadOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <Plus size={14} />
                <span>Add Customer</span>
              </button>
              <button
                onClick={() => {
                  setIsImportingCustomers(true);
                  setIsAddingCustomer(false);
                }}
                disabled={isReadOnly}
                className={`px-4 py-2 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-body rounded-lg text-xs font-bold flex items-center space-x-2 transition-all ${isReadOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <Upload size={14} />
                <span>Import Customers (CSV)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Studio View Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2/3: Lists & Forms */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Create New Quotation Panel */}
          {isCreatingQuotation ? (
            <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl overflow-hidden shadow-xl animate-in fade-in duration-200">
              <div className="bg-theme-surface-3 border-b border-theme-divider px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-sm text-theme-body">Generate Quotation Draft</h3>
                  <p className="text-[11px] text-theme-muted">Draft quotation with dual-mode item entry</p>
                </div>
                <button 
                  onClick={() => setIsCreatingQuotation(false)}
                  className="p-1 rounded bg-theme-surface-hover text-theme-muted hover:text-theme-body transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Header Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-theme-surface-2 p-4 rounded-xl border border-theme-divider/50">
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Customer / Party Name *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-theme-muted"><User size={14} /></span>
                      <input
                        type="text"
                        value={editorCustomerName}
                        onChange={(e) => setEditorCustomerName(e.target.value)}
                        placeholder="Enter Client or Company Name"
                        className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg pl-9 pr-4 py-2 text-xs text-theme-body placeholder-[#8892a4] focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Workflow Status</label>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => setEditorStatus("Draft")}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                          editorStatus === "Draft" 
                            ? "bg-[#2563EB] border-blue-500 text-theme-body" 
                            : "bg-theme-surface-1 border-theme-divider text-theme-muted hover:text-theme-body"
                        }`}
                      >
                        Keep Draft
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditorStatus("Submitted")}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                          editorStatus === "Submitted" 
                            ? "bg-amber-600 border-amber-500 text-white" 
                            : "bg-theme-surface-1 border-theme-divider text-theme-muted hover:text-white"
                        }`}
                      >
                        Submit Direct
                      </button>
                    </div>
                  </div>
                </div>

                {/* Entry Modes Tabs */}
                <div>
                  <div className="flex border-b border-theme-divider mb-4">
                    <button
                      type="button"
                      onClick={() => setEntryMode("manual")}
                      className={`px-4 py-2 text-xs font-bold font-display flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
                        entryMode === "manual" ? "border-blue-500 text-theme-body" : "border-transparent text-theme-muted hover:text-theme-body"
                      }`}
                    >
                      <Layers size={14} />
                      <span>Manual Scan / Resolve</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEntryMode("matrix")}
                      className={`px-4 py-2 text-xs font-bold font-display flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
                        entryMode === "matrix" ? "border-blue-500 text-theme-body" : "border-transparent text-theme-muted hover:text-theme-body"
                      }`}
                    >
                      <Grid size={14} />
                      <span>Matrix Grid Entry (SMRITI Footwear/Apparel)</span>
                    </button>
                  </div>

                  {/* Manual Entry Form */}
                  {entryMode === "manual" && (
                    <div className="bg-theme-surface-2 p-4 rounded-xl border border-theme-divider/50 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        <div className="sm:col-span-6">
                          <label className="text-[9px] font-mono text-theme-muted block mb-1">SELECT VARIANT</label>
                          <select
                            value={selectedProduct}
                            onChange={(e) => setSelectedProduct(e.target.value)}
                            className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                          >
                            <option value="">-- Choose Article Variant --</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.color || "N/A"} - Size {p.size || "N/A"}) - â‚¹{p.price} [SMR-Barcode: {p.barcode}]
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-3">
                          <label className="text-[9px] font-mono text-theme-muted block mb-1">QTY</label>
                          <input
                            type="number"
                            min="1"
                            value={manualQty}
                            onChange={(e) => setManualQty(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="text-[9px] font-mono text-theme-muted block mb-1">GST TAX %</label>
                          <select
                            value={manualTax}
                            onChange={(e) => setManualTax(parseInt(e.target.value) || 18)}
                            className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-2 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                          >
                            <option value="5">5% GST</option>
                            <option value="12">12% GST</option>
                            <option value="18">18% GST</option>
                            <option value="28">28% GST</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleAddManualItem}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          Add Item Line
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Matrix Entry Grid Form */}
                  {entryMode === "matrix" && (
                    <div className="bg-theme-surface-2 p-4 rounded-xl border border-theme-divider/50 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] font-mono text-theme-muted block mb-1">SELECT BASE ARTICLE</label>
                          <select
                            value={selectedBaseArticle}
                            onChange={(e) => {
                              setSelectedBaseArticle(e.target.value);
                              setSelectedBaseColor("");
                              setMatrixQuantities({});
                            }}
                            className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                          >
                            <option value="">-- Choose Base Article --</option>
                            {baseArticles.map(art => (
                              <option key={art} value={art}>{art}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] font-mono text-theme-muted block mb-1">SELECT COLOR</label>
                          <select
                            value={selectedBaseColor}
                            onChange={(e) => {
                              setSelectedBaseColor(e.target.value);
                              setMatrixQuantities({});
                            }}
                            disabled={!selectedBaseArticle}
                            className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500 disabled:opacity-50"
                          >
                            <option value="">-- Choose Color --</option>
                            {availableColors.map(col => (
                              <option key={col} value={col}>{col}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {selectedBaseArticle && selectedBaseColor && (
                        <div className="space-y-4 pt-2 border-t border-theme-divider/50">
                          <div className="bg-theme-surface-1 p-3.5 rounded-lg border border-theme-divider">
                            <h4 className="text-[10px] font-mono text-indigo-300 uppercase tracking-wider mb-3">VARIANT SIZE ALLOCATIONS MATRIX</h4>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                              {matrixVariants.map(variant => (
                                <div key={variant.id} className="bg-theme-surface-2 p-2 rounded border border-theme-divider/60 flex flex-col items-center">
                                  <span className="text-[10px] font-mono text-theme-muted">Size {variant.size || "OS"}</span>
                                  <span className="text-xs font-semibold text-theme-body mt-0.5">â‚¹{variant.price}</span>
                                  <span className="text-[9px] text-emerald-400 mt-0.5">Stock: {variant.stock}</span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={matrixQuantities[variant.id] || ""}
                                    placeholder="0"
                                    onChange={(e) => {
                                      const val = Math.max(0, parseInt(e.target.value) || 0);
                                      setMatrixQuantities({
                                        ...matrixQuantities,
                                        [variant.id]: val
                                      });
                                    }}
                                    className="w-full text-center bg-theme-surface-1 border border-theme-divider rounded mt-2 py-1 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={handleAddMatrixItems}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            >
                              Add Matrix Items to Draft
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Current Draft Items Table */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-mono uppercase tracking-wider text-theme-muted">Draft Item Lines List</h4>
                  
                  {editorItems.length === 0 ? (
                    <div className="p-8 text-center bg-theme-surface-2 border border-dashed border-theme-divider rounded-xl text-theme-muted text-xs">
                      No items added yet. Choose manual or matrix entry above to build the quotation document lines.
                    </div>
                  ) : (
                    <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-theme-surface-3 text-theme-muted uppercase font-mono text-[9px] tracking-wider border-b border-theme-divider">
                            <th className="px-4 py-2.5">Article / Variant</th>
                            <th className="px-4 py-2.5">Color/Size</th>
                            <th className="px-4 py-2.5 text-right">Qty</th>
                            <th className="px-4 py-2.5 text-right">Price</th>
                            <th className="px-4 py-2.5 text-right">GST %</th>
                            <th className="px-4 py-2.5 text-right">Tax (â‚¹)</th>
                            <th className="px-4 py-2.5 text-right">Total (â‚¹)</th>
                            <th className="px-4 py-2.5 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {editorItems.map((item, index) => {
                            const taxRate = item.taxRate || 18;
                            const baseTotal = item.quantity * item.price;
                            const taxAmount = (baseTotal * taxRate) / 100;
                            const lineTotal = baseTotal + taxAmount;

                            const relatedProd = products.find(p => p.id === item.productId || p.code === item.code);
                            const policyStr = localStorage.getItem("smriti_spif_display_policy");
                            const showImage = policyStr ? JSON.parse(policyStr).showInSales : true;
                            const hoverZoom = policyStr ? JSON.parse(policyStr).hoverZoom : true;
                            const imageSize = (policyStr ? JSON.parse(policyStr).salesSize : "small") as "small" | "medium";

                            return (
                              <tr key={index} className="border-b border-theme-divider/40 hover:bg-theme-surface-1 text-theme-body">
                                <td className="px-4 py-2">
                                  <div className="flex items-center space-x-3">
                                    {showImage && relatedProd?.primaryImageUrl && (
                                      <ProductImage
                                        src={relatedProd.primaryImageUrl}
                                        alt={item.name}
                                        size={imageSize}
                                        hoverZoom={hoverZoom}
                                      />
                                    )}
                                    <div>
                                      <div className="font-semibold">{item.name}</div>
                                      <div className="text-[10px] text-theme-muted font-mono">{item.code}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-2 font-mono">
                                  {item.color || "N/A"} / {item.size || "N/A"}
                                </td>
                                <td className="px-4 py-2 text-right font-mono font-semibold">
                                  {item.quantity}
                                </td>
                                <td className="px-4 py-2 text-right font-mono">
                                  â‚¹{item.price.toLocaleString("en-IN")}
                                </td>
                                <td className="px-4 py-2 text-right font-mono text-amber-400">
                                  {taxRate}%
                                </td>
                                <td className="px-4 py-2 text-right font-mono text-theme-muted">
                                  â‚¹{Math.round(taxAmount).toLocaleString("en-IN")}
                                </td>
                                <td className="px-4 py-2 text-right font-mono text-emerald-400 font-semibold">
                                  â‚¹{Math.round(lineTotal).toLocaleString("en-IN")}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveDraftItem(index)}
                                    className="p-1 rounded text-rose-500 hover:bg-rose-950/50 transition-colors"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {/* Summary Section */}
                      <div className="p-4 bg-theme-surface-3 border-t border-theme-divider text-xs text-theme-muted flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="text-[11px] leading-relaxed">
                          SMRITI tax engine automatically back-calculates and segregates SGST/CGST breakdown lines.
                        </div>
                        <div className="space-y-1 text-right w-full sm:w-auto">
                          <div>
                            Base Net Total: <span className="font-mono text-theme-body">â‚¹{editorItems.reduce((acc, item) => acc + (item.quantity * item.price), 0).toLocaleString("en-IN")}</span>
                          </div>
                          <div>
                            Taxes Consolidated: <span className="font-mono text-theme-body">â‚¹{editorItems.reduce((acc, item) => acc + ((item.quantity * item.price * (item.taxRate || 18)) / 100), 0).toFixed(1)}</span>
                          </div>
                          <div className="text-sm font-bold text-emerald-400">
                            Grand Quotation Total: â‚¹{editorItems.reduce((acc, item) => acc + (item.quantity * item.price * (1 + (item.taxRate || 18) / 100)), 0).toLocaleString("en-IN")}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Form Actions */}
                <div className="flex justify-end space-x-3 pt-4 border-t border-theme-divider/50">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingQuotation(false);
                      setEditorItems([]);
                    }}
                    className="px-4 py-2 rounded-lg bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-muted hover:text-theme-body text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel Draft
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveQuotation}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs shadow-lg transition-colors cursor-pointer"
                  >
                    Commit & Write Ledger
                  </button>
                </div>
              </div>
            </div>
          ) : isCreatingInvoice ? (
            /* Create New Sales Invoice Panel */
            <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl overflow-hidden shadow-xl animate-in fade-in duration-200">
              <div className="bg-theme-surface-3 border-b border-theme-divider px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-sm text-theme-body">Generate Sales Invoice</h3>
                  <p className="text-[11px] text-theme-muted">Generate commercial invoice with dual-mode entry</p>
                </div>
                <button 
                  onClick={() => setIsCreatingInvoice(false)}
                  className="p-1 rounded bg-theme-surface-hover text-theme-muted hover:text-theme-body transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Header Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-theme-surface-2 p-4 rounded-xl border border-theme-divider/50">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Select Customer *</label>
                    <select
                      value={invoiceCustomerId}
                      onChange={(e) => setInvoiceCustomerId(e.target.value)}
                      className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                    >
                      <option value="">-- Choose Customer Entity --</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.mobile}) - Outstanding: â‚¹{c.outstanding}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Is Interstate?</label>
                    <div className="flex items-center h-9">
                      <input
                        type="checkbox"
                        checked={invoiceIsInterstate}
                        onChange={(e) => setInvoiceIsInterstate(e.target.checked)}
                        className="rounded border-theme-divider bg-theme-surface-1 accent-indigo-500 mr-2 h-4 w-4"
                      />
                      <span className="text-xs text-theme-body">IGST (Interstate)</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">eWay Bill Number</label>
                    <input
                      type="text"
                      value={invoiceEWayBill}
                      onChange={(e) => setInvoiceEWayBill(e.target.value)}
                      placeholder="e.g. 123456789012"
                      className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-theme-surface-2 p-4 rounded-xl border border-theme-divider/40">
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Workflow Status</label>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => setInvoiceStatus("Draft")}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                          invoiceStatus === "Draft" 
                            ? "bg-[#2563EB] border-blue-500 text-theme-body" 
                            : "bg-theme-surface-1 border-theme-divider text-theme-muted hover:text-theme-body"
                        }`}
                      >
                        Keep Draft
                      </button>
                      <button
                        type="button"
                        onClick={() => setInvoiceStatus("Submitted")}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                          invoiceStatus === "Submitted" 
                            ? "bg-amber-600 border-amber-500 text-white" 
                            : "bg-theme-surface-1 border-theme-divider text-theme-muted hover:text-white"
                        }`}
                      >
                        Submit Invoice
                      </button>
                    </div>
                  </div>
                </div>

                {/* Entry Modes Tabs */}
                <div>
                  <div className="flex border-b border-theme-divider mb-4">
                    <button
                      type="button"
                      onClick={() => setEntryMode("manual")}
                      className={`px-4 py-2 text-xs font-bold font-display flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
                        entryMode === "manual" ? "border-blue-500 text-theme-body" : "border-transparent text-theme-muted hover:text-theme-body"
                      }`}
                    >
                      <Layers size={14} />
                      <span>Manual Scan / Resolve</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEntryMode("matrix")}
                      className={`px-4 py-2 text-xs font-bold font-display flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
                        entryMode === "matrix" ? "border-blue-500 text-theme-body" : "border-transparent text-theme-muted hover:text-theme-body"
                      }`}
                    >
                      <Grid size={14} />
                      <span>Matrix Grid Entry (SMRITI Footwear/Apparel)</span>
                    </button>
                  </div>

                  {/* Manual Entry Form */}
                  {entryMode === "manual" && (
                    <div className="bg-theme-surface-2 p-4 rounded-xl border border-theme-divider/50 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        <div className="sm:col-span-6">
                          <label className="text-[9px] font-mono text-theme-muted block mb-1">SELECT VARIANT</label>
                          <select
                            value={selectedProduct}
                            onChange={(e) => setSelectedProduct(e.target.value)}
                            className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                          >
                            <option value="">-- Choose Article Variant --</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.color || "N/A"} - Size {p.size || "N/A"}) - â‚¹{p.price} [SMR-Barcode: {p.barcode}]
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-3">
                          <label className="text-[9px] font-mono text-theme-muted block mb-1">QTY</label>
                          <input
                            type="number"
                            min="1"
                            value={manualQty}
                            onChange={(e) => setManualQty(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="text-[9px] font-mono text-theme-muted block mb-1">GST TAX %</label>
                          <select
                            value={manualTax}
                            onChange={(e) => setManualTax(parseInt(e.target.value) || 18)}
                            className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-2 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                          >
                            <option value="5">5% GST</option>
                            <option value="12">12% GST</option>
                            <option value="18">18% GST</option>
                            <option value="28">28% GST</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleAddManualItem}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          Add Item Line
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Matrix Entry Grid Form */}
                  {entryMode === "matrix" && (
                    <div className="bg-theme-surface-2 p-4 rounded-xl border border-theme-divider/50 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] font-mono text-theme-muted block mb-1">SELECT BASE ARTICLE</label>
                          <select
                            value={selectedBaseArticle}
                            onChange={(e) => {
                              setSelectedBaseArticle(e.target.value);
                              setSelectedBaseColor("");
                              setMatrixQuantities({});
                            }}
                            className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                          >
                            <option value="">-- Choose Base Article --</option>
                            {baseArticles.map(art => (
                              <option key={art} value={art}>{art}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] font-mono text-theme-muted block mb-1">SELECT COLOR</label>
                          <select
                            value={selectedBaseColor}
                            onChange={(e) => {
                              setSelectedBaseColor(e.target.value);
                              setMatrixQuantities({});
                            }}
                            disabled={!selectedBaseArticle}
                            className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500 disabled:opacity-50"
                          >
                            <option value="">-- Choose Color --</option>
                            {availableColors.map(col => (
                              <option key={col} value={col}>{col}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {selectedBaseArticle && selectedBaseColor && (
                        <div className="space-y-4 pt-2 border-t border-theme-divider/50">
                          <div className="bg-theme-surface-1 p-3.5 rounded-lg border border-theme-divider">
                            <h4 className="text-[10px] font-mono text-indigo-300 uppercase tracking-wider mb-3">VARIANT SIZE ALLOCATIONS MATRIX</h4>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                              {matrixVariants.map(variant => (
                                <div key={variant.id} className="bg-theme-surface-2 p-2 rounded border border-theme-divider/60 flex flex-col items-center">
                                  <span className="text-[10px] font-mono text-theme-muted">Size {variant.size || "OS"}</span>
                                  <span className="text-xs font-semibold text-theme-body mt-0.5">â‚¹{variant.price}</span>
                                  <span className="text-[9px] text-emerald-400 mt-0.5">Stock: {variant.stock}</span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={matrixQuantities[variant.id] || ""}
                                    placeholder="0"
                                    onChange={(e) => {
                                      const val = Math.max(0, parseInt(e.target.value) || 0);
                                      setMatrixQuantities({
                                        ...matrixQuantities,
                                        [variant.id]: val
                                      });
                                    }}
                                    className="w-full text-center bg-theme-surface-1 border border-theme-divider rounded mt-2 py-1 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={handleAddMatrixItems}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            >
                              Add Matrix Items to Draft
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Current Draft Items Table */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-mono uppercase tracking-wider text-theme-muted">Invoice Item Lines List</h4>
                  
                  {invoiceItems.length === 0 ? (
                    <div className="p-8 text-center bg-theme-surface-2 border border-dashed border-theme-divider rounded-xl text-theme-muted text-xs">
                      No items added yet. Choose manual or matrix entry above to build the invoice lines.
                    </div>
                  ) : (
                    <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-theme-surface-3 text-theme-muted uppercase font-mono text-[9px] tracking-wider border-b border-theme-divider">
                            <th className="px-4 py-2.5">Article / Variant</th>
                            <th className="px-4 py-2.5">Color/Size</th>
                            <th className="px-4 py-2.5 text-right">Qty</th>
                            <th className="px-4 py-2.5 text-right">Price</th>
                            <th className="px-4 py-2.5 text-right">GST %</th>
                            <th className="px-4 py-2.5 text-right">Tax (â‚¹)</th>
                            <th className="px-4 py-2.5 text-right">Total (â‚¹)</th>
                            <th className="px-4 py-2.5 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoiceItems.map((item, index) => {
                            const taxRate = item.taxRate || 18;
                            const baseTotal = item.quantity * item.price;
                            const taxAmount = (baseTotal * taxRate) / 100;
                            const lineTotal = baseTotal + taxAmount;

                            const relatedProd = products.find(p => p.id === item.productId || p.code === item.code);
                            const policyStr = localStorage.getItem("smriti_spif_display_policy");
                            const showImage = policyStr ? JSON.parse(policyStr).showInSales : true;
                            const hoverZoom = policyStr ? JSON.parse(policyStr).hoverZoom : true;
                            const imageSize = (policyStr ? JSON.parse(policyStr).salesSize : "small") as "small" | "medium";

                            return (
                              <tr key={index} className="border-b border-theme-divider/40 hover:bg-theme-surface-1 text-theme-body">
                                <td className="px-4 py-2">
                                  <div className="flex items-center space-x-3">
                                    {showImage && relatedProd?.primaryImageUrl && (
                                      <ProductImage
                                        src={relatedProd.primaryImageUrl}
                                        alt={item.name}
                                        size={imageSize}
                                        hoverZoom={hoverZoom}
                                      />
                                    )}
                                    <div>
                                      <div className="font-semibold">{item.name}</div>
                                      <div className="text-[10px] text-theme-muted font-mono">{item.code}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-2 font-mono">
                                  {item.color || "N/A"} / {item.size || "N/A"}
                                </td>
                                <td className="px-4 py-2 text-right font-mono font-semibold">
                                  {item.quantity}
                                </td>
                                <td className="px-4 py-2 text-right font-mono">
                                  â‚¹{item.price.toLocaleString("en-IN")}
                                </td>
                                <td className="px-4 py-2 text-right font-mono text-amber-400">
                                  {taxRate}%
                                </td>
                                <td className="px-4 py-2 text-right font-mono text-theme-muted">
                                  â‚¹{Math.round(taxAmount).toLocaleString("en-IN")}
                                </td>
                                <td className="px-4 py-2 text-right font-mono text-emerald-400 font-semibold">
                                  â‚¹{Math.round(lineTotal).toLocaleString("en-IN")}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveDraftItem(index)}
                                    className="p-1 rounded text-rose-500 hover:bg-rose-950/50 transition-colors"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {/* Summary Section */}
                      <div className="p-4 bg-theme-surface-3 border-t border-theme-divider text-xs text-theme-muted flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="text-[11px] leading-relaxed">
                          SMRITI tax engine automatically back-calculates and segregates SGST/CGST breakdown lines.
                        </div>
                        <div className="space-y-1 text-right w-full sm:w-auto">
                          <div>
                            Base Net Total: <span className="font-mono text-theme-body">â‚¹{invoiceItems.reduce((acc, item) => acc + (item.quantity * item.price), 0).toLocaleString("en-IN")}</span>
                          </div>
                          <div>
                            Taxes Consolidated: <span className="font-mono text-theme-body">â‚¹{invoiceItems.reduce((acc, item) => acc + ((item.quantity * item.price * (item.taxRate || 18)) / 100), 0).toFixed(1)}</span>
                          </div>
                          <div className="text-sm font-bold text-emerald-400">
                            Grand Invoice Total: â‚¹{invoiceItems.reduce((acc, item) => acc + (item.quantity * item.price * (1 + (item.taxRate || 18) / 100)), 0).toLocaleString("en-IN")}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Form Actions */}
                <div className="flex justify-end space-x-3 pt-4 border-t border-theme-divider/50">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingInvoice(false);
                      setInvoiceItems([]);
                    }}
                    className="px-4 py-2 rounded-lg bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-muted hover:text-theme-body text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel Draft
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveInvoice}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs shadow-lg transition-colors cursor-pointer"
                  >
                    Commit & Write Ledger
                  </button>
                </div>
              </div>
            </div>
          ) : isCreatingReturn ? (
            /* Record Sales Return Panel */
            <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl overflow-hidden shadow-xl animate-in fade-in duration-200">
              <div className="bg-theme-surface-3 border-b border-theme-divider px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-sm text-theme-body">Record Sales Return (Credit Note)</h3>
                  <p className="text-[11px] text-theme-muted">Select approved sales invoice to reverse items and record returns</p>
                </div>
                <button 
                  onClick={() => setIsCreatingReturn(false)}
                  className="p-1 rounded bg-theme-surface-hover text-theme-muted hover:text-theme-body transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Header Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-theme-surface-2 p-4 rounded-xl border border-theme-divider/50">
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Select Sales Invoice *</label>
                    <select
                      value={returnOriginalInvoiceId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setReturnOriginalInvoiceId(val);
                        const matchedInvoice = salesInvoices.find(si => si.id === val);
                        if (matchedInvoice) {
                          setReturnIsInterstate(matchedInvoice.isInterstate);
                          // populate returnItems
                          setReturnItems(matchedInvoice.items.map(item => ({
                            productId: item.productId,
                            name: item.name,
                            code: item.code,
                            gstRate: item.gstRate || 18,
                            price: item.price,
                            maxQty: item.quantity,
                            quantity: 0
                          })));
                        } else {
                          setReturnItems([]);
                        }
                      }}
                      className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-rose-500"
                    >
                      <option value="">-- Choose Sales Invoice --</option>
                      {salesInvoices.filter(si => si.status === "Approved" || si.status === "Submitted").map(si => {
                        const cust = customers.find(c => c.id === si.customerId);
                        return (
                          <option key={si.id} value={si.id}>
                            {si.invoiceNo} - {cust?.name || "Walk-In"} (â‚¹{si.grandTotal})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Return Reason *</label>
                    <select
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-rose-500"
                    >
                      <option value="Defective / Quality Issue">Defective / Quality Issue</option>
                      <option value="Product Exchange Requested">Product Exchange Requested</option>
                      <option value="Incorrect Size / Fitting">Incorrect Size / Fitting</option>
                      <option value="Wrong Item Dispatched">Wrong Item Dispatched</option>
                      <option value="Standard Retail Return">Standard Retail Return</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Is Interstate?</label>
                    <div className="flex items-center h-9">
                      <input
                        type="checkbox"
                        checked={returnIsInterstate}
                        onChange={(e) => setReturnIsInterstate(e.target.checked)}
                        className="rounded border-theme-divider bg-theme-surface-1 accent-rose-500 mr-2 h-4 w-4"
                      />
                      <span className="text-xs text-theme-body">IGST Interstate Return</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-theme-surface-2 p-4 rounded-xl border border-theme-divider/50">
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Workflow Status</label>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => setReturnStatus("Draft")}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                          returnStatus === "Draft" 
                            ? "bg-rose-900/80 border-rose-500 text-theme-body" 
                            : "bg-theme-surface-1 border-theme-divider text-theme-muted hover:text-theme-body"
                        }`}
                      >
                        Keep Draft
                      </button>
                      <button
                        type="button"
                        onClick={() => setReturnStatus("Submitted")}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                          returnStatus === "Submitted" 
                            ? "bg-amber-600 border-amber-500 text-white" 
                            : "bg-theme-surface-1 border-theme-divider text-theme-muted hover:text-white"
                        }`}
                      >
                        Submit Return
                      </button>
                    </div>
                  </div>
                </div>

                {/* Return Items List Table */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-mono uppercase tracking-wider text-theme-muted">Select Return Quantities from Invoice</h4>
                  
                  {returnItems.length === 0 ? (
                    <div className="p-8 text-center bg-theme-surface-2 border border-dashed border-theme-divider rounded-xl text-theme-muted text-xs">
                      Please select an approved sales invoice above to load invoice line details.
                    </div>
                  ) : (
                    <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-theme-surface-3 text-theme-muted uppercase font-mono text-[9px] tracking-wider border-b border-theme-divider">
                            <th className="px-4 py-2.5">Article / Variant</th>
                            <th className="px-4 py-2.5 text-right">Invoiced Qty</th>
                            <th className="px-4 py-2.5 text-right">Unit Price</th>
                            <th className="px-4 py-2.5 text-right">GST %</th>
                            <th className="px-4 py-2.5 text-right font-bold text-rose-400">Qty to Return</th>
                            <th className="px-4 py-2.5 text-right">Tax Reversal</th>
                            <th className="px-4 py-2.5 text-right">Total Reversal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {returnItems.map((item, index) => {
                            const taxAmount = (item.quantity * item.price * item.gstRate) / 100;
                            const lineTotal = (item.quantity * item.price) + taxAmount;

                            const relatedProd = products.find(p => p.id === item.productId || p.code === item.code);
                            const policyStr = localStorage.getItem("smriti_spif_display_policy");
                            const showImage = policyStr ? JSON.parse(policyStr).showInSales : true;
                            const hoverZoom = policyStr ? JSON.parse(policyStr).hoverZoom : true;
                            const imageSize = (policyStr ? JSON.parse(policyStr).salesSize : "small") as "small" | "medium";

                            return (
                              <tr key={index} className="border-b border-theme-divider/40 hover:bg-theme-surface-1 text-theme-body">
                                <td className="px-4 py-2">
                                  <div className="flex items-center space-x-3">
                                    {showImage && relatedProd?.primaryImageUrl && (
                                      <ProductImage
                                        src={relatedProd.primaryImageUrl}
                                        alt={item.name}
                                        size={imageSize}
                                        hoverZoom={hoverZoom}
                                      />
                                    )}
                                    <div>
                                      <div className="font-semibold">{item.name}</div>
                                      <div className="text-[10px] text-theme-muted font-mono">{item.code}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-2 text-right font-mono text-theme-muted">
                                  {item.maxQty} units
                                </td>
                                <td className="px-4 py-2 text-right font-mono">
                                  â‚¹{item.price.toLocaleString("en-IN")}
                                </td>
                                <td className="px-4 py-2 text-right font-mono text-amber-400">
                                  {item.gstRate}%
                                </td>
                                <td className="px-4 py-2 text-right">
                                  <input
                                    type="number"
                                    min="0"
                                    max={item.maxQty}
                                    value={item.quantity || ""}
                                    placeholder="0"
                                    onChange={(e) => {
                                      const val = Math.min(item.maxQty, Math.max(0, parseInt(e.target.value) || 0));
                                      const updated = [...returnItems];
                                      updated[index].quantity = val;
                                      setReturnItems(updated);
                                    }}
                                    className="w-20 text-center bg-theme-surface-1 border border-theme-divider rounded py-1 text-xs text-theme-body focus:outline-none focus:border-rose-500"
                                  />
                                </td>
                                <td className="px-4 py-2 text-right font-mono text-theme-muted">
                                  â‚¹{Math.round(taxAmount).toLocaleString("en-IN")}
                                </td>
                                <td className="px-4 py-2 text-right font-mono text-rose-400 font-semibold">
                                  â‚¹{Math.round(lineTotal).toLocaleString("en-IN")}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {/* Summary Section */}
                      <div className="p-4 bg-theme-surface-3 border-t border-theme-divider text-xs text-theme-muted flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="text-[11px] leading-relaxed">
                          SMRITI return manager will auto-generate an approved Credit Note voucher upon submission.
                        </div>
                        <div className="space-y-1 text-right w-full sm:w-auto">
                          <div className="text-sm font-bold text-rose-400">
                            Total Credit Note Value: â‚¹{returnItems.reduce((acc, item) => acc + (item.quantity * item.price * (1 + item.gstRate / 100)), 0).toLocaleString("en-IN")}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Form Actions */}
                <div className="flex justify-end space-x-3 pt-4 border-t border-theme-divider/50">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingReturn(false);
                      setReturnItems([]);
                    }}
                    className="px-4 py-2 rounded-lg bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-muted hover:text-theme-body text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel Return
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveReturn}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs shadow-lg transition-colors cursor-pointer"
                  >
                    Record Credit Note
                  </button>
                </div>
              </div>
            </div>
          ) : isAddingCustomer ? (
            /* Manual Customer Entry Panel */
            <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl overflow-hidden shadow-xl animate-in fade-in duration-200">
              <div className="bg-theme-surface-3 border-b border-theme-divider px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-sm text-theme-body flex items-center space-x-2">
                    <User size={16} className="text-indigo-400" />
                    <span>Create Customer Profile</span>
                  </h3>
                  <p className="text-[11px] text-theme-muted">Register a single client with real-time Smriti verification</p>
                </div>
                <button 
                  onClick={() => {
                    setIsAddingCustomer(false);
                    setNewCustomerName("");
                    setNewCustomerMobile("");
                    setNewCustomerEmail("");
                    setNewCustomerGst("");
                    setNewCustomerPan("");
                    setNewCustomerGroup("CG-Retail");
                    setNewCustomerStatus("Active");
                    setManualValidationErrors([]);
                  }}
                  className="p-1 rounded bg-theme-surface-hover text-theme-muted hover:text-theme-body transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Name */}
                <div className="space-y-1.5">
                  <label htmlFor="new-cust-name" className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block">Customer Full Name *</label>
                  <input
                    type="text"
                    id="new-cust-name"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3 py-2 bg-theme-surface-2 border border-theme-divider rounded-lg text-xs text-theme-body focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Mobile */}
                  <div className="space-y-1.5">
                    <label htmlFor="new-cust-mobile" className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block">Mobile Number (10 Digits) *</label>
                    <input
                      type="text"
                      id="new-cust-mobile"
                      value={newCustomerMobile}
                      onChange={(e) => setNewCustomerMobile(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full px-3 py-2 bg-theme-surface-2 border border-theme-divider rounded-lg text-xs text-theme-body focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label htmlFor="new-cust-email" className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block">Email Address *</label>
                    <input
                      type="email"
                      id="new-cust-email"
                      value={newCustomerEmail}
                      onChange={(e) => setNewCustomerEmail(e.target.value)}
                      placeholder="e.g. rahul@sharma.com"
                      className="w-full px-3 py-2 bg-theme-surface-2 border border-theme-divider rounded-lg text-xs text-theme-body focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* GSTIN */}
                  <div className="space-y-1.5">
                    <label htmlFor="new-cust-gst" className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block">GSTIN (Optional)</label>
                    <input
                      type="text"
                      id="new-cust-gst"
                      value={newCustomerGst}
                      onChange={(e) => setNewCustomerGst(e.target.value)}
                      placeholder="e.g. 27AAACS1094J1Z3"
                      className="w-full px-3 py-2 bg-theme-surface-2 border border-theme-divider rounded-lg text-xs text-theme-body focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                    />
                  </div>

                  {/* PAN */}
                  <div className="space-y-1.5">
                    <label htmlFor="new-cust-pan" className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block">PAN Number (Optional)</label>
                    <input
                      type="text"
                      id="new-cust-pan"
                      value={newCustomerPan}
                      onChange={(e) => setNewCustomerPan(e.target.value)}
                      placeholder="e.g. ABCDE1234F"
                      className="w-full px-3 py-2 bg-theme-surface-2 border border-theme-divider rounded-lg text-xs text-theme-body focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Group */}
                  <div className="space-y-1.5">
                    <label htmlFor="new-cust-group" className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block">Customer Group *</label>
                    <select
                      id="new-cust-group"
                      value={newCustomerGroup}
                      onChange={(e) => setNewCustomerGroup(e.target.value)}
                      className="w-full px-3 py-2 bg-theme-surface-2 border border-theme-divider rounded-lg text-xs text-theme-body focus:outline-none focus:border-indigo-500 transition-colors"
                    >
                      {customerGroups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Status */}
                  <div className="space-y-1.5">
                    <label htmlFor="new-cust-status" className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block">Profile Status</label>
                    <select
                      id="new-cust-status"
                      value={newCustomerStatus}
                      onChange={(e) => setNewCustomerStatus(e.target.value as any)}
                      className="w-full px-3 py-2 bg-theme-surface-2 border border-theme-divider rounded-lg text-xs text-theme-body focus:outline-none focus:border-indigo-500 transition-colors"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Blocked">Blocked</option>
                    </select>
                  </div>
                </div>

                {/* Validation Errors Panel */}
                {manualValidationErrors.length > 0 && (
                  <div className="p-4 bg-rose-950/40 border border-rose-900 rounded-xl space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                    <span className="text-[10px] font-mono text-rose-400 font-bold uppercase tracking-wider block">Validation Blocked</span>
                    <ul className="list-disc list-inside text-[11px] text-rose-300 space-y-1">
                      {manualValidationErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Submit Controls */}
                <div className="pt-4 border-t border-theme-divider/50 flex items-center justify-between">
                  <div>
                    {isManualValidatingOnServer && (
                      <span className="flex items-center space-x-1.5 text-[10px] text-indigo-400 font-medium font-mono animate-pulse">
                        <RefreshCw size={10} className="animate-spin text-indigo-400" />
                        <span>Verifying with Smriti Server...</span>
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingCustomer(false);
                        setManualValidationErrors([]);
                      }}
                      className="px-4 py-2 rounded-lg bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-muted hover:text-theme-body text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (isReadOnly) {
                          onNotification("Access Denied", "Operating under a Read-Only Report User role. Write operations are prohibited.", "error");
                          return;
                        }
                        setManualValidationErrors([]);
                        setIsManualValidatingOnServer(true);

                        const payload = {
                          name: newCustomerName,
                          mobile: newCustomerMobile,
                          email: newCustomerEmail,
                          gstNumber: newCustomerGst,
                          pan: newCustomerPan,
                          customerGroupId: newCustomerGroup,
                          status: newCustomerStatus,
                          outstanding: 0
                        };

                        try {
                          const data = await apiFetchV1("/customers/validate-add", {
                            method: "POST",
                            body: JSON.stringify({
                              customer: payload,
                              existingCustomers: customers
                            })
                          });
                          setIsManualValidatingOnServer(false);

                          if (!data.valid) {
                            setManualValidationErrors(data.errors || ["Unknown validation failure."]);
                            onNotification("Validation Blocked", "Please resolve duplicate profiles or form input format.", "error");
                            return;
                          }

                          // Success! Commit to Customer Store
                          const nextIdIdx = customers.length;
                          const nextIdStr = `CUST-${String(nextIdIdx + 1).padStart(3, "0")}`;
                          const newCustObj: Customer = {
                            id: nextIdStr,
                            customerGroupId: newCustomerGroup,
                            name: newCustomerName,
                            mobile: newCustomerMobile,
                            email: newCustomerEmail,
                            gstNumber: newCustomerGst || undefined,
                            pan: newCustomerPan || undefined,
                            outstanding: 0,
                            status: newCustomerStatus,
                            createdDate: new Date().toISOString().split("T")[0]
                          };

                          const updatedCustomersList = [...customers, newCustObj];
                          saveCustomers(updatedCustomersList);
                          fetchCustomers();

                          setIsAddingCustomer(false);
                          onNotification("Customer Created", `Successfully registered ${newCustomerName} with ID ${nextIdStr}`, "success");
                        } catch (err) {
                          console.error("Manual customer validation failed:", err);
                          setManualValidationErrors(["Smriti Network validation timed out. Please try again."]);
                          setIsManualValidatingOnServer(false);
                        }
                      }}
                      disabled={isManualValidatingOnServer}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs shadow-lg hover:shadow-indigo-900/30 transition-all cursor-pointer"
                    >
                      {isManualValidatingOnServer ? "Verifying..." : "Register Customer"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : isImportingCustomers ? (
            /* Customer CSV Import Panel */
            <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl overflow-hidden shadow-xl animate-in fade-in duration-200">
              <div className="bg-theme-surface-3 border-b border-theme-divider px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-sm text-theme-body flex items-center space-x-2">
                    <FileSpreadsheet size={16} className="text-indigo-400" />
                    <span>Bulk Import Customers (CSV)</span>
                  </h3>
                  <p className="text-[11px] text-theme-muted">Upload and validate local CSV files to expand the customer ledger</p>
                </div>
                <button 
                  onClick={() => {
                    setIsImportingCustomers(false);
                    setCsvFile(null);
                    setRawCsvText("");
                  }}
                  className="p-1 rounded bg-theme-surface-hover text-theme-muted hover:text-theme-body transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: Drag & Drop and Settings */}
                  <div className="space-y-4">
                    <div 
                      onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                      onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                      onDrop={(e) => { 
                        e.preventDefault(); 
                        setDragActive(false); 
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          const file = e.dataTransfer.files[0];
                          if (!file.name.endsWith(".csv")) {
                            onNotification("Invalid File", "Please upload a valid CSV file.", "error");
                            return;
                          }
                          setCsvFile(file);
                          const reader = new FileReader();
                          reader.onload = (ev) => setRawCsvText(ev.target?.result as string);
                          reader.readAsText(file);
                        }
                      }}
                      className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                        dragActive 
                          ? "border-indigo-500 bg-indigo-950/20" 
                          : "border-theme-divider hover:border-theme-muted bg-theme-surface-2/40 hover:bg-theme-surface-2/70"
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-indigo-950 flex items-center justify-center text-indigo-400 border border-indigo-900">
                          <Upload size={22} />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-theme-body block">
                            {csvFile ? csvFile.name : "Drag and drop your customer CSV file here"}
                          </span>
                          <span className="text-[11px] text-theme-muted mt-1 block">
                            {csvFile ? `${(csvFile.size / 1024).toFixed(1)} KB` : "Or click standard file browser to locate"}
                          </span>
                        </div>
                        <label className="px-4 py-2 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-muted hover:text-theme-body text-xs font-semibold rounded-lg cursor-pointer transition-colors shadow-sm">
                          Choose File
                          <input 
                            type="file" 
                            accept=".csv" 
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                const file = e.target.files[0];
                                if (!file.name.endsWith(".csv")) {
                                  onNotification("Invalid File", "Please upload a valid CSV file.", "error");
                                  return;
                                }
                                setCsvFile(file);
                                const reader = new FileReader();
                                reader.onload = (ev) => setRawCsvText(ev.target?.result as string);
                                reader.readAsText(file);
                              }
                            }} 
                            className="hidden" 
                          />
                        </label>
                      </div>
                    </div>

                    {/* Guidelines */}
                    <div className="bg-theme-surface-2 p-5 rounded-xl border border-theme-divider space-y-4">
                      <div className="flex items-center space-x-2 text-indigo-400">
                        <Info size={16} />
                        <span className="text-xs font-bold font-display uppercase tracking-wider">CSV Format Guidelines</span>
                      </div>
                      <p className="text-[11px] text-theme-muted leading-relaxed">
                        SMRITI automatically scans, maps, and validates columns. For perfect results, we recommend using these headers or equivalents:
                      </p>
                      <div className="grid grid-cols-2 gap-3 text-[10px] font-mono text-theme-muted bg-theme-surface-1 p-3 rounded-lg border border-theme-divider/60">
                        <div><span className="text-theme-body font-semibold">Name</span> (Required)</div>
                        <div><span className="text-theme-body font-semibold">Mobile</span> (Required, 10 digits)</div>
                        <div><span className="text-theme-body font-semibold">Email</span> (Required, valid format)</div>
                        <div><span className="text-theme-body font-semibold">Group</span> (Required, Retail/Corporate)</div>
                        <div><span className="text-theme-body font-semibold">GSTIN</span> (Optional)</div>
                        <div><span className="text-theme-body font-semibold">PAN</span> (Optional)</div>
                        <div><span className="text-theme-body font-semibold">Status</span> (Active, Inactive, Blocked)</div>
                        <div><span className="text-theme-body font-semibold">Outstanding</span> (Balance due)</div>
                      </div>
                      
                      <div className="flex justify-between items-center pt-2 border-t border-theme-divider/40">
                        <div className="flex items-center space-x-2">
                          <input 
                            type="checkbox" 
                            id="firstRowHeader"
                            checked={firstRowHeader}
                            onChange={(e) => setFirstRowHeader(e.target.checked)}
                            className="rounded border-theme-divider bg-theme-surface-1 accent-indigo-500 h-3.5 w-3.5"
                          />
                          <label htmlFor="firstRowHeader" className="text-xs text-theme-body select-none cursor-pointer">
                            First row contains column headers
                          </label>
                        </div>
                        <button 
                          onClick={() => {
                            const headers = ["Name", "Mobile", "Email", "GSTIN", "PAN", "Group", "Status", "Outstanding"];
                            const sampleData = [
                              ["Rahul Sharma", "9876543210", "rahul.sharma@gmail.com", "27AAACS1094J1Z3", "ABCDE1234F", "Retail", "Active", "15000"],
                              ["Super Textiles Ltd", "9988776655", "finance@supertextiles.com", "27AAACS1094J1Z3", "ABCDE1234F", "Corporate Clients", "Active", "450000"],
                              ["Ananya Iyer", "9123456789", "ananya@iyer.com", "", "", "Franchise Partners", "Active", "0"]
                            ];
                            const csvContent = [headers, ...sampleData]
                              .map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(","))
                              .join("\n");
                            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement("a");
                            link.setAttribute("href", url);
                            link.setAttribute("download", "smriti_customers_import_template.csv");
                            link.style.visibility = "hidden";
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          className="px-3 py-1.5 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-muted hover:text-theme-body text-[10px] font-bold rounded-lg flex items-center space-x-1 transition-colors"
                        >
                          <Download size={12} />
                          <span>Download Sample CSV</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Processing Summary */}
                  <div className="flex flex-col h-full justify-between">
                    {parsedRows.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-theme-surface-2/40 border border-theme-divider rounded-xl">
                        <FileSpreadsheet size={32} className="text-theme-muted/50 mb-3" />
                        <h4 className="text-xs font-bold text-theme-body">No File Uploaded</h4>
                        <p className="text-[11px] text-theme-muted max-w-xs mt-1">Upload a customer CSV list on the left to run automatic validations and preview imported records.</p>
                      </div>
                    ) : (
                      <div className="flex-1 space-y-4 bg-theme-surface-2 p-5 rounded-xl border border-theme-divider flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-theme-body uppercase tracking-wider font-display">Validation Report</h4>
                            {isValidatingOnServer ? (
                              <span className="flex items-center space-x-1 text-[10px] text-indigo-400 font-medium animate-pulse bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-900">
                                <RefreshCw size={10} className="animate-spin text-indigo-400" />
                                <span>Verifying with Smriti Server...</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-emerald-400 font-medium flex items-center space-x-1 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900">
                                <CheckCircle2 size={10} className="text-emerald-400" />
                                <span>Server Verified</span>
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="bg-theme-surface-3 p-3 rounded-lg border border-theme-divider text-center">
                              <span className="text-[9px] font-mono text-theme-muted block uppercase">TOTAL DETECTED</span>
                              <span className="text-base font-bold font-display text-theme-body">{parsedRows.length}</span>
                            </div>
                            <div className="bg-emerald-950/20 p-3 rounded-lg border border-emerald-900/50 text-center">
                              <span className="text-[9px] font-mono text-emerald-400/80 block uppercase">READY TO IMPORT</span>
                              <span className="text-base font-bold font-display text-emerald-400">
                                {parsedRows.filter(r => r.errors.length === 0).length}
                              </span>
                            </div>
                            <div className="bg-rose-950/20 p-3 rounded-lg border border-rose-900/50 text-center">
                              <span className="text-[9px] font-mono text-rose-400/80 block uppercase">ERRORS / INVALID</span>
                              <span className="text-base font-bold font-display text-rose-400">
                                {parsedRows.filter(r => r.errors.length > 0).length}
                              </span>
                            </div>
                          </div>

                          {/* Critical status feedback */}
                          {parsedRows.filter(r => r.errors.length > 0).length > 0 ? (
                            <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-lg text-[11px] text-amber-300 flex items-start space-x-2">
                              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                              <span>
                                Some customer records contain invalid or missing data (e.g. missing mobile number) and will be skipped automatically during the import phase.
                              </span>
                            </div>
                          ) : (
                            <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-lg text-[11px] text-emerald-300 flex items-start space-x-2">
                              <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
                              <span>
                                All records passed initial ledger checks successfully. The customer profiles are structural duplicates-free and format-compliant.
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="pt-4 border-t border-theme-divider flex justify-end space-x-3">
                          <button
                            type="button"
                            onClick={() => {
                              setCsvFile(null);
                              setRawCsvText("");
                              setParsedRows([]);
                            }}
                            className="px-4 py-2 rounded-lg bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-muted hover:text-theme-body text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Reset Upload
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (isReadOnly) {
                                onNotification("Access Denied", "Operating under a Read-Only Report User role. Write operations are prohibited.", "error");
                                return;
                              }
                              const validRows = parsedRows.filter(r => r.errors.length === 0);
                              if (validRows.length === 0) {
                                onNotification("No Valid Records", "There are no valid customer records to import.", "error");
                                return;
                              }
                              
                              const importedCustomers: Customer[] = validRows.map((row, idx) => {
                                const newId = generateNextCustomerId(customers, idx);
                                return {
                                  id: newId,
                                  customerGroupId: row.customerGroupId,
                                  name: row.name,
                                  mobile: row.mobile,
                                  email: row.email || undefined,
                                  gstNumber: row.gstNumber || undefined,
                                  pan: row.pan || undefined,
                                  outstanding: row.outstanding,
                                  status: row.status,
                                  createdDate: new Date().toISOString().split("T")[0]
                                };
                              });

                              const consolidatedList = [...customers, ...importedCustomers];
                              saveCustomers(consolidatedList);
                              fetchCustomers();
                              
                              setIsImportingCustomers(false);
                              setCsvFile(null);
                              setRawCsvText("");
                              setParsedRows([]);
                              
                              onNotification("Import Complete", `Successfully imported ${importedCustomers.length} customer profiles to SMRITI ledger.`, "success");
                            }}
                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs shadow-lg transition-colors cursor-pointer flex items-center space-x-2"
                          >
                            <CheckCircle2 size={14} />
                            <span>Confirm & Import {parsedRows.filter(r => r.errors.length === 0).length} Customers</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Preview Table Section */}
                {parsedRows.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-theme-divider/50">
                    <h4 className="text-xs font-bold text-theme-body uppercase tracking-wider font-display">Parsed Customer Data Preview</h4>
                    <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-theme-surface-3 text-theme-muted uppercase font-mono text-[9px] tracking-wider border-b border-theme-divider sticky top-0">
                            <th className="px-4 py-3">Row</th>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Mobile Contact</th>
                            <th className="px-4 py-3">Customer Tier / Group</th>
                            <th className="px-4 py-3 text-right">Starting Bal</th>
                            <th className="px-4 py-3 text-center">Status</th>
                            <th className="px-4 py-3 text-center">Validation Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedRows.map((row, idx) => (
                            <tr key={idx} className="border-b border-theme-divider/40 hover:bg-theme-surface-1 text-theme-body">
                              <td className="px-4 py-2 font-mono text-theme-muted">{row.rowNumber}</td>
                              <td className="px-4 py-2">
                                <div className="font-semibold">{row.name}</div>
                                {row.email && <div className="text-[10px] text-theme-muted font-mono">{row.email}</div>}
                              </td>
                              <td className="px-4 py-2 font-mono">
                                {row.mobile || <span className="text-rose-500 italic font-sans">Missing Contact</span>}
                              </td>
                              <td className="px-4 py-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-theme-surface-3 text-theme-muted border border-theme-divider uppercase">
                                  {customerGroups.find(g => g.id === row.customerGroupId)?.name || row.customerGroupId}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-right font-mono text-theme-body font-semibold">
                                â‚¹{row.outstanding.toLocaleString("en-IN")}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  row.status === "Active" ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800" :
                                  row.status === "Inactive" ? "bg-theme-surface-3 text-theme-muted border border-theme-divider" :
                                  "bg-rose-950/80 text-rose-400 border border-rose-800"
                                }`}>
                                  {row.status}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-center">
                                {row.errors.length > 0 ? (
                                  <div className="flex items-center justify-center space-x-1 text-rose-400" title={row.errors.join(", ")}>
                                    <XCircle size={14} />
                                    <span className="text-[10px] font-bold uppercase">Invalid</span>
                                  </div>
                                ) : row.warnings.length > 0 ? (
                                  <div className="flex items-center justify-center space-x-1 text-amber-400" title={row.warnings.join(", ")}>
                                    <AlertTriangle size={14} />
                                    <span className="text-[10px] font-bold uppercase">Warning</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center space-x-1 text-emerald-400">
                                    <CheckCircle2 size={14} />
                                    <span className="text-[10px] font-bold uppercase">Ready</span>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Standard Ledger Lists View */
            <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl overflow-hidden shadow-lg">
              <div className="p-4 bg-theme-surface-3 border-b border-theme-divider flex items-center justify-between">
                <span className="text-xs font-bold font-display uppercase tracking-wider text-theme-body">
                  {subView === "quotations" ? "Quotations Registry" : subView === "orders" ? "Sales Orders Registry" : subView === "invoices" ? "Sales Invoices Registry" : subView === "returns" ? "Sales Returns Registry" : "Customers Directory"}
                </span>
                <span className="text-[10px] font-mono text-theme-muted">
                  {subView === "quotations" ? `${quotations.length} Active Records` : subView === "orders" ? `${salesOrders.length} Confirmed Bookings` : subView === "invoices" ? `${salesInvoices.length} Registered Invoices` : subView === "returns" ? `${salesReturns.length} Logged Returns` : customerSearchQuery ? `${filteredCustomers.length} of ${customers.length} Filtered Profiles` : `${customers.length} Client Profiles`}
                </span>
              </div>

              {/* Real-time Customer Search Sub-bar */}
              {subView === "customers" && !loading && (
                <div className="px-4 py-3 bg-theme-surface-2 border-b border-theme-divider flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1 max-w-md">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-theme-muted">
                        <Search size={14} />
                      </div>
                      <input
                        type="text"
                        id="customer-search-input"
                        value={customerSearchQuery}
                        onChange={(e) => setCustomerSearchQuery(e.target.value)}
                        placeholder="Filter by name, phone, email or tags..."
                        className="w-full pl-9 pr-14 py-1.5 bg-theme-surface-1 border border-theme-divider rounded-lg text-xs text-theme-body placeholder-theme-muted focus:outline-none focus:border-indigo-500/80 transition-colors"
                      />
                      {customerSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setCustomerSearchQuery("")}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-theme-muted hover:text-theme-body text-[10px] font-bold font-mono"
                        >
                          CLEAR
                        </button>
                      )}
                    </div>

                    {/* Filter by Tag Dropdown */}
                    <div className="flex items-center space-x-2">
                      <label htmlFor="tag-filter-select" className="text-[10px] font-mono text-theme-muted uppercase tracking-wider whitespace-nowrap">
                        Filter by Tag:
                      </label>
                      <select
                        id="tag-filter-select"
                        value={selectedTagFilter}
                        onChange={(e) => setSelectedTagFilter(e.target.value)}
                        className="px-3 py-1.5 bg-theme-surface-1 border border-theme-divider rounded-lg text-xs text-theme-body focus:outline-none focus:border-indigo-500/80 transition-colors"
                      >
                        <option value="">All Tags</option>
                        {Array.from(new Set(customers.flatMap(c => c.tags || []))).filter(Boolean).sort().map(tag => (
                          <option key={tag} value={tag}>{tag}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {(customerSearchQuery || selectedTagFilter) && (
                      <button
                        onClick={() => {
                          setCustomerSearchQuery("");
                          setSelectedTagFilter("");
                        }}
                        className="text-[10px] text-theme-muted hover:text-theme-body font-bold font-mono uppercase bg-theme-surface-3 hover:bg-theme-surface-hover px-2.5 py-1 rounded border border-theme-divider transition-colors cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                    <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/40 border border-indigo-900 px-2 py-1 rounded">
                      Found {filteredCustomers.length} match{filteredCustomers.length === 1 ? "" : "es"}
                    </span>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="p-16 flex flex-col items-center justify-center space-y-3">
                  <RefreshCw className="animate-spin text-blue-500" size={24} />
                  <span className="text-xs text-theme-muted">Syncing real-time ledger data...</span>
                </div>
              ) : subView === "quotations" ? (
                /* Quotations Registry Table */
                quotations.length === 0 ? (
                  <div className="p-16 text-center text-theme-muted text-xs">
                    No quotations match the current filters or none exist in SMRITI.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-theme-surface-2 text-theme-muted uppercase font-mono text-[9px] tracking-wider border-b border-theme-divider">
                          <th className={`px-5 ${densityPadding} w-10`}>
                            <input
                              type="checkbox"
                              checked={quotations.length > 0 && selectedIds.size === quotations.length}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedIds(new Set(quotations.map(q => q.id)));
                                else setSelectedIds(new Set());
                              }}
                              className="rounded border-theme-divider bg-theme-surface-1 accent-indigo-500"
                            />
                          </th>
                          <th className={`px-5 ${densityPadding}`}>Quotation No</th>
                          <th className={`px-5 ${densityPadding}`}>Client Name</th>
                          <th className={`px-5 ${densityPadding}`}>Document Date</th>
                          <th className={`px-5 ${densityPadding} text-right`}>Items Count</th>
                          <th className={`px-5 ${densityPadding} text-right`}>Grand Total</th>
                          <th className={`px-5 ${densityPadding} text-center`}>Status</th>
                          <th className={`px-5 ${densityPadding} text-center`}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quotations.map(q => (
                          <tr 
                            key={q.id} 
                            onClick={() => setSelectedQuotation(q)}
                            className={`border-b border-theme-divider/40 hover:bg-theme-surface-3/50 cursor-pointer transition-colors ${
                              selectedQuotation?.id === q.id ? "bg-theme-surface-3" : ""
                            }`}
                          >
                            <td className={`px-5 ${densityPadding}`} onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(q.id)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedIds);
                                  if (e.target.checked) newSet.add(q.id);
                                  else newSet.delete(q.id);
                                  setSelectedIds(newSet);
                                }}
                                className="rounded border-theme-divider bg-theme-surface-1 accent-indigo-500"
                              />
                            </td>
                            <td className={`px-5 ${densityPadding} font-mono font-bold text-theme-body flex items-center space-x-2`}>
                              <FileText size={13} className="text-theme-muted" />
                              <span>{q.quotationNo}</span>
                            </td>
                            <td className={`px-5 ${densityPadding} text-theme-body font-medium`}>{q.customerName}</td>
                            <td className={`px-5 ${densityPadding} text-theme-muted font-mono`}>
                              {formatDateTime(q.date)}
                            </td>
                            <td className={`px-5 ${densityPadding} text-right font-mono text-theme-muted`}>
                              {q.items.reduce((acc, i) => acc + i.quantity, 0)} units
                            </td>
                            <td className={`px-5 ${densityPadding} text-right font-mono font-semibold text-emerald-400`}>
                              {formatCurrency(q.grandTotal)}
                            </td>
                            <td className={`px-5 ${densityPadding} text-center`}>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                q.status === "Draft" ? "bg-theme-surface-3 text-theme-muted border border-theme-divider" :
                                q.status === "Submitted" ? "bg-amber-950/80 text-amber-400 border border-amber-800" :
                                "bg-emerald-950/80 text-emerald-400 border border-emerald-800"
                              }`}>
                                {q.status}
                              </span>
                            </td>
                            <td className={`px-5 ${densityPadding} text-center`} onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center space-x-2">
                                <button
                                  onClick={() => setSelectedQuotation(q)}
                                  className="p-1 rounded hover:bg-theme-surface-3 text-sky-400"
                                  title="View Quotation"
                                >
                                  <Eye size={14} />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); onNotification("Print", "Printing Quotation " + q.quotationNo, "success"); window.print(); }} className="p-1 rounded hover:bg-theme-surface-3 text-slate-400" title="Print"><Printer size={14} /></button>
                                <button onClick={(e) => { e.stopPropagation(); onNotification("WhatsApp", "Generating PDF for WhatsApp", "success"); window.open('https://wa.me/?text=Quotation%20' + q.quotationNo); }} className="p-1 rounded hover:bg-theme-surface-3 text-emerald-400" title="WhatsApp"><MessageCircle size={14} /></button>
                                <button onClick={(e) => { e.stopPropagation(); onNotification("Email", "Drafting Email with PDF", "success"); window.open('mailto:?subject=Quotation%20' + q.quotationNo); }} className="p-1 rounded hover:bg-theme-surface-3 text-blue-400" title="Email"><Mail size={14} /></button>
                                
                                {q.status === "Draft" && (
                                  <button
                                    onClick={() => handleWorkflowAction("Quotation", q.id, "submit")}
                                    className="p-1 rounded hover:bg-indigo-950 text-indigo-400"
                                    title="Submit Quotation"
                                  >
                                    <ArrowRight size={14} />
                                  </button>
                                )}
                                {q.status === "Submitted" && (
                                  <>
                                    <button
                                      onClick={() => handleWorkflowAction("Quotation", q.id, "approve")}
                                      className="p-1 rounded hover:bg-emerald-950 text-emerald-400"
                                      title="Approve"
                                    >
                                      <CheckCircle2 size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleWorkflowAction("Quotation", q.id, "reject")}
                                      className="p-1 rounded hover:bg-rose-950 text-rose-400"
                                      title="Reject"
                                    >
                                      <X size={14} />
                                    </button>
                                  </>
                                )}
                                {q.status === "Approved" && (
                                  <button
                                    onClick={() => handleConvertQuotation(q.id)}
                                    className="p-1 rounded hover:bg-emerald-950 text-emerald-400"
                                    title="Convert to Sales Order"
                                  >
                                    <FileCheck size={14} />
                                  </button>
                                )}
                                {q.status === "Draft" && (
                                  <button
                                    onClick={() => handleDeleteQuotation(q.id)}
                                    className="p-1 rounded hover:bg-rose-950 text-rose-400"
                                    title="Delete Draft"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : subView === "orders" ? (
                /* Sales Orders Book Registry */
                salesOrders.length === 0 ? (
                  <div className="p-16 text-center text-theme-muted text-xs">
                    No confirmed sales bookings match current filters or none exist in SMRITI.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-theme-surface-2 text-theme-muted uppercase font-mono text-[9px] tracking-wider border-b border-theme-divider">
                          <th className={`px-5 ${densityPadding} w-10`}>
                            <input
                              type="checkbox"
                              checked={salesOrders.length > 0 && selectedIds.size === salesOrders.length}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedIds(new Set(salesOrders.map(o => o.id)));
                                else setSelectedIds(new Set());
                              }}
                              className="rounded border-theme-divider bg-theme-surface-1 accent-indigo-500"
                            />
                          </th>
                          <th className={`px-5 ${densityPadding}`}>Order No</th>
                          <th className={`px-5 ${densityPadding}`}>Client Name</th>
                          <th className={`px-5 ${densityPadding}`}>Order Date</th>
                          <th className={`px-5 ${densityPadding} text-right`}>Items Booking</th>
                          <th className={`px-5 ${densityPadding} text-right`}>Booked Value</th>
                          <th className={`px-5 ${densityPadding} text-center`}>Status</th>
                          <th className={`px-5 ${densityPadding} text-center`}>Source QTN</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesOrders.map(so => (
                          <tr 
                            key={so.id} 
                            onClick={() => setSelectedOrder(so)}
                            className={`border-b border-theme-divider/40 hover:bg-theme-surface-3/50 cursor-pointer transition-colors ${
                              selectedOrder?.id === so.id ? "bg-theme-surface-3" : ""
                            }`}
                          >
                            <td className={`px-5 ${densityPadding}`} onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(so.id)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedIds);
                                  if (e.target.checked) newSet.add(so.id);
                                  else newSet.delete(so.id);
                                  setSelectedIds(newSet);
                                }}
                                className="rounded border-theme-divider bg-theme-surface-1 accent-indigo-500"
                              />
                            </td>
                            <td className={`px-5 ${densityPadding} font-mono font-bold text-theme-body flex items-center space-x-2`}>
                              <ShoppingCart size={13} className="text-theme-muted" />
                              <span>{so.orderNo}</span>
                            </td>
                            <td className={`px-5 ${densityPadding} text-theme-body font-medium`}>{so.customerName}</td>
                            <td className={`px-5 ${densityPadding} text-theme-muted font-mono`}>
                              {formatDateTime(so.date)}
                            </td>
                            <td className={`px-5 ${densityPadding} text-right font-mono text-theme-muted`}>
                              {so.items.reduce((acc, i) => acc + i.quantity, 0)} units
                            </td>
                            <td className={`px-5 ${densityPadding} text-right font-mono font-semibold text-emerald-400`}>
                              {formatCurrency(so.grandTotal)}
                            </td>
                            <td className={`px-5 ${densityPadding} text-center`}>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                so.status === "Draft" ? "bg-theme-surface-3 text-theme-muted border border-theme-divider" :
                                so.status === "Submitted" ? "bg-amber-950/80 text-amber-400 border border-amber-800" :
                                so.status === "Approved" || so.status === "Confirmed" ? "bg-indigo-950/80 text-indigo-400 border border-indigo-800" :
                                so.status === "Rejected" || so.status === "Cancelled" ? "bg-rose-950/80 text-rose-400 border border-rose-800" :
                                "bg-emerald-950/80 text-emerald-400 border border-emerald-800"
                              }`}>
                                {so.status}
                              </span>
                            </td>
                            <td className={`px-5 ${densityPadding} text-center font-mono text-theme-muted`}>
                              {so.sourceQuotationId ? (
                                <span className="bg-indigo-950 text-indigo-300 border border-indigo-900 px-1.5 py-0.2 rounded text-[10px]">
                                  LINKED
                                </span>
                              ) : (
                                "DIRECT"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : subView === "invoices" ? (
                /* Sales Invoices Registry Table */
                salesInvoices.length === 0 ? (
                  <div className="p-16 text-center text-theme-muted text-xs">
                    No sales invoices match current filters or none exist in SMRITI.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-theme-surface-2 text-theme-muted uppercase font-mono text-[9px] tracking-wider border-b border-theme-divider">
                          <th className={`px-5 ${densityPadding} w-10`}>
                            <input
                              type="checkbox"
                              checked={salesInvoices.length > 0 && selectedIds.size === salesInvoices.length}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedIds(new Set(salesInvoices.map(si => si.id)));
                                else setSelectedIds(new Set());
                              }}
                              className="rounded border-theme-divider bg-theme-surface-1 accent-indigo-500"
                            />
                          </th>
                          <th className={`px-5 ${densityPadding}`}>Invoice No</th>
                          <th className={`px-5 ${densityPadding}`}>Customer Name</th>
                          <th className={`px-5 ${densityPadding}`}>Date</th>
                          <th className={`px-5 ${densityPadding} text-right`}>Items</th>
                          <th className={`px-5 ${densityPadding} text-right`}>Taxes</th>
                          <th className={`px-5 ${densityPadding} text-right`}>Grand Total</th>
                          <th className={`px-5 ${densityPadding} text-center`}>Status</th>
                          <th className={`px-5 ${densityPadding} text-center`}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesInvoices.map(si => {
                          const cust = customers.find(c => c.id === si.customerId);
                          return (
                            <tr 
                              key={si.id} 
                              onClick={() => setSelectedInvoice(si)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openMenu(e, {
                                  module: "sales",
                                  type: "sales-invoice",
                                  object: si
                                });
                              }}
                              className={`border-b border-theme-divider/40 hover:bg-theme-surface-3/50 cursor-pointer transition-colors ${
                                selectedInvoice?.id === si.id ? "bg-theme-surface-3" : ""
                              }`}
                            >
                              <td className={`px-5 ${densityPadding}`} onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(si.id)}
                                  onChange={(e) => {
                                    const newSet = new Set(selectedIds);
                                    if (e.target.checked) newSet.add(si.id);
                                    else newSet.delete(si.id);
                                    setSelectedIds(newSet);
                                  }}
                                  className="rounded border-theme-divider bg-theme-surface-1 accent-indigo-500"
                                />
                              </td>
                              <td className={`px-5 ${densityPadding} font-mono font-bold text-theme-body flex items-center space-x-2`}>
                                <FileCheck size={13} className="text-theme-muted" />
                                <span>{si.invoiceNo}</span>
                              </td>
                              <td className={`px-5 ${densityPadding} text-theme-body font-medium`}>{cust?.name || "Walk-In"}</td>
                              <td className={`px-5 ${densityPadding} text-theme-muted font-mono`}>
                                {formatDateTime(si.date)}
                              </td>
                              <td className={`px-5 ${densityPadding} text-right font-mono text-theme-muted`}>
                                {si.items.reduce((acc, i) => acc + i.quantity, 0)} units
                              </td>
                              <td className={`px-5 ${densityPadding} text-right font-mono text-theme-muted`}>
                                {formatCurrency(si.taxTotal)}
                              </td>
                              <td className={`px-5 ${densityPadding} text-right font-mono font-semibold text-emerald-400`}>
                                {formatCurrency(si.grandTotal)}
                              </td>
                              <td className={`px-5 ${densityPadding} text-center`}>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  si.status === "Draft" ? "bg-theme-surface-3 text-theme-muted border border-theme-divider" :
                                  si.status === "Submitted" ? "bg-amber-950/80 text-amber-400 border border-amber-800" :
                                  si.status === "Approved" ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800" :
                                  "bg-rose-950/80 text-rose-400 border border-rose-800"
                                }`}>
                                  {si.status}
                                </span>
                              </td>
                              <td className={`px-5 ${densityPadding} text-center`} onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center space-x-2">
                                  <button
                                    onClick={() => setSelectedInvoice(si)}
                                    className="p-1 rounded hover:bg-theme-surface-3 text-sky-400"
                                    title="View Invoice Detail"
                                  >
                                    <Eye size={13} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openMenu(e, {
                                        module: "sales",
                                        type: "sales-invoice",
                                        object: si,
                                        role: currentUser?.role || "Store Manager"
                                      });
                                    }}
                                    className="p-1 rounded hover:bg-theme-surface-3 text-theme-muted hover:text-theme-body"
                                    title="Context Actions Menu"
                                  >
                                    <MoreVertical size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              ) : subView === "returns" ? (
                /* Sales Returns Registry Table */
                salesReturns.length === 0 ? (
                  <div className="p-16 text-center text-theme-muted text-xs">
                    No sales returns logged or none match the current filters.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-theme-surface-2 text-theme-muted uppercase font-mono text-[9px] tracking-wider border-b border-theme-divider">
                          <th className={`px-5 ${densityPadding} w-10`}>
                            <input
                              type="checkbox"
                              checked={salesReturns.length > 0 && selectedIds.size === salesReturns.length}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedIds(new Set(salesReturns.map(sr => sr.id)));
                                else setSelectedIds(new Set());
                              }}
                              className="rounded border-theme-divider bg-theme-surface-1 accent-indigo-500"
                            />
                          </th>
                          <th className={`px-5 ${densityPadding}`}>Return No</th>
                          <th className={`px-5 ${densityPadding}`}>Original Invoice</th>
                          <th className={`px-5 ${densityPadding}`}>Reason</th>
                          <th className={`px-5 ${densityPadding}`}>Date</th>
                          <th className={`px-5 ${densityPadding} text-right`}>Returned Items</th>
                          <th className={`px-5 ${densityPadding} text-right`}>Credit Value</th>
                          <th className={`px-5 ${densityPadding} text-center`}>Status</th>
                          <th className={`px-5 ${densityPadding} text-center`}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesReturns.map(sr => {
                          const origInvoice = salesInvoices.find(si => si.id === sr.originalInvoiceId);
                          return (
                            <tr 
                              key={sr.id} 
                              onClick={() => setSelectedReturn(sr)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openMenu(e, {
                                  module: "sales",
                                  type: "sales-return",
                                  object: sr,
                                  role: currentUser?.role || "Store Manager"
                                });
                              }}
                              className={`border-b border-theme-divider/40 hover:bg-theme-surface-3/50 cursor-pointer transition-colors ${
                                selectedReturn?.id === sr.id ? "bg-theme-surface-3" : ""
                              }`}
                            >
                              <td className={`px-5 ${densityPadding}`} onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(sr.id)}
                                  onChange={(e) => {
                                    const newSet = new Set(selectedIds);
                                    if (e.target.checked) newSet.add(sr.id);
                                    else newSet.delete(sr.id);
                                    setSelectedIds(newSet);
                                  }}
                                  className="rounded border-theme-divider bg-theme-surface-1 accent-indigo-500"
                                />
                              </td>
                              <td className={`px-5 ${densityPadding} font-mono font-bold text-theme-body flex items-center space-x-2`}>
                                <RefreshCw size={13} className="text-theme-muted" />
                                <span>{sr.returnNo}</span>
                              </td>
                              <td className={`px-5 ${densityPadding} font-mono text-theme-muted`}>
                                {origInvoice?.invoiceNo || "N/A"}
                              </td>
                              <td className={`px-5 ${densityPadding} text-theme-body font-medium truncate max-w-[120px]`}>
                                {sr.reason}
                              </td>
                              <td className={`px-5 ${densityPadding} text-theme-muted font-mono`}>
                                {formatDateTime(sr.date)}
                              </td>
                              <td className={`px-5 ${densityPadding} text-right font-mono text-theme-muted`}>
                                {sr.items.reduce((acc, i) => acc + i.quantity, 0)} units
                              </td>
                              <td className={`px-5 ${densityPadding} text-right font-mono font-semibold text-rose-400`}>
                                {formatCurrency(sr.grandTotal)}
                              </td>
                              <td className={`px-5 ${densityPadding} text-center`}>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  sr.status === "Draft" ? "bg-theme-surface-3 text-theme-muted border border-theme-divider" :
                                  sr.status === "Submitted" ? "bg-amber-950/80 text-amber-400 border border-amber-800" :
                                  sr.status === "Approved" ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800" :
                                  "bg-rose-950/80 text-rose-400 border border-rose-800"
                                }`}>
                                  {sr.status}
                                </span>
                              </td>
                              <td className={`px-5 ${densityPadding} text-center`} onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center space-x-2">
                                  <button
                                    onClick={() => setSelectedReturn(sr)}
                                    className="p-1 rounded hover:bg-theme-surface-3 text-sky-400"
                                    title="View Return Detail"
                                  >
                                    <Eye size={13} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openMenu(e, {
                                        module: "sales",
                                        type: "sales-return",
                                        object: sr,
                                        role: currentUser?.role || "Store Manager"
                                      });
                                    }}
                                    className="p-1 rounded hover:bg-theme-surface-3 text-theme-muted hover:text-theme-body"
                                    title="Context Actions Menu"
                                  >
                                    <MoreVertical size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                /* Customers Directory Table */
                customers.length === 0 ? (
                  <div className="p-16 text-center text-theme-muted text-xs">
                    No customer records exist in SMRITI database yet.
                  </div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="p-16 text-center text-theme-muted text-xs">
                    No customers match your search criteria. Try a different name, email, or mobile number.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-theme-surface-2 text-theme-muted uppercase font-mono text-[9px] tracking-wider border-b border-theme-divider">
                          <th className={`px-5 ${densityPadding}`}>Identity Info</th>
                          <th className={`px-5 ${densityPadding}`}>Mobile No</th>
                          <th className={`px-5 ${densityPadding}`}>Region / Group</th>
                          <th className={`px-5 ${densityPadding}`}>Tags</th>
                          <th className={`px-5 ${densityPadding} text-right`}>Tier Limit</th>
                          <th className={`px-5 ${densityPadding} text-right`}>Outstanding Balance</th>
                          <th className={`px-5 ${densityPadding} text-center`}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCustomers.map(c => {
                          const group = customerGroups.find(g => g.id === c.customerGroupId);
                          return (
                            <tr 
                              key={c.id} 
                              onClick={() => setSelectedCustomer(c)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openMenu(e, {
                                  module: "crm",
                                  type: "customer",
                                  object: c,
                                  role: currentUser?.role || "Store Manager"
                                });
                              }}
                              className={`border-b border-theme-divider/40 hover:bg-theme-surface-3/50 cursor-pointer transition-colors ${
                                selectedCustomer?.id === c.id ? "bg-theme-surface-3" : ""
                              }`}
                            >
                              <td className={`px-5 ${densityPadding} font-display font-semibold text-theme-body`}>
                                <div className="flex items-center space-x-2">
                                  <div className="w-6 h-6 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-900 flex items-center justify-center text-[10px] font-bold">
                                    {c.name.slice(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-bold">{c.name}</div>
                                    <div className="text-[10px] text-theme-muted font-mono">{c.gstNumber || "No GSTIN"}</div>
                                  </div>
                                </div>
                              </td>
                              <td className={`px-5 ${densityPadding} font-mono text-theme-muted`}>
                                {c.mobile}
                              </td>
                              <td className={`px-5 ${densityPadding}`}>
                                <span className="bg-theme-surface-3 px-2 py-0.5 rounded text-[10px] text-theme-muted border border-theme-divider">
                                  {group?.name || "Standard Retail Group"}
                                </span>
                              </td>
                              <td className={`px-5 ${densityPadding}`}>
                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                  {(c.tags || []).length === 0 ? (
                                    <span className="text-[10px] text-theme-muted italic font-mono">-</span>
                                  ) : (
                                    (c.tags || []).map(t => (
                                      <span 
                                        key={t} 
                                        className="inline-block px-1.5 py-0.5 rounded bg-indigo-950/60 text-indigo-400 border border-indigo-900/40 text-[9px] font-bold font-mono whitespace-nowrap"
                                      >
                                        {t}
                                      </span>
                                    ))
                                  )}
                                </div>
                              </td>
                              <td className={`px-5 ${densityPadding} text-right font-mono text-theme-muted`}>
                                â‚¹{(c.creditLimit || 50000).toLocaleString("en-IN")}
                              </td>
                              <td className={`px-5 ${densityPadding} text-right font-mono font-semibold ${c.outstanding > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                                â‚¹{c.outstanding.toLocaleString("en-IN")}
                              </td>
                              <td className={`px-5 ${densityPadding} text-center`}>
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                  c.status === "Active" ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800" : "bg-theme-surface-3 text-theme-muted border border-theme-divider"
                                }`}>
                                  {c.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Right 1/3: Context Details Drawer */}
        <div className="lg:col-span-1">
          
          {selectedQuotation ? (
            /* Selected Quotation Side Pane */
            <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-5 space-y-6 shadow-xl sticky top-24">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] bg-indigo-950 text-indigo-400 border border-indigo-900 rounded px-1.5 py-0.2 font-mono font-bold uppercase">QUOTATION</span>
                    <span className="text-xs text-theme-muted font-mono font-medium">#{selectedQuotation.id.slice(-5)}</span>
                  </div>
                  <h4 className="font-display font-bold text-base text-theme-body mt-1.5">{selectedQuotation.quotationNo}</h4>
                  <p className="text-[11px] text-theme-muted mt-0.5">Assigned to: <span className="text-theme-body font-medium">{selectedQuotation.customerName}</span></p>
                </div>
                <button
                  onClick={() => setSelectedQuotation(null)}
                  className="p-1 rounded bg-theme-surface-3 text-theme-muted hover:text-theme-body transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-4 border-t border-b border-theme-divider py-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-theme-muted font-medium">Document Date</span>
                  <span className="text-theme-body font-mono">{formatDate(selectedQuotation.date)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-theme-muted font-medium">Workflow Status</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                    selectedQuotation.status === "Draft" ? "bg-theme-surface-3 text-theme-muted border border-theme-divider" :
                    selectedQuotation.status === "Submitted" ? "bg-amber-950/80 text-amber-400 border border-amber-800" :
                    "bg-emerald-950/80 text-emerald-400 border border-emerald-800"
                  }`}>
                    {selectedQuotation.status}
                  </span>
                </div>
                {selectedQuotation.salesOrderId && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-theme-muted font-medium">Sales Order Linked</span>
                    <span className="text-emerald-400 font-mono font-semibold">LINKED</span>
                  </div>
                )}
              </div>

              {/* Items Breakdown lines list inside side pane */}
              <div className="space-y-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block">DOCUMENT LINE ITEMS</span>
                <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1.5">
                  {selectedQuotation.items.map((line, idx) => (
                    <div key={idx} className="bg-theme-surface-2 p-3 rounded-lg border border-theme-divider/60 flex justify-between items-start text-xs">
                      <div>
                        <div className="font-semibold text-theme-body">{line.name}</div>
                        <div className="text-[10px] text-theme-muted font-mono mt-0.5">
                          {line.color || "N/A"} / {line.size || "N/A"} â€¢ Qty {line.quantity}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-theme-body">â‚¹{Math.round(line.totalAmount).toLocaleString("en-IN")}</div>
                        <div className="text-[9px] text-theme-muted mt-0.5 font-mono">â‚¹{line.price} + {line.taxRate}% GST</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals Box */}
              <div className="bg-theme-surface-2 p-4 rounded-xl border border-theme-divider space-y-2">
                <div className="flex justify-between items-center text-xs text-theme-muted">
                  <span>Consolidated Taxes (GST)</span>
                  <span className="font-mono text-theme-body">â‚¹{selectedQuotation.taxTotal.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold text-theme-body pt-2 border-t border-theme-divider/60">
                  <span>Grand Ledger Total</span>
                  <span className="text-emerald-400 font-mono text-sm">â‚¹{selectedQuotation.grandTotal.toLocaleString("en-IN")}</span>
                </div>
              </div>

              {/* Conversion Controls */}
              {selectedQuotation.status === "Approved" && (
                <button
                  onClick={() => handleConvertQuotation(selectedQuotation.id)}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-emerald-900/30 flex items-center justify-center space-x-2.5 transition-all cursor-pointer"
                >
                  <FileCheck size={16} />
                  <span>Convert to Sales Order</span>
                </button>
              )}

              
              {selectedQuotation.status === "Submitted" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleWorkflowAction("Quotation", selectedQuotation.id, "approve")}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center space-x-2.5 transition-all cursor-pointer"
                  >
                    <CheckCircle2 size={16} />
                    <span>Approve</span>
                  </button>
                  <button
                    onClick={() => handleWorkflowAction("Quotation", selectedQuotation.id, "reject")}
                    className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center space-x-2.5 transition-all cursor-pointer"
                  >
                    <X size={16} />
                    <span>Reject</span>
                  </button>
                </div>
              )}
              {selectedQuotation.status === "Draft" && (
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      handleWorkflowAction("Quotation", selectedQuotation.id, "submit");
                      setSelectedQuotation(null);
                    }}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Lock & Submit Quotation
                  </button>
                  <button
                    onClick={() => handleDeleteQuotation(selectedQuotation.id)}
                    className="w-full py-2.5 bg-rose-950/40 hover:bg-rose-900 text-rose-200 border border-rose-900/80 font-semibold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Delete Draft
                  </button>
                </div>
              )}

            </div>
          ) : selectedOrder ? (
            /* Selected Sales Order Side Pane */
            <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-5 space-y-6 shadow-xl sticky top-24">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-900 rounded px-1.5 py-0.2 font-mono font-bold uppercase">SALES ORDER</span>
                    <span className="text-xs text-theme-muted font-mono font-medium">#{selectedOrder.id.slice(-5)}</span>
                  </div>
                  <h4 className="font-display font-bold text-base text-theme-body mt-1.5">{selectedOrder.orderNo}</h4>
                  <p className="text-[11px] text-theme-muted mt-0.5">Customer Name: <span className="text-theme-body font-medium">{selectedOrder.customerName}</span></p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-1 rounded bg-theme-surface-3 text-theme-muted hover:text-theme-body transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-4 border-t border-b border-theme-divider py-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-theme-muted font-medium">Booking Date</span>
                  <span className="text-theme-body font-mono">{formatDate(selectedOrder.date)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-theme-muted font-medium">Workflow Status</span>
                  
                  <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                    selectedOrder.status === "Draft" ? "bg-theme-surface-3 text-theme-muted border border-theme-divider" :
                    selectedOrder.status === "Submitted" ? "bg-amber-950/80 text-amber-400 border border-amber-800" :
                    selectedOrder.status === "Approved" || selectedOrder.status === "Confirmed" ? "bg-indigo-950/80 text-indigo-400 border border-indigo-800" :
                    selectedOrder.status === "Rejected" || selectedOrder.status === "Cancelled" ? "bg-rose-950/80 text-rose-400 border border-rose-800" :
                    "bg-emerald-950/80 text-emerald-400 border border-emerald-800"
                  }`}>
                    {selectedOrder.status}
                  </span>

                </div>
                {selectedOrder.sourceQuotationId && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-theme-muted font-medium">Source Document</span>
                    <span className="text-sky-400 font-mono font-semibold">CONVERTED QTN</span>
                  </div>
                )}
              </div>

              {/* Items Breakdown list */}
              <div className="space-y-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block">COMMITTED BOOKINGS</span>
                <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1.5">
                  {selectedOrder.items.map((line, idx) => (
                    <div key={idx} className="bg-theme-surface-2 p-3 rounded-lg border border-theme-divider/60 flex justify-between items-start text-xs">
                      <div>
                        <div className="font-semibold text-theme-body">{line.name}</div>
                        <div className="text-[10px] text-theme-muted font-mono mt-0.5">
                          {line.color || "N/A"} / {line.size || "N/A"} â€¢ Qty {line.quantity}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-theme-body">â‚¹{Math.round(line.totalAmount).toLocaleString("en-IN")}</div>
                        <div className="text-[9px] text-theme-muted mt-0.5 font-mono">â‚¹{line.price} + {line.taxRate}% GST</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals Box */}
              <div className="bg-theme-surface-2 p-4 rounded-xl border border-theme-divider space-y-2">
                <div className="flex justify-between items-center text-xs text-theme-muted">
                  <span>Consolidated Taxes (GST)</span>
                  <span className="font-mono text-theme-body">â‚¹{selectedOrder.taxTotal.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold text-theme-body pt-2 border-t border-theme-divider/60">
                  <span>Grand Booking Value</span>
                  <span className="text-emerald-400 font-mono text-sm">â‚¹{selectedOrder.grandTotal.toLocaleString("en-IN")}</span>
                </div>
              </div>

              
              {selectedOrder.status === "Draft" && (
                <button
                  onClick={() => handleWorkflowAction("SalesOrder", selectedOrder.id, "submit")}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center space-x-2.5 transition-all cursor-pointer"
                >
                  <ArrowRight size={16} />
                  <span>Submit Sales Order</span>
                </button>
              )}
              {selectedOrder.status === "Submitted" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleWorkflowAction("SalesOrder", selectedOrder.id, "approve")}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center space-x-2.5 transition-all cursor-pointer"
                  >
                    <CheckCircle2 size={16} />
                    <span>Approve</span>
                  </button>
                  <button
                    onClick={() => handleWorkflowAction("SalesOrder", selectedOrder.id, "reject")}
                    className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center space-x-2.5 transition-all cursor-pointer"
                  >
                    <X size={16} />
                    <span>Reject</span>
                  </button>
                </div>
              )}
              <div className="bg-indigo-950/40 p-3 rounded-xl border border-indigo-900/60 text-[10px] text-indigo-200 leading-relaxed flex items-start space-x-2">

                <AlertCircle size={14} className="mt-0.5 text-indigo-400 shrink-0" />
                <p>This sales order is committed to inventory logic. Quantities are reserved and waiting for shipment dispatch protocols (Phase 2).</p>
              </div>
            </div>
          ) : selectedInvoice ? (
            /* Selected Sales Invoice Side Pane */
            <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-5 space-y-6 shadow-xl sticky top-24">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-900 rounded px-1.5 py-0.2 font-mono font-bold uppercase">SALES INVOICE</span>
                    <span className="text-xs text-theme-muted font-mono font-medium">#{selectedInvoice.id.slice(-5)}</span>
                  </div>
                  <h4 className="font-display font-bold text-base text-theme-body mt-1.5">{selectedInvoice.invoiceNo}</h4>
                  <p className="text-[11px] text-theme-muted mt-0.5">Customer: <span className="text-theme-body font-medium">{customers.find(c => c.id === selectedInvoice.customerId)?.name || "Walk-In"}</span></p>
                </div>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="p-1 rounded bg-theme-surface-hover text-theme-muted hover:text-theme-body transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-4 border-t border-b border-theme-divider py-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-theme-muted font-medium">Invoice Date</span>
                  <span className="text-theme-body font-mono">{formatDate(selectedInvoice.date)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-theme-muted font-medium">Workflow Status</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                    selectedInvoice.status === "Draft" ? "bg-theme-surface-3 text-theme-muted border border-theme-divider" :
                    selectedInvoice.status === "Submitted" ? "bg-amber-950/80 text-amber-400 border border-amber-800" :
                    selectedInvoice.status === "Approved" ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800" :
                    "bg-rose-950/80 text-rose-400 border border-rose-800"
                  }`}>
                    {selectedInvoice.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-[10px] text-theme-muted">
                  <div className="bg-theme-surface-2 p-3 rounded-xl border border-theme-divider">
                    <div className="font-semibold text-theme-body">Interstate</div>
                    <div className="mt-1 font-mono">{selectedInvoice.isInterstate ? "Yes" : "No"}</div>
                  </div>
                  <div className="bg-theme-surface-2 p-3 rounded-xl border border-theme-divider">
                    <div className="font-semibold text-theme-body">E-Way Bill</div>
                    <div className="mt-1 font-mono">{selectedInvoice.eWayBillNo || "Not provided"}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block">INVOICE LINE ITEMS</span>
                <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1.5">
                  {selectedInvoice.items.map((line, idx) => (
                    <div key={idx} className="bg-theme-surface-2 p-3 rounded-lg border border-theme-divider/60 flex justify-between items-start text-xs">
                      <div>
                        <div className="font-semibold text-theme-body">{line.name}</div>
                        <div className="text-[10px] text-theme-muted font-mono mt-0.5">
                          Qty {line.quantity} × â‚¹{line.price}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-theme-body">â‚¹{Math.round(line.totalAmount).toLocaleString("en-IN")}</div>
                        <div className="text-[9px] text-theme-muted mt-0.5 font-mono">GST {line.gstRate}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-theme-surface-2 p-4 rounded-xl border border-theme-divider space-y-2">
                <div className="flex justify-between items-center text-xs text-theme-muted">
                  <span>GST Total</span>
                  <span className="font-mono text-theme-body">â‚¹{selectedInvoice.taxTotal.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-theme-muted">
                  <span>Subtotal</span>
                  <span className="font-mono text-theme-body">â‚¹{(selectedInvoice.grandTotal - selectedInvoice.taxTotal).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold text-theme-body pt-2 border-t border-theme-divider/60">
                  <span>Total Payable</span>
                  <span className="text-emerald-400 font-mono text-sm">â‚¹{selectedInvoice.grandTotal.toLocaleString("en-IN")}</span>
                </div>
              </div>

              <div className="space-y-2">
                {(selectedInvoice.status === "Submitted" || selectedInvoice.status === "Draft") && (
                  <button
                    onClick={() => handleApproveInvoice({ detail: selectedInvoice })}
                    disabled={isReadOnly}
                    className={`w-full py-3 ${isReadOnly ? "bg-theme-surface-3 text-theme-muted cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-500 text-white"} font-bold text-xs rounded-xl shadow-lg flex items-center justify-center space-x-2.5 transition-all`}
                  >
                    <CheckCircle2 size={16} />
                    <span>{selectedInvoice.status === "Draft" ? "Submit & Approve" : "Approve Invoice"}</span>
                  </button>
                )}
                {selectedInvoice.status === "Approved" && (
                  <button
                    onClick={() => handleCancelInvoice({ detail: selectedInvoice })}
                    disabled={isReadOnly}
                    className={`w-full py-3 ${isReadOnly ? "bg-theme-surface-3 text-theme-muted cursor-not-allowed" : "bg-rose-600 hover:bg-rose-500 text-white"} font-bold text-xs rounded-xl shadow-lg flex items-center justify-center space-x-2.5 transition-all`}
                  >
                    <X size={16} />
                    <span>Cancel Invoice</span>
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handlePrintInvoice({ detail: selectedInvoice })}
                    className="w-full py-2 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-body rounded-xl text-xs font-semibold transition-colors"
                  >
                    Print
                  </button>
                  <button
                    onClick={() => handleWhatsAppInvoice({ detail: selectedInvoice })}
                    className="w-full py-2 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-body rounded-xl text-xs font-semibold transition-colors"
                  >
                    WhatsApp
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Empty Right Pane State */
            <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-8 text-center space-y-3 text-theme-muted sticky top-24">
              <div className="w-12 h-12 rounded-full bg-theme-surface-2 flex items-center justify-center text-theme-muted mx-auto">
                <FileText size={20} />
              </div>
              <h4 className="font-display font-bold text-xs text-theme-body uppercase tracking-wider">Detail Inspection Desk</h4>
              <p className="text-[11px] leading-relaxed">Select any quotation, sales order, or sales invoice from the registry list to load its real-time tax breakdown, workflow status transitions, and committed items.</p>
            </div>
          )}

        </div>

      </div>

      {/* Quick Edit Customer Modal */}
      {quickEditingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setQuickEditingCustomer(null)} />
          <div className="relative bg-theme-surface-1 border border-theme-divider w-full max-w-md rounded-2xl shadow-2xl overflow-hidden pointer-events-auto animate-in scale-in duration-200">
            {/* Header */}
            <div className="bg-theme-surface-3 border-b border-theme-divider px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-sm text-theme-body flex items-center space-x-2">
                  <User size={16} className="text-indigo-400" />
                  <span>Quick Edit Profile</span>
                </h3>
                <p className="text-[11px] text-theme-muted">Rapidly update contact fields for {quickEditingCustomer.name}</p>
              </div>
              <button 
                onClick={() => setQuickEditingCustomer(null)}
                className="p-1 rounded bg-theme-surface-hover text-theme-muted hover:text-theme-body transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form Fields */}
            <div className="p-6 space-y-4">
              {/* Customer ID & Group info */}
              <div className="p-3.5 bg-theme-surface-2 border border-theme-divider rounded-xl flex items-center justify-between text-xs font-mono text-theme-muted">
                <div>
                  ID: <span className="text-theme-body font-bold font-mono">{quickEditingCustomer.id}</span>
                </div>
                <div>
                  Group: <span className="bg-theme-surface-3 border border-theme-divider px-1.5 py-0.5 rounded text-[10px] text-theme-body font-bold">{quickEditingCustomer.customerGroupId}</span>
                </div>
              </div>

              {/* Full Name (Read-Only) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block">Customer Name</label>
                <input
                  type="text"
                  value={quickEditingCustomer.name}
                  disabled
                  className="w-full px-3 py-2 bg-theme-surface-2 border border-theme-divider rounded-lg text-xs text-theme-muted cursor-not-allowed"
                />
              </div>

              {/* Phone / Mobile */}
              <div className="space-y-1.5">
                <label htmlFor="quick-mobile" className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block">Mobile Number (10 Digits) *</label>
                <input
                  type="text"
                  id="quick-mobile"
                  value={quickEditMobile}
                  onChange={(e) => setQuickEditMobile(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3 py-2 bg-theme-surface-2 border border-theme-divider focus:border-indigo-500 rounded-lg text-xs text-theme-body focus:outline-none transition-colors"
                />
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <label htmlFor="quick-email" className="text-[10px] font-mono text-theme-muted uppercase tracking-wider block">Email Address *</label>
                <input
                  type="email"
                  id="quick-email"
                  value={quickEditEmail}
                  onChange={(e) => setQuickEditEmail(e.target.value)}
                  placeholder="e.g. customer@domain.com"
                  className="w-full px-3 py-2 bg-theme-surface-2 border border-theme-divider focus:border-indigo-500 rounded-lg text-xs text-theme-body focus:outline-none transition-colors"
                />
              </div>

              {/* Validation errors */}
              {quickEditErrors.length > 0 && (
                <div className="p-3.5 bg-rose-950/40 border border-rose-900 rounded-xl space-y-1 animate-in slide-in-from-top-2 duration-200">
                  <span className="text-[10px] font-mono text-rose-400 font-bold uppercase tracking-wider block">Validation Error</span>
                  <ul className="list-disc list-inside text-[11px] text-rose-300 space-y-1">
                    {quickEditErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Controls */}
              <div className="pt-4 border-t border-theme-divider/50 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setQuickEditingCustomer(null)}
                  className="px-4 py-2 rounded-lg bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-muted hover:text-theme-body text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isQuickEditSaving}
                  onClick={async () => {
                    setQuickEditErrors([]);
                    setIsQuickEditSaving(true);

                    const errors: string[] = [];
                    const cleanMobile = quickEditMobile.trim().replace(/[- ]/g, "");
                    const email = quickEditEmail.trim();

                    // 1. Mobile validation
                    if (!cleanMobile) {
                      errors.push("Mobile number is required.");
                    } else if (!isValidMobile(cleanMobile)) {
                      errors.push("Mobile number must be exactly 10 digits.");
                    } else {
                      // Check duplicates
                      const duplicateMobile = customers.some(
                        (c) => c.id !== quickEditingCustomer.id && (c.mobile === cleanMobile || c.mobile === quickEditMobile.trim())
                      );
                      if (duplicateMobile) {
                        errors.push(`Mobile number '${quickEditMobile}' is already registered to another SMRITI customer.`);
                      }
                    }

                    // 2. Email validation
                    if (!email) {
                      errors.push("Email address is required.");
                    } else {
                      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                      if (!emailRegex.test(email)) {
                        errors.push("Invalid email address format.");
                      } else {
                        // Check duplicates
                        const duplicateEmail = customers.some(
                          (c) => c.id !== quickEditingCustomer.id && c.email && c.email.toLowerCase() === email.toLowerCase()
                        );
                        if (duplicateEmail) {
                          errors.push(`Email address '${email}' is already registered to another SMRITI customer.`);
                        }
                      }
                    }

                    if (errors.length > 0) {
                      setQuickEditErrors(errors);
                      setIsQuickEditSaving(false);
                      onNotification("Validation Failed", "Please fix errors before saving.", "error");
                      return;
                    }

                    // Proceed with updating customer state
                    const updatedCustomersList = customers.map((c) => {
                      if (c.id === quickEditingCustomer.id) {
                        return {
                          ...c,
                          mobile: cleanMobile,
                          email: email
                        };
                      }
                      return c;
                    });

                    try {
                      saveCustomers(updatedCustomersList);
                      fetchCustomers();
                      onNotification(
                        "Customer Updated", 
                        `Successfully updated contact info for ${quickEditingCustomer.name}`, 
                        "success"
                      );
                      setQuickEditingCustomer(null);
                    } catch (err) {
                      console.error("Failed to quick edit customer:", err);
                      setQuickEditErrors(["Unable to save changes. Please try again."]);
                    } finally {
                      setIsQuickEditSaving(false);
                    }
                  }}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs shadow-lg hover:shadow-indigo-900/30 transition-all cursor-pointer"
                >
                  {isQuickEditSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

        </motion.div>
      </SmritiScrollArea>
    </div>
  );
};
