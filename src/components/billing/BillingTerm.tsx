/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.89.0
 * Created      : 2026-08-21
 * Modified     : 2026-10-24
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Canonical Billing Engine
 * Source Module: Stitch Distributor Invoicing Terminal
 * Shared by the canonical Billing Workspace for POS, credit, wholesale, and tax invoices.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Product, Customer, POSProfile, Shift } from "../../types.ts";
import { apiFetchV1, getTenantCompanyContext, normalizeBranchId, normalizeCompanyId } from "../../lib/apiFetchV1.ts";
import { useF2Screen } from "../../context/F2DispatcherContext.tsx";
import type { LookupResult } from "../../context/F2DispatcherContext.tsx";
import type { SalesLineItem, SalesTransaction } from "../../domain/sales/transaction";
import { calculateLineTotal, recomputeTransaction } from "../../services/sales/transactionCalculator";
import {
  buildBillingPreviewRequest,
  BillingPreviewRequest,
  BillingPreviewResult,
  prepareBillingPostingLines,
} from "./billingPreview.ts";
import { getCustomers, saveCustomers } from "../../services/customerStore.ts";
import { 
  searchBackendCustomers, 
  searchBackendProducts, 
  AutoPopulateCustomerResult, 
  AutoPopulateProductResult 
} from "../../services/autoPopulateService.ts";
import { TypeaheadDrop, TypeaheadOption } from "../common/TypeaheadDrop.tsx";
import { SmritiItemTypeaheadDropdown } from "../common/ItemTypeaheadDrop.tsx";
import {
  BillingLineItem,
  BillType,
  TransactionType,
  BillingHeaderState,
  BillingSummaryTotals,
  TransporterRow,
  AddonDeductionRow,
  SettlementPaymentRow,
  CustomerGSTRegistrationDTO,
  CustomerDeliveryLocationDTO,
  CustomerBillingLocationDTO,
  toCanonicalPaymentMode,
  SALES_CHANNELS,
  channelRequiresStoreLocation
} from "./types.ts";
import { SmritiF2AdvancedItemSearch, SmritiF2SelectedItem } from "./SmritiF2AdvancedItemSearch.tsx";
import {
  SmritiF6PromotionalDiscountsModal,
  SmritiBillLevelPromoState
} from "./SmritiF6PromotionalDiscountsModal.tsx";
import { SmritiDefineSalesPromotionsModal } from "./SmritiDefineSalesPromotionsModal.tsx";
import { SmritiDefineSalesFactorsModal } from "../pricing/SmritiDefineSalesFactorsModal.tsx";
import { SmritiSalesFactorService } from "../../services/smritiSalesFactorService.ts";
import {
  SmritiSalesPromotionService,
  ItemPromoResolutionResult
} from "../../services/smritiSalesPromotionService.ts";
import { SmritiDefineBillPrefixModal } from "./SmritiDefineBillPrefixModal.tsx";
import { smritiSystemParameterService } from "../../services/smritiSystemParameterService.ts";
import {
  SmritiBillPrefixService,
  BillPrefixResolveResult
} from "../../services/smritiBillPrefixService.ts";
import { SmritiInvoiceSettlementModal } from "./InvoiceSettlementD.tsx";
import { BarcodeCSVImportModal, ResolvedCartItem } from "./BarcodeCSVImportModal.tsx";
import { BulkAddItemsModal } from "./modals/BulkAddItemsModal.tsx";
import { PrintPreviewModal } from "../PrintPreviewModal.tsx";
import { InvoicingTransactionBrowserModal, InvoicingBrowserTab } from "./InvoicingTransactionBrowserModal.tsx";
import { TransactionAttachmentPanel } from "../common/TransactionAttachmentPanel.tsx";
import type { TransactionAttachment } from "../../domain/attachment";
import { 
  Download, 
  History, 
  Search, 
  Plus, 
  Trash2, 
  X, 
  FileText, 
  Truck, 
  CreditCard, 
  Receipt,
  UserPlus,
  Printer,
  RotateCcw,
  Bell,
  Settings,
  HelpCircle,
  Clock,
  User,
  Maximize2,
  Minimize2,
  ExternalLink,
  Paperclip,
  Banknote,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Check,
  Edit2,
  FilePlus,
  Save,
  Menu,
  MoreHorizontal,
  Package,
  Barcode,
  Users,
  Percent
} from "lucide-react";

interface SmritiBillingTerminalProps {
  products?: Product[];
  customers?: Customer[];
  profiles?: POSProfile[];
  shifts?: Shift[];
  currentUser?: { role: string; name: string; companyId?: string; branchId?: string } | null;
  onRefreshData?: () => void;
  onNotification?: (title: string, message: string, type: "success" | "error" | "info") => void;
  isStandaloneTab?: boolean;
  initialTransaction?: TransactionType;
  initialSalesChannel?: string;
  onOpenSalesDocuments?: () => void;
  onOpenPackingSlips?: () => void;
  onOpenConsolidatedBilling?: () => void;
  onOpenBillingConfiguration?: () => void;
  onOpenShiftReports?: () => void;
  onOpenEodReport?: () => void;
  onOpenShiftManager?: () => void;
  onOpenHotkeys?: () => void;
}

interface BillingSalespersonOption {
  id: string;
  code: string;
  name: string;
  status?: string;
  role?: string;
}

interface ResolvedBillingTransactionPolicy {
  configuration?: {
    allowed_sales_channels?: string[];
    allowed_source_types?: string[];
    allowed_bill_types?: string[];
    allowed_transactions?: string[];
    default_sales_channel?: string | null;
    default_transaction?: "CASH" | "CREDIT" | "";
    default_source_type?: string;
    default_bill_type?: string;
    customer_selection_required?: boolean;
  };
  customer?: {
    default_sales_channel?: string;
    channel_conflict?: boolean;
    default_transaction?: "CASH" | "CREDIT" | "";
    allowed_transactions?: string[];
    credit_limit?: number;
    credit_days?: number;
    outstanding?: number;
    available_credit?: number | null;
    unlimited_credit?: boolean;
    credit_hold?: boolean;
    require_po_number?: boolean;
    can_override_credit?: boolean;
    allow_credit_override?: boolean;
    default_transaction_permitted?: boolean;
    configuration_warning?: string | null;
    can_change_transaction_mode?: boolean;
  } | null;
  allowed_transactions?: string[];
  default_transaction?: "CASH" | "CREDIT" | "";
  default_transaction_permitted?: boolean;
  configuration_warning?: string | null;
  can_change_transaction_mode?: boolean;
}

export const DEFAULT_TRANSPORTER_ROWS: TransporterRow[] = [
  {
    sNo: 1,
    type: "Road Freight",
    code: "TR-01",
    description: "Local Express Logistics",
    rateType: "Fixed",
    rateAmt: 0,
    rate: 0,
    amount: 0
  }
];

export const DEFAULT_ADDON_ROWS: AddonDeductionRow[] = [
  {
    sNo: 1,
    type: "Addon",
    code: "INS",
    description: "Transit Insurance",
    rateType: "Fixed",
    rate: 0,
    amount: 0
  }
];

export const BillingTerm: React.FC<SmritiBillingTerminalProps> = ({
  products = [],
  customers: initialCustomersProp,
  currentUser,
  onRefreshData,
  onNotification,
  isStandaloneTab = false,
  initialTransaction = "Credit",
  initialSalesChannel = "B2B_WHOLESALE",
  onOpenSalesDocuments,
  onOpenPackingSlips,
  onOpenConsolidatedBilling,
  onOpenBillingConfiguration,
  onOpenShiftReports,
  onOpenEodReport,
  onOpenShiftManager,
  onOpenHotkeys,
}) => {
  const settlementIdempotencyKeyRef = useRef<{ key: string; fingerprint: string } | null>(null);
  const invoiceCustomerScope = { series: "TT2026-2027", from: 18, to: 137 };

  // Main Line Items Table State
  const [items, setItems] = useState<BillingLineItem[]>([]);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [customerPOs, setCustomerPOs] = useState<any[]>([]);
  const [selectedCustomerPO, setSelectedCustomerPO] = useState<any | null>(null);
  const [isLoadingCustomerPOs, setIsLoadingCustomerPOs] = useState(false);

  // Header State
  const [headerState, setHeaderState] = useState<BillingHeaderState>({
    billType: "Product",
    transaction: initialTransaction,
    docPrefix: "",
    docNo: "",
    billDate: new Date().toLocaleDateString("en-GB"),
    customer: null,
    salesStaff: currentUser?.name || "",
    remarks: "",
    billedPartyGstinId: null,
    billedGstin: null,
    deliveryLocationId: null,
    deliveryStoreCode: null,
    deliveryGstin: null,
    deliveryLocationSnapshot: null,
    placeOfSupplyCode: null,
    poReference: "",
    billingSource: "DIRECT",
    customerPoId: null,
    salesChannel: initialSalesChannel,
    psvPartyId: null
  });
  const [billingTransactionPolicy, setBillingTransactionPolicy] = useState<ResolvedBillingTransactionPolicy | null>(null);
  const [billingPolicyLoading, setBillingPolicyLoading] = useState(false);
  const [billingPolicyError, setBillingPolicyError] = useState<string | null>(null);
  const [creditOverrideReason, setCreditOverrideReason] = useState("");
  const [transactionModeConfirmed, setTransactionModeConfirmed] = useState(false);
  const billingPolicyRequestIdRef = useRef(0);
  const loadBillingTransactionPolicy = useCallback(async (customerId?: string | null) => {
    const requestId = ++billingPolicyRequestIdRef.current;
    setBillingPolicyLoading(true);
    setBillingPolicyError(null);
    try {
      const query = customerId ? `?customer_id=${encodeURIComponent(customerId)}` : "";
      const resolved = await apiFetchV1<ResolvedBillingTransactionPolicy>(`/billing/transaction-policy${query}`);
      if (requestId !== billingPolicyRequestIdRef.current) return;
      setBillingTransactionPolicy(resolved);
      const configuration = resolved.configuration || {};
      const customerPolicy = resolved.customer;
      const allowedChannels = configuration.allowed_sales_channels || [];
      const allowedSources = configuration.allowed_source_types || [];
      const allowedBillTypes = configuration.allowed_bill_types || [];
      const allowedTransactions = customerPolicy?.allowed_transactions
        || resolved.allowed_transactions
        || configuration.allowed_transactions
        || [];
      const defaultChannel = customerPolicy?.default_sales_channel
        || configuration.default_sales_channel
        || initialSalesChannel;
      const defaultSource = configuration.default_source_type || "DIRECT";
      const defaultBillType = configuration.default_bill_type || "Product";
      const defaultTransaction = customerPolicy?.default_transaction
        || resolved.default_transaction
        || configuration.default_transaction
        || "";
      const defaultTransactionPermitted = customerPolicy?.default_transaction_permitted
        ?? resolved.default_transaction_permitted
        ?? allowedTransactions.includes(defaultTransaction);
      setHeaderState(previous => ({
        ...previous,
        salesChannel: allowedChannels.includes(defaultChannel)
          ? defaultChannel
          : (allowedChannels.includes(configuration.default_sales_channel || "") ? configuration.default_sales_channel! : previous.salesChannel),
        billingSource: allowedSources.includes(defaultSource)
          ? defaultSource as BillingHeaderState["billingSource"]
          : previous.billingSource,
        billType: allowedBillTypes.some(value => value.toLowerCase() === defaultBillType.toLowerCase())
          ? defaultBillType as BillType
          : (allowedBillTypes[0] as BillType) || previous.billType,
        transaction: defaultTransactionPermitted && defaultTransaction === "CREDIT"
          ? "Credit"
          : defaultTransactionPermitted && defaultTransaction === "CASH"
            ? "Cash"
            : previous.transaction,
      }));
      setTransactionModeConfirmed(false);
      setCreditOverrideReason("");
    } catch (error) {
      if (requestId === billingPolicyRequestIdRef.current) {
        setBillingTransactionPolicy(null);
        console.error("[BillingTerm] Billing policy resolution failed:", error);
        setBillingPolicyError("Billing policy could not be loaded.");
      }
    } finally {
      if (requestId === billingPolicyRequestIdRef.current) setBillingPolicyLoading(false);
    }
  }, [currentUser?.branchId, currentUser?.companyId, initialSalesChannel]);
  const [salespeople, setSalespeople] = useState<BillingSalespersonOption[]>([]);
  const [salespeopleError, setSalespeopleError] = useState<string | null>(null);

  useEffect(() => {
    void loadBillingTransactionPolicy(headerState.customer?.id);
    return () => {
      billingPolicyRequestIdRef.current += 1;
    };
  }, [headerState.customer?.id, loadBillingTransactionPolicy]);

  useEffect(() => {
    let isMounted = true;
    apiFetchV1<{ items?: BillingSalespersonOption[] }>("/staff?limit=200")
      .then(response => {
        const records = Array.isArray(response) ? response : response?.items;
        if (!Array.isArray(records)) {
          throw new Error("Staff directory returned an unsupported response.");
        }
        if (isMounted) {
          setSalespeople(records.filter(person =>
            Boolean(person.name) && String(person.status || "Active").toUpperCase() === "ACTIVE"
          ));
          setSalespeopleError(null);
        }
      })
      .catch(error => {
        if (isMounted) {
          setSalespeopleError(error instanceof Error ? error.message : "Staff directory could not be loaded.");
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const isStoreLocationRequired = useMemo(() => {
    const channelKey = (headerState.salesChannel || "B2B_WHOLESALE").toUpperCase();
    const sysParamKey = `SMRITI.SALES.CHANNEL.${channelKey}.REQUIRES_STORE_LOCATION`;
    const sysParamVal = smritiSystemParameterService.getValue<boolean | null>(sysParamKey, null);
    return channelRequiresStoreLocation(headerState.salesChannel, sysParamVal);
  }, [headerState.salesChannel]);

  const loadCustomerPOs = async (customerId: string) => {
    if (!customerId || customerId === "CUST-WALKIN") {
      setCustomerPOs([]);
      setSelectedCustomerPO(null);
      return;
    }
    setIsLoadingCustomerPOs(true);
    try {
      const response = await apiFetchV1<any>(`/sales/customer-pos?customer_id=${encodeURIComponent(customerId)}&status=OPEN`);
      setCustomerPOs(Array.isArray(response) ? response : response?.items || []);
    } catch {
      setCustomerPOs([]);
    } finally {
      setIsLoadingCustomerPOs(false);
    }
  };

  const selectCustomerPO = async (poId: string) => {
    if (!poId) {
      setSelectedCustomerPO(null);
      setItems([]);
      setHeaderState(prev => ({ ...prev, customerPoId: null, poReference: "" }));
      return;
    }
    try {
      const po = await apiFetchV1<any>(`/sales/customer-pos/${poId}`);
      setSelectedCustomerPO(po);
      setHeaderState(prev => ({ ...prev, customerPoId: po.id, poReference: po.po_number, billingSource: "CUSTOMER_PO" }));
      setItems((po.lines || []).filter((line: any) => Number(line.quantity_remaining || 0) > 0).map((line: any, index: number) => ({
        id: `customer-po-${line.id}`,
        sNo: index + 1,
        stockNo: line.code,
        barcode: line.code,
        itemDescription: line.description,
        rate: Number(line.unit_price || 0),
        qty: Number(line.quantity_remaining || 0),
        value: Number(line.unit_price || 0) * Number(line.quantity_remaining || 0),
        discCode: "",
        discQty: 0,
        discPercent: 0,
        discAmt: 0,
        total: Number(line.unit_price || 0) * Number(line.quantity_remaining || 0),
        salesStaff: headerState.salesStaff,
        productId: line.product_id,
        hsnCode: line.hsn_code,
        gstPercentage: Number(line.gst_rate || 18),
        customerPoLineId: line.id
      })));
    } catch (error: any) {
      onNotification?.("Customer PO Unavailable", error?.message || "Unable to load the selected Customer PO.", "error");
    }
  };

  useEffect(() => {
    if (headerState.customer?.id) void loadCustomerPOs(headerState.customer.id);
  }, [headerState.customer?.id]);

  useEffect(() => {
    void smritiSystemParameterService.load();
  }, []);

  // Corporate B2B Multi-State GST, Billing & Delivery Location State
  const [customerGstRegistrations, setCustomerGstRegistrations] = useState<CustomerGSTRegistrationDTO[]>([]);
  const [customerDeliveryLocations, setCustomerDeliveryLocations] = useState<CustomerDeliveryLocationDTO[]>([]);
  const [customerBillingLocations, setCustomerBillingLocations] = useState<CustomerBillingLocationDTO[]>([]);
  const [isLoadingB2BData, setIsLoadingB2BData] = useState<boolean>(false);
  const activeCustomerFetchIdRef = useRef<string | null>(null);

  const fetchCustomerB2BData = async (customerId: string) => {
    activeCustomerFetchIdRef.current = customerId;
    setIsLoadingB2BData(true);
    try {
      const [regsRes, locsRes, blocRes] = await Promise.all([
        apiFetchV1(`/crm/customers/${customerId}/gst-registrations`).catch(() => []),
        apiFetchV1(`/crm/customers/${customerId}/delivery-locations`).catch(() => []),
        apiFetchV1(`/crm/customers/${customerId}/billing-locations`).catch(() => []),
      ]);
      if (activeCustomerFetchIdRef.current !== customerId) return;

      const regs: CustomerGSTRegistrationDTO[] = (Array.isArray(regsRes) ? regsRes : (regsRes?.items || [])).map((raw: any) => ({
        ...raw,
        customer_id: raw.customer_id ?? raw.customerId,
        state_code: raw.state_code ?? raw.stateCode,
        state_name: raw.state_name ?? raw.stateName,
        registration_type: raw.registration_type ?? raw.registrationType,
        is_primary: raw.is_primary ?? raw.isPrimary,
        is_active: raw.is_active ?? raw.isActive,
      }));
      const locs: CustomerDeliveryLocationDTO[] = (Array.isArray(locsRes) ? locsRes : (locsRes?.items || [])).map((raw: any) => ({
        ...raw,
        customer_id: raw.customer_id ?? raw.customerId,
        store_code: raw.store_code ?? raw.storeCode,
        location_name: raw.location_name ?? raw.locationName,
        address_line1: raw.address_line1 ?? raw.addressLine1,
        address_line2: raw.address_line2 ?? raw.addressLine2,
        state_code: raw.state_code ?? raw.stateCode,
        state_name: raw.state_name ?? raw.stateName ?? raw.state,
        pin_code: raw.pin_code ?? raw.pincode,
        gst_registration_id: raw.gst_registration_id ?? raw.gstRegistrationId,
        delivery_gstin: raw.delivery_gstin ?? raw.gstin,
        contact_person: raw.contact_person ?? raw.contactPerson,
        contact_phone: raw.contact_phone ?? raw.phone,
        contact_email: raw.contact_email ?? raw.email,
        is_default: raw.is_default ?? raw.isDefault,
        is_active: raw.is_active ?? raw.isActive,
      }));
      const blocs: CustomerBillingLocationDTO[] = (Array.isArray(blocRes) ? blocRes : (blocRes?.items || [])).map((raw: any) => ({
        ...raw,
        customer_id: raw.customer_id ?? raw.customerId,
        billing_store_code: raw.billing_store_code ?? raw.billingStoreCode,
        name: raw.name ?? raw.location_name ?? raw.locationName,
        address_line1: raw.address_line1 ?? raw.addressLine1,
        address_line2: raw.address_line2 ?? raw.addressLine2,
        state_code: raw.state_code ?? raw.stateCode,
        pincode: raw.pincode ?? raw.pinCode,
        gst_registration_id: raw.gst_registration_id ?? raw.gstRegistrationId,
        contact_person: raw.contact_person ?? raw.contactPerson,
        contact_phone: raw.contact_phone ?? raw.phone,
        contact_email: raw.contact_email ?? raw.email,
        is_default: raw.is_default ?? raw.isDefault,
      }));
      setCustomerGstRegistrations(regs);
      setCustomerDeliveryLocations(locs);
      setCustomerBillingLocations(blocs);

      // 1. Primary GST auto-selection:
      const primaryReg = regs.find(r => r.is_primary) || (regs.length === 1 ? regs[0] : null);

      // 2. Default Billing Location auto-selection:
      const defaultBloc = blocs.find(b => b.is_default) || (blocs.length === 1 ? blocs[0] : null);

      // 3. Default Shipping / Delivery Location auto-selection:
      const defaultDelLoc = locs.find(l => l.is_default) || (locs.length === 1 ? locs[0] : null);

      const delSnapshot = defaultDelLoc ? {
        id: defaultDelLoc.id,
        store_code: defaultDelLoc.store_code,
        location_name: defaultDelLoc.location_name,
        address_line1: defaultDelLoc.address_line1,
        address_line2: defaultDelLoc.address_line2,
        city: defaultDelLoc.city,
        state_code: defaultDelLoc.state_code,
        state_name: defaultDelLoc.state_name,
        pin_code: defaultDelLoc.pin_code,
        delivery_gstin: defaultDelLoc.delivery_gstin,
        contact_person: defaultDelLoc.contact_person,
        contact_phone: defaultDelLoc.contact_phone
      } : null;

      setHeaderState(prev => ({
        ...prev,
        billedPartyGstinId: primaryReg?.id || null,
        billedGstin: primaryReg?.gstin || null,
        placeOfSupplyCode: defaultDelLoc?.state_code || primaryReg?.state_code || prev.placeOfSupplyCode,
        billingLocationId: defaultBloc?.id || null,
        billingStoreCode: defaultBloc?.billing_store_code || null,
        billingAddress: defaultBloc ? [defaultBloc.address_line1, defaultBloc.city, defaultBloc.state].filter(Boolean).join(", ") : null,
        deliveryLocationId: defaultDelLoc?.id || null,
        deliveryStoreCode: defaultDelLoc?.store_code || null,
        deliveryGstin: defaultDelLoc?.delivery_gstin || null,
        deliveryLocationSnapshot: delSnapshot,
        shippingAddress: defaultDelLoc ? [defaultDelLoc.address_line1, defaultDelLoc.city, defaultDelLoc.state_name].filter(Boolean).join(", ") : null,
      }));

      // Auto-resolve PSV party for default delivery location if present
      if (defaultDelLoc?.id) {
        void apiFetchV1<any>("/psv/resolve-store-party", {
          method: "POST",
          body: JSON.stringify({
            delivery_location_id: defaultDelLoc.id,
            customer_id: customerId,
          }),
        }).then(res => {
          if (res?.psv_party_id) {
            setHeaderState(prev => ({
              ...prev,
              psvPartyId: res.psv_party_id,
            }));
          }
        }).catch(err => {
          console.warn("[BillingTerm] Automatic PSV account resolution notice:", err);
        });
      }
    } catch {
      // Offline fallback
    } finally {
      if (activeCustomerFetchIdRef.current === customerId) {
        setIsLoadingB2BData(false);
      }
    }
  };

  const handleBilledGstinChange = (regId: string) => {
    if (!regId) {
      setHeaderState(prev => ({
        ...prev,
        billedPartyGstinId: null,
        billedGstin: null
      }));
      return;
    }
    const reg = customerGstRegistrations.find(r => r.id === regId);
    if (!reg) return;
    setHeaderState(prev => ({
      ...prev,
      billedPartyGstinId: reg.id,
      billedGstin: reg.gstin,
      placeOfSupplyCode: prev.deliveryLocationId ? prev.placeOfSupplyCode : reg.state_code
    }));
  };

  const handleDeliveryLocationChange = (locId: string) => {
    if (!locId) {
      setHeaderState(prev => {
        const billedReg = customerGstRegistrations.find(r => r.id === prev.billedPartyGstinId);
        return {
          ...prev,
          deliveryLocationId: null,
          deliveryStoreCode: null,
          deliveryGstin: null,
          deliveryLocationSnapshot: null,
          psvPartyId: null,
          placeOfSupplyCode: billedReg?.state_code || null
        };
      });
      return;
    }
    const loc = customerDeliveryLocations.find(l => l.id === locId);
    if (!loc) return;
    const snapshot = {
      id: loc.id,
      store_code: loc.store_code,
      location_name: loc.location_name,
      site_type: loc.site_type,
      address_line1: loc.address_line1,
      address_line2: loc.address_line2,
      city: loc.city,
      district: loc.district,
      state_code: loc.state_code,
      state_name: loc.state_name,
      pin_code: loc.pin_code,
      delivery_gstin: loc.delivery_gstin,
      contact_person: loc.contact_person,
      contact_phone: loc.contact_phone
    };
    setHeaderState(prev => ({
      ...prev,
      deliveryLocationId: loc.id,
      deliveryStoreCode: loc.store_code,
      deliveryGstin: loc.delivery_gstin || null,
      deliveryLocationSnapshot: snapshot,
      placeOfSupplyCode: loc.state_code
    }));

    // Auto-resolve PSV party for chosen delivery location
    void apiFetchV1<any>("/psv/resolve-store-party", {
      method: "POST",
      body: JSON.stringify({
        delivery_location_id: loc.id,
        customer_id: headerState.customer?.id,
      }),
    }).then(res => {
      if (res?.psv_party_id) {
        setHeaderState(prev => ({
          ...prev,
          psvPartyId: res.psv_party_id,
        }));
      }
    }).catch(err => {
      console.warn("[BillingTerm] Automatic PSV account resolution notice:", err);
    });
  };

  const handleBillingLocationChange = (locId: string) => {
    if (!locId) {
      setHeaderState(prev => ({
        ...prev,
        billingLocationId: null,
        billingStoreCode: null,
        billingAddress: null
      }));
      return;
    }
    const loc = customerBillingLocations.find(l => l.id === locId);
    if (!loc) return;
    setHeaderState(prev => ({
      ...prev,
      billingLocationId: loc.id,
      billingStoreCode: loc.billing_store_code,
      billingAddress: [loc.address_line1, loc.address_line2, loc.city, `${loc.state} - ${loc.pincode}`]
        .filter(Boolean).join(", ")
    }));
  };

  // Direct Entry Row (F11) State
  const [directEntry, setDirectEntry] = useState<{
    barcode: string;
    stockNo: string;
    itemDescription: string;
    rate: string;
    qty: string;
    discCode: string;
    discQty: string;
    discPercent: string;
    staff: string;
  }>({
    barcode: "",
    stockNo: "",
    itemDescription: "",
    rate: "",
    qty: "1",
    discCode: "",
    discQty: "",
    discPercent: "",
    staff: currentUser?.name || ""
  });

  const salesStaffOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const person of salespeople) {
      options.set(person.name, person.code ? `${person.code} · ${person.name}` : person.name);
    }
    for (const value of [currentUser?.name, headerState.salesStaff, directEntry.staff, ...items.map(item => item.salesStaff)]) {
      if (value?.trim() && !options.has(value)) options.set(value, value);
    }
    return Array.from(options, ([value, label]) => ({ value, label }));
  }, [salespeople, currentUser?.name, headerState.salesStaff, directEntry.staff, items]);

  // Tabbed Details State (Footer Left Card & Bottom Drawers)
  const [activeFooterTab, setActiveFooterTab] = useState<"transporter" | "payment" | "addons">("transporter");
  const [activeFooterDrawer, setActiveFooterDrawer] = useState<"none" | "transporter" | "payment" | "addons" | "remarks">("none");
  const [showMoreDetails, setShowMoreDetails] = useState<boolean>(false);
  const [showMoreMenu, setShowMoreMenu] = useState<boolean>(false);
  const [transporterRows, setTransporterRows] = useState<TransporterRow[]>(() =>
    DEFAULT_TRANSPORTER_ROWS.map(r => ({ ...r }))
  );
  const [addonRows, setAddonRows] = useState<AddonDeductionRow[]>(() =>
    DEFAULT_ADDON_ROWS.map(r => ({ ...r }))
  );

  // Customers State & Auto-Populate Search
  // getCustomers() returns backend-seeded cache (populated by refreshCustomerCache on login).
  // Empty array on cold start is correct — Billing search uses backend typeahead, not this list.
  const [customers, setCustomers] = useState<Customer[]>(() => {
    if (initialCustomersProp && initialCustomersProp.length > 0) return initialCustomersProp;
    return getCustomers(); // returns [] if cache not yet warm; backend typeahead still works
  });
  const [customerSearchInput, setCustomerSearchInput] = useState<string>("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState<boolean>(false);
  const [isCustomerSearching, setIsCustomerSearching] = useState<boolean>(false);
  const [customerSuggestions, setCustomerSuggestions] = useState<TypeaheadOption[]>([]);
  const [customerSelectedIndex, setCustomerSelectedIndex] = useState<number>(0);
  const customerDebounceRef = useRef<any>(null);

  // Direct Entry Product Auto-Populate Search
  const [showProductDropdown, setShowProductDropdown] = useState<boolean>(false);
  const [isProductSearching, setIsProductSearching] = useState<boolean>(false);
  const [productSearchError, setProductSearchError] = useState<string | null>(null);
  const [productSuggestions, setProductSuggestions] = useState<AutoPopulateProductResult[]>([]);
  const [productSelectedIndex, setProductSelectedIndex] = useState<number>(0);
  const [activeItemSearchField, setActiveItemSearchField] = useState<"stockNo" | "barcode">("stockNo");
  const [selectedItemProductMeta, setSelectedItemProductMeta] = useState<AutoPopulateProductResult | null>(null);
  const productDebounceRef = useRef<any>(null);
  const directBarcodeRef = useRef<HTMLInputElement>(null);

  // Product Resolution & Validation Modal States
  const [productNotFoundState, setProductNotFoundState] = useState<{
    isOpen: boolean;
    barcode: string;
    message?: string;
  }>({
    isOpen: false,
    barcode: "",
    message: ""
  });

  const [productInactiveState, setProductInactiveState] = useState<{
    isOpen: boolean;
    barcode: string;
    name?: string;
    reason?: string;
  }>({
    isOpen: false,
    barcode: "",
    name: "",
    reason: ""
  });

  const [isResolvingProduct, setIsResolvingProduct] = useState<boolean>(false);

  const canAddProduct = useMemo(() => {
    const role = (currentUser?.role || "").toUpperCase();
    return ["SYSADMIN", "ADMIN", "MANAGER", "STORE_MANAGER"].includes(role);
  }, [currentUser?.role]);

  const handleScanAgain = () => {
    setProductNotFoundState({ isOpen: false, barcode: "", message: "" });
    setProductInactiveState({ isOpen: false, barcode: "", name: "", reason: "" });
    setDirectEntry(prev => ({
      ...prev,
      barcode: "",
      stockNo: "",
      itemDescription: "",
      rate: "",
      qty: "1"
    }));
    setTimeout(() => {
      if (activeItemSearchField === "barcode") {
        directBarcodeRef.current?.focus();
        directBarcodeRef.current?.select();
      } else {
        directStockNoRef.current?.focus();
        directStockNoRef.current?.select();
      }
    }, 50);
  };

  const handleAddProductFromModal = () => {
    const code = productNotFoundState.barcode;
    setProductNotFoundState({ isOpen: false, barcode: "", message: "" });
    onNotification?.(
      "Register Product",
      `Please register product with identifier '${code}' in Master Catalog before billing.`,
      "info"
    );
    window.dispatchEvent(new CustomEvent("smriti:open-catalog", { detail: { barcode: code } }));
  };

  const [showAddCustomerModal, setShowAddCustomerModal] = useState<boolean>(false);
  const [newCustName, setNewCustName] = useState<string>("");
  const [newCustMobile, setNewCustMobile] = useState<string>("");
  const [newCustGstin, setNewCustGstin] = useState<string>("");

  // Modals State
  const [showSmritiItemSearchModal, setShowSmritiItemSearchModal] = useState<boolean>(false);
  const [showF6PromoModal, setShowF6PromoModal] = useState<boolean>(false);
  const [showDefinePromosModal, setShowDefinePromosModal] = useState<boolean>(false);
  const [showDefineFactorsModal, setShowDefineFactorsModal] = useState<boolean>(false);

  // Synchronize applicable sales factors (universal + customer price group specific)
  const refreshSalesFactors = () => {
    const customer = headerState.customer;
    const applicable = SmritiSalesFactorService.getFactorsForCustomerAndPriceGroup(
      customer?.priceGroupCode,
      customer?.id
    );
    if (applicable.length > 0) {
      const mappedRows: AddonDeductionRow[] = applicable
        .filter(f => f.factorType === "ADD_ON" || f.factorType === "DEDUCTION")
        .map((f, idx) => ({
          sNo: idx + 1,
          type: f.factorType === "ADD_ON" ? "Addon" : "Deduction",
          code: f.code,
          description: f.description,
          rateType: f.rateOrAmount === "RATE" ? "Percentage" : "Fixed",
          rate: f.rateOrAmount === "RATE" ? f.value : 0,
          amount: f.rateOrAmount === "AMOUNT" ? f.value : 0,
          timing: f.computationTiming,
          priceGroupCode: f.priceGroupCode,
          isVariable: f.isVariable
        }));
      setAddonRows(mappedRows);
    }
  };

  useEffect(() => {
    refreshSalesFactors();
  }, [headerState.customer?.priceGroupCode, headerState.customer?.id]);

  const [billLevelPromo, setBillLevelPromo] = useState<SmritiBillLevelPromoState>({
    code: "NONE",
    description: "No bill discount applied",
    discountPct: 0,
    discountAmt: 0,
    calculatedOn: 0,
    priceOffs: 0,
    maxAllowed: undefined,
    applyBillLevelFirst: false,
    reason: "Generally Allowed Discount",
    remarks: ""
  });
  const [isManualBillPromoOverride, setIsManualBillPromoOverride] = useState<boolean>(false);
  const [showSettlementModal, setShowSettlementModal] = useState<boolean>(false);
  const [billingPreview, setBillingPreview] = useState<{
    fingerprint: string;
    result?: BillingPreviewResult;
    error?: string;
    loading: boolean;
  } | null>(null);
  const [billingPreviewRetry, setBillingPreviewRetry] = useState(0);
  const [showRecallModal, setShowRecallModal] = useState<boolean>(false);
  const [showBulkAddItemsModal, setShowBulkAddItemsModal] = useState<boolean>(false);
  const [showBarcodeCSVImportModal, setShowBarcodeCSVImportModal] = useState<boolean>(false);
  const [expandedHeldBillId, setExpandedHeldBillId] = useState<string | null>(null);
  const [showTransactionBrowserModal, setShowTransactionBrowserModal] = useState<boolean>(false);
  const [isReadOnlyView, setIsReadOnlyView] = useState<boolean>(false);
  const [loadedDocMetadata, setLoadedDocMetadata] = useState<{
    id: string;
    docNo: string;
    docType: string;
    status: string;
    date: string;
    customerName: string;
    grandTotal: number;
  } | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [showAttachmentPanel, setShowAttachmentPanel] = useState<boolean>(false);
  const [suspendedBills, setSuspendedBills] = useState<{ id: string; header: BillingHeaderState; items: BillingLineItem[]; date: string; netAmount: number }[]>([]);
  const [lastCompletedInvoice, setLastCompletedInvoice] = useState<any>(null);

  const [showDefinePrefixModal, setShowDefinePrefixModal] = useState<boolean>(false);
  const [resolvedPrefixInfo, setResolvedPrefixInfo] = useState<BillPrefixResolveResult | null>(null);

  // Dynamic Bill Prefix Resolution (Shoper 9 Parity & GST Rule 46b)
  useEffect(() => {
    let txType = headerState.transaction === "Cash" ? "SALES_CASH" : "SALES_CREDIT";
    if (items.length > 0 && items.every(i => (i.qty || 0) < 0)) {
      txType = "SALES_RETURN";
    }
    void SmritiBillPrefixService.resolveActivePrefix({
      transactionType: txType,
      terminalId: (currentUser as any)?.terminalId || "COMMON",
      branchId: headerState.deliveryLocationId || undefined,
      billType: headerState.billType
    }).then(res => {
      setResolvedPrefixInfo(res);
      setHeaderState(prev => {
        if (isReadOnlyView || loadedDocMetadata) return prev;
        return {
          ...prev,
          docPrefix: res.prefix,
          docNo: res.formattedDocNo
        };
      });
    });
  }, [headerState.transaction, headerState.billType, isReadOnlyView, loadedDocMetadata, items.length]);

  const hasGstProfile = Boolean(headerState.customer?.gstNumber || headerState.billedGstin);
  const transactionCustomerPolicy = billingTransactionPolicy?.customer;
  const permittedTransactions = transactionCustomerPolicy?.allowed_transactions
    || billingTransactionPolicy?.allowed_transactions
    || billingTransactionPolicy?.configuration?.allowed_transactions
    || [];
  const permittedSalesChannels = billingTransactionPolicy?.configuration?.allowed_sales_channels || [];
  const permittedSources = billingTransactionPolicy?.configuration?.allowed_source_types || [];
  const permittedBillTypes = billingTransactionPolicy?.configuration?.allowed_bill_types || [];
  const permittedTransactionType = headerState.transaction === "Credit" ? "CREDIT" : "CASH";
  const configuredTransactionType = transactionCustomerPolicy?.default_transaction
    || billingTransactionPolicy?.default_transaction
    || billingTransactionPolicy?.configuration?.default_transaction
    || "";
  const configuredTransactionIsPermitted = transactionCustomerPolicy?.default_transaction_permitted
    ?? billingTransactionPolicy?.default_transaction_permitted
    ?? permittedTransactions.includes(configuredTransactionType);
  const canChangeTransactionMode = Boolean(
    transactionCustomerPolicy?.can_change_transaction_mode
    ?? billingTransactionPolicy?.can_change_transaction_mode
  );
  const transactionModeConflict = Boolean(
    configuredTransactionType
    && (!configuredTransactionIsPermitted || configuredTransactionType !== permittedTransactionType)
  );

  const openSettlement = () => {
    if (items.length === 0) {
      onNotification?.("Settlement", "Add items to invoice before opening settlement.", "error");
      return;
    }
    if (billingPolicyLoading || !billingTransactionPolicy || billingPolicyError) {
      onNotification?.("Billing Policy Unavailable", "Wait for company, branch, and customer billing policy to load before settlement. Check the connection or ask an administrator if the issue continues.", "error");
      return;
    }
    if (billingTransactionPolicy.configuration?.customer_selection_required && !headerState.customer) {
      onNotification?.("Customer Required", "Select a customer before billing under the active company or branch policy.", "error");
      return;
    }
    if (transactionCustomerPolicy?.channel_conflict) {
      onNotification?.("Channel Policy Conflict", "The customer's configured sales channel is not allowed by company or branch policy. Ask an administrator to resolve the configuration.", "error");
      return;
    }
    if (!permittedTransactions.includes(permittedTransactionType)) {
      onNotification?.("Transaction Type Not Allowed", "The selected cash or credit mode is not permitted for this customer and branch.", "error");
      return;
    }
    if ((!configuredTransactionIsPermitted || transactionModeConflict) && !transactionModeConfirmed) {
      onNotification?.(
        "Billing Mode Confirmation Required",
        canChangeTransactionMode
          ? "Select an eligible billing mode explicitly before settlement."
          : "The configured billing mode is not available to this user. Ask an authorized user or administrator to resolve it.",
        "error"
      );
      return;
    }
    if (transactionModeConflict && !canChangeTransactionMode) {
      onNotification?.("Billing Mode Change Not Authorized", "Changing the configured billing mode requires explicit permission.", "error");
      return;
    }
    const allowedChannels = billingTransactionPolicy.configuration?.allowed_sales_channels || [];
    const allowedSources = billingTransactionPolicy.configuration?.allowed_source_types || [];
    const allowedBillTypes = billingTransactionPolicy.configuration?.allowed_bill_types || [];
    if (!allowedChannels.includes(headerState.salesChannel || "")) {
      onNotification?.("Sales Channel Not Allowed", "Choose a sales channel permitted by company and branch policy.", "error");
      return;
    }
    if (!allowedSources.includes(headerState.billingSource || "DIRECT")) {
      onNotification?.("Billing Source Not Allowed", "Choose a billing source permitted by company and branch policy.", "error");
      return;
    }
    if (!allowedBillTypes.some(value => value.toLowerCase() === headerState.billType.toLowerCase())) {
      onNotification?.("Bill Type Not Allowed", "Choose a bill type permitted by company and branch policy.", "error");
      return;
    }
    if (transactionCustomerPolicy?.require_po_number && !headerState.poReference?.trim() && !headerState.customerPoId) {
      setShowMoreDetails(true);
      onNotification?.("PO Reference Required", "Enter the customer purchase-order reference in Details before settlement.", "error");
      return;
    }
    if (!previewIsCurrent) {
      onNotification?.(
        "Billing Preview Pending",
        currentPreviewError || "Wait for the backend-authoritative billing preview before opening settlement.",
        "error",
      );
      return;
    }
    if (hasUnsupportedCharges) {
      onNotification?.(
        "Additional Charges Not Supported",
        "The backend preview and posting contract does not yet include freight, add-ons, or deductions. Remove those rows before settlement so the invoice total is not presented as validated.",
        "error",
      );
      return;
    }
    if (!hasGstProfile) {
      onNotification?.("GST profile pending", "Add a customer GSTIN before opening settlement.", "error");
      return;
    }
    if (requiresCreditOverride) {
      if (!transactionCustomerPolicy?.can_override_credit || !transactionCustomerPolicy.allow_credit_override) {
        onNotification?.(
          "Credit Ceiling Exceeded",
          "The invoice exceeds the customer's available credit and no authorized override is available.",
          "error"
        );
        return;
      }
      if (!creditOverrideReason.trim()) {
        setShowMoreDetails(true);
        onNotification?.("Credit Override Reason Required", "Enter an authorized business justification in Details before settlement.", "error");
        return;
      }
    }
    setShowSettlementModal(true);
  };

  // Enterprise Retail: F7 Exact Cash Instant Checkout Ref
  const handleExactCashSettlementRef = useRef<() => void>();

  // Fullscreen State & Terminal Ref
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const terminalContainerRef = useRef<HTMLDivElement>(null);

  const handleToggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
    if (!document.fullscreenElement) {
      terminalContainerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  // Live Date & Time for Header Display
  const [liveDate, setLiveDate] = useState<string>(() => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  });
  const [liveTime, setLiveTime] = useState<string>(() => {
    return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      setLiveDate(`${day}/${month}/${year}`);
      setLiveTime(d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Quick Action Handlers
  const handleNewInvoice = () => {
    if (!isReadOnlyView && items.length > 0) {
      if (!window.confirm("Start a new invoice? Current unsaved items will be cleared.")) return;
    }
    setIsReadOnlyView(false);
    setLoadedDocMetadata(null);
    setItems([]);
    setHeaderState(prev => ({
      ...prev,
      docNo: String((parseInt(prev.docNo) || 1) + 1),
      customer: null,
      remarks: "",
      billedPartyGstinId: null,
      billedGstin: null,
      deliveryLocationId: null,
      deliveryStoreCode: null,
      deliveryGstin: null,
      deliveryLocationSnapshot: null,
      placeOfSupplyCode: null,
      poReference: "",
      customerPoId: null,
      salesChannel: "B2B_WHOLESALE",
      psvPartyId: null
    }));
    setTransporterRows(DEFAULT_TRANSPORTER_ROWS.map(r => ({ ...r })));
    setAddonRows(DEFAULT_ADDON_ROWS.map(r => ({ ...r })));
    setSelectedCustomerPO(null);
    setCustomerGstRegistrations([]);
    setCustomerDeliveryLocations([]);
    void loadBillingTransactionPolicy();
    setCreditOverrideReason("");
    setDirectEntry({
      barcode: "",
      stockNo: "",
      itemDescription: "",
      rate: "",
      qty: "1",
      discCode: "",
      discQty: "",
      discPercent: "",
      staff: headerState.salesStaff
    });
    setCustomerSearchInput("");
    setSelectedItemProductMeta(null);
    setIsManualBillPromoOverride(false);
    setBillLevelPromo({
      code: "NONE",
      description: "No bill discount applied",
      discountPct: 0,
      discountAmt: 0,
      calculatedOn: 0,
      priceOffs: 0,
      maxAllowed: undefined,
      applyBillLevelFirst: false,
      reason: "Generally Allowed Discount",
      remarks: ""
    });
    onNotification?.("New Invoice", "Fresh billing canvas initialized.", "success");
    directStockNoRef.current?.focus();
  };

  const handleVoidInvoice = () => {
    if (items.length === 0) {
      onNotification?.("Void Bill", "No items to void.", "error");
      return;
    }
    if (window.confirm("Void all line items for this transaction? (Ctrl+V)")) {
      setItems([]);
      onNotification?.("Invoice Voided", "All line items have been voided.", "success");
    }
  };

  const openCanonicalInvoicePrint = async (invoiceId: string) => {
    const printWindow = window.open("", "_blank");
    try {
      const pdf = await apiFetchV1<Blob>(`/sales/invoices/${invoiceId}/pdf`);
      const pdfUrl = URL.createObjectURL(pdf);
      if (!printWindow) {
        URL.revokeObjectURL(pdfUrl);
        throw new Error("The print window was blocked. Please allow pop-ups and retry.");
      }
      printWindow.location.href = pdfUrl;
      window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
    } catch (error: any) {
      printWindow?.close();
      onNotification?.("Print Error", error?.message || "Unable to render the canonical tax invoice.", "error");
    }
  };

  const handleReprintInvoice = () => {
    if (lastCompletedInvoice?.invoiceId) {
      void openCanonicalInvoicePrint(lastCompletedInvoice.invoiceId);
    } else if (items.length > 0) {
      setShowPrintModal(true);
    } else {
      onNotification?.("Reprint", "No recent invoice to reprint.", "error");
    }
  };

  // References
  const directStockNoRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);

  // ─── F2 Universal Lookup Architecture v2 — Screen Registration ───────────
  // F2 when focus is on the customer field → entity=customer (Tier 1 data-f2-entity).
  // F2 on the direct-entry stockNo field → entity=variant (Tier 1 data-f2-entity).
  // Resolution priority:
  //   Tier 1: data-f2-entity attribute on the focused element (customerSearch, directStockNo)
  //   Tier 2: fieldOverrides map below (belt-and-suspenders for the stockNo field)
  //   Tier 3: defaultEntity = "customer" (fallback for untagged fields)
  // The click-triggered ProductSearchBrowserModal (setShowProductSearchModal) is NOT
  // affected — it is a non-F2 consumer and is preserved.
  useF2Screen({
    screenId: "BillingTerm",
    defaultEntity: "customer",
    fieldOverrides: new Map([
      ["customerSearch",  "customer" as const],
      ["directStockNo",   "variant"  as const],
    ]),
    adapter: (result: LookupResult) => {
      // ── Customer lookup ────────────────────────────────────────────────────
      if (result.entity === "customer") {
        const custObj: Customer = {
          id: result.id ?? "",
          name: result.displayValue || "",
          mobile: (result.record?.mobile as string) || (result.record?.phone as string) || "",
          gstNumber: (result.record?.gst_number as string) || (result.record?.gstNumber as string) || "",
          customerGroupId: (result.record?.customer_group_id as string) || (result.record?.customerGroupId as string) || "CG-Retail",
          priceGroupCode: (result.record?.price_group_code as string) || (result.record?.priceGroupCode as string) || undefined,
          itemClassificationPriceFactorApplicable: Boolean(result.record?.item_classification_price_factor_applicable ?? result.record?.itemClassificationPriceFactorApplicable),
          creditLimit: Number(result.record?.credit_limit ?? result.record?.creditLimit ?? 0) || undefined,
          creditDays: Number(result.record?.credit_days ?? result.record?.creditDays ?? 0) || undefined,
          status: (result.record?.status as string) || "Active",
          outstanding: Number(result.record?.outstanding_balance ?? result.record?.outstanding ?? 0),
          createdDate: (result.record?.created_at as string) || new Date().toISOString().split("T")[0],
        };
        setHeaderState(prev => ({
          ...prev,
          customer: custObj,
          billedPartyGstinId: null,
          billedGstin: null,
          deliveryLocationId: null,
          deliveryStoreCode: null,
          deliveryGstin: null,
          deliveryLocationSnapshot: null,
          psvPartyId: null,
          placeOfSupplyCode: null,
          poReference: ""
        }));
        setCustomerSearchInput(result.displayValue || "");
        if (custObj.id) {
          fetchCustomerB2BData(custObj.id);
          void loadBillingTransactionPolicy(custObj.id);
        } else {
          setCustomerGstRegistrations([]);
          setCustomerDeliveryLocations([]);
          void loadBillingTransactionPolicy();
        }
        setCreditOverrideReason("");
        return;
      }

      // ── Variant / Item / Barcode lookup (direct entry row) ─────────────────
      if (result.entity === "variant" || result.entity === "item" || result.entity === "item_barcode") {
        const stockVal  = (result.record?.stock_no as string)
                       || (result.record?.style_code as string)
                       || result.returnValue
                       || "";
        const barcodeVal = (result.record?.barcode as string)
                        || (result.record?.default_barcode as string)
                        || stockVal;
        const descVal   = result.displayValue
                       || (result.record?.name as string)
                       || "";
        const rateVal   = String(
                          (result.record?.selling_price as number)
                       || (result.record?.mrp as number)
                       || (result.record?.price as number)
                       || 0
                        );
        const numRate = parseFloat(rateVal) || 0;
        const numQty = parseFloat(directEntry.qty) || 1;
        const bestPromo = SmritiSalesPromotionService.resolveBestItemPromo({
          sku: stockVal,
          barcode: barcodeVal,
          category: (result.record?.category as string) || "",
          brand: (result.record?.brand as string) || undefined,
          rate: numRate,
          qty: numQty,
          customerGroup: headerState.customer?.customerGroupId || (headerState.customer?.name?.toUpperCase().includes("RELIANCE") ? "RELIANCE" : undefined),
          customerCode: headerState.customer?.id,
          evalDate: new Date()
        });

        setDirectEntry(prev => ({
          ...prev,
          stockNo:         stockVal,
          barcode:         barcodeVal,
          itemDescription: descVal,
          rate:            rateVal,
          discCode:        bestPromo.promo ? bestPromo.promoCode : (prev.discCode || "ILD"),
          discPercent:     bestPromo.promo ? bestPromo.discountPct.toFixed(2) : (prev.discPercent || "0.00"),
          discQty:         prev.discQty || prev.qty || "1"
        }));
        // Keep focus in the direct-entry row after selection (focus restoration
        // is handled by F2Dispatcher.closeLookup → originElementRef, which points
        // back to the directStockNoRef input automatically).
        if (process.env.NODE_ENV !== "production") {
          console.debug("[BillingTerm][F2] variant adapter applied:", { stockVal, rateVal });
        }
        return;
      }

      // ── Unresolved entity — development-only warning ───────────────────────
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[BillingTerm][F2] FieldAdapter received unhandled entity:",
          result.entity,
          "— no state update performed."
        );
      }
    }
  });

  // Live Products State for item browse, modals, and search
  const [liveProducts, setLiveProducts] = useState<Product[]>(products);

  const fetchProducts = async () => {
    try {
      let list: any[] = [];
      try {
        const res = await apiFetchV1("/universal/items?limit=100");
        const raw = Array.isArray(res) ? res : (res?.items || res?.data || []);
        if (raw.length > 0) {
          list = raw.map((p: any) => ({
            ...p,
            id: p.id || p.item_code,
            name: p.item_name || p.name,
            code: p.item_code || p.code,
            price: Number(p.selling_price || p.price || 0),
            mrp: Number(p.mrp || 0),
            cost_price: Number(p.cost_price || 0),
          }));
        }
      } catch {
        const res = await apiFetchV1("/products?page_size=100");
        list = Array.isArray(res) ? res : (res?.items || []);
      }
      if (list.length > 0) {
        setLiveProducts(list);
      }
    } catch {
      // offline fallback
    }
  };

  const fetchCustomers = async () => {
    try {
      const params = new URLSearchParams({
        limit: "100",
        invoice_series: invoiceCustomerScope.series,
        invoice_from: String(invoiceCustomerScope.from),
        invoice_to: String(invoiceCustomerScope.to),
      });
      const res = await apiFetchV1(`/crm/customers?${params.toString()}`);
      const list = Array.isArray(res) ? res : (res?.items || []);
      if (list.length > 0) {
        setCustomers(list);
        saveCustomers(list);
        return;
      }
    } catch {
      // Offline fallback
    }
    const local = getCustomers();
    setCustomers(local || []);
  };

  const fetchSuspendedInvoices = async () => {
    try {
      const res = await apiFetchV1("/sales/invoices/suspended");
      const list = Array.isArray(res) ? res : (res?.items || []);
      const mapped = list.map((inv: any) => ({
        id: inv.id,
        invoice_no: inv.invoice_no,
        header: {
          billType: "Product" as BillType,
          transaction: (inv.payment_mode === "CASH" ? "Cash" : "Credit") as TransactionType,
          docPrefix: inv.invoice_no?.split("-")?.[0] || "INV",
          docNo: inv.invoice_no?.split("-")?.[1] || "1",
          billDate: inv.date ? new Date(inv.date).toLocaleDateString("en-GB") : new Date().toLocaleDateString("en-GB"),
          customer: inv.customer_id ? { id: inv.customer_id, name: inv.customer_name || "Counter Cash", gstNumber: inv.customer_gstin } as Customer : null,
          salesStaff: inv.salesperson_name || "Staff",
          remarks: inv.import_validation_notes || ""
        },
        items: (inv.items || []).map((it: any, idx: number) => ({
          id: "item-" + idx,
          sNo: idx + 1,
          stockNo: it.code,
          barcode: it.code,
          itemDescription: it.name,
          rate: Number(it.price || 0),
          qty: Number(it.quantity || 1),
          value: Number(it.price || 0) * Number(it.quantity || 1),
          discCode: "",
          discQty: 0,
          discPercent: Number(it.disc_pct || 0),
          discAmt: 0,
          total: Number(it.total_amount || (Number(it.price || 0) * Number(it.quantity || 1))),
          salesStaff: inv.salesperson_name || "Staff",
          productId: it.product_id,
          gstPercentage: Number(it.gst_rate || 18),
          taxAmount: Number(it.tax_amount || 0)
        })),
        transporterRows: inv.rule_snapshots?.transporterRows || inv.transporterRows || [],
        addonRows: inv.rule_snapshots?.addonRows || inv.addonRows || [],
        rule_snapshots: inv.rule_snapshots || {},
        date: inv.created_at || inv.date,
        netAmount: Number(inv.grand_total || 0)
      }));
      setSuspendedBills(mapped);
    } catch {
      // offline fallback
    }
  };

  // Focus direct entry row on mount & fetch live data
  useEffect(() => {
    fetchCustomers();
    fetchProducts();
    fetchSuspendedInvoices();
    directStockNoRef.current?.focus();
  }, []);

  // Global Keyboard Shortcuts Listener #1
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // F2 handled by F2DispatcherProvider (F2 Universal Lookup Architecture v2).
      // This screen registers via useF2Screen() above. No screen-level F2 handler.
      if (e.key === "F11") {
        e.preventDefault();
        if (activeItemSearchField === "barcode") {
          directBarcodeRef.current?.focus();
        } else {
          directStockNoRef.current?.focus();
        }
      } else if (e.key === "F6") {
        e.preventDefault();
        setShowF6PromoModal(true);
      } else if (e.altKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        setShowDefinePromosModal(true);
      } else if (e.altKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        setShowDefineFactorsModal(true);
      } else if (e.key === "F4" || (e.altKey && e.key === "6")) {
        e.preventDefault();
        setShowTransactionBrowserModal(true);
      } else if (e.key === "F7") {
        e.preventDefault();
        handleExactCashSettlementRef.current?.();
      } else if (e.key === "F8") {
        e.preventDefault();
        openSettlement();
      } else if (e.key === "F12") {
        e.preventDefault();
        handleSuspendInvoice();
      } else if (e.ctrlKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        if (selectedRowIndex >= 0 && selectedRowIndex < items.length) {
          const toRemove = items[selectedRowIndex];
          handleRemoveItem(toRemove.id);
          setSelectedRowIndex(-1);
          if (editingLineId === toRemove.id) {
            setEditingLineId(null);
          }
          onNotification?.("Item Deleted", `Removed line item #${toRemove.sNo} (${toRemove.stockNo}) [Ctrl+D].`, "success");
        } else {
          onNotification?.("Delete Item", "Select an item from the table before pressing Ctrl+D.", "error");
        }
      } else if (e.key === "Escape") {
        if (editingLineId) {
          e.preventDefault();
          setEditingLineId(null);
          setDirectEntry({
            barcode: "",
            stockNo: "",
            itemDescription: "",
            rate: "",
            qty: "1",
            discCode: "",
            discQty: "",
            discPercent: "",
            staff: directEntry.staff
          });
          onNotification?.("Edit Cancelled", "Direct entry reset to scan mode.", "info");
        }
      } else if (e.key === "ArrowUp") {
        const activeTag = (document.activeElement?.tagName || "").toLowerCase();
        if (activeTag !== "input" && activeTag !== "select" && activeTag !== "textarea") {
          e.preventDefault();
          setSelectedRowIndex(prev => Math.max(0, prev - 1));
        }
      } else if (e.key === "ArrowDown") {
        const activeTag = (document.activeElement?.tagName || "").toLowerCase();
        if (activeTag !== "input" && activeTag !== "select" && activeTag !== "textarea") {
          e.preventDefault();
          setSelectedRowIndex(prev => Math.min(items.length - 1, prev + 1));
        }
      } else if (e.ctrlKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        handleNewInvoice();
      } else if (e.ctrlKey && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        handleVoidInvoice();
      } else if (e.ctrlKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        handleReturnInvoice();
      } else if (e.ctrlKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        handleReprintInvoice();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [items, headerState, lastCompletedInvoice, activeItemSearchField, hasGstProfile, selectedRowIndex, editingLineId]);

  const handleSelectCustomer = (c: Customer | null) => {
    setHeaderState(prev => ({
      ...prev,
      customer: c,
      billedPartyGstinId: null,
      billedGstin: null,
      deliveryLocationId: null,
      deliveryStoreCode: null,
      deliveryGstin: null,
      deliveryLocationSnapshot: null,
      psvPartyId: null,
      placeOfSupplyCode: null,
      poReference: "",
      customerPoId: null
    }));
    setSelectedCustomerPO(null);
    if (c) {
      setCustomerSearchInput(c.name);
      fetchCustomerB2BData(c.id);
      void loadBillingTransactionPolicy(c.id);
    } else {
      setCustomerGstRegistrations([]);
      setCustomerDeliveryLocations([]);
      void loadBillingTransactionPolicy();
    }
    setCreditOverrideReason("");
    setShowCustomerDropdown(false);
  };

  const applyCustomerAutoPopulate = (r: AutoPopulateCustomerResult | Customer) => {
    const custObj: Customer = {
      id: r.id,
      name: r.name,
      mobile: (r as any).mobile || (r as any).phone || "",
      gstNumber: (r as any).gstNumber || (r as any).gst_number,
      customerGroupId: (r as any).customerGroupId || (r as any).customer_group_id || "CG-Retail",
      priceGroupCode: (r as any).priceGroupCode || (r as any).price_group_code || undefined,
      itemClassificationPriceFactorApplicable: Boolean((r as any).itemClassificationPriceFactorApplicable ?? (r as any).item_classification_price_factor_applicable),
      creditLimit: Number((r as any).creditLimit ?? (r as any).credit_limit ?? 0) || undefined,
      status: (r as any).status || "Active",
      outstanding: (r as any).outstanding || (r as any).outstanding_balance || 0,
      createdDate: (r as any).createdDate || (r as any).created_at || new Date().toISOString().split("T")[0]
    };

    setHeaderState(prev => ({
      ...prev,
      customer: custObj,
      billedPartyGstinId: null,
      billedGstin: null,
      deliveryLocationId: null,
      deliveryStoreCode: null,
      deliveryGstin: null,
      deliveryLocationSnapshot: null,
      psvPartyId: null,
      placeOfSupplyCode: null,
      poReference: ""
    }));

    setCustomerSearchInput(r.name);
    setShowCustomerDropdown(false);
    if (custObj.id) {
      fetchCustomerB2BData(custObj.id);
      void loadBillingTransactionPolicy(custObj.id);
    }
    setCreditOverrideReason("");
    onNotification?.("Customer Auto-Populated", `Auto-populated ${r.name} from backend.`, "success");
  };

  const handleCustomerSearchChange = (val: string) => {
    setCustomerSearchInput(val);
    setShowCustomerDropdown(true);

    if (!val.trim()) {
      setHeaderState(prev => ({
        ...prev,
        customer: null,
        billedPartyGstinId: null,
        billedGstin: null,
        deliveryLocationId: null,
        deliveryStoreCode: null,
        deliveryGstin: null,
        deliveryLocationSnapshot: null,
        placeOfSupplyCode: null,
        poReference: ""
      }));
      setCustomerSuggestions([]);
      setCustomerGstRegistrations([]);
      setCustomerDeliveryLocations([]);
      void loadBillingTransactionPolicy();
      return;
    }

    if (customerDebounceRef.current) clearTimeout(customerDebounceRef.current);
    setIsCustomerSearching(true);

    customerDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchBackendCustomers(val, invoiceCustomerScope);
        const options: TypeaheadOption[] = results.map(r => ({
          id: r.id,
          title: r.name,
          subtitle: `${r.mobile || "No Mobile"} • ${r.customerGroupId || "CG-Retail"}`,
          badge: r.outstanding > 0 ? `Bal: ₹${r.outstanding}` : "Clear",
          badgeColor: r.outstanding > 0 ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
          iconType: "customer",
          metadata: r
        }));
        setCustomerSuggestions(options);
        setCustomerSelectedIndex(0);

        // Immediate exact match check
        const clean = val.trim().toLowerCase();
        const exact = results.find(r =>
          r.name.toLowerCase() === clean ||
          r.mobile === val.trim() ||
          r.id.toLowerCase() === clean ||
          r.code.toLowerCase() === clean
        );
        if (exact) {
          applyCustomerAutoPopulate(exact);
        }
      } finally {
        setIsCustomerSearching(false);
      }
    }, 150);
  };

  // NOTE: Legacy Keyboard Shortcuts Listener #2 has been removed as part of
  // F2 Universal Lookup Architecture v2 Phase B Batch 1 (2026-09-02).
  // Its unique hotkeys (F7/F8 settlement) are already covered by Listener #1
  // above. F2 routing is now exclusively handled by F2DispatcherProvider.

  // Derived Direct Entry Calculations
  const directRateNum = parseFloat(directEntry.rate) || 0;
  const directQtyNum = parseFloat(directEntry.qty) || 0;
  const directGrossValue = directRateNum * directQtyNum;
  const directDiscPctNum = parseFloat(directEntry.discPercent) || 0;
  const directDiscAmt = directDiscPctNum > 0 ? (directGrossValue * directDiscPctNum) / 100 : (parseFloat(directEntry.discQty) || 0);
  const directLineTotal = Math.max(0, directGrossValue - directDiscAmt);

  // Recompute Summary Totals
  const estimatedSummaryTotals: BillingSummaryTotals = useMemo(() => {
    const transaction: SalesTransaction = {
      docType: "billing",
      docPrefix: headerState.docPrefix || "INV",
      docNumber: headerState.docNo || "1",
      docDate: headerState.billDate || new Date().toISOString().split("T")[0],
      docTime: liveTime || new Date().toTimeString().slice(0, 5),
      customerId: headerState.customer?.id,
      customerCode: headerState.customer?.code,
      customerName: headerState.customer?.name,
      referenceNo: "",
      deliveryTerms: "",
      paymentTerms: "",
      orderStatus: "Open",
      remarks: headerState.remarks,
      items: items.map((it) => ({
        id: it.id,
        productId: it.productId,
        stockNo: it.stockNo,
        barcode: it.barcode,
        itemDescription: it.itemDescription,
        qty: Number(it.qty || 0),
        rate: Number(it.rate || 0),
        value: Number(it.value || 0),
        discPercent: Number(it.discPercent || 0),
        discAmt: Number(it.discAmt || 0),
        taxPercent: Number(it.gstPercentage ?? (it.taxAmount ? 18 : 0)),
        taxAmount: Number(it.taxAmount || 0),
        isTaxInclusive: it.isTaxInclusive
          ?? headerState.customer?.isTaxInclusive
          ?? headerState.customer?.is_tax_inclusive
          ?? headerState.customer?.taxInclusive
          ?? ((headerState.salesChannel || "").toUpperCase() === "POS_RETAIL"),
        total: Number(it.total || 0),
      })),
      subtotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      netAmount: 0,
    };

    const recomputed = recomputeTransaction(transaction);
    const itemCount = items.length;
    const totalQty = items.reduce((sum, it) => sum + Number(it.qty || 0), 0);

    // Fail-Safe Zero-Item Guard: With zero billable items or zero quantity, all monetary totals must strictly evaluate to ₹0.00
    if (itemCount === 0 || totalQty === 0) {
      return {
        itemCount: 0,
        totalQty: 0,
        salesValue: 0,
        itemDiscount: 0,
        billDiscount: 0,
        totalTax: 0,
        totalAddons: 0,
        totalDeductions: 0,
        aboveTaxAddons: 0,
        aboveTaxDeductions: 0,
        belowTaxAddons: 0,
        belowTaxDeductions: 0,
        adjustedTaxableValue: 0,
        roundOff: 0,
        netAmount: 0,
      };
    }

    const roundCurrency = (amount: number) => Math.round(amount * 100) / 100;
    const lineDiscountBases = recomputed.items.map((line) =>
      Math.max(0, roundCurrency(line.value - (line.discAmt || 0)))
    );
    const undiscountedBillDiscount = billLevelPromo.discountAmt || ((recomputed.subtotal * billLevelPromo.discountPct) / 100);
    const billDiscount = roundCurrency(Math.min(
      Math.max(0, undiscountedBillDiscount),
      lineDiscountBases.reduce((total, base) => total + base, 0)
    ));
    let aboveTaxAddons = 0;
    let aboveTaxDeductions = 0;
    let belowTaxAddons = transporterRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    let belowTaxDeductions = 0;

    const baseForPerc = Math.max(0, recomputed.subtotal - recomputed.discountTotal);

    addonRows.forEach(a => {
      let val = Number(a.amount) || 0;
      if (a.rateType === "Percentage" && a.rate > 0) {
        val = Math.round((baseForPerc * (a.rate / 100)) * 100) / 100;
      }
      if (a.type === "Addon") {
        if (a.timing === "ABOVE_TAX") {
          aboveTaxAddons += val;
        } else {
          belowTaxAddons += val;
        }
      } else {
        if (a.timing === "ABOVE_TAX") {
          aboveTaxDeductions += val;
        } else {
          belowTaxDeductions += val;
        }
      }
    });

    const rawTaxable = Math.max(0, baseForPerc - billDiscount + aboveTaxAddons - aboveTaxDeductions);
    const adjustedTaxableValue = Math.round(rawTaxable * 100) / 100;

    const totalAddons = Math.round((aboveTaxAddons + belowTaxAddons) * 100) / 100;
    const totalDeductions = Math.round((aboveTaxDeductions + belowTaxDeductions) * 100) / 100;
    const unroundedNet = Math.max(0, adjustedTaxableValue + belowTaxAddons - belowTaxDeductions);
    const roundedNet = roundCurrency(unroundedNet);
    const roundOff = roundCurrency(roundedNet - unroundedNet);
    const netAmount = roundedNet;

    return {
      itemCount,
      totalQty,
      salesValue: recomputed.subtotal,
      itemDiscount: recomputed.discountTotal,
      billDiscount,
      totalTax: 0,
      totalAddons,
      totalDeductions,
      aboveTaxAddons: Math.round(aboveTaxAddons * 100) / 100,
      aboveTaxDeductions: Math.round(aboveTaxDeductions * 100) / 100,
      belowTaxAddons: Math.round(belowTaxAddons * 100) / 100,
      belowTaxDeductions: Math.round(belowTaxDeductions * 100) / 100,
      adjustedTaxableValue,
      roundOff,
      netAmount
    };
  }, [items, transporterRows, addonRows, headerState, liveTime, billLevelPromo]);

  const postingLines = useMemo(
    () => prepareBillingPostingLines(items, estimatedSummaryTotals.billDiscount),
    [items, estimatedSummaryTotals.billDiscount],
  );
  const previewRequest = useMemo(() => {
    const tenant = getTenantCompanyContext();
    return buildBillingPreviewRequest({
      items,
      postingLines,
      transporterRows,
      addonRows,
      companyId: normalizeCompanyId(currentUser?.companyId || tenant.companyId),
      branchId: normalizeBranchId(currentUser?.branchId || tenant.branchId),
      salesChannel: headerState.salesChannel || "B2B_WHOLESALE",
      customer: headerState.customer,
      billedGstin: headerState.billedGstin,
      billedPartyGstinId: headerState.billedPartyGstinId,
      billingLocationId: headerState.billingLocationId,
      billingAddress: headerState.billingAddress,
      deliveryLocationId: headerState.deliveryLocationId,
      deliveryStoreCode: headerState.deliveryStoreCode,
      deliveryGstin: headerState.deliveryGstin,
      shippingAddress: headerState.shippingAddress,
      poReference: headerState.poReference,
      customerPoId: headerState.customerPoId,
    });
  }, [
    items,
    postingLines,
    transporterRows,
    addonRows,
    currentUser?.companyId,
    currentUser?.branchId,
    headerState.salesChannel,
    headerState.customer,
    headerState.billedGstin,
    headerState.billedPartyGstinId,
    headerState.billingLocationId,
    headerState.billingAddress,
    headerState.deliveryLocationId,
    headerState.deliveryStoreCode,
    headerState.deliveryGstin,
    headerState.shippingAddress,
    headerState.poReference,
    headerState.customerPoId,
  ]);
  const previewFingerprint = useMemo(() => JSON.stringify(previewRequest), [previewRequest]);

  useEffect(() => {
    if (items.length === 0) {
      setBillingPreview(null);
      return;
    }

    let isCurrent = true;
    const timeout = window.setTimeout(() => {
      setBillingPreview({ fingerprint: previewFingerprint, loading: true });
      void apiFetchV1<BillingPreviewResult>("/billing/preview", {
        method: "POST",
        body: JSON.stringify(previewRequest satisfies BillingPreviewRequest),
      }).then((result) => {
        if (isCurrent) setBillingPreview({ fingerprint: previewFingerprint, result, loading: false });
      }).catch((error: unknown) => {
        if (!isCurrent) return;
        setBillingPreview({
          fingerprint: previewFingerprint,
          error: error instanceof Error ? error.message : "The billing preview request failed.",
          loading: false,
        });
      });
    }, 250);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeout);
    };
  }, [items.length, previewFingerprint, previewRequest, billingPreviewRetry]);

  const previewIsCurrent =
    billingPreview?.fingerprint === previewFingerprint
    && Boolean(billingPreview.result);
  const currentPreviewError =
    billingPreview?.fingerprint === previewFingerprint
      ? billingPreview.error
      : undefined;
  // All add-on, deduction, and freight charges are authoritatively calculated in backend preview & checkout
  const hasUnsupportedCharges = false;
  const summaryTotals: BillingSummaryTotals = useMemo(() => {
    if (!previewIsCurrent || !billingPreview?.result) {
      return estimatedSummaryTotals;
    }
    const authoritativeDiscount = Number(billingPreview.result.discount_amount);
    return {
      ...estimatedSummaryTotals,
      salesValue: Number(billingPreview.result.gross_amount),
      itemDiscount: Math.max(0, authoritativeDiscount - estimatedSummaryTotals.billDiscount),
      totalTax: Number(billingPreview.result.tax_total),
      totalAddons: Number(billingPreview.result.total_addons ?? estimatedSummaryTotals.totalAddons),
      totalDeductions: Number(billingPreview.result.total_deductions ?? estimatedSummaryTotals.totalDeductions),
      adjustedTaxableValue: Number(billingPreview.result.taxable_amount),
      roundOff: Number(billingPreview.result.round_off),
      netAmount: Number(billingPreview.result.net_amount),
    };
  }, [billingPreview, estimatedSummaryTotals, previewIsCurrent]);
  const requiresCreditOverride = Boolean(
    headerState.transaction === "Credit"
    && transactionCustomerPolicy
    && !transactionCustomerPolicy.unlimited_credit
    && transactionCustomerPolicy.available_credit !== null
    && transactionCustomerPolicy.available_credit !== undefined
    && summaryTotals.netAmount > transactionCustomerPolicy.available_credit
  );

  // Real-Time Bill-Level Promotion Auto-Select Engine (Cart Threshold / Highest Discount Wins)
  useEffect(() => {
    if (isManualBillPromoOverride) return;

    const subtotal = summaryTotals.salesValue;
    if (items.length === 0 || subtotal <= 0) {
      if (billLevelPromo.code !== "NONE") {
        setBillLevelPromo({
          code: "NONE",
          description: "No bill discount applied",
          discountPct: 0,
          discountAmt: 0,
          calculatedOn: 0,
          priceOffs: 0,
          maxAllowed: undefined,
          applyBillLevelFirst: false,
          reason: "Generally Allowed Discount",
          remarks: ""
        });
      }
      return;
    }

    const res = SmritiSalesPromotionService.resolveBestBillPromo({
      subtotal,
      itemsCount: items.length,
      customerGroup: headerState.customer?.customerGroupId || (headerState.customer?.name?.toUpperCase().includes("RELIANCE") ? "RELIANCE" : undefined),
      customerCode: headerState.customer?.id,
      evalDate: new Date()
    });

    if (res.applied && res.promo) {
      if (billLevelPromo.code !== res.promoCode || Math.abs(billLevelPromo.discountAmt - res.discountAmt) > 0.01) {
        setBillLevelPromo({
          code: res.promoCode,
          description: res.promoDescription,
          discountPct: res.discountPct,
          discountAmt: res.discountAmt,
          calculatedOn: subtotal,
          priceOffs: 0,
          maxAllowed: res.promo.maxDiscount,
          applyBillLevelFirst: false,
          reason: res.reason,
          remarks: res.badgeText
        });
        onNotification?.("Bill Promotion Qualified", `${res.promoName} applied (Save ₹${res.discountAmt.toFixed(2)} on bill).`, "info");
      }
    } else {
      if (billLevelPromo.code !== "NONE") {
        setBillLevelPromo({
          code: "NONE",
          description: "No bill discount applied",
          discountPct: 0,
          discountAmt: 0,
          calculatedOn: 0,
          priceOffs: 0,
          maxAllowed: undefined,
          applyBillLevelFirst: false,
          reason: "Generally Allowed Discount",
          remarks: ""
        });
      }
    }
  }, [summaryTotals.salesValue, items.length, headerState.customer?.customerGroupId, headerState.customer?.name, headerState.customer?.id, isManualBillPromoOverride]);

  const applyProductAutoPopulate = (p: AutoPopulateProductResult | Product) => {
    const rateVal = String((p as any).sellingPrice || (p as any).mrp || (p as any).price || 0);
    const stockVal = (p as any).stockNo || (p as any).styleCode || (p as any).style_code || p.code || "";
    const barcodeVal = p.barcode || (p as any).code || "";
    const numRate = parseFloat(rateVal) || 0;
    const numQty = parseFloat(directEntry.qty) || 1;

    // Auto-evaluate promotional scheme on item auto-population
    const bestPromo = SmritiSalesPromotionService.resolveBestItemPromo({
      sku: stockVal,
      barcode: barcodeVal,
      category: (p as any).category,
      brand: (p as any).brand,
      rate: numRate,
      qty: numQty,
      customerGroup: headerState.customer?.customerGroupId || (headerState.customer?.name?.toUpperCase().includes("RELIANCE") ? "RELIANCE" : undefined),
      customerCode: headerState.customer?.id,
      evalDate: new Date()
    });

    setDirectEntry(prev => ({
      ...prev,
      stockNo: stockVal,
      barcode: barcodeVal,
      itemDescription: p.name || (p as any).itemDescription || (p as any).description || "",
      rate: rateVal,
      discCode: bestPromo.promo ? bestPromo.promoCode : (prev.discCode || "ILD"),
      discPercent: bestPromo.promo ? bestPromo.discountPct.toFixed(2) : (prev.discPercent || "0.00"),
      discQty: prev.discQty || prev.qty || "1"
    }));
    setSelectedItemProductMeta(p as AutoPopulateProductResult);
    setShowProductDropdown(false);
    setProductSearchError(null);
    if (bestPromo.promo) {
      onNotification?.("Promotion Auto-Applied", `${bestPromo.promoCode} applied (${bestPromo.discountPct.toFixed(2)}% off, saving ₹${bestPromo.discountAmt.toFixed(2)}).`, "info");
    }
    setTimeout(() => {
      directStockNoRef.current?.focus();
    }, 10);
  };

  // Handle Direct Entry Barcode or Stock No Change & Real-Time Auto-Population
  const handleItemSearchChange = (val: string, fieldType: "stockNo" | "barcode") => {
    setActiveItemSearchField(fieldType);
    if (fieldType === "barcode") {
      setDirectEntry(prev => ({ ...prev, barcode: val }));
    } else {
      setDirectEntry(prev => ({ ...prev, stockNo: val }));
    }

    if (!val.trim()) {
      setShowProductDropdown(false);
      setProductSuggestions([]);
      setProductSearchError(null);
      return;
    }

    setShowProductDropdown(true);
    setProductSearchError(null);
    if (productDebounceRef.current) clearTimeout(productDebounceRef.current);
    setIsProductSearching(true);

    productDebounceRef.current = setTimeout(async () => {
      try {
        setProductSearchError(null);
        const results = await searchBackendProducts(val, products);
        setProductSuggestions(results);
        setProductSelectedIndex(0);

        // Immediate exact match check
        const clean = val.trim().toLowerCase();
        const exact = results.find(p =>
          p.code.toLowerCase() === clean ||
          p.stockNo?.toLowerCase() === clean ||
          (p.barcode && p.barcode.toLowerCase() === clean) ||
          p.sku?.toLowerCase() === clean ||
          p.id.toLowerCase() === clean
        );
        if (exact) {
          applyProductAutoPopulate(exact);
        }
      } catch (err: any) {
        setProductSearchError(err?.message || "Product lookup error");
      } finally {
        setIsProductSearching(false);
      }
    }, 120);
  };

  // Keyboard navigation for Item Typeahead in Distributor Invoicing
  const handleItemInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, fieldType: "stockNo" | "barcode") => {
    if (showProductDropdown && productSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setProductSelectedIndex(prev => (prev + 1) % productSuggestions.length);
        return;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setProductSelectedIndex(prev => (prev - 1 + productSuggestions.length) % productSuggestions.length);
        return;
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = productSuggestions[productSelectedIndex];
        if (selected) {
          applyProductAutoPopulate(selected);
        } else {
          void handleCommitDirectEntry();
        }
        return;
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowProductDropdown(false);
        return;
      }
    }

    if (e.key === "Enter") {
      e.preventDefault();
      void handleCommitDirectEntry();
    }
  };

  // Commit Direct Entry Item to Table
  const handleCommitDirectEntry = async (
    entry: typeof directEntry = directEntry,
    options: {
      preserveEntry?: boolean;
      forceAppend?: boolean;
      suppressSuccessNotice?: boolean;
      onResolvedLine?: (line: BillingLineItem) => void;
    } = {}
  ) => {
    if (isReadOnlyView) {
      onNotification?.("Read-Only View", "Items cannot be added while viewing a completed invoice.", "error");
      return false;
    }

    const entryRateNum = parseFloat(entry.rate) || 0;
    const entryQtyNum = parseFloat(entry.qty) || 0;
    const entryDiscPctNum = parseFloat(entry.discPercent) || 0;
    const entryDiscAmt = entryDiscPctNum > 0
      ? ((entryRateNum * entryQtyNum) * entryDiscPctNum) / 100
      : (parseFloat(entry.discQty) || 0);

    if (!entry.stockNo && !entry.barcode && !entry.itemDescription) return false;

    // Strict Quantity Validation
    if (isNaN(entryQtyNum) || entryQtyNum <= 0) {
      onNotification?.("Validation Error", "Quantity must be a positive number greater than 0.", "error");
      return false;
    }
    if (entryQtyNum > 99999) {
      onNotification?.("Validation Error", "Quantity exceeds maximum limit of 99,999 units.", "error");
      return false;
    }

    // Strict Rate Validation
    if (isNaN(entryRateNum) || entryRateNum < 0) {
      onNotification?.("Validation Error", "Selling rate cannot be negative.", "error");
      return false;
    }
    if (entryRateNum > 9999999.99) {
      onNotification?.("Validation Error", "Selling rate exceeds maximum limit of ₹9,999,999.99.", "error");
      return false;
    }

    const rawCode = (entry.barcode || entry.stockNo || "").trim();
    if (!rawCode) {
      onNotification?.("Product Required", "Please enter or scan a valid Stock No or Barcode.", "error");
      return false;
    }

    // Authoritative Central Resolution against Product List / Item Master
    setIsResolvingProduct(true);
    let resolvedItem: any = null;
    try {
      // 1. Primary: Authoritative canonical item resolution via /universal/items/resolve
      try {
        const uniRes = await apiFetchV1<any>(`/universal/items/resolve?query=${encodeURIComponent(rawCode)}`);
        if (uniRes && (uniRes.item_id || uniRes.variant_id)) {
          resolvedItem = {
            success: true,
            product_id: uniRes.item_id,
            variant_id: uniRes.variant_id,
            product_name: uniRes.item_name,
            sku: uniRes.variant_sku || uniRes.item_code,
            barcode: uniRes.barcode || rawCode,
            selling_price: uniRes.selling_price,
            mrp: uniRes.mrp,
            cost_price: uniRes.cost_price,
            tax_rate: uniRes.tax_rate,
            hsn_code: uniRes.hsn_code,
            uom: uniRes.primary_uom || "PCS",
            current_stock: uniRes.physical_on_hand ?? 1,
            available_stock: uniRes.available_to_promise ?? 1,
          };
        }
      } catch {
        // Fall back to /products/resolve
      }

      if (!resolvedItem) {
        const resolveRes = await apiFetchV1<any>("/products/resolve", {
          method: "POST",
          body: JSON.stringify({
            identifier: rawCode,
            company_id: currentUser?.companyId || undefined,
          })
        });

        const errCode = resolveRes?.error_code;
        if (errCode === "PRODUCT_INACTIVE" || resolveRes?.status === "INACTIVE" || resolveRes?.disposition === "REQUIRES_REVIEW") {
          setProductInactiveState({
            isOpen: true,
            barcode: rawCode,
            name: resolveRes?.product_name || rawCode,
            reason: resolveRes?.message || "This product is marked as inactive or under quarantine review and cannot be added to transactions."
          });
          return false;
        }
        if (resolveRes?.success) {
          resolvedItem = resolveRes;
        } else {
          setProductNotFoundState({
            isOpen: true,
            barcode: rawCode,
            message: resolveRes?.message || "This product is not registered in Product List. Please add the product to Product List before continuing."
          });
          return false;
        }
      }
    } catch (err: any) {
      const errDetail = err?.data || err?.detail || {};
      if (errDetail?.error_code === "PRODUCT_INACTIVE" || errDetail?.disposition === "REQUIRES_REVIEW") {
        setProductInactiveState({
          isOpen: true,
          barcode: rawCode,
          name: errDetail?.product_name || rawCode,
          reason: errDetail?.message || "This product is marked as inactive or under quarantine review."
        });
        return false;
      }
      setProductNotFoundState({
        isOpen: true,
        barcode: rawCode,
        message: errDetail?.message || "This product is not registered in Product List. Please add the product to Product List before continuing."
      });
      return false;
    } finally {
      setIsResolvingProduct(false);
    }

    const matched = resolvedItem;
    const rate = entryRateNum > 0 ? entryRateNum : Number(matched.selling_price || matched.mrp || 0);
    const qty = entryQtyNum;

    // Statutory MRP Ceiling Check: Selling price cannot exceed declared MRP
    const effectiveMrp = Number(matched.mrp || 0);
    if (effectiveMrp > 0 && rate > effectiveMrp) {
      onNotification?.(
        "Statutory Price Violation",
        `Selling price (₹${rate.toFixed(2)}) cannot exceed statutory MRP (₹${effectiveMrp.toFixed(2)}) for item '${matched.product_name || rawCode}'.`,
        "error"
      );
      return false;
    }

    // Discount Bounding Validations
    if (entryDiscPctNum < 0 || entryDiscPctNum > 100) {
      onNotification?.("Validation Error", "Discount percentage must be between 0% and 100%.", "error");
      return false;
    }
    if (entryDiscAmt < 0) {
      onNotification?.("Validation Error", "Discount amount cannot be negative.", "error");
      return false;
    }
    const lineGrossValue = rate * qty;
    if (entryDiscAmt > lineGrossValue) {
      onNotification?.(
        "Validation Error",
        `Discount amount (₹${entryDiscAmt.toFixed(2)}) cannot exceed line item gross value (₹${lineGrossValue.toFixed(2)}).`,
        "error"
      );
      return false;
    }
    // Discrete UoM Check: PCS/NOS/PAIR cannot have fractional decimals
    const itemUom = matched.uom || "PCS";
    const discreteUoms = ["PCS", "PC", "NOS", "NO", "PAIR", "PRS", "BOX", "SET", "UNIT", "DOZ"];
    if (discreteUoms.includes(itemUom.toUpperCase()) && qty % 1 !== 0) {
      onNotification?.(
        "Validation Error",
        `Fractional quantity (${qty}) is not permitted for discrete unit '${itemUom}'. Please enter a whole integer quantity.`,
        "error"
      );
      return false;
    }

    const lineItem: SalesLineItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      productId: matched.product_id,
      stockNo: matched.sku || matched.barcode || rawCode,
      barcode: matched.barcode || rawCode,
      itemDescription: matched.product_name || entry.itemDescription || "Item " + (items.length + 1),
      qty,
      rate,
      value: rate * qty,
      discPercent: entryDiscPctNum,
      discAmt: entryDiscAmt,
      taxPercent: Number(matched.tax_rate ?? 18),
      taxAmount: 0,
      total: 0,
    };

    const computedLine = calculateLineTotal(lineItem);

    // If currently editing an existing line item (Shoper 9 double-click edit contract)
    if (editingLineId && !options.forceAppend) {
      const existingIndex = items.findIndex(it => it.id === editingLineId);
      if (existingIndex !== -1) {
        const existing = items[existingIndex];
        setItems(prev => prev.map((it, idx) => {
          if (idx === existingIndex) {
            return {
              ...it,
              stockNo: matched.sku || it.stockNo,
              barcode: matched.barcode || it.barcode,
              itemDescription: matched.product_name || it.itemDescription,
              rate: computedLine.rate,
              qty: computedLine.qty,
              value: computedLine.value,
              discCode: entry.discCode,
              discQty: parseFloat(entry.discQty) || 0,
              discPercent: Number(computedLine.discPercent ?? 0),
              discAmt: Number(computedLine.discAmt ?? 0),
              total: computedLine.total,
              taxAmount: Number(computedLine.taxAmount ?? 0),
              salesStaff: entry.staff
            };
          }
          return it;
        }));

        onNotification?.("Item Updated", `Line #${existing.sNo} (${existing.stockNo}) updated successfully.`, "success");
        setEditingLineId(null);
        if (!options.preserveEntry) {
          setDirectEntry({
            barcode: "",
            stockNo: "",
            itemDescription: "",
            rate: "",
            qty: "1",
            discCode: "",
            discQty: "",
            discPercent: "",
            staff: entry.staff
          });
          setSelectedItemProductMeta(null);
          setShowProductDropdown(false);
          if (activeItemSearchField === "barcode") {
            directBarcodeRef.current?.focus();
          } else {
            directStockNoRef.current?.focus();
          }
        }
        return true;
      }
    }

    // Duplicate scan aggregation: if identical item exists at same rate, increment its quantity and dynamically re-evaluate promotions
    const existingIndex = options.forceAppend ? -1 : items.findIndex(it =>
      ((it.barcode && computedLine.barcode && it.barcode === computedLine.barcode) ||
       (it.stockNo && computedLine.stockNo && it.stockNo === computedLine.stockNo)) &&
      it.rate === computedLine.rate
    );

    if (existingIndex !== -1) {
      const existing = items[existingIndex];
      const updatedQty = existing.qty + qty;

      // Dynamic re-evaluation of promotional scheme on aggregated quantity (e.g. B2G1 on 3 units)
      let updatedDiscPct = existing.discPercent || 0;
      let updatedDiscCode = existing.discCode || "ILD";

      const promoRes = SmritiSalesPromotionService.resolveBestItemPromo({
        sku: existing.stockNo,
        barcode: existing.barcode,
        rate: existing.rate,
        qty: updatedQty,
        customerGroup: headerState.customer?.customerGroupId || (headerState.customer?.name?.toUpperCase().includes("RELIANCE") ? "RELIANCE" : undefined),
        customerCode: headerState.customer?.id,
        evalDate: new Date()
      });

      if (promoRes.promo) {
        updatedDiscPct = promoRes.discountPct;
        updatedDiscCode = promoRes.promoCode;
      }

      const recomputed = calculateLineTotal({
        ...existing,
        qty: updatedQty,
        value: existing.rate * updatedQty,
        discPercent: updatedDiscPct,
        discCode: updatedDiscCode,
        taxPercent: existing.gstPercentage || 18,
      });

      setItems(prev => prev.map((it, idx) => {
        if (idx === existingIndex) {
          return {
            ...it,
            qty: updatedQty,
            value: recomputed.value,
            discPercent: updatedDiscPct,
            discCode: updatedDiscCode,
            discAmt: Number(recomputed.discAmt ?? 0),
            total: recomputed.total,
            taxAmount: Number(recomputed.taxAmount ?? 0),
          };
        }
        return it;
      }));
      onNotification?.("Item Quantity Updated", `Incremented quantity of '${computedLine.itemDescription}' to ${updatedQty} units (${updatedDiscCode}: ${updatedDiscPct}% off).`, "success");
    } else {
      const newLine: BillingLineItem = {
        id: computedLine.id,
        sNo: items.length + 1,
        stockNo: matched.sku || matched.barcode || rawCode,
        barcode: matched.barcode || rawCode,
        itemDescription: computedLine.itemDescription,
        rate: computedLine.rate,
        qty: computedLine.qty,
        value: computedLine.value,
        discCode: entry.discCode,
        discQty: parseFloat(entry.discQty) || 0,
        discPercent: Number(computedLine.discPercent ?? 0),
        discAmt: Number(computedLine.discAmt ?? 0),
        total: computedLine.total,
        salesStaff: entry.staff,
        productId: matched.product_id,
        hsnCode: matched.hsn_code,
        gstPercentage: Number(computedLine.taxPercent ?? matched.tax_rate ?? 18),
        taxAmount: Number(computedLine.taxAmount ?? 0),
        isTaxInclusive: matched.isTaxInclusive ?? matched.is_tax_inclusive,
        mrp: Number(matched.mrp),
        brand: matched.brand,
        size: matched.size
      };

      if (options.onResolvedLine) {
        options.onResolvedLine(newLine);
      } else {
        setItems(prev => [...prev, { ...newLine, sNo: prev.length + 1 }]);
      }
      if (!options.suppressSuccessNotice) {
        onNotification?.("Item Added", `${newLine.itemDescription} added to invoice.`, "success");
      }
    }

    // Reset direct entry row
    if (!options.preserveEntry) {
      setDirectEntry({
        barcode: "",
        stockNo: "",
        itemDescription: "",
        rate: "",
        qty: "1",
        discCode: "",
        discQty: "",
        discPercent: "",
        staff: entry.staff
      });
      setSelectedItemProductMeta(null);
      setShowProductDropdown(false);

      if (activeItemSearchField === "barcode") {
        directBarcodeRef.current?.focus();
      } else {
        directStockNoRef.current?.focus();
      }
    }
    return true;
  };

  const addImportedEntries = async (entries: { code: string; qty: number }[]) => {
    const resolvedLines: BillingLineItem[] = [];
    const failedCodes: string[] = [];
    for (const importedEntry of entries) {
      const code = importedEntry.code.trim();
      if (!code || !Number.isFinite(importedEntry.qty) || importedEntry.qty <= 0) {
        onNotification?.("Import Row Skipped", "A row was missing a valid item code or positive quantity.", "error");
        failedCodes.push(code || "missing item code");
        continue;
      }

      const added = await handleCommitDirectEntry({
        ...directEntry,
        barcode: code,
        stockNo: "",
        itemDescription: "",
        rate: "",
        qty: String(importedEntry.qty),
        discCode: "",
        discQty: "",
        discPercent: ""
      }, {
        preserveEntry: true,
        forceAppend: true,
        suppressSuccessNotice: true,
        onResolvedLine: line => resolvedLines.push(line)
      });
      if (!added) {
        failedCodes.push(code);
      }
    }

    if (resolvedLines.length > 0) {
      setItems(prev => [
        ...prev,
        ...resolvedLines.map((line, index) => ({ ...line, sNo: prev.length + index + 1 }))
      ]);
      onNotification?.(
        "Import Processing Complete",
        `${resolvedLines.length} imported row(s) were added through canonical item resolution. Review the backend billing preview before settlement.`,
        "info"
      );
    }
    if (failedCodes.length > 0) {
      const failedSummary = failedCodes.slice(0, 5).join(", ");
      const remainingCount = failedCodes.length - 5;
      onNotification?.(
        "Import Validation",
        `${failedCodes.length} row(s) could not be added: ${failedSummary}${remainingCount > 0 ? `, and ${remainingCount} more` : ""}.`,
        "error"
      );
    }
  };

  const handleBarcodeCSVImport = (importedItems: ResolvedCartItem[]) => {
    void addImportedEntries(importedItems.map(item => ({
      code: item.barcode || item.resolved_sku || item.resolved_item,
      qty: item.quantity
    })));
  };

  const handleBulkItemsImport = (importedItems: { product: Product; qty: number }[]) => {
    void addImportedEntries(importedItems.map(({ product, qty }) => ({
      code: String(product.barcode || product.sku || product.code || product.id || ""),
      qty
    })));
  };

  // Remove Item
  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(it => it.id !== id).map((it, idx) => ({ ...it, sNo: idx + 1 })));
    if (editingLineId === id) {
      setEditingLineId(null);
    }
  };

  // Enterprise Retail: Double-click row to edit in Direct Entry Grid (Shoper 9 contract)
  const handleRowDoubleClick = (item: BillingLineItem, idx: number) => {
    if (isReadOnlyView) return;
    setSelectedRowIndex(idx);
    setEditingLineId(item.id);
    setDirectEntry({
      barcode: item.barcode || "",
      stockNo: item.stockNo || "",
      itemDescription: item.itemDescription || "",
      rate: String(item.rate),
      qty: String(item.qty),
      discCode: item.discCode || "",
      discQty: String(item.discQty || ""),
      discPercent: item.discPercent ? String(item.discPercent) : "",
      staff: item.salesStaff || directEntry.staff
    });
    onNotification?.("Editing Line Item", `Item #${item.sNo} (${item.stockNo}) loaded into Direct Entry. Modify and press Enter to save.`, "info");
    directStockNoRef.current?.focus();
  };

  const handleReturnInvoice = () => {
    fetchSuspendedInvoices();
    setShowRecallModal(true);
  };

  // Suspend / Hold Invoice
  const handleSuspendInvoice = async () => {
    if (items.length === 0) {
      onNotification?.("Suspend Bill", "No items to suspend.", "error");
      return;
    }

    const suspendedNo = `HOLD-${headerState.docPrefix}-${headerState.docNo}-${Date.now().toString().slice(-4)}`;
    const invoicePayload = {
      invoice_no: suspendedNo,
      date: new Date().toISOString().split("T")[0],
      customer_id: headerState.customer?.id || null,
      customer_name: headerState.customer?.name || "Counter Cash Sale",
      customer_gstin: headerState.billedGstin || headerState.customer?.gstNumber || null,
      billed_party_gstin_id: headerState.billedPartyGstinId || null,
      delivery_location_id: headerState.deliveryLocationId || null,
      delivery_store_code: headerState.deliveryStoreCode || null,
      delivery_gstin: headerState.deliveryGstin || null,
      delivery_location_snapshot: headerState.deliveryLocationSnapshot || null,
      place_of_supply_code: headerState.placeOfSupplyCode || null,
      po_reference: headerState.poReference || null,
      sales_channel: headerState.salesChannel || "B2B_WHOLESALE",
      psv_party_id: headerState.psvPartyId || null,
      status: "Suspended",
      payment_mode: "CREDIT",
      items: items.map((it, idx) => ({
        product_id: it.productId || it.stockNo,
        code: it.stockNo,
        name: it.itemDescription,
        quantity: it.qty,
        price: it.rate,
        disc_pct: it.discPercent,
        gst_rate: it.gstPercentage,
        line_no: idx + 1
      })),
      taxable_value: summaryTotals.salesValue,
      tax_total: summaryTotals.totalTax,
      grand_total: summaryTotals.netAmount,
      remarks: headerState.remarks || "Suspended from Invoicing Terminal",
      rule_snapshots: {
        headerState,
        transporterRows,
        addonRows
      }
    };

    try {
      const saved = await apiFetchV1("/sales/invoices", {
        method: "POST",
        body: JSON.stringify(invoicePayload)
      });
      const suspended = {
        id: saved.id || suspendedNo,
        header: { ...headerState },
        items: [...items],
        transporterRows: [...transporterRows],
        addonRows: [...addonRows],
        rule_snapshots: invoicePayload.rule_snapshots,
        date: new Date().toLocaleTimeString(),
        netAmount: summaryTotals.netAmount
      };
      setSuspendedBills(prev => [suspended, ...prev]);
      setItems([]);
      setTransporterRows(DEFAULT_TRANSPORTER_ROWS.map(r => ({ ...r })));
      setAddonRows(DEFAULT_ADDON_ROWS.map(r => ({ ...r })));
      setHeaderState(prev => ({
        ...prev,
        docNo: String((parseInt(prev.docNo) || 1) + 1),
        customer: null
      }));
      setCustomerSearchInput("");
      onNotification?.("Invoice Suspended", `Bill ${suspended.header.docPrefix}-${suspended.header.docNo} held in system database.`, "success");
    } catch {
      // Local fallback
      const suspended = {
        id: suspendedNo,
        header: { ...headerState },
        items: [...items],
        transporterRows: [...transporterRows],
        addonRows: [...addonRows],
        rule_snapshots: invoicePayload.rule_snapshots,
        date: new Date().toLocaleTimeString(),
        netAmount: summaryTotals.netAmount
      };
      setSuspendedBills(prev => [suspended, ...prev]);
      setItems([]);
      setTransporterRows(DEFAULT_TRANSPORTER_ROWS.map(r => ({ ...r })));
      setAddonRows(DEFAULT_ADDON_ROWS.map(r => ({ ...r })));
      setHeaderState(prev => ({
        ...prev,
        docNo: String((parseInt(prev.docNo) || 1) + 1),
        customer: null
      }));
      setCustomerSearchInput("");
      onNotification?.("Invoice Suspended (Local)", `Bill ${suspended.header.docPrefix}-${suspended.header.docNo} held locally.`, "success");
    }
  };

  // Recall Suspended Invoice
  const handleRecallInvoice = (suspended: any) => {
    setHeaderState(suspended.header);
    setItems(suspended.items);
    const restoredTransporters = suspended.transporterRows?.length > 0
      ? suspended.transporterRows
      : (suspended.rule_snapshots?.transporterRows?.length > 0 ? suspended.rule_snapshots.transporterRows : null);
    if (restoredTransporters) {
      setTransporterRows(restoredTransporters);
    } else {
      setTransporterRows(DEFAULT_TRANSPORTER_ROWS.map(r => ({ ...r })));
    }

    const restoredAddons = suspended.addonRows?.length > 0
      ? suspended.addonRows
      : (suspended.rule_snapshots?.addonRows?.length > 0 ? suspended.rule_snapshots.addonRows : null);
    if (restoredAddons) {
      setAddonRows(restoredAddons);
    } else {
      setAddonRows(DEFAULT_ADDON_ROWS.map(r => ({ ...r })));
    }

    if (suspended.header.customer) {
      setCustomerSearchInput(suspended.header.customer.name);
    }
    setSuspendedBills(prev => prev.filter(b => b.id !== suspended.id));
    setShowRecallModal(false);
    setIsReadOnlyView(false);
    setLoadedDocMetadata(null);
    onNotification?.("Invoice Recalled", `Restored bill ${suspended.header.docPrefix}-${suspended.header.docNo}`, "success");
  };

  // Select and load document from Invoicing Transaction Browser (Read-Only Mode)
  const handleSelectDocumentFromBrowser = async (docType: InvoicingBrowserTab, doc: any) => {
    try {
      if (docType === "SUSPENDED") {
        handleRecallInvoice(doc);
        return;
      }

      let fullDoc = doc;
      if (doc.id && (docType === "INVOICES" || docType === "CANCELLED")) {
        try {
          const cleanId = String(doc.id).replace(/^:/, "").trim();
          const fetched = await apiFetchV1<any>(`/sales/invoices/${encodeURIComponent(cleanId)}`);
          if (fetched) fullDoc = fetched;
        } catch {
          fullDoc = doc;
        }
      } else if (doc.id && docType === "ORDERS") {
        try {
          const cleanId = String(doc.id || doc.order_no || doc.po_number || "").replace(/^:/, "").trim();
          if (cleanId) {
            if (doc.po_number && !doc.order_no) {
              const fetched = await apiFetchV1<any>(`/sales/customer-pos/${encodeURIComponent(cleanId)}`);
              if (fetched) fullDoc = fetched;
            } else {
              const fetched = await apiFetchV1<any>(`/sales/orders/${encodeURIComponent(cleanId)}`);
              if (fetched) fullDoc = fetched;
            }
          }
        } catch {
          fullDoc = doc;
        }
      }

      const docNo = fullDoc.invoice_no || fullDoc.order_no || fullDoc.return_no || fullDoc.po_number || "DOC";
      const dateStr = fullDoc.date || fullDoc.billDate || fullDoc.po_date || new Date().toLocaleDateString("en-GB");

      setHeaderState(prev => ({
        ...prev,
        docNo: docNo,
        docPrefix: "",
        billDate: dateStr,
        customer: {
          id: fullDoc.customer_id || "CUST-WALK",
          name: fullDoc.customer_name || "Counter Walk-in",
          gstNumber: fullDoc.customer_gstin || "",
          email: "",
          phone: "",
          address: fullDoc.billing_address || "",
        } as any,
        billedGstin: fullDoc.customer_gstin || null,
        billedPartyGstinId: fullDoc.billed_party_gstin_id || null,
        deliveryLocationId: fullDoc.delivery_location_id || null,
        deliveryStoreCode: fullDoc.delivery_store_code || null,
        deliveryGstin: fullDoc.delivery_gstin || null,
        deliveryLocationSnapshot: fullDoc.delivery_location_snapshot || null,
        placeOfSupplyCode: fullDoc.place_of_supply_code || null,
        poReference: fullDoc.po_reference || fullDoc.po_number || null,
        remarks: fullDoc.remarks || `Audit View: ${fullDoc.status || "Finalized"}`,
      }));

      const rawItems = fullDoc.items || fullDoc.lines || [];
      const mappedItems: BillingLineItem[] = rawItems.map((it: any, idx: number) => {
        const rate = Number(it.price || it.rate || it.unit_price || 0);
        const qty = Number(it.quantity || it.qty || it.quantity_ordered || 1);
        const taxable = Number(it.taxable_value || (rate * qty));
        const discAmt = Number(it.disc_amt || 0);
        const total = Number(it.total_amount || it.total || it.ordered_value || (taxable + Number(it.tax_amount || 0)));
        return {
          id: it.id ? String(it.id) : `audit-item-${idx}`,
          sNo: idx + 1,
          stockNo: it.code || it.stock_no || "SKU",
          barcode: it.barcode || it.ean || it.code || "",
          itemDescription: it.name || it.description || "Line Item",
          rate,
          qty,
          value: taxable,
          discCode: "",
          discQty: 0,
          discPercent: Number(it.disc_pct || it.discPercent || 0),
          discAmt,
          total,
          salesStaff: headerState.salesStaff,
          productId: it.product_id,
          hsnCode: it.hsn_code,
          gstPercentage: Number(it.gst_rate || 0),
          taxAmount: Number(it.tax_amount || 0),
          mrp: it.mrp ? Number(it.mrp) : undefined,
        };
      });

      setItems(mappedItems);
      setIsReadOnlyView(true);
      setLoadedDocMetadata({
        id: fullDoc.id,
        docNo: docNo,
        docType: docType,
        status: fullDoc.status || "Completed",
        date: dateStr,
        customerName: fullDoc.customer_name || "Counter Walk-in",
        grandTotal: Number(fullDoc.grand_total || fullDoc.total_amount || 0),
      });

      onNotification?.(
        "Audit Mode Active",
        `Loaded ${docNo} in Read-Only Mode. All modifications locked.`,
        "success"
      );
    } catch (err: any) {
      console.error("[BillingTerm] Failed to inspect document:", err);
      onNotification?.("Error", "Failed to load document into terminal.", "error");
    }
  };

  const handleExitReadOnlyMode = () => {
    setIsReadOnlyView(false);
    setLoadedDocMetadata(null);
    handleNewInvoice();
    onNotification?.("Active Billing", "Returned to new bill creation mode.", "success");
  };

  // Handle Settlement Completion
  const handleCompleteSettlement = async (
    payments: SettlementPaymentRow[],
    totalTendered: number,
    changeDue: number,
    denominations?: any
  ) => {
    const isCreditTx = headerState.transaction === "Credit" || payments.some(p => (p.mode || "").toUpperCase() === "CREDIT");
    const roundCurrency = (amount: number) => Math.round(amount * 100) / 100;
    const creditOverrideRequired = Boolean(
      isCreditTx
      && transactionCustomerPolicy
      && !transactionCustomerPolicy.unlimited_credit
      && transactionCustomerPolicy.available_credit !== null
      && transactionCustomerPolicy.available_credit !== undefined
      && summaryTotals.netAmount > transactionCustomerPolicy.available_credit
    );

    if (billingPolicyLoading || !billingTransactionPolicy || billingPolicyError) {
      onNotification?.("Billing Policy Unavailable", billingPolicyError || "The current billing policy has not finished loading. Your cart is preserved.", "error");
      return;
    }
    if (transactionCustomerPolicy?.channel_conflict) {
      onNotification?.("Channel Policy Conflict", "The customer's configured sales channel is not allowed by company or branch policy. Ask an administrator to resolve the configuration.", "error");
      return;
    }
    if (!permittedTransactions.includes(isCreditTx ? "CREDIT" : "CASH")) {
      onNotification?.("Transaction Type Not Allowed", "The selected cash or credit mode is not permitted for this customer and branch.", "error");
      return;
    }
    if (transactionCustomerPolicy?.require_po_number && !headerState.poReference?.trim() && !headerState.customerPoId) {
      onNotification?.("PO Reference Required", "Enter the customer purchase-order reference in Details before settlement.", "error");
      return;
    }
    if (creditOverrideRequired && (
      !transactionCustomerPolicy?.can_override_credit
      || !transactionCustomerPolicy.allow_credit_override
      || !creditOverrideReason.trim()
    )) {
      onNotification?.(
        "Credit Override Required",
        transactionCustomerPolicy?.can_override_credit && transactionCustomerPolicy.allow_credit_override
          ? "Enter an authorized business justification in Details before settlement."
          : "The invoice exceeds the customer's available credit and no authorized override is available.",
        "error",
      );
      return;
    }

    // Governed System Parameter Checks
    if (isCreditTx && !smritiSystemParameterService.getBoolean("AllowCreditBilling", true)) {
      onNotification?.("Credit Billing Disabled", "Credit billing is prohibited by System Parameter [AllowCreditBilling].", "error");
      return;
    }

    if (!headerState.customer && smritiSystemParameterService.getBoolean("InBillingCustSelectionCompulsary", false)) {
      onNotification?.("Customer Required", "Customer selection is mandatory for billing per System Parameter [InBillingCustSelectionCompulsary].", "error");
      return;
    }

    if (isStoreLocationRequired && (!headerState.deliveryLocationId || !headerState.deliveryStoreCode)) {
      onNotification?.(
        "Store Location Required",
        "Delivery Location / Store Code is mandatory for Modern Trade sales channel. Please select a valid store location before completing the invoice.",
        "error"
      );
      return;
    }

    const tenderRows = isCreditTx
      ? []
      : payments
        .filter(payment => Number(payment.amount) > 0)
        .map(payment => ({
          mode: toCanonicalPaymentMode(payment.mode),
          refNo: payment.refNo?.trim() || "",
          amount: roundCurrency(Number(payment.amount)),
        }));
    let remainingChange = roundCurrency(Math.max(0, changeDue));
    if (remainingChange > 0) {
      for (let index = tenderRows.length - 1; index >= 0 && remainingChange > 0; index -= 1) {
        if (tenderRows[index].mode !== "CASH") continue;
        const cashChange = Math.min(tenderRows[index].amount, remainingChange);
        tenderRows[index].amount = roundCurrency(tenderRows[index].amount - cashChange);
        remainingChange = roundCurrency(remainingChange - cashChange);
      }
      if (remainingChange > 0) {
        onNotification?.("Settlement Error", "Change due cannot exceed the cash tender received.", "error");
        return;
      }
    }
    const effectiveTenderRows = tenderRows.filter(payment => payment.amount > 0);
    const tenderModes = new Set(effectiveTenderRows.map(payment => payment.mode));
    const resolvedPaymentMode = isCreditTx
      ? "CREDIT"
      : tenderModes.size > 1
        ? "SPLIT"
        : effectiveTenderRows[0]?.mode || "CASH";
    // Format invoice number from resolved prefix and sequence; omit if empty so backend allocates sequence atomically
    const invNo = (headerState.docPrefix && headerState.docNo)
      ? `${headerState.docPrefix}${headerState.docNo}`
      : undefined;
    const invoicePayload = {
      invoice_no: invNo,
      date: new Date().toISOString().split("T")[0],
      customer_id: headerState.customer?.id || null,
      customer_name: headerState.customer?.name || "Counter Cash Sale",
      customer_gstin: headerState.billedGstin || headerState.customer?.gstNumber || null,
      billed_party_gstin_id: headerState.billedPartyGstinId || null,
      billing_location_id: headerState.billingLocationId || null,
      billing_store_code: headerState.billingStoreCode || null,
      billing_address: headerState.billingAddress || null,
      delivery_location_id: headerState.deliveryLocationId || null,
      delivery_store_code: headerState.deliveryStoreCode || null,
      delivery_gstin: headerState.deliveryGstin || null,
      delivery_location_snapshot: headerState.deliveryLocationSnapshot || null,
      shipping_address: headerState.shippingAddress || null,
      place_of_supply_code: headerState.placeOfSupplyCode || null,
      po_reference: headerState.poReference || null,
      customer_po_id: headerState.customerPoId || null,
      source_document_type: headerState.billingSource || "DIRECT",
      source_document_id: headerState.customerPoId || null,
      sales_channel: headerState.salesChannel || "B2B_WHOLESALE",
      psv_party_id: headerState.psvPartyId || null,
      status: "Completed",
      payment_mode: resolvedPaymentMode,
      credit_override_reason: isCreditTx && creditOverrideRequired ? creditOverrideReason.trim() : undefined,
      paid_amount: isCreditTx ? 0 : roundCurrency(Math.max(0, totalTendered - changeDue)),
      balance_amount: isCreditTx ? summaryTotals.netAmount : Math.max(0, summaryTotals.netAmount - roundCurrency(Math.max(0, totalTendered - changeDue))),
      discount_amount: summaryTotals.itemDiscount + summaryTotals.billDiscount,
      net_amount: summaryTotals.netAmount,
      taxable_value: summaryTotals.salesValue,
      tax_total: summaryTotals.totalTax,
      grand_total: summaryTotals.netAmount,
      salesperson_name: headerState.salesStaff,
      remarks: headerState.remarks || (isCreditTx ? "B2B Corporate Credit Invoice" : "B2B Distributor Invoice"),
      adjustments: previewRequest.adjustments || [],
      items: items.map((it, idx) => ({
        product_id: it.productId || it.stockNo,
        code: it.stockNo,
        name: it.itemDescription,
        quantity: it.qty,
        price: it.rate,
        disc_pct: 0,
        disc_amt: postingLines[idx]?.discountAmount ?? 0,
        gst_rate: it.gstPercentage,
        hsn_code: it.hsnCode,
        mrp: it.mrp,
        is_tax_inclusive: it.isTaxInclusive,
        line_no: idx + 1,
        salesperson_name: it.salesStaff || null,
        customer_po_line_id: it.customerPoLineId || null,
        source_line_type: it.customerPoLineId ? "CUSTOMER_PO" : null,
        source_line_id: it.customerPoLineId || null
      })),
      rule_snapshots: {
        transaction_type: isCreditTx ? "Credit" : "Cash",
        billing_policy: {
          bill_type: headerState.billType,
          transaction_type: isCreditTx ? "CREDIT" : "CASH",
          sales_channel: headerState.salesChannel,
          source_document_type: headerState.billingSource || "DIRECT",
          credit_override_reason: isCreditTx && creditOverrideRequired ? creditOverrideReason.trim() : undefined,
        },
        credit_terms: isCreditTx ? {
          credit_days: (headerState.customer as any)?.creditDays ?? (headerState.customer as any)?.credit_days ?? null,
          credit_limit: (headerState.customer as any)?.creditLimit ?? (headerState.customer as any)?.credit_limit ?? null,
          previous_outstanding: (headerState.customer as any)?.outstanding || 0,
          projected_outstanding: ((headerState.customer as any)?.outstanding || 0) + summaryTotals.netAmount
        } : undefined,
        payments: isCreditTx
          ? [{ mode: "On Account", amount: summaryTotals.netAmount }]
          : effectiveTenderRows,
        denominations: isCreditTx ? undefined : denominations,
        transporterRows,
        addonRows
      }
    };

    try {
      const saveUrl = headerState.billingSource === "CUSTOMER_PO" && headerState.customerPoId
        ? `/sales/customer-pos/${headerState.customerPoId}/bill`
        : "/sales/invoices";
      const saveBody = headerState.billingSource === "CUSTOMER_PO" && headerState.customerPoId
        ? { invoice: invoicePayload, lines: items.map(item => ({ customer_po_line_id: item.customerPoLineId, quantity: item.qty })) }
        : invoicePayload;
      const requestFingerprint = JSON.stringify(saveBody);
      if (settlementIdempotencyKeyRef.current?.fingerprint !== requestFingerprint) {
        settlementIdempotencyKeyRef.current = {
          key: crypto.randomUUID(),
          fingerprint: requestFingerprint,
        };
      }
      const saved = await apiFetchV1(saveUrl, {
        method: "POST",
        headers: { "Idempotency-Key": settlementIdempotencyKeyRef.current.key },
        body: JSON.stringify(saveBody)
      });

      const completedInvoice = {
        invoiceId: saved.id,
        invoiceNumber: saved.invoice_no || invNo || "INV-CONFIRMED",
        date: saved.date || headerState.billDate,
        customerName: headerState.customer?.name || "Counter Cash Sale",
        customerGstin: headerState.billedGstin || headerState.customer?.gstNumber || "",
        items: items.map(it => ({
          sku: it.stockNo,
          description: it.itemDescription,
          quantity: it.qty,
          rate: it.rate,
          discount: it.discAmt,
          tax: it.taxAmount || 0,
          amount: it.total
        })),
        subtotal: summaryTotals.salesValue,
        discount: summaryTotals.itemDiscount + summaryTotals.billDiscount,
        tax: summaryTotals.totalTax,
        total: summaryTotals.netAmount,
        totalTendered: isCreditTx ? 0 : totalTendered,
        changeDue: isCreditTx ? 0 : changeDue,
        paymentMode: isCreditTx ? "CREDIT" : payments.map(p => p.mode).join(", ")
      };

      setLastCompletedInvoice(completedInvoice);
      setShowSettlementModal(false);
      setShowPrintModal(false);
      void openCanonicalInvoicePrint(saved.id);

      // Reset for next invoice
      setItems([]);
        settlementIdempotencyKeyRef.current = null;
      setHeaderState(prev => ({
        ...prev,
        docNo: String((parseInt(prev.docNo) || 1) + 1),
        customer: null,
        remarks: "",
        billedPartyGstinId: null,
        billedGstin: null,
        billingLocationId: null,
        billingStoreCode: null,
        billingAddress: null,
        shippingAddress: null,
        deliveryLocationId: null,
        deliveryStoreCode: null,
        deliveryGstin: null,
        deliveryLocationSnapshot: null,
        placeOfSupplyCode: null,
        poReference: ""
      }));
      setCustomerGstRegistrations([]);
      setCustomerDeliveryLocations([]);
      setCustomerBillingLocations([]);
      setCustomerSearchInput("");
      onNotification?.("Settlement Complete", `Invoice ${completedInvoice.invoiceNumber} saved successfully.`, "success");
      onRefreshData?.();
    } catch (err: any) {
      const message = err?.message || "Failed to commit transaction.";
      console.error("[BillingTerm] Invoice settlement failed:", err);
      onNotification?.(
        "Settlement Error",
        `Bill could not be saved: ${message}. Your invoice items are preserved in the cart. Correct the indicated data and retry.`,
        "error"
      );
    }
  };

  // Enterprise Retail: F7 Exact Cash Instant Checkout
  const handleExactCashSettlement = async () => {
    if (items.length === 0) {
      onNotification?.("Settlement", "Add items to invoice before exact cash settlement [F7].", "error");
      return;
    }
    if (!hasGstProfile) {
      onNotification?.("GST profile pending", "Add a customer GSTIN before exact cash settlement [F7].", "error");
      return;
    }
    const exactPayment: SettlementPaymentRow[] = [
      {
        id: "pay-exact-cash-f7",
        mode: "Cash",
        refNo: "F7",
        amount: summaryTotals.netAmount,
        bankDetails: ""
      }
    ];
    await handleCompleteSettlement(exactPayment, summaryTotals.netAmount, 0);
  };

  handleExactCashSettlementRef.current = handleExactCashSettlement;

  // Add Quick Customer
  const handleCreateCustomer = async () => {
    const trimmedName = newCustName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      onNotification?.("Validation Error", "Customer name must be at least 2 characters long.", "error");
      return;
    }

    const trimmedMobile = newCustMobile.trim();
    if (trimmedMobile) {
      const mobileRegex = /^[6-9]\d{9}$/;
      const intlMobileRegex = /^\+[1-9]\d{7,14}$/;
      if (!mobileRegex.test(trimmedMobile) && !intlMobileRegex.test(trimmedMobile)) {
        onNotification?.("Validation Error", "Please enter a valid 10-digit mobile number.", "error");
        return;
      }
    }

    const trimmedGstin = newCustGstin.trim().toUpperCase();
    if (trimmedGstin) {
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(trimmedGstin)) {
        onNotification?.(
          "Validation Error",
          "Invalid GSTIN format. Statutory GSTIN must be 15 alphanumeric characters (e.g. 27AAAAA0000A1Z5).",
          "error"
        );
        return;
      }
      const validStates = new Set([
        "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
        "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
        "21", "22", "23", "24", "25", "26", "27", "28", "29", "30",
        "31", "32", "33", "34", "35", "36", "37", "38", "97"
      ]);
      const stateCode = trimmedGstin.substring(0, 2);
      if (!validStates.has(stateCode)) {
        onNotification?.(
          "Validation Error",
          `Invalid GSTIN state code '${stateCode}'. State code must be between 01 and 38 or 97.`,
          "error"
        );
        return;
      }
    }

    const newCust: Customer = {
      id: "CUST-" + Date.now().toString().slice(-4),
      customerGroupId: "CG-Retail",
      name: trimmedName,
      mobile: trimmedMobile || "0000000000",
      gstNumber: trimmedGstin || undefined,
      status: "Active",
      outstanding: 0,
      createdDate: new Date().toISOString().split("T")[0]
    };
    try {
      const res = await apiFetchV1("/crm/customers", {
        method: "POST",
        body: JSON.stringify({
          name: newCust.name,
          mobile: newCust.mobile,
          gst_number: newCust.gstNumber,
          customer_group_id: newCust.customerGroupId,
          status: newCust.status
        })
      });
      if (res && res.id) {
        newCust.id = res.id;
        newCust.code = res.code || res.id;
      }
      window.dispatchEvent(new CustomEvent("smriti_customer_updated"));
    } catch (e) {
      console.warn("[Quick Customer] Backend persistence fallback to local:", e);
    }
    setCustomers(prev => [newCust, ...prev]);
    handleSelectCustomer(newCust);
    setShowAddCustomerModal(false);
    setNewCustName("");
    setNewCustMobile("");
    setNewCustGstin("");
    onNotification?.("Customer Added", `Customer ${newCust.name} selected.`, "success");
  };

  const filteredCustomers = useMemo(() => {
    if (!customerSearchInput.trim()) return customers;
    const q = customerSearchInput.toLowerCase().trim();
    return customers.filter(c => 
      c.name?.toLowerCase().includes(q) ||
      (c.mobile && c.mobile.includes(q)) ||
      (c.id && c.id.toLowerCase().includes(q)) ||
      (c.code && c.code.toLowerCase().includes(q)) ||
      ((c as any).phone && (c as any).phone.includes(q))
    );
  }, [customers, customerSearchInput]);

  return (
    <div 
      ref={terminalContainerRef}
      data-billing-desk="true"
      data-context-type="billing"
      data-testid="billing-terminal"
      className={`flex flex-col bg-[#f8f9fa] dark:bg-[#12161f] text-slate-900 dark:text-slate-100 font-sans select-none overflow-hidden transition-all ${
        isFullscreen ? "fixed inset-0 z-50 h-screen w-screen" : "h-full"
      }`}
    >
      
      {/* ── ZONE A: Compact Premium Header ── */}
      <header className="bg-white dark:bg-[#131b2e] border-b border-slate-200 dark:border-slate-800 px-3 py-1.5 flex items-center justify-between shrink-0 z-30 shadow-2xs gap-2">
        {/* Left: Menu, Logo Badge, Title & Sales Channel Pill */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onOpenHotkeys ? onOpenHotkeys() : setShowMoreMenu(v => !v)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
            title="Billing Menu & Workspace Navigation (F1)"
          >
            <Menu size={16} />
          </button>

          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
            <Receipt size={18} />
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
              Billing Desk
            </span>

            <span className="bg-amber-100/90 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-bold text-[10px] rounded-full px-2 py-0.5">
              {SALES_CHANNELS.find(ch => ch.value === headerState.salesChannel)?.label || "Billing"}
            </span>
          </div>
        </div>

        {/* Center: Live Date/Time, Doc Number Pill & Status Pill */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 font-mono text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>{liveDate}</span>
            <span>·</span>
            <span>{liveTime}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg text-xs font-mono font-bold text-slate-800 dark:text-slate-200 shadow-2xs">
            <span>{headerState.docPrefix ? `${headerState.docPrefix}${headerState.docNo || "0001"}` : headerState.docNo || "INV/C/0001"}</span>
            <button
              type="button"
              onClick={() => setShowDefinePrefixModal(true)}
              title="Define Bill Prefix / Numbering (Setup > General > Bill Prefix)"
              className="text-slate-400 hover:text-blue-600 transition cursor-pointer"
            >
              <Edit2 size={12} />
            </button>
          </div>

          <span
            className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider"
            data-testid="invoice-workspace-mode"
          >
            {isReadOnlyView ? "AUDIT" : items.length === 0 ? "NEW" : headerState.transaction === "Credit" ? "B2B CREDIT" : "DRAFT"}
          </span>
        </div>

        {/* Right: Primary Actions, Overflow Menu, Shift HUD & Avatar */}
        <div className="flex items-center gap-2 shrink-0">
          {/* New Bill */}
          <button
            type="button"
            onClick={handleNewInvoice}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer shadow-2xs"
            title="New Invoice (Ctrl+N)"
          >
            <FilePlus size={14} className="text-blue-600" />
            <span className="hidden md:inline">New</span>
          </button>

          {/* More Actions Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMoreMenu(v => !v)}
              aria-expanded={showMoreMenu}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer shadow-2xs"
              title="More Options & Supporting Workspaces"
            >
              <MoreHorizontal size={14} />
              <span className="hidden md:inline">More</span>
              <ChevronDown size={12} />
            </button>

            {showMoreMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                <div className="absolute right-0 top-full mt-1.5 z-50 bg-white dark:bg-[#191c1e] border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-1.5 min-w-[220px] max-h-[70vh] overflow-y-auto flex flex-col gap-0.5 text-xs animate-in fade-in slide-in-from-top-1 font-medium">
                  {onOpenSalesDocuments && (
                    <button
                      type="button"
                      onClick={() => { onOpenSalesDocuments(); setShowMoreMenu(false); }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-left w-full cursor-pointer"
                    >
                      <FileText size={14} className="text-teal-600" />
                      <span>Sales Documents Studio</span>
                    </button>
                  )}
                  {onOpenPackingSlips && (
                    <button
                      type="button"
                      onClick={() => { onOpenPackingSlips(); setShowMoreMenu(false); }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-left w-full cursor-pointer"
                    >
                      <Package size={14} className="text-indigo-600" />
                      <span>Packing Slips (Direct)</span>
                    </button>
                  )}
                  {onOpenConsolidatedBilling && (
                    <button
                      type="button"
                      onClick={() => { onOpenConsolidatedBilling(); setShowMoreMenu(false); }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-left w-full cursor-pointer"
                    >
                      <FileText size={14} className="text-blue-600" />
                      <span>Consolidated Billing</span>
                    </button>
                  )}
                  {onOpenBillingConfiguration && (
                    <button
                      type="button"
                      onClick={() => { onOpenBillingConfiguration(); setShowMoreMenu(false); }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-left w-full cursor-pointer"
                    >
                      <Settings size={14} className="text-slate-600 dark:text-slate-300" />
                      <span>Billing Policy Settings</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setShowBulkAddItemsModal(true); setShowMoreMenu(false); }}
                    disabled={isReadOnlyView}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-left w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus size={14} className="text-emerald-600" />
                    <span>Paste Barcodes / Bulk Add</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowBarcodeCSVImportModal(true); setShowMoreMenu(false); }}
                    disabled={isReadOnlyView}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-left w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FileText size={14} className="text-blue-600" />
                    <span>Validated CSV Import</span>
                  </button>
                  <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
                  <button
                    type="button"
                    onClick={() => { handleSuspendInvoice(); setShowMoreMenu(false); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-left w-full cursor-pointer"
                  >
                    <Save size={14} className="text-blue-600" />
                    <span>Hold / Park Invoice (F12)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleReprintInvoice(); setShowMoreMenu(false); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-left w-full cursor-pointer"
                  >
                    <Printer size={14} className="text-blue-600" />
                    <span>Print / Preview (Ctrl+P)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleExactCashSettlementRef.current?.(); setShowMoreMenu(false); }}
                    disabled={isReadOnlyView || items.length === 0}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-left w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Banknote size={14} className="text-emerald-600" />
                    <span>Exact Cash Settlement (F7)</span>
                  </button>
                  <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
                  {([
                    ["transporter", "Transporter Details", Truck],
                    ["payment", "Payment Details", CreditCard],
                    ["addons", "Add-ons & Deductions", Plus],
                    ["remarks", "Document Remarks", FileText],
                  ] as const).map(([drawer, label, Icon]) => (
                    <button
                      key={drawer}
                      type="button"
                      onClick={() => { setActiveFooterDrawer(drawer); setShowMoreMenu(false); }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-left w-full cursor-pointer"
                    >
                      <Icon size={14} />
                      <span>{label}</span>
                    </button>
                  ))}
                  <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
                  <button
                    type="button"
                    onClick={() => { setShowTransactionBrowserModal(true); setShowMoreMenu(false); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-left w-full cursor-pointer"
                  >
                    <History size={14} className="text-amber-600" />
                    <span>Commercial Audit Browser (F4)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowRecallModal(true); setShowMoreMenu(false); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-left w-full cursor-pointer"
                  >
                    <RotateCcw size={14} className="text-purple-600" />
                    <span>Recall Held Bills {suspendedBills.length > 0 ? `(${suspendedBills.length})` : ""}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleVoidInvoice(); setShowMoreMenu(false); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 text-left w-full cursor-pointer"
                  >
                    <Trash2 size={14} />
                    <span>Void Bill (Ctrl+V)</span>
                  </button>
                  <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
                  {onOpenShiftReports && (
                    <button
                      type="button"
                      onClick={() => { onOpenShiftReports(); setShowMoreMenu(false); }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-left w-full cursor-pointer"
                    >
                      <FileText size={14} className="text-cyan-600" />
                      <span>Shift Reports</span>
                    </button>
                  )}
                  {onOpenEodReport && (
                    <button
                      type="button"
                      onClick={() => { onOpenEodReport(); setShowMoreMenu(false); }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-left w-full cursor-pointer"
                    >
                      <FileText size={14} className="text-emerald-600" />
                      <span>EOD Z-Report Closeout</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setShowAttachmentPanel(!showAttachmentPanel); setShowMoreMenu(false); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-left w-full cursor-pointer"
                  >
                    <Paperclip size={14} className="text-slate-600" />
                    <span>Attachments Panel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleToggleFullscreen(); setShowMoreMenu(false); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-left w-full cursor-pointer"
                  >
                    {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    <span>{isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (onOpenHotkeys) onOpenHotkeys(); else setShowSmritiItemSearchModal(true); setShowMoreMenu(false); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-left w-full cursor-pointer"
                  >
                    <HelpCircle size={14} className="text-blue-600" />
                    <span>Shortcuts &amp; Help</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Active Shift Badge */}
          <div
            onClick={() => onOpenShiftManager?.()}
            className="hidden lg:flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-full text-xs font-semibold text-emerald-800 dark:text-emerald-300 cursor-pointer hover:bg-emerald-100 transition shadow-2xs"
            title="Register &amp; Shift Status (Click to inspect)"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>REG-01 · Shift Active</span>
          </div>

          {/* User Avatar */}
          <div
            className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-200 font-bold text-xs flex items-center justify-center border border-blue-200 dark:border-blue-700 font-mono shadow-2xs"
            title={currentUser?.name || "Cashier Admin"}
          >
            {currentUser?.name ? currentUser.name.substring(0, 2).toUpperCase() : "AD"}
          </div>
        </div>
      </header>

      {/* Audit Read-Only Mode Banner */}
      {isReadOnlyView && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-margin-page py-2.5 flex items-center justify-between animate-in fade-in shrink-0">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-600 text-white font-mono uppercase tracking-wider">
              Audit Read-Only Mode
            </span>
            <div className="text-xs text-amber-950 dark:text-amber-200">
              Viewing finalized document <strong className="font-mono font-bold">{loadedDocMetadata?.docNo}</strong> • Status: <span className="font-bold uppercase">{loadedDocMetadata?.status}</span> • All modifications locked
            </div>
          </div>
          <div className="flex items-center gap-2">
            {loadedDocMetadata?.id && (
              <button
                type="button"
                onClick={() => void openCanonicalInvoicePrint(loadedDocMetadata.id)}
                className="px-3 py-1 bg-primary text-on-primary hover:bg-primary-container rounded text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Printer size={13} />
                <span>Print A4 PDF</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleExitReadOnlyMode}
              className="px-3 py-1 bg-surface-container-highest hover:bg-surface-container border border-outline-variant text-on-surface rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>Exit Audit Mode (Ctrl+N)</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Invoicing Canvas */}
      <main className="flex-1 flex flex-col p-2.5 gap-2.5 overflow-hidden max-w-[1920px] mx-auto w-full min-h-0">
        
        {/* ZONE B: TRANSACTION & CUSTOMER CARD (3-Column Clean Desk Layout) */}
        <section className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-xl p-2 shadow-xs shrink-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-start">
            
            {/* Column 1: Customer Identification (4 cols) */}
            <div className={`flex flex-col gap-1.5 ${showMoreDetails ? "lg:col-span-4" : "lg:col-span-9 lg:flex-row lg:items-center"}`}>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shrink-0">
                <Users size={14} className="text-blue-600 dark:text-blue-400" />
                <span>Customer</span>
                <span className="text-rose-500 font-bold" title="Customer selection is required">*</span>
              </label>

              {/* Customer Search Bar with Quick Add Button */}
              <div className="relative flex items-center gap-1.5 lg:flex-1 lg:min-w-[220px]">
                <div className="relative flex-1">
                  <input
                    ref={customerInputRef}
                    type="text"
                    name="customerSearch"
                    aria-label="Search customer (F2)"
                    data-f2-entity="customer"
                    data-context-type="customer"
                    data-lookup="customer"
                    value={customerSearchInput}
                    onChange={e => handleCustomerSearchChange(e.target.value)}
                    onFocus={() => setShowCustomerDropdown(true)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (customerSuggestions.length > 0) {
                          const selected = customerSuggestions[customerSelectedIndex] || customerSuggestions[0];
                          if (selected?.metadata) applyCustomerAutoPopulate(selected.metadata as any);
                        } else if (filteredCustomers.length > 0) {
                          handleSelectCustomer(filteredCustomers[0]);
                        }
                      } else if (e.key === "ArrowDown") {
                        if (customerSuggestions.length > 0) {
                          e.preventDefault();
                          setCustomerSelectedIndex(prev => (prev + 1) % customerSuggestions.length);
                        }
                      } else if (e.key === "ArrowUp") {
                        if (customerSuggestions.length > 0) {
                          e.preventDefault();
                          setCustomerSelectedIndex(prev => (prev - 1 + customerSuggestions.length) % customerSuggestions.length);
                        }
                      } else if (e.key === "Escape") {
                        setShowCustomerDropdown(false);
                      }
                    }}
                    placeholder="Search customer (F2)..."
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg h-8 pl-8 pr-7 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 transition shadow-2xs"
                  />
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  
                  {/* Real-Time Backend Customer Typeahead Dropdown */}
                  <TypeaheadDrop
                    isOpen={showCustomerDropdown && (customerSuggestions.length > 0 || isCustomerSearching)}
                    options={customerSuggestions}
                    selectedIndex={customerSelectedIndex}
                    isLoading={isCustomerSearching}
                    onSelect={(opt) => {
                      if (opt.metadata) {
                        applyCustomerAutoPopulate(opt.metadata as any);
                      }
                    }}
                    onClose={() => setShowCustomerDropdown(false)}
                    emptyMessage="No matching customers found in database"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(true)}
                  className="h-8 w-8 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 cursor-pointer shadow-2xs transition"
                  title="Quick Add Customer"
                >
                  <UserPlus size={14} />
                </button>
              </div>

              {/* Active Customer Display Card */}
              {headerState.customer ? (
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs lg:flex-1 lg:min-w-[220px]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                      <User size={15} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-slate-800 dark:text-slate-100 truncate text-xs">
                        {headerState.customer.name}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {headerState.customer.id || headerState.customer.code || "CUST-0001"} · {headerState.customer.customerGroupId || "Retail"} {headerState.customer.mobile ? `· ${headerState.customer.mobile}` : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {headerState.customer.gstNumber && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-mono">
                        {headerState.customer.gstNumber}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderState(prev => ({ ...prev, customer: null, billedPartyGstinId: null, billedGstin: null, deliveryLocationId: null, deliveryStoreCode: null, deliveryGstin: null, placeOfSupplyCode: null, poReference: "", customerPoId: null }));
                        setSelectedCustomerPO(null);
                        setCustomerSearchInput("");
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer transition"
                      title="Clear selected customer"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs lg:flex-1 lg:min-w-[220px]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
                      <User size={15} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">Walk-in Customer</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">C-0001 | Retail</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">Default</span>
                </div>
              )}
            </div>

            {/* Column 2: Transaction Parameters & Settings (5 cols) */}
            <div className={`${showMoreDetails ? "lg:col-span-5" : "lg:col-span-3"} flex flex-col gap-1`}>
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Billing details
                </label>
                <div className="flex items-center gap-1.5 min-w-0">
                  <label htmlFor="billing-salesperson" className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    Salesperson
                  </label>
                  <select
                    id="billing-salesperson"
                    aria-label="Billing salesperson"
                    data-testid="billing-salesperson-select"
                    value={headerState.salesStaff}
                    onChange={event => {
                      const selectedStaff = event.target.value;
                      setHeaderState(prev => ({ ...prev, salesStaff: selectedStaff }));
                      setDirectEntry(prev => ({
                        ...prev,
                        staff: prev.staff === headerState.salesStaff ? selectedStaff : prev.staff
                      }));
                    }}
                    className="min-w-0 max-w-[150px] h-7 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 text-[10px] font-medium text-slate-700 dark:text-slate-200"
                  >
                    <option value="">Select staff</option>
                    {salesStaffOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowMoreDetails(v => !v)}
                    className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 whitespace-nowrap cursor-pointer"
                    aria-expanded={showMoreDetails}
                    title={salespeopleError || "Show billing details"}
                  >
                    <span>{showMoreDetails ? "Hide" : "Details"}</span>
                    {(headerState.billedPartyGstinId || headerState.deliveryLocationId || headerState.poReference) && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 ml-1" />
                    )}
                  </button>
                </div>
              </div>
              {salespeopleError && (
                <span role="status" className="text-[9px] text-amber-700 dark:text-amber-300" title={salespeopleError}>
                  Staff directory unavailable; current assignment retained.
                </span>
              )}

              {/* 2x2 Clean Grid of Select Dropdowns */}
              <div className={`${showMoreDetails ? "grid" : "hidden"} grid-cols-2 sm:grid-cols-4 gap-2`}>
                {/* Billing Source */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Source</span>
                  <select
                    aria-label="Billing Source"
                    value={headerState.billingSource || "DIRECT"}
                    onChange={event => {
                      const source = event.target.value as BillingHeaderState["billingSource"];
                      setHeaderState(prev => ({ ...prev, billingSource: source, customerPoId: null, poReference: "" }));
                      setSelectedCustomerPO(null);
                    }}
                    disabled={billingPolicyLoading || isReadOnlyView}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg h-8 px-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    {permittedSources.includes("DIRECT") && <option value="DIRECT">Direct Invoice</option>}
                    {permittedSources.includes("CUSTOMER_PO") && <option value="CUSTOMER_PO">Customer PO</option>}
                    {permittedSources.includes("SALES_ORDER") && <option value="SALES_ORDER" disabled>Sales Order (use order workflow)</option>}
                  </select>
                </div>

                {/* Sales Channel */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Channel</span>
                  <select
                    aria-label="Sales Channel"
                    data-testid="sales-channel-select"
                    value={headerState.salesChannel || "B2B_WHOLESALE"}
                    onChange={e => setHeaderState(prev => ({ ...prev, salesChannel: e.target.value }))}
                    disabled={billingPolicyLoading || isReadOnlyView || Boolean(transactionCustomerPolicy?.channel_conflict)}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg h-8 px-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    {SALES_CHANNELS.filter(ch => permittedSalesChannels.includes(ch.value)).map(ch => (
                      <option key={ch.value} value={ch.value}>{ch.label}</option>
                    ))}
                  </select>
                </div>

                {/* Bill Type */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Bill Type</span>
                  <select
                    aria-label="Bill Type"
                    value={headerState.billType}
                    onChange={e => setHeaderState({ ...headerState, billType: e.target.value as BillType })}
                    disabled={billingPolicyLoading || isReadOnlyView}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg h-8 px-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    {permittedBillTypes.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>

                {/* Transaction Mode */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Transaction</span>
                  {canChangeTransactionMode && (
                    permittedTransactions.length > 1
                    || !configuredTransactionIsPermitted
                    || transactionModeConflict
                  ) ? (
                    <select
                      aria-label="Transaction Type"
                      data-testid="transaction-mode-select"
                      value={permittedTransactions.includes(permittedTransactionType) ? headerState.transaction : ""}
                      onChange={event => {
                        setHeaderState(previous => ({
                          ...previous,
                          transaction: event.target.value as TransactionType,
                        }));
                        setTransactionModeConfirmed(true);
                      }}
                      disabled={billingPolicyLoading || isReadOnlyView || permittedTransactions.length === 0}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg h-8 px-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                    >
                      {!configuredTransactionIsPermitted && <option value="">Select permitted mode</option>}
                      {permittedTransactions.includes("CREDIT") && <option value="Credit">Credit</option>}
                      {permittedTransactions.includes("CASH") && <option value="Cash">Cash</option>}
                    </select>
                  ) : (
                    <div
                      aria-label="Transaction Type"
                      className="flex h-8 items-center rounded-lg border border-slate-200 bg-slate-100 px-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      {permittedTransactions.includes(permittedTransactionType)
                        ? (permittedTransactionType === "CREDIT" ? "Credit" : "Cash")
                        : configuredTransactionType
                          ? `Configured ${configuredTransactionType.toLowerCase()} unavailable`
                          : permittedTransactions.length === 0
                            ? "Billing unavailable"
                            : "Select required"}
                    </div>
                  )}
                </div>
              </div>

              {(billingPolicyLoading || billingPolicyError || transactionCustomerPolicy?.channel_conflict || transactionCustomerPolicy?.configuration_warning || billingTransactionPolicy?.configuration_warning || transactionModeConflict || (!configuredTransactionIsPermitted && permittedTransactions.length > 0) || permittedTransactions.length === 0 || (transactionCustomerPolicy?.require_po_number && !headerState.poReference?.trim() && !headerState.customerPoId) || requiresCreditOverride) && (
                <div className="mt-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200" role="status" data-testid="billing-policy-notice">
                  {billingPolicyLoading && <span>Resolving company, branch, and customer billing defaults…</span>}
                  {!billingPolicyLoading && billingPolicyError && <span>Billing policy is unavailable. Settlement is paused until it can be loaded.</span>}
                  {!billingPolicyLoading && !billingPolicyError && transactionCustomerPolicy?.channel_conflict && <span>The customer&apos;s default sales channel is not permitted by company or branch policy. Ask an administrator to resolve this configuration.</span>}
                  {!billingPolicyLoading && !billingPolicyError && transactionCustomerPolicy?.configuration_warning && <span>{transactionCustomerPolicy.configuration_warning}</span>}
                  {!billingPolicyLoading && !billingPolicyError && billingTransactionPolicy?.configuration_warning && <span>{billingTransactionPolicy.configuration_warning}</span>}
                  {!billingPolicyLoading && !billingPolicyError && permittedTransactions.length === 0 && <span>Cash and credit billing are both prohibited by customer or company/branch policy. Settlement is blocked.</span>}
                  {!billingPolicyLoading && !billingPolicyError && transactionModeConflict && !canChangeTransactionMode && <span>The configured billing mode conflicts with the current eligibility. Only an explicitly authorized user can select another permitted mode.</span>}
                  {!billingPolicyLoading && !billingPolicyError && transactionModeConflict && canChangeTransactionMode && !transactionModeConfirmed && <span>Select and confirm an eligible mode; the system will not silently switch from the configured customer default.</span>}
                  {!billingPolicyLoading && !billingPolicyError && !configuredTransactionIsPermitted && permittedTransactions.length > 0 && !transactionCustomerPolicy?.configuration_warning && <span>The configured billing mode is not permitted. An authorized user must explicitly select an eligible mode or correct the configuration.</span>}
                  {!billingPolicyLoading && !billingPolicyError && transactionCustomerPolicy?.require_po_number && !headerState.poReference?.trim() && !headerState.customerPoId && <span>A customer purchase-order reference is required by the active policy.</span>}
                  {!billingPolicyLoading && !billingPolicyError && requiresCreditOverride && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span>
                        {transactionCustomerPolicy?.can_override_credit && transactionCustomerPolicy.allow_credit_override
                          ? "Available credit is exceeded. An authorized override and business justification are required."
                          : "Available credit is exceeded and an authorized override is not available."}
                      </span>
                      {transactionCustomerPolicy?.can_override_credit && transactionCustomerPolicy.allow_credit_override && (
                        <input
                          aria-label="Credit override reason"
                          data-testid="credit-override-reason"
                          maxLength={100}
                          value={creditOverrideReason}
                          onChange={event => setCreditOverrideReason(event.target.value)}
                          placeholder="Authorized override reason"
                          className="min-w-[220px] rounded border border-amber-400 bg-white px-2 py-1 text-[11px] text-slate-900 dark:border-amber-700 dark:bg-slate-900 dark:text-white"
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Expandable B2B & Supply Details Drawer */}
              {showMoreDetails && (
                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/60 flex flex-wrap gap-2 animate-in fade-in" data-testid="b2b-corporate-strip">
                  {(headerState.billingSource === "CUSTOMER_PO" || transactionCustomerPolicy?.require_po_number) && (
                    <div className="flex flex-col gap-0.5 flex-1 min-w-[200px]">
                      <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Customer PO</span>
                      <select
                        aria-label="Customer PO"
                        data-testid="customer-po-select"
                        value={headerState.customerPoId || ""}
                        onChange={event => void selectCustomerPO(event.target.value)}
                        className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg h-8 px-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        disabled={isLoadingCustomerPOs}
                      >
                        <option value="">{isLoadingCustomerPOs ? "Loading POs..." : "-- Select Customer PO --"}</option>
                        {customerPOs.map(po => (
                          <option key={po.id} value={po.id}>
                            {po.po_number} · Remaining {po.remaining_quantity}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Billed GST Registration */}
                  <div className="flex flex-col gap-0.5 flex-1 min-w-[200px]">
                    <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Billed GSTIN</span>
                    <select
                      aria-label="Billed GST Registration"
                      data-testid="billed-gst-registration"
                      value={headerState.billedPartyGstinId || ""}
                      onChange={e => handleBilledGstinChange(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg h-8 px-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">
                        {customerGstRegistrations.length === 0
                          ? (headerState.customer?.gstNumber ? `Default (${headerState.customer.gstNumber})` : "Unregistered / Counter Cash")
                          : "-- Select Billed GSTIN --"}
                      </option>
                      {customerGstRegistrations.map(reg => (
                        <option key={reg.id} value={reg.id}>
                          {reg.gstin} — {reg.state_name} ({reg.state_code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Billing Location / Store */}
                  <div className="flex flex-col gap-0.5 flex-1 min-w-[200px]">
                    <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Billing Location</span>
                    {customerBillingLocations.length > 1 ? (
                      <select
                        aria-label="Billing Location"
                        data-testid="billing-location-select"
                        value={headerState.billingLocationId || ""}
                        onChange={e => handleBillingLocationChange(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg h-8 px-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">-- Select Billing Location --</option>
                        {customerBillingLocations.map(loc => (
                          <option key={loc.id} value={loc.id}>
                            [{loc.billing_store_code}] {loc.name || "Site"} — {loc.city}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="h-8 px-2 flex items-center border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                        {customerBillingLocations.length === 1
                          ? `${customerBillingLocations[0].name || "Site"} — ${customerBillingLocations[0].city}`
                          : "Primary Store Location"}
                      </div>
                    )}
                  </div>

                  {/* Delivery Location if Required */}
                  {isStoreLocationRequired && (
                    <div data-testid="delivery-location-container" className="flex flex-col gap-0.5 flex-1 min-w-[200px]">
                      <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Delivery Store *</span>
                      {customerDeliveryLocations.length > 1 ? (
                        <select
                          aria-label="Delivery Location"
                          data-testid="delivery-location-select"
                          value={headerState.deliveryLocationId || ""}
                          onChange={e => handleDeliveryLocationChange(e.target.value)}
                          className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg h-8 px-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">-- Select Delivery Store --</option>
                          {customerDeliveryLocations.map(loc => (
                            <option key={loc.id} value={loc.id}>
                              [{loc.store_code}] {loc.location_name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="h-8 px-2 flex items-center border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                          {customerDeliveryLocations[0]?.location_name || "Main Retail Store"}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Store Code Badge */}
                  {isStoreLocationRequired && (
                    <div data-testid="delivery-store-code-container" className="flex flex-col gap-0.5 w-24">
                      <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Store Code</span>
                      <div 
                        data-testid="delivery-store-code-display"
                        className="h-8 px-2 flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-blue-700 dark:text-blue-300"
                      >
                        {headerState.deliveryStoreCode || "—"}
                      </div>
                    </div>
                  )}

                  {/* POS State */}
                  <div className="flex flex-col gap-0.5 w-20">
                    <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">POS State</span>
                    <div 
                      data-testid="pos-code-display"
                      title={headerState.placeOfSupplyCode || "Default POS"}
                      className="h-8 px-2 flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-700 dark:text-slate-300"
                    >
                      {headerState.placeOfSupplyCode || "—"}
                    </div>
                  </div>

                  {/* PO Reference */}
                  <div className="flex flex-col gap-0.5 flex-1 min-w-[140px]">
                    <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      PO Reference{transactionCustomerPolicy?.require_po_number ? " *" : ""}
                    </span>
                    <input
                      type="text"
                      name="poReference"
                      aria-label="PO Reference"
                      data-testid="po-reference-input"
                      placeholder="PO / Order Ref"
                      value={headerState.poReference || ""}
                      onChange={e => setHeaderState(prev => ({ ...prev, poReference: e.target.value }))}
                      disabled={isReadOnlyView || (headerState.billingSource === "CUSTOMER_PO" && Boolean(headerState.customerPoId))}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg h-8 px-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Optional operator and recall controls remain available in Billing details. */}
            {showMoreDetails && <div className="lg:col-span-3 flex flex-col gap-1.5">
              {/* Action Buttons: Recall Held Bills & Last Saved Bill */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowRecallModal(true)}
                  className={`flex-1 h-8 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    suspendedBills.length > 0
                      ? "bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300"
                      : "bg-slate-50 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                  }`}
                  title="Recall Held Invoice (Ctrl+R)"
                >
                  <History size={13} className="text-purple-600" />
                  <span>Recall {suspendedBills.length > 0 ? `(${suspendedBills.length})` : ""}</span>
                </button>
              </div>

              {lastCompletedInvoice?.invoiceNumber && (
                <div className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded px-2 py-0.5 truncate text-center" title={`Last Saved: ${lastCompletedInvoice.invoiceNumber}`}>
                  Saved: {lastCompletedInvoice.invoiceNumber}
                </div>
              )}
            </div>}

          </div>
        </section>

        {/* ZONES C & D: ITEM GRID (~74%) & BILL SUMMARY (~26%) SIDE-BY-SIDE */}
        <div className="flex-1 flex flex-col lg:flex-row gap-2.5 min-h-0 overflow-hidden">
          
          {/* ZONE C: LINE ITEMS GRID & DIRECT ENTRY (~74% width) */}
          <section className="flex-1 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-xs min-h-0">
            
            {/* Multi-attribute quick inspector ribbon */}
            {selectedItemProductMeta && (
              <div className="bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-800 px-3 py-1.5 text-xs flex items-center justify-between text-blue-900 dark:text-cyan-200 shrink-0">
                <div className="flex items-center gap-3 overflow-x-auto">
                  <span><strong>Barcode:</strong> {selectedItemProductMeta.barcode}</span>
                  <span>•</span>
                  <span><strong>Stock/SKU:</strong> {selectedItemProductMeta.stockNo || selectedItemProductMeta.sku}</span>
                  <span>•</span>
                  <span><strong>Stock:</strong> {selectedItemProductMeta.stockQty} {selectedItemProductMeta.uom}</span>
                  <span>•</span>
                  <span><strong>MRP:</strong> ₹{selectedItemProductMeta.mrp.toFixed(2)}</span>
                  <span>•</span>
                  <span><strong>Cost:</strong> ₹{selectedItemProductMeta.costPrice.toFixed(2)}</span>
                  <span>•</span>
                  <span><strong>Size/Color:</strong> {selectedItemProductMeta.size}/{selectedItemProductMeta.color}</span>
                  <span>•</span>
                  <span><strong>Brand:</strong> {selectedItemProductMeta.brand}</span>
                  <span>•</span>
                  <span><strong>HSN:</strong> {selectedItemProductMeta.hsnCode} ({selectedItemProductMeta.gstPercentage}%)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedItemProductMeta(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs px-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Main Line Items Table */}
            <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
              <table className="w-full text-left border-collapse min-w-[920px] tabular-nums">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 z-10 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="px-2 py-1.5 w-9 text-center">#</th>
                    <th className="px-2 py-1.5 w-[110px]">Stock No (F11)</th>
                    <th className="px-2.5 py-1.5">Item Description</th>
                    <th className="px-2 py-1.5 w-[82px] text-right">Rate (₹)</th>
                    <th className="px-2 py-1.5 w-[62px] text-right">Qty</th>
                    <th className="px-2 py-1.5 w-[84px] text-right">Gross (₹)</th>
                    <th className="px-2 py-1.5 w-[68px] text-right">Disc %</th>
                    <th className="px-2 py-1.5 w-[78px] text-right">Disc (₹)</th>
                    <th className="px-2 py-1.5 w-[66px] text-right" title="Tax rate resolved from the item's authoritative tax configuration">GST (RO)</th>
                    <th className="px-2 py-1.5 w-[92px] text-right font-bold text-blue-700 dark:text-blue-300">Total (₹)</th>
                    <th className="px-2 py-1.5 w-[120px]">Salesperson</th>
                    <th className="px-1.5 py-1.5 w-8 text-center"></th>
                  </tr>
                </thead>
                <tbody className="text-[11px]">
                  {items.map((item, idx) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedRowIndex(idx)}
                      onDoubleClick={() => handleRowDoubleClick(item, idx)}
                      aria-selected={selectedRowIndex === idx}
                      className={`h-8 border-b border-slate-100 dark:border-slate-700/70 transition-colors cursor-pointer ${
                        editingLineId === item.id
                          ? "bg-blue-50 dark:bg-blue-950/60 shadow-[inset_3px_0_0_0_var(--color-primary,#2563eb)] font-semibold"
                          : selectedRowIndex === idx
                          ? "bg-blue-50/70 dark:bg-blue-950/30 shadow-[inset_3px_0_0_0_var(--color-primary,#2563eb)] font-semibold"
                          : idx % 2 === 0
                            ? "bg-white dark:bg-[#1e293b] hover:bg-slate-50 dark:hover:bg-slate-800/60"
                            : "bg-slate-50/70 dark:bg-slate-800/25 hover:bg-slate-100/70 dark:hover:bg-slate-800/60"
                      }`}
                      title="Double-click to edit line in Direct Entry (Ctrl+D to delete)"
                    >
                      <td className="px-2 py-1 text-center font-mono text-slate-500 text-[10px]">
                        {item.sNo}
                      </td>
                      <td className="px-2 py-1 font-mono font-semibold text-blue-700 dark:text-blue-300">
                        {item.stockNo}
                      </td>
                      <td className="px-2.5 py-1 truncate max-w-xs font-medium text-slate-800 dark:text-slate-100">
                        {item.itemDescription}
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-slate-700 dark:text-slate-300">
                        {Number(item.rate).toFixed(2)}
                      </td>
                      <td className="px-2 py-1 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {item.qty}
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-slate-600 dark:text-slate-400">
                        {Number(item.value).toFixed(2)}
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-slate-600 dark:text-slate-400">
                        {item.discPercent ? `${item.discPercent}%` : "-"}
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-rose-600 dark:text-rose-400">
                        {item.discAmt > 0 ? item.discAmt.toFixed(2) : "-"}
                      </td>
                      <td
                        className="px-2 py-1 text-right font-mono text-slate-500 dark:text-slate-400"
                        aria-label={`GST ${Number(item.gstPercentage ?? 0)} percent, read only`}
                        title="Read-only tax rate from authoritative item tax configuration"
                      >
                        {Number(item.gstPercentage ?? 0)}%
                      </td>
                      <td className="px-2 py-1 text-right font-mono font-bold text-blue-700 dark:text-blue-300">
                        {Number(item.total).toFixed(2)}
                      </td>
                      <td className="px-1.5 py-0.5">
                        <select
                          aria-label={`Salesperson for ${item.stockNo}`}
                          data-testid={`line-salesperson-${item.id}`}
                          value={item.salesStaff || ""}
                          disabled={isReadOnlyView}
                          onClick={event => event.stopPropagation()}
                          onChange={event => {
                            const salesperson = event.target.value;
                            setItems(prev => prev.map(line =>
                              line.id === item.id ? { ...line, salesStaff: salesperson } : line
                            ));
                          }}
                          className="w-full min-w-0 rounded border border-transparent bg-transparent px-1 py-0.5 text-[10px] text-slate-600 hover:border-slate-200 hover:bg-white focus:border-blue-500 focus:bg-white focus:outline-none dark:text-slate-300 dark:hover:border-slate-700 dark:focus:bg-slate-900 disabled:cursor-default"
                        >
                          <option value="">Unassigned</option>
                          {salesStaffOptions.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1.5 py-1 text-center">
                        {!isReadOnlyView && (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              handleRemoveItem(item.id);
                            }}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                            title="Delete Row"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}

                  {/* Clean empty placeholders if rows < 4 */}
                  {Array.from({ length: Math.max(0, 4 - items.length) }).map((_, i) => (
                    <tr key={"empty-" + i} className={`h-8 border-b border-slate-100 dark:border-slate-700/70 ${i % 2 === 0 ? "bg-white dark:bg-[#1e293b]" : "bg-slate-50/70 dark:bg-slate-800/25"}`}>
                      <td className="px-2 py-1 text-center text-slate-400 text-[10px]">
                        {items.length + i + 1}
                      </td>
                      <td colSpan={11} className="px-2.5 py-1 text-slate-400/60 italic text-[11px]">
                        {items.length === 0 && i === 0 ? "Scan barcode or enter Stock No below to add items..." : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Active Line Inspector Ribbon when row is selected */}
            {selectedRowIndex >= 0 && selectedRowIndex < items.length && (() => {
              const sel = items[selectedRowIndex];
              return (
                <div className="bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs flex flex-wrap items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-3 font-mono text-[11px] overflow-x-auto">
                    <span className="font-bold text-blue-600 dark:text-blue-400">Line #{sel.sNo}: {sel.stockNo}</span>
                    <span className="text-slate-800 dark:text-slate-200 font-sans font-medium">{sel.itemDescription}</span>
                    {sel.brand && <span className="text-slate-600 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[10px]">Brand: {sel.brand}</span>}
                    {sel.size && <span className="text-slate-600 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[10px]">Size: {sel.size}</span>}
                    {sel.hsnCode && <span className="text-slate-600 dark:text-slate-400 text-[10px]">HSN: {sel.hsnCode}</span>}
                    <span className="text-slate-600 dark:text-slate-400 text-[10px]">GST: {sel.gstPercentage}% (₹{(sel.taxAmount || 0).toFixed(2)})</span>
                    {(sel.discAmt || 0) > 0 && <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[10px]">Disc: {sel.discCode || "ILD"} -₹{(sel.discAmt || 0).toFixed(2)} ({sel.discPercent || 0}%)</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-slate-400 text-[10px] hidden md:inline">Double-click to edit | Ctrl+D to delete</span>
                    {!isReadOnlyView && (
                      <button
                        type="button"
                        onClick={() => handleRowDoubleClick(sel, selectedRowIndex)}
                        className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold cursor-pointer"
                      >
                        Edit Line
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Active In-Place Editing Banner */}
            {editingLineId && (
              <div className="bg-blue-50 dark:bg-blue-950/60 border-t border-b border-blue-200 dark:border-blue-800 px-3 py-1.5 text-xs text-blue-800 dark:text-blue-200 flex items-center justify-between font-medium shrink-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold">Editing Line #{items.find(it => it.id === editingLineId)?.sNo} ({items.find(it => it.id === editingLineId)?.stockNo})</span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">— Modify Rate, Qty, or Discount in Direct Entry and press Enter to save.</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingLineId(null);
                    setDirectEntry({
                      barcode: "",
                      stockNo: "",
                      itemDescription: "",
                      rate: "",
                      qty: "1",
                      discCode: "",
                      discQty: "",
                      discPercent: "",
                      staff: directEntry.staff
                    });
                  }}
                  className="text-xs text-rose-600 hover:underline font-bold cursor-pointer"
                >
                  Cancel Edit (Esc)
                </button>
              </div>
            )}

            {/* Direct Entry Row (F11) at Bottom of Item Card */}
            <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-2 flex gap-2 items-center shrink-0">
              <span className="text-[10px] font-mono font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/80 px-2 py-1 rounded shrink-0">
                F11
              </span>

              {/* Inputs aligned with table columns */}
              <div className="flex-1 flex gap-1.5 items-center flex-wrap sm:flex-nowrap">
                {/* Stock / Barcode Search */}
                <div className="w-[110px] relative shrink-0">
                  <input
                    ref={directStockNoRef}
                    type="text"
                    id="directStockNo"
                    name="directStockNo"
                    aria-label="Stock No (F2 to browse)"
                    data-f2-entity="variant"
                    value={directEntry.stockNo}
                    onChange={e => handleItemSearchChange(e.target.value, "stockNo")}
                    onFocus={() => {
                      setActiveItemSearchField("stockNo");
                      if (productSuggestions.length > 0) setShowProductDropdown(true);
                    }}
                    onKeyDown={e => handleItemInputKeyDown(e, "stockNo")}
                    placeholder="Stock / Barcode"
                    className="w-full border border-slate-300 dark:border-slate-700 h-8 font-mono text-xs rounded-lg px-2 bg-white dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {activeItemSearchField === "stockNo" && (
                    <SmritiItemTypeaheadDropdown
                      isOpen={showProductDropdown && (productSuggestions.length > 0 || isProductSearching || Boolean(productSearchError))}
                      items={productSuggestions}
                      selectedIndex={productSelectedIndex}
                      isLoading={isProductSearching}
                      errorMessage={productSearchError}
                      onSelect={(opt) => {
                        applyProductAutoPopulate(opt);
                        directStockNoRef.current?.focus();
                      }}
                      onClose={() => setShowProductDropdown(false)}
                      searchFieldType="stockNo"
                      anchorRef={directStockNoRef}
                    />
                  )}
                </div>

                {/* Item Description Display */}
                <input
                  type="text"
                  value={directEntry.itemDescription}
                  onChange={e => setDirectEntry({ ...directEntry, itemDescription: e.target.value })}
                  onKeyDown={e => e.key === "Enter" && void handleCommitDirectEntry()}
                  placeholder="Item Description"
                  className="flex-1 min-w-[120px] bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 h-8 text-xs rounded-lg px-2 font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 truncate"
                />

                {/* Rate */}
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="9999999.99"
                  value={directEntry.rate}
                  onChange={e => setDirectEntry({ ...directEntry, rate: e.target.value })}
                  onKeyDown={e => e.key === "Enter" && void handleCommitDirectEntry()}
                  placeholder="Rate"
                  className="w-[85px] border border-slate-300 dark:border-slate-700 h-8 font-mono text-xs rounded-lg px-2 text-right bg-white dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 shrink-0"
                />

                {/* Qty with Retail Barcode Scanner Guard */}
                <input
                  type="text"
                  value={directEntry.qty}
                  onChange={e => {
                    const clean = e.target.value.trim();
                    if (clean.length >= 8 && /^\d+$/.test(clean)) {
                      setDirectEntry(prev => ({
                        ...prev,
                        barcode: clean,
                        stockNo: prev.stockNo || clean,
                        qty: "1"
                      }));
                      onNotification?.("Barcode Intercepted", `Barcode ${clean} scanned into Qty was redirected to Barcode field.`, "info");
                      directBarcodeRef.current?.focus();
                      return;
                    }
                    setDirectEntry(prev => ({ ...prev, qty: e.target.value }));
                  }}
                  onKeyDown={e => e.key === "Enter" && void handleCommitDirectEntry()}
                  placeholder="Qty"
                  className="w-[65px] border border-slate-300 dark:border-slate-700 h-8 font-mono text-xs rounded-lg px-2 text-right bg-white dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 shrink-0"
                />

                {/* Gross Value */}
                <input
                  type="text"
                  value={directGrossValue > 0 ? directGrossValue.toFixed(2) : ""}
                  readOnly
                  placeholder="Value"
                  className="w-[85px] bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 h-8 font-mono text-xs rounded-lg px-2 text-right font-bold text-slate-700 dark:text-slate-300 shrink-0 hidden sm:block"
                />

                {/* Disc Code */}
                <input
                  type="text"
                  value={directEntry.discCode}
                  onChange={e => setDirectEntry({ ...directEntry, discCode: e.target.value })}
                  placeholder="Disc Code"
                  className="w-[75px] border border-slate-300 dark:border-slate-700 h-8 font-mono text-xs rounded-lg px-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 shrink-0 hidden md:block"
                />

                {/* Disc % */}
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={directEntry.discPercent}
                  onChange={e => setDirectEntry({ ...directEntry, discPercent: e.target.value })}
                  placeholder="Disc %"
                  className="w-[70px] border border-slate-300 dark:border-slate-700 h-8 font-mono text-xs rounded-lg px-2 text-right bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 shrink-0"
                />

                <select
                  aria-label="Salesperson for new item"
                  data-testid="item-salesperson-select"
                  value={directEntry.staff}
                  onChange={event => setDirectEntry(prev => ({ ...prev, staff: event.target.value }))}
                  className="w-[130px] border border-slate-300 dark:border-slate-700 h-8 rounded-lg px-1.5 text-[10px] bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shrink-0"
                >
                  <option value="">Unassigned</option>
                  {salesStaffOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>

                {/* Total */}
                <input
                  type="text"
                  value={directLineTotal > 0 ? directLineTotal.toFixed(2) : ""}
                  readOnly
                  placeholder="Total"
                  className="w-[95px] bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 h-8 font-mono text-xs rounded-lg px-2 text-right font-bold text-blue-700 dark:text-blue-300 shrink-0"
                />

                {/* Add Button */}
                <button
                  type="button"
                  onClick={() => void handleCommitDirectEntry()}
                  disabled={isResolvingProduct}
                  className="h-8 w-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center shadow-xs shrink-0 cursor-pointer disabled:opacity-50 transition"
                  title="Add Item (Enter)"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

          </section>

          {/* ZONE D: BILL SUMMARY & NET PAYABLE CARD (~26% width / w-80 to w-96) */}
          <aside className="w-full lg:w-[300px] xl:w-[320px] bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col p-2.5 shadow-xs shrink-0 justify-between gap-2">
            
            {/* Header & Stats */}
            <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 tracking-wide flex items-center gap-1.5">
                  <Receipt size={14} className="text-blue-600" />
                  <span>Bill Summary</span>
                </span>
              <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                  {summaryTotals.itemCount} {summaryTotals.itemCount === 1 ? "item" : "items"} · {summaryTotals.totalQty.toFixed(1)} qty
                </span>
              </div>

              {/* Financial Breakdown Table */}
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                {items.length > 0 && (
                  <div
                    role={currentPreviewError ? "alert" : "status"}
                    className={`py-1.5 text-[10px] ${
                      previewIsCurrent && !hasUnsupportedCharges
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    {currentPreviewError
                      ? `Backend preview failed: ${currentPreviewError}`
                      : previewIsCurrent && !hasUnsupportedCharges
                        ? "Backend-authoritative prices, discounts, GST and rounding validated."
                        : hasUnsupportedCharges
                          ? "Backend preview excludes extra charges; this invoice cannot be settled yet."
                          : "Validating invoice with the backend…"}
                    {currentPreviewError && (
                      <button
                        type="button"
                        className="ml-2 underline font-bold"
                        onClick={() => setBillingPreviewRetry((retry) => retry + 1)}
                      >
                        Retry
                      </button>
                    )}
                  </div>
                )}
                {/* Subtotal / Sales Value */}
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Sales Value (Gross)</span>
                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                    ₹{summaryTotals.salesValue.toFixed(2)}
                  </span>
                </div>

                {/* Line Item Discounts */}
                {summaryTotals.itemDiscount > 0 && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Line Discounts</span>
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      -₹{summaryTotals.itemDiscount.toFixed(2)}
                    </span>
                  </div>
                )}

                {/* Bill Discount (Promo / F6) */}
                <div 
                  onClick={() => setShowF6PromoModal(true)}
                  className="flex items-center justify-between py-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 -mx-1 px-1 rounded transition"
                  title="Manage Bill Discounts & Promotions (F6)"
                >
                  <span className="text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1">
                    <span>Bill Discount</span>
                    <span className="text-[9px] font-mono font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-1 py-0.2 rounded">F6</span>
                    {billLevelPromo.code !== "NONE" && (
                      <span className="text-[9px] font-bold text-amber-700 bg-amber-100 dark:bg-amber-950 dark:text-amber-300 px-1 rounded uppercase">
                        {billLevelPromo.code}
                      </span>
                    )}
                  </span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {summaryTotals.billDiscount > 0 ? `-₹${summaryTotals.billDiscount.toFixed(2)}` : "₹0.00"}
                  </span>
                </div>

                {/* GST / Taxes */}
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Sales Tax (GST)</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    +₹{summaryTotals.totalTax.toFixed(2)}
                  </span>
                </div>

                {/* Add-ons & Freight */}
                {summaryTotals.totalAddons > 0 && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Add-ons (Freight/Charges)</span>
                    <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                      +₹{summaryTotals.totalAddons.toFixed(2)}
                    </span>
                  </div>
                )}

                {/* Deductions */}
                {summaryTotals.totalDeductions > 0 && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Deductions</span>
                    <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                      -₹{summaryTotals.totalDeductions.toFixed(2)}
                    </span>
                  </div>
                )}

                {/* Round Off */}
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500 font-medium text-[11px]">Round Off</span>
                  <span className="font-mono text-slate-500 text-[11px]">
                    ₹{(summaryTotals.netAmount - (summaryTotals.salesValue - summaryTotals.itemDiscount - summaryTotals.billDiscount + summaryTotals.totalTax + summaryTotals.totalAddons - summaryTotals.totalDeductions)).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Net Payable Banner matching proposed premium UX */}
            <div className="pt-2 px-2 py-1.5 border-t border-slate-200 dark:border-slate-700/80 bg-blue-50 dark:bg-blue-950/30 rounded-lg flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-base font-bold text-blue-600 dark:text-blue-400">
                  Net Payable
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {headerState.transaction === "Credit" ? "B2B Credit" : "Counter Cash"} · GST Inc.
                </span>
              </div>
              <span className="text-2xl font-black tracking-tight font-mono text-blue-600 dark:text-blue-400">
                ₹{summaryTotals.netAmount.toFixed(2)}
              </span>
            </div>

          </aside>

        </div>

        {/* ZONE E: ACTIVE DRAWER (Opened conditionally when activeFooterDrawer !== 'none') */}
        {activeFooterDrawer !== "none" && (
          <section className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-md shrink-0 animate-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 uppercase tracking-wider">
                {activeFooterDrawer === "transporter" && "🚚 Transporter Details"}
                {activeFooterDrawer === "payment" && "💳 Payment & Settlement Studio"}
                {activeFooterDrawer === "addons" && "➕ Addons & Deductions (Statutory Factors)"}
                {activeFooterDrawer === "remarks" && "📝 Document Remarks"}
              </span>
              <button
                type="button"
                onClick={() => setActiveFooterDrawer("none")}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-bold p-1 cursor-pointer"
              >
                ✕ Close Drawer
              </button>
            </div>

            {/* Tab 1: Transporter Details */}
            {activeFooterDrawer === "transporter" && (
              <div className="overflow-x-auto max-h-36">
                <table className="w-full text-left border border-slate-200 dark:border-slate-700 text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300">
                    <tr>
                      <th className="px-2 py-1 w-10 border-r border-slate-200 dark:border-slate-700 text-center">#</th>
                      <th className="px-2 py-1 w-28 border-r border-slate-200 dark:border-slate-700">Type</th>
                      <th className="px-2 py-1 w-20 border-r border-slate-200 dark:border-slate-700">Code</th>
                      <th className="px-2 py-1 border-r border-slate-200 dark:border-slate-700">Description</th>
                      <th className="px-2 py-1 w-24 border-r border-slate-200 dark:border-slate-700">Rate Type</th>
                      <th className="px-2 py-1 w-24 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-xs">
                    {transporterRows.map((t, idx) => (
                      <tr key={idx} className="border-b border-slate-200 dark:border-slate-700">
                        <td className="px-2 py-1 border-r border-slate-200 dark:border-slate-700 text-center bg-slate-50 dark:bg-slate-900">{t.sNo}</td>
                        <td className="px-2 py-1 border-r border-slate-200 dark:border-slate-700 font-sans">{t.type}</td>
                        <td className="px-2 py-1 border-r border-slate-200 dark:border-slate-700">{t.code}</td>
                        <td className="px-2 py-1 border-r border-slate-200 dark:border-slate-700 font-sans">{t.description}</td>
                        <td className="px-2 py-1 border-r border-slate-200 dark:border-slate-700">{t.rateType}</td>
                        <td className="px-2 py-1 text-right font-bold text-blue-600">
                          <input
                            type="number"
                            value={t.amount || ""}
                            placeholder="0.00"
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              setTransporterRows(prev => prev.map((r, i) => i === idx ? { ...r, amount: val } : r));
                            }}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 text-right font-mono text-xs font-bold outline-none"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab 2: Payment Details */}
            {activeFooterDrawer === "payment" && (
              <div className="p-3 flex flex-col justify-center items-center gap-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                  Active Transaction Mode: <strong>{headerState.transaction}</strong> · Total Payable: <strong className="font-mono text-blue-600">₹{summaryTotals.netAmount.toFixed(2)}</strong>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (items.length > 0) setShowSettlementModal(true);
                      else alert("Add items before opening settlement.");
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    Open Multi-Tender Settlement Studio (F8)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExactCashSettlementRef.current?.()}
                    disabled={items.length === 0}
                    className="bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    Exact Cash Quick Settlement (F7)
                  </button>
                </div>
              </div>
            )}

            {/* Tab 3: Addons & Deductions */}
            {activeFooterDrawer === "addons" && (
              <div className="overflow-x-auto max-h-40 flex flex-col gap-1.5">
                <div className="flex items-center justify-between pb-1 shrink-0">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
                    <span>Statutory Section 15 GST Factors</span>
                    {headerState.customer?.priceGroupCode && (
                      <span className="font-mono text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 rounded font-bold">
                        Group: {headerState.customer.priceGroupCode}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDefineFactorsModal(true)}
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <span>Define Factors (Alt+S)</span>
                  </button>
                </div>
                <table className="w-full text-left border border-slate-200 dark:border-slate-700 text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300">
                    <tr>
                      <th className="px-2 py-1 w-10 border-r border-slate-200 dark:border-slate-700 text-center">#</th>
                      <th className="px-2 py-1 w-24 border-r border-slate-200 dark:border-slate-700">Type</th>
                      <th className="px-2 py-1 w-20 border-r border-slate-200 dark:border-slate-700">Code</th>
                      <th className="px-2 py-1 border-r border-slate-200 dark:border-slate-700">Description</th>
                      <th className="px-2 py-1 w-28 border-r border-slate-200 dark:border-slate-700 text-center">Timing (GST)</th>
                      <th className="px-2 py-1 w-24 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-xs">
                    {addonRows.map((a, idx) => (
                      <tr key={idx} className="border-b border-slate-200 dark:border-slate-700">
                        <td className="px-2 py-1 border-r border-slate-200 dark:border-slate-700 text-center bg-slate-50 dark:bg-slate-900">{a.sNo}</td>
                        <td className="px-2 py-1 border-r border-slate-200 dark:border-slate-700">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-sans ${
                            a.type === "Addon" ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300" : "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                          }`}>
                            {a.type === "Addon" ? "Addon (+)" : "Deduction (-)"}
                          </span>
                        </td>
                        <td className="px-2 py-1 border-r border-slate-200 dark:border-slate-700 font-bold">{a.code}</td>
                        <td className="px-2 py-1 border-r border-slate-200 dark:border-slate-700 font-sans">{a.description}</td>
                        <td className="px-2 py-1 border-r border-slate-200 dark:border-slate-700 text-center">
                          <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                            {a.timing === "ABOVE_TAX" ? "Above Tax" : "Below Tax"}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-right font-bold text-blue-600">
                          <input
                            type="number"
                            value={a.amount || ""}
                            placeholder="0.00"
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              setAddonRows(prev => prev.map((r, i) => i === idx ? { ...r, amount: val } : r));
                            }}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 text-right font-mono text-xs font-bold outline-none"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab 4: Document Remarks */}
            {activeFooterDrawer === "remarks" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Document Remarks &amp; Shipping Instructions
                </label>
                <input
                  type="text"
                  value={headerState.remarks}
                  onChange={e => setHeaderState({ ...headerState, remarks: e.target.value })}
                  placeholder="e.g. Dispatched via Express logistics, Fragile handling requested"
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg h-8 text-xs px-2.5 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                />
              </div>
            )}
          </section>
        )}

        {/* ZONE E: COMPACT BILLING ACTION BAR */}
        <div className="bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-2 shadow-xs shrink-0">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
            {summaryTotals.itemCount} {summaryTotals.itemCount === 1 ? "item" : "items"} · Net payable ₹{summaryTotals.netAmount.toFixed(2)}
          </span>
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              type="button"
              onClick={handleSuspendInvoice}
              disabled={isReadOnlyView}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              title="Hold / Park Invoice (F12)"
            >
              <Save size={14} className="text-blue-600" />
              <span>Hold <span className="hidden sm:inline">(F12)</span></span>
            </button>
            <button
              type="button"
              onClick={handleReprintInvoice}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Print Preview / Reprint (Ctrl+P)"
            >
              <Printer size={14} className="text-blue-600" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={openSettlement}
              disabled={isReadOnlyView || items.length === 0}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
              title="Settle & Save Invoice (F8)"
            >
              <Check size={16} />
              <span>Settle &amp; Save <span className="hidden sm:inline">(F8)</span></span>
            </button>
          </div>
        </div>

      </main>

      {/* Attachments Panel (Collapsible) */}
      {showAttachmentPanel && (
        <div className="bg-surface-container-lowest border-t border-outline-variant px-margin-page py-3">
          <TransactionAttachmentPanel
            documentType="billing"
            documentId={`${headerState.docPrefix}-${headerState.docNo}` || "new-bill"}
            onAttachmentAdded={(att: TransactionAttachment) => {
              onNotification?.("Success", `✓ ${att.fileName} attached`, "success");
            }}
            readOnly={false}
            maxFiles={5}
            allowedExtensions="PDF, Word, Excel, CSV, Images (JPG, PNG, GIF), ZIP"
          />
        </div>
      )}

      {/* MODALS */}

      <BulkAddItemsModal
        isOpen={showBulkAddItemsModal}
        onClose={() => setShowBulkAddItemsModal(false)}
        products={liveProducts}
        salesperson={directEntry.staff}
        onCommitItems={handleBulkItemsImport}
      />

      <BarcodeCSVImportModal
        isOpen={showBarcodeCSVImportModal}
        onClose={() => setShowBarcodeCSVImportModal(false)}
        customer={headerState.customer}
        onImportConfirmed={handleBarcodeCSVImport}
      />

      {/* 1. Settlement Modal */}
      <SmritiInvoiceSettlementModal
        isOpen={showSettlementModal}
        billNo={`${headerState.docPrefix}-${headerState.docNo}`}
        billDate={headerState.billDate}
        customer={headerState.customer}
        netAmount={summaryTotals.netAmount}
        transaction={headerState.transaction === "Credit" ? "Credit" : "Cash"}
        onCompleteSettlement={handleCompleteSettlement}
        onSuspendBill={handleSuspendInvoice}
        onClose={() => setShowSettlementModal(false)}
      />



      {/* 3. SMRITI F2 Advanced Item Search & Invoicing Browser */}
      <SmritiF2AdvancedItemSearch
        isOpen={showSmritiItemSearchModal}
        products={liveProducts}
        initialSearchQuery={directEntry.stockNo || directEntry.itemDescription}
        onSelectProduct={(item: SmritiF2SelectedItem) => {
          setDirectEntry({
            ...directEntry,
            stockNo: item.stockNo,
            barcode: item.barcode || item.stockNo,
            itemDescription: item.name,
            rate: String(item.rate || item.mrp || 0)
          });
          setShowSmritiItemSearchModal(false);
          directStockNoRef.current?.focus();
        }}
        onClose={() => setShowSmritiItemSearchModal(false)}
      />

      {/* 3b. SMRITI F6 Promotional Discounts & Sales Schemes Modal */}
      <SmritiF6PromotionalDiscountsModal
        isOpen={showF6PromoModal}
        onClose={() => setShowF6PromoModal(false)}
        items={items}
        subtotal={summaryTotals.salesValue}
        billLevelPromo={billLevelPromo}
        onApplyPromos={(updatedItems, updatedBillPromo) => {
          setItems(updatedItems);
          setIsManualBillPromoOverride(true);
          setBillLevelPromo(updatedBillPromo);
          onNotification?.("Discounts Applied", `Applied ${updatedBillPromo.code} bill discount and updated line item promos.`, "success");
        }}
        onNotification={onNotification}
      />

      {/* 3c. SMRITI Define Sales Promotions Master Modal */}
      <SmritiDefineSalesPromotionsModal
        isOpen={showDefinePromosModal}
        onClose={() => setShowDefinePromosModal(false)}
        onNotification={onNotification}
      />

      {/* 3d. SMRITI Define Sales Factors & Customer Price Groups Modal */}
      <SmritiDefineSalesFactorsModal
        isOpen={showDefineFactorsModal}
        onClose={() => setShowDefineFactorsModal(false)}
        onFactorsUpdated={refreshSalesFactors}
        onNotification={onNotification}
      />

      {/* 4. Recall Suspended Invoices Modal */}
      {showRecallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-surface rounded-lg shadow-2xl w-full max-w-xl border border-outline-variant overflow-hidden flex flex-col">
            <div className="bg-surface-container-lowest px-5 py-3 border-b border-outline-variant flex justify-between items-center">
              <h3 className="font-title-sm text-sm font-bold text-primary flex items-center gap-2">
                <History size={16} className="text-secondary" />
                <span>Held / Suspended Invoices Queue</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowRecallModal(false)}
                className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 max-h-72 overflow-y-auto">
              {suspendedBills.length === 0 ? (
                <p className="text-center py-6 text-xs text-on-surface-variant">No suspended invoices currently on hold.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {suspendedBills.map((bill, idx) => (
                    <div
                      key={bill.id}
                      className="bg-surface-container-low border border-outline-variant p-3 rounded flex flex-col hover:bg-secondary-fixed/30 transition"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-code-md text-xs font-bold text-primary">
                            {bill.header.docPrefix}-{bill.header.docNo}
                          </p>
                          <p className="text-[11px] text-on-surface-variant">
                            {bill.header.customer?.name || "Counter Cash"} • {bill.items.length} items • Held at {bill.date}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-code-md text-xs font-bold text-primary">₹{bill.netAmount.toFixed(2)}</span>
                          <button
                            type="button"
                            onClick={() => setExpandedHeldBillId(prev => prev === bill.id ? null : bill.id)}
                            className="p-1 border border-outline-variant hover:bg-surface-container rounded text-on-surface-variant text-[11px] flex items-center gap-1 font-semibold"
                            title="Inspect items [F2]"
                          >
                            <span>Inspect</span>
                            {expandedHeldBillId === bill.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRecallInvoice(bill)}
                            className="bg-primary hover:bg-primary-container text-on-primary px-3 py-1 rounded text-xs font-bold transition"
                          >
                            Recall
                          </button>
                        </div>
                      </div>

                      {/* Nested Document Line Item Inspection */}
                      {expandedHeldBillId === bill.id && (
                        <div className="mt-2 pt-2 border-t border-outline-variant bg-surface-container-lowest/60 rounded p-2">
                          <table className="w-full text-[11px] font-mono">
                            <thead>
                              <tr className="text-on-surface-variant border-b border-outline-variant text-left">
                                <th className="pb-1">Stock No</th>
                                <th className="pb-1">Description</th>
                                <th className="pb-1 text-right">Qty</th>
                                <th className="pb-1 text-right">Rate</th>
                                <th className="pb-1 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bill.items.map((it, itemIdx) => (
                                <tr key={itemIdx} className="border-b border-outline-variant/30">
                                  <td className="py-0.5 font-bold text-primary">{it.stockNo}</td>
                                  <td className="py-0.5 truncate max-w-[160px]">{it.itemDescription}</td>
                                  <td className="py-0.5 text-right">{it.qty}</td>
                                  <td className="py-0.5 text-right">₹{Number(it.rate).toFixed(2)}</td>
                                  <td className="py-0.5 text-right font-bold">₹{(Number(it.qty) * Number(it.rate)).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-surface-container-low px-5 py-2.5 border-t border-outline-variant flex justify-end">
              <button
                type="button"
                onClick={() => setShowRecallModal(false)}
                className="bg-surface-container border border-outline-variant px-4 py-1.5 rounded text-xs font-semibold text-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Quick Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-surface rounded-lg shadow-2xl w-full max-w-md border border-outline-variant overflow-hidden flex flex-col">
            <div className="bg-surface-container-lowest px-5 py-3 border-b border-outline-variant flex justify-between items-center">
              <h3 className="font-title-sm text-sm font-bold text-primary flex items-center gap-2">
                <UserPlus size={16} className="text-secondary" />
                <span>Quick Add Customer</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddCustomerModal(false)}
                className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-3">
              <div>
                <label className="block font-label-caps text-[11px] text-on-surface-variant mb-1 font-bold uppercase">Customer Name *</label>
                <input
                  type="text"
                  value={newCustName}
                  onChange={e => setNewCustName(e.target.value)}
                  placeholder="e.g. Modern Enterprises Pvt Ltd"
                  className="w-full border border-outline-variant rounded h-8 px-2.5 text-xs bg-surface focus:border-secondary outline-none font-medium"
                />
              </div>

              <div>
                <label className="block font-label-caps text-[11px] text-on-surface-variant mb-1 font-bold uppercase">Mobile Number</label>
                <input
                  type="text"
                  value={newCustMobile}
                  onChange={e => setNewCustMobile(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full border border-outline-variant rounded h-8 px-2.5 text-xs font-code-md bg-surface focus:border-secondary outline-none"
                />
              </div>

              <div>
                <label className="block font-label-caps text-[11px] text-on-surface-variant mb-1 font-bold uppercase">GSTIN / Tax ID</label>
                <input
                  type="text"
                  value={newCustGstin}
                  onChange={e => setNewCustGstin(e.target.value)}
                  placeholder="e.g. 27AAAAA0000A1Z5"
                  className="w-full border border-outline-variant rounded h-8 px-2.5 text-xs font-code-md bg-surface focus:border-secondary outline-none font-bold"
                />
              </div>
            </div>

            <div className="bg-surface-container-low px-5 py-3 border-t border-outline-variant flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddCustomerModal(false)}
                className="bg-surface-container border border-outline-variant px-4 py-1.5 rounded text-xs font-semibold text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateCustomer}
                disabled={!newCustName}
                className="bg-primary hover:bg-primary-container text-on-primary px-5 py-1.5 rounded text-xs font-bold transition disabled:opacity-40"
              >
                Save &amp; Select
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Tax Invoice Print Modal */}
      {showPrintModal && lastCompletedInvoice && (
        <PrintPreviewModal
          isOpen={showPrintModal}
          data={{
            companyName: "SMRITI Retail OS",
            companyAddress: "Central Warehouse, Distribution Center",
            invoiceNumber: lastCompletedInvoice.invoiceNumber,
            date: lastCompletedInvoice.date,
            customerName: lastCompletedInvoice.customerName,
            customerPhone: "",
            customerGstin: lastCompletedInvoice.customerGstin,
            items: lastCompletedInvoice.items,
            subtotal: lastCompletedInvoice.subtotal,
            discount: lastCompletedInvoice.discount,
            tax: lastCompletedInvoice.tax,
            total: lastCompletedInvoice.total,
            paymentMode: lastCompletedInvoice.paymentMode,
            terms: "Subject to local jurisdiction. Goods once sold will not be taken back without valid invoice."
          }}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {/* 7. Commercial Transactions & Audit Browser Modal (F4 / Alt+6) */}
      <InvoicingTransactionBrowserModal
        isOpen={showTransactionBrowserModal}
        onClose={() => setShowTransactionBrowserModal(false)}
        onSelectDocument={handleSelectDocumentFromBrowser}
        onPrintPdf={(docId) => void openCanonicalInvoicePrint(docId)}
        onNotification={(title, msg, type) => onNotification?.(title, msg, type === "error" ? "error" : "success")}
      />

      {/* 8. Shoper 9 Parity: Define Bill Prefix Management Studio Modal */}
      <SmritiDefineBillPrefixModal
        isOpen={showDefinePrefixModal}
        onClose={() => setShowDefinePrefixModal(false)}
        onSaved={() => {
          const txType = headerState.transaction === "Cash" ? "SALES_CASH" : "SALES_CREDIT";
          void SmritiBillPrefixService.resolveActivePrefix({
            transactionType: txType,
            terminalId: (currentUser as any)?.terminalId || "COMMON",
            branchId: headerState.deliveryLocationId || undefined,
            billType: headerState.billType
          }).then(res => {
            setResolvedPrefixInfo(res);
            setHeaderState(prev => ({
              ...prev,
              docPrefix: res.prefix,
              docNo: res.formattedDocNo
            }));
          });
        }}
        terminalId={(currentUser as any)?.terminalId || "COMMON"}
        companyCode={(currentUser as any)?.companyCode || currentUser?.companyId || "SMRITI"}
      />

      {/* 9. Global Product Resolution: Product Not Found Modal */}
      {productNotFoundState.isOpen && (
        <div className="fixed inset-0 bg-scrim/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-outline-variant rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-error/10 border-b border-error/20 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-error" />
                <h3 className="font-bold text-sm text-error">⚠ Product Not Found</h3>
              </div>
              <button
                type="button"
                onClick={handleScanAgain}
                className="p-1 hover:bg-error/20 rounded text-error cursor-pointer"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-3">
              <div className="bg-surface-container-low border border-outline-variant rounded p-3 text-center">
                <div className="text-[11px] font-label-caps uppercase text-on-surface-variant font-bold">Scanned / Entered Identifier</div>
                <div className="font-code-md font-bold text-base text-primary tracking-wider mt-1">
                  {productNotFoundState.barcode}
                </div>
              </div>

              <div className="text-xs text-on-surface leading-relaxed text-center">
                {productNotFoundState.message || "This product is not registered in Product List. Please add the product to Product List before continuing."}
              </div>
            </div>

            <div className="bg-surface-container-low px-4 py-3 border-t border-outline-variant flex justify-end gap-2">
              <button
                type="button"
                onClick={handleScanAgain}
                className="bg-surface-container border border-outline-variant hover:bg-surface-container-high px-4 py-1.5 rounded text-xs font-semibold text-on-surface transition cursor-pointer"
              >
                Scan Again
              </button>
              {canAddProduct && (
                <button
                  type="button"
                  onClick={handleAddProductFromModal}
                  className="bg-primary hover:bg-primary-container text-on-primary px-4 py-1.5 rounded text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Plus size={14} />
                  Add Product
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 10. Global Product Resolution: Product Inactive / Quarantined Modal */}
      {productInactiveState.isOpen && (
        <div className="fixed inset-0 bg-scrim/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-outline-variant rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-warning/10 border-b border-warning/20 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-warning-dark" />
                <h3 className="font-bold text-sm text-warning-dark">⚠ Product Inactive / Under Review</h3>
              </div>
              <button
                type="button"
                onClick={handleScanAgain}
                className="p-1 hover:bg-warning/20 rounded text-warning-dark cursor-pointer"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-3">
              <div className="bg-surface-container-low border border-outline-variant rounded p-3">
                <div className="text-[11px] font-label-caps uppercase text-on-surface-variant font-bold">Identifier &amp; Product</div>
                <div className="font-code-md font-bold text-sm text-primary mt-1">
                  {productInactiveState.barcode}
                </div>
                {productInactiveState.name && (
                  <div className="text-xs text-on-surface font-medium mt-0.5">
                    {productInactiveState.name}
                  </div>
                )}
              </div>

              <div className="text-xs text-on-surface leading-relaxed">
                {productInactiveState.reason || "This product is marked as inactive or under quarantine review. Transaction lines cannot be created for inactive products."}
              </div>
            </div>

            <div className="bg-surface-container-low px-4 py-3 border-t border-outline-variant flex justify-end gap-2">
              <button
                type="button"
                onClick={handleScanAgain}
                className="bg-primary hover:bg-primary-container text-on-primary px-4 py-1.5 rounded text-xs font-bold transition cursor-pointer"
              >
                Scan Again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingTerm;
