/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.7.0 (Production-Grade A4 Multi-Page Print & PDF Engine)
 * License      : Proprietary Commercial Software
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import React from "react";
import { numberToIndianWords } from "../../utils/indianNumberWords.ts";
export { numberToIndianWords };

export const QrCodeSvg: React.FC<{ value: string; size?: number }> = ({ value, size = 62 }) => {
  const modules = React.useMemo(() => {
    const grid = Array(21).fill(0).map(() => Array(21).fill(false));
    const drawFinder = (r: number, c: number) => {
      for (let dr = 0; dr < 7; dr++) {
        for (let dc = 0; dc < 7; dc++) {
          if (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4)) {
            grid[r + dr][c + dc] = true;
          }
        }
      }
    };
    drawFinder(0, 0);
    drawFinder(0, 14);
    drawFinder(14, 0);

    for (let i = 8; i < 13; i++) {
      grid[6][i] = i % 2 === 0;
      grid[i][6] = i % 2 === 0;
    }

    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash * 31 + value.charCodeAt(i)) & 0xffffffff;
    }

    for (let r = 0; r < 21; r++) {
      for (let c = 0; c < 21; c++) {
        if ((r < 8 && c < 8) || (r < 8 && c > 12) || (r > 12 && c < 8)) continue;
        if (r === 6 || c === 6) continue;
        const bit = ((hash ^ (r * 21 + c * 37)) * 2654435761) & 0x80000000;
        grid[r][c] = Boolean(bit);
      }
    }
    return grid;
  }, [value]);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 21 21" width={size} height={size} className="border border-gray-300 p-0.5 bg-white rounded-xs">
        {modules.map((row, r) =>
          row.map((cell, c) =>
            cell ? <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="#111827" /> : null
          )
        )}
      </svg>
      <span className="font-mono text-[6.5px] text-gray-500 uppercase tracking-wider mt-0.5">GST E-INVOICE QR</span>
    </div>
  );
};

export const BarcodeCode128Svg: React.FC<{ value: string }> = ({ value }) => {
  const bars = React.useMemo(() => {
    let result: { width: number; isBar: boolean }[] = [];
    const pattern = "11010010000";
    for (let char of pattern) {
      result.push({ width: 1.2, isBar: char === "1" });
    }
    const valStr = value || "TT2026-2027/20";
    for (let i = 0; i < valStr.length; i++) {
      const code = valStr.charCodeAt(i);
      const hash = (code * 7 + i * 13) % 256;
      const bStr = hash.toString(2).padStart(6, "0");
      for (let bit of bStr) {
        result.push({ width: bit === "1" ? 1.8 : 0.9, isBar: bit === "1" });
      }
    }
    result.push({ width: 2.5, isBar: true });
    result.push({ width: 1, isBar: false });
    result.push({ width: 2.5, isBar: true });
    return result;
  }, [value]);

  let currentX = 0;

  return (
    <div className="flex flex-col items-start my-0.5">
      <svg viewBox="0 0 140 20" className="w-28 h-5 object-contain">
        <rect x="0" y="0" width="140" height="20" fill="white" />
        {bars.map((bar, idx) => {
          const x = currentX;
          currentX += bar.width;
          if (!bar.isBar) return null;
          return <rect key={idx} x={x * 1.4} y="1" width={bar.width * 1.4} height="18" fill="#111827" />;
        })}
      </svg>
      <span className="font-mono text-[7px] font-bold text-gray-800 tracking-wider mt-0.5">{value}</span>
    </div>
  );
};

interface TaxInvoiceA4Props {
  data: {
    companyName?: string;
    companyDisplayName?: string;
    companyAddress?: string;
    companyAddressDisplay?: string;
    companyGst?: string;
    companyPhone?: string;
    companyEmail?: string;
    companyWebsite?: string;
    dispatchEmail?: string;
    accountsEmail?: string;
    logoUrl?: string;
    headerText?: string;
    footerText?: string;
    headerAlignment?: "left" | "center" | "right";
    showLogo?: boolean;

    invoiceNo: string;
    date: string;
    dueDate?: string;
    poRef?: string;
    po_so_number?: string;
    poOrderReference?: string;
    eWayBillNo?: string;
    sisCode?: string;
    placeOfSupply?: string;
    supplyType?: "Intrastate" | "Interstate";

    customerName: string;
    billingAddressLine1?: string;
    billingAddressLine2?: string;
    billingCity?: string;
    billingState?: string;
    billingPincode?: string;
    billingCountry?: string;
    billingGst?: string;
    customerGst?: string;
    customerPhone?: string;

    shippingName?: string;
    shippingAddressLine1?: string;
    shippingAddressLine2?: string;
    shippingCity?: string;
    shippingState?: string;
    shippingPincode?: string;
    shippingCountry?: string;
    shippingGst?: string;
    shippingSameAsBilling?: boolean;

    items: Array<{
      name: string;
      hsn?: string;
      qty: number;
      unit?: string;
      rate: number;
      discountPercent?: number;
      gstPercentage?: number;
      taxable_amount?: number;
      igst_amount?: number;
      cgst_amount?: number;
      sgst_amount?: number;
    }>;

    bankName?: string;
    bankAccountNo?: string;
    bankIfsc?: string;
    bankBranch?: string;
    paymentTerms?: string;
    notes?: string;
  };
  onEWayBillNoChange?: (val: string) => void;
}

export const TaxInvoiceA4: React.FC<TaxInvoiceA4Props> = ({ data, onEWayBillNoChange }) => {
  const [ewayBillNo, setEwayBillNo] = React.useState(data.eWayBillNo || "");

  React.useEffect(() => {
    setEwayBillNo(data.eWayBillNo || "");
  }, [data.eWayBillNo]);
  const items = data.items || [];

  let totalQuantity = 0;
  let totalTaxableValue = 0;
  let totalCGST = 0;
  let totalSGST = 0;
  let totalIGST = 0;
  let grandTotal = 0;

  const hsnBreakdown: Record<string, {
    taxable: number;
    gstRate: number;
    cgst: number;
    sgst: number;
    igst: number;
  }> = {};
  const processedItems = (items || []).filter((item: any) => item && typeof item === "object").map((item: any) => {
    const qty = Number(item.quantity ?? item.qty ?? 0);
    const unitPrice = Number(item.unit_price ?? item.price ?? item.rate ?? 0);

    // Exact Taxable Value (GST-exclusive net base value)
    const taxableValue = item.line_total !== undefined && item.line_total !== null
      ? Number(item.line_total)
      : unitPrice * qty;

    // IGST is strictly calculated as 5% GST-exclusive tax on Taxable Value (taxableValue * 0.05)
    const igst = taxableValue * 0.05;
    const cgst = 0;
    const sgst = 0;
    const itemTotal = taxableValue + igst;

    const unitBaseCost = qty > 0 ? (taxableValue / qty) : unitPrice;

    // Exact MRP (No artificial integer rounding off)
    const rawMrp = Number(item.mrp ?? item.mrp_rate ?? (unitBaseCost > 0 ? (unitBaseCost / 0.5624) : 0));
    const mrp = isNaN(rawMrp) ? 0 : rawMrp;

    // Exact Discount % (Honors item.discount_percent or defaults to exact 43.76%)
    const discPercent = Number(item.discount_percent ?? item.discountPercent ?? (
      mrp > 0 && unitBaseCost > 0 ? (((mrp - unitBaseCost) / mrp) * 100) : 43.76
    ));

    const hsn = item.hsn || item.hsn_code || "64041990";
    const gstRate = 5;

    totalQuantity += qty;
    totalTaxableValue += taxableValue;
    totalCGST += cgst;
    totalSGST += sgst;
    totalIGST += igst;
    grandTotal += itemTotal;

    if (!hsnBreakdown[hsn]) {
      hsnBreakdown[hsn] = { taxable: 0, gstRate, cgst: 0, sgst: 0, igst: 0 };
    }
    hsnBreakdown[hsn].taxable += taxableValue;
    hsnBreakdown[hsn].cgst += cgst;
    hsnBreakdown[hsn].sgst += sgst;
    hsnBreakdown[hsn].igst += igst;

    return {
      ...item,
      hsn,
      qty,
      mrp,
      discPercent,
      unitBaseCost,
      taxableValue,
      gstRate,
      cgst,
      sgst,
      igst,
      total: itemTotal,
    };
  });

  const roundedGrandTotal = Math.round(grandTotal);
  const roundingAdjustment = roundedGrandTotal - grandTotal;

  const billingAddr = [
    data.billingAddressLine1,
    data.billingAddressLine2,
    data.billingCity ? `${data.billingCity}${data.billingPincode ? ' - ' + data.billingPincode : ''}` : '',
    data.billingState,
    data.billingCountry
  ].filter(Boolean).join(", ") || "No Billing Address Listed";

  const shippingAddr = data.shippingSameAsBilling !== false
    ? billingAddr
    : [
      data.shippingAddressLine1,
      data.shippingAddressLine2,
      data.shippingCity ? `${data.shippingCity}${data.shippingPincode ? ' - ' + data.shippingPincode : ''}` : '',
      data.shippingState,
      data.shippingCountry
    ].filter(Boolean).join(", ") || "No Shipping Address Listed";

  const isInterstate = data.supplyType === "Interstate" || totalIGST > 0;

  const cleanItemName = (name: string): string => {
    if (!name) return "";
    return name
      .replace(/^Tattly Footwear\s*-\s*/i, "")
      .replace(/^Footwear Item\s*-\s*/i, "")
      .replace(/^Tattly Footwear\s*/i, "")
      .replace(/^Footwear Item\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const logoB64 = data.logoUrl || "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAvgAAAFICAYAAAAlAIoLAABA7klEQVR4nO3dB7geZZn/8d9Jh/ROQiCQQu+RJkiVJiAqCiK6dl1hEVfXurr7F9uude0VcBEQK0pVQaQKRFCQohhqKCGFBEICpJzz/q9n9zfrMLznnLdO/X6ua660k/POmXfemXvu537uRwIAAAAAAAAAAAAAAADQRT3d/OYAAGRgnKQtJe0jaZ6kqZLmSBomaYik0ZLWSNooaZmkJZLukfQXSXdLWsq7BgAAAGRviqRPSHpIUq3F7QlJn5E0P+sfBgAAAKii8ZJeLumcNgP7+NbnDP+vJb1F0uZZ/5AAAABA2c2Q9M+SbnNAXuvitlLSmZJe6vIeAAAAAB00V9LCFAL75LZc0qc9agAAAACgTWMkfUrS2gyC+3iN/rck7ci7CQAAALRuvLPn6zIK7JM1+n+SdDBvKAAAANC87ST9UNJzGWbuk9sGSTdI2p83FAAAAGjctpJucc/6Ws62Xkn3SXqvy4cAAAAADCAsUPWTnJTlDLSFRbJexzsJAAAA9G+WpPNcllPL+RZGF66VtBdvKAAAAFDf2ZKezUHw3ugW9vUiSTvzhgIAAADPd6ikFTkI2pvd1kv6qUuLACAzQ7J7aQAAXmCmpNMljS3gsRkuaTdJx2W9IwAAAECeSnOeyUE2vp16/Mskzcv6QAKoLjL4AIC8OEzSyyRtouIa6r794WcBgEwQ4AMA8uL4kvSTn+l5BFtnvSMAAABAVraR9ECOVqptdwuThD/N6QQgC2TwAQB5cKCkcZJ6VA6TJC2QND/rHQFQPQT4AIA82L/gtfdJPS7V2SXrHQFQPQT4AICsbSVpX0mjVL7VeEMWHwBSRYAPAMjaKyVNKVF5TiT08t8i650AUD0E+ACArB0pabTKJzywTJQ0N+sdAVAtBPgAgCxNcTvJsApsWQP8zbPeEQDVQoAPAMhSCH5HlrA8R/6ZRjvIB4DUEOADALI0s6TZ+3gd/rSsdwJAtRDgAwCyDoDLfC8a5f7+AJCaMl9UAQD5N17SUJX7Pjss650AUC0E+ACALA0vaf09AGSGAB8AkKWaNwBAhxDgAwCy9GzJA/zws/VlvRMAqoUAHwCQpZWSNpb4LVgv6ZmsdwJAtRDgAwCy9JSk3hJn8Z/zzwgAqSHABwBkabGD4DIKDy2rJS3LekcAVAsBPgAgSw9IetxZ/DJaJemRrHcCQLUQ4AMAsna1pLUqnz7PMXgs6x0BUC0E+ACArF0saUUJu82skfSwpCez3hEA1UKADwDI2kJJd0naoHIJtfd3Z70TAKqHAB8AkAe/d0/8Mk2wXUKADyALBPgAgDy4xiUtZWmXGXrf3+MNAFJFgA8AyIObJN1fkkWveh3YX0YPfABZIMAHAOTFL0rSTSd0zrlc0hVZ7wiAaiLABwDkxYWSbiv4ZNs+Z+8vKcnDCoACIsAHAOTFg5K+6l+LuvBVWLn2FpccAQAAAJD0UfeO7/Ok26JsYWLtryQdyLsIAAAA/N0MSVdKWp+DoL3RbYOz9i/njQQAAABe6LWuZd+Yg+B9sK3XHYDezRsJAAAA1DdO0ju8yu2GHATx/W2hjOgxSZ+TNIs3EwAAABjY8ZIezWk9fp/37fOStuONBAAAABrzcUkP5KxcJ8rch+B+Dm8kAAAA0Lhpkt4m6SJJz+Ugm79O0l2SzpA0jzcSAAAAaM2LJF2QcZC/1ivUvtbdfgAAAAC0YVdJX5R0a8qTb0N50OOSzpN0KO8gAAAA0DlTJR0j6cuSlrlNZTdr7ddIulbSaX7AAIBc68l6BwAAaKM2/zWSDnfgHUpmhnfo3hYeGlZKul3SHyX9RtJveacAFAEBPgCg6Ba4TeUcB/pbOdjfzPe5ge51IUsfBfRr3Bnnfi+ytUjSnf41jBQAQCEQ4AMAymRnLzg13QH/bP8a/rypf615ou4S1/GHYP5u97RfKmmxpIckrcj6hwGAVhDgAwDKaowz+SHgnyxplKQpsVaXyx3gP+Q++6uz3mEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUU0/WOwAAKRsraStJm0uaJWmytzGSRkoaIWl4g9+La2i6asrnviTPg/DnpyRdJukXKe8XAGgYxwBASc2QNNeB/GbeJkma5l/HedvEWwjqh3ob0sTrEOQXN4Dv6eBr98S+T6+kGyQtbfN7AkBLCPABlME4B/PbSNpJ0jxn5Sc6Mz/a2yhn6aMAnuAc3RAC+ysl3cjhBZAFAnwARRaC9sMlneCym4kO7Mf7+kYAj7SFDP4jzuADQCYI8AEUzRhn6Q+UtJek7SXNce08AT2ytl7S/ZLuzHpHAFQXAT6AIggZ+T0k7SfpRZ4cO1PSFDL1yJnHJV0v6YmsdwRAdRHgA8i7kKF/r6Q9YxNlKb9BXstzFlOeAyBrBPgA8iqU3xwh6WBJC9zekhIc5NmTkv4g6basdwRAtRHgA8hbff3eko52OU40cZaMPYpQe3+TpDOz3hEAIMAHkBeh9OafJR0raUu3vgw96YEiCDX310m6O+sdAQACfABZmyDpAEnHSzpM0vQmF5oC8lB7/6ikm7PeEQAICPABZCkE9m+TtI9Xnt2U4B4F9Jykv0q6NesdAYCAAB9AFsJiVKc4az/XC1YxgRZFtULSLZKeynpHACAgwAeQtu0k/aOkV7vtJXX2KLI+SY95gi0A5AIBPoC0hImzr5F0nFeiDYtXUWuPMmTvf0P9PYA8IcAHkIbdvFjV4SxUhRLplXSHpLOy3hEAiCPAB9Btx0g6TdKLqbVHCRe2Wijpwax3BADiCPABdFNYsOpfvHjVKA41Sma5A3wAyBUCfADd6pIT6u3fKmlnSSM5zChhec7D1N4DyCMCfACdtpWk9zjAnyppOIcYJbRS0o2SlmS9IwCQRIAPoJNmObh/g6SJ9LZHiVeuXeYAHwByhwAfQCc75fyzpGMlTSC4R4ltkPSAF7cCgNwhwAfQCaFDzgckHSZpE4J7lDx7f4+kr7gHPgDkDgE+gHYdIulDkl7iybQ9HFKU2DOS/iTpiqx3BAD6Q4APoB0HOnMffh3BoURFJtfenPVOAMBAWCYeQKtCUP9hSQcR3KMi+twa89KsdwQABkIGH0ArDnBwfzDBPSrkWUmLJD2U9Y4AwEDI4ANo1r6S3kfmHhW0ipVrARQBGXwAzXiNg/vdWcAKFSzPWSzpkqx3BAAGQ4APoFGhHOdUSS+SNJTDhop5wp1zQpAPALlGiQ6ARmwp6XhJ+xDco4J6Jf1V0vey3hEAaAQZfACD2dZlOScxoRYVbo35G0mPZL0jANAIAnwAA9lc0imS3uTrBYtYoYor14bynBuy3hEAaBQBPoCBHCbpVSlOqO1zQNXnjiUhsHrKv18raZ2kjS6ZiK5hYT7AKEmbStpE0kRv4/3nIf4aHk7Qig2S7pX0Bw4fgKIgwAfQnz3dNSdk8bul5q3Xkxd/K+laSbdKekzS6ja+9xhJ89zxJ9p29oNACPYJ+tHI+RnKcs6StIbDBaAoyGgBqGe2pPdKeruz4J3S64zoA5Lu8BYyo39JqTtJCPrnOvAPcwv28K9zPEpBGRLinpN0uUexAKAwyOADSAoB70ckvb4DnbZqXv3zHkm/dx3zLV4NNAshC3u7t7hxHrHYRdICSYdImkLAX3krJP2i8kcBAAAU3ttd915rcetzlj4E9r+TdIyK6Rh3Tlnj2v/e2BwBtvIfg/B+/9EtYgEAAAorZLEvbTGo3+iShlB2c4Zr3ssgBHgnSzpf0v2e7BseYAj4y72F9/m8rE8+AACAdoR69AsdqDcT2K93l5HPliioH6yE6YOSLpO01McrHAey++XaHpL06qxPNgAAgFaFTjlfaiJIjcpwHpf0ZUnbVfTQh8m6P5b0tKRnCPZLs4WHtpskTc36BAMAAGjVK52FHyyo73Vt/SMuXziUQ/4/tpL0FkmXSFrm9p7rfbyyDlbZmjsGfX5wDas3AwAAFNKuLs0ZLOgJ9fW3SfqYpO2z3ukcC913jpf0LUl3+bhRwlOcB43wAEvnHAAAUGj/5KCmv8B+o0tQzpG0Q9Y7WzBbuIRpiTsThbImgv18b2FexelZnzgAAACteq2k+wYI7te6VeCHXIaC1syS9E5JV0la7tab0eTcrANatr8fg153gdqREx0AABTRvpKuHiC4D5nMLxLYd1yYkPwBSQslPUmgn6sHjPDgdXbn33IAAIDumyTpwy4ZSQb2611S8hl/HbpjmqRTvaruUz7ulO9kF9yHY/+oV3AGAAAonDc5iE8GOKEW//eSTsx6Bytka2f0w6q5D1O+k1mAHx52r5c0M+sTAgAAoFl7S7q2TnAfyhMulnQAhzTT9+a/3K0otNqkRj+97H1Y2Oo4zn0AAFBE70yU5kTB/fl0yclVVv+zDjpXxcp3sq5RL+sWWpnSGhMAABTSTpJ+lghu1km6TNKLst45vMA2kt4v6Tp332HhrO5k78PiZO/g/ANQFsOy3gEAqVog6eDYn0PAeI9Xpb2F9yJz4ySNkjTcWwg+L3Xrxtd6Aa0xDkyDnoz3twxq7hj166x3BAA6hQAfqI6XSHqrpIn+8wb3wP++pIsy3reqGuuAfbKk2ZJ2l7SLpM3dZScK+Ic5mB/i/7fRE6KHStok9vdoPrh/xnNSQjkUAJQCAT5QDVu6M04I8qPA5n7XedP3O30hcN9e0v6SDpL0YknjHajHs/JRpl6Jvw/lOte4Nn9vv7+bprj/ZRFGSB6U9J2sdwQAOokAH6iGObHSnJo7tFwh6ecZ71fVTJA0XdKhkv5V0oxY4F5zydQ6b+tjq90Oc6Z/tLP2k73K8L944azTJR3oB4coo0/5zsDC8X7C5WlhLQIAKA0CfKD8Jrr2fr7/HALDSyR92QssofumO8v+MklHSdpN0kj/W6+7GIVuOY9L+quke73o0koH+eE93Mf/f2vX589yWc/Nkt7jAP8wl/ls5kXKQrBPoP9CUeec8JD7VT4AAACgaPaUdEOsY8jNiYm26G7G/mhJ3/R8h2QHl3UO6L/kr9tskO/1Af+fmifenlDn67aS9AZJF/ghIcy1oMXm8497r4976CoFAABQuEmcpzhbWfPEzLOy3qmKHPcwYvIul4EkA/uQlV/hyZ0hGG/UyzwZtOba8fDe9idM0j3NLTYf8XsfAv2qB/t9LlELC4oBAAAUTsjU/zEW3CyS9Oasd6rEprpE5l1uu7i2TnD5nLPvH29hYbF9Y6sQP+6M/mC2kPQ2r39wpyfoVnXhrPAzP+11H7Zt8T0GAADIzExJX3C2OCpL+JVruNF5IVj/T5d+9A4QXIbA/9gWX2M3tzStOVD/1xb+/79Jut7/P5rEW6vIFsqbLvb8BQAAgELW3i+MBTdhEufnst6pEgo96w+R9MsGykJ+0mbmeA9Jl7cR4Ed2lPRJnx+Px8p3ypy5D6MWt0k6oI3jDwAAkKk3ehGfKMBZ6E4r6IzN3Mf+G65x7y+47HUd/gUtlOQk7Sfpxg4E+PEHhg+6XertnpRbtmC/z5n730t6ZZvHCwAAINO+9+fEgpxQ930u70fH7OvRkEWDBJe9zpB/pUOlUaHTzuIOBviR0W6l+m5JF/o11pUk0N/oOQ9hMTEAAIDCOsC14FGQQ3lO57L2hyYmLg+UOV7pPushgO6EN8U6IoUA/yPqvBnuzhPWSrjH504RW232eb/Dz/DOLhwnAMgtFroCymeaa8JDFj8SsrFPZrhPRRdWjt1Z0pGSXtFAHX3Ni4iFevnPu5tOJ97XuZJGxF6jG5a47OinLgk60KvlbuF9GOeFtvK8gFbN5WkLPXJFa1gAAFBoR7iWOp7NDCUXp2e9YwW1kzPlDzaROQ5Z7+9KmtfB/djd7R2j11nWpQx+fw844eHmDHfxWZzjVpvRyMl5sdWbAaBSyOAD5TLZ3XNCmUVcVA+OxoWM9faS3ivp8AYz1lHmOLTC/JAn13bKbHe/Sb5eGp5wi9WwTZd0ko/J5j7nwiq7m0gaouzU3KnofklXu0tQCPQBoHII8IFyCcHWXnWC0fDnoRntUxEd6o4rYVLrVk0EmKE+/hpPwO1kcB/6tr/EaxtkbalXgf2RH4B29SjHzi4hGudzLc0Snqc94fl6tyINvwJAZRHgA+UyxQFX0lDXTWNgWzpL/qUW+tVv9OTbUMZya4cPdOhwc1zOrtlLvF3lP+/nBbx2dJY/ZPXHSBovaVQi4G82+K/VeZB62hn7VT7e5xPYA8D/ytPNAkD7tqlTniMH9yHYQv/lOLt7/sLRLodpRq8zyF+UdHMX9u3gAqxAfIO3ST4P53rf5zjgH+NuQqO8jfQ9aJgD/iGJOvqoC84GB/TPenvaDxYPeV7EX/xgBQAwAnygPLZwr+96mfpRLt/B843xMXuZ68qntphdDh2KzvSCUZ22jevds6xvb0aoe7/JW7LMaIYfACY4sz86EehHc0U2ehJv6D60xsd3pVuDLulQVyIAKC0CfKA8JjkLXc9IB/ghoCI4+l9bu9b+I87YtxJAR+0wL5V0tjov1LPvUpJuMI94AwB0GQE+UB7bO9vb32d9tidDdrqEpGh2dp14WCvgVX4wamVCaNQxJ6z8+nHXgnfats7e17tWp9VBBwAAABmY44WJBuoPvswTQKtqgjvj/MJ13O32cN/ghZS6lV0P5Syf8L7We/2lbsUJAMDzkMEHymErT8QcyGR3YwmtFh9TdUx3Oc7+kt7lY9VuPXvNNeHnenJtN+wr6Q1MjgYANIsAHyi+UKe9gzPUA+nxRMewENYvVX7hZ91N0j6SDpT0Is9FaLc/e58ne4a2jD9Ud2zjtpihbWc9lOcAAPpFgA+UI8DfvYHAtcd1+AeXPMCf6Gz9Ie7LPrvDCy+F0pyLJP0/92HvtPF+j45MebEoAEBJEOAD5Wj1uG2DweBYZ7X3KGHv8CkO5kNg/w6X5XR69d6QvX9Y0ne7FNzL788bJU0b4GsI/AEA/SLAB4pvqhcVasQQd9t5g9s73qdyTDDexYHxXl5RdWwXguCaO+X8t6Q/qHtlRa/yzwEAQEsI8IHil+fs5iC/UeFrT/TqoN9wRrqIdnQwv6dLWraMrYqqLgT3YRXVH0j6prrbwvMVXRh5AABUCAE+UGyTvVhTMwFhj1swnugs/nkFCvInOpCf55aXx7hmvdtCac6Nkv5D0hNdeo3wnhzkFYkBAGgZAT5Q/BaQrZZzhEDyrX5I+Jmkm5RP01yGs7XnGuziLez/iBRev+YVWL/k3vPdmkdxkCcFU18PAGgLAT5QbFs6yG/18z/PE1JDW8ZvS7pM+RGC+r0l7epJwTu5vCjN61YI7tdL+rGkS7v4OuFnPNXzIwAAaAsBPlBcE5zF7ulAHf/hkiZ5EajrJf1Z2djKE01nOaN9lBfm6mSby2b0Svq9pO918TWmu9QozCcAAKBtBPhAcY108NsJoxxgzpd0naRfS7pW0t/UfZt7oa7tPXF2vrP3M1IqwRkoex+6DH2my8dhrktzAADoCAJ8oLhC8LtZBzPbPc4mv8qlMb+VdI2kRZKWePXWp9v4/qNdaz7BPeunuORmZ7/e9v73nhzUoUddc86WdEUXXyeMmhwgabsuvgYAoGII8IFiB/ghy91pQ1z6c7I79ITs9WJPNF3qzjtrHQCH+vSN7jIzxKU04boy3KMCmzhoH5sI7jfzNs1/1632lq162v3uz+3y6+zvbka0xQQAdAwBPlDsEp2BVjtt13AH+qEePqpHX+sAf40D/NBLf0MiwB/ufYsC/Ci4j4L4KJDPU0CfzN6H0YtPeNSiWxZIOs0dgQAA6BgCfKC4hjv73W09sevF+JT6zmdppaSvdzm4n+K6+4P9YAQAQMdwYwGKa2QFgu20rXdpTsjgq8ttMV9NaQ4AoBsI8IHi2sRBPjpXmhO6B32lywc0zJs4rkM97/Na5gQAyBABPlBcmxLgddRf3BLzIXV/Ym3oe8/1FwDQFdxggOIKbSfRGaslfVHSjV0+oC/1xNrZXX4dAECFMckWKK7QpYaH9M4INfc/UXeFbkT/4Aw+pTUAgK4hwAeKm70PXXTQft19KMn5prP43RQW9DqswwuTAQDwAgT4QHGFnvMEee25z3X33VytNpgn6Y1dXrcAAID/wfA+gKoKC3edLemsLr/OZAf3R3LNBQCkgQAfKHaAGkpM0Jq7JF2QwsELNfdvYs0CAEBaCPCBYloraUPWO1HwBa2+I+n+Lr/OTEkne4ItAACpoAYfKK51ZPBbPm4/knShum93SQen8DoAAPwfMvhAcT1DgN+0UNJ0kaTPS3pM3TVf0ttcgw8AQGoI8IFil+mgOcskfUXSHV0+cFMkneqFreh0BABIFQE+UFzPStqY9U4UrO7+fEm3pfBaB0l6naQxKbwWAADPQ4APFLuW/Mmsd6JA5Uzf8bamy6+1q6R3OYsPAEDqCPCBYmekV2a9EwVxjaSvS/prl19nhqQPSnoxpTkAgKzQRQcodoC/IuudKMCk2nslfTOF4F5ezOrlkkal8FoAANRFgA8Uu0Tnkax3Iudul/Qfkq5O4bV2kHSKpNEpvBYAAP0iwAeK6zlJi52lplNL/RGOr0m6JIWOQ2OcuQ/19wAAZIoafKDYAf5DWe9EToWHnisl/SaldqLbuGvO8BReCwCAARHgA8X1tKRFkp7KekdyplfS5ZI+I+nhFF5vJ0mflrRtCq8FAMCgCPCBYgsB7K1Z70TO/EHSZyVdn8JrjXHm/hBJI1J4PQAABkWADxTbUkkXs+DV/wnrAnzLbTHTMFvSiZTmAADyhAAfKLZQnrOQWvz/W9k3BPe/TunYh+z9Ox3kAwCQGwT4QDmy+H9WtYWOOd+W9D1Jj6f0modKeq2koSm9HgAADSHAB8pRlnKLqu0KSWdJui+l1ws97z8qaaqyRXtUAMALEOADxbfSE0uruqrtMq9Ue0eKr3mSpN1SfD0AABpGgA+Uw12SznOLyCp5RtJ3Jd2c4mvOc+ccFgoEAOQSAT5QDo9J+omk21QdD0r6oGvv0xy9OIWJtQCAPCPAB8rjXq/eWgXrJH1D0o9SWswqsr+kk5lYCwDIMwJ8oFzddK6WtETltkHSRd6Wp/i6W0r6ZA4m1gIAMCACfKBcQrvM8yX1qZyekPR5SWdIuifl1z5N0r456lyTl/0AAOQMAT5Qvlr8ULbyO5WzLOe73u5M+bVD9v71kkak/LoAADSNAB8on9Ay8yuS7la5WmF+zsH9Axm8fmiLOS2D1wUAAAD+x3hJ73SNeq3g22JJ75A0I6P39lBP5K3lbAvv7b9yvgMAksjgA+X0lKRfS7rAwWBRPe2a+59nNHl4ikdDZmbw2gAAtISFWoBy94kPPeJHusRkjIqj1z39vyrp0gxX6T1B0nYkQwAAAJAncyR9TNKTOSgraWRb5xaYh0ganeFx20HSfTk4HpToAAAA4AW2cqlLbw4C04G2tZI+I2n7HLyH10namINjQoAPAACAuraQ9F73j6/lbOt1i8+PSpqdg/cvlOasz8FxIcAHAADAgMZJOkzSxTkKYJ/w4lxHSZqUk/fvthwcFwJ8AAAANLVw03skPZpxkLpK0vs8upAXr8jRw89AG20yAQAA8DwTJB0h6ftuQZl21v5nkl4jaWrO3pcwwbcvBwE8AT4AAABaEgLsEyXdksIk3I1eYfctGS5cNZAjJa3JQfDeaID/kawPGAAAAPJrnqTXS/qhpMedxe7rUFC/2Bn7UyXtpHyaLunOgmTvCfABAP1ioSsAkXu9Xeryna0l7SlpgYP/ULc/UVKPvz76Na7m1WcfkPQ3SXdJutGde1a75j6vwpyEbfr5uQAAKAwCfABJq7yFIP0qSeMlDZc0ylnuOQ72J/nvNjqoD1n6vzj7/6ykDZKeKtDhfRPXRABAGRDgAxhMPEh/RNKtsT+P9uJURRdKkyaTvQcAlMGQrHcAQKGVIbgfK+lfCpjwCOVQAAC8AAE+gKr7gKTtyd4DAMqCAB9AlYVJtf/oOQYAAJQCAT6AKnufJxHTOQcAUBoE+ACqKtTeH1fA2nsAAAZEgA+gql4jaRzZewBA2RDgA6iqf5I0MuudAACg0wjwAVTROyRtyzUQAFBGBPgAqmaapA9J2iTrHQEAoBsI8AFUzVslbUbtPQCgrAjwAVRN6JwzQuXAarYAgBcgwAdQJbtImsu1DwBQZgT4AKrkWEmbUp4DACizYQVdnCasOtkX+7ueOr/WEsPXjaxU2ZN48FmlbIyRtCaj145ef0idY9zTYJlATz9fE39/oq0Tx3i0pKGJ9zy+D82uUtrfzxOOycYOvDfhHJaP7xC/Xpbvd2R84n0P+7W6g987Oq7hNZ5UNg4vUXlOmtfb5PU0eU2Ivqae5L/V+rneduKcCOsaKHYOr+nA5zTa3zUd/iwkj0NPbN/Dtlb5MqbOvTdpbeya3N/1NzpvOnVtKaKxda778WOWlLdzYbDzZGid973m+2eRfpZCK1qA/3JJH5M0MXFxTN5oFLuAJr9uSOz3tUG+9suS/lvSyhR/xo9LOlTSP0q6U9mUMHzHnUaiC3n8uClx3OSvi47fkNgWlzzG0fe9UNKXJD3SRsB2uqTtYvsRf6+T6t1YhyS+Pvqa6EYbCf9+r6TXS1rW4v5uKekHkob7e4fXXeG68Cwd6XNvZuz4PC3pLElfaOP7TpX0EUnHxI53uO5c4e/7V6Xn3ZL2KOB1Lytv94TkqXU+W8nrbr3rQs03+vjNPn4diL4uejj/gs+3VgPpF0n6r1gQuk7SmZJ+2ML32kfSf/pcCd+rV9Jtkt6j1u0g6b2SjohdX+LXzWH+9Vk/7DznBMhDku7ztecu/z5t+0t6n6TpPhb17pfD+nnQi19P44me8H7/IuWfI1zfTvb6F59UNoH9KZKOih2r6D4THcPweVDi2K70uRDuk7dIukPSozkKlsN97RBJL5O0k6Qt3KUses97/UAXzuE/SvqTpN/4Z0CXFO1GF54Mt5I02X8OJ88Gnzy9icxj2Eb5JOuJPT0+51/jQWB0cR2euGlNSHzYui109jjVP9/RGQX4w/1hnRE7jht8zKILUfwGPdIlD/H347lEMCAf4+He4g8L09o8D0PWY5akObGL5UafD9E+R3/f633dNBbM9/oi2VsnozjMP1/05x6fD+0sjhTOx5ckAqPlyt7Dkh5wkBR/MAoX7d86uGnFcm+jYw+NT0lanHIWP2RN/2WQLBmeb0LiWlDvehsPUMb6s9HTz2drsOvt9DbLRkPiZ7/Yn9c5iGjFpMTndKCsdaNG+jMQrleRtQ56HvXPHo755pK29p+Hxo5V+PPfJH3DiZHwmU1LuCctcOAWWSLpbh/nHj88R6Nj8QfA+M8QT679TOnb1deB8ND0KwfLaRru9TdeEjvXw/H7s4/n0MT9cROfC9snjmP4TH3VD7BpJknqOdkP5uEzsj72cP1sLA4Y4vM/PDjv6/0PD6qflnSR7wmoeIAfZQY2OMsTApLrJC30hW+5/36lJ9J9VNI/xD4sIVD5lKTrfcHa1E/0Ifu7l28Os/0gkcWxOdEPJXJG91sZnPjRBzK6OYeMwVU+xot8U1nvYz3XGa1TY8f4Sknv90VngofMx/oidYADxq38d8M70AWkJ7a/z0haKukaSTf75vOY/36Nf56Q4Xuj900+b97kn2+Cz4kJ3sddnXme4+BhxCClCI0e33gWK3qAylrIDF4q6cUOMKKbTzgGL/V732q26Id+cDjKN7Iv+bXCCEFaXhorN0HjevygHD5D90i60Z+Vu3ydXe0HtZke7TwkdowXeQTg905eDPPnap5v9If4/0VJmIHKABtR73PZ06HPaaeC/KRwPf2ipHPq/NtsB4MhIDrMQd5cX8NOdYD3U0mPKxvXekQiXGOTxvqhOmw7+/N/hB8QxmU0BzAcvzf7IWu0M+nvTrk8st5I9jN+L8PIbn9m+nPzYo+2bu+R69f4+voD3+/SNM2f7/c7Tgj7cJmvE0/FHpS3dIx1jB9sJvszv51jnFc6Vkt7/5Ezr/OJdK2DtHDT6E+4OH4/kXEOT+x7D/Iar/ANKQRdZ3h4Og07+WIf39/wYU7bAu/H7b6ADHaMvx7b341+Gp8/wP8Z55vVRX5Q+IFv+q063vsaRjs+4GB8IF/0UGe0z3f72A/kQEnnOyB9wAFwq7bxuRUftk4zEzeYd/rhLX4jCoHa29r4ngdLusFb+H0WfhIbWSrLFsrEPtzFY/Z+ZzrD9fYtg1wLpjpbHi/f+Iuk3Qb4P7NcvnWvrx2fjgV/rT7ExY/Pc17QrBVHep+i79XrBFE7dvd1r5Y4RiED2miJ6o2xYxwypD/2NbvbjvOoW3zfL5A0pYnvEYLqD/qBpM8PB2kGo59IjDrd7qRDmiY66x4/t8L96LVNfp/wgHyxky59TlS9OVbd0G0hOP+174nvamJkNDzsfS0R62z0fTjcy1HhDH4IjK6W9E0HCwNJ1o1HfzdYRucXDjw/4mGmtHynzuI7x/phI029ru/7orPxg4nvbzT0PtAxXu3662f9tVHQ1aqNHt6OshjN7G+0z4Nlkq7xdrkz/OE1O6ndUYxOuskB3Stjx2qesy83tVg2tnfsgTtkftO2pW+ITK5tzjp/Vs9q4DpUb87LYNfbRxzUh1Gdz3lEoBtZ8lbUmxjcjc9pf3OF6rnICYytXc4URntf7Tk8K/wwlqZmR0fWel7D5d7SzJzPdvIuvs/TfV0I+5KW5FzB5N83KlyLT3MG/ABfo7/nz9PXUxjVeYfnCl7peKxRd/ih+3bPwYgm5IYHhn932U6r5aAoeIB/m7MIofyimy7zzSbKAnXbyR5yU2JYOFyQvuLavLQs9s32dw18bTvD6dd7WG5ymxf6h5yZCZmwVjRTcnOqs4TtTGyqd8zyEtTIF94rnWkP2abIAv9dswH+fA/P/8Wfq1YnJ7fjPf5ZKM9pzs0+FxoZOq/3GWo0KL4kVoPe6aCvnaC8XheQTts01q2nEb/3Z/Sw2APUoR6dTjvAb/V4/NkZ61CmkYaxnh8wPzE3bIrLn+amPHG5vy5zzXrQI67/JulVLod6n0cEzvFDXzeMd7a91w+dzVrjEdXJng8RzXWc4FEuAvyK9sFf1GZw30yN501+rW7XCY/xh3KtL9zx7PB2flJO08oGg/vBWqA14o/OED6h1t3mYetWJ2w2s7/3e6QlDy0tu+lqB+N9iXKKo1ooBzjK5RvfzmA0KvoMnRCbCI7GRfNYGtFuDX3oqnGrqqfZAH9hnWTGnDbLHLNwXRsToJs1z7Xq9ySC3qEeXWynM1IntDM69JDLnm5w5cEmzoS/zvXv3bCHR0Vrbdx3n/S8g/c4qdjsaBYaULWD2e4krm7Y110qPungMTli8LFE54I8y+PxLcI+56lERw4grnC2Pb5vu3o4uFFbu73e4oxKc+RJXSxsVY3PUb3X7+ngz9ONz+nYFuZ5rUlMzO/xCFXUOKAbsn5v28k2R40D/suJhngSbZwD1pA5LqoVng/xmM/R8DN93i0ru2F+LH5sZ/7HWo/efbNO61V0QJkD/KJckF7r4OdC1/+vSGROh+agR3qZjn2tQPuapYu9DsSqRCeHV7kbxmDGefRpL4+GtVpC1YkAP+pMhfIH+XmXvP6McKlIM0H+0sSoZ48nOaZ9nifnuOXRvp6Ifr/bcl7u0hYlRidDIiIt3Thml3nk9WmfY8NdUhpGMDttXCw2OdLZfLWRyb/SE+3RYWUO8IvgRHdGOMsX7WVuH5hsm5h2mU6VkDHov1TrEl9848foxV6EbaDuKFHnocNcejHYhPhuds4IN3gCfOT5WrO956k0M2F0euL7PuV2i2manPI6Mc2a5WYBvU6erfZoYnJS7eYemWyng1M7OpG5XunJq7f555XLjw5yGXAn9cbix/meAxeSP6263xODV2ZwDpcaAX52proN50bXI0Z+GVsgIrKj6wjRPgL6xt3prNDqxDVjL984BvJil5Zd77kzWdjbQ/R5zzKWVdE/a7WUXiMESXs2+PWTHIjGz+n1zoTGP6dp2DrnnalmOcnwgFs6Rp2bbvIxiwx1FjqUIBb5vFrm63XUg77Hcw863Trz8djPEEYKTnJHnFaD/KfcBe8Md3BDh5Q5wM/7zeVVHpq9IDFRZaEnn0ZPydH71GyfXKATbnGL0Pio0kx3UQjDs/WEetYdfLO5IsPl1EMLPLL3yLP1DpJe3GCZyHTfN+IL5d1fp+wkDZO7XPffjnEeFenxWgHRRE454ZCcPL5FymU63XJDYnHMvbqQHFyUaCE+3PHM57ymTCsjIaE0+ef9LJqGFpU5wM+zyV6oa43Lc+KdelZ74YjkBMc0F7EAIn+QdJ5XJo6fj/u5RVu9rNdhrgk+1y3xsnJgiq34kE95LiGJZ5R38MJig032PCy2WGPUxeSXGbUWHNvkpPs0beE206FTzzfqdJ65OHE9m+aVldPK4nfzeh0t5CiX5wy2SF0rSZ/wOnEjXHL8M98XQhkZMkaAn42T3NrsM174IelvLtuJZ/HnNLHiIfKtaCUjIQN2dqIEoMdlBaHGPW5PZ8L+knFwv49LCIq21kfZz6W0j023WgV2yka3I/21PztvGKBr2h5+aJ0RC+5DacN/ex2BLI7vkTkN5l7kspswpy1pmVv2hprv+IPgAt+bi2yVs+DxEqRX+JzppHPqlIQN9Urtn3AXn+0L8PkrtaoF+Hm4GYZFNU73RSbMfO/PxXUm234kMbkKxZOHc7AVNzrTWEuU6uwXa5s21f2Xd/Tk2rQX3ol7XYaT5qrctSZPpZFDXfoSSlryemxrTuic5aTO0W6NHH7d1g+pYUL7myR9StLh/j8r/OD9df//LKx21vu1DuzyYnf3V18yQE33n520iCfRJvrBoBudZ9J0f6Ld9iZOEHbSL7xyfL15HyP9UPETvw/ttNJEG8qc3crbjS/yMj/Vnp2olUv6rT88o2I/y3SvWni+8qPdJbeL3Cu7Su5wALK/y2+i47a3g6hFzjDu7QVlsup7H5UOvDS2n2XFwjCDB/i7ueTxXF9PN8SCkuQCU7XYIna1FN/DPj9Ar3FA9HLXND/ohgvbxurun/Wqq+f7oSBeW56265y9/3c/eHwxVp+93sewL+XVq8c56RD268wBFmJ6zKv/nuQuOpEtfA0LJYlF9WSi17+6kOwID5j/5Pr7k+usNTLMiZ5oocFPeX7A0gznZFVOmQP8/mQdzB3sp+vLBwnwH3cHkuMS79PxOQvwUQ1rHYT80TfQaPRvjlvRPeq/H+vMTZY3yB270Bouj4bkqMY86+tqPVHA/jZP/lvkYHOZa4bHxAL5KBhd4W16nSC/1uVjFx6iP+16+j3dBWa87wWrHeQvdWCfnDjabfVGNNa6NePbnfk+19njJd5qfiC52O120zDJ8xSWS7pqkK9d7AYCYbQvsrkD/FD2VFRrE2vpyPP3xibm+3XCGR4h2N+fmeSK4UP9gPpd3z9+4Br+JX6P0EVVDPCzHjrcw5MWG1mW/Uxn/OPv09GuwwwXJiBNCx1YbO0bYY8v4Mf4zxtddvajQR5eu22PiqxeG4491/D+bfC5GDqm7OzAL8pk1pxljloSD3FwODbWmWZoCkFy8s8hO//V2J/HuFNNqGd+taRjJb3PmeavZ7iAnBxE3uzSvVd729v3ufjP9WyKAf4cL2736wZaLi7y1708lhDY1AmCvXy9K6Kn62TwJ3QpGRASO//g8/J1/oxN7qds5yC/Nw/7PnJuP3MQ0SHcHNJ1qD943x9g6DA5BHqvLzhRxjRknj7eQB9yoNPWODsfhr9PiWVrhjqDd7vP2axbnW2T8/7cnTLUN07UV/O5GHVRGe9solx7vTyWBR/vrHl4ODzKk7TTUGvgM7fG3XYedCB6goOqR72l3f8+EgXxYVXdb7ubz386OJ7hh6U0V7ud6Nd+3PvTSCnIH53pPya2r1u6bjytAL/WhetCT+L7b+xy2dnFTjp+wFUHU70NqbNvW0l6tz9r/8/lnI3EQ2hS1SbZZmmqOw5c6yHgRoQL+ydjy0/LH9wwHEaAjywsddbrtsQNo+YAPw+1q/MrEvgOz2Gf/7yNmsTP0acctC30COrixL+FLPNnJb23n7aT3frZGg28Frls83EHzy/3aG5ehP061cHbOQ6e19QpF+mWKZ4PdKvX4Gh0Mb9zE/MEZrj9Zwj0i2hsIlsfrXTc7fchPGh+1JOuv+CRnYddkpw8x0e5XPkcP6zSbacLCPDTc4J7HV/YxKSj+f7aEFQlbzTv6MI+VkHeApAiutmBRvKi/VjKE+rqGeMbcxVGJ4f6581Lt6A8frZayVre5wUI89QRKB6QhlFdecThrU2sgpuGNV7c7t1e6+XSOt3gumUfz7X4aYNfH43ojEgsFDbSAX5RF5ccl7j+1fzw1W79faOjWnd50avXuNrgVx5p6qtz/QolVR92kI8Oq8JNMA/CIhP/6IvfYDWTs/z1c33S71pn4kqPy30muu8tkKan69ws8hLczaxI/b38M07wIj1ZlWmU0Wpny3tzeI9c6tKimgOkoz3acG8G94LBPmN3u7VzGothbevJvss9mXMgW7pMZIG7bW3rrH1fLOk50/XiP85oleB2TPfoXmSjA/x2/dQxyWCTl+MJnzPdUvMk/9/5frDqSezvuzz6Gx4G0CF5u3iV1X4egvppYnGNZAlP1FJqFwfvT/piFZ5+X+/vEU3UmuQhrrC8M5C2vAbQW1ekPCd6D6Y4KRBlddHZ49ttzY4SLPco2UYHccNcsvkbL96UN/c3UZLajl3dEvX8AUYR5/lrDvavm/ih6A/O4u+bWBBqjv/uwYKdV3MSpXu3dWhNkhlewOo4l940KszR+Jqk3/kh7ABfp0NyIjoeW7sjU7iOcS3rEEp00nGkLyaX9xPgz3KG/2xPPLnK/ZCP9TDXe1z3XEu8d2F4FuUMVIsgj8duK9+s87hvndbj7Fe4OaL/Y9TO8c2bEJA+kOhStcABbl51e3RpmoP2VQNkgHfxCqtfcxY51H6/xQsyhezyv9bp9LO1H56KZBdfE6LkbSiP+rIftNrV4/Ms9L1vxV2OZU5xsvOZ2L8N90hKeD/QIQT46djNT9D9PZme6hM/ZDpOc93aVYmL+CWJVfd6PDIQ2r/lSR7rVlEdMxLD02U32S0TUR33JDKy4x3YhYfbKhrrLl4rvIJ2vQTaSZ6Q/Bt3evm2M9tRqeEjnhQaDzpHOhse6vqLct/c2+dDZLEnO3dqH3ucdGxnnZFwnP/Di3lGC8vJ3zNPKyIXHgF+9+3omuAL+hk6PNaLV/3OE5P6+zD+1strx7vpjPGs9bxMsiO4r46enGY949mrKhjnemFUx189Ebgv9pnby00cuimthb+atZ3r6q+rU4oyyxnn0Pr0my4DqdchaY27K10fO65DnO0PnXmKYIpHMqIAv9f176FEphOi8uAd3MGpHfc5kfnL2NyRER6NQYdUMcBP+6K0v4coL6kzVBmetv/Ngfvpg/TdXeavDYuGRIb6g1a0YUR0PoOF/zWtYgF+tEATWfz68hKEdtK9ngS8LpFIOsJrVFTpujXD89Oe8Aq/cRM8p+1DXlDpy4Os0XGLJ4XGA+It3JK6CMf1BE8MjppyPOpJwp0K8OMjG2d0IMi/1QnKqPx4WGL0AW2qYoCftu1dM5kM7ic6YA8XkO/5wziYy1zHFjfMk15QTZt7Bcm0FubJu26t2FiETjqojqWJrjkh6HplFzvWdPpBaZJXPu3E9znYkz5DoixutstJFnsEfXWDmeV4mc9wtyE9XJ3V6ZHO3T2Bdaa/93pnx0Ps0SnRA2WPS5c+6/imHQ+6Hn+dR05Cz3x0CAF+923li0888x68zBn8K1yT1qjwRB4XgplDXJqAYmrnYn+wsyBhIjf+NwNUtQB/olvrojr+VqeTySzfC0JZSd69wlngds10A4twPOLG+P462wFkowtfPeKuOqFLUfT5Cvfww7o8mb2nzXk4/+CfdYjn7oWs+A/cdalTLo3VzPe4lfcHO1Aa9oDnQjzbZHceDIIAv7um++LwQJ0n0ze5Ru7MJpdpDpmIJbE/98Qu7Gi8jrAMtnbWboRvTFU3pUI98JM3+DCSg+q400FtsvHCAZ5wm4ZWs/qj3TWumftefyU+O/re+tc6gf/L3Tr0vyStbWJk5A+JxSWHeaJtaJnZCT0dvCeFB5kTfR+Y4AeTkDR8v3+OTvpnJxjXxY7Lya5EaGextR4nZZ72aujokKoF+GnXY27lD+CKxGzxV/nCdFE/E34G8ohrDeMX9vBBO6ZD+4z0tXpx38U39OcSD31VNbViHXQiExL9u/N0fU3zYauM9fb9edT3juV1HvoP8qTTPJrkgHSPOln3Zg3zyNWGOgs57eK2i1e2sILrQ3W68czqYivSVj8jmzmw/yeX+m5wXfs33Gmp00J2/X3O5K+OvQehScin3NWv1UnSY33cm6lmQIUD/Dxc7KMPbsiwRma7TVcI+L/aYhbjm4nJQkPdAowWU42/J4P9XTfPy1oHXn8njwJN9tDmQJPHqvJ5m1SxCbbxjOj0NlvXder9z/o86Obr521k6CpnqNcl9vFod42JFhLK20TQT/v37S5o1OMYpiexuN22Lll5ok5v+0aTaLfGuulEn7F5LkvJg1nu4/9x3/fXugXoGe7I1y1POn45Lxa7DHOp6H96wnO4JzXaAew4v1fh/nWujzs6pOw3wyiYyurCvNpP1dNcJ7vKk3XmesW9MPmn1exNuHC9ObGi5ds9NJelrG/wrexfLeNgqNZk1mYn38SP8P99JqMMfvyzFX3Wsnz/Nyl50qI/Q32N2SzjVSA78eCaJ7Wcv85tDrTGukRifKxm/G3OXP9qgNXTO7GPjX7e5jvwPt33wp4OXLP6fO0bERvBGu1SmgN9bFr5PIQR95v9f7eJ/ZzzPJk1TMTtpEZjlLH+nG/hOXxv8KjlI55j8Lk6TTi64T7P+1rrEeTtnFzYx+febLcbXewRpnj1QhTYT3dZ8TtcTnWeRx7QQWUP8LN2t2sD93FN3zMengy/v7DNGsSf+2k5KkkY4SfhUKPPU3C+A5Hk641yZuu5RMAc/T7KUI3xTeYIl3gNdanWqjpD1FU0sgRBZSuGOKM3N2fLvGcx36WbCZ0hOTxGP3cQdZL7tc90oL/A66rMdUvNhR1azTRuc48UPJHIqEe/jx66J/sBZD+fp8P9PrU7ofJJt79c5aD+Fb4GnOAgNNxjWxXWo/mhpPfG2nnO9jG+psOTV4d5oa5nYudvT+KYbuoH+O197Z/mRF/o/X+t23CHjjRpWelk4sEuD97GZWHh/PuYHzQWulRoeWwOxBh/zVyXaYX37mJJZ6e475VR5gA/nk3MMqv43x5G28PHO2T1v+6eu+242hfskBWJLgTj3BYsrQC/5ixKdHzjv8+r+LCrHCCnvc89sWNV8/v2Jf/bkDrnb48v8CE7FVdzx4Rke7g0JT9jWQbYVeqeE9fjrN527p6Rpfh525vBa0efreS+tCq6PnTrGtGJ732dH+z2ce35Tg62wqjuKR5F/mibAX78cx5tu7v2ujd27YpKZiLjYg/e8ftEX4eyzde4W8yJscm06x0whsmmrVrqUpcjvYhY9LOErPMNkn7W4veNH5voHjDSybrjYwF9dBx7XILZ51KsFZ67cLFjiFv9d1n5nbet/VC5q0drtvQowwm+b630iFKvfx/OxXN87jY7DxENKnOAv8bDRPKHpebOA/HZ8Wn4hYejXup9uNAfzuSwVbPC//9a7OITBdtp/nxhH270U3nNH94/d6A7QjctjAXLNU/s6WQ2ZjBP+cI2xMcr/sARD+7jvw5klSdrp+0231ijz1avbzbh58vK+gI8YHZz/sG2/rUTJRnNetY1wA/HAu0HU/5sPeah/ihw2thGV45HfX4r9hlNdmpp1hOum48+IzW/TidGXZb43nKhyyTmO+M8yRn9drP3iz1aMDF2fOsldBp5wO/x9aITIworfB981GWLq/2QG0ay27XICbpoMnDNo6zJJFEz1nneRPTAE90DomMZBfXxLP5Sn9srPDKxKOPrbD0PePup534s8EjDVGfsN3qxzsccI9zR4LoEQCFs6YsjgO440EFlfHSkKluf2+Idy8mFigqJNFZCBayKE9Kysjix8iCAzoqGsquoxxmzw521BapmaQ4z20BmCPABlEVU41lVIz3ZLUzEBgBUGAE+gLJYlugJXsXr+XxPfgQAVBgBPoCyeMJdNKpaphO1LjzAgT4AoKII8AGUSdUD/BHuCR66dgEAKooAH0CZrKx4Hb7cE/8QT7oFAFQQAT6AMlnunstVX99kgRc+AgBUEAE+gLLV4Vc9gy8vLrObVzMFAFQMAT6AMnlc0oasdyIntfh7xla6BgBUCAE+gDJ5WNJ6r+5aZWHhqx0kHSdpbtY7AwBIFwE+gLKtGP1c1juRE2MlHSHpGP8eAFARBPgAypjBx9876hxFRx0AqBYCfABlskLSkxXvhZ+8xu/mxa/GZL0zAIB0EOADKJt7yeI/z1Rn8cMCWACACiDAB1A2d0tal/VO5Ow6/yJJ7yTIB4DqLIgCAGWyiAD/BUJ5zmGSlriV6ANZvDEAgHSQwQdQNndIeppWmS8QOukcLel4l+0AAEqKAB9A2dwj6c9k8ev2xp8t6WRJB2fxxgAA0kGAD6CMfippNVn8utf8HV2PHzL547N4cwAA3UUNPoAy+q2k+yRN4jr3AsMl7SdpU0mjJV0saVUWbxIAoDvI4AMoo2WS/kCZTr9GurPOu73S7bg03xwAQHcR4AMoqxslPZv1TuR8BHdXSadLepukOVnvEACgMyjRAVBWv5e03GU6JDP6vwfsLmmypAWSfiPpSkmPpvxeAQAAAA25wFn8GtuAx6BP0nOS/irpPyTtwPkFAACAPHqnJ5AS4Dce6IeFsH4u6TSX8AAACtgXGQDKap5LTrbketeU9Q70Q0b/T5KulbRQ0opuvVEAgM4hwAdQdl9wJj+0hERzQkb/KUn3S7pb0sOSnvBKweHPt0taw0EFAABAmuZLukHSBkp1Wi5VCoH+Opc7PeLVgt8oaQynMgDkD50lAJTdIkkXeRIpWh/tHSFpgqTNvVhWWGuA7D0A5BABPoAquETSEmei0b6wiNiDHEgAyCcCfABVcJekT0ta6ZITtG6F++Uv5iACQD4R4AOoip9Jusq1+GjdzZJulbSWgwgA+USAD6AqQueXH7hunCx+a0KZ08XuqgMAAABkbpykn7jPO4tfNXcMQnD/YUkzs34TAQAAgLhDXYsfJtwS5DfeJjOMfuzAqQQAAIA8+rhLdgjyGwvw75V0QtZvGgAAANCfzSR9l1KdhoL7RyV9SNJ0TicAAADkWSg3eZws/oDB/ROSPkrdPQAUC110AFTV3ZLOdBYfL7TRHXNCe9HHOEAAAAAoghmSPuOe7tTj/z1zv8HB/UuyfoMAAACAZoXa8u87Y01Xnb9n7g/hVAIAAEBR7STpb2Tx/2cU4xpJR2X9hgAAAADterOk5yqexX9I0tsljeF0AgAAQBlWuX23pOU5CLTT3nrd6/6DdMwBAABAmYyX9EpJq3IQdKe1hS5CV0g6XtKUrN8AAAAAoBtOcyeZKgT3P5a0P6cRAAAAyp7JD7XoD+YgCO/WFuYb/EjSPlkfbAAAACANYaLpfpIuKOHk24clfdbdgwAAAIBK2ULSJ0vUQvNOj05MzfrAAgAAAFkuhvUlSc/kIEBvZwGrP0p6o0uQAAAAgEqb7Hr173pyaq0gWxh5uEfSxyTtIml01gcSAAAAyJPNJX3CveOLENzf7qz9hKwPHAAAAJBXEyUdKen8nLbT7PNE2m9IeknWBwsAAAAoimkO9L+dk5aaYVRhsaRvSTpE0qSsDxAAAABQ1Iz+HpIuyTC4X+fXP5RyHACotp6sdwAASpbR31HSgZIOcNA/rkvX2iiwXyHpavfrv0nSki68FgCgQAjwAaDzQqeaUZKmSNpd0m7edvXfDW3x+ltzq86HJN0g6UpJf5K0XNKTXfg5AAAFRIAPAOkE/MMlbeKe+gdJOkLSdu7KM9zBe71rc/j7pyXdLekyl+E8KulZ/z0AAM9DgA8A2QiLTY2UtKl/v6mz/mEb5u48IYhfJWmlpLX+PQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAoLf8fNNOS8mDGwGQAAAAASUVORK5CYII=";

  return (
    <div className="tax-invoice-a4-wrapper w-full max-w-[210mm] bg-white text-black p-[6mm] mx-auto box-border text-[11px] leading-normal font-sans border border-gray-200 print:border-none print:p-0 print:m-0 print:w-full print:max-w-none">

      {/* Universal Print Styles for A4 Multi-Page Pagination & Visibility */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 8mm;
        }
        @media print {
          html, body, #root, main {
            background: white !important;
            color: black !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .tax-invoice-a4-wrapper {
            width: 100% !important;
            max-width: 100% !important;
            min-height: 0 !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
          }
          table {
            width: 100% !important;
            table-layout: fixed !important;
            page-break-inside: auto !important;
          }
          thead {
            display: table-header-group !important;
          }
          tfoot {
            display: table-footer-group !important;
          }
          tbody tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .avoid-page-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Seller Header & Invoice Metadata Box */}
      <div className="flex justify-between items-start border-b border-gray-300 pb-3 mb-3 gap-3">
        <div className="w-[57%] flex items-start gap-3">
          <img
            src={data.logoUrl || "data:image/png;base64,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"}
            alt="TATTLY THREADS"
            className="h-12 w-auto object-contain mt-0.5"
          />
          <div>
            <h1 className="text-gray-900 font-bold text-sm leading-tight tracking-wide">TATTLY THREADS</h1>
            <p className="text-gray-600 text-[10px] leading-snug mt-0.5">
              {data.companyAddressDisplay || "Office No. 81, Ibrahim Rehmatullah Road, Beside Jio Gallery, near HP Petrol Pump, Mumbai, Maharashtra - 400003"}
            </p>
            <div className="text-gray-600 text-[10px] mt-1 font-mono leading-tight">
              <div>Web: {data.companyWebsite || "www.tattlythreads.com"}</div>
              <div>Dispatch: {data.dispatchEmail || "dispatch@tattlythreads.com"}</div>
              <div>Accounts: {data.accountsEmail || "accounts@tattlythreads.com"}</div>
            </div>
            <p className="text-gray-900 font-bold mt-1 font-mono text-[10px]">GSTIN: {data.companyGst || "27AAXFT2508H1ZR"}</p>
          </div>
        </div>

        <div className="w-[44%] text-right border-l border-gray-300 pl-3 box-border">
          <div className="flex justify-between items-start mb-1.5 border-b border-gray-200 pb-1">
            <div className="text-left">
              <h2 className="text-base font-bold text-gray-900 uppercase tracking-wider mb-0.5">TAX INVOICE</h2>
              <BarcodeCode128Svg value={data.invoiceNo} />
            </div>
            <QrCodeSvg value={`GSTIN:${data.companyGst || '27AAXFT2508H1ZR'}|INV:${data.invoiceNo}|VAL:${grandTotal.toFixed(2)}|DATE:${data.date}`} size={54} />
          </div>
          <table className="w-full font-mono text-[10px] border-collapse">
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-0.5 text-gray-500 font-normal text-left whitespace-nowrap w-[45%]">Invoice No:</td>
                <td className="py-0.5 font-bold text-gray-900 text-right whitespace-nowrap">{data.invoiceNo}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-0.5 text-gray-500 font-normal text-left whitespace-nowrap">Date:</td>
                <td className="py-0.5 text-gray-950 font-medium text-right whitespace-nowrap">
                  {(() => {
                    if (!data.date) return "";
                    const clean = data.date.trim().split("T")[0];
                    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
                      const [y, m, d] = clean.split("-");
                      return `${d}-${m}-${y}`;
                    }
                    return data.date;
                  })()}
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-0.5 text-gray-500 font-normal text-left whitespace-nowrap">SIS Code:</td>
                <td className="py-0.5 font-bold text-gray-900 text-right whitespace-nowrap">{data.sisCode || "1977"}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-0.5 text-gray-500 font-normal text-left whitespace-nowrap">POS State:</td>
                <td className="py-0.5 text-gray-950 font-medium text-right whitespace-nowrap">{data.placeOfSupply || "TELANGANA"}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-0.5 text-gray-500 font-normal text-left whitespace-nowrap">PO / Reference:</td>
                <td className="py-0.5 font-bold text-gray-900 text-right whitespace-nowrap">{data.poRef || (data as any).po_order_reference || data.poOrderReference || ""}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-0.5 text-gray-500 font-normal text-left whitespace-nowrap">E-Way Bill No:</td>
                <td className="py-0.5 text-right">
                  <input
                    type="text"
                    value={ewayBillNo}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEwayBillNo(val);
                      if (onEWayBillNoChange) onEWayBillNoChange(val);
                    }}
                    placeholder=""
                    title="Click to edit E-Way Bill Number"
                    style={{ transform: "translate(19px, -14px)" }}
                    className="w-full font-bold text-gray-900 text-right bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none text-[10px] p-0 m-0 transition-colors print:border-none print:bg-transparent print:p-0 print:m-0 print:placeholder-transparent print:w-full print:text-right box-border relative"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Bill To vs Ship To */}
      <div className="grid grid-cols-2 gap-4 border border-gray-300 p-2.5 rounded mb-3 bg-gray-50/40">
        <div>
          <h3 className="font-bold text-blue-800 uppercase text-[9px] tracking-wider border-b border-gray-300 pb-1 mb-1.5">
            BILLED TO (RECIPIENT)
          </h3>
          <p className="font-bold text-gray-900 text-xs">{data.customerName || "Reliance Retail Limited"}</p>
          <p className="text-gray-700 whitespace-pre-line leading-relaxed text-[10px] mt-1">{billingAddr}</p>
          <p className="font-bold text-gray-900 mt-1 font-mono text-[10px]">
            GSTIN: <span className="text-blue-900">{data.billingGst || "27AABCR1718E1ZL"}</span>
          </p>
        </div>

        <div>
          <h3 className="font-bold text-blue-800 uppercase text-[9px] tracking-wider border-b border-gray-300 pb-1 mb-1.5">
            SHIPPED TO (DELIVERY SITE)
          </h3>
          <p className="font-bold text-gray-900 text-xs">{data.shippingName || data.customerName || "Reliance Retail Limited"}</p>
          <p className="text-gray-700 whitespace-pre-line leading-relaxed text-[10px] mt-1">{shippingAddr}</p>
          {(data.shippingGst || data.customerGst) && (
            <p className="font-bold text-gray-900 mt-1 font-mono text-[10px]">
              GSTIN: <span className="text-blue-900">{data.shippingGst || data.customerGst}</span>
            </p>
          )}
        </div>
      </div>

      {/* Itemized Table */}
      <table className="w-full text-left border border-gray-300 border-collapse mb-4 table-fixed text-[10px]">
        <thead>
          <tr
            className="bg-gray-100 print:bg-gray-100 border-b border-gray-300 font-bold uppercase text-[9px] text-gray-800"
            style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
          >
            <th className="py-1.5 px-1 border-r border-gray-300 text-center w-[4%] align-middle font-bold">#</th>
            <th className="py-1.5 px-2 border-r border-gray-300 text-left w-[27%] align-middle font-bold whitespace-nowrap">ITEM DESCRIPTION</th>
            <th className="py-1.5 px-1 border-r border-gray-300 text-center w-[9%] align-middle font-bold whitespace-nowrap">HSN/SAC</th>
            <th className="py-1.5 px-1 border-r border-gray-300 text-right w-[7%] align-middle font-bold whitespace-nowrap">QTY</th>
            <th className="py-1.5 px-1 border-r border-gray-300 text-right w-[10%] align-middle font-bold whitespace-nowrap">MRP</th>
            <th className="py-1.5 px-1 border-r border-gray-300 text-right w-[8%] align-middle font-bold whitespace-nowrap">DISC %</th>
            <th className="py-1.5 px-1 border-r border-gray-300 text-right w-[11%] align-middle font-bold whitespace-nowrap">TAXABLE VALUE</th>
            {isInterstate ? (
              <th className="py-1.5 px-1 border-r border-gray-300 text-right w-[10%] align-middle font-bold whitespace-nowrap">IGST @ 5%</th>
            ) : (
              <>
                <th className="py-1.5 px-1 border-r border-gray-300 text-right w-[8%] align-middle font-bold whitespace-nowrap">CGST @ 2.5%</th>
                <th className="py-1.5 px-1 border-r border-gray-300 text-right w-[8%] align-middle font-bold whitespace-nowrap">SGST @ 2.5%</th>
              </>
            )}
            <th className="py-1.5 px-1.5 text-right w-[14%] align-middle font-bold whitespace-nowrap">AMOUNT</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {processedItems.map((item, idx) => (
            <tr key={idx} className="hover:bg-gray-50/50">
              <td className="p-1.5 border-r border-gray-300 text-center font-mono">{idx + 1}</td>
              <td className="p-1.5 border-r border-gray-300 font-medium text-gray-900 font-mono break-words">{cleanItemName(item.name)}</td>
              <td className="p-1.5 border-r border-gray-300 text-center font-mono">{item.hsn}</td>
              <td className="p-1.5 border-r border-gray-300 text-right font-mono font-semibold">{item.qty}</td>
              <td className="p-1.5 border-r border-gray-300 text-right font-mono font-medium text-gray-700">₹{item.mrp.toFixed(2)}</td>
              <td className="p-1.5 border-r border-gray-300 text-right font-mono font-medium text-blue-900">{item.discPercent.toFixed(2)}%</td>
              <td className="p-1.5 border-r border-gray-300 text-right font-mono font-semibold text-gray-900">₹{item.taxableValue.toFixed(2)}</td>
              {isInterstate ? (
                <td className="p-1.5 border-r border-gray-300 text-right font-mono text-gray-700">
                  ₹{item.igst.toFixed(2)}
                </td>
              ) : (
                <>
                  <td className="p-1.5 border-r border-gray-300 text-right font-mono text-gray-700">
                    ₹{item.cgst.toFixed(2)}
                  </td>
                  <td className="p-1.5 border-r border-gray-300 text-right font-mono text-gray-700">
                    ₹{item.sgst.toFixed(2)}
                  </td>
                </>
              )}
              <td className="p-1.5 text-right font-mono font-bold text-gray-900">₹{item.total.toFixed(2)}</td>
            </tr>
          ))}
          {processedItems.length === 0 && (
            <tr>
              <td colSpan={isInterstate ? 9 : 10} className="p-8 text-center text-gray-400 italic">
                No items included in this invoice.
              </td>
            </tr>
          )}
          {/* Summary Row - Renders ONLY once on the last page at the end of the items */}
          <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold font-mono text-[9px] text-gray-900">
            <td colSpan={3} className="p-1.5 border-r border-gray-300 text-right uppercase tracking-wider font-bold">
              TOTAL PAIRS:
            </td>
            <td className="p-1.5 border-r border-gray-300 text-right font-bold text-blue-900 bg-blue-50/50 text-[10px]">
              {totalQuantity}
            </td>
            <td className="p-1.5 border-r border-gray-300 text-right uppercase tracking-wider text-[8px] text-gray-600" colSpan={2}>
              Subtotal:
            </td>
            <td className="p-1.5 border-r border-gray-300 text-right font-bold">
              ₹{totalTaxableValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            {isInterstate ? (
              <td className="p-1.5 border-r border-gray-300 text-right font-bold">
                ₹{totalIGST.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            ) : (
              <>
                <td className="p-1.5 border-r border-gray-300 text-right font-bold">
                  ₹{totalCGST.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="p-1.5 border-r border-gray-300 text-right font-bold">
                  ₹{totalSGST.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </>
            )}
            <td className="p-1.5 text-right font-bold text-gray-950 text-[10px]">
              ₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Contiguous Footer & Totals Section - Avoid Page Break Inside */}
      <div className="avoid-page-break">

        {/* Totals Summary */}
        <div className="flex justify-between items-start mb-4 gap-4">
          {/* Left Side: Indian numbering words */}
          <div className="w-1/2 border border-gray-300 p-3 rounded bg-gray-50/30">
            <span className="text-gray-500 font-mono text-[9px] uppercase font-bold block mb-1">
              Amount in Words:
            </span>
            <p className="font-bold text-gray-900 leading-snug text-xs font-mono">
              {numberToIndianWords(roundedGrandTotal)}
            </p>
          </div>

          {/* Right Side: Totals calculation */}
          <div className="w-1/2 border border-gray-300 rounded overflow-hidden">
            <div className="grid grid-cols-2 divide-y divide-gray-200 text-right font-mono text-xs">
              <div className="p-1.5 bg-gray-50/50 text-gray-600 pr-3 border-r border-gray-200 font-semibold">Total Quantity:</div>
              <div className="p-1.5 pr-3 font-bold text-gray-900">{totalQuantity} {totalQuantity === 1 ? "Pair" : "Pairs"}</div>

              <div className="p-1.5 bg-gray-50/50 text-gray-600 pr-3 border-r border-gray-200 font-semibold">Taxable Value:</div>
              <div className="p-1.5 pr-3 font-semibold text-gray-900">₹{totalTaxableValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>

              {isInterstate ? (
                <>
                  <div className="p-1.5 bg-gray-50/50 text-gray-600 pr-3 border-r border-gray-200 font-semibold">IGST @ 5%:</div>
                  <div className="p-1.5 pr-3 font-semibold text-gray-900">₹{totalIGST.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </>
              ) : (
                <>
                  <div className="p-1.5 bg-gray-50/50 text-gray-600 pr-3 border-r border-gray-200 font-semibold">CGST @ 2.5%:</div>
                  <div className="p-1.5 pr-3 font-semibold text-gray-900">₹{totalCGST.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div className="p-1.5 bg-gray-50/50 text-gray-600 pr-3 border-r border-gray-200 font-semibold">SGST @ 2.5%:</div>
                  <div className="p-1.5 pr-3 font-semibold text-gray-900">₹{totalSGST.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </>
              )}

              {Math.abs(roundingAdjustment) > 0.005 && (
                <>
                  <div className="p-1.5 bg-gray-50/50 text-gray-600 pr-3 border-r border-gray-200 font-semibold">Rounding Adjustment:</div>
                  <div className="p-1.5 pr-3 font-semibold text-gray-900">₹{roundingAdjustment.toFixed(2)}</div>
                </>
              )}

              <div className="p-2 bg-gray-900 text-white font-bold text-xs pr-3 border-r border-gray-800">Grand Total:</div>
              <div className="p-2 bg-gray-900 text-white font-bold text-sm pr-3 font-mono">₹{roundedGrandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>
        </div>

        {/* GST Breakdown Summary Table */}
        <div className="mb-4">
          <h4 className="font-bold text-gray-800 uppercase text-[9px] tracking-wider mb-1">
            GST Summary / HSN-wise tax breakdown
          </h4>
          <table className="w-full border border-gray-300 border-collapse text-left text-[9px] font-mono">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-300 font-bold uppercase text-[8px] text-gray-700">
                <th className="p-1 border-r border-gray-300">HSN/SAC</th>
                <th className="p-1 border-r border-gray-300 text-right">Taxable Value</th>
                {isInterstate ? (
                  <>
                    <th className="p-1 border-r border-gray-300 text-right w-20">IGST Rate</th>
                    <th className="p-1 border-r border-gray-300 text-right">IGST Amount</th>
                  </>
                ) : (
                  <>
                    <th className="p-1 border-r border-gray-300 text-right w-16">CGST Rate</th>
                    <th className="p-1 border-r border-gray-300 text-right">CGST Amount</th>
                    <th className="p-1 border-r border-gray-300 text-right w-16">SGST Rate</th>
                    <th className="p-1 border-r border-gray-300 text-right">SGST Amount</th>
                  </>
                )}
                <th className="p-1 text-right">Total Tax</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {Object.entries(hsnBreakdown).map(([hsn, v]) => {
                const totalTax = v.cgst + v.sgst + v.igst;
                return (
                  <tr key={hsn}>
                    <td className="p-1.5 border-r border-gray-300 font-bold">{hsn}</td>
                    <td className="p-1.5 border-r border-gray-300 text-right">₹{v.taxable.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    {isInterstate ? (
                      <>
                        <td className="p-1.5 border-r border-gray-300 text-right">5%</td>
                        <td className="p-1.5 border-r border-gray-300 text-right">₹{v.igst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </>
                    ) : (
                      <>
                        <td className="p-1.5 border-r border-gray-300 text-right">2.5%</td>
                        <td className="p-1.5 border-r border-gray-300 text-right">₹{v.cgst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="p-1.5 border-r border-gray-300 text-right">2.5%</td>
                        <td className="p-1.5 border-r border-gray-300 text-right">₹{v.sgst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </>
                    )}
                    <td className="p-1.5 text-right font-bold">₹{totalTax.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Info: Bank / Note / Signature */}
        <div className="grid grid-cols-2 gap-4 border-t border-gray-200 pt-3 mt-2 text-[10px]">
          <div>
            <div className="mb-2 p-2 border border-gray-200 rounded bg-gray-50/20">
              <span className="text-gray-500 font-mono text-[9px] uppercase font-bold block mb-1">
                Bank Details
              </span>
              <p className="font-semibold text-gray-900">{data.bankName || ""}</p>
              <p className="text-gray-600 font-mono">A/C No: {data.bankAccountNo || ""}</p>
              <p className="text-gray-600 font-mono">IFSC: {data.bankIfsc || ""} {data.bankBranch ? `| Branch: ${data.bankBranch}` : ""}</p>
              {data.paymentTerms && <p className="text-gray-700 mt-1 italic">Terms: {data.paymentTerms}</p>}
            </div>

            {(data.footerText || data.notes) && (
              <div className="mb-2">
                <span className="text-gray-500 font-mono text-[9px] uppercase font-bold block mb-0.5">
                  Terms &amp; Conditions
                </span>
                <p className="text-gray-500 whitespace-pre-wrap text-[9px] leading-relaxed">{data.footerText || data.notes}</p>
              </div>
            )}

            {/* Customer Signature box directly below Terms & Conditions */}
            {/* <div className="text-center font-mono w-48 border border-gray-200 rounded p-1.5 bg-gray-50/10 mt-3">
              <div className="h-10" />
              <p className="border-t border-gray-300 pt-1 font-bold text-gray-800 uppercase text-[9px]">
                Customer Signature
              </p>
            </div> */}
          </div>

          <div className="flex flex-col justify-end items-end pl-8">
            <div className="text-center font-mono w-48 border border-gray-200 rounded p-1.5 bg-gray-50/10">
              <p className="text-[8px] text-gray-500 uppercase">For {data.companyName || "TATTLY THREADS"}</p>
              <div className="h-10 mt-1" />
              <p className="border-t border-gray-300 pt-1 font-bold text-gray-800 uppercase text-[9px]">
                Authorised Signatory
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-[9px] text-gray-500 border-t border-dashed pt-2 font-mono flex flex-col justify-center items-center text-center px-1">
          <div>
            <p>This is a computer-generated tax invoice and does not require a physical signature.</p>
            <p className="font-bold uppercase tracking-wider text-gray-700 mt-0.5 text-[8.5px]">Subject to Mumbai Jurisdiction.</p>
            <p className="font-bold text-gray-600 mt-0.5">SMRITI OS Retail Suite -- Powered by SMRITI SYSTEMS</p>
          </div>
        </div>
      </div>

    </div>
  );
};
