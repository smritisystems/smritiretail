/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.99.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import PricingDiscountEngine, {
  PromotionalOffer,
  CustomerGroupPrice,
  CouponCode,
  PriceListEntry,
  InvoicePricingResult,
  PRICING_CONFIG,
} from "../../utils/pricingDiscountEngine";

interface PricingStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const AS_OF = new Date("2026-08-28T12:00:00.000Z");

const SAMPLE_OFFERS: PromotionalOffer[] = [
  { offerId: "PROMO-001", offerName: "Monsoon Sale 20%", discountType: "PERCENTAGE", discountValue: 20, applicableSkus: [], applicableGroups: [], validFrom: "2026-08-01T00:00:00Z", validTo: "2026-08-31T23:59:59Z", status: "ACTIVE", priority: 1, isStackable: true },
  { offerId: "PROMO-002", offerName: "Weekend Flash 10%", discountType: "PERCENTAGE", discountValue: 10, applicableSkus: ["APP-POLO-NAVY-M", "APP-POLO-WHT-M"], applicableGroups: [], validFrom: "2026-08-28T00:00:00Z", validTo: "2026-08-28T23:59:59Z", status: "ACTIVE", priority: 2, isStackable: true },
  { offerId: "PROMO-003", offerName: "VIP Flat â‚¹500 Off", discountType: "FLAT_AMOUNT", discountValue: 500, applicableSkus: [], applicableGroups: ["VIP"], validFrom: "2026-08-01T00:00:00Z", validTo: "2026-08-31T23:59:59Z", status: "ACTIVE", priority: 3, isStackable: false },
  { offerId: "PROMO-004", offerName: "Clearance 30%", discountType: "PERCENTAGE", discountValue: 30, applicableSkus: ["CLR-JACKET-BLK-L"], applicableGroups: [], validFrom: "2026-08-01T00:00:00Z", validTo: "2026-09-30T23:59:59Z", status: "ACTIVE", priority: 4, isStackable: true },
];

const SAMPLE_GROUP_PRICES: CustomerGroupPrice[] = [
  { customerGroup: "VIP",       sku: "APP-POLO-NAVY-M", unitPrice: 850 },
  { customerGroup: "WHOLESALE", sku: "APP-POLO-NAVY-M", unitPrice: 0, discountPct: 15 },
  { customerGroup: "STAFF",     sku: "APP-POLO-NAVY-M", unitPrice: 700 },
];

const SAMPLE_COUPON: CouponCode = {
  code: "SMRITI200", discountType: "FLAT_AMOUNT", discountValue: 200,
  maxUsages: 500, usedCount: 12,
  validFrom: "2026-08-01T00:00:00Z", validTo: "2026-08-31T23:59:59Z",
  isActive: true,
};

const CART_LINES = [
  { sku: "APP-POLO-NAVY-M",   label: "Polo Shirt Navy M",      qty: 3, price: 1000 },
  { sku: "APP-POLO-WHT-M",    label: "Polo Shirt White M",     qty: 2, price: 1000 },
  { sku: "CLR-JACKET-BLK-L",  label: "Clearance Jacket BLK L", qty: 1, price: 3500 },
];

const GROUPS = ["", "VIP", "WHOLESALE", "STAFF", "STANDARD"];

export const PricingStudioModal: React.FC<PricingStudioModalProps> = ({ isOpen, onClose }) => {
  const [customerGroup, setCustomerGroup] = useState<string>("VIP");
  const [couponCode, setCouponCode] = useState<string>("SMRITI200");
  const [applyCoupon, setApplyCoupon] = useState(true);
  const [activeTab, setActiveTab] = useState<"INVOICE" | "OFFERS" | "TRACE">("INVOICE");

  const couponObj = applyCoupon && couponCode === SAMPLE_COUPON.code ? SAMPLE_COUPON : undefined;

  const invoice: InvoicePricingResult = useMemo(() =>
    PricingDiscountEngine.resolveInvoice(
      CART_LINES.map((l) => ({
        sku: l.sku, qty: l.qty, baseUnitPrice: l.price,
        customerGroup: customerGroup || undefined,
        priceLists: [] as PriceListEntry[],
        customerGroupPrices: SAMPLE_GROUP_PRICES,
        activeOffers: SAMPLE_OFFERS,
      })),
      { coupon: couponObj, asOf: AS_OF }
    ),
    [customerGroup, couponObj]
  );

  const activeOffers = PricingDiscountEngine.getActiveOffers(SAMPLE_OFFERS, AS_OF);
  const couponValid = PricingDiscountEngine.validateCoupon(SAMPLE_COUPON, AS_OF);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-lime-500/10 border border-lime-500/20 flex items-center justify-center text-lime-400">
              <span className="material-symbols-outlined text-2xl">sell</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Advanced Pricing Rules & Promotional Discount Engine</h2>
              <p className="text-xs text-slate-400">4-Layer Hierarchy Â· Customer Group Â· Promo Offers Â· Coupon Stacking Â· 40% Cap</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["INVOICE", "OFFERS", "TRACE"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === tab ? "bg-lime-500/20 text-lime-300 border border-lime-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {tab}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Controls Strip */}
        <div className="flex items-center gap-4 px-6 py-3 border-b border-slate-800 bg-slate-950/30 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-wide">Customer Group</span>
            <select value={customerGroup} onChange={(e) => setCustomerGroup(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-lime-500/60">
              {GROUPS.map((g) => <option key={g} value={g}>{g || "Standard (no group)"}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-wide">Coupon</span>
            <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)}
              className="w-32 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-lime-500/60" />
            <button onClick={() => setApplyCoupon((p) => !p)}
              className={`px-3 py-1.5 text-xs rounded-lg font-bold transition-all ${applyCoupon ? "bg-lime-500/20 text-lime-300 border border-lime-500/30" : "text-slate-500 border border-slate-700"}`}>
              {applyCoupon ? "Applied" : "Apply"}
            </button>
          </div>
          {invoice.capBreached && (
            <span className="ml-auto text-[10px] font-bold text-rose-300 bg-rose-500/20 border border-rose-500/30 px-2 py-1 rounded-lg">
              âš  40% Discount Cap Applied
            </span>
          )}
        </div>

        {activeTab === "INVOICE" && (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Summary strip */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Subtotal", value: `â‚¹${invoice.subtotal.toLocaleString("en-IN")}`, color: "text-slate-300" },
                { label: "Promo Discount", value: `-â‚¹${invoice.totalPromoDiscount.toLocaleString("en-IN")}`, color: "text-lime-400" },
                { label: "Coupon Discount", value: `-â‚¹${invoice.totalCouponDiscount.toLocaleString("en-IN")}`, color: couponObj ? "text-yellow-400" : "text-slate-600" },
                { label: "Grand Total", value: `â‚¹${invoice.grandTotal.toLocaleString("en-IN")}`, color: "text-emerald-400" },
              ].map((m) => (
                <div key={m.label} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 text-center">
                  <div className={`text-xl font-black font-mono ${m.color}`}>{m.value}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
                </div>
              ))}
            </div>

            {/* Line items */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead><tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800 bg-slate-950/60">
                  <th className="py-2 px-3">Product</th>
                  <th className="py-2 px-3 text-right">Qty</th>
                  <th className="py-2 px-3 text-right">Base</th>
                  <th className="py-2 px-3 text-right">Group</th>
                  <th className="py-2 px-3 text-right">Promo</th>
                  <th className="py-2 px-3 text-right">Coupon</th>
                  <th className="py-2 px-3 text-right">Total</th>
                  <th className="py-2 px-3">Offer</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {invoice.lines.map((line) => {
                    const cartLine = CART_LINES.find((c) => c.sku === line.sku);
                    return (
                      <tr key={line.sku}>
                        <td className="py-2 px-3 font-sans text-slate-200">{cartLine?.label ?? line.sku}</td>
                        <td className="py-2 px-3 text-right text-slate-400">{line.qty}</td>
                        <td className="py-2 px-3 text-right text-slate-500">â‚¹{line.baseUnitPrice}</td>
                        <td className="py-2 px-3 text-right text-slate-300">â‚¹{line.groupUnitPrice}</td>
                        <td className="py-2 px-3 text-right text-lime-400">{line.promoDiscount > 0 ? `-â‚¹${line.promoDiscount}` : "â€”"}</td>
                        <td className="py-2 px-3 text-right text-yellow-400">{line.couponDiscount > 0 ? `-â‚¹${line.couponDiscount}` : "â€”"}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-100">â‚¹{line.finalLineTotal.toLocaleString("en-IN")}</td>
                        <td className="py-2 px-3">
                          {line.appliedOffer && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-lime-500/10 text-lime-300 border border-lime-500/20 truncate max-w-[100px] block">
                              {line.appliedOffer.offerName}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="border-t border-slate-800 px-4 py-2 flex items-center justify-between text-xs">
                <span className="text-slate-400">Effective Discount: <strong className="text-lime-400">{invoice.discountPct}%</strong></span>
                <span className="font-black text-lg font-mono text-emerald-400">â‚¹{invoice.grandTotal.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "OFFERS" && (
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Active Promotional Offers ({activeOffers.length})</p>
            {SAMPLE_OFFERS.map((o) => {
              const isActive = o.status === "ACTIVE" && new Date(o.validFrom) <= AS_OF && new Date(o.validTo) >= AS_OF;
              return (
                <div key={o.offerId} className={`rounded-xl p-4 border ${isActive ? "bg-slate-800/30 border-slate-700/60" : "bg-slate-900/20 border-slate-800/40 opacity-50"}`}>
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${isActive ? "text-lime-300 bg-lime-500/20 border-lime-500/30" : "text-slate-500 bg-slate-700/30 border-slate-600/30"}`}>{o.status}</span>
                      <span className="text-xs font-bold text-slate-200">{o.offerName}</span>
                    </div>
                    <span className="text-sm font-black text-lime-400 font-mono">
                      {o.discountType === "PERCENTAGE" ? `${o.discountValue}% OFF` : `â‚¹${o.discountValue} OFF`}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-500">
                    <span>Priority: {o.priority}</span>
                    <span>SKUs: {o.applicableSkus.length === 0 ? "All" : o.applicableSkus.join(", ")}</span>
                    <span>Groups: {o.applicableGroups.length === 0 ? "All" : o.applicableGroups.join(", ")}</span>
                    <span>Valid: {new Date(o.validFrom).toLocaleDateString("en-IN")} â†’ {new Date(o.validTo).toLocaleDateString("en-IN")}</span>
                    <span>Stackable: {o.isStackable ? "Yes" : "No"}</span>
                  </div>
                </div>
              );
            })}
            {/* Coupon section */}
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-4 mb-1">Active Coupon</p>
            <div className={`rounded-xl p-4 border ${couponValid.valid ? "bg-slate-800/30 border-slate-700/60" : "bg-rose-950/20 border-rose-500/30"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-100 font-mono">{SAMPLE_COUPON.code}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {SAMPLE_COUPON.discountType === "FLAT_AMOUNT" ? `â‚¹${SAMPLE_COUPON.discountValue} flat` : `${SAMPLE_COUPON.discountValue}%`}
                    {" Â· "}Used: {SAMPLE_COUPON.usedCount}/{SAMPLE_COUPON.maxUsages}
                  </p>
                </div>
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${couponValid.valid ? "text-lime-300 bg-lime-500/20 border-lime-500/30" : "text-rose-300 bg-rose-500/20 border-rose-500/30"}`}>
                  {couponValid.valid ? "Valid" : couponValid.reason}
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "TRACE" && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Pricing Resolution Trace</p>
            {invoice.lines.map((line) => {
              const cartLine = CART_LINES.find((c) => c.sku === line.sku);
              return (
                <div key={line.sku} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4">
                  <p className="text-xs font-bold text-slate-200 mb-3">{cartLine?.label ?? line.sku}</p>
                  <div className="space-y-1.5">
                    {line.resolutionTrace.map((step, i) => (
                      <div key={i} className="flex items-start gap-2 text-[11px]">
                        <span className={`font-bold font-mono flex-shrink-0 ${
                          step.startsWith("[L1]") ? "text-slate-500" :
                          step.startsWith("[L2]") ? "text-sky-400" :
                          step.startsWith("[L3]") ? "text-lime-400" : "text-yellow-400"
                        }`}>{step.slice(0, 4)}</span>
                        <span className="text-slate-400">{step.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/60 text-xs">
                    <span className="text-slate-500">Total discount: <span className="text-lime-400 font-bold font-mono">â‚¹{line.totalLineDiscount}</span></span>
                    <span className="font-black text-slate-100 font-mono">â‚¹{line.finalLineTotal.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default PricingStudioModal;

