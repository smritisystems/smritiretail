import React from "react";
import { AlertTriangle, Boxes, CheckCircle2, CircleDashed, Layers, Package, Sparkles, Tag, Truck, Warehouse } from "lucide-react";

interface InventorySummary {
  totalProducts: number;
  totalStockQty: number;
  totalValuation: number;
}

interface ItemMasterStudioContextPanelProps {
  product: any;
  lowStockCount?: number;
  inventorySummary?: InventorySummary;
}

export const ItemMasterStudioContextPanel: React.FC<ItemMasterStudioContextPanelProps> = ({
  product,
  lowStockCount = 0,
  inventorySummary,
}) => {
  const lifecycleSteps = ["Create", "Validate", "Approve", "Purchase", "Receive", "Store", "Sell", "Transfer", "Return", "Archive"];

  return (
    <aside className="w-full lg:w-[320px] xl:w-[360px] border border-theme-divider rounded-xl bg-theme-surface-2 p-3 shadow-xs space-y-3">
      <div className="border-b border-theme-divider pb-2">
        <div className="text-[10px] uppercase tracking-[0.24em] text-theme-muted font-bold">Selected Item</div>
        <div className="mt-1 text-sm font-extrabold text-theme-heading">{product?.name || "No item selected"}</div>
        <div className="text-[11px] text-theme-muted">{product?.code || product?.sku || "Select a SKU to inspect"}</div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-theme-divider p-2">
          <div className="text-theme-muted">Stock</div>
          <div className="font-extrabold text-theme-heading">{product?.stock_qty ?? 0}</div>
        </div>
        <div className="rounded-lg border border-theme-divider p-2">
          <div className="text-theme-muted">MRP</div>
          <div className="font-extrabold text-theme-heading">₹ {product?.mrp ?? product?.price ?? 0}</div>
        </div>
        <div className="rounded-lg border border-theme-divider p-2">
          <div className="text-theme-muted">Buying</div>
          <div className="font-extrabold text-theme-heading">₹ {product?.purchasePrice ?? 0}</div>
        </div>
        <div className="rounded-lg border border-theme-divider p-2">
          <div className="text-theme-muted">Category</div>
          <div className="font-extrabold text-theme-heading">{product?.category || "General"}</div>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
        <div className="font-extrabold flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{lowStockCount} low stock signals</span>
        </div>
        <div className="mt-1 text-[11px]">Replenishment and supplier follow-up should be prioritized.</div>
      </div>

      <div className="rounded-lg border border-theme-divider p-2">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-theme-muted font-bold">
          <Layers className="w-3.5 h-3.5" />
          <span>Lifecycle</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {lifecycleSteps.map((step, index) => (
            <span
              key={step}
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${index <= 2 ? "bg-blue-50 text-blue-700 border-blue-200" : index <= 5 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-theme-surface-2 text-theme-muted border-theme-divider"}`}
            >
              {step}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-theme-divider p-2 text-xs space-y-2">
        <div className="flex items-center justify-between text-theme-muted">
          <span>Inventory</span>
          <span className="font-extrabold text-theme-heading">{inventorySummary?.totalStockQty ?? 0}</span>
        </div>
        <div className="flex items-center justify-between text-theme-muted">
          <span>Catalog</span>
          <span className="font-extrabold text-theme-heading">{inventorySummary?.totalProducts ?? 0}</span>
        </div>
        <div className="flex items-center justify-between text-theme-muted">
          <span>Value</span>
          <span className="font-extrabold text-emerald-600">₹ {inventorySummary?.totalValuation?.toLocaleString("en-IN") ?? 0}</span>
        </div>
      </div>
    </aside>
  );
};

interface ItemMasterStudioConsoleProps {
  messages?: string[];
}

export const ItemMasterStudioConsole: React.FC<ItemMasterStudioConsoleProps> = ({ messages = [] }) => {
  const defaultMessages = ["Draft saved", "Barcode generated", "Validation in progress"];
  const activeMessages = messages.length > 0 ? messages : defaultMessages;

  return (
    <div className="border border-theme-divider rounded-xl bg-theme-surface-2 px-3 py-2 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-theme-muted font-bold">
          <CircleDashed className="w-3.5 h-3.5" />
          <span>Studio Console</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-theme-muted">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Live</span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {activeMessages.map((message) => (
          <span key={message} className="rounded-full border border-theme-divider bg-theme-surface-1 px-2 py-0.5 text-[11px] text-theme-heading">
            {message}
          </span>
        ))}
      </div>
    </div>
  );
};
