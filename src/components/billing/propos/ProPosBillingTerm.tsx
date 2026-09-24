/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.32.0
 * Created      : 2026-08-21
 * Modified     : 2026-09-17
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { ProPosCartItem, ProPosCustomer, ProPosTenderSplit, SuspendedBill, CancelledBillRecord, ReturnItem, POSZReportData, ShiftCashMovementRecord } from "./types.ts";
import { SmritiPosSettlement } from "./ProPosSettlementDl.tsx";
import { SmritiProPosRecallDlg } from "./ProPosRecallDlg.tsx";
import { SmritiProPosCancelDlg } from "./ProPosCancellation.tsx";
import { SmritiLoyaltyLookupDlgpModal } from "./ProPosLoyaltyLooku.tsx";
import { SmritiProPosSalesReturnModal } from "./ProPosSalesReturnD.tsx";
import { SmritiProPosTaxInvoiceReceipt } from "./ProPosTaxInvoiceRc.tsx";
import { BarcodeCSVImportModal, ResolvedCartItem } from "../BarcodeCSVImportModal.tsx";
import { SmritiCustomerBrowseModal } from "./CustBrowseDlg.tsx";
import { SmritiProPosHotkeysDlg } from "./ProPosHotkeysDlg.tsx";
import { SmritiProPosReprintDlg } from "./ProPosReprintDlg.tsx";
import { SmritiProPosCashMovementsModal } from "./ProPosCashMovesDlg.tsx";
import { SmritiProPosShiftCloseModal } from "./ProPosShiftCloseDl.tsx";
import { SmritiF2AdvancedItemSearch, SmritiF2SelectedItem } from "../SmritiF2AdvancedItemSearch.tsx";
import {
  SmritiF6PromotionalDiscountsModal,
  SmritiBillLevelPromoState
} from "../SmritiF6PromotionalDiscountsModal.tsx";
import { SmritiDefineSalesPromotionsModal } from "../SmritiDefineSalesPromotionsModal.tsx";
import { SmritiDefineSalesFactorsModal } from "../../pricing/SmritiDefineSalesFactorsModal.tsx";
import { SmritiSalesFactorService } from "../../../services/smritiSalesFactorService.ts";
import {
  SmritiSalesPromotionService,
  ItemPromoResolutionResult
} from "../../../services/smritiSalesPromotionService.ts";
import { SmritiDefineBillPrefixModal } from "../SmritiDefineBillPrefixModal.tsx";
import {
  SmritiBillPrefixService,
  BillPrefixResolveResult
} from "../../../services/smritiBillPrefixService.ts";
import { SmritiPosParkedCartService } from "../../../services/smritiPosParkedCartService.ts";
import { smritiSystemParameterService } from "../../../services/smritiSystemParameterService.ts";
import { calculateGST, parseAndValidateGSTIN, GST_STATE_MAP } from "../../../utils/gstEngine.ts";
import { searchBackendProducts, AutoPopulateProductResult } from "../../../services/autoPopulateService.ts";
import { SmritiItemTypeaheadDropdown } from "../../common/ItemTypeaheadDrop.tsx";
import {
  Barcode,
  Search,
  History,
  Award,
  Trash2,
  Plus,
  Minus,
  Printer,
  CheckCircle,
  AlertCircle,
  User,
  X,
  RotateCcw,
  ShieldAlert,
  Pause,
  Play,
  CornerDownLeft,
  FileSpreadsheet,
  Calendar,
  Clock,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FilePlus,
  HelpCircle,
  Calculator,
  RefreshCw,
  Vault,
  Lock,
  MoreVertical,
  Eye,
  Truck,
  UserPlus
} from "lucide-react";
import type { CustomerBillingLocationDTO, CustomerDeliveryLocationDTO } from "../types.ts";
import { apiFetchV1 } from "../../../lib/apiFetchV1.ts";
import { useF2Screen } from "../../../context/F2DispatcherContext.tsx";
import type { LookupResult } from "../../../context/F2DispatcherContext.tsx";

interface SmritiProPosBillingTerminalProps {
  onNotification?: (title: string, message: string, type: "success" | "error" | "info" | "warning") => void;
  shiftId?: string;
}
export const SmritiProPosBillingTerminal: React.FC<SmritiProPosBillingTerminalProps> = ({
  onNotification,
  shiftId,
}) => {
  // --- POS Mode & Activity State ---
  const [activeActivity, setActiveActivity] = useState<"BILLING" | "RETURN" | "RETURN_BLIND">("BILLING");

  // --- Header Group State ---
  const [billType, setBillType] = useState<"Product" | "Service">("Product");
  const [transactionType, setTransactionType] = useState<"Cash" | "Credit">("Cash");
  const [billDocPrefix, setBillDocPrefix] = useState<string>("INV");
  const [billDocNumber, setBillDocNumber] = useState<string>("1");
  const [showDefinePrefixModal, setShowDefinePrefixModal] = useState<boolean>(false);
  const [prefixResolveResult, setPrefixResolveResult] = useState<BillPrefixResolveResult | null>(null);

  // Load System Parameters for fast 0ms synchronous access
  useEffect(() => {
    void smritiSystemParameterService.load();
  }, []);

  // Dynamic Bill Prefix Resolution (Shoper 9 Parity & GST Rule 46b)
  useEffect(() => {
    let txType = transactionType === "Cash" ? "SALES_CASH" : "SALES_CREDIT";
    if (activeActivity === "RETURN" || activeActivity === "RETURN_BLIND") {
      txType = "SALES_RETURN";
    }
    void SmritiBillPrefixService.resolveActivePrefix({
      transactionType: txType,
      terminalId: "COMMON",
      billType
    }).then(res => {
      setPrefixResolveResult(res);
      setBillDocPrefix(res.prefix);
      setBillDocNumber(res.formattedDocNo);
    });
  }, [transactionType, activeActivity, billType]);

  const [currentDateTime, setCurrentDateTime] = useState<string>(() => {
    const d = new Date();
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  });

  const [customer, setCustomer] = useState<ProPosCustomer>({
    id: "cust-01",
    code: "C01",
    name: "Customer01 (Walk-in)",
    phone: "9876543210",
    loyaltyPoints: 1200,
    loyaltyTier: "Gold",
    creditLimit: 50000,
    currentBalance: 0
  });
  const [customerBillingLocations, setCustomerBillingLocations] = useState<CustomerBillingLocationDTO[]>([]);
  const [customerDeliveryLocations, setCustomerDeliveryLocations] = useState<CustomerDeliveryLocationDTO[]>([]);
  const [selectedBillingLocationId, setSelectedBillingLocationId] = useState<string>("");
  const [selectedDeliveryLocationId, setSelectedDeliveryLocationId] = useState<string>("");
  const [isLoadingCustomerLocations, setIsLoadingCustomerLocations] = useState<boolean>(false);
  const [customerLocationError, setCustomerLocationError] = useState<string>("");
  const [billingLocationFilter, setBillingLocationFilter] = useState<string>("");
  const [shippingLocationFilter, setShippingLocationFilter] = useState<string>("");
  const [showBillingAddressDetails, setShowBillingAddressDetails] = useState<boolean>(false);
  const [showShippingAddressDetails, setShowShippingAddressDetails] = useState<boolean>(false);
  const [showBillingAddressSuggestions, setShowBillingAddressSuggestions] = useState<boolean>(false);
  const [showShippingAddressSuggestions, setShowShippingAddressSuggestions] = useState<boolean>(false);
  const [currentRegisterCode, setCurrentRegisterCode] = useState<string>("");
  const activeCustomerLocationFetchIdRef = useRef<string | null>(null);
  const isWalkInCustomer = customer.code === "C01" && customer.name.includes("Walk-in");
  const normalizedBillingLocationFilter = billingLocationFilter.trim().toLowerCase();
  const normalizedShippingLocationFilter = shippingLocationFilter.trim().toLowerCase();
  const filteredBillingLocations = customerBillingLocations.filter(location => [
    location.billing_store_code,
    location.name,
    location.city,
    location.state,
    location.pincode,
  ].some(value => String(value || "").toLowerCase().includes(normalizedBillingLocationFilter)));
  const filteredDeliveryLocations = customerDeliveryLocations.filter(location => [
    location.store_code,
    location.location_name,
    location.city,
    location.state_name,
    location.pin_code,
  ].some(value => String(value || "").toLowerCase().includes(normalizedShippingLocationFilter)));
  const selectedBillingLocation = customerBillingLocations.find(location => location.id === selectedBillingLocationId);
  const selectedDeliveryLocation = customerDeliveryLocations.find(location => location.id === selectedDeliveryLocationId);
  const formatLocationTail = (city?: string | null, state?: string | null) => [city, state].filter(Boolean).join(", ");
  const formatBillingAddress = (location: CustomerBillingLocationDTO) => [
    location.address_line1,
    location.address_line2,
    location.city,
    location.state && location.pincode ? `${location.state} - ${location.pincode}` : location.state || location.pincode,
  ].filter(Boolean).join(", ");
  const formatDeliveryAddress = (location: CustomerDeliveryLocationDTO) => [
    location.address_line1,
    location.address_line2,
    location.city,
    location.state_name && location.pin_code ? `${location.state_name} - ${location.pin_code}` : location.state_name || location.pin_code,
  ].filter(Boolean).join(", ");
  const billingLocationLabel = selectedBillingLocation
    ? `[${selectedBillingLocation.billing_store_code || ""}] ${selectedBillingLocation.name || "Billing location"} - ${formatLocationTail(selectedBillingLocation.city, selectedBillingLocation.state)}`
    : "";
  const shippingLocationLabel = selectedDeliveryLocation
    ? `[${selectedDeliveryLocation.store_code || ""}] ${selectedDeliveryLocation.location_name || "Shipping location"} - ${formatLocationTail(selectedDeliveryLocation.city, selectedDeliveryLocation.state_name)}`
    : "";
  const billingFieldValue = billingLocationFilter || (selectedBillingLocation
    ? showBillingAddressDetails ? [billingLocationLabel, formatBillingAddress(selectedBillingLocation)].filter(Boolean).join("\n") : billingLocationLabel
    : "");
  const shippingFieldValue = shippingLocationFilter || (selectedDeliveryLocation
    ? showShippingAddressDetails ? [shippingLocationLabel, formatDeliveryAddress(selectedDeliveryLocation)].filter(Boolean).join("\n") : shippingLocationLabel
    : "");

  const loadCustomerLocations = async (customerId: string, walkIn = false) => {
    activeCustomerLocationFetchIdRef.current = customerId || null;
    if (!customerId || walkIn) {
      setCustomerBillingLocations([]);
      setCustomerDeliveryLocations([]);
      setSelectedBillingLocationId("");
      setSelectedDeliveryLocationId("");
      setCustomerLocationError("");
      setBillingLocationFilter("");
      setShippingLocationFilter("");
      setShowBillingAddressDetails(false);
      setShowShippingAddressDetails(false);
      setShowBillingAddressSuggestions(false);
      setShowShippingAddressSuggestions(false);
      return;
    }

    setIsLoadingCustomerLocations(true);
    setCustomerLocationError("");
    setBillingLocationFilter("");
    setShippingLocationFilter("");
    setShowBillingAddressSuggestions(false);
    setShowShippingAddressSuggestions(false);

    try {
      const [billingResponse, deliveryResponse] = await Promise.all([
        apiFetchV1(`/crm/customers/${customerId}/billing-locations`),
        apiFetchV1(`/crm/customers/${customerId}/delivery-locations`),
      ]);
      if (activeCustomerLocationFetchIdRef.current !== customerId) return;
      const billingLocations = (Array.isArray(billingResponse) ? billingResponse : billingResponse?.items || []).map((location: any) => ({
        ...location,
        billing_store_code: location.billing_store_code ?? location.billingStoreCode,
        name: location.name ?? location.locationName,
        address_line1: location.address_line1 ?? location.addressLine1,
        address_line2: location.address_line2 ?? location.addressLine2,
        state_code: location.state_code ?? location.stateCode,
        pincode: location.pincode ?? location.pinCode,
        is_default: location.is_default ?? location.isDefault,
      })) as CustomerBillingLocationDTO[];
      const deliveryLocations = (Array.isArray(deliveryResponse) ? deliveryResponse : deliveryResponse?.items || []).map((location: any) => ({
        ...location,
        store_code: location.store_code ?? location.storeCode,
        location_name: location.location_name ?? location.locationName,
        address_line1: location.address_line1 ?? location.addressLine1,
        address_line2: location.address_line2 ?? location.addressLine2,
        state_code: location.state_code ?? location.stateCode,
        state_name: location.state_name ?? location.stateName ?? location.state ?? "",
        pin_code: location.pin_code ?? location.pincode ?? location.pinCode ?? "",
        is_default: location.is_default ?? location.isDefault,
      })) as CustomerDeliveryLocationDTO[];
      setCustomerBillingLocations(billingLocations);
      setCustomerDeliveryLocations(deliveryLocations);
      setSelectedBillingLocationId(billingLocations.find(location => location.is_default)?.id || (billingLocations.length === 1 ? billingLocations[0].id : ""));
      setSelectedDeliveryLocationId(deliveryLocations.find(location => location.is_default)?.id || (deliveryLocations.length === 1 ? deliveryLocations[0].id : ""));
    } catch (error) {
      setCustomerBillingLocations([]);
      setCustomerDeliveryLocations([]);
      setSelectedBillingLocationId("");
      setSelectedDeliveryLocationId("");
      setBillingLocationFilter("");
      setShippingLocationFilter("");
      setShowBillingAddressDetails(false);
      setShowShippingAddressDetails(false);
      setShowBillingAddressSuggestions(false);
      setShowShippingAddressSuggestions(false);
      setCustomerLocationError(error instanceof Error ? error.message : "Customer address lookup failed.");
    } finally {
      if (activeCustomerLocationFetchIdRef.current === customerId) setIsLoadingCustomerLocations(false);
    }
  };

  const handleCustomerSelection = (nextCustomer: ProPosCustomer, skipReevaluation: boolean = false) => {
    const prevCustomer = customer;
    const enrichedCustomer: ProPosCustomer = {
      ...nextCustomer,
      customerGroup: nextCustomer.customerGroup || nextCustomer.customerGroupId || (nextCustomer.name?.toUpperCase().includes("RELIANCE") ? "RELIANCE" : undefined),
      pricingBasis: nextCustomer.pricingBasis || (nextCustomer.customerGroup === "CG-Corporate" || nextCustomer.customerGroupId === "CG-Corporate" ? "RATE" : "MRP"),
      allowPromotionsOnRate: Boolean(nextCustomer.allowPromotionsOnRate),
    };
    if (SmritiSalesPromotionService.isRelianceCustomer(enrichedCustomer)) {
      SmritiSalesPromotionService.ensureReliance4376Promotion();
    }
    setCustomer(enrichedCustomer);

    // Alt+M Mid-Bill Customer Switch: Re-evaluate promotions and pricing basis across all active cart lines
    const isCustomerSwitch = prevCustomer.id !== enrichedCustomer.id || prevCustomer.code !== enrichedCustomer.code || prevCustomer.pricingBasis !== enrichedCustomer.pricingBasis;
    if (!skipReevaluation && isCustomerSwitch && cartItems.length > 0) {
      const isReliance = SmritiSalesPromotionService.isRelianceCustomer(enrichedCustomer);
      const isRate = enrichedCustomer.pricingBasis === "RATE";
      setCartItems(prevItems => {
        return prevItems.map(it => {
          let baseRate = (isReliance && it.mrp && it.mrp > 0) ? it.mrp : it.unitPrice;
          if (!isReliance) {
            if (isRate) {
              baseRate = it.unitPrice || it.mrp;
            } else {
              baseRate = it.mrp || it.unitPrice;
            }
          }
          const promoRes = SmritiSalesPromotionService.resolveBestItemPromo({
            sku: it.sku,
            barcode: it.barcode,
            brand: it.brand,
            rate: baseRate,
            qty: it.qty,
            customerGroup: enrichedCustomer.customerGroup,
            customerCode: enrichedCustomer.code || enrichedCustomer.id,
            customerName: enrichedCustomer.name,
            pricingBasis: enrichedCustomer.pricingBasis || "MRP",
            allowPromotionsOnRate: enrichedCustomer.allowPromotionsOnRate || false,
            evalDate: new Date()
          });

          const discPct = promoRes.promo ? promoRes.discountPct : 0.00;
          const discAmt = promoRes.promo ? promoRes.discountAmt : 0.00;
          const discCode = promoRes.promo ? promoRes.promoCode : "ILD";
          const finalUnitPrice = (isReliance && it.mrp && it.mrp > 0)
            ? Math.round(it.mrp * (1 - discPct / 100) * 100) / 100
            : baseRate;

          const gst = calculateGST({
            unitPrice: finalUnitPrice,
            quantity: it.qty,
            discountAmount: (isReliance ? 0 : discAmt),
            gstRate: it.taxPct || 5.00,
            isTaxInclusive: it.isTaxInclusive !== undefined ? it.isTaxInclusive : (taxMode === "inclusive"),
            isInterstate: isInterstate,
          });

          return {
            ...it,
            unitPrice: finalUnitPrice,
            discCode,
            discountPct: discPct,
            discountAmt: discAmt,
            promoDescription: promoRes.promoDescription,
            promoBadge: promoRes.promo ? promoRes.promoCode : (isRate ? "RATE" : undefined),
            taxAmt: gst.taxAmount,
            taxableValue: gst.taxableValue,
            cgstAmount: gst.cgstAmount,
            sgstAmount: gst.sgstAmount,
            igstAmount: gst.igstAmount,
            lineTotal: gst.totalAmount,
          };
        });
      });

      void apiFetchV1("/pos/customer-switch-log", {
        method: "POST",
        body: JSON.stringify({
          session_id: shiftId || "SESS-LIVE-01",
          old_customer_id: prevCustomer.id,
          old_customer_name: prevCustomer.name,
          old_customer_group: prevCustomer.customerGroup,
          new_customer_id: enrichedCustomer.id,
          new_customer_name: enrichedCustomer.name,
          new_customer_group: enrichedCustomer.customerGroup,
          line_items_count: cartItems.length,
          cart_subtotal: grossSalesValue,
          promotions_reevaluated: true,
          changed_by: salesStaff || "cashier-1",
        })
      }).catch(() => {});

      onNotification?.(
        "Customer Switched [Alt+M]",
        `Switched to ${enrichedCustomer.name}. Promotional schemes automatically re-evaluated across ${cartItems.length} line(s).`,
        "info"
      );
    }

    void (async () => {
      let resolvedCustomer = enrichedCustomer;
      try {
        const lookupTerms = [enrichedCustomer.code, enrichedCustomer.name].filter(Boolean);
        const responses = await Promise.all(
          lookupTerms.map(term => apiFetchV1<any[]>(`/crm/customers/search?q=${encodeURIComponent(term)}&limit=20`).catch(() => []))
        );
        const candidates = responses.flatMap(response => Array.isArray(response) ? response : []);
        const match = candidates.find(candidate =>
          candidate.code === enrichedCustomer.code || candidate.name === enrichedCustomer.name
        );
        if (match?.id) {
          resolvedCustomer = { ...enrichedCustomer, id: match.id };
          setCustomer(resolvedCustomer);
        }
      } catch {
      }
      void loadCustomerLocations(
        resolvedCustomer.id,
        resolvedCustomer.code === "C01" && resolvedCustomer.name.includes("Walk-in")
      );
    })();
  };

  const openCustomerMaster = () => {
    window.dispatchEvent(new CustomEvent("smriti_navigate_module", { detail: { moduleId: "customer-master" } }));
  };

  useEffect(() => {
    if (!currentRegisterCode) return;
    const normalizedRegisterCode = currentRegisterCode.trim().toLowerCase();
    const billingMatch = customerBillingLocations.find(location => location.billing_store_code?.trim().toLowerCase() === normalizedRegisterCode);
    const deliveryMatch = customerDeliveryLocations.find(location => location.store_code?.trim().toLowerCase() === normalizedRegisterCode);
    if (billingMatch) setSelectedBillingLocationId(previous => previous || billingMatch.id);
    if (deliveryMatch) setSelectedDeliveryLocationId(previous => previous || deliveryMatch.id);
  }, [currentRegisterCode, customerBillingLocations, customerDeliveryLocations]);

  // ─── F2 Universal Lookup Architecture v2 — Screen Registration (Phase B Batch 1) ──
  // Migration status: DONE (verified 2026-09-02).
  // All three legacy screen-level F2 useEffect handlers that existed before
  // Phase A were removed in a prior session. No e.key === "F2" handler exists
  // anywhere in this component.
  //
  // F2 resolution for this screen:
  //   Tier 1 — data-f2-entity="customer" on posCustomerCode + posCustomerName inputs
  //   Tier 3 — defaultEntity: "customer" (fallback for focus outside tagged fields)
  //
  // FieldAdapter: maps LookupResult → ProPosCustomer and calls setCustomer().
  // SmritiCustomerBrowseModal (onClick button) is preserved as a non-F2 consumer.
  useF2Screen({
    screenId: "ProPosBillingTerm",
    defaultEntity: "customer",
    fieldOverrides: new Map([
      ["posCustomerCode", "customer"],
      ["posCustomerName", "customer"],
      ["directStockNo", "variant"],
      ["directBarcode", "item_barcode"]
    ]),
    adapter: (result: LookupResult) => {
      if (result.entity === "customer") {
        const rawRec = (result.record || {}) as Record<string, any>;
        const detectedGroup = (rawRec.customer_group_id as string) || (rawRec.customerGroupId as string) || (rawRec.group_name as string) || (result.displayValue?.toUpperCase().includes("RELIANCE") ? "RELIANCE" : undefined);
        handleCustomerSelection({
          ...customer,
          id: result.id ?? customer.id,
          code: result.returnValue || customer.code,
          name: result.displayValue || customer.name,
          phone: (result.record?.phone as string) ?? customer.phone,
          customerGroup: detectedGroup,
          customerGroupId: detectedGroup,
          loyaltyPoints: (result.record?.loyalty_points as number) ?? customer.loyaltyPoints,
          loyaltyTier: ((result.record?.loyalty_tier as string) as ProPosCustomer["loyaltyTier"]) ?? customer.loyaltyTier,
          creditLimit: (result.record?.credit_limit as number) ?? customer.creditLimit,
          currentBalance: (result.record?.current_balance as number) ?? customer.currentBalance,
        });
        return;
      }
      if (result.entity === "variant" || result.entity === "item_barcode" || result.entity === "item") {
        const rec = (result.record || {}) as Record<string, any>;
        const stockCode = String(result.returnValue || result.displayValue || rec.code || rec.stockNo || "");
        const rate = Number(rec.rate ?? rec.sellingPrice ?? rec.mrp ?? 0);
        setDirectStockNo(stockCode);
        if (rec.barcode) {
          setDirectBarcode(String(rec.barcode));
        }
        if (rec.name || result.displayValue) {
          setDirectDescription(String(rec.name || result.displayValue));
        }
        const meta: AutoPopulateProductResult = {
          id: String(result.id || rec.id || stockCode),
          name: String(rec.name || result.displayValue || stockCode),
          code: stockCode,
          stockNo: stockCode,
          sku: stockCode,
          barcode: String(rec.barcode || stockCode),
          description: String(rec.description || rec.name || result.displayValue || ""),
          sellingPrice: rate,
          mrp: Number(rec.mrp || rate),
          costPrice: Number(rec.costPrice || 0),
          stockQty: Number(rec.stockQty ?? rec.stockQuantity ?? rec.stock ?? 1),
          category: String(rec.category || ""),
          brand: rec.brand ? String(rec.brand) : undefined,
          gstPercentage: Number(rec.gstPercentage ?? rec.gstRate ?? 0),
          hsnCode: String(rec.hsnCode || ""),
          uom: String(rec.uom || "PCS")
        };
        setSelectedProductMeta(meta);

        // Auto-evaluate promotional scheme on F2 item selection
        const bestPromo = SmritiSalesPromotionService.resolveBestItemPromo({
          sku: stockCode,
          barcode: String(rec.barcode || stockCode),
          category: meta.category,
          brand: meta.brand,
          rate: rate || 999,
          qty: parseFloat(directQty) || 1,
          customerGroup: customer.customerGroup || customer.customerGroupId || (customer.name?.toUpperCase().includes("RELIANCE") ? "RELIANCE" : undefined),
          customerCode: customer.code || customer.id,
          evalDate: new Date()
        });
        setDirectPromoResult(bestPromo);
        setIsManualDiscOverride(false);
        if (bestPromo.promo) {
          setDirectDiscCode(bestPromo.promoCode);
          setDirectDiscPct(bestPromo.discountPct.toFixed(2));
          setDirectDiscAmtInput(bestPromo.discountAmt.toFixed(2));
          handleRateOrQtyChange(String(rate || 999), directQty, bestPromo.discountPct.toFixed(2), bestPromo.discountAmt.toFixed(2));
          onNotification?.(
            "Promotion Auto-Applied",
            `Applied ${bestPromo.promoCode} (${bestPromo.discountPct.toFixed(2)}% off, saving ₹${bestPromo.discountAmt.toFixed(2)}).`,
            "info"
          );
        } else {
          setDirectDiscCode("ILD");
          setDirectDiscPct("0.00");
          setDirectDiscAmtInput("0.00");
          handleRateOrQtyChange(String(rate || 999), directQty, "0.00", "0.00");
        }

        directQtyRef.current?.focus();
        return;
      }
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[ProPosBillingTerm][F2] FieldAdapter received unexpected entity:",
          result.entity
        );
      }
    }
  });

  const storeStateCode = "27"; // Maharashtra store default
  const storeProfile = useMemo(() => ({
    storeName: "TATTLY THREADS",
    addressLine1: "Office No. 81, Ibrahim Rehmatullah Road, Beside Jio Gallery, near HP Petrol Pump, Mumbai",
    city: "Mumbai",
    state: "Maharashtra",
    stateCode: storeStateCode,
    gstin: "27AAXFT2508H1ZR",
    phone: "+91 98765 43210",
    pincode: "400003",
  }), []);

  const gstAnalysis = useMemo(() => {
    return parseAndValidateGSTIN(customer.gstin);
  }, [customer.gstin]);

  const isB2B = Boolean(customer.gstin && gstAnalysis.isValid);
  const posStateCode = gstAnalysis.stateCode || customer.stateCode || storeStateCode;
  const posStateName = gstAnalysis.stateName || customer.state || GST_STATE_MAP[posStateCode] || "Home State";
  const isInterstate = storeStateCode !== posStateCode;

  const [salesStaff, setSalesStaff] = useState<string>("SM1");
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(1);
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  const [showTotalsPanel, setShowTotalsPanel] = useState<boolean>(true);

  // --- Statutory Tax Mode: "exclusive" (Default per canonical Tax Invoice TT2026-2027/138: MRP -> Disc% -> Taxable Value -> + GST -> Total) | "inclusive" (MRP Gross) ---
  const [taxMode, setTaxMode] = useState<"exclusive" | "inclusive">("exclusive");

  // --- Detail Group: Accepted Item Details Grid State ---
  const [cartItems, setCartItems] = useState<ProPosCartItem[]>([]);

  // Recompute existing cart items when taxMode or interstate status toggles
  useEffect(() => {
    setCartItems(prev => prev.map(it => {
      const isInc = it.isTaxInclusive !== undefined ? it.isTaxInclusive : (taxMode === "inclusive");
      const gst = calculateGST({
        unitPrice: it.unitPrice,
        quantity: it.qty,
        discountAmount: it.discountAmt,
        gstRate: it.taxPct || 5.00,
        isTaxInclusive: isInc,
        isInterstate: isInterstate,
      });
      return {
        ...it,
        taxAmt: gst.taxAmount,
        taxableValue: gst.taxableValue,
        cgstAmount: gst.cgstAmount,
        sgstAmount: gst.sgstAmount,
        igstAmount: gst.igstAmount,
        lineTotal: gst.totalAmount,
      };
    }));
  }, [taxMode, isInterstate]);

  // --- Detail Group: Direct Entry Grid State ---
  const [directBarcode, setDirectBarcode] = useState<string>("");
  const [directStockNo, setDirectStockNo] = useState<string>("");
  const [directDescription, setDirectDescription] = useState<string>("");
  const [directRate, setDirectRate] = useState<string>("999.00");
  const [directQty, setDirectQty] = useState<string>("1.00");
  const [directDiscCode, setDirectDiscCode] = useState<string>("ILD");
  const [directDiscQty, setDirectDiscQty] = useState<string>("1.00");
  const [directDiscPct, setDirectDiscPct] = useState<string>("0.00");
  const [directDiscAmtInput, setDirectDiscAmtInput] = useState<string>("0.00");
  const [directStaff, setDirectStaff] = useState<string>("SM1");
  const [directPromoResult, setDirectPromoResult] = useState<ItemPromoResolutionResult | null>(null);
  const [isManualDiscOverride, setIsManualDiscOverride] = useState<boolean>(false);

  // Live Item Typeahead / Auto-Populate State
  const [productSuggestions, setProductSuggestions] = useState<AutoPopulateProductResult[]>([]);
  const [isProductSearchOpen, setIsProductSearchOpen] = useState<boolean>(false);
  const [isProductSearching, setIsProductSearching] = useState<boolean>(false);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState<number>(0);
  const [activeSearchField, setActiveSearchField] = useState<"stockNo" | "barcode">("stockNo");
  const [selectedProductMeta, setSelectedProductMeta] = useState<AutoPopulateProductResult | null>(null);

  // Document Remarks & Delivery Instructions State (Desktop POS Parity)
  const [documentRemarks, setDocumentRemarks] = useState<string>("");
  const [deliveryInstructions, setDeliveryInstructions] = useState<string>("");
  const [showItemTagsModal, setShowItemTagsModal] = useState<boolean>(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState<boolean>(false);

  const directStockNoRef = useRef<HTMLInputElement | null>(null);
  const directBarcodeRef = useRef<HTMLInputElement | null>(null);
  const directQtyRef = useRef<HTMLInputElement | null>(null);
  const searchDebounceTimer = useRef<any>(null);

  // Debounced Universal Product Lookup from Barcode or Stock No
  const handleItemLiveSearch = (query: string, fieldType: "stockNo" | "barcode") => {
    setActiveSearchField(fieldType);
    if (!query.trim()) {
      setProductSuggestions([]);
      setIsProductSearchOpen(false);
      return;
    }

    if (searchDebounceTimer.current) {
      clearTimeout(searchDebounceTimer.current);
    }

    setIsProductSearching(true);
    searchDebounceTimer.current = setTimeout(async () => {
      try {
        const results = await searchBackendProducts(query);
        setProductSuggestions(results);
        setIsProductSearchOpen(results.length > 0);
        setSelectedSuggestionIdx(0);
      } catch (err) {
        console.warn("Item search failed", err);
      } finally {
        setIsProductSearching(false);
      }
    }, 150);
  };

  // Select Item from Dropdown / Autocomplete
  const handleSelectProductSuggestion = (item: AutoPopulateProductResult) => {
    setDirectStockNo(item.stockNo || item.code);
    setDirectBarcode(item.barcode);
    setDirectDescription(item.name);
    const unitP = item.sellingPrice ? item.sellingPrice.toFixed(2) : (item.mrp || 999).toFixed(2);
    setSelectedProductMeta(item);
    setIsProductSearchOpen(false);

    // Auto-evaluate promotional scheme on product selection
    const numRate = parseFloat(unitP) || 0;
    const numQty = parseFloat(directQty) || 1;
    const bestPromo = SmritiSalesPromotionService.resolveBestItemPromo({
      sku: item.stockNo || item.code,
      barcode: item.barcode,
      category: item.category,
      brand: item.brand,
      rate: numRate,
      qty: numQty,
      customerGroup: customer.customerGroup || customer.customerGroupId || (customer.name?.toUpperCase().includes("RELIANCE") ? "RELIANCE" : undefined),
      customerCode: customer.code || customer.id,
      evalDate: new Date()
    });
    setDirectPromoResult(bestPromo);
    setIsManualDiscOverride(false);

    if (bestPromo.promo) {
      setDirectDiscCode(bestPromo.promoCode);
      setDirectDiscPct(bestPromo.discountPct.toFixed(2));
      setDirectDiscAmtInput(bestPromo.discountAmt.toFixed(2));
      handleRateOrQtyChange(unitP, directQty, bestPromo.discountPct.toFixed(2), bestPromo.discountAmt.toFixed(2));
      onNotification?.("Promotion Auto-Applied", `${bestPromo.promoCode} applied (${bestPromo.discountPct.toFixed(2)}% off, saving ₹${bestPromo.discountAmt.toFixed(2)}).`, "info");
    } else {
      setDirectDiscCode("ILD");
      setDirectDiscPct("0.00");
      setDirectDiscAmtInput("0.00");
      handleRateOrQtyChange(unitP, directQty, "0.00", "0.00");
      onNotification?.("Item Identified", `${item.name} (Stock No: ${item.stockNo || item.code}, Barcode: ${item.barcode}) loaded.`, "info");
    }
  };

  // Direct Entry Computed Values
  const directValue = useMemo(() => {
    const rate = parseFloat(directRate) || 0;
    const qty = parseFloat(directQty) || 0;
    return rate * qty;
  }, [directRate, directQty]);

  // Helper to determine effective discountable quantity (Disc Qty)
  const getEffectiveDiscQty = (dQtyStr: string, totalQtyStr: string) => {
    if (dQtyStr.trim() !== "") {
      const parsed = parseFloat(dQtyStr);
      return isNaN(parsed) ? 0 : parsed;
    }
    const totalQ = parseFloat(totalQtyStr) || 0;
    return totalQ;
  };

  // Handle Disc Qty input change (triggers Disc.Amt recalculation based on Disc. %)
  const handleDiscQtyChange = (dQtyStr: string) => {
    setDirectDiscQty(dQtyStr);
    const effDiscQ = getEffectiveDiscQty(dQtyStr, directQty);
    const rate = parseFloat(directRate) || 0;
    const pct = parseFloat(directDiscPct) || 0;
    const computedAmt = (rate * effDiscQ * pct) / 100;
    setDirectDiscAmtInput(computedAmt.toFixed(2));
  };

  // Handle Disc % input change (computes and updates Disc.Amt based on Disc Qty)
  const handleDiscPctChange = (pctStr: string) => {
    setDirectDiscPct(pctStr);
    setIsManualDiscOverride(true);
    const pct = parseFloat(pctStr) || 0;
    const rate = parseFloat(directRate) || 0;
    const effDiscQ = getEffectiveDiscQty(directDiscQty, directQty);
    const computedAmt = (rate * effDiscQ * pct) / 100;
    setDirectDiscAmtInput(computedAmt.toFixed(2));
  };

  // Handle Disc.Amt input change (computes and updates Disc. % based on Disc Qty)
  const handleDiscAmtChange = (amtStr: string) => {
    setDirectDiscAmtInput(amtStr);
    setIsManualDiscOverride(true);
    const amt = parseFloat(amtStr) || 0;
    const rate = parseFloat(directRate) || 0;
    const effDiscQ = getEffectiveDiscQty(directDiscQty, directQty);
    const baseVal = rate * effDiscQ;

    if (baseVal > 0) {
      const computedPct = (amt / baseVal) * 100;
      setDirectDiscPct(computedPct.toFixed(2));
    } else {
      setDirectDiscPct("0.00");
    }
  };

  // Handle Rate or Qty changes
  const handleRateOrQtyChange = (
    newRate: string,
    newQty: string,
    overrideDiscPct?: string,
    overrideDiscAmt?: string
  ) => {
    setDirectRate(newRate);
    setDirectQty(newQty);
    const r = parseFloat(newRate) || 0;
    const q = parseFloat(newQty) || 1;

    let dQty = directDiscQty;
    if (directDiscQty === "" || directDiscQty === directQty) {
      dQty = newQty;
      setDirectDiscQty(newQty);
    }
    const effDiscQ = getEffectiveDiscQty(dQty, newQty);

    if (overrideDiscPct !== undefined && overrideDiscAmt !== undefined) {
      setDirectDiscPct(overrideDiscPct);
      setDirectDiscAmtInput(overrideDiscAmt);
      return;
    }

    if (!isManualDiscOverride && (directStockNo.trim() || directBarcode.trim() || selectedProductMeta)) {
      const promoRes = SmritiSalesPromotionService.resolveBestItemPromo({
        sku: directStockNo.trim() || selectedProductMeta?.stockNo || selectedProductMeta?.code,
        barcode: directBarcode.trim() || selectedProductMeta?.barcode,
        category: selectedProductMeta?.category,
        brand: selectedProductMeta?.brand,
        rate: r,
        qty: q,
        customerGroup: customer.customerGroup || customer.customerGroupId || (customer.name?.toUpperCase().includes("RELIANCE") ? "RELIANCE" : undefined),
        customerCode: customer.code || customer.id,
        evalDate: new Date()
      });
      setDirectPromoResult(promoRes);
      if (promoRes.promo) {
        setDirectDiscCode(promoRes.promoCode);
        setDirectDiscPct(promoRes.discountPct.toFixed(2));
        setDirectDiscAmtInput(promoRes.discountAmt.toFixed(2));
        return;
      }
    }

    const pct = parseFloat(directDiscPct) || 0;
    setDirectDiscAmtInput(((r * effDiscQ * pct) / 100).toFixed(2));
  };

  const directDiscAmt = parseFloat(directDiscAmtInput) || 0;
  const directTotal = useMemo(() => {
    return Math.max(0, directValue - directDiscAmt);
  }, [directValue, directDiscAmt]);

  // --- Suspended Bills & Recalls State (F12 Park & Recall with 4-Hour Expiration) ---
  const [suspendedBills, setSuspendedBills] = useState<SuspendedBill[]>(() => {
    return SmritiPosParkedCartService.getActiveParkedCarts().map(SmritiPosParkedCartService.toSuspendedBill);
  });

  // --- Modals State ---
  const [showSettlementModal, setShowSettlementModal] = useState<boolean>(false);
  const [showRecallModal, setShowRecallModal] = useState<boolean>(false);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState<boolean>(false);
  const [showReturnModal, setShowReturnModal] = useState<boolean>(false);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [showCsvImportModal, setShowCsvImportModal] = useState<boolean>(false);
  const [showCustomerBrowseModal, setShowCustomerBrowseModal] = useState<boolean>(false);
  const [showSmritiItemSearchModal, setShowSmritiItemSearchModal] = useState<boolean>(false);
  const [showF6PromoModal, setShowF6PromoModal] = useState<boolean>(false);
  const [showDefinePromosModal, setShowDefinePromosModal] = useState<boolean>(false);
  const [showDefineFactorsModal, setShowDefineFactorsModal] = useState<boolean>(false);
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
  const [showHotkeysModal, setShowHotkeysModal] = useState<boolean>(false);
  const [showReprintModal, setShowReprintModal] = useState<boolean>(false);
  const [showCashMovementsModal, setShowCashMovementsModal] = useState<boolean>(false);
  const [showShiftCloseModal, setShowShiftCloseModal] = useState<boolean>(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState<boolean>(false);
  const overflowMenuRef = useRef<HTMLDivElement | null>(null);
  const [activeShiftId, setActiveShiftId] = useState<string>(shiftId || "");
  const [activeShiftCode, setActiveShiftCode] = useState<string>("REG-01 / SHIFT-CURRENT");

  useEffect(() => {
    if (shiftId) {
      setActiveShiftId(shiftId);
    }
  }, [shiftId]);

  // Fetch active shift on load
  useEffect(() => {
    let isMounted = true;
    const fetchActiveShift = async () => {
      try {
        const [shifts, profiles] = await Promise.all([
          apiFetchV1<any[]>("/pos/shifts/"),
          apiFetchV1<any[]>("/pos/profiles/").catch(() => []),
        ]);
        if (isMounted && shifts && shifts.length > 0) {
          const openShift = shifts.find((s: any) => s.status?.toUpperCase() === "OPEN") || shifts[0];
          setActiveShiftId(openShift.id);
          setActiveShiftCode(openShift.shift_code || `REG-01 / SHIFT-${openShift.id.slice(-6).toUpperCase()}`);
          const register = profiles.find((profile: any) => profile.id === openShift.register_id);
          setCurrentRegisterCode(register?.code || openShift.register_id || "");
        }
      } catch (e) {
        // Fallback default shift ID
      }
    };
    fetchActiveShift();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!showOverflowMenu) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!overflowMenuRef.current?.contains(event.target as Node)) {
        setShowOverflowMenu(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showOverflowMenu]);

  // Last Completed Invoice for Tax Printing
  const [lastCompletedBill, setLastCompletedBill] = useState<{
    billNo: string;
    billDate: string;
    customer: ProPosCustomer;
    salesStaff: string;
    items: ProPosCartItem[];
    subTotal: number;
    discountTotal: number;
    taxTotal: number;
    netPayable: number;
    tenders?: ProPosTenderSplit;
    changeDue?: number;
  } | null>(null);

  // Live timer for header clock
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setCurrentDateTime(`${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Focus direct entry input on mount
  useEffect(() => {
    directStockNoRef.current?.focus();
  }, []);

  // --- Footer Totals Calculations ---
  const totalItemsCount = cartItems.length;
  const totalQuantity = useMemo(() => cartItems.reduce((acc, it) => acc + it.qty, 0), [cartItems]);
  const grossSalesValue = useMemo(() => cartItems.reduce((acc, it) => acc + (it.qty * it.unitPrice), 0), [cartItems]);
  const itemDiscountsTotal = useMemo(() => cartItems.reduce((acc, it) => acc + it.discountAmt, 0), [cartItems]);
  const totalTaxAmount = useMemo(() => {
    return cartItems.reduce((acc, it) => {
      const gst = calculateGST({
        unitPrice: it.unitPrice,
        quantity: it.qty,
        discountAmount: it.discountAmt,
        gstRate: it.taxPct || 5.00,
        isTaxInclusive: it.isTaxInclusive !== undefined ? it.isTaxInclusive : (taxMode === "inclusive"),
        isInterstate: isInterstate,
      });
      return acc + gst.taxAmount;
    }, 0);
  }, [cartItems, taxMode, isInterstate]);
  // Dynamic Sales Factors Calculation (Statutory GST Sec 15 & Price Groups)
  const salesFactorsResult = useMemo(() => {
    const applicableFactors = SmritiSalesFactorService.getFactorsForCustomerAndPriceGroup(
      customer.priceGroupCode,
      customer.id
    );
    const baseSale = cartItems.reduce((acc, it) => acc + (it.unitPrice * it.qty), 0);
    const itemDiscounts = cartItems.reduce((acc, it) => acc + (it.discountAmt || 0), 0);
    
    return SmritiSalesFactorService.calculateBillFactors({
      baseSaleAmount: baseSale,
      itemPromotionalDiscount: itemDiscounts,
      billDiscount: billLevelPromo.discountAmt || 0,
      taxRatePercent: 5.0,
      isTaxInclusive: taxMode === "inclusive",
      factors: applicableFactors
    });
  }, [cartItems, customer.priceGroupCode, customer.id, billLevelPromo, taxMode]);

  const addonGenAmount = useMemo(() => {
    return salesFactorsResult.aboveTaxAddons + salesFactorsResult.belowTaxAddons;
  }, [salesFactorsResult]);

  const dednsGenAmount = useMemo(() => {
    return salesFactorsResult.aboveTaxDeductions + salesFactorsResult.belowTaxDeductions;
  }, [salesFactorsResult]);

  const netPayableAmount = useMemo(() => {
    const raw = cartItems.reduce((acc, it) => {
      const gst = calculateGST({
        unitPrice: it.unitPrice,
        quantity: it.qty,
        discountAmount: it.discountAmt,
        gstRate: it.taxPct || 5.00,
        isTaxInclusive: it.isTaxInclusive !== undefined ? it.isTaxInclusive : (taxMode === "inclusive"),
        isInterstate: isInterstate,
      });
      return acc + gst.totalAmount;
    }, 0);
    const unrounded = Math.max(0, raw - (billLevelPromo.discountAmt || 0) + addonGenAmount - dednsGenAmount);
    return Math.round(unrounded * 100) / 100;
  }, [cartItems, taxMode, isInterstate, billLevelPromo, addonGenAmount, dednsGenAmount]);

  // Real-Time Bill-Level Promotion Auto-Select Engine (Cart Threshold / Highest Discount Wins)
  useEffect(() => {
    if (isManualBillPromoOverride) return;

    if (cartItems.length === 0 || grossSalesValue <= 0) {
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
      subtotal: grossSalesValue,
      itemsCount: totalItemsCount,
      customerGroup: customer.customerGroup || customer.customerGroupId || (customer.name?.toUpperCase().includes("RELIANCE") ? "RELIANCE" : undefined),
      customerCode: customer.code || customer.id,
      customerName: customer.name,
      evalDate: new Date()
    });

    if (res.applied && res.promo) {
      if (billLevelPromo.code !== res.promoCode || Math.abs(billLevelPromo.discountAmt - res.discountAmt) > 0.01) {
        setBillLevelPromo({
          code: res.promoCode,
          description: res.promoDescription,
          discountPct: res.discountPct,
          discountAmt: res.discountAmt,
          calculatedOn: grossSalesValue,
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
  }, [grossSalesValue, totalItemsCount, customer.customerGroup, customer.customerGroupId, customer.name, customer.code, cartItems.length, isManualBillPromoOverride]);

  // Create New Bill (Alt+1)
  const handleNewBill = () => {
    setIsManualBillPromoOverride(false);
    setCartItems([]);
    setCustomer({
      id: "cust-01",
      code: "C01",
      name: "Customer01 (Walk-in)",
      phone: "9876543210",
      loyaltyPoints: 1200,
      loyaltyTier: "Gold",
      creditLimit: 50000,
      currentBalance: 0
    });
    setCustomerBillingLocations([]);
    setCustomerDeliveryLocations([]);
    setSelectedBillingLocationId("");
    setSelectedDeliveryLocationId("");
    setDocumentRemarks("");
    setDeliveryInstructions("");
    setDirectStockNo("");
    setDirectDescription("");
    setDirectQty("1.00");
    setDirectDiscQty("1.00");
    setDirectDiscPct("10.00");
    setDirectDiscAmtInput("99.90");
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
    setActiveActivity("BILLING");
    directStockNoRef.current?.focus();
    onNotification?.("New Bill Created", "Terminal reset for new billing transaction [Alt+1].", "info");
  };

  // Stock No / Barcode Lookup
  const handleDirectStockNoLookup = async (code: string) => {
    if (!code.trim()) return;
    const term = code.trim();

    try {
      const resp = await apiFetchV1<any>(`/products/search?q=${encodeURIComponent(term)}&limit=1`);
      const items = Array.isArray(resp) ? resp : (resp?.items || []);
      if (items.length > 0) {
        const p = items[0];
        const isRate = customer.pricingBasis === "RATE";
        const catMrp = parseFloat(p.mrp || p.price || 0) || 999.00;
        const catSelling = parseFloat(p.selling_price || p.price || catMrp) || catMrp;
        const baseUnit = isRate ? catSelling : catMrp;
        const unitP = baseUnit.toFixed(2);
        const meta: AutoPopulateProductResult = {
          id: p.id || term,
          name: p.product_name || p.name || `Retail Item ${term}`,
          code: p.style_code || p.stock_no || term,
          sku: p.sku || p.barcode || p.code || term,
          stockNo: p.style_code || p.stock_no || term,
          barcode: p.barcode || term,
          description: p.description || p.name || "",
          sellingPrice: catSelling,
          mrp: catMrp,
          costPrice: parseFloat(p.cost_price || 0),
          stockQty: p.stock_quantity || 1,
          category: p.category || "",
          brand: p.brand || "",
          gstPercentage: p.gst_percentage || 5.0,
          hsnCode: p.hsn_code || "",
          uom: p.uom || "PCS"
        };
        setSelectedProductMeta(meta);

        // Auto-evaluate promotional scheme on stockNo/barcode lookup
        const promoRes = SmritiSalesPromotionService.resolveBestItemPromo({
          sku: meta.stockNo,
          barcode: meta.barcode,
          category: meta.category,
          brand: meta.brand,
          rate: parseFloat(unitP),
          qty: parseFloat(directQty) || 1,
          customerGroup: customer.customerGroup || customer.customerGroupId || (customer.name?.toUpperCase().includes("RELIANCE") ? "RELIANCE" : undefined),
          customerCode: customer.code || customer.id,
          pricingBasis: customer.pricingBasis || "MRP",
          allowPromotionsOnRate: customer.allowPromotionsOnRate || false,
          evalDate: new Date()
        });
        setDirectPromoResult(promoRes);
        setIsManualDiscOverride(false);
        if (promoRes.promo) {
          setDirectDiscCode(promoRes.promoCode);
          setDirectDiscPct(promoRes.discountPct.toFixed(2));
          setDirectDiscAmtInput(promoRes.discountAmt.toFixed(2));
          handleRateOrQtyChange(unitP, directQty, promoRes.discountPct.toFixed(2), promoRes.discountAmt.toFixed(2));
          onNotification?.("Promotion Auto-Applied", `${promoRes.promoCode} applied (${promoRes.discountPct.toFixed(2)}% off, saving ₹${promoRes.discountAmt.toFixed(2)}).`, "info");
        } else {
          setDirectDiscCode("ILD");
          setDirectDiscPct("0.00");
          setDirectDiscAmtInput("0.00");
          handleRateOrQtyChange(unitP, directQty, "0.00", "0.00");
        }
        return;
      }
    } catch (e) {
      console.warn("Direct lookup fallback to auto-generated details", e);
    }

    if (!directDescription) {
      setDirectDescription(`regular straight Med Beige`);
    }
  };

  // Keyboard navigation helper for Typeahead dropdown
  const handleItemInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, fieldType: "stockNo" | "barcode") => {
    if (isProductSearchOpen && productSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestionIdx(prev => (prev + 1) % productSuggestions.length);
        return;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestionIdx(prev => (prev - 1 + productSuggestions.length) % productSuggestions.length);
        return;
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = productSuggestions[selectedSuggestionIdx];
        if (selected) {
          handleSelectProductSuggestion(selected);
        } else {
          handleAcceptDirectEntryItem();
        }
        return;
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsProductSearchOpen(false);
        return;
      }
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (productSuggestions.length === 1 && isProductSearchOpen) {
        handleSelectProductSuggestion(productSuggestions[0]);
      } else {
        handleAcceptDirectEntryItem();
      }
    }
  };

  // Accept Item from Direct Entry Grid into Item Details Grid
  const handleAcceptDirectEntryItem = () => {
    if (!directStockNo.trim() && !directBarcode.trim()) {
      onNotification?.("Stock No / Barcode Required", "Please enter a Stock No or scan a barcode.", "error");
      directStockNoRef.current?.focus();
      return;
    }

    if (transactionType === "Credit" && (!customer.code || customer.code === "C01" && customer.name.includes("Walk-in"))) {
      onNotification?.("Customer Required", "Credit billing requires a registered customer account.", "error");
      setShowCustomerBrowseModal(true);
      return;
    }

    const stockCode = directStockNo.trim() || directBarcode.trim();
    const barcodeCode = directBarcode.trim() || selectedProductMeta?.barcode || stockCode;
    const desc = directDescription.trim() || selectedProductMeta?.name || `Retail Item ${stockCode}`;
    const rate = parseFloat(directRate) || selectedProductMeta?.sellingPrice || 999.00;
    const qty = parseFloat(directQty) || 1.00;

    // LSQ (Least Saleable Quantity) Validation Gate (Shoper 9 Parity)
    const lsq = Number((selectedProductMeta as any)?.least_saleable_qty ?? (selectedProductMeta as any)?.leastSaleableQty ?? 1.0);
    if (lsq > 1.0) {
      const rem = qty % lsq;
      const isMultiple = Math.abs(rem) < 0.0001 || Math.abs(rem - lsq) < 0.0001;
      if (qty < lsq || !isMultiple) {
        onNotification?.(
          "LSQ Validation Failure",
          `Item ${stockCode} has a Least Saleable Quantity (LSQ) of ${lsq}. Entered quantity ${qty} must be an exact positive multiple of ${lsq}.`,
          "error"
        );
        directQtyRef.current?.focus();
        return;
      }
    }
    const effDiscQ = getEffectiveDiscQty(directDiscQty, directQty);
    const discPct = parseFloat(directDiscPct) || 0.00;
    const discAmt = parseFloat(directDiscAmtInput) || ((rate * effDiscQ * discPct) / 100);
    const staff = directStaff || salesStaff;
    const gstRate = selectedProductMeta?.gstPercentage || 5.00;
    const itemTaxInclusive = (selectedProductMeta as any)?.isTaxInclusive ?? (selectedProductMeta as any)?.is_tax_inclusive;
    const effTaxInclusive = itemTaxInclusive !== undefined ? Boolean(itemTaxInclusive) : (taxMode === "inclusive");

    // Determine effective promotional scheme for committing item
    let effDiscCode = directDiscCode || "ILD";
    let effDiscPct = discPct;
    let effDiscAmt = discAmt;
    let effPromoDesc: string | undefined = undefined;
    let effPromoBadge: string | undefined = undefined;

    if (!isManualDiscOverride) {
      const bestPromo = SmritiSalesPromotionService.resolveBestItemPromo({
        sku: stockCode,
        barcode: barcodeCode,
        category: selectedProductMeta?.category,
        brand: selectedProductMeta?.brand,
        rate,
        qty,
        customerGroup: customer.customerGroup || customer.customerGroupId || (customer.name?.toUpperCase().includes("RELIANCE") ? "RELIANCE" : undefined),
        customerCode: customer.code || customer.id,
        evalDate: new Date()
      });
      if (bestPromo.promo) {
        effDiscCode = bestPromo.promoCode;
        effDiscPct = bestPromo.discountPct;
        effDiscAmt = bestPromo.discountAmt;
        effPromoDesc = bestPromo.promoDescription;
        effPromoBadge = bestPromo.promoCode;
      }
    }

    const gstCalc = calculateGST({
      unitPrice: rate,
      quantity: qty,
      discountAmount: effDiscAmt,
      gstRate: gstRate,
      isTaxInclusive: effTaxInclusive,
      isInterstate: isInterstate,
    });

    // If currently editing an existing line item (Shoper 9 double-click edit contract)
    if (editingCartItemId) {
      const existingIndex = cartItems.findIndex(it => it.id === editingCartItemId);
      if (existingIndex >= 0) {
        setCartItems(prev => {
          const next = [...prev];
          const cur = next[existingIndex];
          next[existingIndex] = {
            ...cur,
            sku: stockCode,
            barcode: barcodeCode,
            name: desc,
            salesStaff: staff,
            qty: qty,
            unitPrice: rate,
            discCode: effDiscCode,
            discQty: effDiscQ,
            discountPct: effDiscPct,
            discountAmt: effDiscAmt,
            promoDescription: effPromoDesc,
            promoBadge: effPromoBadge,
            taxPct: gstRate,
            taxAmt: gstCalc.taxAmount,
            taxableValue: gstCalc.taxableValue,
            cgstAmount: gstCalc.cgstAmount,
            sgstAmount: gstCalc.sgstAmount,
            igstAmount: gstCalc.igstAmount,
            isTaxInclusive: effTaxInclusive,
            lineTotal: gstCalc.totalAmount
          };
          return next;
        });
        setEditingCartItemId(null);
        onNotification?.("Item Updated", `Line item #${cartItems[existingIndex].itemNo} (${stockCode}) updated successfully.`, "success");
        setDirectStockNo("");
        setDirectBarcode("");
        setDirectDescription("");
        setDirectQty("1.00");
        setDirectDiscQty("1.00");
        setDirectDiscPct("0.00");
        setDirectDiscAmtInput("0.00");
        setDirectDiscCode("ILD");
        setDirectPromoResult(null);
        setIsManualDiscOverride(false);
        setSelectedProductMeta(null);
        setIsProductSearchOpen(false);
        directBarcodeRef.current?.focus();
        return;
      }
    }

    // Duplicate scan aggregation: if item exists, club quantity and dynamically re-evaluate promotions
    const existingIndex = cartItems.findIndex(
      it => (it.sku === stockCode || it.barcode === barcodeCode) &&
            it.unitPrice === rate &&
            it.salesStaff === staff
    );

    if (existingIndex >= 0) {
      setCartItems(prev => {
        const next = [...prev];
        const cur = next[existingIndex];
        const newQty = cur.qty + qty;
        const newDiscQ = (cur.discQty || cur.qty) + effDiscQ;

        // Dynamic re-evaluation of promotional schemes on aggregated quantity (e.g. B2G1 activates at 3 units)
        let lineDiscPct = cur.discountPct;
        let lineDiscAmt = (cur.unitPrice * newDiscQ * cur.discountPct) / 100;
        let lineDiscCode = cur.discCode;
        let linePromoDesc = cur.promoDescription;
        let linePromoBadge = cur.promoBadge;

        if (!isManualDiscOverride) {
          const promoRes = SmritiSalesPromotionService.resolveBestItemPromo({
            sku: cur.sku,
            barcode: cur.barcode,
            category: (cur as any).category || selectedProductMeta?.category,
            brand: cur.brand || selectedProductMeta?.brand,
            rate: cur.unitPrice,
            qty: newQty,
            customerGroup: customer.customerGroup || customer.customerGroupId || (customer.name?.toUpperCase().includes("RELIANCE") ? "RELIANCE" : undefined),
            customerCode: customer.code || customer.id,
            evalDate: new Date()
          });
          if (promoRes.promo) {
            lineDiscPct = promoRes.discountPct;
            lineDiscAmt = promoRes.discountAmt;
            lineDiscCode = promoRes.promoCode;
            linePromoDesc = promoRes.promoDescription;
            linePromoBadge = promoRes.promoCode;
          }
        }

        const updatedTaxInclusive = cur.isTaxInclusive !== undefined ? cur.isTaxInclusive : (taxMode === "inclusive");
        const updatedGst = calculateGST({
          unitPrice: cur.unitPrice,
          quantity: newQty,
          discountAmount: lineDiscAmt,
          gstRate: cur.taxPct || gstRate,
          isTaxInclusive: updatedTaxInclusive,
          isInterstate: isInterstate,
        });
        next[existingIndex] = {
          ...cur,
          qty: newQty,
          discQty: newDiscQ,
          discCode: lineDiscCode,
          discountPct: lineDiscPct,
          discountAmt: lineDiscAmt,
          promoDescription: linePromoDesc,
          promoBadge: linePromoBadge,
          taxAmt: updatedGst.taxAmount,
          taxableValue: updatedGst.taxableValue,
          cgstAmount: updatedGst.cgstAmount,
          sgstAmount: updatedGst.sgstAmount,
          igstAmount: updatedGst.igstAmount,
          isTaxInclusive: updatedTaxInclusive,
          lineTotal: updatedGst.totalAmount
        };
        return next;
      });
      setSelectedRowIndex(existingIndex);
      onNotification?.("Item Clubbed", `Repeated item ${stockCode} clubbed (+${qty.toFixed(2)} qty, Total: ${(cartItems[existingIndex].qty + qty).toFixed(2)}).`, "info");
    } else {
      const newItem: ProPosCartItem = {
        id: `item-${Date.now()}`,
        productId: selectedProductMeta?.id,
        itemNo: cartItems.length + 1,
        sku: stockCode,
        barcode: barcodeCode,
        name: desc,
        size: selectedProductMeta?.size || "32",
        color: selectedProductMeta?.color || "Beige",
        brand: selectedProductMeta?.brand || "SMRITI",
        salesStaff: staff,
        qty: qty,
        mrp: selectedProductMeta?.mrp || rate,
        unitPrice: rate,
        discCode: effDiscCode,
        discQty: effDiscQ,
        discountPct: effDiscPct,
        discountAmt: effDiscAmt,
        promoDescription: effPromoDesc,
        promoBadge: effPromoBadge,
        taxPct: gstRate,
        taxAmt: gstCalc.taxAmount,
        taxableValue: gstCalc.taxableValue,
        cgstAmount: gstCalc.cgstAmount,
        sgstAmount: gstCalc.sgstAmount,
        igstAmount: gstCalc.igstAmount,
        isTaxInclusive: effTaxInclusive,
        lineTotal: gstCalc.totalAmount
      };

      setCartItems(prev => [...prev, newItem]);
      setSelectedRowIndex(cartItems.length);
      onNotification?.("Item Accepted", `${desc} (${stockCode}) accepted (${effDiscQ.toFixed(2)} Disc Qty, ₹${effDiscAmt.toFixed(2)} Disc Amt).`, "success");
    }

    setDirectStockNo("");
    setDirectBarcode("");
    setDirectDescription("");
    setDirectQty("1.00");
    setDirectDiscQty("1.00");
    setDirectDiscPct("0.00");
    setDirectDiscAmtInput("0.00");
    setDirectDiscCode("ILD");
    setDirectPromoResult(null);
    setIsManualDiscOverride(false);
    setSelectedProductMeta(null);
    setIsProductSearchOpen(false);

    if (activeSearchField === "barcode") {
      directBarcodeRef.current?.focus();
    } else {
      directStockNoRef.current?.focus();
    }
  };

  // Import CSV Items callback (Barcode CSV Import Engine)
  const handleCsvImportConfirmed = (items: ResolvedCartItem[]) => {
    // Strictly enforce: Allow ONLY items with a valid product_id verified in the database
    const validDbItems = items.filter(it => it.product_id && it.product_id.trim() !== "");
    const rejectedCount = items.length - validDbItems.length;

    if (validDbItems.length === 0) {
      onNotification?.(
        "Import Blocked",
        "No valid database items found. Only barcodes or SKUs present in the database can be added to billing.",
        "error"
      );
      return;
    }

    const isReliance = SmritiSalesPromotionService.isRelianceCustomer(customer);
    if (isReliance) {
      SmritiSalesPromotionService.ensureReliance4376Promotion();
    }

    const converted: ProPosCartItem[] = validDbItems.map((it, idx) => {
      let discCode = "CSVImp";
      let discPct = it.catalog_mrp > 0
        ? Math.round((it.catalog_mrp - it.effective_selling_price) / it.catalog_mrp * 100 * 100) / 100
        : 0;
      let unitPrice = it.effective_selling_price;
      let promoDesc: string | undefined = undefined;
      let promoBadge: string | undefined = undefined;

      if (isReliance) {
        discCode = "REL_RET_4376";
        discPct = 43.76;
        unitPrice = it.catalog_mrp > 0
          ? Math.round(it.catalog_mrp * (1 - 0.4376) * 100) / 100
          : it.effective_selling_price;
        promoDesc = "Reliance Retail Trade Concession (43.76% on MRP)";
        promoBadge = "43.76% [REL_RET_4376]";
      }

      const discAmt = it.catalog_mrp > 0
        ? Math.round(((it.catalog_mrp * discPct) / 100) * it.quantity * 100) / 100
        : (it.catalog_mrp - unitPrice) * it.quantity;

      const isInc = (it as any).is_tax_inclusive ?? (it as any).isTaxInclusive ?? (taxMode === "inclusive");
      const gst = calculateGST({
        unitPrice: unitPrice,
        quantity: it.quantity,
        discountAmount: 0,
        gstRate: it.gst_rate || 5.00,
        isTaxInclusive: isInc,
        isInterstate: isInterstate,
      });

      return {
        id: `csv-${Date.now()}-${idx}`,
        productId: it.product_id,
        itemNo: cartItems.length + idx + 1,
        sku: it.resolved_sku || it.barcode,
        barcode: it.barcode,
        name: it.resolved_item || it.barcode,
        size: "—",
        color: "—",
        brand: "—",
        salesStaff: salesStaff,
        qty: it.quantity,
        mrp: it.catalog_mrp,
        unitPrice: unitPrice,
        discCode: discCode,
        discQty: it.quantity,
        discountPct: discPct,
        discountAmt: discAmt,
        promoDescription: promoDesc,
        promoBadge: promoBadge,
        taxPct: it.gst_rate,
        taxAmt: gst.taxAmount,
        taxableValue: gst.taxableValue,
        cgstAmount: gst.cgstAmount,
        sgstAmount: gst.sgstAmount,
        hsnCode: it.hsn_code,
        isTaxInclusive: isInc,
        lineTotal: gst.totalAmount,
      };
    });
    setCartItems(prev => [...prev, ...converted]);
    if (rejectedCount > 0) {
      onNotification?.(
        "CSV Imported with Exclusions",
        `${converted.length} item(s) added from database. ${rejectedCount} unverified item(s) were excluded.`,
        "warning"
      );
    } else {
      onNotification?.("CSV Imported", `${converted.length} database-verified item(s) added to bill.`, "success");
    }
  };

  // Remove Item from Grid
  const handleRemoveItem = (id: string) => {
    setCartItems(prev => prev.filter(it => it.id !== id).map((it, idx) => ({ ...it, itemNo: idx + 1 })));
    if (editingCartItemId === id) {
      setEditingCartItemId(null);
    }
  };

  // Enterprise Retail: Double-click row to edit in Direct Entry Grid (Shoper 9 contract)
  const handleRowDoubleClick = (item: ProPosCartItem, idx: number) => {
    setSelectedRowIndex(idx);
    setEditingCartItemId(item.id);
    setDirectStockNo(item.sku);
    setDirectBarcode(item.barcode || item.sku);
    setDirectDescription(item.name);
    setDirectRate(item.unitPrice.toFixed(2));
    setDirectQty(item.qty.toFixed(2));
    setDirectDiscCode(item.discCode || "ILD");
    setDirectDiscQty((item.discQty ?? item.qty).toFixed(2));
    setDirectDiscPct(item.discountPct.toFixed(2));
    setDirectDiscAmtInput(item.discountAmt.toFixed(2));
    setDirectStaff(item.salesStaff || "");
    onNotification?.("Editing Line Item", `Item #${item.itemNo} (${item.sku}) loaded into Direct Entry. Modify and press Enter to save.`, "info");
    directQtyRef.current?.focus();
  };

  // F12 Bill Park & Recall: 4-Hour Auto-Expiration & Postgres Durability
  const handleHoldBill = async () => {
    if (cartItems.length === 0) {
      onNotification?.("Empty Cart", "No items in active cart to park [F12].", "error");
      return;
    }

    try {
      const parked = await SmritiPosParkedCartService.parkCart({
        sessionId: shiftId || "SESS-LIVE-01",
        customer,
        salesStaff,
        items: cartItems,
        totalAmount: netPayableAmount,
        expirationHours: 4,
      });

      const newSuspended = SmritiPosParkedCartService.toSuspendedBill(parked);
      setSuspendedBills(prev => [newSuspended, ...prev.filter(b => b.billNo !== newSuspended.billNo)]);
      setCartItems([]);
      onNotification?.(
        "Cart Parked [F12]",
        `Cart parked as Hold Slip #${parked.holdSlipNumber}. Valid for 4 hours.`,
        "info"
      );
    } catch (err: any) {
      onNotification?.("Park Failed", `Could not park cart: ${err.message}`, "error");
    }
  };

  // F12 Recall Bill
  const handleRecallBill = async (bill: SuspendedBill) => {
    try {
      await SmritiPosParkedCartService.recallCart(bill.billNo);
      setCartItems(bill.items);
      handleCustomerSelection(bill.customer, true); // true = skip switch log on recall
      setSalesStaff(bill.salesStaff);
      setSuspendedBills(prev => prev.filter(b => b.id !== bill.id && b.billNo !== bill.billNo));
      setShowRecallModal(false);
      onNotification?.(
        "Cart Recalled [F12]",
        `Restored Hold Slip #${bill.billNo} to terminal.`,
        "success"
      );
    } catch (err: any) {
      onNotification?.("Recall Failed", err.message || "Failed to recall parked cart.", "error");
    }
  };

  // Settlement Success
  const handleSettlementSuccess = async (tenders: ProPosTenderSplit, changeDue: number) => {
    const generatedBillNo = (billDocPrefix.endsWith("/") || billDocPrefix.endsWith("-"))
      ? `${billDocPrefix}${billDocNumber}`
      : `${billDocPrefix}-${billDocNumber}`;
    const effectiveShiftId = shiftId || activeShiftId;
    if (!effectiveShiftId) {
      onNotification?.("Checkout Blocked", "Open a register shift before finalizing a bill.", "error");
      return;
    }
    if (cartItems.some((item) => !item.productId)) {
      onNotification?.("Checkout Blocked", "Refresh the product selection before finalizing this bill so stock can be tracked.", "error");
      return;
    }

    // Governed System Parameter Checks
    if (tenders.credit > 0 && !smritiSystemParameterService.getBoolean("AllowCreditBilling", false)) {
      onNotification?.("Credit Billing Prohibited", "Credit billing is disabled by System Parameter [AllowCreditBilling].", "error");
      return;
    }

    if (
      (!customer || customer.name === "Walk-in Retail Customer") &&
      smritiSystemParameterService.getBoolean("InBillingCustSelectionCompulsary", false)
    ) {
      onNotification?.("Customer Required", "Customer selection is mandatory for billing per System Parameter [InBillingCustSelectionCompulsary].", "error");
      return;
    }

    const paymentMode = tenders.credit > 0
      ? "CREDIT"
      : tenders.card >= tenders.cash && tenders.card >= tenders.upi
        ? "CARD"
        : tenders.upi > tenders.cash
          ? "UPI"
          : "CASH";

    try {
      const response = await apiFetchV1<{
        invoice_no: string;
        invoice_id: string;
        grand_total: number;
        tax_total: number;
      }>("/pos/checkout", {
        method: "POST",
        headers: { "Idempotency-Key": generatedBillNo },
        body: JSON.stringify({
          invoice_no: generatedBillNo,
          shift_id: effectiveShiftId,
          payment_mode: paymentMode,
          grand_total: netPayableAmount,
          customer_id: (customer.id === "cust-01" || customer.code === "C01" || !customer.id) ? undefined : customer.id,
          customer_name: customer.name,
          remarks: documentRemarks || undefined,
          delivery_instructions: deliveryInstructions || undefined,
          billing_location_id: selectedBillingLocation?.id,
          billing_store_code: selectedBillingLocation?.billing_store_code,
          billing_address: selectedBillingLocation ? formatBillingAddress(selectedBillingLocation) : undefined,
          delivery_location_id: selectedDeliveryLocation?.id,
          delivery_store_code: selectedDeliveryLocation?.store_code,
          delivery_gstin: selectedDeliveryLocation?.delivery_gstin,
          delivery_location_snapshot: selectedDeliveryLocation ? {
            id: selectedDeliveryLocation.id,
            store_code: selectedDeliveryLocation.store_code,
            location_name: selectedDeliveryLocation.location_name,
            site_type: selectedDeliveryLocation.site_type,
            address_line1: selectedDeliveryLocation.address_line1,
            address_line2: selectedDeliveryLocation.address_line2,
            city: selectedDeliveryLocation.city,
            district: selectedDeliveryLocation.district,
            state_code: selectedDeliveryLocation.state_code,
            state_name: selectedDeliveryLocation.state_name,
            pin_code: selectedDeliveryLocation.pin_code,
            delivery_gstin: selectedDeliveryLocation.delivery_gstin,
            contact_person: selectedDeliveryLocation.contact_person,
            contact_phone: selectedDeliveryLocation.contact_phone,
          } : undefined,
          shipping_address: selectedDeliveryLocation ? formatDeliveryAddress(selectedDeliveryLocation) : undefined,
          place_of_supply_code: selectedDeliveryLocation?.state_code || selectedBillingLocation?.state_code,
          items: cartItems.map((item) => ({
            product_id: item.productId as string,
            code: item.sku,
            name: item.name,
            quantity: item.qty,
            price: item.isTaxInclusive ? item.unitPrice : ((item.taxableValue ?? Math.max(item.lineTotal - item.taxAmt, 0)) / item.qty),
            hsn_code: item.hsnCode,
            gst_rate: item.taxPct,
            mrp: item.mrp,
            is_tax_inclusive: item.isTaxInclusive,
            salesperson_id: item.salesStaff || salesStaff,
            salesperson_name: item.salesStaff || salesStaff,
          })),
        }),
      });

      const billRecord = {
        billNo: response.invoice_no,
        billDate: new Date().toISOString().slice(0, 10),
        customer,
        salesStaff,
        items: cartItems,
        subTotal: grossSalesValue,
        discountTotal: itemDiscountsTotal,
        taxTotal: response.tax_total,
        netPayable: response.grand_total,
        tenders,
        changeDue,
      };

      setLastCompletedBill(billRecord);
      setShowSettlementModal(false);
      setShowReceiptModal(true);
      setCartItems([]);
      setBillDocNumber((prev) => (parseInt(prev) + 1).toString());
      onNotification?.("Invoice Finalized", `Invoice ${response.invoice_no} generated successfully!`, "success");
    } catch (error) {
      onNotification?.("Checkout Failed", error instanceof Error ? error.message : "The bill could not be posted.", "error");
    }
  };

  const handlePreviewCurrentBill = () => {
    if (cartItems.length === 0 && !lastCompletedBill) {
      onNotification?.("Empty Bill", "Please add items to cart before previewing bill [Alt+V].", "warning");
      return;
    }
    if (cartItems.length > 0) {
      const previewRecord = {
        billNo: `PREVIEW-${billDocPrefix || "INV"}-${billDocNumber}`,
        billDate: new Date().toISOString().slice(0, 10),
        customer,
        salesStaff,
        items: cartItems,
        subTotal: grossSalesValue,
        discountTotal: itemDiscountsTotal + billLevelPromo.discountAmt,
        taxTotal: totalTaxAmount,
        netPayable: netPayableAmount,
        tenders: {
          cash: netPayableAmount,
          card: 0,
          upi: 0,
          credit: 0,
          giftVoucher: 0,
          loyaltyPointsRedeemed: 0,
          loyaltyAmount: 0,
          creditNote: 0,
        },
        changeDue: 0,
      };
      setLastCompletedBill(previewRecord);
    }
    setShowReceiptModal(true);
  };

  // --- Complete Global POS Keyboard Shortcuts ---
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // Escape: Close open modals
      if (e.key === "Escape") {
        setShowHotkeysModal(false);
        setShowReprintModal(false);
        setShowCustomerBrowseModal(false);
        setShowCsvImportModal(false);
        setShowRecallModal(false);
        setShowCancelModal(false);
        setShowReturnModal(false);
        setShowSettlementModal(false);
        setShowReceiptModal(false);
        setShowLoyaltyModal(false);
        setShowCashMovementsModal(false);
        setShowShiftCloseModal(false);
        setShowOverflowMenu(false);
        setShowDeliveryModal(false);
        setShowItemTagsModal(false);
        return;
      }

      if (e.altKey && e.key === "1") {
        e.preventDefault();
        handleNewBill();
      } else if (e.altKey && e.key === "2") {
        e.preventDefault();
        setShowCancelModal(true);
      } else if (e.altKey && e.key === "3") {
        e.preventDefault();
        setActiveActivity("RETURN");
        setShowReturnModal(true);
      } else if (e.altKey && e.key === "5") {
        e.preventDefault();
        setActiveActivity("RETURN_BLIND");
        setShowReturnModal(true);
      } else if (e.altKey && e.key === "6") {
        e.preventDefault();
        if (lastCompletedBill) {
          setShowReceiptModal(true);
          onNotification?.("Reprinting Last Receipt [Alt+6]", `Showing receipt for bill ${lastCompletedBill.billNo}`, "info");
        } else {
          setShowReprintModal(true);
        }
      } else if (e.key === "F12") {
        e.preventDefault();
        if (cartItems.length > 0) {
          handleHoldBill();
        } else {
          setShowRecallModal(true);
        }
      } else if (e.altKey && (e.key === "m" || e.key === "M")) {
        e.preventDefault();
        setShowCustomerBrowseModal(true);
      } else if (e.altKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        setShowCashMovementsModal(true);
      } else if (e.altKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        setShowShiftCloseModal(true);
      } else if (e.altKey && (e.key === "h" || e.key === "H")) {
        e.preventDefault();
        setShowHotkeysModal(prev => !prev);
      } else if (e.altKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        handleHoldBill();
      } else if (e.altKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        setShowRecallModal(true);
      } else if (e.altKey && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        setShowCsvImportModal(true);
      } else if (e.key === "F6") {
        e.preventDefault();
        setShowF6PromoModal(true);
      } else if (e.altKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        setShowDefinePromosModal(true);
      } else if (e.altKey && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        handlePreviewCurrentBill();
      } else if (e.altKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        setShowDefineFactorsModal(true);
      // F2 handled by F2DispatcherProvider (F2 Universal Lookup Architecture v2).
      // This screen registers via useF2Screen() above. No screen-level F2 handler.
      } else if (e.key === "F7") {
        e.preventDefault();
        if (cartItems.length > 0) {
          handleSettlementSuccess({
            cash: netPayableAmount,
            card: 0,
            upi: 0,
            credit: 0,
            giftVoucher: 0,
            loyaltyPointsRedeemed: 0,
            loyaltyAmount: 0,
            creditNote: 0
          }, 0);
        } else {
          onNotification?.("Empty Bill", "Please add items to bill before exact cash settlement [F7].", "error");
        }
      } else if (e.key === "F8") {
        e.preventDefault();
        if (cartItems.length > 0) {
          setShowSettlementModal(true);
        } else {
          onNotification?.("Empty Bill", "Please add items to bill before opening settlement [F8].", "error");
        }
      } else if (e.key === "F9") {
        e.preventDefault();
        setShowTotalsPanel(prev => !prev);
        onNotification?.("Totals Toggled", "Bill totals panel toggled [F9].", "info");
      } else if (e.key === "F10") {
        e.preventDefault();
        if (cartItems.length > 0) {
          setShowSettlementModal(true);
        } else {
          onNotification?.("Empty Bill", "Please add items to bill before print & pay [F10].", "error");
        }
      } else if (e.key === "F11" || e.key === "F1") {
        e.preventDefault();
        directBarcodeRef.current?.focus();
      } else if (e.ctrlKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        if (selectedRowIndex >= 0 && selectedRowIndex < cartItems.length) {
          const toRemove = cartItems[selectedRowIndex];
          handleRemoveItem(toRemove.id);
          setSelectedRowIndex(-1);
          if (editingCartItemId === toRemove.id) {
            setEditingCartItemId(null);
          }
          onNotification?.("Item Deleted", `Removed line item #${toRemove.itemNo} (${toRemove.sku}) [Ctrl+D].`, "success");
        } else {
          onNotification?.("Delete Item", "Select an item from the table before pressing Ctrl+D.", "error");
        }
      } else if (e.key === "Escape") {
        if (editingCartItemId) {
          e.preventDefault();
          setEditingCartItemId(null);
          setDirectStockNo("");
          setDirectBarcode("");
          setDirectDescription("");
          setDirectQty("1.00");
          setDirectDiscQty("1.00");
          setDirectDiscPct("0.00");
          setDirectDiscAmtInput("0.00");
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
          setSelectedRowIndex(prev => Math.min(cartItems.length - 1, prev + 1));
        }
      }
    };

    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => window.removeEventListener("keydown", handleGlobalShortcuts);
  }, [cartItems, netPayableAmount, customer, salesStaff, billDocPrefix, billDocNumber, selectedRowIndex, editingCartItemId, lastCompletedBill]);

  const emptyRowsCount = Math.max(0, 10 - cartItems.length);

  return (
    <div className="h-full flex flex-col bg-[#f8f9fa] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] overflow-hidden font-sans select-none">
      
      {/* ========================================================================= */}
      {/* 0. POS ACTIVITIES TOOLBAR RIBBON (Alt+1, Alt+2, Alt+3, Alt+5, Alt+6, etc.) */}
      {/* ===========================================      {/* ========================================================================= */}
      {/* 0. POS ACTIVITIES TOOLBAR & SUB-BAR (Alt+1..6, F9, F7, F10, Alt+H)        */}
      {/* ========================================================================= */}
      <div className="bg-[#edeae1] dark:bg-[#131b2e] px-3 py-1.5 border-b border-[#c4c5d5] dark:border-[#444653] flex flex-wrap items-center justify-between gap-2 shrink-0">
        
        {/* Left: Standard Desktop POS Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleNewBill}
            className={`px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 shadow-2xs border ${
              activeActivity === "BILLING"
                ? "bg-[#00288e] text-white border-[#00288e]"
                : "bg-white dark:bg-[#2d3133] border-[#c4c5d5] text-[#191c1d] dark:text-white hover:bg-[#f3f4f5]"
            }`}
            title="Create a new bill [Alt+1]"
          >
            <FilePlus size={13} />
            <span>New</span>
            <kbd className="text-[10px] opacity-80 font-mono">[Alt+1]</kbd>
          </button>

          <button
            type="button"
            onClick={() => setShowCancelModal(true)}
            className="px-2.5 py-1 bg-white dark:bg-[#2d3133] border border-[#ba1a1a]/40 text-[#ba1a1a] hover:bg-[#ffdad6]/50 rounded text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            title="Void / cancel a bill [Alt+2]"
          >
            <ShieldAlert size={13} />
            <span>Void</span>
            <kbd className="text-[10px] opacity-80 font-mono">[Alt+2]</kbd>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveActivity("RETURN");
              setShowReturnModal(true);
            }}
            className="px-2.5 py-1 bg-white dark:bg-[#2d3133] border border-[#c4c5d5] hover:bg-[#f3f4f5] rounded text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            title="Record sales return with reference [Alt+3]"
          >
            <RotateCcw size={13} />
            <span>Return</span>
            <kbd className="text-[10px] opacity-80 font-mono text-[#00288e]">[Alt+3]</kbd>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveActivity("RETURN_BLIND");
              setShowReturnModal(true);
            }}
            className="px-2.5 py-1 bg-white dark:bg-[#2d3133] border border-[#c4c5d5] hover:bg-[#f3f4f5] rounded text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            title="Record sales return without reference [Alt+5]"
          >
            <RotateCcw size={13} />
            <span>Rtn.W/o ref.</span>
            <kbd className="text-[10px] opacity-80 font-mono text-[#00288e]">[Alt+5]</kbd>
          </button>

          <button
            type="button"
            onClick={() => setShowReprintModal(true)}
            className="px-2.5 py-1 bg-white dark:bg-[#2d3133] border border-[#c4c5d5] hover:bg-[#f3f4f5] rounded text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            title="Reprint a bill or sales return document [Alt+6]"
          >
            <Printer size={13} />
            <span>Reprint</span>
            <kbd className="text-[10px] opacity-80 font-mono text-[#00288e]">[Alt+6]</kbd>
          </button>

          <button
            type="button"
            onClick={() => setShowDefinePrefixModal(true)}
            className="px-2.5 py-1 bg-white dark:bg-[#2d3133] border border-[#c4c5d5] hover:bg-[#f3f4f5] rounded text-xs font-bold transition flex items-center gap-1 shadow-2xs text-[#444653] dark:text-[#bec6e0]"
            title="Alter Bill Series Prefix (Setup > General > Bill Prefix)"
          >
            <span>Alter Prefix</span>
          </button>
        </div>

        {/* Right: Date Time Stamp & Primary Settlement Actions */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-semibold text-[#565e74] dark:text-[#bec6e0] px-2 py-0.5 bg-white/70 dark:bg-[#191c1e] rounded border border-[#c4c5d5] dark:border-[#444653]">
            {currentDateTime}
          </span>

          <button
            type="button"
            onClick={() => setShowTotalsPanel(prev => !prev)}
            className={`px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1 shadow-2xs border ${
              showTotalsPanel
                ? "bg-[#dde1ff] text-[#00288e] border-[#00288e]"
                : "bg-white dark:bg-[#2d3133] border-[#c4c5d5] text-[#565e74]"
            }`}
            title="Toggle Bill Totals Summary [F9]"
          >
            <Calculator size={13} />
            <span>Total</span>
            <kbd className="text-[10px] font-mono">[F9]</kbd>
          </button>

          <button
            type="button"
            disabled={cartItems.length === 0}
            onClick={() => {
              handleSettlementSuccess({
                cash: netPayableAmount,
                card: 0,
                upi: 0,
                credit: 0,
                giftVoucher: 0,
                loyaltyPointsRedeemed: 0,
                loyaltyAmount: 0,
                creditNote: 0
              }, 0);
            }}
            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-bold transition flex items-center gap-1 shadow-2xs disabled:opacity-40"
            title="Instant Exact Cash Settlement [F7]"
          >
            <span>Exact Cash</span>
            <kbd className="text-[10px] font-mono opacity-80">[F7]</kbd>
          </button>

          <button
            type="button"
            disabled={cartItems.length === 0}
            onClick={() => setShowSettlementModal(true)}
            className="px-3 py-1 bg-[#00288e] hover:bg-[#1e40af] text-white rounded text-xs font-bold transition flex items-center gap-1.5 shadow-2xs disabled:opacity-40"
            title="Open Settlement Tender Dialog [F10]"
          >
            <span>Settlement</span>
            <kbd className="text-[10px] font-mono opacity-80">[F10]</kbd>
          </button>

          <button
            type="button"
            onClick={() => setShowHotkeysModal(true)}
            className="px-2 py-1 bg-white dark:bg-[#2d3133] border border-[#c4c5d5] hover:bg-[#f3f4f5] text-[#565e74] dark:text-[#bec6e0] rounded text-xs font-bold transition flex items-center gap-1 shadow-2xs"
            title="List Hotkeys Reference [Alt+H]"
          >
            <HelpCircle size={13} />
            <span>List Hotkeys</span>
          </button>
        </div>

      </div>

      {/* Sub-Header Ribbon: Mode Title & Quick Utilities */}
      <div className="bg-[#465a7e] dark:bg-[#1a233b] text-white px-3 py-1 flex items-center justify-between text-xs font-bold shrink-0">
        <div className="flex items-center gap-2">
          <span className="uppercase tracking-wider">Billing</span>
          {activeActivity !== "BILLING" && (
            <span className="bg-amber-400 text-black px-1.5 py-0.2 rounded text-[10px]">
              MODE: {activeActivity}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCsvImportModal(true)}
            className="px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded text-[11px] font-bold flex items-center gap-1 transition"
            title="Import from Barcode Scanner or CSV [Alt+I]"
          >
            <FileSpreadsheet size={12} />
            <span>Import</span>
            <kbd className="text-[9px] font-mono opacity-70">[Alt+I]</kbd>
          </button>

          <button
            type="button"
            onClick={() => {
              if (cartItems.length > 0) {
                handleHoldBill();
              } else {
                setShowRecallModal(true);
              }
            }}
            className={`px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 transition ${
              suspendedBills.length > 0 ? "bg-amber-400 text-black" : "bg-white/10 hover:bg-white/20"
            }`}
            title="Park or Recall Suspended Bill [F12]"
          >
            <History size={12} />
            <span>Recall ({suspendedBills.length})</span>
            <kbd className="text-[9px] font-mono opacity-70">[F12]</kbd>
          </button>

          <button
            type="button"
            onClick={() => setShowCashMovementsModal(true)}
            className="px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded text-[11px] font-bold flex items-center gap-1 transition"
            title="Mid-shift Cash Movements [Alt+D]"
          >
            <Vault size={12} />
            <span>Cash Move</span>
            <kbd className="text-[9px] font-mono opacity-70">[Alt+D]</kbd>
          </button>

          <button
            type="button"
            onClick={() => setShowShiftCloseModal(true)}
            className="px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded text-[11px] font-bold flex items-center gap-1 transition"
            title="Perform Shift Close & Z-Report [Alt+Z]"
          >
            <Lock size={12} />
            <span>Shift Close</span>
            <kbd className="text-[9px] font-mono opacity-70">[Alt+Z]</kbd>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. HEADER GROUP: Bill Type, Tx Type, Doc Prefix, Customer, Staff (Clean)  */}
      {/* ========================================================================= */}
      <section className="bg-white dark:bg-[#131b2e] px-4 py-2 border-b border-[#c4c5d5] dark:border-[#444653] shrink-0 flex flex-wrap gap-3 items-center shadow-2xs text-xs">
        
        {/* Bill Type */}
        <div className="flex items-center gap-1.5">
          <label className="font-bold text-[#444653] dark:text-[#bec6e0] whitespace-nowrap">
            Bill Type
          </label>
          <select
            value={billType}
            onChange={e => setBillType(e.target.value as any)}
            className="border border-[#c4c5d5] dark:border-[#444653] rounded px-2 h-7 text-xs font-semibold bg-white dark:bg-[#191c1e] outline-none focus:border-[#00288e]"
          >
            <option value="Product">Product</option>
            <option value="Service">Service</option>
          </select>
        </div>

        {/* Transaction Type */}
        <div className="flex items-center gap-1.5">
          <select
            value={transactionType}
            onChange={e => setTransactionType(e.target.value as any)}
            className={`border rounded px-2 h-7 text-xs font-bold outline-none ${
              transactionType === "Credit"
                ? "bg-[#dde1ff] text-[#00288e] border-[#00288e]"
                : "bg-blue-600 text-white border-blue-700"
            }`}
          >
            <option value="Cash">Cash</option>
            <option value="Credit">Credit</option>
          </select>
        </div>

        {/* Bill Prefix & Doc Number */}
        <div className="flex items-center gap-1">
          <input
            type="text"
            readOnly
            value={billDocPrefix}
            title="Bill Document Prefix"
            className="w-14 border border-[#c4c5d5] dark:border-[#444653] rounded px-1.5 h-7 text-xs font-mono font-bold bg-[#f3f4f5] dark:bg-[#2d3133] text-center outline-none"
          />
          <input
            type="text"
            name="posDocNumber"
            aria-label="Document Number"
            value={billDocNumber}
            onChange={e => setBillDocNumber(e.target.value)}
            className="w-20 border border-[#c4c5d5] dark:border-[#444653] rounded px-2 h-7 text-xs font-mono font-bold bg-white dark:bg-[#191c1e] text-[#00288e] dark:text-[#a8b8ff] text-right outline-none focus:border-[#00288e]"
          />
        </div>

        {/* Customer Input & Add Button */}
        <div className="flex items-center gap-1.5 flex-1 min-w-[280px]">
          <label className="font-bold text-[#444653] dark:text-[#bec6e0] whitespace-nowrap">
            Customer
          </label>
          <div className="flex-1 flex items-center gap-1">
            <input
              type="text"
              name="posCustomerName"
              aria-label="Customer Name"
              data-f2-entity="customer"
              value={customer.name}
              onChange={e => setCustomer(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Search or enter customer phone / name..."
              className="flex-1 border border-[#c4c5d5] dark:border-[#444653] rounded px-2.5 h-7 text-xs font-semibold bg-white dark:bg-[#191c1e] outline-none focus:border-[#00288e]"
            />
            <button
              type="button"
              onClick={() => setShowCustomerBrowseModal(true)}
              className="px-2.5 h-7 bg-white dark:bg-[#2d3133] hover:bg-[#f3f4f5] border border-[#c4c5d5] dark:border-[#444653] rounded text-xs font-bold transition flex items-center gap-1 shadow-2xs text-[#00288e] dark:text-[#a8b8ff]"
              title="Add or Browse Customer [F2]"
            >
              <UserPlus size={12} />
              <span>Add</span>
            </button>
          </div>
        </div>

        {/* Sales Staff */}
        <div className="flex items-center gap-1.5">
          <label className="font-bold text-[#444653] dark:text-[#bec6e0] whitespace-nowrap">
            Sales Staff
          </label>
          <select
            value={salesStaff}
            onChange={e => {
              setSalesStaff(e.target.value);
              setDirectStaff(e.target.value);
            }}
            className="border border-[#c4c5d5] dark:border-[#444653] rounded px-2 h-7 text-xs font-semibold bg-white dark:bg-[#191c1e] outline-none focus:border-[#00288e]"
          >
            <option value="SM1">SM1</option>
            <option value="SM2">SM2</option>
            <option value="SM3">SM3</option>
          </select>
        </div>

      </section>

      {/* ========================================================================= */}
      {/* 2. DETAIL GROUP: Item Details Grid (Top) + Direct Entry Grid (Bottom)     */}
      {/* ========================================================================= */}
      <main className="flex-1 flex overflow-hidden p-2 gap-2">
        
        {/* Left Side: Dual-Grid Workspace (Top Grid + Bottom Docked Strip) */}
        <div className="flex-1 bg-white dark:bg-[#131b2e] border border-[#c4c5d5] dark:border-[#444653] rounded-lg overflow-hidden flex flex-col shadow-xs">
          
          {/* Top: Item Details Grid (10 Rows) */}
          <div className="overflow-auto flex-1 bg-white dark:bg-[#131b2e]">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap min-w-[1020px]">
              <thead className="bg-[#edeae1] dark:bg-[#252836] sticky top-0 z-10 border-b border-[#c4c5d5] dark:border-[#444653] text-[11px] font-bold text-[#444653] dark:text-[#bec6e0]">
                <tr className="h-7">
                  <th className="px-2 border-r border-[#c4c5d5] dark:border-[#444653] w-12 text-center">S No.</th>
                  <th className="px-2.5 border-r border-[#c4c5d5] dark:border-[#444653] w-36">Stock No</th>
                  <th className="px-2.5 border-r border-[#c4c5d5] dark:border-[#444653]">Item Description</th>
                  <th className="px-2 border-r border-[#c4c5d5] dark:border-[#444653] text-right w-20">Rate</th>
                  <th className="px-2 border-r border-[#c4c5d5] dark:border-[#444653] text-right w-16">Qty</th>
                  <th className="px-2 border-r border-[#c4c5d5] dark:border-[#444653] text-right w-20">Value</th>
                  <th className="px-2 border-r border-[#c4c5d5] dark:border-[#444653] text-center w-20">Disc Code</th>
                  <th className="px-2 border-r border-[#c4c5d5] dark:border-[#444653] text-right w-16">Disc Qty</th>
                  <th className="px-2 border-r border-[#c4c5d5] dark:border-[#444653] text-right w-16">Disc. %</th>
                  <th className="px-2 border-r border-[#c4c5d5] dark:border-[#444653] text-right w-20">Disc.Amt</th>
                  <th className="px-2.5 border-r border-[#c4c5d5] dark:border-[#444653] text-right w-24 font-bold text-[#191c1d] dark:text-white">Total</th>
                  <th className="px-2 border-r border-[#c4c5d5] dark:border-[#444653] text-center w-20">SalesStaff</th>
                  <th className="px-1.5 text-center w-8">Del</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eceef0] dark:divide-[#2d3133] font-mono text-[11px]">
                {cartItems.map((item, idx) => {
                  const isSelected = selectedRowIndex === idx;
                  const isEditing = editingCartItemId === item.id;
                  const lineValue = item.unitPrice * item.qty;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedRowIndex(idx)}
                      onDoubleClick={() => handleRowDoubleClick(item, idx)}
                      className={`h-7 cursor-pointer transition ${
                        isEditing
                          ? "bg-blue-100 dark:bg-blue-950 font-bold ring-2 ring-blue-500"
                          : isSelected
                          ? "bg-[#ffffcc] dark:bg-[#3a3a1a] text-black dark:text-yellow-200 font-semibold"
                          : "hover:bg-[#f8f9fa] dark:hover:bg-[#1d222e]"
                      }`}
                      title="Double-click to edit line in Direct Entry (Ctrl+D to delete)"
                    >
                      <td className="px-2 border-r border-[#c4c5d5] dark:border-[#444653] text-center font-bold">
                        {idx + 1}
                      </td>
                      <td className="px-2.5 border-r border-[#c4c5d5] dark:border-[#444653] font-bold">
                        {item.sku}
                      </td>
                      <td className="px-2.5 border-r border-[#c4c5d5] dark:border-[#444653] font-sans font-medium truncate max-w-[280px]">
                        {item.name}
                      </td>
                      <td className="px-2 border-r border-[#c4c5d5] dark:border-[#444653] text-right">
                        {item.unitPrice.toFixed(2)}
                      </td>
                      <td className="px-2 border-r border-[#c4c5d5] dark:border-[#444653] text-right font-bold">
                        {item.qty.toFixed(2)}
                      </td>
                      <td className="px-2 border-r border-[#c4c5d5] dark:border-[#444653] text-right">
                        {lineValue.toFixed(2)}
                      </td>
                      <td className="px-2 border-r border-[#c4c5d5] dark:border-[#444653] text-center font-sans">
                        {item.discCode || "ILD"}
                      </td>
                      <td className="px-2 border-r border-[#c4c5d5] dark:border-[#444653] text-right">
                        {(item.discQty ?? item.qty).toFixed(2)}
                      </td>
                      <td className="px-2 border-r border-[#c4c5d5] dark:border-[#444653] text-right">
                        {item.discountPct.toFixed(2)}%
                      </td>
                      <td className="px-2 border-r border-[#c4c5d5] dark:border-[#444653] text-right text-red-600">
                        {item.discountAmt.toFixed(2)}
                      </td>
                      <td className="px-2.5 border-r border-[#c4c5d5] dark:border-[#444653] text-right font-bold">
                        {item.lineTotal.toFixed(2)}
                      </td>
                      <td className="px-2 border-r border-[#c4c5d5] dark:border-[#444653] text-center font-sans">
                        {item.salesStaff || salesStaff}
                      </td>
                      <td className="px-1.5 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveItem(item.id);
                          }}
                          className="text-[#ba1a1a] hover:bg-[#ffdad6] p-0.5 rounded transition"
                          title="Remove Row"
                        >
                          <Trash2 size={11} />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Empty Filler Rows to maintain 10-Row Grid Visual Stability */}
                {Array.from({ length: emptyRowsCount }).map((_, i) => (
                  <tr key={`empty-${i}`} className="h-7 border-b border-[#eceef0] dark:border-[#2d3133]">
                    <td className="border-r border-[#c4c5d5] dark:border-[#444653] text-center text-gray-400 text-[10px]">{cartItems.length + i + 1}</td>
                    <td className="border-r border-[#c4c5d5] dark:border-[#444653]"></td>
                    <td className="border-r border-[#c4c5d5] dark:border-[#444653]"></td>
                    <td className="border-r border-[#c4c5d5] dark:border-[#444653]"></td>
                    <td className="border-r border-[#c4c5d5] dark:border-[#444653]"></td>
                    <td className="border-r border-[#c4c5d5] dark:border-[#444653]"></td>
                    <td className="border-r border-[#c4c5d5] dark:border-[#444653]"></td>
                    <td className="border-r border-[#c4c5d5] dark:border-[#444653]"></td>
                    <td className="border-r border-[#c4c5d5] dark:border-[#444653]"></td>
                    <td className="border-r border-[#c4c5d5] dark:border-[#444653]"></td>
                    <td className="border-r border-[#c4c5d5] dark:border-[#444653]"></td>
                    <td className="border-r border-[#c4c5d5] dark:border-[#444653]"></td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom Dock: Direct Entry Input Strip (Column Aligned) */}
          <div className="border-t-2 border-[#a4a5b5] dark:border-[#5c5d6c] bg-[#edeae1] dark:bg-[#252836] shrink-0">
            <div className="flex items-center text-xs p-1 gap-1 min-w-[1020px]">
              {/* S No. */}
              <div className="w-12 text-center font-bold text-xs font-mono text-[#00288e] dark:text-[#a8b8ff]">
                {editingCartItemId ? `E#${cartItems.findIndex(i => i.id === editingCartItemId) + 1}` : cartItems.length + 1}
              </div>

              {/* Stock No / Barcode with Typeahead */}
              <div className="w-36 relative">
                <input
                  ref={directBarcodeRef}
                  id="directBarcode"
                  data-f2-entity="item_barcode"
                  type="text"
                  value={directBarcode || directStockNo}
                  onChange={e => {
                    setDirectBarcode(e.target.value);
                    setDirectStockNo(e.target.value);
                    handleItemLiveSearch(e.target.value, "barcode");
                  }}
                  onKeyDown={e => handleItemInputKeyDown(e, "barcode")}
                  placeholder="Stock No / Scan [F2]..."
                  className="w-full h-7 px-2 bg-white dark:bg-[#131b2e] border border-[#a4a5b5] dark:border-[#5c5d6c] rounded text-xs font-mono font-bold outline-none focus:border-[#00288e] focus:ring-1 focus:ring-[#00288e]"
                />
                {activeSearchField === "barcode" && (
                  <SmritiItemTypeaheadDropdown
                    isOpen={isProductSearchOpen}
                    items={productSuggestions}
                    selectedIndex={selectedSuggestionIdx}
                    onSelect={handleSelectProductSuggestion}
                    onClose={() => setIsProductSearchOpen(false)}
                    isLoading={isProductSearching}
                    searchFieldType="barcode"
                    anchorRef={directBarcodeRef}
                  />
                )}
              </div>

              {/* Item Description */}
              <div className="flex-1">
                <input
                  type="text"
                  value={directDescription}
                  onChange={e => setDirectDescription(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAcceptDirectEntryItem()}
                  placeholder="Item Description..."
                  className="w-full h-7 px-2 bg-white dark:bg-[#131b2e] border border-[#a4a5b5] dark:border-[#5c5d6c] rounded text-xs font-sans outline-none focus:border-[#00288e]"
                />
              </div>

              {/* Rate */}
              <div className="w-20">
                <input
                  type="text"
                  value={directRate}
                  onChange={e => {
                    const clean = e.target.value.trim();
                    if (clean.length >= 8 && /^\d+$/.test(clean)) {
                      setDirectBarcode(clean);
                      handleItemLiveSearch(clean, "barcode");
                      onNotification?.("Barcode Intercepted", `Barcode ${clean} scanned into Rate was redirected to Barcode field.`, "info");
                      directBarcodeRef.current?.focus();
                      return;
                    }
                    handleRateOrQtyChange(e.target.value, directQty);
                  }}
                  onKeyDown={e => e.key === "Enter" && handleAcceptDirectEntryItem()}
                  className="w-full h-7 px-1.5 bg-white dark:bg-[#131b2e] border border-[#a4a5b5] dark:border-[#5c5d6c] rounded text-xs font-mono font-bold text-right outline-none focus:border-[#00288e]"
                />
              </div>

              {/* Qty */}
              <div className="w-16">
                <input
                  ref={directQtyRef}
                  type="text"
                  value={directQty}
                  onChange={e => {
                    const clean = e.target.value.trim();
                    if (clean.length >= 8 && /^\d+$/.test(clean)) {
                      setDirectBarcode(clean);
                      handleItemLiveSearch(clean, "barcode");
                      onNotification?.("Barcode Intercepted", `Barcode ${clean} scanned into Qty was redirected to Barcode field.`, "info");
                      directBarcodeRef.current?.focus();
                      return;
                    }
                    handleRateOrQtyChange(directRate, e.target.value);
                  }}
                  onKeyDown={e => e.key === "Enter" && handleAcceptDirectEntryItem()}
                  className="w-full h-7 px-1.5 bg-white dark:bg-[#131b2e] border border-[#a4a5b5] dark:border-[#5c5d6c] rounded text-xs font-mono font-bold text-right outline-none focus:border-[#00288e]"
                />
              </div>

              {/* Value */}
              <div className="w-20">
                <input
                  type="text"
                  readOnly
                  value={directValue.toFixed(2)}
                  className="w-full h-7 px-1.5 bg-[#e4e1d7] dark:bg-[#1d202d] border border-[#a4a5b5] dark:border-[#5c5d6c] rounded text-xs font-mono text-right text-gray-700 dark:text-gray-300 outline-none"
                />
              </div>

              {/* Disc Code */}
              <div className="w-20">
                <select
                  value={directDiscCode}
                  onChange={e => {
                    setDirectDiscCode(e.target.value);
                    setIsManualDiscOverride(true);
                  }}
                  className="w-full h-7 px-1 bg-white dark:bg-[#131b2e] border border-[#a4a5b5] dark:border-[#5c5d6c] rounded text-[11px] font-bold outline-none focus:border-[#00288e]"
                >
                  <option value="ILD">ILD</option>
                  <option value="B2G1">B2G1</option>
                  <option value="SCHEME">SCHEME</option>
                  <option value="NONE">NONE</option>
                  {directPromoResult?.promo && !["ILD", "B2G1", "SCHEME", "NONE"].includes(directPromoResult.promoCode) && (
                    <option value={directPromoResult.promoCode}>{directPromoResult.promoCode}</option>
                  )}
                </select>
              </div>

              {/* Disc Qty */}
              <div className="w-16">
                <input
                  type="text"
                  value={directDiscQty}
                  onChange={e => handleDiscQtyChange(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAcceptDirectEntryItem()}
                  placeholder="Disc Qty"
                  className="w-full h-7 px-1.5 bg-white dark:bg-[#131b2e] border border-[#a4a5b5] dark:border-[#5c5d6c] rounded text-xs font-mono font-bold text-right outline-none"
                />
              </div>

              {/* Disc % */}
              <div className="w-16">
                <input
                  type="text"
                  value={directDiscPct}
                  onChange={e => handleDiscPctChange(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAcceptDirectEntryItem()}
                  placeholder="%"
                  className="w-full h-7 px-1 bg-white dark:bg-[#131b2e] border border-[#a4a5b5] dark:border-[#5c5d6c] rounded text-xs font-mono font-bold text-right outline-none focus:border-[#00288e]"
                />
              </div>

              {/* Disc.Amt */}
              <div className="w-20">
                <input
                  type="text"
                  value={directDiscAmtInput}
                  onChange={e => handleDiscAmtChange(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAcceptDirectEntryItem()}
                  placeholder="₹ Amt"
                  className="w-full h-7 px-1 bg-white dark:bg-[#131b2e] border border-[#00288e] rounded text-xs font-mono font-bold text-right text-[#ba1a1a] outline-none"
                />
              </div>

              {/* Total */}
              <div className="w-24">
                <input
                  type="text"
                  readOnly
                  value={directTotal.toFixed(2)}
                  className="w-full h-7 px-1.5 bg-[#e4e1d7] dark:bg-[#1d202d] border border-[#a4a5b5] dark:border-[#5c5d6c] rounded text-xs font-mono font-bold text-right text-[#191c1d] dark:text-white outline-none"
                />
              </div>

              {/* SalesStaff */}
              <div className="w-20">
                <select
                  value={directStaff}
                  onChange={e => setDirectStaff(e.target.value)}
                  className="w-full h-7 px-1 bg-white dark:bg-[#131b2e] border border-[#a4a5b5] dark:border-[#5c5d6c] rounded text-[11px] font-bold outline-none"
                >
                  <option value="SM1">SM1</option>
                  <option value="SM2">SM2</option>
                  <option value="SM3">SM3</option>
                </select>
              </div>

              {/* Accept Action */}
              <div className="w-8 flex items-center justify-center">
                <button
                  type="button"
                  onClick={handleAcceptDirectEntryItem}
                  className="h-7 w-7 bg-[#00288e] hover:bg-[#1e40af] text-white rounded flex items-center justify-center shadow-xs transition active:scale-95"
                  title="Accept Item [Enter]"
                >
                  <CornerDownLeft size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Document Remarks & Action Buttons (Desktop Parity) */}
          <div className="bg-[#edeae1] dark:bg-[#191c1e] px-3 py-1.5 border-t border-[#c4c5d5] dark:border-[#444653] flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex-1 flex items-center gap-2 min-w-[280px]">
              <label htmlFor="docRemarks" className="text-xs font-bold whitespace-nowrap text-[#444653] dark:text-[#bec6e0]">
                Document Remarks
              </label>
              <input
                id="docRemarks"
                type="text"
                value={documentRemarks}
                onChange={e => setDocumentRemarks(e.target.value)}
                placeholder="Remarks / notes for invoice..."
                className="flex-1 h-7 px-2.5 bg-white dark:bg-[#131b2e] border border-[#a4a5b5] dark:border-[#5c5d6c] rounded text-xs outline-none focus:border-[#00288e]"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowItemTagsModal(true)}
                className="px-3 py-1 bg-white dark:bg-[#2d3133] hover:bg-[#f3f4f5] dark:hover:bg-[#383d42] border border-[#c4c5d5] dark:border-[#444653] rounded text-xs font-semibold text-[#191c1e] dark:text-white transition shadow-2xs"
                title="View/Inspect Item Serial & Batch Tags"
              >
                Show Item Tags
              </button>
              <button
                type="button"
                onClick={() => setShowDeliveryModal(true)}
                className={`px-3 py-1 rounded text-xs font-semibold transition shadow-2xs border ${
                  selectedDeliveryLocation || selectedBillingLocation
                    ? "bg-[#dde1ff] text-[#00288e] border-[#00288e] font-bold"
                    : "bg-white dark:bg-[#2d3133] hover:bg-[#f3f4f5] dark:hover:bg-[#383d42] border border-[#c4c5d5] dark:border-[#444653] text-[#191c1e] dark:text-white"
                }`}
                title="Configure B2B Delivery Instructions & Customer Locations"
              >
                Delivery Instructions
                {(selectedDeliveryLocation || selectedBillingLocation) && " ✓"}
              </button>
            </div>
          </div>

        </div>

        {/* Right Side: Exclusive Net Values Summary Panel (Shoper 9 Parity, Toggle with F9) */}
        {showTotalsPanel && (
          <div className="w-60 bg-white dark:bg-[#131b2e] border border-[#c4c5d5] dark:border-[#444653] rounded-lg p-2.5 flex flex-col gap-1.5 shrink-0 shadow-xs relative">
            
            {/* Collapse Arrow Tab */}
            <button
              type="button"
              onClick={() => setShowTotalsPanel(false)}
              className="absolute -left-3 top-2.5 bg-[#465a7e] text-white rounded-l p-0.5 shadow-md hover:bg-[#364867] transition"
              title="Collapse Summary Panel [F9]"
            >
              <ChevronRight size={14} />
            </button>

            <div className="flex justify-between items-center pb-1.5 border-b border-[#c4c5d5] dark:border-[#444653]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">
                Description
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">
                Net Values
              </span>
            </div>

            <div className="space-y-1 font-mono text-xs">
              <div className="flex justify-between items-center">
                <span className="bg-[#f3f4f5] dark:bg-[#2d3133] px-1.5 py-0.5 rounded text-[10px] font-bold text-[#565e74]">
                  Sales
                </span>
                <span className="font-bold text-[#191c1d] dark:text-white">
                  ₹{grossSalesValue.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="bg-[#f3f4f5] dark:bg-[#2d3133] px-1.5 py-0.5 rounded text-[10px] font-bold text-[#ba1a1a]">
                  Item Lvl. Discount
                </span>
                <span className="font-bold text-[#ba1a1a]">
                  -₹{itemDiscountsTotal.toFixed(2)}
                </span>
              </div>

              <div
                className="flex justify-between items-center cursor-pointer hover:bg-[#f3f4f5] dark:hover:bg-[#2d3133] px-1 rounded transition-colors"
                onClick={() => setShowF6PromoModal(true)}
                title="Click to view/override Promotional Discounts (F6)"
              >
                <span className="bg-[#fef2f2] dark:bg-[#7f1d1d]/30 px-1.5 py-0.5 rounded text-[10px] font-bold text-[#ba1a1a] flex items-center gap-1">
                  <span>Bill Discount</span>
                  <span className="font-mono text-[8px] bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 px-1 rounded">F6</span>
                </span>
                <span className="font-bold text-[#ba1a1a]">
                  -₹{(billLevelPromo.discountAmt || 0).toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="bg-[#e8edff] dark:bg-[#1a233b] px-1.5 py-0.5 rounded text-[10px] font-bold text-[#00288e] dark:text-[#a8b8ff]">
                  Total Tax
                </span>
                <span className="font-bold text-[#00288e] dark:text-[#a8b8ff]">
                  ₹{totalTaxAmount.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center cursor-pointer hover:bg-[#f3f4f5] dark:hover:bg-[#2d3133] px-1 rounded transition-colors" onClick={() => setShowDefineFactorsModal(true)} title="Click to view/define Sales Factors (Alt+S)">
                <span className="bg-[#f3f4f5] dark:bg-[#2d3133] px-1.5 py-0.5 rounded text-[10px] font-bold text-[#565e74] flex items-center gap-1">
                  <span>Total Addons</span>
                  <span className="font-mono text-[8px] bg-primary/10 text-primary px-1 rounded">Alt+S</span>
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  ₹{addonGenAmount.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center pb-1 border-b border-[#eceef0] dark:border-[#444653] cursor-pointer hover:bg-[#f3f4f5] dark:hover:bg-[#2d3133] px-1 rounded transition-colors" onClick={() => setShowDefineFactorsModal(true)} title="Click to view/define Sales Factors (Alt+S)">
                <span className="bg-[#f3f4f5] dark:bg-[#2d3133] px-1.5 py-0.5 rounded text-[10px] font-bold text-[#ba1a1a] flex items-center gap-1">
                  <span>Total Deductions</span>
                  <span className="font-mono text-[8px] bg-rose-500/10 text-rose-600 px-1 rounded">Alt+S</span>
                </span>
                <span className="font-bold text-[#ba1a1a]">
                  -₹{dednsGenAmount.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-[#565e74]">
                  Round Off
                </span>
                <span className="font-bold text-[#191c1d] dark:text-white">
                  ₹0.00
                </span>
              </div>

              <div className="flex justify-between items-center pt-1.5 border-t border-[#c4c5d5] dark:border-[#444653] text-sm font-bold text-[#00288e] dark:text-[#a8b8ff]">
                <span>Net Amount</span>
                <span className="text-base font-bold">₹{netPayableAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ========================================================================= */}
      {/* 3. FOOTER GROUP: 9-Box Dashboard Ribbon + Status Bar                      */}
      {/* ========================================================================= */}
      <footer className="bg-white dark:bg-[#131b2e] border-t border-[#c4c5d5] dark:border-[#444653] shadow-lg flex flex-col shrink-0">
        
        {/* Shoper 9 Parity: 9 Metric Summary Boxes */}
        <div className="grid grid-cols-3 md:grid-cols-9 bg-[#555e68] dark:bg-[#1e293b] text-white divide-x divide-white/20 text-center">
          
          <div className="flex flex-col py-1.5 px-1">
            <span className="text-[9px] uppercase tracking-wider opacity-80">No. of Items</span>
            <span className="text-sm font-mono font-bold">{totalItemsCount}</span>
          </div>

          <div className="flex flex-col py-1.5 px-1">
            <span className="text-[9px] uppercase tracking-wider opacity-80">Total Qty.</span>
            <span className="text-sm font-mono font-bold">{totalQuantity.toFixed(2)}</span>
          </div>

          <div className="flex flex-col py-1.5 px-1">
            <span className="text-[9px] uppercase tracking-wider opacity-80">Sales Value</span>
            <span className="text-sm font-mono font-bold">₹{grossSalesValue.toFixed(2)}</span>
          </div>

          <div className="flex flex-col py-1.5 px-1">
            <span className="text-[9px] uppercase tracking-wider opacity-80">Item Lvl. Discount</span>
            <span className="text-sm font-mono font-bold">-₹{itemDiscountsTotal.toFixed(2)}</span>
          </div>

          <div
            onClick={() => setShowF6PromoModal(true)}
            className="flex flex-col py-1.5 px-1 cursor-pointer hover:bg-white/10 transition"
            title="Promotional Bill Discounts [F6]"
          >
            <span className="text-[9px] uppercase tracking-wider opacity-80">Bill Discount</span>
            <span className="text-sm font-mono font-bold">-₹{(billLevelPromo.discountAmt || 0).toFixed(2)}</span>
          </div>

          <div className="flex flex-col py-1.5 px-1">
            <span className="text-[9px] uppercase tracking-wider opacity-80">Total Tax</span>
            <span className="text-sm font-mono font-bold">₹{totalTaxAmount.toFixed(2)}</span>
          </div>

          <div className="flex flex-col py-1.5 px-1">
            <span className="text-[9px] uppercase tracking-wider opacity-80">Total Addons</span>
            <span className="text-sm font-mono font-bold">₹{addonGenAmount.toFixed(2)}</span>
          </div>

          <div className="flex flex-col py-1.5 px-1">
            <span className="text-[9px] uppercase tracking-wider opacity-80">Total Deductions</span>
            <span className="text-sm font-mono font-bold">-₹{dednsGenAmount.toFixed(2)}</span>
          </div>

          <div className="flex flex-col py-1.5 px-1 bg-[#00288e] border-l-2 border-amber-400">
            <span className="text-[9px] uppercase tracking-wider opacity-90 font-bold">Net Amount</span>
            <span className="text-base font-mono font-bold tracking-tight">₹{netPayableAmount.toFixed(2)}</span>
          </div>

        </div>

        {/* Bottom Status Bar */}
        <div className="bg-[#edeae1] dark:bg-[#191c1e] px-3 py-1 flex items-center justify-between text-[11px] font-sans border-t border-[#c4c5d5] dark:border-[#444653]">
          <div className="flex items-center gap-2">
            <span className="bg-yellow-300 dark:bg-yellow-600 text-black px-1.5 py-0.2 rounded font-bold font-mono text-[10px]">
              Ready....
            </span>
            {selectedProductMeta && (
              <span className="text-[#00288e] dark:text-[#a8b8ff] font-semibold">
                Item: {selectedProductMeta.stockNo || selectedProductMeta.sku} | Stock: {selectedProductMeta.stockQty} {selectedProductMeta.uom} | MRP: ₹{selectedProductMeta.mrp.toFixed(2)}
              </span>
            )}
          </div>
          <div className="text-[#565e74] dark:text-[#bec6e0] font-mono text-[10px] hidden md:flex items-center gap-3">
            <span>[Alt+1: New | Alt+2: Void | Alt+3: Return | Alt+6: Reprint | F7: Cash | F10: Settle | F12: Park | Esc: Cancel]</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-bold">Shift: {activeShiftId || "REG-01 (Active)"}</span>
          </div>
        </div>

      </footer>

      {/* ========================================================================= */}
      {/* 4. MODALS & POPUPS (Customer Browse, CSV Import, Recall, Void, Settle)    */}
      {/* ========================================================================= */}
      {showHotkeysModal && (
        <SmritiProPosHotkeysDlg
          onClose={() => setShowHotkeysModal(false)}
        />
      )}

      {showReprintModal && (
        <SmritiProPosReprintDlg
          onReprintBill={(docType, docNo) => {
            onNotification?.("Document Reprinted", `${docType} #${docNo} sent to thermal printer.`, "success");
          }}
          onClose={() => setShowReprintModal(false)}
        />
      )}

      {showCustomerBrowseModal && (
        <SmritiCustomerBrowseModal
          onSelectCustomer={(c) => {
            handleCustomerSelection(c);
            onNotification?.("Customer Selected", `${c.name} (${c.code}) loaded.`, "success");
          }}
          onClose={() => setShowCustomerBrowseModal(false)}
        />
      )}

      <BarcodeCSVImportModal
        isOpen={showCsvImportModal}
        onClose={() => setShowCsvImportModal(false)}
        customer={customer}
        onImportConfirmed={handleCsvImportConfirmed}
      />

      {showSettlementModal && (
        <SmritiPosSettlement
          netAmount={netPayableAmount}
          customer={customer}
          onSettle={handleSettlementSuccess}
          onClose={() => setShowSettlementModal(false)}
        />
      )}

      {showRecallModal && (
        <SmritiProPosRecallDlg
          suspendedBills={suspendedBills}
          onRecallBill={handleRecallBill}
          onDeleteSuspendedBill={(id) => setSuspendedBills(prev => prev.filter(b => b.id !== id))}
          onClose={() => setShowRecallModal(false)}
        />
      )}

      {showCancelModal && (
        <SmritiProPosCancelDlg
          onCancelBill={(rec) => {
            onNotification?.("Invoice Cancelled", `Bill ${rec.billNo} voided successfully.`, "info");
          }}
          onClose={() => setShowCancelModal(false)}
        />
      )}

      {showLoyaltyModal && (
        <SmritiLoyaltyLookupDlgpModal
          currentCustomer={customer}
          onSelectCustomer={(c) => handleCustomerSelection(c)}
          onApplyLoyaltyPoints={(pts, amt) => {
            onNotification?.("Loyalty Redeemed", `${pts} points (₹${amt}) applied to transaction.`, "success");
          }}
          onClose={() => setShowLoyaltyModal(false)}
        />
      )}

      {showReturnModal && (
        <SmritiProPosSalesReturnModal
          onProcessReturn={(ret) => {
            onNotification?.("Return Processed", `Credit Note for ₹${ret.totalRefund.toFixed(2)} generated.`, "success");
          }}
          onClose={() => setShowReturnModal(false)}
        />
      )}

      {showReceiptModal && lastCompletedBill && (
        <SmritiProPosTaxInvoiceReceipt
          billNo={lastCompletedBill.billNo}
          billDate={lastCompletedBill.billDate}
          customer={lastCompletedBill.customer}
          salesStaff={lastCompletedBill.salesStaff}
          items={lastCompletedBill.items}
          subTotal={lastCompletedBill.subTotal}
          discountTotal={lastCompletedBill.discountTotal}
          taxTotal={lastCompletedBill.taxTotal}
          netPayable={lastCompletedBill.netPayable}
          tenders={lastCompletedBill.tenders}
          changeDue={lastCompletedBill.changeDue}
          storeProfile={storeProfile}
          defaultFormat="a4"
          onClose={() => setShowReceiptModal(false)}
        />
      )}

      {showCashMovementsModal && (
        <SmritiProPosCashMovementsModal
          shiftId={activeShiftId}
          onSuccess={(mov) => {
            onNotification?.(
              "Movement Recorded",
              `${mov.type === "CASH_DROP" ? "Cash Drop" : "Till Expense"} of ₹${mov.amount.toFixed(2)} posted.`,
              "success"
            );
          }}
          onClose={() => setShowCashMovementsModal(false)}
          onNotification={onNotification}
        />
      )}

      {showShiftCloseModal && (
        <SmritiProPosShiftCloseModal
          shiftId={activeShiftId}
          onShiftClosed={(zRep) => {
            onNotification?.(
              "Register Closed",
              `Shift ${zRep.shift_code || activeShiftId} successfully closed and reconciled.`,
              "success"
            );
          }}
          onClose={() => setShowShiftCloseModal(false)}
          onNotification={onNotification}
        />
      )}
      {/* SMRITI F2 Advanced Item Search Modal */}
      <SmritiF2AdvancedItemSearch
        isOpen={showSmritiItemSearchModal}
        initialSearchQuery={directStockNo || directDescription || directBarcode}
        onSelectProduct={(item: SmritiF2SelectedItem) => {
          setDirectStockNo(item.stockNo);
          setDirectBarcode(item.barcode || item.stockNo);
          setDirectDescription(item.name);
          handleRateOrQtyChange(String(item.rate || item.mrp || 0), directQty);
          setSelectedProductMeta({
            id: item.stockNo,
            name: item.name,
            code: item.stockNo,
            stockNo: item.stockNo,
            sku: item.stockNo,
            barcode: item.barcode || item.stockNo,
            description: item.name,
            sellingPrice: item.rate,
            mrp: item.mrp,
            costPrice: 0,
            stockQty: item.stock || 1,
            category: item.category || "",
            brand: item.brand || undefined,
            gstPercentage: item.gstRate || 0,
            hsnCode: "",
            uom: "PCS"
          });
          setShowSmritiItemSearchModal(false);
          directQtyRef.current?.focus();
        }}
        onClose={() => setShowSmritiItemSearchModal(false)}
      />

      {/* SMRITI F6 Promotional Discounts Modal */}
      <SmritiF6PromotionalDiscountsModal
        isOpen={showF6PromoModal}
        onClose={() => setShowF6PromoModal(false)}
        items={cartItems}
        subtotal={grossSalesValue}
        billLevelPromo={billLevelPromo}
        onApplyPromos={(updatedItems, updatedBillPromo) => {
          setCartItems(updatedItems);
          setBillLevelPromo(updatedBillPromo);
          setIsManualBillPromoOverride(true);
          onNotification?.("Promotions Applied", `Applied ${updatedBillPromo.code} bill discount and updated line item promos.`, "success");
        }}
        onNotification={onNotification}
      />

      {/* SMRITI Define Sales Promotions Catalogue Modal */}
      <SmritiDefineSalesPromotionsModal
        isOpen={showDefinePromosModal}
        onClose={() => setShowDefinePromosModal(false)}
        onNotification={onNotification}
      />

      {/* SMRITI Define Sales Factors & Customer Price Groups Modal */}
      <SmritiDefineSalesFactorsModal
        isOpen={showDefineFactorsModal}
        onClose={() => setShowDefineFactorsModal(false)}
        onNotification={onNotification}
      />

      {/* SMRITI Shoper 9 Parity: Define Bill Prefix Management Studio Modal */}
      <SmritiDefineBillPrefixModal
        isOpen={showDefinePrefixModal}
        onClose={() => setShowDefinePrefixModal(false)}
        onSaved={() => {
          let txType = transactionType === "Cash" ? "SALES_CASH" : "SALES_CREDIT";
          if (activeActivity === "RETURN" || activeActivity === "RETURN_BLIND") {
            txType = "SALES_RETURN";
          }
          void SmritiBillPrefixService.resolveActivePrefix({
            transactionType: txType,
            terminalId: "COMMON",
            billType
          }).then(res => {
            setPrefixResolveResult(res);
            setBillDocPrefix(res.prefix);
            setBillDocNumber(res.formattedDocNo);
          });
        }}
        terminalId="COMMON"
        companyCode="SMRITI"
      />

      {/* SMRITI Delivery Instructions & Customer Locations Modal */}
      {showDeliveryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] rounded-xl shadow-2xl border border-[#c4c5d5] dark:border-[#444653] max-w-xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#c4c5d5] dark:border-[#444653]">
              <div className="flex items-center gap-2">
                <Truck size={18} className="text-[#00288e] dark:text-[#a8b8ff]" />
                <h3 className="font-bold text-sm">Delivery Instructions &amp; Locations</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDeliveryModal(false)}
                className="p-1 rounded-lg hover:bg-[#f3f4f5] dark:hover:bg-[#2d3133]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-[#f8f9fa] dark:bg-[#131b2e] p-3 rounded-lg border border-[#c4c5d5] dark:border-[#444653] flex justify-between items-center">
                <div>
                  <div className="font-bold">{customer.name} ({customer.code})</div>
                  <div className="text-[11px] text-[#565e74] dark:text-[#bec6e0]">{customer.phone} {customer.gstin ? `| GSTIN: ${customer.gstin}` : ""}</div>
                </div>
                <button
                  type="button"
                  onClick={openCustomerMaster}
                  className="text-[11px] font-bold text-[#00288e] dark:text-[#a8b8ff] hover:underline"
                >
                  Manage Addresses →
                </button>
              </div>

              {/* Bill To Location */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#444653] dark:text-[#bec6e0]">
                  Bill To Location
                </label>
                <select
                  value={selectedBillingLocationId}
                  onChange={e => setSelectedBillingLocationId(e.target.value)}
                  className="w-full h-8 px-2 border border-[#c4c5d5] dark:border-[#444653] rounded bg-white dark:bg-[#191c1e] text-xs font-semibold outline-none"
                >
                  <option value="">Default Billing Address</option>
                  {customerBillingLocations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      [{loc.billing_store_code}] {loc.name} — {formatLocationTail(loc.city, loc.state)}
                    </option>
                  ))}
                </select>
                {selectedBillingLocation && (
                  <p className="text-[11px] text-[#565e74] dark:text-[#bec6e0] pl-1 font-mono">
                    {formatBillingAddress(selectedBillingLocation)}
                  </p>
                )}
              </div>

              {/* Ship To / Delivery Location */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#444653] dark:text-[#bec6e0]">
                  Ship To / Delivery Destination
                </label>
                <select
                  value={selectedDeliveryLocationId}
                  onChange={e => setSelectedDeliveryLocationId(e.target.value)}
                  className="w-full h-8 px-2 border border-[#c4c5d5] dark:border-[#444653] rounded bg-white dark:bg-[#191c1e] text-xs font-semibold outline-none"
                >
                  <option value="">Default Counter Delivery (Store Pickup)</option>
                  {customerDeliveryLocations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      [{loc.store_code}] {loc.location_name} — {formatLocationTail(loc.city, loc.state_name)}
                    </option>
                  ))}
                </select>
                {selectedDeliveryLocation && (
                  <p className="text-[11px] text-[#565e74] dark:text-[#bec6e0] pl-1 font-mono">
                    {formatDeliveryAddress(selectedDeliveryLocation)}
                  </p>
                )}
              </div>

              {/* Delivery Instructions */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#444653] dark:text-[#bec6e0]">
                  Special Delivery Instructions
                </label>
                <textarea
                  rows={2}
                  value={deliveryInstructions}
                  onChange={e => setDeliveryInstructions(e.target.value)}
                  placeholder="e.g. Deliver between 3-5 PM, call upon arrival..."
                  className="w-full p-2 border border-[#c4c5d5] dark:border-[#444653] rounded bg-white dark:bg-[#191c1e] text-xs outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#c4c5d5] dark:border-[#444653]">
              <button
                type="button"
                onClick={() => setShowDeliveryModal(false)}
                className="px-4 py-1.5 bg-[#00288e] text-white rounded text-xs font-bold hover:bg-[#1e40af] transition"
              >
                Save &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMRITI Item Serial & Batch Tags Modal */}
      {showItemTagsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] rounded-xl shadow-2xl border border-[#c4c5d5] dark:border-[#444653] max-w-lg w-full p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#c4c5d5] dark:border-[#444653]">
              <div className="flex items-center gap-2">
                <Barcode size={18} className="text-[#00288e] dark:text-[#a8b8ff]" />
                <h3 className="font-bold text-sm">Item Serial &amp; Batch Tags</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowItemTagsModal(false)}
                className="p-1 rounded-lg hover:bg-[#f3f4f5] dark:hover:bg-[#2d3133]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              {cartItems.length === 0 ? (
                <p className="text-gray-500 py-4 text-center">No items in bill yet. Scan items to view serial/batch tags.</p>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-1 divide-y divide-gray-100 dark:divide-gray-800">
                  {cartItems.map((item, idx) => (
                    <div key={item.id} className="pt-1.5 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold">#{idx + 1} {item.sku}</span> - {item.name}
                        <div className="text-[10px] text-gray-500">Qty: {item.qty} | HSN: {item.hsnCode || "N/A"} {item.brand ? `| Brand: ${item.brand}` : ""}</div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                        {item.barcode || item.sku}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end pt-2 border-t border-[#c4c5d5] dark:border-[#444653]">
              <button
                type="button"
                onClick={() => setShowItemTagsModal(false)}
                className="px-4 py-1.5 bg-[#00288e] text-white rounded text-xs font-bold hover:bg-[#1e40af]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmritiProPosBillingTerminal;

