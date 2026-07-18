/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.27.0
 * Created      : 2026-07-19
 * Modified     : 2026-07-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { TaxInvoiceA4 } from "./templates/TaxInvoiceA4.tsx";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";

export const TaxInvoicePrintPage: React.FC = () => {
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Parse invoice ID from query parameters
  const queryParams = new URLSearchParams(window.location.search);
  const invoiceId = queryParams.get("id");

  useEffect(() => {
    if (!invoiceId) {
      setError("No invoice ID provided. Please specify a valid document reference.");
      setLoading(false);
      return;
    }

    const fetchInvoice = async () => {
      try {
        setLoading(true);
        // GET sales invoice details
        const data = await apiFetchV1(`/sales/invoices/${invoiceId}`);
        if (!data) {
          throw new Error("Empty response received from the database service.");
        }
        setInvoice(data);
        setError(null);
      } catch (err: any) {
        console.error("Failed to fetch tax invoice for print:", err);
        setError("SMRITI-DATA-002: The requested tax invoice could not be retrieved. Please verify the document identifier or connection.");
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [invoiceId]);

  // Auto-print effect
  useEffect(() => {
    if (invoice) {
      const timer = setTimeout(() => {
        window.print();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [invoice]);

  const handlePrint = () => {
    window.print();
  };

  const handleClose = () => {
    window.close();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center font-sans p-6">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-mono tracking-wider text-slate-400">LOADING TAX INVOICE...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center font-sans p-6">
        <div className="max-w-md w-full bg-slate-900 border border-rose-500/30 rounded-xl p-6 shadow-2xl text-center">
          <span className="material-symbols-outlined text-rose-500 text-5xl mb-4 block">warning</span>
          <h3 className="text-lg font-bold text-rose-400 tracking-tight mb-2">Document Printing Error</h3>
          <p className="text-sm text-slate-300 leading-relaxed mb-6">{error}</p>
          <button
            onClick={handleClose}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors border border-slate-700 text-xs uppercase tracking-wider"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/50 py-8 print:p-0 print:bg-white relative">
      {/* Floating Action Bar (Hidden during print) */}
      <div className="fixed bottom-6 right-6 flex items-center gap-3 no-print z-50">
        <button
          onClick={handleClose}
          className="flex items-center gap-2 bg-slate-900/90 text-white border border-slate-700/80 px-4 py-2.5 rounded-full shadow-lg hover:bg-slate-800 hover:scale-105 active:scale-95 transition-all text-xs font-bold uppercase tracking-wider backdrop-blur"
        >
          <span className="material-symbols-outlined text-sm">close</span>
          Close
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-full shadow-lg hover:bg-blue-500 hover:scale-105 active:scale-95 transition-all text-xs font-bold uppercase tracking-wider"
        >
          <span className="material-symbols-outlined text-sm">print</span>
          Print Invoice
        </button>
      </div>

      {/* Invoice Render Area */}
      <div className="print:shadow-none print:m-0">
        <TaxInvoiceA4 data={invoice} />
      </div>

      {/* Print CSS Override */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}} />
    </div>
  );
};
