/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.17.0
 * Created      : 2026-11-03
 * Modified     : 2026-11-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

export interface UniversalInvoiceQrProps {
  /** Statutory signed JWT QR code string from GST E-Invoice IRP / NIC API */
  signedQr?: string | null;
  /** Invoice Number */
  invoiceNo?: string;
  /** Company / Store Name */
  companyName?: string;
  /** Company GSTIN */
  companyGst?: string;
  /** Company UPI ID for instant B2C payment (e.g. store@upi) */
  upiId?: string;
  /** Grand Total Amount */
  grandTotal?: number;
  /** Invoice Date string */
  invoiceDate?: string;
  /** Desired pixel display size (default 72px) */
  size?: number;
  /** Custom wrapper CSS classes */
  className?: string;
  /** Custom label beneath QR (default dynamic based on mode) */
  label?: string;
  /** Show caption label underneath (default true) */
  showLabel?: boolean;
}

export const UniversalInvoiceQr: React.FC<UniversalInvoiceQrProps> = ({
  signedQr,
  invoiceNo = "INV",
  companyName = "SMRITI Retail Store",
  companyGst,
  upiId,
  grandTotal = 0,
  invoiceDate,
  size = 72,
  className = "",
  label,
  showLabel = true,
}) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [isEInvoice, setIsEInvoice] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    // 1. If a statutory signed QR string is provided (GST E-Invoice B2B)
    const rawSigned = signedQr?.trim();
    if (rawSigned) {
      setIsEInvoice(true);
      if (rawSigned.startsWith("data:image")) {
        setDataUrl(rawSigned);
        return;
      }

      QRCode.toDataURL(
        rawSigned,
        {
          width: Math.max(size * 2, 200),
          margin: 1,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
          errorCorrectionLevel: "M",
        },
        (err, url) => {
          if (!isMounted) return;
          if (err || !url) {
            console.warn("Failed to generate E-Invoice QR, falling back to UPI QR:", err);
            generateUpiFallback();
          } else {
            setDataUrl(url);
            setError(false);
          }
        }
      );
      return;
    }

    // 2. Otherwise generate dynamic Statutory UPI Payment QR (B2C / POS / General)
    generateUpiFallback();

    function generateUpiFallback() {
      setIsEInvoice(false);
      const cleanUpiId = upiId?.trim() || "billing@smritibooks";
      const cleanAmt = Number(grandTotal || 0).toFixed(2);
      const cleanName = (companyName || "Store Invoice").replace(/[^\w\s]/gi, "").trim();
      const cleanRef = (invoiceNo || `INV${Date.now()}`).trim();

      // Official NPCI UPI Deep Link Schema: upi://pay?pa=...&pn=...&am=...&cu=INR&tn=...&tr=...
      const upiPayload = `upi://pay?pa=${encodeURIComponent(cleanUpiId)}&pn=${encodeURIComponent(cleanName)}&am=${encodeURIComponent(cleanAmt)}&cu=INR&tn=${encodeURIComponent(`Invoice ${cleanRef}`)}&tr=${encodeURIComponent(cleanRef)}`;

      QRCode.toDataURL(
        upiPayload,
        {
          width: Math.max(size * 2, 160),
          margin: 1,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
          errorCorrectionLevel: "M",
        },
        (err, url) => {
          if (!isMounted) return;
          if (err || !url) {
            setError(true);
            setDataUrl(null);
          } else {
            setDataUrl(url);
            setError(false);
          }
        }
      );
    }

    return () => {
      isMounted = false;
    };
  }, [signedQr, invoiceNo, companyName, companyGst, upiId, grandTotal, invoiceDate, size]);

  const displayLabel = label || (isEInvoice ? "GST E-INVOICE QR" : "SCAN TO PAY (UPI)");

  return (
    <div
      className={`flex flex-col items-center justify-center print:break-inside-avoid ${className}`}
      data-testid="universal-invoice-qr"
    >
      <div
        className="bg-white p-0.5 border border-gray-300 rounded-xs flex items-center justify-center overflow-hidden"
        style={{ width: size, height: size }}
      >
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={displayLabel}
            className="w-full h-full object-contain"
            style={{ imageRendering: "pixelated" }}
          />
        ) : error ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-[7px] text-gray-400 font-mono text-center leading-tight p-0.5">
            <span>QR CODE</span>
            <span>UNAVAILABLE</span>
          </div>
        ) : (
          <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
        )}
      </div>
      {showLabel && (
        <span
          className="font-mono text-[6.5px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mt-0.5 text-center leading-none select-none"
          title={isEInvoice ? "Statutory GST E-Invoice Signed QR Code" : "Dynamic NPCI UPI Scan & Pay QR Code"}
        >
          {displayLabel}
        </span>
      )}
    </div>
  );
};

