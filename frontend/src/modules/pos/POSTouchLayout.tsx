/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 12.0.0
 * Created      : 2026-07-28
 * Modified     : 2026-07-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * POSTouchLayout.tsx — Touch-Screen Quick Billing POS Interface Component
 */

import React, { useState } from 'react';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

export const POSTouchLayout: React.FC = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');

  const quickProducts = [
    { id: 'p1', name: 'Paracetamol 500mg', price: 25.0 },
    { id: 'p2', name: 'Amoxicillin 250mg', price: 120.0 },
    { id: 'p3', name: 'Cotton Roll 100g', price: 45.0 },
    { id: 'p4', name: 'ORSL Liquid 200ml', price: 35.0 },
  ];

  const addToCart = (product: { id: string; name: string; price: number }) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white font-sans p-4">

      {/* Header */}
      <header className="flex justify-between items-center bg-slate-800 p-4 rounded-xl mb-4 border border-slate-700 shadow-md">
        <h1 className="text-xl font-bold text-emerald-400">SMRITI Touch POS — Quick Billing</h1>
        <div className="text-sm text-slate-300">Terminal: <span className="font-semibold text-white">POS-01</span></div>
      </header>

      {/* Split Grid */}
      <div className="grid grid-cols-12 gap-4 flex-1">
        {/* Left: Quick Grid (8 cols) */}
        <div className="col-span-8 bg-slate-800/80 p-4 rounded-xl border border-slate-700 flex flex-col">
          <input
            type="text"
            placeholder="Scan barcode or search product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full p-3 mb-4 rounded-lg bg-slate-900 border border-slate-600 text-white focus:outline-none focus:border-emerald-500"
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1 overflow-y-auto">
            {quickProducts
              .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
              .map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="p-4 bg-slate-700 hover:bg-emerald-600/90 rounded-xl transition flex flex-col justify-between border border-slate-600 hover:border-emerald-400 shadow"
                >
                  <span className="font-medium text-left line-clamp-2">{product.name}</span>
                  <span className="font-bold text-emerald-300 text-lg mt-2">₹{product.price.toFixed(2)}</span>
                </button>
              ))}
          </div>
        </div>

        {/* Right: Cart Summary (4 cols) */}
        <div className="col-span-4 bg-slate-800/80 p-4 rounded-xl border border-slate-700 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-200 mb-3 border-b border-slate-700 pb-2">Current Cart</h2>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between items-center bg-slate-900 p-3 rounded-lg border border-slate-700">
                  <div>
                    <div className="font-medium text-sm">{item.name}</div>
                    <div className="text-xs text-slate-400">Qty: {item.qty} x ₹{item.price.toFixed(2)}</div>
                  </div>
                  <div className="font-bold text-emerald-400">₹{(item.price * item.qty).toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-700">
            <div className="flex justify-between items-center text-xl font-bold mb-4">
              <span>Grand Total:</span>
              <span className="text-emerald-400">₹{totalAmount.toFixed(2)}</span>
            </div>
            <button
              onClick={() => alert(`Billing completed! Amount: ₹${totalAmount.toFixed(2)}`)}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-lg rounded-xl transition shadow-lg"
            >
              PAY NOW (CASH / UPI)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
