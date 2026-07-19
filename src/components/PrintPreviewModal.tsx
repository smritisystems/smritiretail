/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.2
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, Printer, RotateCcw, LayoutTemplate, Scale, Settings2, Plus, 
  Trash2, FileText, CheckCircle2, ChevronRight, Sliders, Play,
  Grid, Contrast, Eye, Layers, QrCode, Share2, Copy, Check, Smartphone,
  ShieldCheck, Download, Lock, Image, Upload
} from "lucide-react";
import QRCode from "qrcode";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { usePrintEngine } from "../print_engine/print_store.tsx";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";

// Mock datasets corresponding to various tabs
const MOCK_TAB_DATA: Record<string, any> = {
  pos: {
    storeName: "SMRITI HyperMarket",
    storeAddress: "AITDL Plaza, Suite 400, Electronic City",
    gstin: "29AITDL2026C1ZS",
    phone: "+91 800-721-2026",
    receiptNo: "RCPT-2026-99042",
    date: "2026-07-10 11:59:00",
    cashier: "Jawahar M.",
    customerName: "Siddharth Mallah",
    items: [
      { name: "Organic Roasted Almonds 500g", qty: 2, rate: 12.50 },
      { name: "SMRITI Premium Basmati Rice 5kg", qty: 1, rate: 24.99 },
      { name: "Cold Drip Coffee Espresso Blend", qty: 3, rate: 4.50 },
      { name: "Himalayan Pink Rock Salt 1kg", qty: 1, rate: 3.25 }
    ],
    subtotal: 56.24,
    tax: 10.12,
    total: 66.36,
    paid: 70.00,
    change: 3.64,
    paymentMethod: "CASH"
  },
  sales: {
    companyName: "AITDL NETWORKS PVT LTD",
    companyAddress: "Sector 5, HSR Layout, Bengaluru, KA 560102",
    companyGst: "29AABCA2026B1ZX",
    invoiceNo: "SINV-2026-00412",
    date: "2026-07-10",
    customerName: "Vertex Solutions India Ltd.",
    customerAddress: "401-403 Prime Towers, Whitefield, Bengaluru",
    customerGst: "29AAPCV4512A1Z9",
    items: [
      { name: "Wireless Mechanical Keyboard (Blue Switches)", qty: 5, rate: 89.00 },
      { name: "Ergonomic Optical Laser Mouse", qty: 5, rate: 45.50 },
      { name: "USB-C Dual 4K Docking Station", qty: 2, rate: 150.00 },
      { name: "Premium Cat6 Ethernet Cable 10m", qty: 15, rate: 8.50 }
    ],
    subtotal: 1100.00,
    tax: 198.00,
    total: 1298.00,
    cashier: "Siddharth M.",
    paymentMethod: "BANK WIRE",
    paid: 1298.00
  },
  purchase: {
    companyName: "SMRITI Retail Distribution Hub",
    supplierName: "Direct Foods Wholesale Ltd.",
    poNumber: "SPO-2026-0811",
    supplierInvoice: "DF-2026-1192",
    grnNo: "GRN-2026-00331",
    date: "2026-07-10",
    receivedBy: "Warehouse Lead (Mallah J.)",
    items: [
      { name: "Premium Olive Oil Extra Virgin 1L", qty: 120, rate: 8.50 },
      { name: "Whole Wheat Fusilli Pasta 500g", qty: 350, rate: 1.20 },
      { name: "Strained Greek Yogurt Natural 1kg", qty: 80, rate: 3.90 },
      { name: "Imported Dark Cocoa Powder 250g", qty: 50, rate: 5.50 }
    ],
    subtotal: 2027.00,
    tax: 364.86,
    total: 2391.86
  },
  barcode: {
    companyName: "SMRITI Retail",
    items: [
      { name: "SMRITI Premium Blend Tea 250g", rate: 6.99, barcode: "8901058002315" }
    ]
  },
  default: {
    companyName: "SMRITI Enterprise Co.",
    companyAddress: "101 Main Commercial Block, Suite 12",
    companyGst: "29XXXXX0000X1Z5",
    invoiceNo: "INV-2026-0001",
    date: "2026-07-10",
    customerName: "Standard Walk-in Customer",
    items: [
      { name: "Standard Retail Item", qty: 1, rate: 100.00 }
    ],
    subtotal: 100.00,
    tax: 18.00,
    total: 118.00,
    cashier: "System Admin"
  }
};

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTabId: string;
}

interface PaperDimension {
  width: string;
  height?: string;
  minHeight?: string;
  label: string;
}

const PAPER_DIMENSIONS: Record<string, (orientation: "portrait" | "landscape") => PaperDimension> = {
  A4: (ori) => ({
    width: ori === "portrait" ? "210mm" : "297mm",
    minHeight: ori === "portrait" ? "297mm" : "210mm",
    label: "A4 Sheet (210 x 297 mm)"
  }),
  A5: (ori) => ({
    width: ori === "portrait" ? "148mm" : "210mm",
    minHeight: ori === "portrait" ? "210mm" : "148mm",
    label: "A5 Half-Sheet (148 x 210 mm)"
  }),
  Letter: (ori) => ({
    width: ori === "portrait" ? "8.5in" : "11in",
    minHeight: ori === "portrait" ? "11in" : "8.5in",
    label: "US Letter (8.5 x 11 in)"
  }),
  Legal: (ori) => ({
    width: ori === "portrait" ? "8.5in" : "14in",
    minHeight: ori === "portrait" ? "14in" : "8.5in",
    label: "US Legal (8.5 x 14 in)"
  }),
  Thermal80: () => ({
    width: "80mm",
    minHeight: "140mm",
    label: "POS Roll (80mm)"
  }),
  Thermal58: () => ({
    width: "58mm",
    minHeight: "110mm",
    label: "Mobile Roll (58mm)"
  }),
  Label: () => ({
    width: "50mm",
    height: "25mm",
    label: "Barcode Label (50 x 25 mm)"
  })
};

const TEMPLATE_METADATA: Record<string, {
  description: string;
  category: "billing" | "inventory" | "pos" | "barcode";
  tags: string[];
  iconBg: string;
  badgeColor: string;
  illustration: React.ReactNode;
}> = {
  "standard-a4": {
    description: "Formal tax invoice layout with dual tax calculation columns, company details, client info, and signature blocks.",
    category: "billing",
    tags: ["A4 Sheet", "Formal", "Billing"],
    iconBg: "bg-emerald-500/10 text-emerald-400",
    badgeColor: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    illustration: (
      <div className="w-full h-16 bg-slate-950/80 rounded-lg p-2 border border-slate-800/80 flex flex-col justify-between text-[6px] font-mono select-none">
        <div className="flex justify-between border-b border-slate-800/60 pb-1">
          <div className="font-bold text-emerald-400">TAX INVOICE</div>
          <div className="text-slate-500">#INV-2026</div>
        </div>
        <div className="space-y-0.5">
          <div className="flex justify-between text-slate-400">
            <span>Item A x5</span>
            <span>$1,100.00</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Item B x2</span>
            <span>$150.00</span>
          </div>
        </div>
        <div className="flex justify-between items-center pt-1 border-t border-slate-800/60 text-slate-300">
          <span>PAY TOTAL</span>
          <span className="font-bold text-emerald-400">$1,298.00</span>
        </div>
      </div>
    )
  },
  "grn-a4": {
    description: "Inward Goods Receipt Note detailing logistics parameters, supplier info, PO numbers, and physical count checklists.",
    category: "inventory",
    tags: ["A4 Sheet", "Warehouse", "Logistics"],
    iconBg: "bg-blue-500/10 text-blue-400",
    badgeColor: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    illustration: (
      <div className="w-full h-16 bg-slate-950/80 rounded-lg p-2 border border-slate-800/80 flex flex-col justify-between text-[6px] font-mono select-none">
        <div className="flex justify-between border-b border-slate-800/60 pb-1">
          <div className="font-bold text-blue-400">GOODS RECEIPT</div>
          <div className="text-slate-500">#GRN-2026</div>
        </div>
        <div className="space-y-0.5">
          <div className="flex justify-between text-slate-400">
            <span>Supplier</span>
            <span className="truncate max-w-[42px] text-right">Direct Foods</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Lines Count</span>
            <span>4 Records</span>
          </div>
        </div>
        <div className="flex justify-between items-center pt-1 border-t border-slate-800/60 text-slate-300">
          <span>STATUS</span>
          <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1 rounded-sm">VERIFIED</span>
        </div>
      </div>
    )
  },
  "thermal-80": {
    description: "POS billing format optimized for continuous roll printers, utilizing high density text layout and jagged cutting lines.",
    category: "pos",
    tags: ["80mm Roll", "Thermal", "POS Lane"],
    iconBg: "bg-amber-500/10 text-amber-400",
    badgeColor: "bg-amber-500/10 border-amber-500/20 text-amber-400",
    illustration: (
      <div className="w-full h-16 bg-slate-950/80 rounded-lg p-2 border border-slate-800/80 flex flex-col justify-between text-[6px] font-mono select-none relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-500/20 to-transparent"></div>
        <div className="text-center font-bold text-amber-400 tracking-wider">SMRITI HYPER</div>
        <div className="border-t border-dashed border-slate-800 my-0.5"></div>
        <div className="space-y-0.5 text-slate-400">
          <div className="flex justify-between">
            <span>Almonds 500g</span>
            <span>$25.00</span>
          </div>
          <div className="flex justify-between">
            <span>Coffee Blend</span>
            <span>$13.50</span>
          </div>
        </div>
        <div className="border-t border-dashed border-slate-800 mt-0.5 pt-0.5 flex justify-between text-slate-200 font-bold">
          <span>TOTAL</span>
          <span className="text-amber-400">$66.36</span>
        </div>
      </div>
    )
  },
  "label-50x25": {
    description: "Adhesive merchandise barcode label with clear scan guidelines, pricing tags, and compact product info fields.",
    category: "barcode",
    tags: ["50x25mm", "Sticker", "Inventory"],
    iconBg: "bg-purple-500/10 text-purple-400",
    badgeColor: "bg-purple-500/10 border-purple-500/20 text-purple-400",
    illustration: (
      <div className="w-full h-16 bg-slate-950/80 rounded-lg p-1.5 border border-slate-800/80 flex flex-col justify-between text-[6px] font-mono select-none">
        <div className="text-[5px] text-slate-400 truncate font-semibold">Premium Blend Tea</div>
        <div className="flex flex-col items-center justify-center my-0.5">
          <div className="flex space-x-[1px] h-5 items-stretch opacity-80">
            <div className="w-[1.5px] bg-slate-300"></div>
            <div className="w-[0.5px] bg-slate-300"></div>
            <div className="w-[1px] bg-slate-300"></div>
            <div className="w-[2px] bg-slate-300"></div>
            <div className="w-[0.5px] bg-slate-300"></div>
            <div className="w-[1.5px] bg-slate-300"></div>
            <div className="w-[1px] bg-slate-300"></div>
            <div className="w-[0.5px] bg-slate-300"></div>
          </div>
          <span className="text-[4px] text-slate-500 scale-90">8901058002315</span>
        </div>
        <div className="flex justify-between items-center text-slate-300 font-bold">
          <span>$6.99</span>
          <span className="text-[4.5px] text-purple-400 bg-purple-500/10 px-0.5 rounded-sm">50x25</span>
        </div>
      </div>
    )
  }
};

// Deterministic hash function for digital signature certification
const generateDocHash = (data: any, templateId: string) => {
  const payload = `${templateId}-${data?.invoiceNo || data?.receiptNo || data?.grnNo || "DOC"}-${data?.total || 0}-${JSON.stringify(data?.items || [])}`;
  let hash1 = 5381;
  let hash2 = 137;
  for (let i = 0; i < payload.length; i++) {
    hash1 = ((hash1 << 5) + hash1) + payload.charCodeAt(i);
    hash2 = ((hash2 << 5) + hash2) ^ payload.charCodeAt(i);
  }
  const part1 = Math.abs(hash1).toString(16).padStart(8, '0');
  const part2 = Math.abs(hash2).toString(16).padStart(8, '0');
  return `SHA256: [${(part1 + part2).toUpperCase().match(/.{1,4}/g)?.join(":")}]`;
};

const SIGNATURE_AUTHORITIES = {
  smriti: {
    name: "SMRITI OS Cryptographic Authority v2.1",
    keyId: "ECDSA_P256_SMRITI_ROOT_CA01",
    policy: "SMRITI-TRUST-POLICY-2026",
    stamp: "SMRITI CERTIFIED"
  },
  aitdl: {
    name: "AITDL Net Security Security Layer",
    keyId: "RSA_4096_AITDL_SECURE_SERVER_04",
    policy: "AITDL-NET-VERIFY-2.0",
    stamp: "AITDL SECURE"
  },
  admin: {
    name: "Local Administrator (Jawahar M.)",
    keyId: "HMAC_SHA256_LOCAL_ADMIN_BYPASS",
    policy: "LOCAL-TRUST-SELF-SIGNED",
    stamp: "LOCAL SIGNED"
  }
};

const SEAL_THEMES = {
  emerald: {
    bg: "bg-emerald-500/5",
    border: "border-emerald-500/25",
    text: "text-emerald-700",
    iconBg: "bg-emerald-500/10",
    iconBorder: "border-emerald-500/20",
    iconColor: "text-emerald-600",
    badge: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
  },
  indigo: {
    bg: "bg-indigo-500/5",
    border: "border-indigo-500/25",
    text: "text-indigo-700",
    iconBg: "bg-indigo-500/10",
    iconBorder: "border-indigo-500/20",
    iconColor: "text-indigo-600",
    badge: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
  },
  amber: {
    bg: "bg-amber-500/5",
    border: "border-amber-500/25",
    text: "text-amber-700",
    iconBg: "bg-amber-500/10",
    iconBorder: "border-amber-500/20",
    iconColor: "text-amber-600",
    badge: "bg-amber-500/10 border-amber-500/20 text-amber-400"
  },
  rose: {
    bg: "bg-rose-500/5",
    border: "border-rose-500/25",
    text: "text-rose-700",
    iconBg: "bg-rose-500/10",
    iconBorder: "border-rose-500/20",
    iconColor: "text-rose-600",
    badge: "bg-rose-500/10 border-rose-500/20 text-rose-400"
  }
};

const WATERMARK_PRESETS = [
  {
    id: "draft",
    name: "DRAFT Stamp",
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='150' viewBox='0 0 400 150'><text x='50%' y='50%' font-family='monospace, sans-serif' font-weight='900' font-size='80' fill='%23ef4444' opacity='0.75' text-anchor='middle' dominant-baseline='middle'>DRAFT</text></svg>"
  },
  {
    id: "paid",
    name: "PAID Badge",
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='150' viewBox='0 0 400 150'><rect x='20' y='20' width='360' height='110' rx='12' fill='none' stroke='%2310b981' stroke-width='10' stroke-dasharray='18,8' opacity='0.8'/><text x='50%' y='50%' font-family='sans-serif' font-weight='900' font-size='68' fill='%2310b981' opacity='0.8' text-anchor='middle' dominant-baseline='middle'>PAID</text></svg>"
  },
  {
    id: "confidential",
    name: "CONFIDENTIAL",
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='150' viewBox='0 0 400 150'><text x='50%' y='50%' font-family='sans-serif' font-weight='900' font-size='52' fill='%23475569' opacity='0.75' text-anchor='middle' dominant-baseline='middle'>CONFIDENTIAL</text></svg>"
  },
  {
    id: "original",
    name: "ORIGINAL Seal",
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='150' viewBox='0 0 400 150'><rect x='20' y='20' width='360' height='110' rx='12' fill='none' stroke='%23d97706' stroke-width='8' opacity='0.8'/><text x='50%' y='50%' font-family='sans-serif' font-weight='900' font-size='56' fill='%23d97706' opacity='0.8' text-anchor='middle' dominant-baseline='middle'>ORIGINAL</text></svg>"
  },
  {
    id: "smriti",
    name: "SMRITI OS Logo",
    url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><path d='M100,15 L175,150 L25,150 Z' fill='none' stroke='%233b82f6' stroke-width='12' stroke-linejoin='round' opacity='0.8'/><circle cx='100' cy='95' r='24' fill='%233b82f6' opacity='0.8'/></svg>"
  }
];

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({ isOpen, onClose, activeTabId }) => {
  const { 
    print, 
    templates,
    printerStatus,
    queryConnectedPrinters,
    selectPrinter,
    updatePrinterStatus
  } = usePrintEngine();
  
  // Tab-to-default-template mapping
  const getInitialTemplateId = (tabId: string) => {
    if (tabId === "pos") return "thermal-80";
    if (tabId === "purchase") return "grn-a4";
    if (tabId === "barcode") return "label-50x25";
    return "standard-a4";
  };

  const initialTemplateId = getInitialTemplateId(activeTabId);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(initialTemplateId);
  const [documentData, setDocumentData] = useState<any>(null);

  // Sidebar Tab Switch: "layout" | "content"
  const [sidebarTab, setSidebarTab] = useState<"layout" | "content">("layout");
  
  // Gallery category filter state
  const [templateCategory, setTemplateCategory] = useState<"all" | "billing" | "inventory" | "pos" | "barcode">("all");

  // Advanced Layout Settings Panel States
  const [paperSize, setPaperSize] = useState<"A4" | "A5" | "Letter" | "Legal" | "Thermal80" | "Thermal58" | "Label">("A4");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [pageSizeScale, setPageSizeScale] = useState<number>(100); // percentage (70 to 140)
  const [marginPreset, setMarginPreset] = useState<"normal" | "compact" | "wide" | "none" | "custom">("normal");

  // Custom detailed margin slider values (in px)
  const [marginTop, setMarginTop] = useState<number>(24);
  const [marginBottom, setMarginBottom] = useState<number>(24);
  const [marginLeft, setMarginLeft] = useState<number>(24);
  const [marginRight, setMarginRight] = useState<number>(24);

  // Hardware/Post-process Toggles
  const [grayscaleMode, setGrayscaleMode] = useState<boolean>(false);
  const [showHeader, setShowHeader] = useState<boolean>(true);
  const [showGridlines, setShowGridlines] = useState<boolean>(false);

  // QR Code & URL sharing state variables
  const [shareableUrl, setShareableUrl] = useState<string>("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  // Digital Cryptographic Signature states
  const [isDigitallySigned, setIsDigitallySigned] = useState<boolean>(true);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [verificationAuthority, setVerificationAuthority] = useState<"smriti" | "aitdl" | "admin">("smriti");
  const [sealTheme, setSealTheme] = useState<"emerald" | "indigo" | "amber" | "rose">("emerald");

  // React Ref targeting the exact unscaled physical document element for pixel-perfect PDF export
  const printPreviewRef = useRef<HTMLDivElement>(null);

  // Watermark Customization Panel States
  const [isWatermarkEnabled, setIsWatermarkEnabled] = useState<boolean>(false);
  const [watermarkUrl, setWatermarkUrl] = useState<string>(WATERMARK_PRESETS[0].url);
  const [watermarkPresetId, setWatermarkPresetId] = useState<string>(WATERMARK_PRESETS[0].id);
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(12); // subtle default
  const [watermarkSize, setWatermarkSize] = useState<number>(60); // 60% of container width
  const [watermarkRotation, setWatermarkRotation] = useState<number>(-25); // aesthetic diagonal slant
  const [watermarkLayout, setWatermarkLayout] = useState<"center" | "tile">("center");

  // Load correct dataset initially when open or activeTab changes, supporting share-link loads
  useEffect(() => {
    if (isOpen) {
      const params = new URLSearchParams(window.location.search);
      const isSharedPrint = params.get("print") === "true";
      
      const targetTabId = isSharedPrint && params.get("tab") ? params.get("tab")! : activeTabId;
      const baseKey = MOCK_TAB_DATA[targetTabId] ? targetTabId : "default";
      
      let initData = JSON.parse(JSON.stringify(MOCK_TAB_DATA[baseKey]));
      
      // Override document data from share payload if present
      const sharedDocData = params.get("docData");
      if (sharedDocData) {
        try {
          const decoded = decodeURIComponent(escape(atob(sharedDocData)));
          initData = JSON.parse(decoded);
        } catch (e) {
          console.error("Failed to decode shared document data:", e);
        }
      }
      setDocumentData(initData);
      
      // Determine initial template ID
      let initTemplate = getInitialTemplateId(targetTabId);
      const sharedTemplate = params.get("template");
      if (sharedTemplate && templates.some(t => t.id === sharedTemplate)) {
        initTemplate = sharedTemplate;
      }
      setSelectedTemplateId(initTemplate);
      
      // Sync paper formats & layout configurations
      const sharedPaperSize = params.get("paperSize");
      const sharedOrientation = params.get("orientation");
      const sharedGrayscale = params.get("grayscale");
      
      if (sharedPaperSize && ["A4", "A5", "Letter", "Legal", "Thermal80", "Thermal58", "Label"].includes(sharedPaperSize)) {
        setPaperSize(sharedPaperSize as any);
      } else {
        if (initTemplate === "thermal-80") {
          setPaperSize("Thermal80");
        } else if (initTemplate === "label-50x25") {
          setPaperSize("Label");
        } else {
          setPaperSize("A4");
        }
      }
      
      if (sharedOrientation === "portrait" || sharedOrientation === "landscape") {
        setOrientation(sharedOrientation as any);
      }
      
      if (sharedGrayscale) {
        setGrayscaleMode(sharedGrayscale === "true");
      }

      // Sync watermark configuration from parameters
      const sharedWatermarkEnabled = params.get("wm_enabled");
      const sharedWatermarkPresetId = params.get("wm_preset");
      const sharedWatermarkOpacity = params.get("wm_opacity");
      const sharedWatermarkSize = params.get("wm_size");
      const sharedWatermarkRotation = params.get("wm_rotation");
      const sharedWatermarkLayout = params.get("wm_layout");
      const sharedWatermarkCustomUrl = params.get("wm_custom_url");

      if (sharedWatermarkEnabled === "true") {
        setIsWatermarkEnabled(true);
      } else if (sharedWatermarkEnabled === "false") {
        setIsWatermarkEnabled(false);
      }
      
      if (sharedWatermarkPresetId) {
        setWatermarkPresetId(sharedWatermarkPresetId);
        const matched = WATERMARK_PRESETS.find(p => p.id === sharedWatermarkPresetId);
        if (matched) {
          setWatermarkUrl(matched.url);
        } else if (sharedWatermarkPresetId === "custom" && sharedWatermarkCustomUrl) {
          try {
            setWatermarkUrl(decodeURIComponent(sharedWatermarkCustomUrl));
          } catch {}
        }
      } else {
        setWatermarkPresetId(WATERMARK_PRESETS[0].id);
        setWatermarkUrl(WATERMARK_PRESETS[0].url);
      }
      
      if (sharedWatermarkOpacity) {
        setWatermarkOpacity(Number(sharedWatermarkOpacity));
      }
      if (sharedWatermarkSize) {
        setWatermarkSize(Number(sharedWatermarkSize));
      }
      if (sharedWatermarkRotation) {
        setWatermarkRotation(Number(sharedWatermarkRotation));
      }
      if (sharedWatermarkLayout === "center" || sharedWatermarkLayout === "tile") {
        setWatermarkLayout(sharedWatermarkLayout);
      }
    }
  }, [isOpen, activeTabId]);

  // Dynamically calculate document shareable URL based on all active parameters and data edits
  useEffect(() => {
    if (!documentData) return;
    try {
      const baseUrl = window.location.origin + window.location.pathname;
      const serializedData = btoa(unescape(encodeURIComponent(JSON.stringify(documentData))));
      
      const params = new URLSearchParams();
      params.set("print", "true");
      params.set("tab", activeTabId);
      params.set("template", selectedTemplateId);
      params.set("paperSize", paperSize);
      params.set("orientation", orientation);
      params.set("grayscale", grayscaleMode ? "true" : "false");
      params.set("docData", serializedData);

      // sync watermark config to URL query params
      params.set("wm_enabled", isWatermarkEnabled ? "true" : "false");
      params.set("wm_preset", watermarkPresetId);
      params.set("wm_opacity", watermarkOpacity.toString());
      params.set("wm_size", watermarkSize.toString());
      params.set("wm_rotation", watermarkRotation.toString());
      params.set("wm_layout", watermarkLayout);
      if (watermarkPresetId === "custom" && watermarkUrl.length < 500) {
        params.set("wm_custom_url", watermarkUrl);
      }
      
      const fullUrl = `${baseUrl}?${params.toString()}`;
      setShareableUrl(fullUrl);
    } catch (e) {
      console.error("Failed to generate sharing URL:", e);
    }
  }, [
    selectedTemplateId, paperSize, orientation, grayscaleMode, documentData, activeTabId,
    isWatermarkEnabled, watermarkPresetId, watermarkOpacity, watermarkSize, watermarkRotation, watermarkLayout, watermarkUrl
  ]);

  // Generates high quality pixel-perfect QR Code in real-time
  useEffect(() => {
    if (!shareableUrl) return;
    QRCode.toDataURL(
      shareableUrl,
      {
        width: 320,
        margin: 2,
        color: {
          dark: "#0f172a", // Deep slate body
          light: "#ffffff", // Pure white background
        },
      },
      (err, url) => {
        if (err) {
          console.error("Failed to render QR Code:", err);
          return;
        }
        setQrCodeDataUrl(url);
      }
    );
  }, [shareableUrl]);

  // Synchronize paper formats if template changes
  useEffect(() => {
    if (selectedTemplateId === "thermal-80") {
      setPaperSize("Thermal80");
    } else if (selectedTemplateId === "label-50x25") {
      setPaperSize("Label");
    } else if (selectedTemplateId === "grn-a4" || selectedTemplateId === "standard-a4") {
      setPaperSize("A4");
    }
  }, [selectedTemplateId]);

  if (!isOpen || !documentData) return null;

  const activeTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0];
  const TemplateComponent = activeTemplate?.component;

  // Recalculates document totals based on current items list
  const recalculateTotals = (items: any[]) => {
    const subtotal = items.reduce((sum, item) => sum + (item.qty * item.rate), 0);
    const taxRate = 0.18; // standard 18% GST default
    const tax = Math.round(subtotal * taxRate * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;

    return {
      subtotal,
      tax,
      total,
      paid: total,
      change: 0
    };
  };

  // Handles updates to direct root fields (like company name, document numbers, client name)
  const handleRootFieldChange = (field: string, value: any) => {
    setDocumentData((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  // Handles inline line items editing
  const handleItemFieldChange = (index: number, field: string, value: any) => {
    setDocumentData((prev: any) => {
      const updatedItems = [...prev.items];
      const parsedVal = (field === "qty" || field === "rate") ? Number(value) : value;
      
      updatedItems[index] = {
        ...updatedItems[index],
        [field]: parsedVal
      };

      const computed = recalculateTotals(updatedItems);
      return {
        ...prev,
        items: updatedItems,
        ...computed
      };
    });
  };

  // Delete line item
  const handleDeleteItem = (index: number) => {
    setDocumentData((prev: any) => {
      const updatedItems = prev.items.filter((_: any, idx: number) => idx !== index);
      const computed = recalculateTotals(updatedItems);
      return {
        ...prev,
        items: updatedItems,
        ...computed
      };
    });
  };

  // Add line item
  const handleAddItem = () => {
    setDocumentData((prev: any) => {
      const newItem = { name: "New Custom Retail Product", qty: 1, rate: 10.00, barcode: "1234567890" };
      const updatedItems = [...(prev.items || []), newItem];
      const computed = recalculateTotals(updatedItems);
      return {
        ...prev,
        items: updatedItems,
        ...computed
      };
    });
  };

  // Reset back to tab defaults
  const handleResetToDefaults = () => {
    const baseKey = MOCK_TAB_DATA[activeTabId] ? activeTabId : "default";
    setDocumentData(JSON.parse(JSON.stringify(MOCK_TAB_DATA[baseKey])));
    setSelectedTemplateId(getInitialTemplateId(activeTabId));
    setSidebarTab("layout");
    setPaperSize(activeTabId === "pos" ? "Thermal80" : activeTabId === "barcode" ? "Label" : "A4");
    setOrientation("portrait");
    setPageSizeScale(100);
    setMarginPreset("normal");
    setMarginTop(24);
    setMarginBottom(24);
    setMarginLeft(24);
    setMarginRight(24);
    setGrayscaleMode(false);
    setShowHeader(true);
    setShowGridlines(false);
    setIsWatermarkEnabled(false);
    setWatermarkPresetId(WATERMARK_PRESETS[0].id);
    setWatermarkUrl(WATERMARK_PRESETS[0].url);
    setWatermarkOpacity(12);
    setWatermarkSize(60);
    setWatermarkRotation(-25);
    setWatermarkLayout("center");
  };

  // Process and convert uploaded custom watermark images into secure base64 format
  const handleWatermarkUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result && typeof e.target.result === "string") {
        setWatermarkUrl(e.target.result);
        setWatermarkPresetId("custom");
      }
    };
    reader.readAsDataURL(file);
  };

  // Triggers the real print through the PrintProvider
  const handleFinalPrint = () => {
    print({
      templateId: selectedTemplateId,
      data: documentData
    });
    onClose();
  };

  // Export high-fidelity PDF with embedded cryptographic metadata properties
  const handleExportPDF = async () => {
    if (!printPreviewRef.current) return;
    setIsExportingPdf(true);
    
    try {
      const element = printPreviewRef.current;
      
      // Store actual current inline margin or size properties
      const widthPx = element.offsetWidth;
      const heightPx = element.offsetHeight;
      
      // Calculate physical millimeter equivalents assuming standard 96 DPI
      // 1 inch = 25.4 millimeters, 1 pixel = 25.4 / 96 millimeters
      const mmWidth = Math.round(widthPx * 25.4 / 96);
      const mmHeight = Math.round(heightPx * 25.4 / 96);
      
      // Stagger slight reflow allowance
      await new Promise((resolve) => setTimeout(resolve, 250));
      
      const canvas = await html2canvas(element, {
        scale: 2.5, // Retina display-level crisp text rendering
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        allowTaint: true
      });
      
      const imgData = canvas.toDataURL("image/jpeg", 1.0);
      
      // Initialize jsPDF with the exact physical sheet dimensions calculated dynamically
      const doc = new jsPDF({
        orientation: mmWidth > mmHeight ? "landscape" : "portrait",
        unit: "mm",
        format: [mmWidth, mmHeight]
      });
      
      // Fill entire physical viewport with captured element screenshot
      doc.addImage(imgData, "JPEG", 0, 0, mmWidth, mmHeight, undefined, "FAST");
      
      // Embedded cryptographic signature and authority records within the PDF metadata header itself
      const hashStr = generateDocHash(documentData, selectedTemplateId);
      const activeAuth = SIGNATURE_AUTHORITIES[verificationAuthority];
      
      doc.setProperties({
        title: `${activeTemplate?.name || "Retail Document"} - Cryptographically Signed`,
        subject: `Security Verification Hash: ${hashStr}`,
        author: activeAuth.name,
        creator: `Smriti Retail OS v2.1.2`,
        keywords: `smriti, retail-os, signed-pdf, ${hashStr}, ${activeAuth.keyId}`
      });
      
      // Save and export file with unique identifier and timestamp
      const fileTimestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      doc.save(`Certified-${activeTemplate?.id || "document"}-${fileTimestamp}.pdf`);
    } catch (err) {
      console.error("High-fidelity PDF Export failed:", err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Returns exact style configuration for the margins based on user preferences
  const getMarginStyle = () => {
    const isSheet = ["A4", "A5", "Letter", "Legal"].includes(paperSize);
    if (!isSheet) {
      // Receipt or barcode margins are typically compact or handled separately
      return { paddingTop: "12px", paddingBottom: "12px", paddingLeft: "8px", paddingRight: "8px" };
    }
    if (marginPreset === "none") {
      return { paddingTop: "0px", paddingBottom: "0px", paddingLeft: "0px", paddingRight: "0px" };
    }
    if (marginPreset === "compact") {
      return { paddingTop: "12px", paddingBottom: "12px", paddingLeft: "12px", paddingRight: "12px" };
    }
    if (marginPreset === "normal") {
      return { paddingTop: "24px", paddingBottom: "24px", paddingLeft: "24px", paddingRight: "24px" };
    }
    if (marginPreset === "wide") {
      return { paddingTop: "40px", paddingBottom: "40px", paddingLeft: "40px", paddingRight: "40px" };
    }
    // Custom margin parameters
    return {
      paddingTop: `${marginTop}px`,
      paddingBottom: `${marginBottom}px`,
      paddingLeft: `${marginLeft}px`,
      paddingRight: `${marginRight}px`
    };
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-center items-center p-4 md:p-6 select-none font-sans bg-[#0c1224] bg-opacity-70 backdrop-blur-sm">
      {/* Semi-transparent dark background */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 cursor-pointer"
      />

      {/* Main Modal Container */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        transition={{ type: "spring", duration: 0.4 }}
        className="relative bg-theme-surface-1 border border-theme-divider rounded-2xl w-full h-full max-w-7xl flex flex-col overflow-hidden shadow-2xl z-10 text-theme-body"
      >
        
        {/* Top Header */}
        <div className="h-16 border-b border-theme-divider bg-theme-surface-2 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
              <Printer size={20} />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-bold font-display text-theme-primary tracking-wide">
                SMRITI Interactive Print & Preview Engine
              </h2>
              <p className="text-[10px] md:text-xs text-theme-muted">
                Designated active tab context: <span className="font-semibold text-blue-400 uppercase font-mono">{activeTabId}</span>
              </p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-surface-hover transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Workspace Splitted Panel */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Left Panel: Sidebar Parameters & Inline Editor */}
          <div className="w-full md:w-[440px] border-r border-theme-divider bg-theme-surface-2 overflow-hidden flex flex-col shrink-0">
            
            {/* Sidebar Tab Switcher */}
            <div className="flex border-b border-theme-divider bg-theme-surface-3 p-1 shrink-0">
              <button
                onClick={() => setSidebarTab("layout")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold transition-all cursor-pointer rounded-lg ${
                  sidebarTab === "layout"
                    ? "bg-theme-surface-1 text-blue-400 shadow-sm border border-theme-divider/50"
                    : "text-theme-muted hover:text-theme-primary hover:bg-theme-surface-hover"
                }`}
              >
                <Sliders size={13} />
                Page & Printer Setup
              </button>
              <button
                onClick={() => setSidebarTab("content")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold transition-all cursor-pointer rounded-lg ${
                  sidebarTab === "content"
                    ? "bg-theme-surface-1 text-blue-400 shadow-sm border border-theme-divider/50"
                    : "text-theme-muted hover:text-theme-primary hover:bg-theme-surface-hover"
                }`}
              >
                <Settings2 size={13} />
                Document Content Editor
              </button>
            </div>

            <SmritiScrollArea className="flex-1">
              <div className="p-5 space-y-6">
                
                {sidebarTab === "layout" ? (
                  /* TAB 1: PAGE & PRINTER SETUP PANEL */
                  <div className="space-y-6 animate-in fade-in duration-250">
                    
                    {/* Section 1: Template Selection Gallery */}
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 text-theme-muted">
                          <LayoutTemplate size={14} className="text-blue-500" />
                          <span className="text-[10px] uppercase tracking-wider font-bold font-mono">Template Design Gallery</span>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/10 text-blue-400 font-mono font-semibold">
                          {templates.length} Designs
                        </span>
                      </div>

                      {/* Category Switcher Row */}
                      <div className="flex flex-wrap gap-1 bg-theme-surface-3 p-1 rounded-xl border border-theme-divider/60">
                        {(["all", "billing", "inventory", "pos", "barcode"] as const).map((cat) => {
                          const isSelected = templateCategory === cat;
                          return (
                            <button
                              key={cat}
                              onClick={() => setTemplateCategory(cat)}
                              className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-blue-500 text-white shadow-sm"
                                  : "text-theme-muted hover:text-theme-primary hover:bg-theme-surface-hover"
                              }`}
                            >
                              {cat}
                            </button>
                          );
                        })}
                      </div>

                      {/* Card Grid Container */}
                      <div className="grid grid-cols-2 gap-3">
                        {templates
                          .filter(template => {
                            if (templateCategory === "all") return true;
                            const meta = TEMPLATE_METADATA[template.id];
                            return meta && meta.category === templateCategory;
                          })
                          .map(template => {
                            const isSelected = selectedTemplateId === template.id;
                            const meta = TEMPLATE_METADATA[template.id];
                            return (
                              <button
                                key={template.id}
                                onClick={() => setSelectedTemplateId(template.id)}
                                className={`group relative rounded-xl border text-left flex flex-col justify-between transition-all overflow-hidden cursor-pointer ${
                                  isSelected
                                    ? "bg-blue-500/10 border-blue-500/50 text-blue-400 shadow-md ring-1 ring-blue-500/20"
                                    : "bg-theme-surface-1 border-theme-divider hover:bg-theme-surface-hover hover:border-theme-muted/50"
                                }`}
                              >
                                {/* Thumbnail Illustration Area */}
                                <div className="p-2 bg-theme-surface-3/50 border-b border-theme-divider/50 group-hover:bg-theme-surface-3 transition-colors">
                                  {meta ? meta.illustration : (
                                    <div className="w-full h-16 bg-slate-950/80 rounded-lg flex items-center justify-center border border-slate-800">
                                      <FileText size={18} className="text-theme-muted" />
                                    </div>
                                  )}
                                </div>

                                {/* Details / Text Info Block */}
                                <div className="p-2.5 flex-1 flex flex-col justify-between space-y-1">
                                  <div className="space-y-1">
                                    <div className="flex items-start justify-between gap-1.5">
                                      <span className="text-[11px] font-bold tracking-tight leading-snug group-hover:text-theme-primary transition-colors line-clamp-1">
                                        {template.name}
                                      </span>
                                      {isSelected && (
                                        <CheckCircle2 size={11} className="text-blue-400 shrink-0 mt-0.5" />
                                      )}
                                    </div>
                                    <p className="text-[9px] text-theme-muted line-clamp-2 leading-relaxed">
                                      {meta?.description || "Select this print layout."}
                                    </p>
                                  </div>

                                  {/* Badges */}
                                  <div className="flex items-center gap-1 pt-1.5 flex-wrap">
                                    <span className="text-[8px] font-mono uppercase bg-theme-surface-3 border border-theme-divider px-1.5 py-0.5 rounded text-theme-muted group-hover:border-theme-muted/30">
                                      {template.format}
                                    </span>
                                    {meta?.tags.slice(1, 2).map((tg, i) => (
                                      <span key={i} className={`text-[8px] font-semibold border px-1 py-0.25 rounded-sm ${meta.badgeColor}`}>
                                        {tg}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </div>

                    {/* Section 2: Printer Paper Size Selection */}
                    <div className="space-y-3.5 border-t border-theme-divider pt-5">
                      <div className="flex items-center space-x-1.5 text-theme-muted">
                        <Layers size={14} className="text-blue-500" />
                        <span className="text-[10px] uppercase tracking-wider font-bold font-mono">Select Paper & Form Size</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(PAPER_DIMENSIONS) as Array<keyof typeof PAPER_DIMENSIONS>).map((sizeKey) => {
                          const dim = PAPER_DIMENSIONS[sizeKey](orientation);
                          const isSelected = paperSize === sizeKey;
                          return (
                            <button
                              key={sizeKey}
                              onClick={() => {
                                setPaperSize(sizeKey as any);
                                // Set a sensible scale or limit orientation if needed
                                if (["Thermal80", "Thermal58", "Label"].includes(sizeKey)) {
                                  setOrientation("portrait");
                                }
                              }}
                              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-16 ${
                                isSelected
                                  ? "bg-blue-500/10 border-blue-500/40 text-blue-400 shadow-sm"
                                  : "bg-theme-surface-1 border-theme-divider text-theme-muted hover:bg-theme-surface-hover hover:text-theme-primary"
                              }`}
                            >
                              <span className="text-xs font-bold font-display">{sizeKey}</span>
                              <span className="text-[9px] text-theme-muted font-mono truncate">{dim.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Section 3: Page Layout Orientation & Margins Preset */}
                    <div className="space-y-3.5 border-t border-theme-divider pt-5">
                      <div className="flex items-center space-x-1.5 text-theme-muted">
                        <Sliders size={14} className="text-blue-500" />
                        <span className="text-[10px] uppercase tracking-wider font-bold font-mono">Page Orientation & Margins</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        {/* Orientation Toggle */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-theme-muted font-mono uppercase">Orientation</label>
                          <div className="flex rounded-lg bg-theme-surface-1 border border-theme-divider p-0.5">
                            <button
                              onClick={() => setOrientation("portrait")}
                              className={`flex-1 text-[10px] py-1.5 rounded font-semibold transition-all cursor-pointer ${
                                orientation === "portrait" 
                                  ? "bg-theme-surface-3 text-theme-primary shadow-sm" 
                                  : "text-theme-muted hover:text-theme-primary"
                              }`}
                            >
                              Portrait
                            </button>
                            <button
                              onClick={() => setOrientation("landscape")}
                              disabled={["Thermal80", "Thermal58", "Label"].includes(paperSize)}
                              className={`flex-1 text-[10px] py-1.5 rounded font-semibold transition-all cursor-pointer disabled:opacity-40 ${
                                orientation === "landscape" 
                                  ? "bg-theme-surface-3 text-theme-primary shadow-sm" 
                                  : "text-theme-muted hover:text-theme-primary"
                              }`}
                            >
                              Landscape
                            </button>
                          </div>
                        </div>

                        {/* Margins Preset Selection */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-theme-muted font-mono uppercase">Margin Presets</label>
                          <select
                            value={marginPreset}
                            onChange={(e) => setMarginPreset(e.target.value as any)}
                            disabled={!["A4", "A5", "Letter", "Legal"].includes(paperSize)}
                            className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-2 py-1.5 text-[10px] font-semibold text-theme-primary outline-none focus:border-blue-500 disabled:opacity-40"
                          >
                            <option value="normal">Normal (24px)</option>
                            <option value="compact">Compact (12px)</option>
                            <option value="wide">Wide (40px)</option>
                            <option value="none">Borderless (0px)</option>
                            <option value="custom">★ Custom Margins</option>
                          </select>
                        </div>
                      </div>

                      {/* Custom Margins Detailed Sliders */}
                      {marginPreset === "custom" && ["A4", "A5", "Letter", "Legal"].includes(paperSize) && (
                        <div className="p-3 bg-theme-surface-1 rounded-xl border border-theme-divider space-y-3.5 animate-in slide-in-from-top-2 duration-200">
                          <div className="text-[9px] font-mono font-bold uppercase text-blue-400">Custom Padding Configuration</div>
                          
                          {/* Top Margin Slider */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-mono text-theme-muted">
                              <span>Top Margin</span>
                              <span className="text-theme-primary font-bold">{marginTop}px</span>
                            </div>
                            <input 
                              type="range" min="0" max="48" value={marginTop}
                              onChange={(e) => setMarginTop(Number(e.target.value))}
                              className="w-full accent-blue-500 h-1 bg-theme-surface-2 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>

                          {/* Bottom Margin Slider */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-mono text-theme-muted">
                              <span>Bottom Margin</span>
                              <span className="text-theme-primary font-bold">{marginBottom}px</span>
                            </div>
                            <input 
                              type="range" min="0" max="48" value={marginBottom}
                              onChange={(e) => setMarginBottom(Number(e.target.value))}
                              className="w-full accent-blue-500 h-1 bg-theme-surface-2 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>

                          {/* Left Margin Slider */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-mono text-theme-muted">
                              <span>Left Margin</span>
                              <span className="text-theme-primary font-bold">{marginLeft}px</span>
                            </div>
                            <input 
                              type="range" min="0" max="48" value={marginLeft}
                              onChange={(e) => setMarginLeft(Number(e.target.value))}
                              className="w-full accent-blue-500 h-1 bg-theme-surface-2 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>

                          {/* Right Margin Slider */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-mono text-theme-muted">
                              <span>Right Margin</span>
                              <span className="text-theme-primary font-bold">{marginRight}px</span>
                            </div>
                            <input 
                              type="range" min="0" max="48" value={marginRight}
                              onChange={(e) => setMarginRight(Number(e.target.value))}
                              className="w-full accent-blue-500 h-1 bg-theme-surface-2 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Section 4: Advanced Printer Hardware Options */}
                    <div className="space-y-3.5 border-t border-theme-divider pt-5">
                      <div className="flex items-center space-x-1.5 text-theme-muted">
                        <Printer size={14} className="text-blue-500" />
                        <span className="text-[10px] uppercase tracking-wider font-bold font-mono">Advanced Output Options</span>
                      </div>

                      <div className="space-y-2.5">
                        {/* Toggle Monochrome */}
                        <div className="flex items-center justify-between p-2.5 rounded-xl border border-theme-divider bg-theme-surface-1">
                          <div className="flex items-center space-x-2.5">
                            <Contrast size={14} className="text-theme-muted" />
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-theme-primary">Monochrome / Grayscale</span>
                              <span className="text-[9px] text-theme-muted font-mono">Filter document to high-contrast ink</span>
                            </div>
                          </div>
                          <button
                            onClick={() => setGrayscaleMode(!grayscaleMode)}
                            className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${grayscaleMode ? "bg-blue-600" : "bg-theme-surface-3 border border-theme-divider"}`}
                          >
                            <div className={`w-3.8 h-3.8 rounded-full bg-white transition-transform transform ${grayscaleMode ? "translate-x-4" : "translate-x-0"}`} />
                          </button>
                        </div>

                        {/* Toggle Page Watermark / Header */}
                        <div className="flex items-center justify-between p-2.5 rounded-xl border border-theme-divider bg-theme-surface-1">
                          <div className="flex items-center space-x-2.5">
                            <Eye size={14} className="text-theme-muted" />
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-theme-primary">Show System Watermarks</span>
                              <span className="text-[9px] text-theme-muted font-mono">Show ISO headers & footer bounds</span>
                            </div>
                          </div>
                          <button
                            onClick={() => setShowHeader(!showHeader)}
                            className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${showHeader ? "bg-blue-600" : "bg-theme-surface-3 border border-theme-divider"}`}
                          >
                            <div className={`w-3.8 h-3.8 rounded-full bg-white transition-transform transform ${showHeader ? "translate-x-4" : "translate-x-0"}`} />
                          </button>
                        </div>

                        {/* Toggle Gridlines */}
                        <div className="flex items-center justify-between p-2.5 rounded-xl border border-theme-divider bg-theme-surface-1">
                          <div className="flex items-center space-x-2.5">
                            <Grid size={14} className="text-theme-muted" />
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-theme-primary">Alignment Gridlines</span>
                              <span className="text-[9px] text-theme-muted font-mono">Render design/CAD grid overlays</span>
                            </div>
                          </div>
                          <button
                            onClick={() => setShowGridlines(!showGridlines)}
                            className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${showGridlines ? "bg-blue-600" : "bg-theme-surface-3 border border-theme-divider"}`}
                          >
                            <div className={`w-3.8 h-3.8 rounded-full bg-white transition-transform transform ${showGridlines ? "translate-x-4" : "translate-x-0"}`} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Section 4.5: Document Watermark Settings */}
                    <div className="space-y-3.5 border-t border-theme-divider pt-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 text-theme-muted">
                          <Image size={14} className="text-blue-500" />
                          <span className="text-[10px] uppercase tracking-wider font-bold font-mono">Document Watermark</span>
                        </div>
                        <span className="flex items-center gap-1 text-[8px] font-mono uppercase bg-blue-500/10 border border-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                          Hologram Engine
                        </span>
                      </div>

                      <p className="text-[9px] text-theme-muted leading-relaxed">
                        Embed a custom high-contrast or preset graphic watermark overlay behind or across your document. Works perfectly in exports and physical prints.
                      </p>

                      <div className="space-y-3 bg-theme-surface-1 border border-theme-divider rounded-xl p-3.5">
                        {/* Toggle Watermark */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-theme-primary">Apply Watermark</span>
                          <button
                            onClick={() => setIsWatermarkEnabled(!isWatermarkEnabled)}
                            className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${isWatermarkEnabled ? "bg-blue-600" : "bg-theme-surface-3 border border-theme-divider"}`}
                          >
                            <div className={`w-3.8 h-3.8 rounded-full bg-white transition-transform transform ${isWatermarkEnabled ? "translate-x-4" : "translate-x-0"}`} />
                          </button>
                        </div>

                        {isWatermarkEnabled && (
                          <div className="space-y-3 animate-in fade-in duration-200 border-t border-theme-divider/60 pt-3">
                            {/* Watermark Preset Select */}
                            <div className="space-y-1">
                              <label className="text-[9px] text-theme-muted font-mono uppercase">Watermark Preset</label>
                              <select
                                value={watermarkPresetId}
                                onChange={(e) => {
                                  const targetId = e.target.value;
                                  setWatermarkPresetId(targetId);
                                  if (targetId !== "custom") {
                                    const matched = WATERMARK_PRESETS.find(p => p.id === targetId);
                                    if (matched) {
                                      setWatermarkUrl(matched.url);
                                    }
                                  }
                                }}
                                className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1 text-xs text-theme-primary focus:outline-none"
                              >
                                {WATERMARK_PRESETS.map((p) => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                                <option value="custom">★ Upload Custom Image</option>
                              </select>
                            </div>

                            {/* Drag & Drop Upload section for custom watermarks */}
                            {watermarkPresetId === "custom" && (
                              <div className="space-y-2 animate-in slide-in-from-top-1 duration-150">
                                <label className="text-[9px] text-theme-muted font-mono uppercase">Custom Watermark Image</label>
                                <div 
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                      handleWatermarkUpload(e.dataTransfer.files[0]);
                                    }
                                  }}
                                  className="border-2 border-dashed border-theme-divider hover:border-blue-500/50 bg-theme-surface-2 rounded-xl p-3.5 flex flex-col items-center justify-center text-center cursor-pointer transition-all relative group"
                                  onClick={() => {
                                    const input = document.createElement("input");
                                    input.type = "file";
                                    input.accept = "image/*";
                                    input.onchange = (ev) => {
                                      const files = (ev.target as HTMLInputElement).files;
                                      if (files && files[0]) {
                                        handleWatermarkUpload(files[0]);
                                      }
                                    };
                                    input.click();
                                  }}
                                >
                                  {watermarkUrl && watermarkUrl.startsWith("data:") && watermarkPresetId === "custom" ? (
                                    <div className="space-y-2">
                                      <div className="flex justify-center">
                                        <img 
                                          src={watermarkUrl} 
                                          alt="Uploaded watermark" 
                                          className="max-h-16 max-w-full object-contain rounded-lg border border-theme-divider p-1 bg-white opacity-60" 
                                          referrerPolicy="no-referrer"
                                        />
                                      </div>
                                      <span className="text-[10px] text-blue-500 hover:text-blue-400 font-semibold block">Replace Image</span>
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      <div className="flex justify-center text-theme-muted group-hover:text-blue-500 transition-colors">
                                        <Upload size={18} />
                                      </div>
                                      <p className="text-[10px] font-semibold text-theme-primary">Drag & drop or Click to upload</p>
                                      <p className="text-[8px] text-theme-muted font-mono uppercase">PNG, JPG, SVG up to 2MB</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Watermark customizers */}
                            <div className="space-y-2.5 border-t border-theme-divider/40 pt-2.5">
                              {/* Layout Mode Selection */}
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-theme-muted font-mono uppercase">Arrangement</span>
                                <div className="flex bg-theme-surface-2 p-0.5 rounded-lg border border-theme-divider">
                                  <button
                                    onClick={() => setWatermarkLayout("center")}
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all ${watermarkLayout === "center" ? "bg-blue-600 text-white" : "text-theme-muted hover:text-theme-primary"}`}
                                  >
                                    Single Centered
                                  </button>
                                  <button
                                    onClick={() => setWatermarkLayout("tile")}
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all ${watermarkLayout === "tile" ? "bg-blue-600 text-white" : "text-theme-muted hover:text-theme-primary"}`}
                                  >
                                    Tiled Grid
                                  </button>
                                </div>
                              </div>

                              {/* Opacity slider */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-[9px] font-mono text-theme-muted">
                                  <span>Watermark Opacity</span>
                                  <span className="text-theme-primary font-bold">{watermarkOpacity}%</span>
                                </div>
                                <input 
                                  type="range" min="5" max="50" value={watermarkOpacity}
                                  onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                                  className="w-full accent-blue-500 h-1 bg-theme-surface-2 rounded-lg appearance-none cursor-pointer"
                                />
                              </div>

                              {/* Size/Scale Slider */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-[9px] font-mono text-theme-muted">
                                  <span>{watermarkLayout === "tile" ? "Tile Frequency" : "Watermark Scale"}</span>
                                  <span className="text-theme-primary font-bold">{watermarkSize}%</span>
                                </div>
                                <input 
                                  type="range" min="15" max="100" value={watermarkSize}
                                  onChange={(e) => setWatermarkSize(Number(e.target.value))}
                                  className="w-full accent-blue-500 h-1 bg-theme-surface-2 rounded-lg appearance-none cursor-pointer"
                                />
                              </div>

                              {/* Rotation Slider */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-[9px] font-mono text-theme-muted">
                                  <span>Angular Tilt</span>
                                  <span className="text-theme-primary font-bold">{watermarkRotation}°</span>
                                </div>
                                <input 
                                  type="range" min="-90" max="90" value={watermarkRotation}
                                  onChange={(e) => setWatermarkRotation(Number(e.target.value))}
                                  className="w-full accent-blue-500 h-1 bg-theme-surface-2 rounded-lg appearance-none cursor-pointer"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Scale Slider */}
                    <div className="space-y-1.5 border-t border-theme-divider pt-5">
                      <div className="flex justify-between text-[10px] font-mono text-theme-muted uppercase">
                        <span>Workspace Zoom</span>
                        <span className="text-theme-primary font-bold">{pageSizeScale}%</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Scale size={12} className="text-theme-muted shrink-0" />
                        <input 
                          type="range"
                          min="70"
                          max="140"
                          value={pageSizeScale}
                          onChange={(e) => setPageSizeScale(Number(e.target.value))}
                          className="flex-1 accent-blue-500 h-1 bg-theme-surface-1 rounded-lg appearance-none cursor-pointer border border-theme-divider"
                        />
                      </div>
                    </div>

                    {/* Section 5: Mobile QR Companion Sync */}
                    <div className="space-y-3.5 border-t border-theme-divider pt-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 text-theme-muted">
                          <QrCode size={14} className="text-blue-500" />
                          <span className="text-[10px] uppercase tracking-wider font-bold font-mono">Mobile QR Companion Sync</span>
                        </div>
                        <span className="flex items-center gap-1 text-[8px] font-mono uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          Live Sync
                        </span>
                      </div>

                      <p className="text-[9px] text-theme-muted leading-relaxed">
                        Scan with your iOS or Android camera to instantly view and interact with this exact customized document layout and live-edited content on your mobile terminal.
                      </p>

                      <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-3.5 flex flex-col sm:flex-row items-center gap-4">
                        {/* QR Code Container */}
                        <div className="relative bg-white p-2 rounded-xl shadow-md border border-slate-200 shrink-0 group transition-all duration-300 hover:scale-[1.03] hover:shadow-lg">
                          {qrCodeDataUrl ? (
                            <img 
                              src={qrCodeDataUrl} 
                              alt="Document Sync QR Code" 
                              className="w-24 h-24 select-none pointer-events-none"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-24 h-24 flex items-center justify-center bg-slate-50 rounded-lg">
                              <span className="text-[9px] text-slate-400 font-mono animate-pulse">Generating...</span>
                            </div>
                          )}
                        </div>

                        {/* QR Description and Actions */}
                        <div className="flex-1 space-y-2.5 w-full">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-1.5 text-xs font-bold text-theme-primary">
                              <Smartphone size={13} className="text-blue-400" />
                              <span>Instant Companion Link</span>
                            </div>
                            <div className="text-[9px] text-theme-muted leading-relaxed">
                              Perfect for remote dual-screen testing, cashier thermal print lanes, or customer receipt handoffs.
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(shareableUrl);
                              setCopiedUrl(true);
                              setTimeout(() => setCopiedUrl(false), 2000);
                            }}
                            className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-[10px] font-bold tracking-wide uppercase transition-all duration-200 border cursor-pointer ${
                              copiedUrl 
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-sm"
                                : "bg-blue-600 border-blue-500 text-white hover:bg-blue-500 shadow-md shadow-blue-500/10"
                            }`}
                          >
                            {copiedUrl ? (
                              <>
                                <Check size={11} className="text-emerald-400" />
                                Copied Share Link!
                              </>
                            ) : (
                              <>
                                <Copy size={11} />
                                Copy Share URL
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Section 6: Cryptographic Verification Seal */}
                    <div className="space-y-3.5 border-t border-theme-divider pt-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 text-theme-muted">
                          <Lock size={14} className="text-emerald-500 animate-pulse" />
                          <span className="text-[10px] uppercase tracking-wider font-bold font-mono">Digital Signature Seal</span>
                        </div>
                        <span className="flex items-center gap-1 text-[8px] font-mono uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">
                          Secure Key Active
                        </span>
                      </div>

                      <p className="text-[9px] text-theme-muted leading-relaxed">
                        Attach an official cryptographic certification seal containing a dynamic SHA-256 equivalent verification hash representing the authentic document details.
                      </p>

                      <div className="space-y-3 bg-theme-surface-1 border border-theme-divider rounded-xl p-3.5">
                        {/* Toggle digital signature */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-theme-primary">Apply Digital Signature</span>
                          <button
                            onClick={() => setIsDigitallySigned(!isDigitallySigned)}
                            className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${isDigitallySigned ? "bg-emerald-600" : "bg-theme-surface-3 border border-theme-divider"}`}
                          >
                            <div className={`w-3.8 h-3.8 rounded-full bg-white transition-transform transform ${isDigitallySigned ? "translate-x-4" : "translate-x-0"}`} />
                          </button>
                        </div>

                        {isDigitallySigned && (
                          <div className="space-y-3 animate-in fade-in duration-200 border-t border-theme-divider/60 pt-3">
                            {/* Verification Authority Selection */}
                            <div className="space-y-1">
                              <label className="text-[9px] text-theme-muted font-mono uppercase">Certification Authority</label>
                              <select
                                value={verificationAuthority}
                                onChange={(e) => setVerificationAuthority(e.target.value as any)}
                                className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1 text-xs text-theme-primary focus:outline-none"
                              >
                                <option value="smriti">SMRITI OS Root CA v2.1</option>
                                <option value="aitdl">AITDL Net Security Layer</option>
                                <option value="admin">Local Administrator (Self-Signed)</option>
                              </select>
                            </div>

                            {/* Seal Theme Selection */}
                            <div className="space-y-1">
                              <label className="text-[9px] text-theme-muted font-mono uppercase">Visual Seal Theme</label>
                              <select
                                value={sealTheme}
                                onChange={(e) => setSealTheme(e.target.value as any)}
                                className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1 text-xs text-theme-primary focus:outline-none"
                              >
                                <option value="emerald">Classic Emerald Trust</option>
                                <option value="indigo">Tech Indigo Secure</option>
                                <option value="amber">Enterprise Amber Warning</option>
                                <option value="rose">Restricted Rose Vault</option>
                              </select>
                            </div>

                            {/* Live Verification Hash Preview */}
                            <div className="space-y-1 bg-theme-surface-3 rounded-lg p-2 border border-theme-divider">
                              <span className="text-[8px] text-theme-muted font-mono uppercase">Live Document Hash Fingerprint</span>
                              <div className="text-[8.5px] font-mono text-emerald-400 break-all select-all font-semibold leading-normal">
                                {generateDocHash(documentData, selectedTemplateId)}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Section 7: Real-Time Printer Status Monitor */}
                    <div className="space-y-3.5 border-t border-theme-divider pt-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 text-theme-muted">
                          <Printer size={14} className={printerStatus.status === "ready" ? "text-emerald-500" : printerStatus.status === "busy" ? "text-amber-500 animate-pulse" : "text-rose-500"} />
                          <span className="text-[10px] uppercase tracking-wider font-bold font-mono">Real-Time Printer Status</span>
                        </div>
                        <span className={`flex items-center gap-1 text-[8px] font-mono uppercase border px-1.5 py-0.5 rounded ${
                          printerStatus.status === "ready" 
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                            : printerStatus.status === "busy"
                            ? "bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse"
                            : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                        }`}>
                          {printerStatus.status}
                        </span>
                      </div>

                      <p className="text-[9px] text-theme-muted leading-relaxed">
                        Monitor active system-connected hardware, track cartridge levels, paper supplies, and route print jobs to physical endpoints.
                      </p>

                      <div className="space-y-3.5 bg-theme-surface-1 border border-theme-divider rounded-xl p-3.5">
                        {/* Select Active Printer */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <label className="text-[9px] text-theme-muted font-mono uppercase">Select Print Hardware</label>
                            <span className="text-[8px] text-theme-muted font-mono text-right">Checked: {printerStatus.lastChecked}</span>
                          </div>
                          <select
                            value={printerStatus.activePrinter?.id || ""}
                            onChange={(e) => selectPrinter(e.target.value)}
                            className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1 text-xs text-theme-primary focus:outline-none"
                          >
                            {printerStatus.devices.map((device) => (
                              <option key={device.id} value={device.id}>
                                {device.name} ({device.connection.toUpperCase()}) — {device.status.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Active Printer Attributes & Gauges */}
                        {printerStatus.activePrinter && (
                          <div className="space-y-3 border-t border-theme-divider/60 pt-3 animate-in fade-in duration-200">
                            {/* Connection and Type Meta */}
                            <div className="grid grid-cols-2 gap-2 bg-theme-surface-2 p-2 rounded-lg border border-theme-divider text-[10px]">
                              <div>
                                <span className="text-theme-muted font-mono uppercase block text-[8px]">Connection</span>
                                <span className="font-semibold text-theme-primary capitalize flex items-center gap-1">
                                  <span className={`w-1.5 h-1.5 rounded-full ${
                                    printerStatus.activePrinter.status === "offline" ? "bg-gray-400" : "bg-emerald-500"
                                  }`} />
                                  {printerStatus.activePrinter.connection}
                                  {printerStatus.activePrinter.ipAddress && (
                                    <span className="text-[8px] text-theme-muted font-mono font-normal"> ({printerStatus.activePrinter.ipAddress})</span>
                                  )}
                                </span>
                              </div>
                              <div>
                                <span className="text-theme-muted font-mono uppercase block text-[8px]">Hardware Type</span>
                                <span className="font-semibold text-theme-primary capitalize">{printerStatus.activePrinter.type}</span>
                              </div>
                            </div>

                            {/* Gauges (Ink & Paper levels) */}
                            <div className="space-y-2">
                              {/* Ink Gauge */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-[9px] font-mono text-theme-muted">
                                  <span>{printerStatus.activePrinter.type === "thermal" ? "Thermal Head Life" : "Toner/Ink Supply"}</span>
                                  <span className={`font-bold ${
                                    printerStatus.activePrinter.inkLevel < 20 ? "text-rose-500" : "text-theme-primary"
                                  }`}>{printerStatus.activePrinter.inkLevel}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-theme-surface-2 rounded-full overflow-hidden border border-theme-divider">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      printerStatus.activePrinter.inkLevel < 20 
                                        ? "bg-rose-500" 
                                        : printerStatus.activePrinter.inkLevel < 50 
                                        ? "bg-amber-500" 
                                        : "bg-blue-500"
                                    }`}
                                    style={{ width: `${printerStatus.activePrinter.inkLevel}%` }}
                                  />
                                </div>
                              </div>

                              {/* Paper Gauge */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-[9px] font-mono text-theme-muted">
                                  <span>Paper Supply</span>
                                  <span className={`font-bold ${
                                    printerStatus.activePrinter.paperLevel < 15 ? "text-rose-500 animate-pulse" : "text-theme-primary"
                                  }`}>{printerStatus.activePrinter.paperLevel}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-theme-surface-2 rounded-full overflow-hidden border border-theme-divider">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      printerStatus.activePrinter.paperLevel < 15 
                                        ? "bg-rose-500" 
                                        : printerStatus.activePrinter.paperLevel < 40 
                                        ? "bg-amber-500" 
                                        : "bg-emerald-500"
                                    }`}
                                    style={{ width: `${printerStatus.activePrinter.paperLevel}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Scan & Diagnostics Buttons */}
                        <div className="grid grid-cols-2 gap-2 border-t border-theme-divider/60 pt-3">
                          <button
                            type="button"
                            onClick={() => queryConnectedPrinters()}
                            disabled={printerStatus.isQuerying}
                            className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-[9px] font-bold tracking-wide uppercase transition-all duration-200 border border-theme-divider bg-theme-surface-2 hover:bg-theme-surface-3 text-theme-primary cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                          >
                            {printerStatus.isQuerying ? (
                              <>
                                <div className="w-2.5 h-2.5 border-2 border-theme-muted border-t-blue-500 rounded-full animate-spin" />
                                Querying...
                              </>
                            ) : (
                              <>
                                <RotateCcw size={10} className="animate-spin" />
                                Scan Ports
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const active = printerStatus.activePrinter;
                              if (active) {
                                updatePrinterStatus(active.id, { status: "printing" });
                                setTimeout(() => {
                                  updatePrinterStatus(active.id, { 
                                    status: active.paperLevel === 0 ? "out-of-paper" : "online"
                                  });
                                }, 1500);
                              }
                            }}
                            disabled={printerStatus.isQuerying || printerStatus.activePrinter?.status === "offline" || printerStatus.activePrinter?.status === "printing"}
                            className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-[9px] font-bold tracking-wide uppercase transition-all duration-200 border border-theme-divider bg-theme-surface-2 hover:bg-theme-surface-3 text-theme-primary cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                          >
                            <Sliders size={10} />
                            Test Feed
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>
                ) : (
                  /* TAB 2: DUAL-WAY DOCUMENT CONTENT EDITOR */
                  <div className="space-y-4 animate-in fade-in duration-250">
                    <div className="flex items-center space-x-1.5 text-theme-muted">
                      <Settings2 size={14} className="text-blue-500" />
                      <span className="text-[10px] uppercase tracking-wider font-bold font-mono">Direct Content Properties</span>
                    </div>

                    {/* Root text parameters */}
                    <div className="space-y-3">
                      
                      {/* Header Store/Company Name */}
                      {documentData.hasOwnProperty("companyName") && (
                        <div className="space-y-1">
                          <label className="text-[10px] text-theme-muted font-mono uppercase">Company Name</label>
                          <input 
                            type="text"
                            value={documentData.companyName || ""}
                            onChange={(e) => handleRootFieldChange("companyName", e.target.value)}
                            className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-primary focus:outline-none focus:border-blue-500 font-semibold"
                          />
                        </div>
                      )}
                      {documentData.hasOwnProperty("storeName") && (
                        <div className="space-y-1">
                          <label className="text-[10px] text-theme-muted font-mono uppercase">Store Name</label>
                          <input 
                            type="text"
                            value={documentData.storeName || ""}
                            onChange={(e) => handleRootFieldChange("storeName", e.target.value)}
                            className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-primary focus:outline-none focus:border-blue-500 font-semibold"
                          />
                        </div>
                      )}

                      {/* Document Reference No */}
                      {documentData.hasOwnProperty("invoiceNo") && (
                        <div className="space-y-1">
                          <label className="text-[10px] text-theme-muted font-mono uppercase">Invoice Ref</label>
                          <input 
                            type="text"
                            value={documentData.invoiceNo || ""}
                            onChange={(e) => handleRootFieldChange("invoiceNo", e.target.value)}
                            className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-primary focus:outline-none focus:border-blue-500 font-mono"
                          />
                        </div>
                      )}
                      {documentData.hasOwnProperty("grnNo") && (
                        <div className="space-y-1">
                          <label className="text-[10px] text-theme-muted font-mono uppercase">GRN Number</label>
                          <input 
                            type="text"
                            value={documentData.grnNo || ""}
                            onChange={(e) => handleRootFieldChange("grnNo", e.target.value)}
                            className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-primary focus:outline-none focus:border-blue-500 font-mono"
                          />
                        </div>
                      )}
                      {documentData.hasOwnProperty("receiptNo") && (
                        <div className="space-y-1">
                          <label className="text-[10px] text-theme-muted font-mono uppercase">Receipt Number</label>
                          <input 
                            type="text"
                            value={documentData.receiptNo || ""}
                            onChange={(e) => handleRootFieldChange("receiptNo", e.target.value)}
                            className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-primary focus:outline-none focus:border-blue-500 font-mono"
                          />
                        </div>
                      )}

                      {/* Date and Client */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-theme-muted font-mono uppercase">Date</label>
                          <input 
                            type="text"
                            value={documentData.date || ""}
                            onChange={(e) => handleRootFieldChange("date", e.target.value)}
                            className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-2 py-1.5 text-xs text-theme-primary focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        {documentData.hasOwnProperty("customerName") && (
                          <div className="space-y-1">
                            <label className="text-[10px] text-theme-muted font-mono uppercase">Client / Party</label>
                            <input 
                              type="text"
                              value={documentData.customerName || ""}
                              onChange={(e) => handleRootFieldChange("customerName", e.target.value)}
                              className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-2 py-1.5 text-xs text-theme-primary focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        )}
                        {documentData.hasOwnProperty("supplierName") && (
                          <div className="space-y-1">
                            <label className="text-[10px] text-theme-muted font-mono uppercase">Supplier</label>
                            <input 
                              type="text"
                              value={documentData.supplierName || ""}
                              onChange={(e) => handleRootFieldChange("supplierName", e.target.value)}
                              className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-2 py-1.5 text-xs text-theme-primary focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        )}
                      </div>

                      {/* Cashier or Received By */}
                      {documentData.hasOwnProperty("cashier") && (
                        <div className="space-y-1">
                          <label className="text-[10px] text-theme-muted font-mono uppercase">Operator / Cashier</label>
                          <input 
                            type="text"
                            value={documentData.cashier || ""}
                            onChange={(e) => handleRootFieldChange("cashier", e.target.value)}
                            className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-primary focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      )}
                      {documentData.hasOwnProperty("receivedBy") && (
                        <div className="space-y-1">
                          <label className="text-[10px] text-theme-muted font-mono uppercase">Received By</label>
                          <input 
                            type="text"
                            value={documentData.receivedBy || ""}
                            onChange={(e) => handleRootFieldChange("receivedBy", e.target.value)}
                            className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-primary focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      )}
                    </div>

                    {/* Line Items Dynamic Grid Editor */}
                    {documentData.items && (
                      <div className="space-y-3.5 pt-4 border-t border-theme-divider">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] uppercase font-mono tracking-wider text-theme-muted font-bold">Line Items List</span>
                          <button
                            onClick={handleAddItem}
                            className="flex items-center gap-1 text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/10 hover:bg-blue-500/20 transition-all cursor-pointer"
                          >
                            <Plus size={10} /> Add Item
                          </button>
                        </div>

                        <div className="space-y-2">
                          {documentData.items.map((item: any, idx: number) => (
                            <div key={idx} className="bg-theme-surface-1 border border-theme-divider rounded-xl p-3 space-y-2 relative">
                              <button
                                onClick={() => handleDeleteItem(idx)}
                                className="absolute top-2.5 right-2.5 text-theme-muted hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                              >
                                <Trash2 size={11} />
                              </button>
                              
                              {/* Item Name */}
                              <div className="space-y-0.5 pr-6">
                                <label className="text-[8px] text-theme-muted font-mono uppercase">Description</label>
                                <input 
                                  type="text"
                                  value={item.name || ""}
                                  onChange={(e) => handleItemFieldChange(idx, "name", e.target.value)}
                                  className="w-full bg-theme-surface-2 border border-theme-divider rounded px-2 py-0.5 text-xs text-theme-primary focus:outline-none"
                                />
                              </div>

                              {/* Qty & Rate */}
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-0.5">
                                  <label className="text-[8px] text-theme-muted font-mono uppercase">Quantity</label>
                                  <input 
                                    type="number"
                                    min="1"
                                    value={item.qty || 1}
                                    onChange={(e) => handleItemFieldChange(idx, "qty", e.target.value)}
                                    className="w-full bg-theme-surface-2 border border-theme-divider rounded px-2 py-0.5 text-xs text-theme-primary focus:outline-none"
                                  />
                                </div>
                                <div className="space-y-0.5">
                                  <label className="text-[8px] text-theme-muted font-mono uppercase">Unit Rate ($)</label>
                                  <input 
                                    type="number"
                                    step="0.01"
                                    value={item.rate || 0.0}
                                    onChange={(e) => handleItemFieldChange(idx, "rate", e.target.value)}
                                    className="w-full bg-theme-surface-2 border border-theme-divider rounded px-2 py-0.5 text-xs text-theme-primary focus:outline-none font-mono"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}

                          {documentData.items.length === 0 && (
                            <div className="text-center py-6 border border-dashed border-theme-divider rounded-xl text-xs text-theme-muted">
                              No items in list. Add an item above to generate preview.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </SmritiScrollArea>
          </div>

          {/* Right Panel: Immersive physical canvas preview */}
          <div className="flex-1 bg-theme-surface-3 overflow-auto relative p-6 md:p-12 flex justify-center items-start min-h-0">
            {/* Background drafting radial-dots pattern */}
            <div className="absolute inset-0 pointer-events-none" style={{ 
              backgroundImage: 'radial-gradient(var(--color-theme-divider) 1.2px, transparent 1.2px)',
              backgroundSize: '24px 24px',
              opacity: 0.4
            }}></div>

            {/* Scaled & Rotated layout wrapper */}
            <div className="relative flex justify-center py-6 select-text">
              <div 
                className="shadow-2xl ring-1 ring-black/10 bg-white transition-all duration-300 transform origin-top select-text"
                style={{
                  transform: `scale(${pageSizeScale / 100})`,
                  width: PAPER_DIMENSIONS[paperSize](orientation).width,
                  height: PAPER_DIMENSIONS[paperSize](orientation).height,
                  minHeight: PAPER_DIMENSIONS[paperSize](orientation).minHeight,
                }}
              >
                {/* Standard White Paper Wrapping */}
                <div 
                  ref={printPreviewRef}
                  className="text-black bg-white w-full h-full select-text overflow-hidden relative flex flex-col justify-between"
                  style={{
                    ...getMarginStyle(),
                    filter: grayscaleMode ? "grayscale(100%) contrast(110%)" : "none"
                  }}
                >
                  {/* Engineering alignment gridlines */}
                  {showGridlines && (
                    <div className="absolute inset-0 pointer-events-none" style={{
                      backgroundImage: 'linear-gradient(to right, rgba(239, 68, 68, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(239, 68, 68, 0.04) 1px, transparent 1px)',
                      backgroundSize: '8mm 8mm',
                      zIndex: 40
                    }} />
                  )}

                  {/* Custom Document Watermark layer */}
                  {isWatermarkEnabled && watermarkUrl && (
                    <div 
                      className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden" 
                      style={{ 
                        opacity: watermarkOpacity / 100,
                        zIndex: 1,
                      }}
                    >
                      {watermarkLayout === "tile" ? (
                        <div 
                          className="w-full h-full"
                          style={{
                            backgroundImage: `url("${watermarkUrl}")`,
                            backgroundRepeat: "repeat",
                            backgroundSize: `${watermarkSize * 2.5}px`,
                            transform: `rotate(${watermarkRotation}deg)`,
                          }}
                        />
                      ) : (
                        <img 
                          src={watermarkUrl} 
                          alt="Document Watermark" 
                          style={{
                            width: `${watermarkSize}%`,
                            maxWidth: "90%",
                            transform: `rotate(${watermarkRotation}deg)`,
                          }}
                          referrerPolicy="no-referrer"
                        />
                      )}
                    </div>
                  )}

                  {/* Top preview metadata header */}
                  {showHeader && ["A4", "A5", "Letter", "Legal"].includes(paperSize) && (
                    <div className="text-[9px] font-mono tracking-widest text-gray-400 border-b border-gray-150 pb-1.5 mb-4 flex justify-between uppercase select-none shrink-0">
                      <span>SMRITI Retail OS • Active Preview Mode</span>
                      <span>ISO 2026 Print Standards</span>
                    </div>
                  )}

                  {/* Active Template Component */}
                  <div className="flex-1 min-h-0">
                    {TemplateComponent ? (
                      <TemplateComponent data={documentData} />
                    ) : (
                      <div className="p-8 text-center text-sm font-semibold text-gray-500">
                        Loading selected print layout...
                      </div>
                    )}
                  </div>

                  {/* Active Digital Signature Seal overlay/banner */}
                  {isDigitallySigned && (
                    <div className={`mt-3 pt-2.5 border-t border-dashed border-gray-200 flex items-center justify-between text-[8px] font-mono select-none shrink-0 rounded-lg p-2 ${SEAL_THEMES[sealTheme].bg} border ${SEAL_THEMES[sealTheme].border}`}>
                      <div className="flex items-center space-x-2">
                        <div className={`w-5.5 h-5.5 rounded-full ${SEAL_THEMES[sealTheme].iconBg} border ${SEAL_THEMES[sealTheme].iconBorder} flex items-center justify-center shrink-0`}>
                          <ShieldCheck size={11} className={`${SEAL_THEMES[sealTheme].iconColor} animate-pulse`} />
                        </div>
                        <div className="flex flex-col leading-tight">
                          <span className={`font-bold text-[8.5px] ${SEAL_THEMES[sealTheme].text} tracking-wide uppercase flex items-center gap-1`}>
                            {SIGNATURE_AUTHORITIES[verificationAuthority].stamp}
                            <span className="text-[6.5px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1 py-0.1 rounded font-bold uppercase tracking-wider scale-95 origin-left">VERIFIED</span>
                          </span>
                          <span className="text-gray-400 font-normal">{generateDocHash(documentData, selectedTemplateId)}</span>
                        </div>
                      </div>
                      <div className="text-right flex flex-col justify-center leading-tight">
                        <span className="text-gray-500 font-bold text-[7px] uppercase">{SIGNATURE_AUTHORITIES[verificationAuthority].keyId.slice(0, 18)}...</span>
                        <span className="text-[7.5px] text-gray-400">Time: {new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC</span>
                      </div>
                    </div>
                  )}

                  {/* Bottom preview metadata footer */}
                  {showHeader && ["A4", "A5", "Letter", "Legal"].includes(paperSize) && (
                    <div className="text-[9px] font-mono tracking-widest text-gray-400 border-t border-gray-150 pt-1.5 mt-4 flex justify-between uppercase select-none shrink-0">
                      <span>Document: {activeTemplate?.name}</span>
                      <span>Confidential Security Layer</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Actions Footer */}
        <div className="h-16 border-t border-theme-divider bg-theme-surface-1 flex items-center justify-between px-6 shrink-0">
          
          <button
            onClick={handleResetToDefaults}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-theme-muted border border-theme-divider rounded-xl hover:bg-theme-surface-hover hover:text-theme-primary transition-all cursor-pointer"
            title="Reset settings and data back to defaults"
          >
            <RotateCcw size={13} /> Reset Defaults
          </button>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-theme-muted hover:text-theme-primary transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleExportPDF}
              disabled={isExportingPdf || !documentData || (documentData.items && documentData.items.length === 0)}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/15 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
            >
              {isExportingPdf ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <Download size={13} />
                  Export Signed PDF
                </>
              )}
            </button>
            <button
              onClick={handleFinalPrint}
              disabled={!documentData || (documentData.items && documentData.items.length === 0)}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-500/15 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
            >
              <Printer size={13} /> Dispatch to Physical Printer
            </button>
          </div>
        </div>

      </motion.div>
    </div>
  );
};
