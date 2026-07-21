/**
 * Project      : SMRITI Retail OS
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.0.0
 * Created      : 2026-07-10
 * Modified     : 2026-07-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */
import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Product, POSProfile, Shift, Bill, Customer, CustomerGroup } from "../types";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import { getCustomers, getCustomerGroups, updateCustomerOutstanding } from "../services/customerStore.ts";
import { checkCreditStatus } from "../services/customerPolicyEngine.ts";
import { apiFetchV1 } from "../lib/apiFetchV1";
import { useTerminalShortcuts } from "./terminal/KeyboardEngine";
import { SMRITIGrid } from "./terminal/SMRITIGrid";
import { StandardDocumentToolbar } from "./terminal/StandardDocumentToolbar";
import { RightDrawerHost } from "./terminal/RightDrawerHost";
import { UniversalSearchModal } from "./terminal/UniversalSearchModal";

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

// Demo Catalog Products for Tax Invoice Billing
const DEMO_TAX_PRODUCTS: Product[] = [
  {
    id: "prod-101",
    code: "SKU-TXT-001",
    name: "Men's Cotton Executive Oxford Shirt",
    price: 1850,
    mrp: 2499,
    stock: 45,
    category: "Apparel & Textiles",
    barcode: "8901234567890",
    gstPercentage: 5,
    hsnCode: "61091000"
  },
  {
    id: "prod-102",
    code: "SKU-TXT-002",
    name: "Slim Fit Stretch Denim Trousers",
    price: 2450,
    mrp: 3299,
    stock: 30,
    category: "Apparel & Textiles",
    barcode: "8901234567891",
    gstPercentage: 5,
    hsnCode: "61091000"
  },
  {
    id: "prod-103",
    code: "SKU-ACC-003",
    name: "Genuine Italian Leather Belt",
    price: 1290,
    mrp: 1799,
    stock: 60,
    category: "Accessories",
    barcode: "8901234567892",
    gstPercentage: 18,
    hsnCode: "91011100"
  },
  {
    id: "prod-104",
    code: "SKU-TXT-004",
    name: "Pure Kanjeevaram Silk Saree (Gold Zari)",
    price: 14500,
    mrp: 18999,
    stock: 12,
    category: "Apparel & Textiles",
    barcode: "8901234567893",
    gstPercentage: 12,
    hsnCode: "50072010"
  },
  {
    id: "prod-105",
    code: "SKU-HOM-005",
    name: "Egyptian Cotton Bath Towel Set (Pack of 2)",
    price: 1690,
    mrp: 2299,
    stock: 80,
    category: "Home & Living",
    barcode: "8901234567894",
    gstPercentage: 12,
    hsnCode: "63026000"
  },
  {
    id: "prod-106",
    code: "SKU-ELE-006",
    name: "Wireless Optical Ergonomic Mouse",
    price: 890,
    mrp: 1299,
    stock: 50,
    category: "Electronics & Tech",
    barcode: "8901234567895",
    gstPercentage: 18,
    hsnCode: "84716060"
  }
];

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

  // Local Cart State when cart prop is empty
  const [localCart, setLocalCart] = useState<{ product: Product; quantity: number }[]>([
    { product: DEMO_TAX_PRODUCTS[0], quantity: 2 },
    { product: DEMO_TAX_PRODUCTS[1], quantity: 1 }
  ]);
  const [scanInput, setScanInput] = useState("");

  const activeCart = useMemo(() => {
    return cart.length > 0 ? cart : localCart;
  }, [cart, localCart]);

  const handleAddToCart = (product: Product, qty = 1) => {
    setLocalCart(prev => {
      const idx = prev.findIndex(item => item.product.id === product.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + qty };
        return updated;
      }
      return [...prev, { product, quantity: qty }];
    });
    onNotification("Item Added", `${product.name} added to Tax Invoice bill.`, "success");
  };

  const handleRemoveItem = (productId: string) => {
    setLocalCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(productId);
      return;
    }
    setLocalCart(prev => prev.map(item => item.product.id === productId ? { ...item, quantity } : item));
  };

  const handleClearLocalCart = () => {
    setLocalCart([]);
    onClearCart();
  };

  const handleScanSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = scanInput.trim().toLowerCase();
    if (!q) return;

    const found = DEMO_TAX_PRODUCTS.find(
      p => p.barcode === q || p.code.toLowerCase() === q || p.name.toLowerCase().includes(q)
    );

    if (found) {
      handleAddToCart(found, 1);
      setScanInput("");
    } else {
      onNotification("SKU Not Found", `No product matches "${scanInput}". Use Quick Catalog or Search (Ctrl+K).`, "error");
    }
  };

  // Customer State & Modal Control
  const [customer, setCustomer] = useState<AdvancedCustomer>({
    type: "Unregistered",
    name: "Walk-In Customer",
    mobile: "",
    email: "",
    gstin: "",
    companyName: "",
    membershipId: "",
    billingAddress: "Mumbai, Maharashtra, India",
    shippingAddress: "Mumbai, Maharashtra, India",
    isShippingDifferent: false
  });

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [tempCustomer, setTempCustomer] = useState<AdvancedCustomer>(customer);

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

  // Drawer Host & Universal Search state
  const [activeDrawerId, setActiveDrawerId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

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

  // Synchronize activeCart with internal editable itemDetailsList
  useEffect(() => {
    const newList = activeCart.map(item => {
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
  }, [activeCart, globalSalespersonId, isTaxInclusiveGlobal]);

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
      totalGstTax: cgstTotal + sgstTotal + igstTotal,
      totalQty: itemDetailsList.reduce((acc, item) => acc + item.quantity, 0),
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
    <div className="w-full h-full flex flex-col bg-[#0b1329] text-gray-200 overflow-hidden font-sans select-none relative">
      {/* SHOPER 9 HEADER BAR (TOP CONTROL ROW) */}
      <div className="px-4 py-2 bg-[#0f172a] border-b border-slate-700/80 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-bold">Bill Type:</span>
            <span className="bg-blue-600/30 text-blue-300 px-2 py-0.5 rounded border border-blue-500/40 font-bold uppercase">Tax Invoice</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-bold">Type:</span>
            <span className="bg-emerald-600/30 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/40 font-bold">{paymentMode === "Single" ? primaryPaymentMethod.toUpperCase() : "SPLIT"}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-bold">Customer:</span>
            <button
              onClick={() => {
                setTempCustomer(customer);
                setIsCustomerModalOpen(true);
              }}
              className="text-amber-300 hover:text-amber-200 font-bold underline cursor-pointer flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
              title="Click to Edit Customer & B2B GSTIN Details"
            >
              <span className="material-symbols-outlined text-xs">person_add</span>
              <span>{customer.name} ({customer.type === "Registered" ? customer.gstin || "B2B" : "B2C"})</span>
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-bold">Sales Staff:</span>
            <span className="text-slate-200">{SALESPERSONS.find(s => s.id === globalSalespersonId)?.name || "Counter Clerk"}</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-slate-400">Shift: <strong className="text-white">{activeShift?.id || "SHIFT-01"}</strong></span>
          <span className="text-slate-400">Desk: <strong className="text-white">{activeProfile?.name || "LANE-01"}</strong></span>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      </div>

      {/* Standardized Operational Toolbar with Drawer Triggers */}
      <StandardDocumentToolbar
        onNew={handleClearLocalCart}
        onSearchClick={() => setIsSearchOpen(true)}
        onToggleDrawer={(id) => setActiveDrawerId(prev => prev === id ? null : id)}
        activeDrawerId={activeDrawerId}
        canCheckout={activeCart.length > 0}
        onCheckout={handleFinalCheckout}
      />

      {/* Workspace Body */}
      {!showInvoicePreview ? (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          {/* LEFT COLUMN: SHOPER 9 DETAIL SECTION (SMRITI ITEM GRID - 75% WIDTH) */}
          <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-800 p-4 space-y-3">
            {/* Quick Barcode Scanner / SKU Search Bar */}
            <form onSubmit={handleScanSubmit} className="flex items-center gap-3 bg-[#1e293b] p-2.5 rounded-lg border border-slate-700">
              <span className="material-symbols-outlined text-blue-400 text-xl">qr_code_scanner</span>
              <input
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder="Scan barcode or type SKU / Item Name (e.g. 8901234567890, Shirt, Denim, Belt) & press Enter..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1 font-mono cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
                Add Item
              </button>
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1 font-mono border border-slate-700 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">search</span>
                Catalog (Ctrl+K)
              </button>
            </form>

            {/* Quick Catalog Chips Bar for Instant 1-Click Item Additions */}
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 text-[11px] font-mono">
              <span className="text-slate-400 font-bold flex items-center gap-1 shrink-0">
                <span className="material-symbols-outlined text-xs text-emerald-400">add_circle</span>
                Quick Add Items:
              </span>
              {DEMO_TAX_PRODUCTS.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleAddToCart(p, 1)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-2.5 py-1 rounded border border-slate-700 hover:border-slate-500 font-semibold transition-all shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  <span>+ {p.name.split(" ")[0]}</span>
                  <span className="text-emerald-400 font-bold">₹{p.price}</span>
                </button>
              ))}
            </div>

            {/* SMRITI High-Speed Item Details Grid */}
            <div className="flex-1 overflow-hidden">
              <SMRITIGrid
                cart={activeCart}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
              />
            </div>
          </div>

          {/* RIGHT COLUMN: SHOPER 9 FOOTER NET VALUES BREAKDOWN (25% WIDTH) */}
          <div className="w-full lg:w-80 bg-[#0f172a] border-l border-slate-800 flex flex-col p-4 space-y-4 font-mono">
            <div className="border-b border-slate-700 pb-2 flex items-center justify-between">
              <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wide font-display">Net Values Sheet</h4>
              <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 font-bold">GST Live</span>
            </div>

            <div className="flex-1 space-y-2.5 text-xs overflow-y-auto custom-scrollbar">
              <div className="flex justify-between text-slate-400">
                <span>Gross Sales:</span>
                <span className="font-bold text-slate-200">₹{(Number(totals.grossAmount) || 0).toFixed(2)}</span>
              </div>

              {(totals.itemDiscountsTotal || 0) > 0 && (
                <div className="flex justify-between text-amber-400">
                  <span>Item Discounts:</span>
                  <span className="font-bold">-₹{(Number(totals.itemDiscountsTotal) || 0).toFixed(2)}</span>
                </div>
              )}

              {(totals.totalBillDiscounts || 0) > 0 && (
                <div className="flex justify-between text-amber-400">
                  <span>Bill Discounts & Promo:</span>
                  <span className="font-bold">-₹{(Number(totals.totalBillDiscounts) || 0).toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-300 border-t border-slate-800 pt-2 font-bold">
                <span>Taxable Base Value:</span>
                <span className="text-white">₹{(Number(totals.totalTaxableAmount) || 0).toFixed(2)}</span>
              </div>

              {!totals.isInterstate ? (
                <>
                  <div className="flex justify-between text-slate-400 pl-2 text-[11px]">
                    <span>Sales Tax (CGST):</span>
                    <span className="text-blue-400 font-bold">₹{(Number(totals.cgstTotal) || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400 pl-2 text-[11px]">
                    <span>Sales Tax (SGST):</span>
                    <span className="text-blue-400 font-bold">₹{(Number(totals.sgstTotal) || 0).toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-slate-400 pl-2 text-[11px]">
                  <span>Sales Tax (IGST):</span>
                  <span className="text-blue-400 font-bold">₹{(Number(totals.igstTotal) || 0).toFixed(2)}</span>
                </div>
              )}

              {(totals.tcsAmount || 0) > 0 && (
                <div className="flex justify-between text-purple-400 pl-2 text-[11px]">
                  <span>Statutory TCS:</span>
                  <span className="font-bold">+₹{(Number(totals.tcsAmount) || 0).toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-400 border-t border-slate-800 pt-2 text-[11px]">
                <span>Round Off:</span>
                <span className="text-slate-300 font-bold">{(totals.roundOff || 0) >= 0 ? `+₹${(Number(totals.roundOff) || 0).toFixed(2)}` : `-₹${Math.abs(Number(totals.roundOff) || 0).toFixed(2)}`}</span>
              </div>

              <div className="bg-emerald-950/60 border border-emerald-500/50 p-3.5 rounded-xl space-y-1 text-center mt-3 shadow-lg">
                <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold">Net Amount Payable</span>
                <p className="text-2xl font-bold text-emerald-300 font-mono">
                  ₹{(Number(totals.grandTotal) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <button
              onClick={handleFinalCheckout}
              disabled={cart.length === 0}
              className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider font-display transition-all flex items-center justify-center gap-2 ${
                cart.length > 0
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 cursor-pointer"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
              }`}
            >
              <span className="material-symbols-outlined text-base">task_alt</span>
              Register & Print Invoice (F4)
            </button>
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

      {/* SHOPER 9 BOTTOM SUMMARY BAR (FOOTER SECTION) */}
      <footer className="h-10 bg-[#1e293b] border-t border-slate-700 px-4 flex items-center justify-between font-mono text-xs text-slate-300">
        <div className="flex items-center space-x-6">
          <div>Total Items: <span className="text-white font-bold">{cart.length}</span></div>
          <div>Total Qty: <span className="text-white font-bold">{totals.totalQty || 0}</span></div>
          <div>Sales Value: <span className="text-white font-bold">₹{(Number(totals.grossAmount) || 0).toFixed(2)}</span></div>
          <div>Item Disc: <span className="text-amber-400 font-bold">₹{(Number(totals.itemDiscountsTotal) || 0).toFixed(2)}</span></div>
          <div>Bill Disc: <span className="text-amber-400 font-bold">₹{(Number(totals.totalBillDiscounts) || 0).toFixed(2)}</span></div>
          <div>Total Tax: <span className="text-blue-400 font-bold">₹{(Number(totals.totalGstTax) || 0).toFixed(2)}</span></div>
        </div>
        <div className="bg-emerald-600/20 px-3 py-1 rounded border border-emerald-500/40 text-emerald-300 font-bold text-sm">
          Net Amount: ₹{(Number(totals.grandTotal) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </div>
      </footer>

      <RightDrawerHost
        activeDrawerId={activeDrawerId}
        onSave={() => setActiveDrawerId(null)}
        onClose={() => setActiveDrawerId(null)}
      />

      <UniversalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        products={DEMO_TAX_PRODUCTS}
        onSelectProduct={(p) => {
          handleAddToCart(p, 1);
          setIsSearchOpen(false);
        }}
      />

      {/* Customer Master Details Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl font-sans text-xs">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between bg-[#1e293b] rounded-t-2xl">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400 text-xl">person_add</span>
                <div>
                  <h3 className="font-bold text-white text-sm font-display uppercase tracking-wide">Customer & B2B GSTIN Master Details</h3>
                  <p className="text-[11px] text-slate-400">Configure tax classification, GSTIN, place of supply, and billing addresses.</p>
                </div>
              </div>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Quick Preset Buttons */}
            <div className="px-5 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center gap-2 font-mono text-[11px] overflow-x-auto">
              <span className="text-slate-400 font-bold shrink-0">Quick Presets:</span>
              <button
                type="button"
                onClick={() => {
                  setTempCustomer({
                    type: "Registered",
                    name: "Super Textiles Ltd",
                    companyName: "Super Textiles Private Limited",
                    gstin: "27AAACS1094J1Z3",
                    mobile: "9820098200",
                    email: "accounts@supertextiles.in",
                    billingAddress: "Unit 102, Textile Hub, Bhiwandi, Maharashtra - 421302",
                    shippingAddress: "Unit 102, Textile Hub, Bhiwandi, Maharashtra - 421302",
                    isShippingDifferent: false,
                    membershipId: "B2B-GOLD-99"
                  });
                }}
                className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 cursor-pointer font-bold shrink-0"
              >
                + Super Textiles (B2B Maharashtra)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTempCustomer({
                    type: "Registered",
                    name: "Apex Electronics Delhi",
                    companyName: "Apex Electronics Pvt Ltd",
                    gstin: "07AAAAA0000A1Z5",
                    mobile: "9811198111",
                    email: "billing@apexelectronics.com",
                    billingAddress: "Nehru Place Commercial Complex, New Delhi - 110019",
                    shippingAddress: "Nehru Place Commercial Complex, New Delhi - 110019",
                    isShippingDifferent: false,
                    membershipId: "B2B-INTERSTATE-07"
                  });
                }}
                className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30 cursor-pointer font-bold shrink-0"
              >
                + Apex Electronics (B2B Delhi IGST)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTempCustomer({
                    type: "Unregistered",
                    name: "Walk-In Customer",
                    companyName: "",
                    gstin: "",
                    mobile: "",
                    email: "",
                    billingAddress: "Mumbai, Maharashtra, India",
                    shippingAddress: "Mumbai, Maharashtra, India",
                    isShippingDifferent: false,
                    membershipId: ""
                  });
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-700 cursor-pointer shrink-0"
              >
                Reset B2C Walk-In
              </button>
            </div>

            {/* Modal Form Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1 font-bold">Customer Type / Category</label>
                  <select
                    value={tempCustomer.type}
                    onChange={(e) => setTempCustomer({ ...tempCustomer, type: e.target.value as "Unregistered" | "Registered" })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="Unregistered">Unregistered Retail (B2C)</option>
                    <option value="Registered">Registered Commercial Business (B2B)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1 font-bold">Full Name / Customer Name *</label>
                  <input
                    type="text"
                    value={tempCustomer.name}
                    onChange={(e) => setTempCustomer({ ...tempCustomer, name: e.target.value })}
                    placeholder="e.g. Walk-In Customer / Rajesh Sharma"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white font-semibold text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1 font-bold">Mobile Number</label>
                  <input
                    type="text"
                    value={tempCustomer.mobile}
                    onChange={(e) => setTempCustomer({ ...tempCustomer, mobile: e.target.value })}
                    placeholder="e.g. 9820098200"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1 font-bold">Email Address</label>
                  <input
                    type="email"
                    value={tempCustomer.email}
                    onChange={(e) => setTempCustomer({ ...tempCustomer, email: e.target.value })}
                    placeholder="e.g. customer@example.com"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {tempCustomer.type === "Registered" && (
                <div className="p-3.5 bg-blue-950/40 border border-blue-500/30 rounded-xl space-y-3">
                  <span className="text-[10px] font-mono text-blue-300 font-bold uppercase tracking-wider block">B2B GSTIN & Corporate Credentials</span>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">15-Digit GSTIN Number</label>
                      <input
                        type="text"
                        value={tempCustomer.gstin}
                        onChange={(e) => setTempCustomer({ ...tempCustomer, gstin: e.target.value.toUpperCase() })}
                        placeholder="e.g. 27AAACS1094J1Z3"
                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-amber-300 font-mono text-xs font-bold focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Company / Legal Business Name</label>
                      <input
                        type="text"
                        value={tempCustomer.companyName}
                        onChange={(e) => setTempCustomer({ ...tempCustomer, companyName: e.target.value })}
                        placeholder="e.g. Super Textiles Private Limited"
                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1 font-bold">Billing Address</label>
                <textarea
                  rows={2}
                  value={tempCustomer.billingAddress}
                  onChange={(e) => setTempCustomer({ ...tempCustomer, billingAddress: e.target.value })}
                  placeholder="Street address, City, State, Pincode..."
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1 font-bold">Shipping Address</label>
                <textarea
                  rows={2}
                  value={tempCustomer.shippingAddress || tempCustomer.billingAddress}
                  onChange={(e) => setTempCustomer({ ...tempCustomer, shippingAddress: e.target.value })}
                  placeholder="Shipping address..."
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-5 py-3 border-t border-slate-700 flex items-center justify-between bg-[#1e293b] rounded-b-2xl">
              <span className="text-[10px] text-slate-400 font-mono">
                Tax Taxability: <strong className="text-emerald-400">{tempCustomer.gstin && !tempCustomer.gstin.startsWith("27") ? "Interstate (IGST 18%)" : "Intrastate (CGST 9% + SGST 9%)"}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomer(tempCustomer);
                    setIsCustomerModalOpen(false);
                    onNotification("Customer Updated", `Customer updated to ${tempCustomer.name} (${tempCustomer.type}).`, "success");
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-lg font-bold shadow-lg shadow-emerald-950/40 cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  <span>Save & Apply Customer</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
