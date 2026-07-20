/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 2.1.3
 * Created      : 2026-07-10
 * Modified     : 2026-07-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Product, POSProfile, Shift, Bill, Customer, CustomerGroup } from "../types";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import { getCustomers, getCustomerGroups, updateCustomerOutstanding } from "../services/customerStore.ts";
import { checkCreditStatus } from "../services/customerPolicyEngine.ts";
import { apiFetchV1 } from "../lib/apiFetchV1";
import { useTerminalShortcuts } from "./terminal/KeyboardEngine";

// Types for Advanced Billing
export interface AdvancedCustomer {
  type: "Registered" | "Unregistered";
  name: string;
  mobile: string;
  email: string;
  gstin: string;
  companyName: string;
  membershipId: string;
  billingAddress: string;
  shippingAddress: string;
  isShippingDifferent: boolean;
}

export interface ItemDiscountState {
  percentage: number;
  flat: number;
  promo: number;
  scheme: number;
  salesperson: number;
}

export interface ItemBillingDetails {
  product: Product;
  quantity: number;
  hsnCode: string;
  isTaxInclusive: boolean;
  gstRate: number; // e.g. 18 for 18%
  discounts: ItemDiscountState;
  salespersonId: string;
}

interface AdvancedBillingEngineProps {
  cart: { product: Product; quantity: number }[];
  onClearCart: () => void;
  activeShift: Shift | null;
  activeProfile: POSProfile | null;
  onCheckoutSuccess: (bill: any) => void;
  onNotification: (title: string, msg: string, type: "success" | "error") => void;
  onClose: () => void;
}

// Dummy databases for demonstration and real matching
const COUPONS_DB = [
  { code: "SMRITI10", type: "percent" as const, value: 10, minPurchase: 1000, desc: "10% Off on minimum purchase of ₹1,000" },
  { code: "SAVE500", type: "flat" as const, value: 500, minPurchase: 3000, desc: "Flat ₹500 Off on minimum purchase of ₹3,000" },
  { code: "FESTIVE25", type: "percent" as const, value: 25, minPurchase: 2000, desc: "25% Festive Discount on minimum purchase of ₹2,000" }
];

const GIFT_CARDS_DB: Record<string, number> = {
  "GC-SMRITI-100": 1000,
  "GC-SMRITI-500": 5000,
  "GC-RETAIL-GOLD": 2500,
  "GC-FESTIVE-GIFT": 1500
};

const SALESPERSONS = [
  { id: "emp-101", name: "Rajesh Kumar", code: "EMP101" },
  { id: "emp-102", name: "Anjali Sharma", code: "EMP102" },
  { id: "emp-103", name: "Amit Patel", code: "EMP103" },
  { id: "emp-104", name: "Pooja Roy", code: "EMP104" }
];

export const AdvancedBillingEngine: React.FC<AdvancedBillingEngineProps> = ({
  cart,
  onClearCart,
  activeShift,
  activeProfile,
  onCheckoutSuccess,
  onNotification,
  onClose
}) => {
  // Store details
  const storeInfo = {
    name: "SMRITI HYPERRETAIL PRIVATE LIMITED",
    gstin: "27AAACS1094J1Z3", // Maharashtra GSTIN
    fssai: "10021022000456",
    address: "Unit 401-404, Tech Park IV, Bandra Kurla Complex, Mumbai, Maharashtra - 400051",
    terms: "1. Goods once sold cannot be taken back or exchanged.\n2. In case of manufacturing defect, return within 7 days with original invoice.\n3. All disputes are subject to Mumbai jurisdiction.",
    policy: "Returns accepted within 7 days on clothing and accessories only if tags are intact."
  };

  // State Variables
  const [customer, setCustomer] = useState<AdvancedCustomer>({
    type: "Unregistered",
    name: "Walk-In Customer",
    mobile: "",
    email: "",
    gstin: "",
    companyName: "",
    membershipId: "",
    billingAddress: "Mumbai, Maharashtra, India",
    shippingAddress: "",
    isShippingDifferent: false
  });

  const [matchedCustomer, setMatchedCustomer] = useState<Customer | null>(null);

  const [itemDetailsList, setItemDetailsList] = useState<ItemBillingDetails[]>([]);
  
  // Bill-Level Discounts
  const [billDiscountType, setBillDiscountType] = useState<"percentage" | "flat">("flat");
  const [billDiscountVal, setBillDiscountVal] = useState<number>(0);
  const [activePromoOffer, setActivePromoOffer] = useState<string>("None");

  // Coupon State
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<typeof COUPONS_DB[0] | null>(null);

  // Gift Card State
  const [giftCardNo, setGiftCardNo] = useState("");
  const [giftCardBalance, setGiftCardBalance] = useState<number | null>(null);
  const [giftCardRedemption, setGiftCardRedemption] = useState<number>(0);

  // Loyalty Points
  const [openingLoyaltyPoints, setOpeningLoyaltyPoints] = useState<number>(0);
  const [loyaltyRedeemPoints, setLoyaltyRedeemPoints] = useState<number>(0);

  // Payment Breakdown
  const [paymentMode, setPaymentMode] = useState<"Single" | "Split">("Single");
  const [primaryPaymentMethod, setPrimaryPaymentMethod] = useState<string>("Cash");
  const [splitAmounts, setSplitAmounts] = useState<Record<string, number>>({
    Cash: 0,
    UPI: 0,
    Card: 0,
    Wallet: 0,
    GiftCard: 0
  });

  // Salesperson & Terminal Metadata
  const [globalSalespersonId, setGlobalSalespersonId] = useState<string>("emp-101");
  const [isTaxInclusiveGlobal, setIsTaxInclusiveGlobal] = useState<boolean>(true);
  const [invoiceRemarks, setInvoiceRemarks] = useState<string>("");

  // B2B & Logistics Transporter Details State
  const [transporterName, setTransporterName] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [lrNumber, setLrNumber] = useState("");
  const [ewayBillNumber, setEwayBillNumber] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("27");
  const [paymentTerms, setPaymentTerms] = useState("Net 30");
  const [salesExecutiveId, setSalesExecutiveId] = useState("emp-101");

  // TCS / TDS Calculations
  const [tcsRate, setTcsRate] = useState<number>(0);
  const [gstinValidState, setGstinValidState] = useState<"unchecked" | "valid" | "invalid">("unchecked");

  const handleValidateGstin = () => {
    const cleanGst = customer.gstin.trim();
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (gstRegex.test(cleanGst)) {
      setGstinValidState("valid");
      onNotification("GSTIN Valid", `GSTIN ${cleanGst} format check passed successfully.`, "success");
    } else {
      setGstinValidState("invalid");
      onNotification("GSTIN Invalid", "Format check failed. GSTIN must be a 15-character alphanumeric ID.", "error");
    }
  };

  // Print Mode
  const [selectedPrintLayout, setSelectedPrintLayout] = useState<"A4" | "80mm" | "58mm">("A4");
  const [showInvoicePreview, setShowInvoicePreview] = useState<boolean>(false);
  const [finalizedInvoice, setFinalizedInvoice] = useState<any>(null);

  // Active edit item-level discount modal
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);

  // Keyboard shortcuts register via KeyboardEngine
  useTerminalShortcuts({
    "ESC": () => {
      onClose();
    }
  });

  // Synchronize cart with internal editable itemDetailsList
  useEffect(() => {
    const newList = cart.map(item => {
      // Check if item already exists in local list to preserve customizations
      const existing = itemDetailsList.find(i => i.product.id === item.product.id);
      if (existing) {
        return {
          ...existing,
          quantity: item.quantity // update latest quantity
        };
      }

      // Default HSN Codes by category
      let hsn = "998397"; // Services / general HSN
      if (item.product.category.toLowerCase().includes("apparel")) hsn = "61091000";
      else if (item.product.category.toLowerCase().includes("foot")) hsn = "64039190";
      else if (item.product.category.toLowerCase().includes("access")) hsn = "91011100";

      const catLower = (item.product.category || "").toLowerCase();
      let calculatedGst = item.product.gstPercentage;
      if (!calculatedGst) {
        if (catLower.includes("apparel") || catLower.includes("footwear") || catLower.includes("clothing")) {
          calculatedGst = item.product.price <= 2500 ? 5 : 18;
        } else if (catLower.includes("access")) {
          calculatedGst = 18;
        } else {
          calculatedGst = 18;
        }
      }

      return {
        product: item.product,
        quantity: item.quantity,
        hsnCode: hsn,
        isTaxInclusive: isTaxInclusiveGlobal,
        gstRate: calculatedGst, // Compliant GST 2.0 price-tier dynamic calculation
        discounts: {
          percentage: 0,
          flat: 0,
          promo: 0,
          scheme: 0,
          salesperson: 0
        },
        salespersonId: globalSalespersonId
      };
    });
    setItemDetailsList(newList);
  }, [cart, globalSalespersonId, isTaxInclusiveGlobal]);

  // Sync Loyalty and Real Customer based on mobile
  useEffect(() => {
    if (customer.mobile.length >= 10) {
      const allCustomers = getCustomers();
      const found = allCustomers.find(c => c.mobile === customer.mobile);
      if (found) {
        setMatchedCustomer(found);
        setOpeningLoyaltyPoints(found.outstanding > 0 ? 300 : 1200);
        if (!customer.membershipId) {
          setCustomer(prev => ({
            ...prev,
            membershipId: `MEM-${found.id.slice(-4)}`,
            name: prev.name === "Walk-In Customer" ? found.name : prev.name,
            email: prev.email || found.email || "",
            gstin: prev.gstin || found.gstNumber || "",
            companyName: prev.companyName || (found.gstNumber ? found.name : "")
          }));
        }
      } else {
        setMatchedCustomer(null);
        setOpeningLoyaltyPoints(50); // New customer welcome reward
        if (!customer.membershipId) {
          setCustomer(prev => ({ ...prev, membershipId: `MEM-NEW-${customer.mobile.slice(-4)}` }));
        }
      }
    } else {
      setMatchedCustomer(null);
      setOpeningLoyaltyPoints(0);
      setLoyaltyRedeemPoints(0);
    }
  }, [customer.mobile]);

  // Calculations Core Engine
  const calculateInvoiceTotals = () => {
    let grossAmount = 0;
    let itemDiscountsTotal = 0;

    // Line calculations
    const calculatedItems = itemDetailsList.map(item => {
      const unitRate = item.product.price;
      const lineGross = unitRate * item.quantity;
      grossAmount += lineGross;

      // Item Level Discounts
      const itemDiscPercentVal = (unitRate * (item.discounts.percentage / 100)) * item.quantity;
      const itemDiscFlatVal = item.discounts.flat * item.quantity;
      const itemDiscPromoVal = item.discounts.promo * item.quantity;
      const itemDiscSchemeVal = item.discounts.scheme * item.quantity;
      const itemDiscSalespersonVal = item.discounts.salesperson * item.quantity;

      const totalLineDiscount = itemDiscPercentVal + itemDiscFlatVal + itemDiscPromoVal + itemDiscSchemeVal + itemDiscSalespersonVal;
      itemDiscountsTotal += totalLineDiscount;

      const netLineBeforeTax = lineGross - totalLineDiscount;

      return {
        ...item,
        lineGross,
        totalLineDiscount,
        netLineBeforeTax
      };
    });

    const subTotalAfterItemDiscounts = grossAmount - itemDiscountsTotal;

    // Apply Promo Offer adjustments
    let promoValue = 0;
    if (activePromoOffer === "Happy Hour") {
      promoValue = Math.min(150, subTotalAfterItemDiscounts);
    } else if (activePromoOffer === "Festival Offer") {
      promoValue = subTotalAfterItemDiscounts * 0.05; // 5% flat offer
    }

    // Bill Discount Overall
    let billDiscVal = 0;
    if (billDiscountType === "percentage") {
      billDiscVal = (subTotalAfterItemDiscounts - promoValue) * (billDiscountVal / 100);
    } else {
      billDiscVal = Math.min(billDiscountVal, subTotalAfterItemDiscounts - promoValue);
    }

    // Coupon Discount
    let couponDiscountValue = 0;
    if (appliedCoupon) {
      if (subTotalAfterItemDiscounts >= appliedCoupon.minPurchase) {
        if (appliedCoupon.type === "percent") {
          couponDiscountValue = (subTotalAfterItemDiscounts - promoValue - billDiscVal) * (appliedCoupon.value / 100);
        } else {
          couponDiscountValue = Math.min(appliedCoupon.value, subTotalAfterItemDiscounts - promoValue - billDiscVal);
        }
      }
    }

    // Loyalty Points discount (1 Point = ₹1)
    const loyaltyValue = Math.min(loyaltyRedeemPoints, subTotalAfterItemDiscounts - promoValue - billDiscVal - couponDiscountValue, openingLoyaltyPoints);

    const totalBillDiscounts = promoValue + billDiscVal + couponDiscountValue + loyaltyValue;

    // Proportional allocation of bill-level discounts to lines for accurate GST taxable values
    let totalTaxableAmount = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    // Determine GST state route
    // Store GST State starts with "27" (Maharashtra)
    const isInterstate = customer.type === "Registered" 
      ? (customer.gstin ? !customer.gstin.startsWith("27") : false)
      : (customer.billingAddress ? !customer.billingAddress.toLowerCase().includes("maharashtra") : false);

    const itemsWithAllocatedTax = calculatedItems.map(item => {
      // Portion of bill-level discount allocated to this line based on its relative net value
      const share = subTotalAfterItemDiscounts > 0 ? (item.netLineBeforeTax / subTotalAfterItemDiscounts) : 0;
      const allocatedBillDiscount = totalBillDiscounts * share;
      const netTaxableBeforeTaxCalculations = Math.max(0, item.netLineBeforeTax - allocatedBillDiscount);

      let lineTaxable = 0;
      let lineTaxAmt = 0;

      if (item.isTaxInclusive) {
        // Reverse calculate tax: Base = Net / (1 + Rate/100)
        lineTaxable = netTaxableBeforeTaxCalculations / (1 + (item.gstRate / 100));
        lineTaxAmt = netTaxableBeforeTaxCalculations - lineTaxable;
      } else {
        // Add tax: Base = Net
        lineTaxable = netTaxableBeforeTaxCalculations;
        lineTaxAmt = netTaxableBeforeTaxCalculations * (item.gstRate / 100);
      }

      totalTaxableAmount += lineTaxable;

      let cgst = 0, sgst = 0, igst = 0;
      if (isInterstate) {
        igst = lineTaxAmt;
        igstTotal += igst;
      } else {
        cgst = lineTaxAmt / 2;
        sgst = lineTaxAmt / 2;
        cgstTotal += cgst;
        sgstTotal += sgst;
      }

      const totalLineFinal = lineTaxable + lineTaxAmt;

      return {
        ...item,
        allocatedBillDiscount,
        taxableValue: lineTaxable,
        taxAmount: lineTaxAmt,
        cgst,
        sgst,
        igst,
        totalLineFinal
      };
    });

    const netAmountCalculated = totalTaxableAmount + cgstTotal + sgstTotal + igstTotal;
    const roundedGrandTotal = Math.round(netAmountCalculated);
    const roundOff = roundedGrandTotal - netAmountCalculated;

    // TCS (Tax Collected at Source) Calculation
    const tcsAmount = Math.round(roundedGrandTotal * tcsRate * 100) / 100;
    const finalGrandTotal = roundedGrandTotal + tcsAmount;

    // Gift Card Redemption
    const finalGiftCardValue = Math.min(giftCardRedemption, finalGrandTotal);
    const balancePayable = Math.max(0, finalGrandTotal - finalGiftCardValue);

    // Points earned on current bill
    const loyaltyPointsEarned = Math.floor(finalGrandTotal / 100); // 1 point per ₹100

    return {
      grossAmount,
      itemDiscountsTotal,
      promoValue,
      billDiscVal,
      couponDiscountValue,
      loyaltyValue,
      totalBillDiscounts,
      isInterstate,
      items: itemsWithAllocatedTax,
      totalTaxableAmount,
      cgstTotal,
      sgstTotal,
      igstTotal,
      roundOff,
      tcsAmount,
      grandTotal: finalGrandTotal,
      giftCardRedemptionValue: finalGiftCardValue,
      balancePayable,
      loyaltyPointsEarned,
      closingLoyaltyPoints: openingLoyaltyPoints - loyaltyRedeemPoints + loyaltyPointsEarned
    };
  };

  const totals = calculateInvoiceTotals();

  // Apply Coupon
  const handleApplyCoupon = () => {
    const coupon = COUPONS_DB.find(c => c.code.toUpperCase() === couponCode.trim().toUpperCase());
    if (coupon) {
      setAppliedCoupon(coupon);
      onNotification("Coupon Applied", `${coupon.code} successfully added! ${coupon.desc}`, "success");
    } else {
      onNotification("Invalid Coupon", "The entered coupon code is expired or invalid.", "error");
    }
  };

  // Verify Gift Card
  const handleApplyGiftCard = () => {
    const bal = GIFT_CARDS_DB[giftCardNo.trim().toUpperCase()];
    if (bal !== undefined) {
      setGiftCardBalance(bal);
      setGiftCardRedemption(Math.min(bal, totals.grandTotal));
      onNotification("Gift Card Verified", `Card has available balance of ₹${bal}`, "success");
    } else {
      onNotification("Invalid Card", "The entered Gift Card number was not found.", "error");
    }
  };

  // Check split payment compliance
  const handlePaymentCheckbox = (method: string, check: boolean) => {
    if (check) {
      // Allocate remaining balance to this payment method
      const currentPaid = Object.entries(splitAmounts)
        .filter(([k]) => k !== method)
        .reduce((sum, [, v]) => sum + v, 0);
      const rem = Math.max(0, totals.balancePayable - currentPaid);
      setSplitAmounts(prev => ({ ...prev, [method]: rem }));
    } else {
      setSplitAmounts(prev => ({ ...prev, [method]: 0 }));
    }
  };

  const handleSplitAmountChange = (method: string, val: number) => {
    setSplitAmounts(prev => ({ ...prev, [method]: Math.max(0, val) }));
  };

  const totalSplitRegistered = Object.values(splitAmounts).reduce((sum, v) => sum + v, 0);
  const splitUnderpaid = totals.balancePayable - totalSplitRegistered;

  // Final Checkout Submission
  const handleFinalCheckout = async () => {
    if (cart.length === 0 || !activeShift) return;

    if (paymentMode === "Split" && Math.abs(splitUnderpaid) > 1) {
      onNotification("Payment Mismatch", `Split payment allocation mismatch by ₹${splitUnderpaid.toFixed(2)}. Please balance details.`, "error");
      return;
    }

    const isCreditSale = paymentMode === "Single" && primaryPaymentMethod === "CreditSale";
    if (matchedCustomer) {
      const groups = getCustomerGroups();
      const group = groups.find(g => g.id === matchedCustomer.customerGroupId);
      if (group && isCreditSale) {
        const creditCheck = checkCreditStatus(matchedCustomer, group, totals.grandTotal);
        if (!creditCheck.allowed) {
          onNotification(
            "Credit Blocked",
            creditCheck.reason || "This sale exceeds the credit limit for this customer and is auto-blocked.",
            "error"
          );
          return;
        }
        if (creditCheck.warningTriggered) {
          onNotification(
            "Credit Warning",
            `Warning: This sale takes the customer to ${Math.round(creditCheck.usagePercentAfter)}% of their credit limit.`,
            "success"
          );
        }
      }
    }

    const payload = {
      shiftId: activeShift.id,
      items: cart,
      total: totals.grandTotal,
      customerName: customer.name,
      customerType: customer.type,
      gstin: customer.gstin,
      companyName: customer.companyName,
      billingAddress: customer.billingAddress,
      shippingAddress: customer.isShippingDifferent ? customer.shippingAddress : customer.billingAddress,
      transporter: {
        name: transporterName,
        vehicleNo: vehicleNo,
        lrNumber: lrNumber,
        ewayBillNumber: ewayBillNumber,
        placeOfSupply: placeOfSupply,
        paymentTerms: paymentTerms
      },
      salesExecutiveId: salesExecutiveId,
      tcs: {
        rate: tcsRate,
        amount: totals.tcsAmount
      },
      taxBreakdown: {
        taxable: totals.totalTaxableAmount,
        cgst: totals.cgstTotal,
        sgst: totals.sgstTotal,
        igst: totals.igstTotal,
        roundOff: totals.roundOff
      },
      discounts: {
        items: totals.itemDiscountsTotal,
        bill: totals.billDiscVal,
        coupon: totals.couponDiscountValue,
        promo: totals.promoValue,
        loyalty: totals.loyaltyValue,
        giftCard: totals.giftCardRedemptionValue
      },
      loyalty: {
        earned: totals.loyaltyPointsEarned,
        redeemed: loyaltyRedeemPoints,
        closing: totals.closingLoyaltyPoints
      },
      payment: paymentMode === "Single" 
        ? { mode: primaryPaymentMethod, amount: totals.balancePayable }
        : { mode: "Split", breakup: splitAmounts },
      salesperson: SALESPERSONS.find(s => s.id === globalSalespersonId)?.name || "Default Counter Clerk",
      remarks: invoiceRemarks,
      invoiceNo: `INV-${activeProfile?.id ? activeProfile.id.toUpperCase().replace("PROF-", "T") : "T1"}-${Date.now().toString().slice(-6)}`
    };

    try {
      // Migrated: POST /api/pos/checkout (Express — unmounted) → POST /api/v1/pos/checkout (FastAPI)
      await apiFetchV1("/pos/checkout", {
        method: "POST",
        body: JSON.stringify({
          shiftId: activeShift.id,
          items: cart,
          total: totals.grandTotal,
          customerName: customer.name,
          customerId: matchedCustomer?.id,
          payment: paymentMode === "Single"
            ? { mode: primaryPaymentMethod, amount: totals.balancePayable }
            : { mode: "Split", breakup: splitAmounts },
          appliedPromoOffer: activePromoOffer,
          billDiscountType,
          billDiscountVal,
          appliedCoupon,
          giftCardRedemption,
          loyaltyRedeemPoints
        })
      });
      if (matchedCustomer && isCreditSale) {
        updateCustomerOutstanding(matchedCustomer.id, totals.grandTotal);
      }
      setFinalizedInvoice(payload);
      setShowInvoicePreview(true);
      onNotification("Success", "GST Tax Invoice generated and archived successfully.", "success");
    } catch (e: any) {
      console.error(e);
      onNotification("Error", e.message || "Could not complete full-stack database write", "error");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0b1329] border border-theme-divider rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden text-gray-200">
        
        {/* Header bar */}
        <div className="px-6 py-4 border-b border-theme-divider bg-theme-surface-2 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="material-symbols-outlined text-blue-500 text-3xl">receipt_long</span>
            <div>
              <h3 className="text-lg font-bold text-theme-body font-display">Advanced GST Tax Invoicing</h3>
              <p className="text-xs text-blue-400 font-mono">Terminal: {activeProfile?.name} • Operator: {activeProfile?.cashier}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-theme-body transition-colors p-1.5 rounded-lg hover:bg-white/5"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Workspace Body */}
        {!showInvoicePreview ? (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            
            {/* Left side settings configuration panel */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              
              {/* SECTION 1: CUSTOMER SEGMENT */}
              <div className="bg-theme-surface-2/50 border border-theme-divider p-5 rounded-xl space-y-4">
                <div className="flex items-center justify-between border-b border-theme-divider/60 pb-3">
                  <h4 className="font-semibold text-theme-body text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-400 text-lg">person</span>
                    Customer Segment & Addresses
                  </h4>
                  <div className="flex items-center bg-theme-surface-3 p-1 rounded-lg border border-theme-divider">
                    <button
                      onClick={() => setCustomer(prev => ({ ...prev, type: "Unregistered", gstin: "", companyName: "" }))}
                      className={`px-3 py-1 text-xs rounded-md font-semibold transition-all ${customer.type === "Unregistered" ? "bg-[#2563EB] text-theme-body" : "text-gray-400"}`}
                    >
                      B2C Consumer
                    </button>
                    <button
                      onClick={() => setCustomer(prev => ({ ...prev, type: "Registered" }))}
                      className={`px-3 py-1 text-xs rounded-md font-semibold transition-all ${customer.type === "Registered" ? "bg-[#2563EB] text-theme-body" : "text-gray-400"}`}
                    >
                      B2B Registered
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 bg-slate-900/30 p-2.5 rounded-lg border border-theme-divider/40">
                    <label className="block text-[10px] text-blue-400 font-mono uppercase mb-1">Quick Match Partner / Customer</label>
                    <select
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          const allCusts = getCustomers();
                          const found = allCusts.find(c => c.id === val);
                          if (found) {
                            setCustomer({
                              type: found.gstNumber ? "Registered" : "Unregistered",
                              name: found.name,
                              mobile: found.mobile,
                              email: found.email || "",
                              gstin: found.gstNumber || "",
                              companyName: found.gstNumber ? found.name : "",
                              membershipId: `MEM-${found.id.slice(-4)}`,
                              billingAddress: found.gstNumber ? "Registered GST Address" : "Mumbai, Maharashtra, India",
                              shippingAddress: "",
                              isShippingDifferent: false
                            });
                          }
                        } else {
                          setCustomer({
                            type: "Unregistered",
                            name: "Walk-In Customer",
                            mobile: "",
                            email: "",
                            gstin: "",
                            companyName: "",
                            membershipId: "",
                            billingAddress: "Mumbai, Maharashtra, India",
                            shippingAddress: "",
                            isShippingDifferent: false
                          });
                        }
                      }}
                      className="w-full bg-slate-950 border border-theme-divider/60 rounded px-2.5 py-2 text-xs focus:outline-none focus:border-blue-500 text-blue-300 font-semibold"
                    >
                      <option value="">-- Walk-In Customer --</option>
                      {getCustomers().map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.mobile}) - Outstanding: ₹{c.outstanding.toLocaleString("en-IN")}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Customer Mobile</label>
                    <input
                      type="text"
                      placeholder="Enter 10-digit mobile..."
                      value={customer.mobile}
                      onChange={(e) => setCustomer(prev => ({ ...prev, mobile: e.target.value }))}
                      className="w-full bg-theme-surface-1 border border-theme-divider rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-theme-body"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Customer Name</label>
                    <input
                      type="text"
                      placeholder="Walk-In Customer"
                      value={customer.name}
                      onChange={(e) => setCustomer(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-theme-surface-1 border border-theme-divider rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-theme-body"
                    />
                  </div>

                  {customer.type === "Registered" && (
                    <>
                      <div>
                        <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">GSTIN (Indian GSTIN)</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="e.g. 27AAAAA1111A1Z1"
                            value={customer.gstin}
                            onChange={(e) => {
                              setCustomer(prev => ({ ...prev, gstin: e.target.value.toUpperCase() }));
                              setGstinValidState("unchecked");
                            }}
                            className="flex-1 bg-theme-surface-1 border border-theme-divider rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-theme-body font-mono"
                          />
                          <button
                            onClick={handleValidateGstin}
                            className={`px-3 py-1.5 rounded text-xs font-semibold font-mono transition-all ${
                              gstinValidState === "valid" ? "bg-emerald-600 text-white" :
                              gstinValidState === "invalid" ? "bg-rose-600 text-white" :
                              "bg-slate-700 hover:bg-slate-600 text-gray-200"
                            }`}
                          >
                            {gstinValidState === "valid" ? "Verified" : gstinValidState === "invalid" ? "Failed" : "Verify"}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Company Registered Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Acme Retail Pvt Ltd"
                          value={customer.companyName}
                          onChange={(prev) => setCustomer(p => ({ ...p, companyName: prev.target.value }))}
                          className="w-full bg-theme-surface-1 border border-theme-divider rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-theme-body"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Loyalty Membership ID</label>
                    <input
                      type="text"
                      placeholder="Loyalty Member Account"
                      value={customer.membershipId}
                      readOnly
                      className="w-full bg-[#101930] border border-theme-divider rounded px-3 py-2 text-xs text-gray-400 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Customer Email</label>
                    <input
                      type="email"
                      placeholder="customer@domain.com"
                      value={customer.email}
                      onChange={(e) => setCustomer(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full bg-theme-surface-1 border border-theme-divider rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-theme-body"
                    />
                  </div>
                </div>

                {/* Billing and Shipping Address fields */}
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Billing Address</label>
                    <textarea
                      rows={2}
                      placeholder="Enter billing address for GST Invoice details..."
                      value={customer.billingAddress}
                      onChange={(e) => setCustomer(prev => ({ ...prev, billingAddress: e.target.value }))}
                      className="w-full bg-theme-surface-1 border border-theme-divider rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-theme-body"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="ship-diff"
                      checked={customer.isShippingDifferent}
                      onChange={(e) => setCustomer(prev => ({ ...prev, isShippingDifferent: e.target.checked }))}
                      className="rounded text-blue-600 bg-theme-surface-1 border-theme-divider"
                    />
                    <label htmlFor="ship-diff" className="text-xs text-gray-300">Deliver to different shipping address</label>
                  </div>

                  {customer.isShippingDifferent && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Shipping Address</label>
                      <textarea
                        rows={2}
                        placeholder="Enter full shipping delivery address..."
                        value={customer.shippingAddress}
                        onChange={(e) => setCustomer(prev => ({ ...prev, shippingAddress: e.target.value }))}
                        className="w-full bg-theme-surface-1 border border-theme-divider rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-theme-body"
                      />
                    </motion.div>
                  )}
                </div>
              </div>

              {/* SECTION 2: PROMOTIONS, COUPONS & GIFT CARDS */}
              <div className="bg-theme-surface-2/50 border border-theme-divider p-5 rounded-xl space-y-4">
                <h4 className="font-semibold text-theme-body text-sm border-b border-theme-divider/60 pb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-400 text-lg">local_offer</span>
                  Promotions, Coupons & Gift Cards
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Coupon Redemption */}
                  <div className="space-y-3">
                    <label className="block text-[10px] text-gray-400 font-mono uppercase">Apply Coupon Code</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. SMRITI10, SAVE500"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        className="flex-1 bg-theme-surface-1 border border-theme-divider rounded px-3 py-1.5 text-xs text-theme-body uppercase font-mono"
                      />
                      <button
                        onClick={handleApplyCoupon}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                    {appliedCoupon && (
                      <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 p-2 rounded text-xs text-emerald-400">
                        <span>Coupon Active: <strong>{appliedCoupon.code}</strong></span>
                        <button onClick={() => setAppliedCoupon(null)} className="text-gray-400 hover:text-theme-body">✕</button>
                      </div>
                    )}
                  </div>

                  {/* Gift Card Redemption */}
                  <div className="space-y-3">
                    <label className="block text-[10px] text-gray-400 font-mono uppercase">Redeem Gift Card</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Card Number"
                        value={giftCardNo}
                        onChange={(e) => setGiftCardNo(e.target.value)}
                        className="flex-1 bg-theme-surface-1 border border-theme-divider rounded px-3 py-1.5 text-xs text-theme-body font-mono"
                      />
                      <button
                        onClick={handleApplyGiftCard}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors"
                      >
                        Check
                      </button>
                    </div>
                    {giftCardBalance !== null && (
                      <div className="bg-theme-surface-3 p-3 rounded border border-theme-divider space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Card Balance:</span>
                          <span className="font-bold text-theme-body">₹{giftCardBalance}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">Redeem:</span>
                          <input
                            type="number"
                            value={giftCardRedemption}
                            onChange={(e) => setGiftCardRedemption(Math.min(parseFloat(e.target.value) || 0, giftCardBalance, totals.grandTotal))}
                            className="bg-theme-surface-1 border border-theme-divider text-theme-body text-xs rounded px-2 py-0.5 w-20 text-right font-mono"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Loyalty Point Redemption */}
                {openingLoyaltyPoints > 0 && (
                  <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h5 className="font-semibold text-theme-body text-xs">SMRITI Loyalty Rewards</h5>
                      <p className="text-[11px] text-gray-400">Available rewards wallet points balance: <strong>{openingLoyaltyPoints} pts</strong> (1 Point = ₹1)</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-gray-300">Redeem points:</label>
                      <input
                        type="number"
                        value={loyaltyRedeemPoints}
                        onChange={(e) => setLoyaltyRedeemPoints(Math.min(parseInt(e.target.value) || 0, openingLoyaltyPoints, totals.grandTotal))}
                        className="bg-theme-surface-1 border border-theme-divider text-theme-body text-xs rounded px-3 py-1 w-24 text-right font-mono focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Bill-Level Offers */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Promotional Scheme</label>
                    <select
                      value={activePromoOffer}
                      onChange={(e) => setActivePromoOffer(e.target.value)}
                      className="w-full bg-theme-surface-1 border border-theme-divider rounded px-3 py-2 text-xs focus:outline-none text-theme-body"
                    >
                      <option value="None">None / standard pricing</option>
                      <option value="Happy Hour">Happy Hour Special (₹150 Flat Off)</option>
                      <option value="Festival Offer">Festive Sale Scheme (5% Off Bill)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Overall Adjustments</label>
                    <div className="flex gap-2">
                      <select
                        value={billDiscountType}
                        onChange={(e) => setBillDiscountType(e.target.value as any)}
                        className="bg-theme-surface-1 border border-theme-divider rounded px-2 py-1 text-xs text-theme-body"
                      >
                        <option value="flat">₹ Flat</option>
                        <option value="percentage">% Percent</option>
                      </select>
                      <input
                        type="number"
                        value={billDiscountVal}
                        onChange={(e) => setBillDiscountVal(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="flex-1 bg-theme-surface-1 border border-theme-divider rounded px-3 py-1 text-xs text-theme-body font-mono focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2.5: LOGISTICS, TRANSPORTER & TCS/TDS CONFIG */}
              <div className="bg-theme-surface-2/50 border border-theme-divider p-5 rounded-xl space-y-4">
                <h4 className="font-semibold text-theme-body text-sm border-b border-theme-divider/60 pb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-400 text-lg">local_shipping</span>
                  Logistics, Transporter & TCS/TDS Configuration
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Transporter Name</label>
                    <input
                      type="text"
                      placeholder="e.g. VRL Logistics, SafeExpress"
                      value={transporterName}
                      onChange={(e) => setTransporterName(e.target.value)}
                      className="w-full bg-theme-surface-1 border border-theme-divider rounded px-3 py-2 text-xs focus:outline-none text-theme-body"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Vehicle Number</label>
                    <input
                      type="text"
                      placeholder="e.g. MH-12-GQ-5432"
                      value={vehicleNo}
                      onChange={(e) => setVehicleNo(e.target.value)}
                      className="w-full bg-theme-surface-1 border border-theme-divider rounded px-3 py-2 text-xs focus:outline-none text-theme-body font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">LR / GR Number</label>
                    <input
                      type="text"
                      placeholder="e.g. LR-9876543"
                      value={lrNumber}
                      onChange={(e) => setLrNumber(e.target.value)}
                      className="w-full bg-theme-surface-1 border border-theme-divider rounded px-3 py-2 text-xs focus:outline-none text-theme-body font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">E-Way Bill Number</label>
                    <input
                      type="text"
                      placeholder="12-digit E-Way Bill No."
                      value={ewayBillNumber}
                      onChange={(e) => setEwayBillNumber(e.target.value)}
                      className="w-full bg-theme-surface-1 border border-theme-divider rounded px-3 py-2 text-xs focus:outline-none text-theme-body font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Place of Supply State</label>
                    <select
                      value={placeOfSupply}
                      onChange={(e) => setPlaceOfSupply(e.target.value)}
                      className="w-full bg-theme-surface-1 border border-theme-divider rounded px-3 py-2 text-xs focus:outline-none text-theme-body"
                    >
                      <option value="27">Maharashtra (27)</option>
                      <option value="29">Karnataka (29)</option>
                      <option value="33">Tamil Nadu (33)</option>
                      <option value="07">Delhi (07)</option>
                      <option value="09">Uttar Pradesh (09)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Credit Payment Terms</label>
                    <select
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      className="w-full bg-theme-surface-1 border border-theme-divider rounded px-3 py-2 text-xs focus:outline-none text-theme-body"
                    >
                      <option value="COD">Cash on Delivery (COD)</option>
                      <option value="Net 15">Net 15 Days</option>
                      <option value="Net 30">Net 30 Days</option>
                      <option value="Net 60">Net 60 Days</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Territory / Account Manager</label>
                    <select
                      value={salesExecutiveId}
                      onChange={(e) => setSalesExecutiveId(e.target.value)}
                      className="w-full bg-theme-surface-1 border border-theme-divider rounded px-3 py-2 text-xs focus:outline-none text-theme-body"
                    >
                      {SALESPERSONS.map(s => (
                        <option key={s.id} value={s.id}>{s.name} (Manager)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Statutory TCS Rate</label>
                    <select
                      value={tcsRate}
                      onChange={(e) => setTcsRate(parseFloat(e.target.value))}
                      className="w-full bg-theme-surface-1 border border-theme-divider rounded px-3 py-2 text-xs focus:outline-none text-theme-body"
                    >
                      <option value="0">None (0.00%)</option>
                      <option value="0.001">0.1% (Sales exceeding ₹50 Lakhs u/s 206C(1H))</option>
                      <option value="0.01">1.0% (TCS on E-commerce/Motor Vehicles)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 3: SALESPERSON & PAYMENTS */}
              <div className="bg-theme-surface-2/50 border border-theme-divider p-5 rounded-xl space-y-4">
                <h4 className="font-semibold text-theme-body text-sm border-b border-theme-divider/60 pb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-400 text-lg">payment</span>
                  Salesperson & Payment Breakup
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Commission Salesperson</label>
                    <select
                      value={globalSalespersonId}
                      onChange={(e) => setGlobalSalespersonId(e.target.value)}
                      className="w-full bg-theme-surface-1 border border-theme-divider rounded px-3 py-2 text-xs focus:outline-none text-theme-body"
                    >
                      <option value="">Clerk Default (Terminal Front)</option>
                      {SALESPERSONS.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Pricing Tax Mode</label>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        id="tax-inc-global"
                        checked={isTaxInclusiveGlobal}
                        onChange={(e) => setIsTaxInclusiveGlobal(e.target.checked)}
                        className="rounded text-blue-600 bg-theme-surface-1 border-theme-divider"
                      />
                      <label htmlFor="tax-inc-global" className="text-xs text-gray-300">Catalog pricing is GST-Inclusive</label>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] text-gray-400 font-mono uppercase">Payment Structure Mode</label>
                    <div className="flex items-center bg-theme-surface-3 p-0.5 rounded border border-theme-divider">
                      <button
                        onClick={() => setPaymentMode("Single")}
                        className={`px-3 py-0.5 text-xs rounded transition-all ${paymentMode === "Single" ? "bg-[#2563EB] text-theme-body" : "text-gray-400"}`}
                      >
                        Single Method
                      </button>
                      <button
                        onClick={() => setPaymentMode("Split")}
                        className={`px-3 py-0.5 text-xs rounded transition-all ${paymentMode === "Split" ? "bg-[#2563EB] text-theme-body" : "text-gray-400"}`}
                      >
                        Split Payment
                      </button>
                    </div>
                  </div>

                  {paymentMode === "Single" ? (
                    <div>
                      <select
                        value={primaryPaymentMethod}
                        onChange={(e) => setPrimaryPaymentMethod(e.target.value)}
                        className="w-full bg-theme-surface-1 border border-theme-divider rounded px-3 py-2 text-xs focus:outline-none text-theme-body font-semibold"
                      >
                        <option value="Cash">💵 CASH PAY</option>
                        <option value="UPI">📱 UPI INSTANT OVERLAY</option>
                        <option value="Card">💳 CREDIT / DEBIT CHIP CARD</option>
                        <option value="Wallet">🛍️ BRAND DIGITAL WALLET</option>
                        <option value="CreditSale">🏛️ DEFERRED CREDIT SALE (A/R Ledger)</option>
                      </select>
                    </div>
                  ) : (
                    <div className="bg-[#101930] p-4 rounded-xl border border-theme-divider space-y-3">
                      <div className="flex justify-between border-b border-theme-divider/40 pb-2 mb-2 text-xs">
                        <span className="text-gray-400 font-display">PAYMENT LEDGER ROUTING</span>
                        <span className={`font-mono font-bold ${splitUnderpaid === 0 ? "text-emerald-400" : "text-rose-400 animate-pulse"}`}>
                          {splitUnderpaid === 0 ? "Balanced" : `Unbalanced: ₹${splitUnderpaid.toFixed(2)}`}
                        </span>
                      </div>

                      {["Cash", "UPI", "Card", "Wallet"].map(method => {
                        const isChecked = splitAmounts[method] > 0;
                        return (
                          <div key={method} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`split-chk-${method}`}
                                checked={isChecked}
                                onChange={(e) => handlePaymentCheckbox(method, e.target.checked)}
                                className="rounded text-blue-600 bg-theme-surface-1 border-theme-divider"
                              />
                              <label htmlFor={`split-chk-${method}`} className="text-xs text-theme-body font-medium w-20">{method}</label>
                            </div>
                            {isChecked && (
                              <input
                                type="number"
                                value={splitAmounts[method]}
                                onChange={(e) => handleSplitAmountChange(method, parseFloat(e.target.value) || 0)}
                                className="bg-theme-surface-1 border border-theme-divider text-theme-body text-xs rounded px-2.5 py-1 text-right w-28 font-mono"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Invoice Memo / Remarks</label>
                  <input
                    type="text"
                    placeholder="Enter special shipping directions, billing footnotes, e.g. PO No."
                    value={invoiceRemarks}
                    onChange={(e) => setInvoiceRemarks(e.target.value)}
                    className="w-full bg-theme-surface-1 border border-theme-divider rounded px-3 py-2 text-xs text-theme-body focus:outline-none"
                  />
                </div>
              </div>

            </div>

            {/* Right side interactive item list and instant live total calculation preview */}
            <div className="w-full lg:w-[420px] bg-theme-surface-2 border-t lg:border-t-0 lg:border-l border-theme-divider flex flex-col overflow-hidden">
              
              <div className="p-4 border-b border-theme-divider bg-theme-surface-3/50">
                <h4 className="font-semibold text-theme-body text-xs uppercase tracking-wide">Live GST Calculation Sheet</h4>
              </div>

              {/* Cart List inside custom premium scroll */}
              <SmritiScrollArea className="flex-1 min-h-[150px]" fadeColorClass="from-[#121c35]">
                <div className="p-4 space-y-3">
                  {itemDetailsList.map((item, idx) => {
                    const share = totals.items[idx];
                    if (!share) return null;

                    return (
                      <div 
                        key={item.product.id}
                        className="bg-theme-surface-3 border border-theme-divider rounded-lg p-3 space-y-2 relative group/item"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h5 className="font-semibold text-theme-body text-xs leading-snug">{item.product.name}</h5>
                            <span className="text-[9px] text-blue-400 font-mono font-bold bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/15">
                              HSN: {item.hsnCode}
                            </span>
                          </div>
                          <span className="text-theme-body text-xs font-bold font-mono">x{item.quantity}</span>
                        </div>

                        {/* Calculations summary row */}
                        <div className="grid grid-cols-3 gap-2 text-[10px] text-gray-400 border-t border-theme-divider/40 pt-2 font-mono">
                          <div>
                            <span>Rate:</span>
                            <p className="text-theme-body font-medium">₹{item.product.price}</p>
                          </div>
                          <div>
                            <span>Taxable:</span>
                            <p className="text-emerald-400 font-semibold">₹{share.taxableValue.toFixed(2)}</p>
                          </div>
                          <div>
                            <span>GST ({item.gstRate}%):</span>
                            <p className="text-blue-400 font-semibold">₹{share.taxAmount.toFixed(2)}</p>
                          </div>
                        </div>

                        {/* Interactive discount tags row */}
                        <div className="flex flex-wrap gap-1 items-center pt-1.5">
                          {Object.entries(item.discounts).map(([k, v]) => {
                            if (v === 0) return null;
                            return (
                              <span 
                                key={k}
                                className="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/25 px-1 py-0.5 rounded flex items-center gap-1 cursor-pointer hover:bg-rose-500/20"
                                onClick={() => setEditingItemIdx(idx)}
                              >
                                {k}: {v}{k === "percentage" ? "%" : "₹"}
                              </span>
                            );
                          })}
                          <button
                            onClick={() => setEditingItemIdx(idx)}
                            className="text-[10px] text-blue-400 hover:text-theme-body flex items-center gap-0.5"
                          >
                            <span className="material-symbols-outlined text-xs">edit_note</span>
                            Add Discount
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SmritiScrollArea>

              {/* Aggregated Totals Block */}
              <div className="p-4 bg-theme-surface-3/70 border-t border-theme-divider space-y-2.5 text-xs">
                <div className="flex justify-between text-gray-400">
                  <span>Gross Value:</span>
                  <span className="font-mono">₹{totals.grossAmount.toFixed(2)}</span>
                </div>
                {totals.itemDiscountsTotal > 0 && (
                  <div className="flex justify-between text-rose-400">
                    <span>Line Level Discounts:</span>
                    <span className="font-mono">-₹{totals.itemDiscountsTotal.toFixed(2)}</span>
                  </div>
                )}
                {totals.totalBillDiscounts > 0 && (
                  <div className="flex justify-between text-rose-400">
                    <span>Bill Offers / Loyalty:</span>
                    <span className="font-mono">-₹{totals.totalBillDiscounts.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between text-gray-400 border-t border-theme-divider/40 pt-2">
                  <span>Taxable Base Value:</span>
                  <span className="font-mono font-medium text-theme-body">₹{totals.totalTaxableAmount.toFixed(2)}</span>
                </div>

                {!totals.isInterstate ? (
                  <>
                    <div className="flex justify-between text-gray-400">
                      <span>CGST Total:</span>
                      <span className="font-mono">₹{totals.cgstTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>SGST Total:</span>
                      <span className="font-mono">₹{totals.sgstTotal.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-gray-400">
                    <span>IGST (Interstate) Total:</span>
                    <span className="font-mono">₹{totals.igstTotal.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-gray-400">
                  <span>Round Off:</span>
                  <span className="font-mono text-[11px]">{totals.roundOff >= 0 ? "+" : ""}₹{totals.roundOff.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center border-t border-theme-divider pt-3 text-theme-body">
                  <span className="font-display font-semibold text-sm">Grand Total (Net Payable):</span>
                  <span className="font-mono font-bold text-lg text-emerald-400">₹{totals.grandTotal}</span>
                </div>

                {totals.giftCardRedemptionValue > 0 && (
                  <div className="flex justify-between text-blue-400">
                    <span>Gift Card Redeemed:</span>
                    <span className="font-mono">-₹{totals.giftCardRedemptionValue}</span>
                  </div>
                )}

                <button
                  onClick={handleFinalCheckout}
                  disabled={cart.length === 0 || (paymentMode === "Split" && totals.balancePayable > 0 && Math.abs(splitUnderpaid) > 1)}
                  className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center space-x-2 shadow-lg shadow-emerald-950/25 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">verified</span>
                  <span>Register & Print Invoice (₹{totals.balancePayable})</span>
                </button>
              </div>

            </div>

          </div>
        ) : (
          /* SECTION 4: INTERACTIVE PRINT TEMPLATE VIEWER */
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-900">
            
            {/* Left selector menu */}
            <div className="w-full md:w-64 bg-[#0e172a] border-b md:border-b-0 md:border-r border-theme-divider p-4 space-y-4">
              <h5 className="font-semibold text-xs text-blue-400 font-mono uppercase tracking-wider">Configure Print Queue</h5>
              
              <div className="space-y-2">
                {[
                  { id: "A4", label: "A4 GST Tax Invoice", icon: "article" },
                  { id: "80mm", label: "80mm Thermal Receipt", icon: "receipt" },
                  { id: "58mm", label: "58mm Compact Receipt", icon: "confirmation_number" }
                ].map(layout => (
                  <button
                    key={layout.id}
                    onClick={() => setSelectedPrintLayout(layout.id as any)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all border ${
                      selectedPrintLayout === layout.id 
                        ? "bg-blue-600 border-blue-600 text-white" 
                        : "bg-theme-surface-1/40 border-theme-divider text-gray-400 hover:border-blue-500"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">{layout.icon}</span>
                    {layout.label}
                  </button>
                ))}
              </div>

              <div className="border-t border-theme-divider pt-4 space-y-3">
                <button
                  onClick={handlePrint}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">print</span>
                  Print Document
                </button>
                <button
                  onClick={() => {
                    onNotification("PDF Exported", "Invoice successfully printed and downloaded as PDF document.", "success");
                  }}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-gray-300 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                >
                  <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                  PDF Download
                </button>
                <button
                  onClick={() => {
                    const email = customer.email || "customer@domain.com";
                    onNotification("Invoice Dispatched", `Receipt successfully routed to customer mailbox: ${email}`, "success");
                  }}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-gray-300 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                >
                  <span className="material-symbols-outlined text-base">mail</span>
                  Email Invoice
                </button>
                <button
                  onClick={() => {
                    const cleanPhone = (customer.mobile || "9999999999").replace(/\D/g, "");
                    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                    const invoiceNo = finalizedInvoice?.invoiceNo || "N/A";
                    const grandTotal = totals.grandTotal || 0;
                    const customerName = customer.name || "Customer";
                    const messageText = `Hello ${customerName},\n\nThank you for shopping with SMRITI Retail! Your digital receipt has been generated.\n\n*Invoice No:* ${invoiceNo}\n*Amount Paid:* ₹${grandTotal}\n*Store:* SMRITI Main Flagship Store\n\nHope to see you again soon!`;
                    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(messageText)}`;
                    window.open(waUrl, "_blank");
                    onNotification("WhatsApp Routed", `Secure invoice link dispatched to customer WhatsApp profile: ${customer.mobile || "+91 9999999999"}`, "success");
                  }}
                  className="w-full bg-[#128C7E] hover:bg-[#075E54] text-theme-body py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">chat</span>
                  WhatsApp Receipt
                </button>
              </div>

              <div className="pt-6">
                <button
                  onClick={() => {
                    onClearCart();
                    onCheckoutSuccess(finalizedInvoice);
                    onClose();
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs uppercase"
                >
                  Finish Transaction
                </button>
              </div>
            </div>

            {/* Right side live layout canvas frame */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 flex justify-center bg-slate-950">
              
              {selectedPrintLayout === "A4" && (
                <div id="print-area-a4" className="w-[794px] min-h-[1123px] bg-white text-gray-900 p-8 shadow-2xl font-sans text-[11px] leading-snug border border-gray-200">
                  
                  {/* Header */}
                  <div className="flex justify-between items-start border-b border-gray-300 pb-4">
                    <div>
                      <h1 className="text-base font-bold tracking-tight text-gray-900 uppercase">{storeInfo.name}</h1>
                      <p className="text-[10px] text-gray-500 mt-1 max-w-sm leading-relaxed">{storeInfo.address}</p>
                      <p className="font-mono mt-1 text-[10px]">
                        <strong>GSTIN:</strong> {storeInfo.gstin} • <strong>FSSAI:</strong> {storeInfo.fssai}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs bg-gray-100 font-bold px-3 py-1 rounded text-gray-800 tracking-wider font-display border border-gray-200">TAX INVOICE</span>
                      <p className="font-mono mt-3 text-[10px]"><strong>Invoice No:</strong> {finalizedInvoice?.invoiceNo}</p>
                      <p className="font-mono text-[10px]"><strong>Date:</strong> {new Date().toLocaleDateString("en-IN")} {new Date().toLocaleTimeString("en-IN")}</p>
                    </div>
                  </div>

                  {/* Customer and Salesperson Metadata row */}
                  <div className="grid grid-cols-2 gap-6 py-4 border-b border-gray-200">
                    <div>
                      <h5 className="font-semibold text-[10px] text-gray-400 uppercase mb-1">Billing Details:</h5>
                      <p className="font-bold text-gray-900">{customer.name}</p>
                      {customer.type === "Registered" && <p className="text-gray-600">Company: {customer.companyName}</p>}
                      <p className="text-gray-600">Mobile: {customer.mobile || "Walk-In Retail Consumer"}</p>
                      {customer.email && <p className="text-gray-600">Email: {customer.email}</p>}
                      {customer.type === "Registered" && <p className="font-mono text-gray-800"><strong>GSTIN:</strong> {customer.gstin}</p>}
                      <p className="text-gray-500 mt-1"><strong>Address:</strong> {customer.billingAddress}</p>
                    </div>
                    <div>
                      <h5 className="font-semibold text-[10px] text-gray-400 uppercase mb-1">Shipping & Clerk Details:</h5>
                      <p className="text-gray-800">
                        <strong>Shipping:</strong> {customer.isShippingDifferent ? customer.shippingAddress : "Same as Billing"}
                      </p>
                      <p className="text-gray-600 mt-2"><strong>Operator Counter ID:</strong> {activeProfile?.name || "T1"}</p>
                      <p className="text-gray-600"><strong>Shift Cashier Float:</strong> Shift #{activeShift?.id}</p>
                      <p className="text-gray-600"><strong>Assigned Associate:</strong> {finalizedInvoice?.salesperson}</p>
                    </div>
                  </div>

                  {/* Grid Line Items */}
                  <table className="w-full text-left mt-4 border-collapse">
                    <thead>
                      <tr className="bg-gray-100 border-t border-b border-gray-300 font-semibold text-gray-700">
                        <th className="py-2 px-1">Code</th>
                        <th className="py-2 px-1">Item Description</th>
                        <th className="py-2 px-1 text-right">HSN/SAC</th>
                        <th className="py-2 px-1 text-right">Qty</th>
                        <th className="py-2 px-1 text-right">Rate</th>
                        <th className="py-2 px-1 text-right">Discount</th>
                        <th className="py-2 px-1 text-right">Taxable</th>
                        <th className="py-2 px-1 text-right">Tax %</th>
                        <th className="py-2 px-1 text-right">Net Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {totals.items.map((item, i) => (
                        <tr key={i} className="border-b border-gray-100 text-gray-800">
                          <td className="py-2 px-1 font-mono">{item.product.code}</td>
                          <td className="py-2 px-1">
                            <strong>{item.product.name}</strong>
                            {item.product.color && <span className="text-[9px] text-gray-500 block">Color: {item.product.color} | Size: {item.product.size}</span>}
                          </td>
                          <td className="py-2 px-1 text-right font-mono">{item.hsnCode}</td>
                          <td className="py-2 px-1 text-right font-mono">{item.quantity}</td>
                          <td className="py-2 px-1 text-right font-mono">₹{item.product.price}</td>
                          <td className="py-2 px-1 text-right font-mono text-rose-600">₹{item.totalLineDiscount.toFixed(2)}</td>
                          <td className="py-2 px-1 text-right font-mono">₹{item.taxableValue.toFixed(2)}</td>
                          <td className="py-2 px-1 text-right font-mono">{item.gstRate}%</td>
                          <td className="py-2 px-1 text-right font-mono">₹{item.totalLineFinal.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Bottom Layout - Totals Breakout Grid */}
                  <div className="grid grid-cols-12 gap-4 mt-6 pt-4 border-t border-gray-200">
                    
                    {/* Left Column (Tax Split Details and payment barcode) */}
                    <div className="col-span-7 space-y-4">
                      
                      {/* GST Summary Table */}
                      <div className="bg-gray-50 p-3 rounded border border-gray-200">
                        <h6 className="font-semibold text-[9px] text-gray-600 uppercase mb-2">GST Tax Rate Breakup Summary</h6>
                        <table className="w-full text-left font-mono text-[9px]">
                          <thead>
                            <tr className="border-b border-gray-300 text-gray-500">
                              <th>HSN Code</th>
                              <th className="text-right">Taxable Value</th>
                              {!totals.isInterstate ? (
                                <>
                                  <th className="text-right">CGST Rate</th>
                                  <th className="text-right">CGST Amt</th>
                                  <th className="text-right">SGST Rate</th>
                                  <th className="text-right">SGST Amt</th>
                                </>
                              ) : (
                                <>
                                  <th className="text-right">IGST Rate</th>
                                  <th className="text-right">IGST Amt</th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {totals.items.map((item, idx) => (
                              <tr key={idx} className="text-gray-700">
                                <td>{item.hsnCode}</td>
                                <td className="text-right">₹{item.taxableValue.toFixed(2)}</td>
                                {!totals.isInterstate ? (
                                  <>
                                    <td className="text-right">{(item.gstRate / 2).toFixed(1)}%</td>
                                    <td className="text-right">₹{item.cgst.toFixed(2)}</td>
                                    <td className="text-right">{(item.gstRate / 2).toFixed(1)}%</td>
                                    <td className="text-right">₹{item.sgst.toFixed(2)}</td>
                                  </>
                                ) : (
                                  <>
                                    <td className="text-right">{item.gstRate}%</td>
                                    <td className="text-right">₹{item.igst.toFixed(2)}</td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Terms and Signatures */}
                      <div className="text-[9px] text-gray-500 space-y-1">
                        <p className="font-bold text-gray-700">Terms & Conditions:</p>
                        <p className="whitespace-pre-line leading-relaxed">{storeInfo.terms}</p>
                      </div>

                    </div>

                    {/* Right Column (Totals breakdown blocks) */}
                    <div className="col-span-5 space-y-2">
                      <div className="flex justify-between text-gray-600">
                        <span>Gross Amount:</span>
                        <span className="font-mono">₹{totals.grossAmount.toFixed(2)}</span>
                      </div>
                      {totals.itemDiscountsTotal > 0 && (
                        <div className="flex justify-between text-rose-600">
                          <span>Less Item Discounts:</span>
                          <span className="font-mono">-₹{totals.itemDiscountsTotal.toFixed(2)}</span>
                        </div>
                      )}
                      {totals.totalBillDiscounts > 0 && (
                        <div className="flex justify-between text-rose-600">
                          <span>Less Bill Offers/Points:</span>
                          <span className="font-mono">-₹{totals.totalBillDiscounts.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-gray-600 border-t border-gray-100 pt-1">
                        <span>Net Taxable Base:</span>
                        <span className="font-mono">₹{totals.totalTaxableAmount.toFixed(2)}</span>
                      </div>
                      {!totals.isInterstate ? (
                        <>
                          <div className="flex justify-between text-gray-600">
                            <span>Add CGST:</span>
                            <span className="font-mono">₹{totals.cgstTotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-gray-600">
                            <span>Add SGST:</span>
                            <span className="font-mono">₹{totals.sgstTotal.toFixed(2)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between text-gray-600">
                          <span>Add IGST:</span>
                          <span className="font-mono">₹{totals.igstTotal.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-gray-500">
                        <span>Round Off:</span>
                        <span className="font-mono">{totals.roundOff >= 0 ? "+" : ""}₹{totals.roundOff.toFixed(2)}</span>
                      </div>

                      <div className="flex justify-between text-gray-900 border-t border-b border-gray-300 py-2.5 font-bold text-xs bg-gray-50 px-2 rounded">
                        <span>GRAND TOTAL (INR):</span>
                        <span className="font-mono text-sm">₹{totals.grandTotal}</span>
                      </div>

                      {/* Payment mode details split */}
                      <div className="bg-gray-50 p-2 rounded border border-gray-200 text-[10px] space-y-1">
                        <span className="font-bold text-gray-700 block uppercase text-[8px] tracking-wide">Tender Breakdown:</span>
                        {paymentMode === "Single" ? (
                          <div className="flex justify-between text-gray-800 font-mono">
                            <span>{primaryPaymentMethod}:</span>
                            <span>₹{totals.grandTotal}</span>
                          </div>
                        ) : (
                          Object.entries(splitAmounts).map(([m, val]) => {
                            if (val <= 0) return null;
                            return (
                              <div key={m} className="flex justify-between text-gray-800 font-mono">
                                <span>{m}:</span>
                                <span>₹{val.toFixed(2)}</span>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Digital Barcode Generator placeholder */}
                      <div className="pt-2 flex flex-col items-center justify-center space-y-1">
                        <div className="h-6 w-full bg-slate-200 border border-slate-300 flex items-center justify-center font-mono text-[8px] text-gray-600 select-none">
                          ||| | |||| | ||| | ||| {finalizedInvoice?.invoiceNo} |||
                        </div>
                        <span className="text-[8px] text-gray-400">IRN e-Invoice ready QR</span>
                      </div>
                    </div>

                  </div>

                  {/* Footnotes */}
                  <div className="mt-12 pt-4 border-t border-gray-200 text-center text-gray-400 text-[9px] leading-relaxed">
                    <p className="font-semibold text-gray-600">Thank you for shopping with SMRITI Retail OS!</p>
                    <p className="mt-0.5 text-[8px]">Scan UPI QR at the register to verify digital signature ledger records.</p>
                  </div>

                </div>
              )}

              {selectedPrintLayout === "80mm" && (
                <div id="print-area-80mm" className="w-[302px] bg-white text-gray-900 p-4 shadow-2xl font-mono text-[10px] leading-relaxed border border-gray-200">
                  <div className="text-center space-y-1">
                    <h2 className="text-xs font-bold uppercase">{storeInfo.name}</h2>
                    <p className="text-[8px] text-gray-500">{storeInfo.address.slice(0, 50)}...</p>
                    <p className="text-[8px]">GSTIN: {storeInfo.gstin}</p>
                    <p className="font-bold border-t border-b border-dashed border-gray-300 py-1 my-2">*** TAX INVOICE ***</p>
                  </div>

                  <div className="space-y-1 py-2 text-[9px]">
                    <p><strong>INV NO:</strong> {finalizedInvoice?.invoiceNo}</p>
                    <p><strong>DATE:</strong> {new Date().toLocaleDateString("en-IN")}</p>
                    <p><strong>CUSTOMER:</strong> {customer.name}</p>
                    {customer.type === "Registered" && <p><strong>GSTIN:</strong> {customer.gstin}</p>}
                    <p><strong>CLERK:</strong> {finalizedInvoice?.salesperson}</p>
                  </div>

                  <div className="border-t border-b border-dashed border-gray-300 py-2">
                    <table className="w-full text-left text-[9px]">
                      <thead>
                        <tr className="font-bold">
                          <th>Item</th>
                          <th className="text-right">Qty</th>
                          <th className="text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {totals.items.map((item, idx) => (
                          <tr key={idx}>
                            <td>{item.product.name.slice(0, 16)}</td>
                            <td className="text-right">{item.quantity}</td>
                            <td className="text-right">₹{item.totalLineFinal.toFixed(0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="py-2 text-right space-y-1 text-[9px]">
                    <div className="flex justify-between">
                      <span>Gross total:</span>
                      <span>₹{totals.grossAmount.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-xs">
                      <span>Grand Total:</span>
                      <span>₹{totals.grandTotal}</span>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-gray-300 py-3 text-center space-y-1 text-[8px]">
                    <p>Thanks for visiting!</p>
                    <p>Returns only as per terms</p>
                    <p>Powered by SMRITI Retail OS</p>
                  </div>
                </div>
              )}

              {selectedPrintLayout === "58mm" && (
                <div id="print-area-58mm" className="w-[219px] bg-white text-gray-900 p-3 shadow-2xl font-mono text-[9px] leading-relaxed border border-gray-200">
                  <div className="text-center space-y-1">
                    <h3 className="text-[10px] font-bold uppercase">SMRITI RET</h3>
                    <p className="text-[8px] uppercase">*** SALE RECEIPT ***</p>
                  </div>

                  <div className="space-y-1 py-1 text-[8px] border-b border-dashed border-gray-300">
                    <p>INV: {finalizedInvoice?.invoiceNo.slice(-6)}</p>
                    <p>DATE: {new Date().toLocaleDateString("en-IN")}</p>
                    <p>CUST: {customer.name.slice(0, 12)}</p>
                  </div>

                  <div className="py-1.5 border-b border-dashed border-gray-300">
                    {totals.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-[8px]">
                        <span>{item.product.name.slice(0, 12)} x{item.quantity}</span>
                        <span>₹{item.totalLineFinal.toFixed(0)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="py-1.5 text-right font-bold text-[10px]">
                    <div className="flex justify-between">
                      <span>TOTAL:</span>
                      <span>₹{totals.grandTotal}</span>
                    </div>
                  </div>

                  <div className="text-center text-[7px] text-gray-500">
                    <p>THANK YOU - COME AGAIN</p>
                  </div>
                </div>
              )}

            </div>

          </div>
        )}

        {/* Edit Item Level Discount Modal */}
        <AnimatePresence>
          {editingItemIdx !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
              <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 max-w-md w-full space-y-4">
                <h4 className="font-semibold text-theme-body text-sm">
                  Line Discounts: {itemDetailsList[editingItemIdx]?.product.name}
                </h4>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Percentage Discount (%)</label>
                    <input
                      type="number"
                      value={itemDetailsList[editingItemIdx]?.discounts.percentage}
                      onChange={(e) => {
                        const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                        setItemDetailsList(prev => prev.map((item, idx) => idx === editingItemIdx ? { ...item, discounts: { ...item.discounts, percentage: val } } : item));
                      }}
                      className="w-full bg-theme-surface-1 border border-theme-divider text-theme-body text-xs rounded px-3 py-2 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Flat Discount (₹ Amount per unit)</label>
                    <input
                      type="number"
                      value={itemDetailsList[editingItemIdx]?.discounts.flat}
                      onChange={(e) => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                        setItemDetailsList(prev => prev.map((item, idx) => idx === editingItemIdx ? { ...item, discounts: { ...item.discounts, flat: val } } : item));
                      }}
                      className="w-full bg-theme-surface-1 border border-theme-divider text-theme-body text-xs rounded px-3 py-2 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Promotional Discount (₹)</label>
                    <input
                      type="number"
                      value={itemDetailsList[editingItemIdx]?.discounts.promo}
                      onChange={(e) => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                        setItemDetailsList(prev => prev.map((item, idx) => idx === editingItemIdx ? { ...item, discounts: { ...item.discounts, promo: val } } : item));
                      }}
                      className="w-full bg-theme-surface-1 border border-theme-divider text-theme-body text-xs rounded px-3 py-2 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1">Associate/Salesperson Discount (₹)</label>
                    <input
                      type="number"
                      value={itemDetailsList[editingItemIdx]?.discounts.salesperson}
                      onChange={(e) => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                        setItemDetailsList(prev => prev.map((item, idx) => idx === editingItemIdx ? { ...item, discounts: { ...item.discounts, salesperson: val } } : item));
                      }}
                      className="w-full bg-theme-surface-1 border border-theme-divider text-theme-body text-xs rounded px-3 py-2 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setEditingItemIdx(null)}
                    className="bg-blue-600 text-white px-4 py-1.5 rounded text-xs font-semibold"
                  >
                    Save & Apply
                  </button>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};
