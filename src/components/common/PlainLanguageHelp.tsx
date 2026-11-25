/**
 * Project      : SMRITI Retail OS
 * Author       : SMRITI Systems
 * Version      : 7.0.0
 * Classification: Plain-Language Help
 */

import React, { useState } from "react";

const phrases: Record<string, { simple: string; meaning: string }> = {
  pos: { simple: "Sell items", meaning: "Create a bill, take payment, and print or share it." },
  grn: { simple: "Goods received", meaning: "Confirm products and quantities received from a supplier." },
  hsn: { simple: "Product tax category", meaning: "The tax class used to calculate GST for a product." },
  fifo: { simple: "Use oldest purchase cost", meaning: "The earliest purchase cost is used before newer costs." },
  psv: { simple: "Branch customer stock", meaning: "Stock placed with a customer or branch for later sale." },
  posting: { simple: "Final confirmation", meaning: "Save the transaction permanently and update stock or accounts." },
  reversal: { simple: "Undo or correct", meaning: "Cancel or reverse a transaction through the approved correction process." },
};

export const PlainLanguageHelp: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const matches = Object.entries(phrases).filter(([key, value]) =>
    `${key} ${value.simple} ${value.meaning}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700"
        aria-expanded={open}
      >
        <span className="material-symbols-outlined text-[20px]">help</span>
        Help
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
          <label className="block">
            <span className="mb-2 block text-sm font-bold">What do you want to understand?</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Example: GST or goods received" className="min-h-11 w-full rounded-xl border border-slate-300 px-3" />
          </label>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {matches.map(([key, value]) => (
              <article key={key} className="rounded-xl border border-slate-200 p-3">
                <p className="font-bold text-slate-900">{value.simple}</p>
                <p className="mt-1 text-xs text-slate-500">{value.meaning}</p>
              </article>
            ))}
            {matches.length === 0 && <p className="text-sm text-slate-500">No explanation found. Try another phrase.</p>}
          </div>
        </div>
      )}
    </div>
  );
};
