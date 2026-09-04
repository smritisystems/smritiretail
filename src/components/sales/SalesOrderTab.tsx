/**
 * Project      : SMRITI Retail OS
 * Module       : Sales Order Module Tab
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * 
 * Description  : Tab component for Sales Order module in the main dashboard
 * 
 * Version      : 3.30.0
 * Created      : 2026-08-31
 * Modified     : 2026-08-31
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Plus, List, Eye, FileText } from "lucide-react";
import SalesOrderFormPremium, { SalesOrderFormData } from "./SalesOrderFormPremium";
import { apiFetchV1 } from "../../lib/apiFetchV1";

type ViewMode = "list" | "create" | "view" | "edit";

interface SalesOrderTab {
  onClose?: () => void;
}

export const SalesOrderTab: React.FC<SalesOrderTab> = ({ onClose }) => {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [salesOrders, setSalesOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // Load sales orders from API
  useEffect(() => {
    if (viewMode === "list") {
      loadSalesOrders();
    }
  }, [viewMode]);

  const loadSalesOrders = async () => {
    setLoading(true);
    try {
      const data = await apiFetchV1("/sales/orders");
      setSalesOrders(data || []);
    } catch (err) {
      console.error("Failed to load sales orders:", err);
      setSalesOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async (formData: SalesOrderFormData) => {
    try {
      const response = await apiFetchV1("/sales/orders", {
        method: "POST",
        body: JSON.stringify({
          id: crypto.randomUUID(),
          order_no: formData.docNumber || `${formData.docPrefix}-${formData.docDate.replace(/-/g, "")}`,
          date: formData.docDate,
          customer_id: formData.customerId,
          customer_name: formData.customerName,
          status: formData.orderStatus || "Draft",
          tax_total: formData.totalTax,
          grand_total: formData.netAmount,
          items: formData.items.map((item) => ({
            product_id: item.id || item.stockNo,
            code: item.stockNo,
            name: item.description,
            price: item.rate,
            quantity: item.quantity,
            gst_rate: item.gstRate ?? item.taxPercent ?? 18,
            tax_amount: item.taxAmount || 0,
            total_amount: item.total,
          })),
        }),
      });

      // Success - return to list
      await loadSalesOrders();
      setViewMode("list");
    } catch (err: any) {
      throw new Error(err.message || "Failed to create sales order");
    }
  };

  return (
    <div className="w-full h-full bg-slate-50 overflow-auto">
      {/* List View */}
      {viewMode === "list" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <List className="w-6 h-6 text-blue-600" />
              Sales Orders
            </h2>
            <button
              onClick={() => setViewMode("create")}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700 transition"
            >
              <Plus className="w-4 h-4" />
              New Sales Order
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <p className="mt-4 text-slate-600">Loading sales orders...</p>
            </div>
          ) : salesOrders.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
              <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No Sales Orders</h3>
              <p className="text-slate-600 mb-4">Create your first sales order to get started.</p>
              <button
                onClick={() => setViewMode("create")}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition"
              >
                <Plus className="w-4 h-4" />
                Create Sales Order
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {salesOrders.map((order) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer"
                  onClick={() => {
                    setSelectedOrder(order);
                    setViewMode("view");
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">{order.order_no || order.order_number}</h3>
                      <p className="text-sm text-slate-600">
                        Customer: {order.customer_name || order.customer_code}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(order.date).toLocaleDateString()} • {order.items?.length || 0} items
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-slate-900">₹{(order.grand_total ?? order.net_amount ?? 0).toLocaleString("en-IN")}</p>
                      <p className={`text-xs font-semibold ${
                        order.status === "OPEN" ? "text-blue-600" : 
                        order.status === "COMPLETED" ? "text-green-600" :
                        "text-slate-600"
                      }`}>
                        {order.status}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Create View */}
      {viewMode === "create" && (
        <SalesOrderFormPremium
          onSubmit={handleCreateOrder}
          onCancel={() => setViewMode("list")}
        />
      )}

      {/* View / Audit View */}
      {viewMode === "view" && selectedOrder && (
        <SalesOrderFormPremium
          initialData={{
            docNumber: selectedOrder.order_no || selectedOrder.order_number,
            customerName: selectedOrder.customer_name,
            customerCode: selectedOrder.customer_code,
            docDate: selectedOrder.date,
            orderStatus: selectedOrder.status,
            deliveryTerms: selectedOrder.delivery_terms || "Door Delivery",
            paymentTerms: selectedOrder.payment_terms || "Net 30",
            remarks: selectedOrder.remarks || "",
            items: selectedOrder.items?.map((item: any) => ({
              id: item.id || `${selectedOrder.order_no || selectedOrder.order_number}-${item.product_id}`,
              stockNo: item.stock_no || item.code || item.product_id,
              description: item.description || item.name || "Item",
              rate: Number(item.rate ?? item.price ?? 0),
              quantity: Number(item.quantity ?? 1),
              value: Number(item.value ?? item.total_amount ?? 0),
              discPercent: Number(item.disc_percent ?? 0),
              discAmount: Number(item.disc_amount ?? 0),
              taxPercent: Number(item.tax_percent ?? 18),
              taxAmount: Number(item.tax_amount ?? 0),
              total: Number(item.total ?? item.total_amount ?? 0),
            })) || [],
          }}
          onCancel={() => setViewMode("list")}
          readOnly={true}
        />
      )}

      {false && viewMode === "view" && selectedOrder && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                <Eye className="w-6 h-6 text-blue-600" />
                {selectedOrder.order_number}
              </h2>
              <button
                onClick={() => setViewMode("list")}
                className="px-4 py-2 bg-slate-300 text-slate-900 rounded font-medium hover:bg-slate-400 transition"
              >
                Back to List
              </button>
            </div>

            {/* Order Details */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase">Customer</p>
                  <p className="text-lg font-semibold text-slate-900">{selectedOrder.customer_name}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase">Date</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {new Date(selectedOrder.date).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm mb-6">
                  <thead className="bg-slate-100 border-b border-slate-200">
                    <tr className="text-xs font-semibold text-slate-700 uppercase">
                      <th className="px-4 py-3 text-left">Stock No.</th>
                      <th className="px-4 py-3 text-left">Description</th>
                      <th className="px-4 py-3 text-right">Rate</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 text-right">Value</th>
                      <th className="px-4 py-3 text-right">Discount</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items?.map((item: any) => (
                      <tr key={item.id} className="border-b border-slate-200 hover:bg-blue-50">
                        <td className="px-4 py-3">{item.stock_no}</td>
                        <td className="px-4 py-3">{item.description}</td>
                        <td className="px-4 py-3 text-right font-mono">₹{item.rate?.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-mono">{item.quantity}</td>
                        <td className="px-4 py-3 text-right font-mono">₹{(item.quantity * item.rate)?.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-mono text-red-600">
                          -{item.disc_amount?.toFixed(2) || "0.00"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">
                          ₹{item.total?.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="grid grid-cols-2 gap-6">
                <div />
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b border-blue-200">
                        <td className="py-2 font-medium">Total Items</td>
                        <td className="py-2 text-right font-mono">{selectedOrder.items?.length || 0}</td>
                      </tr>
                      <tr className="border-b border-blue-200">
                        <td className="py-2 font-medium">Subtotal</td>
                        <td className="py-2 text-right font-mono">₹{selectedOrder.subtotal?.toFixed(2)}</td>
                      </tr>
                      <tr className="border-b border-blue-200">
                        <td className="py-2 font-medium">Discount</td>
                        <td className="py-2 text-right font-mono text-red-600">-₹{selectedOrder.total_discount?.toFixed(2)}</td>
                      </tr>
                      <tr className="border-b border-blue-200">
                        <td className="py-2 font-medium">Tax</td>
                        <td className="py-2 text-right font-mono">₹{selectedOrder.total_tax?.toFixed(2)}</td>
                      </tr>
                      <tr className="bg-blue-100">
                        <td className="py-2 font-bold">Net Amount</td>
                        <td className="py-2 text-right font-mono font-bold text-lg">
                          ₹{selectedOrder.net_amount?.toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default SalesOrderTab;
