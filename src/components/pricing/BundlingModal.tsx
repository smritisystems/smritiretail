/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.112.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import BundlingEngine, {
  BundleConfig, BundleType, CartItem,
} from "../../utils/bundlingEngine";

interface BundlingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const TYPE_STYLE: Record<BundleType, string> = {
  FIXED_BUNDLE:    "text-violet-300 bg-violet-500/15 border-violet-500/25",
  COMBO_DISCOUNT:  "text-sky-300 bg-sky-500/15 border-sky-500/25",
  BUY_X_GET_Y:     "text-emerald-300 bg-emerald-500/15 border-emerald-500/25",
};

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const SAMPLE_CART: CartItem[] = [
  { sku: "FAB-DENIM-BLU",  productName: "Denim Blue 1m",    mrp: 250, qty: 0, availableQty: 10 },
  { sku: "FAB-COTTON-WHT", productName: "Cotton White 1m",  mrp: 120, qty: 0, availableQty: 15 },
  { sku: "ACC-BELT-BRN",   productName: "Leather Belt",     mrp: 350, qty: 0, availableQty: 5  },
  { sku: "ACC-SCARF-BLUE", productName: "Blue Scarf",       mrp: 180, qty: 0, availableQty: 8  },
  { sku: "FAB-LINEN-WHT",  productName: "Linen White 1m",   mrp: 180, qty: 0, availableQty: 12 },
];

function buildSampleBundles(): BundleConfig[] {
  return [
    BundlingEngine.createBundle({
      name: "Fabric Combo Pack", description: "Denim + Cotton — 10% off",
      type: "COMBO_DISCOUNT", discountPct: 10,
      components: [
        { sku: "FAB-DENIM-BLU",  productName: "Denim Blue 1m",  mrp: 250, requiredQty: 2 },
        { sku: "FAB-COTTON-WHT", productName: "Cotton White 1m", mrp: 120, requiredQty: 3 },
      ],
      validFrom: "2026-01-01", validTo: "2026-12-31",
    }),
    BundlingEngine.createBundle({
      name: "Accessories Value Pack", description: "Belt + Scarf — fixed ₹450",
      type: "FIXED_BUNDLE", fixedPrice: 450,
      components: [
        { sku: "ACC-BELT-BRN",   productName: "Leather Belt", mrp: 350, requiredQty: 1 },
        { sku: "ACC-SCARF-BLUE", productName: "Blue Scarf",   mrp: 180, requiredQty: 1 },
      ],
      validFrom: "2026-01-01", validTo: "2026-12-31",
    }),
    BundlingEngine.createBundle({
      name: "Buy 2 Linen Get 1 Free", description: "Buy 2, get 1 free",
      type: "BUY_X_GET_Y",
      components: [
        { sku: "FAB-LINEN-WHT", productName: "Linen White 1m", mrp: 180, requiredQty: 2, freeQty: 1 },
      ],
      validFrom: "2026-01-01", validTo: "2026-12-31",
    }),
  ];
}

export const BundlingModal: React.FC<BundlingModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [bundles]       = useState<BundleConfig[]>(buildSampleBundles);
  const [cart, setCart] = useState<CartItem[]>(SAMPLE_CART);
  const [selectedId, setSelectedId] = useState(bundles[0]?.bundleId ?? "");
  const NOW = useMemo(() => new Date("2026-08-28T00:00:00.000Z"), []);

  const selected = bundles.find((b) => b.bundleId === selectedId);
  const pricing  = useMemo(() => selected ? BundlingEngine.computePricing(selected, cart) : null, [selected, cart]);
  const applicable = useMemo(() => BundlingEngine.findApplicableBundles(bundles, cart, NOW), [bundles, cart, NOW]);

  if (!isOpen) return null;

  const handleApply = () => {
    if (!selected || !pricing?.eligible) return;
    try {
      const result = BundlingEngine.applyBundleToCart(selected, cart, NOW);
      setCart(result.updatedCart);
      onNotification?.("Bundle Applied", `${selected.name} — saved ${fmt(result.totalSavings)}`, "success");
    } catch (e: any) {
      onNotification?.("Error", e.message, "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-2xl">ðŸŽ</div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Product Bundling & Combo Pricing Engine</h2>
              <p className="text-xs text-slate-400">Fixed Bundle · Combo Discount · Buy X Get Y · Cart Apply</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{applicable.length} bundle(s) applicable to cart</span>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Bundle sidebar */}
          <div className="w-60 border-r border-slate-800 overflow-y-auto bg-slate-950/30 p-3 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-600 px-1 mb-1">All Bundles</p>
            {bundles.map((b) => {
              const p = BundlingEngine.computePricing(b, cart);
              return (
                <button key={b.bundleId} onClick={() => setSelectedId(b.bundleId)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${selectedId === b.bundleId ? "bg-violet-950/20 border-violet-500/40" : "border-transparent hover:bg-slate-800/60"}`}>
                  <p className="text-xs font-medium text-slate-200">{b.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{b.description}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${TYPE_STYLE[b.type]}`}>
                      {b.type.replace(/_/g, " ")}
                    </span>
                    <span className={`text-[10px] font-mono font-bold ${p.eligible ? "text-emerald-400" : "text-rose-400"}`}>
                      {p.eligible ? `Save ${fmt(p.discountAmt)}` : "Ineligible"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {selected && pricing && (
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <p className="text-lg font-bold text-slate-100">{selected.name}</p>
                  <p className="text-xs text-slate-400">{selected.description} · {selected.bundleCode}</p>
                  <p className="text-[10px] text-slate-500">Valid: {selected.validFrom} → {selected.validTo}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${TYPE_STYLE[selected.type]}`}>
                    {selected.type.replace(/_/g, " ")}
                  </span>
                  {pricing.eligible ? (
                    <button onClick={handleApply}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 transition-all">
                      Apply to Cart
                    </button>
                  ) : (
                    <span className="text-xs text-rose-400 font-bold">Insufficient stock: {pricing.ineligibleSkus.join(", ")}</span>
                  )}
                </div>
              </div>

              {/* Price summary */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Sum MRP",      value: fmt(pricing.sumMRP),        color: "text-slate-400 line-through" },
                  { label: "Discount",     value: fmt(pricing.discountAmt),   color: "text-rose-400" },
                  { label: "Bundle Price", value: fmt(pricing.bundlePrice),   color: "text-violet-400 text-lg font-black" },
                  { label: "You Save",     value: `${pricing.savingsPct}%`,   color: "text-emerald-400" },
                ].map((m) => (
                  <div key={m.label} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-3 text-center">
                    <div className={`font-bold font-mono ${m.color}`}>{m.value}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Component lines */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Bundle Components</p>
                <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead><tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800 bg-slate-950/60">
                      <th className="py-2 px-3">Product</th>
                      <th className="py-2 px-3 text-right">MRP</th>
                      <th className="py-2 px-3 text-right">Qty</th>
                      <th className="py-2 px-3 text-right">Free</th>
                      <th className="py-2 px-3 text-right">Eff. Price</th>
                      <th className="py-2 px-3 text-right">Line Total</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-800/40 font-mono">
                      {pricing.componentLines.map((l) => (
                        <tr key={l.sku}>
                          <td className="py-2 px-3 font-sans"><p className="text-xs text-slate-200">{l.productName}</p><p className="text-[10px] text-slate-500">{l.sku}</p></td>
                          <td className="py-2 px-3 text-right text-slate-500 line-through">{fmt(l.mrp)}</td>
                          <td className="py-2 px-3 text-right text-slate-300">{l.qty}</td>
                          <td className="py-2 px-3 text-right text-emerald-400">{l.freeQty > 0 ? `+${l.freeQty}` : "—"}</td>
                          <td className="py-2 px-3 text-right text-violet-400">{fmt(l.effectivePrice)}</td>
                          <td className="py-2 px-3 text-right text-slate-200">{fmt(l.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Cart stock levels */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Cart Stock Availability</p>
                <div className="grid grid-cols-2 gap-2">
                  {cart.map((item) => {
                    const isComponent = selected.components.some((c) => c.sku === item.sku);
                    return (
                      <div key={item.sku} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${isComponent ? "bg-violet-950/15 border-violet-500/25" : "bg-slate-800/20 border-slate-800/30"}`}>
                        <span className="text-slate-300 truncate">{item.productName}</span>
                        <span className={`font-mono font-bold ml-2 ${item.availableQty > 0 ? "text-emerald-400" : "text-rose-400"}`}>{item.availableQty} avail</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default BundlingModal;

