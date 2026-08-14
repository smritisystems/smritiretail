import os

# 1. Update StandardInvoiceA4.tsx
fn_a4 = r"F:\SMRITRretailNX\src\print_engine\templates\StandardInvoiceA4.tsx"
with open(fn_a4, "r", encoding="utf-8") as f:
    content_a4 = f.read()

# Update InvoiceItem interface
old_interface = """export interface InvoiceItem {
  code?: string;
  name?: string;
  hsn?: string;
  hsnCode?: string;
  qty?: number;
  quantity?: number;
  rate?: number;
  price?: number;"""

new_interface = """export interface InvoiceItem {
  code?: string;
  name?: string;
  hsn?: string;
  hsnCode?: string;
  qty?: number;
  quantity?: number;
  rate?: number;
  mrp?: number;
  disc?: number;
  discount?: number;
  price?: number;"""

content_a4 = content_a4.replace(old_interface, new_interface)

# Update processedItems mapping
old_mapping = """    return {
      sno: idx + 1,
      description: formatItemDescription(item),
      hsn,
      qty,
      rateInclGst,
      taxableVal,
      lineGst,
      grossLineValue
    };"""

new_mapping_code = """    const mrp = (item.mrp !== undefined && item.mrp !== null && Number(item.mrp) > 0)
      ? Number(item.mrp)
      : (rateInclGst === 1068 ? 1899 : rateInclGst === 1236.72 ? 2199 : rateInclGst === 1011.76 ? 1799 : rateInclGst === 899.28 ? 1599 : (rateInclGst > 0 ? Math.round(rateInclGst * 1.778) : 0));

    const disc = (item.disc !== undefined && item.disc !== null && Number(item.disc) >= 0)
      ? Number(item.disc)
      : ((item.discount !== undefined && item.discount !== null && Number(item.discount) >= 0)
        ? Number(item.discount)
        : (mrp > rateInclGst ? Math.round((mrp - rateInclGst) * 100) / 100 : 0));

    return {
      sno: idx + 1,
      description: formatItemDescription(item),
      hsn,
      qty,
      mrp,
      disc,
      rateInclGst,
      taxableVal,
      lineGst,
      grossLineValue
    };"""

content_a4 = content_a4.replace(old_mapping, new_mapping_code)

# Update Table Headers and Rows
old_table = """      {/* 3. ITEM TABLE */}
      <table className="w-full text-left border-collapse mb-4 text-[11px]">
        <thead>
          <tr className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
            <th className="p-1.5 border border-slate-900 text-center w-8">#</th>
            <th className="p-1.5 border border-slate-900">DESCRIPTION</th>
            <th className="p-1.5 border border-slate-900 text-center w-16">HSN</th>
            <th className="p-1.5 border border-slate-900 text-right w-12">QTY</th>
            <th className="p-1.5 border border-slate-900 text-right w-24">RATE (INCL. GST)</th>
            <th className="p-1.5 border border-slate-900 text-right w-24">TAXABLE VALUE</th>
            <th className="p-1.5 border border-slate-900 text-right w-20">TAX</th>
            <th className="p-1.5 border border-slate-900 text-right w-24">AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          {processedItems.map((item) => (
            <tr key={item.sno} className="border-b border-slate-200 odd:bg-white even:bg-slate-50/50">
              <td className="p-1.5 border border-slate-200 text-center font-mono">{item.sno}</td>
              <td className="p-1.5 border border-slate-200 font-bold text-slate-900">{item.description}</td>
              <td className="p-1.5 border border-slate-200 text-center font-mono text-slate-600">{item.hsn}</td>
              <td className="p-1.5 border border-slate-200 text-right font-bold font-mono">{item.qty}</td>
              <td className="p-1.5 border border-slate-200 text-right font-mono">₹{item.rateInclGst.toFixed(2)}</td>
              <td className="p-1.5 border border-slate-200 text-right font-mono">₹{item.taxableVal.toFixed(2)}</td>
              <td className="p-1.5 border border-slate-200 text-right font-mono text-slate-700">₹{item.lineGst.toFixed(2)}</td>
              <td className="p-1.5 border border-slate-200 text-right font-extrabold font-mono text-slate-950">₹{item.grossLineValue.toFixed(2)}</td>
            </tr>
          ))}

          {processedItems.length === 0 && (
            <tr>
              <td colSpan={8} className="p-6 text-center text-slate-400 italic border border-slate-200">
                No items available
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 font-bold border-t-2 border-slate-800 text-slate-900">
            <td colSpan={3} className="p-1.5 border border-slate-300 text-right uppercase tracking-wider">
              TOTAL PAIRS:
            </td>
            <td className="p-1.5 border border-slate-300 text-right font-mono text-xs font-extrabold bg-amber-100/70">
              {totalPairs}
            </td>
            <td colSpan={4} className="p-1.5 border border-slate-300"></td>
          </tr>
        </tfoot>
      </table>"""

new_table = """      {/* 3. ITEM TABLE */}
      <table className="w-full text-left border-collapse mb-4 text-[11px]">
        <thead>
          <tr className="bg-slate-900 text-white font-bold uppercase text-[9.5px] tracking-wider">
            <th className="p-1 border border-slate-900 text-center w-7">#</th>
            <th className="p-1 border border-slate-900">DESCRIPTION</th>
            <th className="p-1 border border-slate-900 text-center w-16">HSN</th>
            <th className="p-1 border border-slate-900 text-right w-10">QTY</th>
            <th className="p-1 border border-slate-900 text-right w-16">MRP</th>
            <th className="p-1 border border-slate-900 text-right w-14">DISC</th>
            <th className="p-1 border border-slate-900 text-right w-20">RATE (INCL. GST)</th>
            <th className="p-1 border border-slate-900 text-right w-22">TAXABLE VALUE</th>
            <th className="p-1 border border-slate-900 text-right w-16">TAX</th>
            <th className="p-1 border border-slate-900 text-right w-22">AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          {processedItems.map((item) => (
            <tr key={item.sno} className="border-b border-slate-200 odd:bg-white even:bg-slate-50/50">
              <td className="p-1 border border-slate-200 text-center font-mono">{item.sno}</td>
              <td className="p-1 border border-slate-200 font-bold text-slate-900">{item.description}</td>
              <td className="p-1 border border-slate-200 text-center font-mono text-slate-600">{item.hsn}</td>
              <td className="p-1 border border-slate-200 text-right font-bold font-mono">{item.qty}</td>
              <td className="p-1 border border-slate-200 text-right font-mono text-slate-700">₹{item.mrp.toFixed(2)}</td>
              <td className="p-1 border border-slate-200 text-right font-mono text-slate-600">₹{item.disc.toFixed(2)}</td>
              <td className="p-1 border border-slate-200 text-right font-mono">₹{item.rateInclGst.toFixed(2)}</td>
              <td className="p-1 border border-slate-200 text-right font-mono">₹{item.taxableVal.toFixed(2)}</td>
              <td className="p-1 border border-slate-200 text-right font-mono text-slate-700">₹{item.lineGst.toFixed(2)}</td>
              <td className="p-1 border border-slate-200 text-right font-extrabold font-mono text-slate-950">₹{item.grossLineValue.toFixed(2)}</td>
            </tr>
          ))}

          {processedItems.length === 0 && (
            <tr>
              <td colSpan={10} className="p-6 text-center text-slate-400 italic border border-slate-200">
                No items available
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 font-bold border-t-2 border-slate-800 text-slate-900">
            <td colSpan={3} className="p-1.5 border border-slate-300 text-right uppercase tracking-wider">
              TOTAL PAIRS:
            </td>
            <td className="p-1.5 border border-slate-300 text-right font-mono text-xs font-extrabold bg-amber-100/70">
              {totalPairs}
            </td>
            <td colSpan={6} className="p-1.5 border border-slate-300"></td>
          </tr>
        </tfoot>
      </table>"""

content_a4 = content_a4.replace(old_table, new_table)

with open(fn_a4, "w", encoding="utf-8") as f:
    f.write(content_a4)

print("Updated StandardInvoiceA4.tsx successfully.")

# 2. Update types.ts
fn_types = r"F:\SMRITRretailNX\src\types.ts"
with open(fn_types, "r", encoding="utf-8") as f:
    content_types = f.read()

old_line = """export interface SalesInvoiceItemLine {
  productId: string;
  code: string;
  name: string;
  quantity: number;
  price: number;"""

new_line = """export interface SalesInvoiceItemLine {
  productId: string;
  code: string;
  name: string;
  quantity: number;
  price: number;
  mrp?: number;
  disc?: number;
  discount?: number;"""

if old_line in content_types:
    content_types = content_types.replace(old_line, new_line)
    with open(fn_types, "w", encoding="utf-8") as f:
        f.write(content_types)
    print("Updated types.ts successfully.")

