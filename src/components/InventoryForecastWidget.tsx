/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.31.4
 * Created      : 2026-07-10
 * Modified     : 2026-07-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */
import React, { useState, useEffect } from "react";
import { apiFetchV1 } from "../lib/apiFetchV1";
import { TrendingDown, TrendingUp, AlertTriangle, Package, CalendarClock, RefreshCw } from "lucide-react";
import { Product } from "../types";

export const InventoryForecastWidget: React.FC = () => {
  const [forecasts, setForecasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchForecastData = async () => {
    setLoading(true);
    try {
      // Migrated: Express sales/purchase order fetches (unmounted routes) → apiFetchV1
      const [salesData, purData, prodData] = await Promise.all([
        apiFetchV1("/sales/orders/"),
        apiFetchV1("/purchase/orders/"),
        apiFetchV1("/inventory/")
      ]);

      const salesOrders = salesData?.orders ?? salesData ?? [];
      const purchaseOrders = purData?.orders ?? purData ?? [];
      const products = prodData.map((p: any) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        price: parseFloat(p.price),
        stock: p.stock,
        category: p.category,
        isFavorite: p.is_favorite,
        barcode: p.barcode,
        mrp: p.mrp ? parseFloat(p.mrp) : undefined,
      }));

      // Analyze last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentSales = salesOrders.filter((so: any) => new Date(so.date) >= thirtyDaysAgo && so.status !== "Cancelled");
      
      const productStats = products.map((prod: Product) => {
        let soldQty = 0;
        recentSales.forEach((so: any) => {
          so.items.forEach((item: any) => {
            if (item.productId === prod.id) {
              soldQty += item.quantity;
            }
          });
        });

        let incomingQty = 0;
        purchaseOrders.filter((po: any) => po.status !== "Cancelled" && po.status !== "Complete").forEach((po: any) => {
          po.items.forEach((item: any) => {
            if (item.productId === prod.id) {
              incomingQty += (item.quantity - (item.receivedQuantity || 0));
            }
          });
        });

        const dailyRunRate = soldQty / 30;
        const stockoutDays = dailyRunRate > 0 ? prod.stock / dailyRunRate : Infinity;
        const reorderNeeded = stockoutDays < 15 && incomingQty < (dailyRunRate * 15);

        return {
          ...prod,
          soldQty,
          dailyRunRate,
          stockoutDays,
          incomingQty,
          reorderNeeded,
          suggestedReorder: Math.ceil(dailyRunRate * 30) - incomingQty // Suggest 30 days of cover
        };
      });

      // Sort by urgency (lowest stockout days first)
      const urgent = productStats
        .filter((p: any) => p.reorderNeeded)
        .sort((a: any, b: any) => a.stockoutDays - b.stockoutDays)
        .slice(0, 5);

      setForecasts(urgent);
    } catch (error) {
      console.error("Failed to load forecast data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecastData();
  }, []);

  return (
    <div className="bg-theme-surface-1 rounded-xl p-5 border border-theme-divider flex flex-col h-full">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center space-x-2">
          <TrendingDown size={18} className="text-amber-500" />
          <h3 className="font-display font-semibold text-lg text-theme-body">
            Stock Reorder Forecast
          </h3>
        </div>
        <button onClick={fetchForecastData} className="text-theme-muted hover:text-theme-primary transition-colors">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-theme-muted space-y-3">
            <RefreshCw size={24} className="animate-spin opacity-50" />
            <p className="text-xs font-mono">Analyzing telemetry...</p>
          </div>
        ) : forecasts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-theme-muted py-6">
            <Package size={32} className="opacity-20 mb-2" />
            <p className="text-sm font-medium">Inventory Optimal</p>
            <p className="text-xs text-center mt-1">No immediate replenishments forecasted based on 30-day velocity.</p>
          </div>
        ) : (
          forecasts.map(item => (
            <div key={item.id} className="bg-theme-surface-2 p-3 rounded-lg border border-theme-divider">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="text-sm font-bold text-theme-primary">{item.name}</h4>
                  <div className="text-[10px] font-mono text-theme-muted flex items-center gap-2 mt-0.5">
                    <span>{item.code}</span>
                    <span className="w-1 h-1 rounded-full bg-theme-divider"></span>
                    <span>Stock: {item.stock}</span>
                  </div>
                </div>
                {item.stockoutDays < 5 && (
                  <span className="px-1.5 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded text-[9px] font-bold uppercase flex items-center gap-1">
                    <AlertTriangle size={10} /> Critical
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="bg-theme-surface-3 p-2 rounded border border-theme-divider">
                  <div className="text-[9px] text-theme-muted uppercase font-mono mb-1">Run Rate</div>
                  <div className="text-xs font-semibold">{item.dailyRunRate.toFixed(1)}/day</div>
                </div>
                <div className="bg-theme-surface-3 p-2 rounded border border-theme-divider">
                  <div className="text-[9px] text-theme-muted uppercase font-mono mb-1 flex items-center gap-1"><CalendarClock size={10}/> Stockout In</div>
                  <div className={`text-xs font-bold ${item.stockoutDays < 7 ? 'text-rose-400' : 'text-amber-400'}`}>
                    {Math.floor(item.stockoutDays)} days
                  </div>
                </div>
                <div className="bg-theme-surface-3 p-2 rounded border border-theme-divider">
                  <div className="text-[9px] text-theme-muted uppercase font-mono mb-1">Suggest</div>
                  <div className="text-xs font-semibold text-emerald-400">+{Math.max(1, item.suggestedReorder)}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
