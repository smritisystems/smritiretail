/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.25.0
 * Created      : 2026-08-24
 * Modified     : 2026-08-24
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import pako from "pako";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";
import {
  ExportColumnDefinition,
  ExportDatasetOptions,
  ExportFormat,
  ExportMetadata,
  ExportPagedEndpointOptions,
  ExportProgressState,
  ExportResult,
  ExportScope,
} from "../components/export/types.ts";

/**
 * Universal sensitive field blacklist that must never be exported.
 */
export const SENSITIVE_EXPORT_FIELDS = new Set([
  "password",
  "hashed_password",
  "password_hash",
  "jwt_token",
  "auth_token",
  "session_token",
  "token",
  "secret",
  "secret_key",
  "api_key",
  "sgip_key",
  "master_key",
  "private_key",
  "internal_credentials",
  "salt",
  "pin_hash",
]);

/**
 * Sanitizes an object row by stripping any blacklisted or sensitive keys.
 */
export function sanitizeExportRecord(record: any): any {
  if (!record || typeof record !== "object") return record;
  if (Array.isArray(record)) {
    return record.map(sanitizeExportRecord);
  }

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(record)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_EXPORT_FIELDS.has(lowerKey)) {
      continue;
    }
    if (value && typeof value === "object") {
      cleaned[key] = sanitizeExportRecord(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/**
 * Formats a value according to its column datatype.
 */
export function formatCellValue(value: any, col: ExportColumnDefinition, row?: any): string {
  if (col.format) {
    return col.format(value, row);
  }
  if (value === null || value === undefined) {
    return "";
  }

  switch (col.datatype) {
    case "currency": {
      const num = Number(value);
      if (isNaN(num)) return String(value);
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }).format(num);
    }
    case "percentage": {
      const num = Number(value);
      if (isNaN(num)) return String(value);
      return `${num.toFixed(2)}%`;
    }
    case "number": {
      const num = Number(value);
      if (isNaN(num)) return String(value);
      return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 4 }).format(num);
    }
    case "date": {
      if (!value) return "";
      try {
        const d = new Date(value);
        return isNaN(d.getTime()) ? String(value) : d.toISOString().split("T")[0];
      } catch {
        return String(value);
      }
    }
    case "datetime": {
      if (!value) return "";
      try {
        const d = new Date(value);
        return isNaN(d.getTime()) ? String(value) : d.toISOString().replace("T", " ").substring(0, 19);
      } catch {
        return String(value);
      }
    }
    case "boolean":
      return value ? "Yes" : "No";
    default:
      if (value && typeof value === "object") {
        if (Array.isArray(value)) {
          if (value.length === 0) return "";
          if (typeof value[0] !== "object") {
            return value.join(", ");
          }
          return value
            .map((item) => {
              if (!item || typeof item !== "object") return String(item);
              return item.name || item.title || item.invoice_no || item.invoiceNo || item.order_no || item.orderNo || item.code || JSON.stringify(item);
            })
            .join("; ");
        }
        // If object has a primary human-readable identifier
        if (value.name) return String(value.name);
        if (value.title) return String(value.title);
        if (value.label) return String(value.label);
        if (value.code) return String(value.code);
        if (value.description) return String(value.description);
        
        try {
          const entries = Object.entries(value).filter(([_, v]) => v !== null && v !== undefined && typeof v !== "object");
          if (entries.length > 0) {
            return entries.map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(", ");
          }
          return JSON.stringify(value);
        } catch {
          return String(value);
        }
      }
      return String(value);
  }
}

/**
 * Generates a clean, timestamped, and sanitized filename.
 * Example: SMRITI_Item_Master_All_2026-08-24.xlsx
 */
export function generateSafeExportFilename(
  moduleName: string,
  scope: ExportScope,
  format: ExportFormat,
  customName?: string
): string {
  if (customName && customName.trim()) {
    const base = customName.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
    return `${base}.${format}`;
  }
  const cleanModule = moduleName.trim().replace(/[^a-zA-Z0-9]/g, "_").replace(/__+/g, "_");
  const scopeLabel = scope.charAt(0).toUpperCase() + scope.slice(1);
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-");

  return `SMRITI_${cleanModule}_${scopeLabel}_${dateStr}_${timeStr}.${format}`;
}

/**
 * Serializes dataset into RFC 4180 CSV with UTF-8 BOM.
 */
export function serializeToCSV(
  columns: ExportColumnDefinition[],
  data: any[],
  metadata?: ExportMetadata
): string {
  const visibleCols = columns.filter((c) => c.isVisible !== false);
  const lines: string[] = [];

  // 1. Optional Metadata Header
  if (metadata) {
    lines.push(`# SMRITI Retail OS - Export Center`);
    lines.push(`# Module: ${metadata.moduleTitle || "Master Data"}`);
    if (metadata.companyName) lines.push(`# Company: ${metadata.companyName}`);
    if (metadata.branchName) lines.push(`# Branch: ${metadata.branchName}`);
    if (metadata.exportedBy) lines.push(`# Exported By: ${metadata.exportedBy}`);
    lines.push(`# Export Timestamp: ${metadata.exportTimestamp || new Date().toISOString()}`);
    if (metadata.searchTerm) lines.push(`# Search Term: ${metadata.searchTerm}`);
    if (metadata.appliedFilters && Object.keys(metadata.appliedFilters).length > 0) {
      lines.push(`# Applied Filters: ${JSON.stringify(metadata.appliedFilters)}`);
    }
    lines.push(`# Total Rows: ${data.length}`);
    lines.push(""); // empty line before table header
  }

  // 2. Table Column Headers
  const headerRow = visibleCols.map((c) => escapeCSVValue(c.label)).join(",");
  lines.push(headerRow);

  // 3. Table Data Rows
  for (const row of data) {
    const rowValues = visibleCols.map((c) => {
      const val = row[c.key];
      const formatted = formatCellValue(val, c, row);
      return escapeCSVValue(formatted);
    });
    lines.push(rowValues.join(","));
  }

  // 4. Summary / Totals Row if any column is summary-enabled
  const hasSummary = visibleCols.some((c) => c.isSummary);
  if (hasSummary && data.length > 0) {
    const summaryValues = visibleCols.map((c, idx) => {
      if (idx === 0) return escapeCSVValue("TOTAL / SUMMARY");
      if (c.isSummary && (c.datatype === "number" || c.datatype === "currency")) {
        const sum = data.reduce((acc, row) => acc + (Number(row[c.key]) || 0), 0);
        return escapeCSVValue(formatCellValue(sum, c));
      }
      return "";
    });
    lines.push(summaryValues.join(","));
  }

  // Prepend UTF-8 BOM so Excel opens non-ASCII and rupee signs properly
  return "\uFEFF" + lines.join("\r\n");
}

function escapeCSVValue(val: string): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serializes dataset into clean Tab-Separated Values (TSV) format for instant
 * clipboard pasting and direct import into Google Spreadsheets (sheets.new).
 */
export function serializeToTSV(
  columns: ExportColumnDefinition[],
  data: any[],
  metadata?: ExportMetadata
): string {
  const visibleCols = columns.filter((c) => c.isVisible !== false);
  const lines: string[] = [];

  // 1. Optional Metadata Header
  if (metadata) {
    lines.push(`SMRITI Retail OS — ${metadata.moduleTitle || "Export Report"}`);
    if (metadata.companyName) lines.push(`Company\t${metadata.companyName}`);
    if (metadata.branchName) lines.push(`Branch\t${metadata.branchName}`);
    if (metadata.exportTimestamp) lines.push(`Timestamp\t${metadata.exportTimestamp}`);
    if (metadata.searchTerm) lines.push(`Search\t${metadata.searchTerm}`);
    lines.push("");
  }

  // 2. Table Column Headers
  const headerRow = visibleCols.map((c) => c.label.replace(/\t/g, " ")).join("\t");
  lines.push(headerRow);

  // 3. Table Data Rows
  for (const row of data) {
    const rowValues = visibleCols.map((c) => {
      const val = row[c.key];
      const formatted = formatCellValue(val, c, row);
      return String(formatted).replace(/[\t\r\n]/g, " ");
    });
    lines.push(rowValues.join("\t"));
  }

  // 4. Summary / Totals Row if any column is summary-enabled
  const hasSummary = visibleCols.some((c) => c.isSummary);
  if (hasSummary && data.length > 0) {
    const summaryValues = visibleCols.map((c, idx) => {
      if (idx === 0) return "TOTAL / SUMMARY";
      if (c.isSummary && (c.datatype === "number" || c.datatype === "currency")) {
        const sum = data.reduce((acc, row) => acc + (Number(row[c.key]) || 0), 0);
        return formatCellValue(sum, c);
      }
      return "";
    });
    lines.push(summaryValues.join("\t"));
  }

  return lines.join("\r\n");
}

/**
 * Generates an Excel SpreadsheetML XML file (.xlsx / .xml) with native XML formatting,
 * freeze panes, styles, auto-filtering, and typed numeric/currency/date cells.
 */
export function serializeToSpreadsheetML(
  columns: ExportColumnDefinition[],
  data: any[],
  metadata?: ExportMetadata,
  sheetName: string = "SMRITI Export"
): string {
  const visibleCols = columns.filter((c) => c.isVisible !== false);
  const cleanSheetName = sheetName.replace(/[:\\/?*\[\]]/g, "_").substring(0, 31);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>${escapeXML(metadata?.moduleTitle || "SMRITI Export")}</Title>
  <Author>${escapeXML(metadata?.exportedBy || "SMRITI Retail OS")}</Author>
  <Created>${new Date().toISOString()}</Created>
  <Company>${escapeXML(metadata?.companyName || "SMRITI")}</Company>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="TitleStyle">
   <Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#003D9B"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="MetaStyle">
   <Font ss:FontName="Calibri" ss:Size="9" ss:Italic="1" ss:Color="#555555"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="HeaderStyle">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#003D9B" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#002566"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#002566"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#002566"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#002566"/>
   </Borders>
  </Style>
  <Style ss:ID="TextCell">
   <Alignment ss:Vertical="Center" ss:Horizontal="Left"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
  </Style>
  <Style ss:ID="NumberCell">
   <Alignment ss:Vertical="Center" ss:Horizontal="Right"/>
   <NumberFormat ss:Format="#,##0.00"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
  </Style>
  <Style ss:ID="CurrencyCell">
   <Alignment ss:Vertical="Center" ss:Horizontal="Right"/>
   <NumberFormat ss:Format="[$₹-en-IN] #,##0.00"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
  </Style>
  <Style ss:ID="DateCell">
   <Alignment ss:Vertical="Center" ss:Horizontal="Center"/>
   <NumberFormat ss:Format="YYYY-MM-DD"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
   </Borders>
  </Style>
  <Style ss:ID="SummaryStyle">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#000000"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center" ss:Horizontal="Right"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#003D9B"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#003D9B"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXML(cleanSheetName)}">
  <Table ss:DefaultRowHeight="20">
`;

  // Define column widths safely (never output NaN)
  for (const col of visibleCols) {
    let width = 120;
    if (typeof col.width === "number" && !isNaN(col.width) && col.width > 0) {
      width = col.width > 30 ? col.width : col.width * 8;
    } else if (typeof col.width === "string") {
      const parsed = parseFloat(col.width.replace(/[^0-9.]/g, ""));
      if (!isNaN(parsed) && parsed > 0) {
        width = parsed > 30 ? parsed : parsed * 8;
      }
    }
    xml += `   <Column ss:Width="${width}"/>\n`;
  }

  // Title & Metadata rows
  if (metadata) {
    xml += `   <Row ss:Height="25">\n`;
    xml += `    <Cell ss:StyleID="TitleStyle"><Data ss:Type="String">SMRITI Retail OS - ${escapeXML(metadata.moduleTitle)}</Data></Cell>\n`;
    xml += `   </Row>\n`;

    const metaItems: string[] = [];
    if (metadata.companyName) metaItems.push(`Company: ${metadata.companyName}`);
    if (metadata.branchName) metaItems.push(`Branch: ${metadata.branchName}`);
    if (metadata.exportedBy) metaItems.push(`User: ${metadata.exportedBy}`);
    metaItems.push(`Export Date: ${metadata.exportTimestamp || new Date().toLocaleString()}`);
    if (metadata.searchTerm) metaItems.push(`Search: "${metadata.searchTerm}"`);

    xml += `   <Row ss:Height="16">\n`;
    xml += `    <Cell ss:StyleID="MetaStyle"><Data ss:Type="String">${escapeXML(metaItems.join(" | "))}</Data></Cell>\n`;
    xml += `   </Row>\n`;
    xml += `   <Row ss:Height="8"/>\n`; // Spacer
  }

  // Header Row
  xml += `   <Row ss:Height="24">\n`;
  for (const col of visibleCols) {
    xml += `    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${escapeXML(col.label)}</Data></Cell>\n`;
  }
  xml += `   </Row>\n`;

  // Data Rows
  for (const row of data) {
    xml += `   <Row ss:Height="20">\n`;
    for (const col of visibleCols) {
      const val = row[col.key];
      if (val === null || val === undefined || String(val).trim() === "" || String(val).trim() === "—") {
        xml += `    <Cell ss:StyleID="TextCell"><Data ss:Type="String"></Data></Cell>\n`;
      } else if (col.datatype === "number" || col.datatype === "percentage") {
        const rawNum = typeof val === "number" ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ""));
        if (!isNaN(rawNum)) {
          xml += `    <Cell ss:StyleID="NumberCell"><Data ss:Type="Number">${rawNum}</Data></Cell>\n`;
        } else {
          xml += `    <Cell ss:StyleID="TextCell"><Data ss:Type="String">${escapeXML(String(val))}</Data></Cell>\n`;
        }
      } else if (col.datatype === "currency") {
        const rawNum = typeof val === "number" ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ""));
        if (!isNaN(rawNum)) {
          xml += `    <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${rawNum}</Data></Cell>\n`;
        } else {
          xml += `    <Cell ss:StyleID="TextCell"><Data ss:Type="String">${escapeXML(String(val))}</Data></Cell>\n`;
        }
      } else if (col.datatype === "date" || col.datatype === "datetime") {
        const strVal = formatCellValue(val, col, row);
        xml += `    <Cell ss:StyleID="DateCell"><Data ss:Type="String">${escapeXML(strVal)}</Data></Cell>\n`;
      } else {
        const strVal = formatCellValue(val, col, row);
        xml += `    <Cell ss:StyleID="TextCell"><Data ss:Type="String">${escapeXML(strVal)}</Data></Cell>\n`;
      }
    }
    xml += `   </Row>\n`;
  }

  // Summary row
  const hasSummary = visibleCols.some((c) => c.isSummary);
  if (hasSummary && data.length > 0) {
    xml += `   <Row ss:Height="22">\n`;
    for (let idx = 0; idx < visibleCols.length; idx++) {
      const col = visibleCols[idx];
      if (idx === 0) {
        xml += `    <Cell ss:StyleID="SummaryStyle"><Data ss:Type="String">TOTAL / SUMMARY</Data></Cell>\n`;
      } else if (col.isSummary && (col.datatype === "number" || col.datatype === "currency")) {
        const sum = data.reduce((acc, row) => {
          const raw = typeof row[col.key] === "number" ? row[col.key] : parseFloat(String(row[col.key] || "").replace(/[^0-9.-]/g, ""));
          return acc + (!isNaN(raw) ? raw : 0);
        }, 0);
        const style = col.datatype === "currency" ? "CurrencyCell" : "NumberCell";
        xml += `    <Cell ss:StyleID="${style}"><Data ss:Type="Number">${sum}</Data></Cell>\n`;
      } else {
        xml += `    <Cell ss:StyleID="SummaryStyle"><Data ss:Type="String"></Data></Cell>\n`;
      }
    }
    xml += `   </Row>\n`;
  }

  xml += `  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <FreezePanes/>
   <FrozenNoSplit/>
   <SplitHorizontal>${metadata ? "4" : "1"}</SplitHorizontal>
   <TopRowBottomPane>${metadata ? "4" : "1"}</TopRowBottomPane>
   <ActivePane>2</ActivePane>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;

  return xml;
}

function escapeXML(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// CRC32 table for zip generation
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c;
}

export function calculateCRC32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function getExcelColumnName(colIndex: number): string {
  let name = "";
  let c = colIndex;
  while (c >= 0) {
    name = String.fromCharCode((c % 26) + 65) + name;
    c = Math.floor(c / 26) - 1;
  }
  return name;
}

export function createZipPackage(entries: { path: string; data: Uint8Array }[]): Uint8Array {
  const encoder = new TextEncoder();
  const fileRecords: {
    pathBytes: Uint8Array;
    compressedData: Uint8Array;
    crc: number;
    uncompressedSize: number;
    compressedSize: number;
    offset: number;
    method: number;
  }[] = [];

  let offset = 0;
  const parts: Uint8Array[] = [];

  for (const entry of entries) {
    const pathBytes = encoder.encode(entry.path);
    const uncompressedSize = entry.data.length;
    const crc = calculateCRC32(entry.data);

    let compressedData = entry.data;
    let method = 0; // Stored (no compression)

    if (typeof pako !== "undefined" && pako && typeof (pako as any).deflateRaw === "function") {
      try {
        const deflated = (pako as any).deflateRaw(entry.data);
        compressedData = deflated;
        method = 8; // Deflate
      } catch {
        compressedData = entry.data;
        method = 0;
      }
    }

    const compressedSize = compressedData.length;

    // Local file header (30 bytes + path length)
    const localHeader = new Uint8Array(30 + pathBytes.length);
    const view = new DataView(localHeader.buffer);
    view.setUint32(0, 0x04034b50, true); // signature
    view.setUint16(4, 20, true); // version needed
    view.setUint16(6, 0, true); // general purpose flags
    view.setUint16(8, method, true); // compression method
    view.setUint16(10, 0, true); // file time
    view.setUint16(12, 0, true); // file date
    view.setUint32(14, crc, true); // crc-32
    view.setUint32(18, compressedSize, true); // compressed size
    view.setUint32(22, uncompressedSize, true); // uncompressed size
    view.setUint16(26, pathBytes.length, true); // file name length
    view.setUint16(28, 0, true); // extra field length
    localHeader.set(pathBytes, 30);

    fileRecords.push({
      pathBytes,
      compressedData,
      crc,
      uncompressedSize,
      compressedSize,
      offset,
      method,
    });

    parts.push(localHeader);
    parts.push(compressedData);
    offset += localHeader.length + compressedData.length;
  }

  const centralDirectoryOffset = offset;
  let centralDirectorySize = 0;

  // Central directory
  for (const rec of fileRecords) {
    const cdHeader = new Uint8Array(46 + rec.pathBytes.length);
    const view = new DataView(cdHeader.buffer);
    view.setUint32(0, 0x02014b50, true); // signature
    view.setUint16(4, 20, true); // version made by
    view.setUint16(6, 20, true); // version needed
    view.setUint16(8, 0, true); // flags
    view.setUint16(10, rec.method, true); // compression method
    view.setUint16(12, 0, true); // file time
    view.setUint16(14, 0, true); // file date
    view.setUint32(16, rec.crc, true); // crc-32
    view.setUint32(20, rec.compressedSize, true); // compressed size
    view.setUint32(24, rec.uncompressedSize, true); // uncompressed size
    view.setUint16(28, rec.pathBytes.length, true); // file name length
    view.setUint16(30, 0, true); // extra field length
    view.setUint16(32, 0, true); // file comment length
    view.setUint16(34, 0, true); // disk number start
    view.setUint16(36, 0, true); // internal file attributes
    view.setUint32(38, 0, true); // external file attributes
    view.setUint32(42, rec.offset, true); // relative offset of local header
    cdHeader.set(rec.pathBytes, 46);

    parts.push(cdHeader);
    centralDirectorySize += cdHeader.length;
  }

  // End of central directory record (22 bytes)
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true); // signature
  eocdView.setUint16(4, 0, true); // disk number
  eocdView.setUint16(6, 0, true); // disk with central directory
  eocdView.setUint16(8, fileRecords.length, true); // number of records on disk
  eocdView.setUint16(10, fileRecords.length, true); // total number of records
  eocdView.setUint32(12, centralDirectorySize, true); // size of central directory
  eocdView.setUint32(16, centralDirectoryOffset, true); // offset of start of central directory
  eocdView.setUint16(20, 0, true); // comment length
  parts.push(eocd);

  // Combine all parts
  const totalLength = parts.reduce((acc, p) => acc + p.length, 0);
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const part of parts) {
    result.set(part, pos);
    pos += part.length;
  }
  return result;
}

/**
 * Serializes dataset into genuine OpenXML Spreadsheet (.xlsx) binary container.
 * 100% compliant with ECMA-376 / ISO/IEC 29500 OpenXML standard.
 * Opens natively in Microsoft Excel, Microsoft 365, LibreOffice, Apple Numbers, and Google Sheets.
 */
export function serializeToOpenXMLXLSX(
  columns: ExportColumnDefinition[],
  data: any[],
  metadata?: ExportMetadata,
  sheetName: string = "SMRITI Export"
): Uint8Array {
  const encoder = new TextEncoder();
  const visibleCols = columns.filter((c) => c.isVisible !== false);
  const cleanSheetName = sheetName.replace(/[:\\/?*\[\]]/g, "_").substring(0, 31) || "Sheet1";

  // 1. [Content_Types].xml
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  // 2. _rels/.rels
  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  // 3. xl/_rels/workbook.xml.rels
  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  // 4. xl/workbook.xml
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXML(cleanSheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  // 5. xl/styles.xml
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="#,##0.00"/>
    <numFmt numFmtId="165" formatCode="[$₹-en-IN] #,##0.00"/>
  </numFmts>
  <fonts count="4">
    <font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="14"/><color rgb="FF003D9B"/><name val="Calibri"/><family val="2"/></font>
    <font><i/><sz val="9"/><color rgb="FF555555"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF003D9B"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFE5E7EB"/></left>
      <right style="thin"><color rgb="FFE5E7EB"/></right>
      <top style="thin"><color rgb="FFE5E7EB"/></top>
      <bottom style="thin"><color rgb="FFE5E7EB"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="8">
    <!-- 0: Default -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <!-- 1: Header (White text, Bold, Dark Blue #003D9B, Centered) -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <!-- 2: Standard Text Left -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <!-- 3: Number Right -->
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <!-- 4: Currency Right (₹ INR) -->
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <!-- 5: Title Style -->
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <!-- 6: Meta Style -->
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <!-- 7: Summary Row Bold Right -->
    <xf numFmtId="164" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
  </cellXfs>
</styleSheet>`;

  // 6. xl/worksheets/sheet1.xml
  let currentRow = 1;
  const rowsXml: string[] = [];

  // Title & Metadata
  if (metadata) {
    // Title Row
    const titleCell = `A${currentRow}`;
    rowsXml.push(`<row r="${currentRow}" ht="26" customHeight="1"><c r="${titleCell}" s="5" t="inlineStr"><is><t>SMRITI Retail OS - ${escapeXML(metadata.moduleTitle)}</t></is></c></row>`);
    currentRow++;

    // Meta items
    const metaItems: string[] = [];
    if (metadata.companyName) metaItems.push(`Company: ${metadata.companyName}`);
    if (metadata.branchName) metaItems.push(`Branch: ${metadata.branchName}`);
    if (metadata.exportedBy) metaItems.push(`User: ${metadata.exportedBy}`);
    metaItems.push(`Export Date: ${metadata.exportTimestamp || new Date().toLocaleString()}`);
    if (metadata.searchTerm) metaItems.push(`Search: "${metadata.searchTerm}"`);

    const metaCell = `A${currentRow}`;
    rowsXml.push(`<row r="${currentRow}" ht="18" customHeight="1"><c r="${metaCell}" s="6" t="inlineStr"><is><t>${escapeXML(metaItems.join(" | "))}</t></is></c></row>`);
    currentRow++;

    // Spacer row
    rowsXml.push(`<row r="${currentRow}" ht="8" customHeight="1"/>`);
    currentRow++;
  }

  const headerRowIndex = currentRow;
  const headerCells = visibleCols.map((c, colIdx) => {
    const cellRef = `${getExcelColumnName(colIdx)}${headerRowIndex}`;
    return `<c r="${cellRef}" s="1" t="inlineStr"><is><t>${escapeXML(c.label)}</t></is></c>`;
  });
  rowsXml.push(`<row r="${headerRowIndex}" ht="24" customHeight="1">${headerCells.join("")}</row>`);
  currentRow++;

  // Data Rows
  for (const row of data) {
    const dataRowIndex = currentRow;
    const cells = visibleCols.map((col, colIdx) => {
      const cellRef = `${getExcelColumnName(colIdx)}${dataRowIndex}`;
      const val = row[col.key];

      if (val === null || val === undefined || String(val).trim() === "" || String(val).trim() === "—") {
        return `<c r="${cellRef}" s="2"/>`;
      }

      if (col.datatype === "number" || col.datatype === "percentage") {
        const rawNum = typeof val === "number" ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ""));
        if (!isNaN(rawNum)) {
          return `<c r="${cellRef}" s="3"><v>${rawNum}</v></c>`;
        }
        return `<c r="${cellRef}" s="2" t="inlineStr"><is><t>${escapeXML(String(val))}</t></is></c>`;
      }

      if (col.datatype === "currency") {
        const rawNum = typeof val === "number" ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ""));
        if (!isNaN(rawNum)) {
          return `<c r="${cellRef}" s="4"><v>${rawNum}</v></c>`;
        }
        return `<c r="${cellRef}" s="2" t="inlineStr"><is><t>${escapeXML(String(val))}</t></is></c>`;
      }

      const strVal = formatCellValue(val, col, row);
      return `<c r="${cellRef}" s="2" t="inlineStr"><is><t>${escapeXML(strVal)}</t></is></c>`;
    });

    rowsXml.push(`<row r="${dataRowIndex}" ht="20" customHeight="1">${cells.join("")}</row>`);
    currentRow++;
  }

  // Summary Row
  const hasSummary = visibleCols.some((c) => c.isSummary);
  if (hasSummary && data.length > 0) {
    const summaryRowIndex = currentRow;
    const summaryCells = visibleCols.map((col, colIdx) => {
      const cellRef = `${getExcelColumnName(colIdx)}${summaryRowIndex}`;
      if (colIdx === 0) {
        return `<c r="${cellRef}" s="7" t="inlineStr"><is><t>TOTAL / SUMMARY</t></is></c>`;
      }
      if (col.isSummary && (col.datatype === "number" || col.datatype === "currency")) {
        const sum = data.reduce((acc, row) => {
          const raw = typeof row[col.key] === "number" ? row[col.key] : parseFloat(String(row[col.key] || "").replace(/[^0-9.-]/g, ""));
          return acc + (!isNaN(raw) ? raw : 0);
        }, 0);
        const styleId = col.datatype === "currency" ? 4 : 7;
        return `<c r="${cellRef}" s="${styleId}"><v>${sum}</v></c>`;
      }
      return `<c r="${cellRef}" s="7"/>`;
    });
    rowsXml.push(`<row r="${summaryRowIndex}" ht="22" customHeight="1">${summaryCells.join("")}</row>`);
    currentRow++;
  }

  // Auto-width columns
  const colsXml = visibleCols
    .map((col, idx) => {
      let width = 15;
      if (typeof col.width === "number" && !isNaN(col.width) && col.width > 0) {
        width = Math.max(col.width > 30 ? Math.round(col.width / 8) : col.width, 10);
      } else if (typeof col.width === "string") {
        const parsed = parseFloat(col.width.replace(/[^0-9.]/g, ""));
        if (!isNaN(parsed) && parsed > 0) {
          width = Math.max(parsed > 30 ? Math.round(parsed / 8) : parsed, 10);
        }
      }
      return `<col min="${idx + 1}" max="${idx + 1}" width="${width}" customWidth="1"/>`;
    })
    .join("");

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0">
      <pane ySplit="${headerRowIndex}" topLeftCell="A${headerRowIndex + 1}" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <cols>${colsXml}</cols>
  <sheetData>
    ${rowsXml.join("\n    ")}
  </sheetData>
</worksheet>`;

  return createZipPackage([
    { path: "[Content_Types].xml", data: encoder.encode(contentTypesXml) },
    { path: "_rels/.rels", data: encoder.encode(rootRelsXml) },
    { path: "xl/_rels/workbook.xml.rels", data: encoder.encode(workbookRelsXml) },
    { path: "xl/workbook.xml", data: encoder.encode(workbookXml) },
    { path: "xl/styles.xml", data: encoder.encode(stylesXml) },
    { path: "xl/worksheets/sheet1.xml", data: encoder.encode(sheetXml) },
  ]);
}

/**
 * Serializes dataset into a clean, aligned plain text ASCII/Unicode table.
 */
export function serializeToAlignedTextTable(
  columns: ExportColumnDefinition[],
  data: any[],
  metadata?: ExportMetadata
): string {
  const visibleCols = columns.filter((c) => c.isVisible !== false);
  const lines: string[] = [];

  // 1. Metadata Header Banner
  lines.push("=".repeat(88));
  lines.push(` SMRITI RETAIL OS — EXPORT REPORT: ${metadata?.moduleTitle || "Master Data"}`);
  lines.push("=".repeat(88));
  if (metadata) {
    if (metadata.companyName) lines.push(` Company  : ${metadata.companyName}`);
    if (metadata.branchName) lines.push(` Branch   : ${metadata.branchName}`);
    if (metadata.exportedBy) lines.push(` User     : ${metadata.exportedBy}`);
    lines.push(` Exported : ${metadata.exportTimestamp || new Date().toISOString()}`);
    if (metadata.searchTerm) lines.push(` Search   : "${metadata.searchTerm}"`);
    if (metadata.appliedFilters && Object.keys(metadata.appliedFilters).length > 0) {
      lines.push(` Filters  : ${JSON.stringify(metadata.appliedFilters)}`);
    }
    lines.push(` Records  : ${data.length}`);
  }
  lines.push("-".repeat(88));

  // Determine Column Widths
  const colWidths = visibleCols.map((c) => {
    let max = c.label.length;
    for (const r of data) {
      const valStr = formatCellValue(r[c.key], c, r);
      if (valStr.length > max) max = valStr.length;
    }
    return Math.min(Math.max(max + 2, 8), 50);
  });

  // Helper border lines
  const sepLine = "+" + colWidths.map((w) => "-".repeat(w)).join("+") + "+";
  const doubleLine = "+" + colWidths.map((w) => "=".repeat(w)).join("+") + "+";

  // Table Header
  lines.push(sepLine);
  const headerCells = visibleCols.map((c, i) => {
    const w = colWidths[i];
    return padString(c.label, w, c.align || (c.datatype === "number" || c.datatype === "currency" ? "right" : "left"));
  });
  lines.push("|" + headerCells.join("|") + "|");
  lines.push(doubleLine);

  // Table Rows
  for (const row of data) {
    const rowCells = visibleCols.map((c, i) => {
      const w = colWidths[i];
      const valStr = formatCellValue(row[c.key], c, row);
      return padString(valStr, w, c.align || (c.datatype === "number" || c.datatype === "currency" ? "right" : "left"));
    });
    lines.push("|" + rowCells.join("|") + "|");
  }
  lines.push(sepLine);

  // Summary Row
  const hasSummary = visibleCols.some((c) => c.isSummary);
  if (hasSummary && data.length > 0) {
    const summaryCells = visibleCols.map((c, i) => {
      const w = colWidths[i];
      if (i === 0) return padString("TOTAL", w, "left");
      if (c.isSummary && (c.datatype === "number" || c.datatype === "currency")) {
        const sum = data.reduce((acc, row) => acc + (Number(row[c.key]) || 0), 0);
        return padString(formatCellValue(sum, c), w, "right");
      }
      return " ".repeat(w);
    });
    lines.push("|" + summaryCells.join("|") + "|");
    lines.push(sepLine);
  }

  lines.push("");
  lines.push(`Generated by SMRITI Retail OS Platform Engine on ${new Date().toLocaleString()}`);
  return lines.join("\n");
}

function padString(str: string, width: number, align: "left" | "center" | "right"): string {
  const s = String(str || "").substring(0, width);
  const diff = width - s.length;
  if (diff <= 0) return s;

  if (align === "right") {
    return " ".repeat(diff) + s;
  } else if (align === "center") {
    const left = Math.floor(diff / 2);
    const right = diff - left;
    return " ".repeat(left) + s + " ".repeat(right);
  } else {
    return s + " ".repeat(diff);
  }
}

/**
 * Serializes dataset into structured JSON format.
 */
export function serializeToJSON(
  columns: ExportColumnDefinition[],
  data: any[],
  metadata?: ExportMetadata
): string {
  const visibleCols = columns.filter((c) => c.isVisible !== false);
  const mappedData = data.map((row) => {
    const obj: Record<string, any> = {};
    for (const col of visibleCols) {
      obj[col.key] = row[col.key];
    }
    return obj;
  });

  return JSON.stringify(
    {
      metadata: metadata || { moduleTitle: "SMRITI Export" },
      totalRecords: mappedData.length,
      columns: visibleCols.map((c) => ({ key: c.key, label: c.label, datatype: c.datatype })),
      data: mappedData,
    },
    null,
    2
  );
}

/**
 * Serializes dataset into styled standalone HTML table document.
 */
export function serializeToHTML(
  columns: ExportColumnDefinition[],
  data: any[],
  metadata?: ExportMetadata
): string {
  const visibleCols = columns.filter((c) => c.isVisible !== false);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeXML(metadata?.moduleTitle || "SMRITI Export Report")}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 24px; color: #1e293b; background: #ffffff; }
    h1 { color: #003d9b; font-size: 20px; margin-bottom: 4px; }
    .meta { color: #64748b; font-size: 12px; margin-bottom: 16px; font-family: monospace; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #003d9b; color: white; padding: 8px 12px; text-align: left; font-weight: 600; border: 1px solid #002d72; }
    td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; border-left: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; }
    tr:nth-child(even) { background: #f8fafc; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
  </style>
</head>
<body>
  <h1>SMRITI Retail OS — ${escapeXML(metadata?.moduleTitle || "Export Report")}</h1>
  <div class="meta">
    Generated: ${new Date().toLocaleString()} | Total Records: ${data.length}
    ${metadata?.companyName ? ` | Company: ${escapeXML(metadata.companyName)}` : ""}
    ${metadata?.branchName ? ` | Branch: ${escapeXML(metadata.branchName)}` : ""}
  </div>
  <table>
    <thead>
      <tr>
        ${visibleCols.map((c) => `<th class="${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}">${escapeXML(c.label)}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${data.map((row) => `
        <tr>
          ${visibleCols.map((c) => {
            const val = formatCellValue(row[c.key], c, row);
            const alignClass = c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "";
            return `<td class="${alignClass}">${escapeXML(val)}</td>`;
          }).join("")}
        </tr>
      `).join("")}
    </tbody>
  </table>
</body>
</html>`;
}

/**
 * Triggers universal browser download for a generated Blob.
 */
export function downloadExportBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Core Global Export Service Class
 */
export class GlobalExportService {
  /**
   * Export an in-memory dataset directly.
   */
  public static async exportDataset<T = any>(
    options: ExportDatasetOptions<T>
  ): Promise<ExportResult> {
    const { moduleName, format, scope, columns, data, selectedRows, metadata, customFilename, sheetName } = options;

    // 1. Determine active rows based on scope
    let targetRows: any[] = [];
    if (scope === "selected") {
      targetRows = selectedRows && selectedRows.length > 0 ? selectedRows : data;
    } else {
      targetRows = data || [];
    }

    if (targetRows.length === 0) {
      return {
        success: false,
        filename: "",
        format,
        rowCount: 0,
        fileSizeBytes: 0,
        errorMessage: "No records available to export.",
      };
    }

    // If Google Sheets format requested, delegate to openInGoogleSheets
    if (format === "gsheet") {
      return this.openInGoogleSheets(options);
    }

    // 2. Sanitize rows
    const sanitizedRows = sanitizeExportRecord(targetRows);

    // 3. Generate file contents
    const filename = generateSafeExportFilename(moduleName, scope, format, customFilename);
    let blob: Blob;

    if (format === "csv") {
      const csvContent = serializeToCSV(columns, sanitizedRows, metadata);
      blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    } else if (format === "xlsx") {
      const xlsxBytes = serializeToOpenXMLXLSX(columns, sanitizedRows, metadata, sheetName || moduleName);
      const xlsxArray = new Uint8Array(xlsxBytes.length);
      xlsxArray.set(xlsxBytes);
      blob = new Blob([xlsxArray], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    } else if (format === "json") {
      const jsonContent = serializeToJSON(columns, sanitizedRows, metadata);
      blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
    } else if (format === "html") {
      const htmlContent = serializeToHTML(columns, sanitizedRows, metadata);
      blob = new Blob([htmlContent], { type: "text/html;charset=utf-8;" });
    } else {
      const textContent = serializeToAlignedTextTable(columns, sanitizedRows, metadata);
      blob = new Blob([textContent], { type: "text/plain;charset=utf-8;" });
    }

    // 4. Trigger download
    downloadExportBlob(blob, filename);

    return {
      success: true,
      filename,
      format,
      rowCount: sanitizedRows.length,
      fileSizeBytes: blob.size,
    };
  }

  /**
   * Opens the report directly in Google Sheets (sheets.new) by:
   * 1. Copying the formatted TSV table to clipboard for instant Ctrl+V pasting.
   * 2. Automatically triggering a CSV backup file download.
   * 3. Launching https://sheets.new in a new browser tab.
   */
  public static async openInGoogleSheets(
    options: ExportDatasetOptions
  ): Promise<ExportResult> {
    const { moduleName, scope, columns, data, selectedRows, metadata, customFilename, sheetName } = options;

    let targetRows: any[];
    if (scope === "selected") {
      targetRows = selectedRows && selectedRows.length > 0 ? selectedRows : data;
    } else {
      targetRows = data || [];
    }

    if (targetRows.length === 0) {
      return {
        success: false,
        filename: "",
        format: "gsheet",
        rowCount: 0,
        fileSizeBytes: 0,
        errorMessage: "No records available to open in Google Sheets.",
      };
    }

    const sanitizedRows = sanitizeExportRecord(targetRows);
    const tsvContent = serializeToTSV(columns, sanitizedRows, metadata);

    // 1. Copy to clipboard
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(tsvContent);
      }
    } catch (err) {
      console.warn("Clipboard copy warning:", err);
    }

    // 2. Generate and download CSV file as backup
    const csvContent = serializeToCSV(columns, sanitizedRows, metadata);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const filename = generateSafeExportFilename(moduleName, scope, "csv", customFilename);
    downloadExportBlob(blob, filename);

    // 3. Open Google Sheets web app in a new window/tab
    if (typeof window !== "undefined" && window.open) {
      window.open("https://sheets.new", "_blank", "noopener,noreferrer");
    }

    return {
      success: true,
      filename,
      format: "gsheet",
      rowCount: sanitizedRows.length,
      fileSizeBytes: blob.size,
    };
  }

  /**
   * Safely collects all pages from a FastAPI backend endpoint and exports the full dataset.
   */
  public static async exportPagedEndpoint(
    options: ExportPagedEndpointOptions
  ): Promise<ExportResult> {
    const {
      moduleName,
      format,
      scope,
      endpoint,
      columns,
      pageSize = 200,
      queryParams = {},
      metadata,
      selectedRows,
      onProgress,
      abortSignal,
      customFilename,
      sheetName,
    } = options;

    // If scope is selected rows and they exist, bypass backend fetch
    if (scope === "selected" && selectedRows && selectedRows.length > 0) {
      return this.exportDataset({
        moduleName,
        format,
        scope,
        columns,
        data: selectedRows,
        metadata,
        customFilename,
        sheetName,
      });
    }

    onProgress?.({
      isExporting: true,
      currentStep: "collecting",
      fetchedCount: 0,
      totalEstimatedCount: 0,
      currentPage: 1,
      totalPages: 1,
      percentage: 5,
    });

    const allRecords: any[] = [];
    let page = 1;
    let totalPages = 1;
    let totalEstimatedCount = 0;

    try {
      while (page <= totalPages) {
        if (abortSignal?.aborted) {
          throw new Error("Export cancelled by user.");
        }

        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(queryParams)) {
          if (v !== undefined && v !== null && v !== "") {
            params.append(k, String(v));
          }
        }
        params.set("page", String(page));
        params.set("page_size", String(pageSize));
        params.set("limit", String(pageSize));
        params.set("skip", String((page - 1) * pageSize));

        const cleanUrl = endpoint.includes("?") ? `${endpoint}&${params.toString()}` : `${endpoint}?${params.toString()}`;
        const res = await apiFetchV1(cleanUrl, { signal: abortSignal });

        let pageItems: any[] = [];
        if (Array.isArray(res)) {
          pageItems = res;
          totalPages = res.length === pageSize ? page + 1 : page;
        } else if (res && typeof res === "object") {
          if (Array.isArray(res.items)) {
            pageItems = res.items;
            totalPages = res.total_pages || Math.ceil((res.total || res.items.length) / pageSize) || page;
            totalEstimatedCount = res.total || (totalPages * pageSize);
          } else if (Array.isArray(res.data)) {
            pageItems = res.data;
            totalPages = res.totalPages || page;
            totalEstimatedCount = res.total || (totalPages * pageSize);
          } else if (Array.isArray(res.products)) {
            pageItems = res.products;
            totalPages = page + 1;
          } else {
            pageItems = [res];
          }
        }

        allRecords.push(...pageItems);

        const currentCount = allRecords.length;
        const calcTotal = Math.max(totalEstimatedCount, currentCount);
        const percent = Math.min(Math.round((page / Math.max(totalPages, 1)) * 90), 90);

        onProgress?.({
          isExporting: true,
          currentStep: "collecting",
          fetchedCount: currentCount,
          totalEstimatedCount: calcTotal,
          currentPage: page,
          totalPages: Math.max(totalPages, page),
          percentage: percent,
        });

        // Break if no items returned or less than page size
        if (pageItems.length === 0 || (pageItems.length < pageSize && totalPages === page)) {
          break;
        }
        page++;
      }

      onProgress?.({
        isExporting: true,
        currentStep: "formatting",
        fetchedCount: allRecords.length,
        totalEstimatedCount: allRecords.length,
        currentPage: page,
        totalPages,
        percentage: 95,
      });

      const result = await this.exportDataset({
        moduleName,
        format,
        scope,
        columns,
        data: allRecords,
        metadata: {
          moduleTitle: moduleName,
          ...metadata,
          totalRecordsCount: allRecords.length,
        },
        customFilename,
        sheetName,
      });

      onProgress?.({
        isExporting: false,
        currentStep: "complete",
        fetchedCount: allRecords.length,
        totalEstimatedCount: allRecords.length,
        currentPage: page,
        totalPages,
        percentage: 100,
      });

      return result;
    } catch (err: any) {
      const errMsg = err?.message || "Failed to complete data export.";
      onProgress?.({
        isExporting: false,
        currentStep: "error",
        fetchedCount: allRecords.length,
        totalEstimatedCount: 0,
        currentPage: page,
        totalPages,
        percentage: 0,
        errorMessage: errMsg,
      });

      return {
        success: false,
        filename: "",
        format,
        rowCount: 0,
        fileSizeBytes: 0,
        errorMessage: errMsg,
      };
    }
  }
}
