/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Widgets: Financial, GST, Credit, Stock, Timeline & WidgetEngine
 */

import React from "react";
import { DollarSign, Percent, UserCheck, Package, Clock, ShieldAlert } from "lucide-react";
import { formatCurrency } from "../../../utils/formatters.ts";

export interface WidgetProps {
  data?: any;
}

export const FinancialWidget: React.FC<WidgetProps> = ({ data }) => {
  const taxable = data?.taxable || 0;
  const grandTotal = data?.grandTotal || 0;

  return (
    <div className="bg-[#161E2E] border border-[#1E293B] rounded-xl p-4 space-y-2 text-xs">
      <div className="flex items-center space-x-2 text-indigo-400 font-bold font-display uppercase tracking-wider text-[10px]">
        <DollarSign size={14} />
        <span>Financial Summary</span>
      </div>
      <div className="flex justify-between text-slate-400">
        <span>Taxable Amount</span>
        <span className="font-mono text-slate-200">{formatCurrency(taxable)}</span>
      </div>
      <div className="flex justify-between font-bold text-slate-100 pt-2 border-t border-[#1E293B]">
        <span>Grand Total</span>
        <span className="font-mono text-emerald-400">{formatCurrency(grandTotal)}</span>
      </div>
    </div>
  );
};

export const GSTWidget: React.FC<WidgetProps> = ({ data }) => {
  const cgst = data?.cgst || 0;
  const sgst = data?.sgst || 0;
  const igst = data?.igst || 0;
  const totalGst = cgst + sgst + igst;

  return (
    <div className="bg-[#161E2E] border border-[#1E293B] rounded-xl p-4 space-y-2 text-xs">
      <div className="flex items-center space-x-2 text-amber-400 font-bold font-display uppercase tracking-wider text-[10px]">
        <Percent size={14} />
        <span>GST Breakdown</span>
      </div>
      {igst > 0 ? (
        <div className="flex justify-between text-slate-400">
          <span>IGST (Interstate)</span>
          <span className="font-mono text-amber-300">{formatCurrency(igst)}</span>
        </div>
      ) : (
        <>
          <div className="flex justify-between text-slate-400">
            <span>CGST (Central)</span>
            <span className="font-mono text-slate-200">{formatCurrency(cgst)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>SGST (State)</span>
            <span className="font-mono text-slate-200">{formatCurrency(sgst)}</span>
          </div>
        </>
      )}
      <div className="flex justify-between font-bold text-slate-100 pt-2 border-t border-[#1E293B]">
        <span>Total Tax</span>
        <span className="font-mono text-amber-400">{formatCurrency(totalGst)}</span>
      </div>
    </div>
  );
};

export const CreditWidget: React.FC<WidgetProps> = ({ data }) => {
  const customer = data?.customer;
  const creditLimit = customer?.creditLimit || 50000;
  const outstanding = customer?.outstanding || 0;
  const available = Math.max(0, creditLimit - outstanding);

  return (
    <div className="bg-[#161E2E] border border-[#1E293B] rounded-xl p-4 space-y-2 text-xs">
      <div className="flex items-center space-x-2 text-sky-400 font-bold font-display uppercase tracking-wider text-[10px]">
        <UserCheck size={14} />
        <span>Customer Credit Health</span>
      </div>
      <div className="flex justify-between text-slate-400">
        <span>Credit Limit</span>
        <span className="font-mono text-slate-200">{formatCurrency(creditLimit)}</span>
      </div>
      <div className="flex justify-between text-slate-400">
        <span>Outstanding</span>
        <span className="font-mono text-amber-400">{formatCurrency(outstanding)}</span>
      </div>
      <div className="flex justify-between font-bold text-slate-100 pt-2 border-t border-[#1E293B]">
        <span>Available Balance</span>
        <span className="font-mono text-emerald-400">{formatCurrency(available)}</span>
      </div>
    </div>
  );
};

export const StockWidget: React.FC<WidgetProps> = ({ data }) => {
  const itemsCount = data?.items?.length || 0;

  return (
    <div className="bg-[#161E2E] border border-[#1E293B] rounded-xl p-4 space-y-2 text-xs">
      <div className="flex items-center space-x-2 text-emerald-400 font-bold font-display uppercase tracking-wider text-[10px]">
        <Package size={14} />
        <span>Stock Availability</span>
      </div>
      <div className="flex justify-between text-slate-400">
        <span>Selected Articles</span>
        <span className="font-mono text-emerald-400 font-bold">{itemsCount} line items</span>
      </div>
      <div className="text-[11px] text-slate-400">
        All items checked against main warehouse stock ledger.
      </div>
    </div>
  );
};

export const TimelineWidget: React.FC<WidgetProps> = ({ data }) => {
  return (
    <div className="bg-[#161E2E] border border-[#1E293B] rounded-xl p-4 space-y-2 text-xs">
      <div className="flex items-center space-x-2 text-purple-400 font-bold font-display uppercase tracking-wider text-[10px]">
        <Clock size={14} />
        <span>Workflow & History</span>
      </div>
      <div className="space-y-1 text-[11px] text-slate-400">
        <div>• Document Created: Just now</div>
        <div>• Audit Trail: Active</div>
        <div>• Session: Recoverable</div>
      </div>
    </div>
  );
};

export interface WidgetEngineProps {
  widgetIds: string[];
  data?: any;
}

export const WidgetEngine: React.FC<WidgetEngineProps> = ({ widgetIds, data }) => {
  return (
    <div className="space-y-4">
      {widgetIds.includes("financial_summary") && <FinancialWidget data={data} />}
      {widgetIds.includes("gst_summary") && <GSTWidget data={data} />}
      {widgetIds.includes("customer_credit") && <CreditWidget data={data} />}
      {widgetIds.includes("stock_availability") && <StockWidget data={data} />}
      {widgetIds.includes("timeline") && <TimelineWidget data={data} />}
    </div>
  );
};
