/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.0.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useActiveField, ActiveFieldCategory } from "../../context/ActiveFieldContext.tsx";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import { getCustomers } from "../../services/customerStore.ts";
import { 
  Search, 
  X, 
  Check, 
  Layers, 
  Package, 
  Users, 
  Building2, 
  Percent, 
  Hash, 
  UserCheck, 
  ArrowUp, 
  ArrowDown, 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  RotateCcw, 
  CornerDownLeft, 
  Image as ImageIcon, 
  MapPin, 
  Store, 
  Filter,
  Palette,
  Ruler,
  Tag,
  Scissors,
  Sun,
  Scale,
  FileText
} from "lucide-react";

export interface ColumnDefinition {
  key: string;
  label: string;
  visible: boolean;
  align?: "left" | "right" | "center";
  width?: string;
}

export interface ColumnFilterCriteria {
  condition: "Contains" | "Equal" | "Starts With" | "Greater Than" | "Less Than";
  value: string;
}

// Master Default Columns for every attribute & entity
const DEFAULT_COLUMNS: Record<string, ColumnDefinition[]> = {
  product: [
    { key: "sku", label: "Stock No", visible: true, align: "left", width: "w-36" },
    { key: "barcode", label: "Barcode", visible: true, align: "left", width: "w-36" },
    { key: "name", label: "Item Description", visible: true, align: "left" },
    { key: "category", label: "Category", visible: true, align: "left", width: "w-28" },
    { key: "size", label: "Size", visible: true, align: "center", width: "w-16" },
    { key: "color", label: "Color", visible: true, align: "center", width: "w-20" },
    { key: "brand", label: "Brand", visible: true, align: "left", width: "w-28" },
    { key: "selling_price", label: "Rate (₹)", visible: true, align: "right", width: "w-24" },
    { key: "mrp", label: "MRP (₹)", visible: true, align: "right", width: "w-24" },
    { key: "stock", label: "Avail Qty", visible: true, align: "right", width: "w-20" }
  ],
  article: [
    { key: "code", label: "Article / Style Code", visible: true, align: "left", width: "w-36" },
    { key: "name", label: "Style Description", visible: true, align: "left" },
    { key: "category", label: "Category", visible: true, align: "left", width: "w-28" },
    { key: "brand", label: "Brand", visible: true, align: "left", width: "w-28" },
    { key: "season", label: "Season", visible: true, align: "center", width: "w-24" },
    { key: "mrp", label: "Base MRP (₹)", visible: true, align: "right", width: "w-24" }
  ],
  color: [
    { key: "code", label: "Color Code", visible: true, align: "left", width: "w-28" },
    { key: "name", label: "Color Name", visible: true, align: "left" },
    { key: "shade", label: "Shade Family", visible: true, align: "left", width: "w-32" },
    { key: "hex", label: "Hex Swatch", visible: true, align: "center", width: "w-24" },
    { key: "group", label: "Color Group", visible: true, align: "left", width: "w-28" }
  ],
  size: [
    { key: "code", label: "Size Code", visible: true, align: "center", width: "w-24" },
    { key: "name", label: "Size Label", visible: true, align: "left" },
    { key: "scale", label: "Size Scale / Group", visible: true, align: "left", width: "w-36" },
    { key: "standard", label: "Standard (UK/US/EU)", visible: true, align: "center", width: "w-32" },
    { key: "sortOrder", label: "Display Sort", visible: true, align: "right", width: "w-20" }
  ],
  brand: [
    { key: "code", label: "Brand Code", visible: true, align: "left", width: "w-28" },
    { key: "name", label: "Brand Name", visible: true, align: "left" },
    { key: "origin", label: "Brand Origin", visible: true, align: "left", width: "w-32" },
    { key: "tier", label: "Segment / Tier", visible: true, align: "center", width: "w-28" },
    { key: "status", label: "Status", visible: true, align: "center", width: "w-24" }
  ],
  department: [
    { key: "code", label: "Dept Code", visible: true, align: "left", width: "w-28" },
    { key: "name", label: "Department Name", visible: true, align: "left" },
    { key: "division", label: "Division", visible: true, align: "left", width: "w-32" },
    { key: "description", label: "Description", visible: true, align: "left" }
  ],
  section: [
    { key: "code", label: "Section Code", visible: true, align: "left", width: "w-28" },
    { key: "name", label: "Section Name", visible: true, align: "left" },
    { key: "targetAudience", label: "Target Audience", visible: true, align: "left", width: "w-36" },
    { key: "deptCode", label: "Parent Dept", visible: true, align: "left", width: "w-28" }
  ],
  fabric: [
    { key: "code", label: "Fabric Code", visible: true, align: "left", width: "w-28" },
    { key: "name", label: "Fabric Name", visible: true, align: "left" },
    { key: "composition", label: "Composition", visible: true, align: "left", width: "w-40" },
    { key: "weave", label: "Weave Type", visible: true, align: "left", width: "w-28" },
    { key: "gsm", label: "GSM Weight", visible: true, align: "right", width: "w-20" }
  ],
  fit: [
    { key: "code", label: "Fit Code", visible: true, align: "left", width: "w-24" },
    { key: "name", label: "Fit Silhouette", visible: true, align: "left" },
    { key: "cutType", label: "Cut Contour", visible: true, align: "left", width: "w-36" },
    { key: "description", label: "Fitting Characteristics", visible: true, align: "left" }
  ],
  season: [
    { key: "code", label: "Season Code", visible: true, align: "left", width: "w-28" },
    { key: "name", label: "Season Name", visible: true, align: "left" },
    { key: "year", label: "Year", visible: true, align: "center", width: "w-20" },
    { key: "status", label: "Season State", visible: true, align: "center", width: "w-24" }
  ],
  uom: [
    { key: "code", label: "UOM Code", visible: true, align: "center", width: "w-24" },
    { key: "name", label: "Unit Description", visible: true, align: "left" },
    { key: "type", label: "Unit Type", visible: true, align: "left", width: "w-28" },
    { key: "decimalPlaces", label: "Decimals Allowed", visible: true, align: "center", width: "w-28" }
  ],
  supplier: [
    { key: "code", label: "Party / Vendor Code", visible: true, align: "left", width: "w-32" },
    { key: "name", label: "Supplier / Party Name", visible: true, align: "left" },
    { key: "gstin", label: "GSTIN", visible: true, align: "left", width: "w-36" },
    { key: "state", label: "State", visible: true, align: "left", width: "w-28" },
    { key: "phone", label: "Contact Mobile", visible: true, align: "left", width: "w-32" },
    { key: "balance", label: "Ledger Balance", visible: true, align: "right", width: "w-28" }
  ],
  customer: [
    { key: "code", label: "Cust Code", visible: true, align: "left", width: "w-28" },
    { key: "name", label: "Customer Name", visible: true, align: "left" },
    { key: "phone", label: "Mobile No", visible: true, align: "left", width: "w-32" },
    { key: "loyaltyTier", label: "Tier", visible: true, align: "center", width: "w-24" },
    { key: "loyaltyPoints", label: "Points", visible: true, align: "right", width: "w-20" },
    { key: "currentBalance", label: "Credit Balance", visible: true, align: "right", width: "w-28" },
    { key: "gstin", label: "GSTIN", visible: true, align: "left", width: "w-36" }
  ],
  store: [
    { key: "code", label: "Store Code", visible: true, align: "left", width: "w-28" },
    { key: "name", label: "Chain Store / Branch", visible: true, align: "left" },
    { key: "city", label: "City", visible: true, align: "left", width: "w-28" },
    { key: "state", label: "State", visible: true, align: "left", width: "w-28" },
    { key: "posCount", label: "POS Counters", visible: true, align: "center", width: "w-24" },
    { key: "status", label: "Status", visible: true, align: "center", width: "w-24" }
  ],
  classification: [
    { key: "code", label: "Class Code", visible: true, align: "left", width: "w-28" },
    { key: "name", label: "Classification Name", visible: true, align: "left" },
    { key: "type", label: "Hierarchy Level", visible: true, align: "left", width: "w-32" },
    { key: "description", label: "Specification", visible: true, align: "left" }
  ],
  hsn: [
    { key: "code", label: "HSN / SAC Code", visible: true, align: "left", width: "w-36" },
    { key: "desc", label: "Commodity Description", visible: true, align: "left" },
    { key: "gstPct", label: "GST Rate %", visible: true, align: "right", width: "w-24" }
  ],
  staff: [
    { key: "code", label: "Staff Code", visible: true, align: "left", width: "w-24" },
    { key: "name", label: "Salesperson Name", visible: true, align: "left" },
    { key: "role", label: "Role / Designation", visible: true, align: "left", width: "w-36" },
    { key: "counter", label: "Assigned Counter", visible: true, align: "left", width: "w-36" }
  ],
  scheme: [
    { key: "code", label: "Scheme Code", visible: true, align: "left", width: "w-28" },
    { key: "name", label: "Scheme / Offer Name", visible: true, align: "left" },
    { key: "type", label: "Discount Type", visible: true, align: "left", width: "w-32" },
    { key: "value", label: "Offer Benefit", visible: true, align: "right", width: "w-28" },
    { key: "validity", label: "Validity", visible: true, align: "center", width: "w-28" }
  ],
  terms: [
    { key: "code", label: "Terms Code", visible: true, align: "left", width: "w-28" },
    { key: "name", label: "Payment & Commercial Terms", visible: true, align: "left" },
    { key: "creditDays", label: "Credit Days", visible: true, align: "right", width: "w-24" },
    { key: "interestPct", label: "Overdue Int %", visible: true, align: "right", width: "w-24" }
  ]
};

export const GlobalF2BrowseModal: React.FC = () => {
  const { 
    isF2ModalOpen, 
    closeF2Modal, 
    category, 
    fieldLabel, 
    fieldName, 
    fieldValue,
    insertValueIntoActiveField 
  } = useActiveField();

  // Active Category Tab
  const [activeTab, setActiveTab] = useState<string>("product");
  const [showFilterPanel, setShowFilterPanel] = useState<boolean>(true);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(0);

  // Column Configurations per category
  const [columns, setColumns] = useState<Record<string, ColumnDefinition[]>>(() => {
    try {
      const saved = localStorage.getItem("smriti_f2_browse_columns");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_COLUMNS;
  });

  // Per-column filter criteria
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterCriteria>>({});
  const [anyColumnFilter, setAnyColumnFilter] = useState<string>("");

  // Bottom Search Strip State
  const [bottomSearchCol, setBottomSearchCol] = useState<string>("all");
  const [bottomSearchVal, setBottomSearchVal] = useState<string>("");

  // Master Data Registries
  const [productsList, setProductsList] = useState<any[]>([]);
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [suppliersList, setSuppliersList] = useState<any[]>([
    { code: "VEN-001", name: "Arvind Mills Textiles Ltd", gstin: "27AAACA1234F1Z1", state: "Maharashtra", phone: "+91 22 2493 8000", address: "Naroda Road, Ahmedabad, Gujarat 380025", balance: 145000.00 },
    { code: "VEN-002", name: "Vardhman Polytex Pvt Ltd", gstin: "03AAACV5678K1Z5", state: "Punjab", phone: "+91 161 222 8500", address: "Chandigarh Road, Ludhiana, Punjab 141010", balance: 89000.00 },
    { code: "VEN-003", name: "Raymond Apparel Lifestyle", gstin: "27AAACR9012M1Z8", state: "Maharashtra", phone: "+91 22 4036 7000", address: "Pokhran Road No 1, Thane, Maharashtra 400606", balance: 320000.00 },
    { code: "VEN-004", name: "Bombay Dyeing & Mfg Co", gstin: "27AAACB3456L1Z4", state: "Maharashtra", phone: "+91 22 6660 0000", address: "Neville House, Ballard Estate, Mumbai 400001", balance: 54000.00 }
  ]);

  // Granular Item Master Registries
  const [articlesList] = useState<any[]>([
    { code: "ART-OXF-01", name: "Oxford Button-Down Executive Shirt", category: "Apparel", brand: "Oxford Club", season: "SS26", mrp: 1999.00 },
    { code: "ART-DNM-02", name: "Selvedge Raw Denim Slim Jeans", category: "Apparel", brand: "SMRITI", season: "AW26", mrp: 2999.00 },
    { code: "ART-POLO-03", name: "Supima Pique Cotton Polo Tee", category: "Apparel", brand: "Urban Street", season: "SS26", mrp: 1299.00 },
    { code: "ART-LIN-04", name: "Mandarin Collar Pure Linen Tunic", category: "Apparel", brand: "SMRITI", season: "SS26", mrp: 2499.00 }
  ]);

  const [colorsList] = useState<any[]>([
    { code: "CLR-BEG", name: "Med Beige", shade: "Earthy Neutrals", hex: "#D2B48C", group: "Beige / Khaki" },
    { code: "CLR-IND", name: "Dark Indigo", shade: "Deep Blues", hex: "#1A2B4C", group: "Navy / Blue" },
    { code: "CLR-SKY", name: "Sky Blue", shade: "Pastel Blues", hex: "#87CEEB", group: "Pastels" },
    { code: "CLR-WHT", name: "Pure Optical White", shade: "Whites", hex: "#FFFFFF", group: "Whites" },
    { code: "CLR-BLK", name: "Midnight Raven Black", shade: "Monochrome", hex: "#121212", group: "Blacks" },
    { code: "CLR-OLV", name: "Military Olive Green", shade: "Greens", hex: "#556B2F", group: "Greens" },
    { code: "CLR-CHR", name: "Charcoal Heather Grey", shade: "Greys", hex: "#36454F", group: "Greys" }
  ]);

  const [sizesList] = useState<any[]>([
    { code: "28", name: "Waist 28 / XS", scale: "Waist Inches", standard: "UK/IN 28", sortOrder: 1 },
    { code: "30", name: "Waist 30 / S", scale: "Waist Inches", standard: "UK/IN 30", sortOrder: 2 },
    { code: "32", name: "Waist 32 / M", scale: "Waist Inches", standard: "UK/IN 32", sortOrder: 3 },
    { code: "34", name: "Waist 34 / L", scale: "Waist Inches", standard: "UK/IN 34", sortOrder: 4 },
    { code: "36", name: "Waist 36 / XL", scale: "Waist Inches", standard: "UK/IN 36", sortOrder: 5 },
    { code: "38", name: "Waist 38 / XXL", scale: "Waist Inches", standard: "UK/IN 38", sortOrder: 6 },
    { code: "40", name: "Waist 40 / 3XL", scale: "Waist Inches", standard: "UK/IN 40", sortOrder: 7 },
    { code: "M", name: "Medium Regular", scale: "Alpha Standard", standard: "Global M", sortOrder: 10 },
    { code: "L", name: "Large Regular", scale: "Alpha Standard", standard: "Global L", sortOrder: 11 }
  ]);

  const [brandsList] = useState<any[]>([
    { code: "BRD-SMRITI", name: "SMRITI Heritage", origin: "India", tier: "Luxury Premium", status: "Active" },
    { code: "BRD-OXFORD", name: "Oxford Club", origin: "United Kingdom", tier: "Formal Executive", status: "Active" },
    { code: "BRD-URBAN", name: "Urban Street Athleisure", origin: "India", tier: "Casual Lifestyle", status: "Active" },
    { code: "BRD-RAYMOND", name: "Raymond Fine Tailoring", origin: "India", tier: "Heritage Luxury", status: "Active" }
  ]);

  const [departmentsList] = useState<any[]>([
    { code: "DEPT-APP", name: "Apparel & Ready-To-Wear", division: "Fashion Division", description: "Men, Women, Kids clothing" },
    { code: "DEPT-FTW", name: "Footwear & Leather Goods", division: "Accessories", description: "Formal, Sports, Casual shoes" },
    { code: "DEPT-ACC", name: "Accessories & Lifestyle", division: "Accessories", description: "Belts, Wallets, Ties, Caps" }
  ]);

  const [sectionsList] = useState<any[]>([
    { code: "SEC-MENS", name: "Men's Apparel & Suiting", targetAudience: "Adult Men (18-60)", deptCode: "DEPT-APP" },
    { code: "SEC-WMNS", name: "Women's Western & Ethnic", targetAudience: "Adult Women (18-60)", deptCode: "DEPT-APP" },
    { code: "SEC-KIDS", name: "Boys & Girls Collection", targetAudience: "Kids (2-14)", deptCode: "DEPT-APP" }
  ]);

  const [fabricsList] = useState<any[]>([
    { code: "FAB-LINEN", name: "Pure Irish Linen", composition: "100% Flax Linen", weave: "Plain Plain", gsm: 165 },
    { code: "FAB-GIZA", name: "Egyptian Giza Cotton", composition: "100% Extra Long Staple Cotton", weave: "Twill 2/1", gsm: 140 },
    { code: "FAB-DNM", name: "Selvedge Ring Denim", composition: "98% Cotton 2% Spandex", weave: "Right Hand Twill", gsm: 380 },
    { code: "FAB-POLY", name: "Poly-Viscose Wool Blend", composition: "65% Poly 35% Viscose", weave: "Herringbone", gsm: 240 }
  ]);

  const [fitsList] = useState<any[]>([
    { code: "FIT-SLIM", name: "Slim Fit Contour", cutType: "Tapered Waist & Arms", description: "Modern body-hugging profile" },
    { code: "FIT-REG", name: "Regular Comfort Fit", cutType: "Straight Drop", description: "Classic traditional relaxed fit" },
    { code: "FIT-RLX", name: "Relaxed Loose Fit", cutType: "Oversized Boxy", description: "Casual street silhouette" }
  ]);

  const [seasonsList] = useState<any[]>([
    { code: "SS26", name: "Spring Summer 2026", year: 2026, status: "Active Season" },
    { code: "AW26", name: "Autumn Winter 2026", year: 2026, status: "Upcoming Season" },
    { code: "CORE", name: "Core Never-Out-Of-Stock (NOOS)", year: "All-Year", status: "Perennial" }
  ]);

  const [uomList] = useState<any[]>([
    { code: "PCS", name: "Pieces / Units", type: "Discrete Quantity", decimalPlaces: 0 },
    { code: "MTR", name: "Meters (Running Length)", type: "Continuous Linear", decimalPlaces: 2 },
    { code: "KGS", name: "Kilograms (Weight)", type: "Mass / Weight", decimalPlaces: 3 },
    { code: "PAIR", name: "Pairs (Shoes/Socks)", type: "Discrete Pair", decimalPlaces: 0 },
    { code: "BOX", name: "Boxes / Multi-pack", type: "Packaging Group", decimalPlaces: 0 }
  ]);

  const [storesList] = useState<any[]>([
    { code: "STR-001", name: "SMRITI Flagship — Bandra West", city: "Mumbai", state: "Maharashtra", address: "14 Linking Road, Bandra West, Mumbai 400050", posCount: 4, status: "Active" },
    { code: "STR-002", name: "SMRITI Heritage — Connaught Place", city: "New Delhi", state: "Delhi", address: "Block B, Inner Circle, CP, New Delhi 110001", posCount: 6, status: "Active" },
    { code: "STR-003", name: "SMRITI Express — Indiranagar", city: "Bengaluru", state: "Karnataka", address: "100 Feet Road, HAL 2nd Stage, Bengaluru 560038", posCount: 3, status: "Active" }
  ]);

  const [hsnList] = useState<any[]>([
    { code: "61091000", desc: "T-Shirts, Singlets of Cotton", gstPct: 5.0 },
    { code: "62034200", desc: "Men's Trousers / Jeans of Cotton", gstPct: 12.0 },
    { code: "62044200", desc: "Women's Dresses of Cotton", gstPct: 12.0 },
    { code: "64039990", desc: "Footwear with Leather Outer Soles", gstPct: 18.0 }
  ]);

  const [staffList] = useState<any[]>([
    { code: "SM1", name: "Rahul Verma", role: "Senior Sales Associate", counter: "Men's Apparel" },
    { code: "SM2", name: "Pooja Sharma", role: "Stylist & Cashier", counter: "Women's Section" },
    { code: "SM3", name: "Amitabh Sen", role: "Store Floor Executive", counter: "Footwear & Accessories" },
    { code: "CSH1", name: "Sunil Nair", role: "Lead Cashier", counter: "Billing Terminal 01" }
  ]);

  const [schemesList] = useState<any[]>([
    { code: "ILD", name: "Item Level Discount (Configurable %)", type: "Line Discount", value: "Custom %", validity: "Always Active" },
    { code: "B2G1", name: "Buy 2 Get 1 Free Promo", type: "Quantity Scheme", value: "100% on 3rd item", validity: "Active" },
    { code: "FLAT10", name: "Flat 10% Festive Clearance", type: "Percentage", value: "10.00% Off", validity: "Active" }
  ]);

  const [termsList] = useState<any[]>([
    { code: "NET-30", name: "Net 30 Days Commercial Credit", creditDays: 30, interestPct: 18.0 },
    { code: "NET-60", name: "Net 60 Days Vendor Payment", creditDays: 60, interestPct: 18.0 },
    { code: "COD", name: "Cash / Advance Payment on Delivery", creditDays: 0, interestPct: 0.0 }
  ]);

  const [page, setPage] = useState<number>(1);
  const pageSize = 12;

  // Sync category on open
  useEffect(() => {
    if (isF2ModalOpen) {
      let mapped = category || "product";
      if (mapped === "general") mapped = "product";
      setActiveTab(mapped);
      setSelectedRowIndex(0);
      setAnyColumnFilter(fieldValue || "");
      setBottomSearchVal(fieldValue || "");
    }
  }, [isF2ModalOpen, category, fieldValue]);

  // Load Data
  useEffect(() => {
    if (!isF2ModalOpen) return;
    const token = typeof window !== "undefined" ? (localStorage.getItem("smriti_jwt_token") || localStorage.getItem("smriti_session_token")) : null;
    if (!token) return;

    const loadData = async () => {
      try {
        const prodResp = await apiFetchV1<any>("/products?page_size=100");
        const rawItems = Array.isArray(prodResp) ? prodResp : (prodResp?.items || []);
        if (rawItems.length > 0) {
          setProductsList(rawItems.map((p: any) => ({
            id: p.id || p.sku,
            sku: p.sku || p.code || p.barcode,
            barcode: p.barcode || p.sku,
            name: p.name || p.product_name || `Item ${p.sku}`,
            category: p.category || "Apparel",
            size: p.size || "32",
            color: p.color || "Beige",
            brand: p.brand || "SMRITI",
            selling_price: parseFloat(p.selling_price || p.price) || 999.00,
            mrp: parseFloat(p.mrp) || 999.00,
            stock: p.stock !== undefined ? p.stock : 45,
            imageUrl: p.imageUrl || p.image_url || null
          })));
        } else {
          setProductsList([
            { id: "1", sku: "8887462974641", barcode: "8887462974641", name: "regular straight Med Beige", category: "Apparel", size: "32", color: "Beige", brand: "SMRITI", selling_price: 999.00, mrp: 999.00, stock: 45, imageUrl: null },
            { id: "2", sku: "8887462974825", barcode: "8887462974825", name: "regular straight Med Beige", category: "Apparel", size: "34", color: "Beige", brand: "SMRITI", selling_price: 999.00, mrp: 999.00, stock: 32, imageUrl: null },
            { id: "3", sku: "SKU-OXF-001", barcode: "8901234567890", name: "Oxford Cotton Executive Shirt", category: "Apparel", size: "40", color: "Sky Blue", brand: "Oxford Club", selling_price: 1499.00, mrp: 1999.00, stock: 60, imageUrl: null },
            { id: "4", sku: "SKU-DNM-002", barcode: "8909876543210", name: "Slim Fit Raw Denim Jeans", category: "Apparel", size: "32", color: "Dark Indigo", brand: "SMRITI", selling_price: 2499.00, mrp: 2999.00, stock: 28, imageUrl: null }
          ]);
        }
      } catch (e) {
        console.warn("F2 items load fallback", e);
      }

      try {
        const custs = getCustomers();
        if (custs && custs.length > 0) {
          setCustomersList(custs);
        } else {
          setCustomersList([
            { code: "C01", name: "Customer01 (Walk-in)", phone: "9876543210", loyaltyTier: "Gold", loyaltyPoints: 1200, currentBalance: 0, gstin: "", address: "Walk-in Retail Counter, Store 01" },
            { code: "C02", name: "Vikram Malhotra", phone: "9820011223", loyaltyTier: "Platinum", loyaltyPoints: 4500, currentBalance: 12500.00, gstin: "27AAAPM1234K1Z1", address: "Flat 402, Sea Green Apts, Worli, Mumbai 400018" },
            { code: "C03", name: "Ananya Deshmukh", phone: "9819988776", loyaltyTier: "Gold", loyaltyPoints: 2300, currentBalance: 0, gstin: "", address: "B-12, Green Acres, Viman Nagar, Pune 411014" }
          ]);
        }
      } catch (e) {
        console.warn("F2 customers load fallback", e);
      }
    };

    loadData();
  }, [isF2ModalOpen]);

  // Current active columns
  const currentColumns = useMemo(() => {
    return columns[activeTab] || DEFAULT_COLUMNS[activeTab] || DEFAULT_COLUMNS.product;
  }, [columns, activeTab]);

  // Move column Up/Down
  const handleMoveColumn = (index: number, direction: "UP" | "DOWN") => {
    const targetIdx = direction === "UP" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= currentColumns.length) return;

    setColumns(prev => {
      const nextCols = [...(prev[activeTab] || DEFAULT_COLUMNS[activeTab])];
      const temp = nextCols[index];
      nextCols[index] = nextCols[targetIdx];
      nextCols[targetIdx] = temp;
      return { ...prev, [activeTab]: nextCols };
    });
  };

  // Toggle column visibility
  const handleToggleColumnVisibility = (index: number) => {
    setColumns(prev => {
      const nextCols = [...(prev[activeTab] || DEFAULT_COLUMNS[activeTab])];
      nextCols[index] = { ...nextCols[index], visible: !nextCols[index].visible };
      return { ...prev, [activeTab]: nextCols };
    });
  };

  // Save Settings
  const handleSaveSettings = () => {
    try {
      localStorage.setItem("smriti_f2_browse_columns", JSON.stringify(columns));
      alert("Search & display column settings saved successfully.");
    } catch (e) {
      console.error(e);
    }
  };

  // Apply Default Settings
  const handleApplyDefault = () => {
    setColumns(prev => ({ ...prev, [activeTab]: DEFAULT_COLUMNS[activeTab] }));
    setColumnFilters({});
    setAnyColumnFilter("");
    setBottomSearchVal("");
  };

  // Clear Filters
  const handleClearFilters = () => {
    setColumnFilters({});
    setAnyColumnFilter("");
    setBottomSearchVal("");
  };

  // Raw dataset based on active category
  const rawDataset = useMemo(() => {
    switch (activeTab) {
      case "product": return productsList;
      case "article": return articlesList;
      case "color": return colorsList;
      case "size": return sizesList;
      case "brand": return brandsList;
      case "department": return departmentsList;
      case "section": return sectionsList;
      case "fabric": return fabricsList;
      case "fit": return fitsList;
      case "season": return seasonsList;
      case "uom": return uomList;
      case "supplier": return suppliersList;
      case "customer": return customersList;
      case "store": return storesList;
      case "hsn": return hsnList;
      case "staff": return staffList;
      case "scheme": return schemesList;
      case "terms": return termsList;
      default: return productsList;
    }
  }, [activeTab, productsList, articlesList, colorsList, sizesList, brandsList, departmentsList, sectionsList, fabricsList, fitsList, seasonsList, uomList, suppliersList, customersList, storesList, hsnList, staffList, schemesList, termsList]);

  // Filtered & Hierarchically Sorted Records
  const filteredRecords = useMemo(() => {
    let list = [...rawDataset];

    // 1. [Any Column] Filter
    if (anyColumnFilter.trim()) {
      const q = anyColumnFilter.toLowerCase().trim();
      list = list.filter(row => {
        return Object.values(row).some(val => 
          val !== null && val !== undefined && String(val).toLowerCase().includes(q)
        );
      });
    }

    // 2. Hierarchical Per-Column Filter Criteria
    currentColumns.forEach(col => {
      const filter = columnFilters[col.key];
      if (filter && filter.value.trim()) {
        const val = filter.value.toLowerCase().trim();
        list = list.filter(row => {
          const rawVal = row[col.key];
          if (rawVal === undefined || rawVal === null) return false;
          const sVal = String(rawVal).toLowerCase();

          switch (filter.condition) {
            case "Equal": return sVal === val;
            case "Starts With": return sVal.startsWith(val);
            case "Greater Than": return parseFloat(sVal) > parseFloat(val);
            case "Less Than": return parseFloat(sVal) < parseFloat(val);
            case "Contains":
            default:
              return sVal.includes(val);
          }
        });
      }
    });

    // 3. Bottom Search Strip Filter
    if (bottomSearchVal.trim()) {
      const q = bottomSearchVal.toLowerCase().trim();
      if (bottomSearchCol === "all") {
        list = list.filter(row => 
          Object.values(row).some(v => v && String(v).toLowerCase().includes(q))
        );
      } else {
        list = list.filter(row => {
          const v = row[bottomSearchCol];
          return v && String(v).toLowerCase().includes(q);
        });
      }
    }

    return list;
  }, [rawDataset, anyColumnFilter, columnFilters, currentColumns, bottomSearchVal, bottomSearchCol]);

  // Paginated records
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const paginatedRecords = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, page, pageSize]);

  // Active Selected Item for the Preview / Picture Box
  const activeSelectedItem = useMemo(() => {
    if (paginatedRecords.length > 0 && selectedRowIndex < paginatedRecords.length) {
      return paginatedRecords[selectedRowIndex];
    }
    return paginatedRecords[0] || null;
  }, [paginatedRecords, selectedRowIndex]);

  // Commit and Accept selection into active host field
  const handleCommitSelection = (record?: any) => {
    const item = record || activeSelectedItem;
    if (!item) return;

    let targetVal = "";
    if (activeTab === "product") targetVal = item.sku || item.code || item.barcode;
    else if (activeTab === "article") targetVal = item.code || item.name;
    else if (activeTab === "color") targetVal = item.name || item.code;
    else if (activeTab === "size") targetVal = item.code || item.name;
    else if (activeTab === "brand") targetVal = item.name || item.code;
    else if (activeTab === "department") targetVal = item.name || item.code;
    else if (activeTab === "section") targetVal = item.name || item.code;
    else if (activeTab === "fabric") targetVal = item.name || item.code;
    else if (activeTab === "fit") targetVal = item.name || item.code;
    else if (activeTab === "season") targetVal = item.code || item.name;
    else if (activeTab === "uom") targetVal = item.code;
    else if (activeTab === "supplier") targetVal = item.code || item.name;
    else if (activeTab === "customer") targetVal = item.code || item.phone || item.name;
    else if (activeTab === "store") targetVal = item.code || item.name;
    else if (activeTab === "hsn") targetVal = item.code;
    else if (activeTab === "staff") targetVal = item.code;
    else if (activeTab === "scheme") targetVal = item.code;
    else if (activeTab === "terms") targetVal = item.code;
    else targetVal = item.code || item.name || item.id || "";

    insertValueIntoActiveField(targetVal);
    closeF2Modal();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedRowIndex(prev => (prev + 1 < paginatedRecords.length ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedRowIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleCommitSelection();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeF2Modal();
    }
  };

  const token = typeof window !== "undefined" ? (localStorage.getItem("smriti_jwt_token") || localStorage.getItem("smriti_session_token")) : null;
  if (!isF2ModalOpen || !token) return null;

  return (
    <div 
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 select-none animate-fadeIn font-sans"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] w-full max-w-6xl h-[92vh] rounded-2xl shadow-2xl border border-[#c4c5d5] dark:border-[#444653] overflow-hidden flex flex-col">
        
        {/* ========================================================================= */}
        {/* 1. TOP HEADER & CATEGORY RIBBON                                           */}
        {/* ========================================================================= */}
        <header className="px-4 py-2.5 bg-[#edeae1] dark:bg-[#131b2e] border-b border-[#c4c5d5] dark:border-[#444653] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-[#00288e] text-white rounded-lg shadow-xs">
              <Filter size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight text-[#191c1d] dark:text-white">
                  Universal Master Browse &amp; Lookup Engine
                </h2>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#00288e] text-white">
                  F2 Active
                </span>
              </div>
              <p className="text-[11px] text-[#565e74] dark:text-[#bec6e0]">
                Active Field: <span className="font-bold text-[#00288e] dark:text-[#a8b8ff]">{fieldLabel}</span> ({fieldName || "Target"})
              </p>
            </div>
          </div>

          {/* Master Categories Switcher Tabs */}
          <div className="flex items-center gap-1 bg-[#f3f4f5] dark:bg-[#1d222e] p-1 rounded-xl border border-[#c4c5d5] dark:border-[#444653] overflow-x-auto max-w-[620px]">
            {[
              { id: "supplier", label: "Supplier / Party", icon: Building2 },
              { id: "product", label: "Stock / Items", icon: Package },
              { id: "article", label: "Article / Style", icon: Tag },
              { id: "color", label: "Color / Shade", icon: Palette },
              { id: "size", label: "Size", icon: Ruler },
              { id: "brand", label: "Brand", icon: Tag },
              { id: "department", label: "Department", icon: Layers },
              { id: "section", label: "Section", icon: Scissors },
              { id: "fabric", label: "Fabric", icon: Layers },
              { id: "fit", label: "Fit", icon: Scissors },
              { id: "season", label: "Season", icon: Sun },
              { id: "uom", label: "UOM", icon: Scale },
              { id: "customer", label: "Customer", icon: Users },
              { id: "store", label: "Chain Stores", icon: Store },
              { id: "hsn", label: "HSN / GST", icon: Hash },
              { id: "staff", label: "Sales Staff", icon: UserCheck },
              { id: "scheme", label: "Scheme / Promo", icon: Percent },
              { id: "terms", label: "Terms", icon: FileText }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setPage(1);
                    setSelectedRowIndex(0);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "bg-[#00288e] text-white shadow-xs"
                      : "text-[#565e74] dark:text-[#bec6e0] hover:bg-[#edeae1] dark:hover:bg-[#2d3133]"
                  }`}
                >
                  <Icon size={12} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={closeF2Modal}
            className="text-[#565e74] hover:bg-[#f3f4f5] p-1.5 rounded-lg transition cursor-pointer"
            title="Close [Esc]"
          >
            <X size={18} />
          </button>
        </header>

        {/* ========================================================================= */}
        {/* 2. SPLIT WORKSPACE: Display/Search Selection (Left) + Grid & Picture (Right)*/}
        {/* ========================================================================= */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Panel: Display / Search Selection (Hierarchical Criteria) */}
          {showFilterPanel && (
            <aside className="w-80 bg-[#f8f9fa] dark:bg-[#131b2e] border-r border-[#c4c5d5] dark:border-[#444653] flex flex-col shrink-0 overflow-hidden shadow-inner">
              <div className="p-2.5 bg-[#edeae1] dark:bg-[#1d222e] border-b border-[#c4c5d5] dark:border-[#444653] flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#00288e] dark:text-[#a8b8ff]">
                  Display / Search Selection
                </span>
                <button
                  type="button"
                  onClick={() => setShowFilterPanel(false)}
                  className="text-[10px] font-bold text-[#565e74] hover:underline flex items-center gap-0.5 cursor-pointer"
                  title="Hide Display / Search Selection"
                >
                  <span>&lt;&lt; Hide</span>
                </button>
              </div>

              {/* Any Column Global Filter Box */}
              <div className="p-2.5 bg-white dark:bg-[#191c1e] border-b border-[#c4c5d5] dark:border-[#444653] space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0] flex items-center gap-1">
                  <Filter size={10} />
                  <span>[Any Column] Filter</span>
                </label>
                <input
                  type="text"
                  value={anyColumnFilter}
                  onChange={e => {
                    setAnyColumnFilter(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Filter across any column..."
                  className="w-full h-7 px-2 bg-[#f8f9fa] dark:bg-[#131b2e] border border-[#c4c5d5] dark:border-[#444653] rounded text-xs outline-none focus:border-[#00288e]"
                />
              </div>

              {/* Column Selection & Hierarchical Criteria Table */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                <p className="text-[10px] text-[#565e74] dark:text-[#bec6e0] italic px-1">
                  Reorder using ▲/▼ to change hierarchical filtering sequence:
                </p>

                {currentColumns.map((col, idx) => {
                  const filter = columnFilters[col.key] || { condition: "Contains", value: "" };
                  return (
                    <div 
                      key={col.key} 
                      className={`p-2 rounded-lg border transition space-y-1 ${
                        col.visible 
                          ? "bg-white dark:bg-[#191c1e] border-[#c4c5d5] dark:border-[#444653]" 
                          : "bg-[#f3f4f5]/60 dark:bg-[#191c1e]/40 border-dashed border-[#c4c5d5]/60 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold">
                          <input
                            type="checkbox"
                            checked={col.visible}
                            onChange={() => handleToggleColumnVisibility(idx)}
                            className="rounded text-[#00288e]"
                          />
                          <span className="truncate max-w-[140px]">{col.label}</span>
                        </label>

                        {/* Order Buttons */}
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveColumn(idx, "UP")}
                            className="p-1 text-gray-500 hover:text-[#00288e] disabled:opacity-20 cursor-pointer"
                            title="Move Up"
                          >
                            <ArrowUp size={11} />
                          </button>
                          <button
                            type="button"
                            disabled={idx === currentColumns.length - 1}
                            onClick={() => handleMoveColumn(idx, "DOWN")}
                            className="p-1 text-gray-500 hover:text-[#00288e] disabled:opacity-20 cursor-pointer"
                            title="Move Down"
                          >
                            <ArrowDown size={11} />
                          </button>
                        </div>
                      </div>

                      {/* Filter Condition & Value */}
                      <div className="flex gap-1 items-center pt-0.5">
                        <select
                          value={filter.condition}
                          onChange={e => {
                            setColumnFilters(prev => ({
                              ...prev,
                              [col.key]: { ...filter, condition: e.target.value as any }
                            }));
                            setPage(1);
                          }}
                          className="h-6 px-1 text-[10px] font-semibold border border-[#c4c5d5] dark:border-[#444653] rounded bg-[#f8f9fa] dark:bg-[#131b2e] outline-none"
                        >
                          <option value="Contains">Contains</option>
                          <option value="Equal">Equal</option>
                          <option value="Starts With">Starts With</option>
                          <option value="Greater Than">&gt; (Greater)</option>
                          <option value="Less Than">&lt; (Less)</option>
                        </select>

                        <input
                          type="text"
                          value={filter.value}
                          onChange={e => {
                            setColumnFilters(prev => ({
                              ...prev,
                              [col.key]: { ...filter, value: e.target.value }
                            }));
                            setPage(1);
                          }}
                          placeholder="Value..."
                          className="flex-1 h-6 px-1.5 text-[11px] border border-[#c4c5d5] dark:border-[#444653] rounded bg-white dark:bg-[#131b2e] outline-none focus:border-[#00288e]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Settings Action Buttons */}
              <div className="p-2 border-t border-[#c4c5d5] dark:border-[#444653] bg-[#edeae1] dark:bg-[#1d222e] flex justify-between gap-1.5">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="flex-1 py-1 px-2 bg-white dark:bg-[#2d3133] border border-[#c4c5d5] dark:border-[#444653] hover:bg-[#f3f4f5] text-[11px] font-bold rounded flex items-center justify-center gap-1 cursor-pointer"
                  title="Save column configuration"
                >
                  <Save size={11} />
                  <span>Save</span>
                </button>

                <button
                  type="button"
                  onClick={handleApplyDefault}
                  className="flex-1 py-1 px-2 bg-white dark:bg-[#2d3133] border border-[#c4c5d5] dark:border-[#444653] hover:bg-[#f3f4f5] text-[11px] font-bold rounded flex items-center justify-center gap-1 cursor-pointer"
                  title="Revert to defaults"
                >
                  <RotateCcw size={11} />
                  <span>Default</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="py-1 px-2 bg-[#ffdad6] text-[#ba1a1a] text-[11px] font-bold rounded hover:brightness-95 cursor-pointer"
                  title="Clear all filter inputs"
                >
                  Clear
                </button>
              </div>
            </aside>
          )}

          {/* Collapsed Panel Reopen Button */}
          {!showFilterPanel && (
            <div className="bg-[#edeae1] dark:bg-[#1d222e] border-r border-[#c4c5d5] dark:border-[#444653] p-1 flex flex-col justify-start">
              <button
                type="button"
                onClick={() => setShowFilterPanel(true)}
                className="p-1 text-xs font-bold text-[#00288e] hover:bg-white dark:hover:bg-[#2d3133] rounded transition cursor-pointer"
                title="Show Display / Search Selection"
              >
                &gt;&gt;
              </button>
            </div>
          )}

          {/* Right Main Area: Picture/Address Area (Top) + Search Result Grid (Center) */}
          <main className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#131b2e]">
            
            {/* Top Right: Picture & Info Header Area */}
            <section className="bg-[#f8f9fa] dark:bg-[#191c1e] p-3 border-b border-[#c4c5d5] dark:border-[#444653] flex items-center justify-between gap-4 shrink-0 shadow-2xs">
              
              {/* Context Summary */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#00288e] dark:text-[#a8b8ff] uppercase tracking-wider">
                    {activeTab === "product" || activeTab === "article" ? "Item / Style Details & Picture" : "Master Entity Details"}
                  </span>
                  {activeSelectedItem && (
                    <span className="text-xs font-mono font-bold px-2 py-0.5 bg-[#edeae1] dark:bg-[#252836] rounded text-[#191c1d] dark:text-white">
                      {activeSelectedItem.sku || activeSelectedItem.code}
                    </span>
                  )}
                </div>

                {activeSelectedItem ? (
                  <div className="mt-1 text-xs space-y-0.5">
                    <p className="font-bold text-sm text-[#191c1d] dark:text-white truncate">
                      {activeSelectedItem.name}
                    </p>
                    <p className="text-[11px] text-[#565e74] dark:text-[#bec6e0] truncate">
                      {activeSelectedItem.address || activeSelectedItem.description || activeSelectedItem.specification || `${activeSelectedItem.category || ''} • ${activeSelectedItem.brand || ''} • Size: ${activeSelectedItem.size || activeSelectedItem.code || ''}`}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic mt-1">No row selected</p>
                )}
              </div>

              {/* Picture Thumbnail / Color Swatch / Address Badge */}
              <div className="w-36 h-20 bg-white dark:bg-[#131b2e] border border-[#c4c5d5] dark:border-[#444653] rounded-xl flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                {activeTab === "product" || activeTab === "article" ? (
                  activeSelectedItem?.imageUrl ? (
                    <img src={activeSelectedItem.imageUrl} alt="Item" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-[#565e74] gap-1">
                      <ImageIcon size={22} className="opacity-40" />
                      <span className="text-[10px] font-bold font-mono">PICTURE</span>
                    </div>
                  )
                ) : activeTab === "color" && activeSelectedItem?.hex ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center" style={{ backgroundColor: activeSelectedItem.hex }}>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-black/60 text-white rounded">
                      {activeSelectedItem.hex}
                    </span>
                  </div>
                ) : (
                  <div className="p-2 text-center text-[#565e74] flex flex-col items-center justify-center gap-0.5">
                    <MapPin size={16} className="text-[#00288e] dark:text-[#a8b8ff]" />
                    <span className="text-[10px] font-bold">{activeSelectedItem?.state || activeSelectedItem?.city || "Registered"}</span>
                  </div>
                )}
              </div>

            </section>

            {/* Main Search Result Grid */}
            <div className="flex-1 overflow-auto bg-white dark:bg-[#131b2e]">
              <table className="w-full text-left border-collapse text-xs whitespace-nowrap min-w-[750px]">
                <thead className="bg-[#edeae1] dark:bg-[#252836] sticky top-0 z-10 border-b border-[#c4c5d5] dark:border-[#444653] text-[11px] font-bold text-[#444653] dark:text-[#bec6e0]">
                  <tr className="h-8">
                    {currentColumns.filter(c => c.visible).map(col => (
                      <th
                        key={col.key}
                        className={`px-3 border-r border-[#c4c5d5] dark:border-[#444653] ${
                          col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                        } ${col.width || ""}`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eceef0] dark:divide-[#2d3133] font-mono text-[11px]">
                  {paginatedRecords.length === 0 ? (
                    <tr>
                      <td 
                        colSpan={currentColumns.filter(c => c.visible).length}
                        className="py-12 text-center text-xs text-[#565e74] dark:text-[#bec6e0]"
                      >
                        No records match the active search and filter criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedRecords.map((row, idx) => {
                      const isSelected = selectedRowIndex === idx;
                      const rowKey = row.id || row.code || row.sku || idx;
                      return (
                        <tr
                          key={rowKey}
                          onClick={() => setSelectedRowIndex(idx)}
                          onDoubleClick={() => handleCommitSelection(row)}
                          className={`h-7 cursor-pointer transition ${
                            isSelected
                              ? "bg-[#ffffcc] dark:bg-[#3a3a1a] text-black dark:text-yellow-200 font-semibold border-l-4 border-[#00288e]"
                              : "hover:bg-[#f8f9fa] dark:hover:bg-[#1d222e]"
                          }`}
                        >
                          {currentColumns.filter(c => c.visible).map(col => {
                            const val = row[col.key];
                            return (
                              <td
                                key={col.key}
                                className={`px-3 border-r border-[#c4c5d5] dark:border-[#444653] ${
                                  col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                                } ${col.key === "name" || col.key === "description" ? "font-sans font-medium" : ""}`}
                              >
                                {col.key === "hex" && row.hex ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <span className="w-3.5 h-3.5 rounded-full border border-gray-300 inline-block" style={{ backgroundColor: row.hex }}></span>
                                    <span>{row.hex}</span>
                                  </div>
                                ) : typeof val === "number" ? (
                                  col.key.includes("price") || col.key.includes("mrp") || col.key.includes("Balance") || col.key.includes("balance")
                                    ? `₹${val.toFixed(2)}`
                                    : val
                                ) : (
                                  val || "-"
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Search Strip & Pagination Controls */}
            <div className="bg-[#edeae1] dark:bg-[#1d222e] p-2 border-t border-[#c4c5d5] dark:border-[#444653] flex flex-wrap items-center justify-between gap-2 shrink-0">
              
              {/* Fast Search Column Dropdown & Input */}
              <div className="flex items-center gap-1.5 flex-1 max-w-lg">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">
                  Search:
                </span>
                <select
                  value={bottomSearchCol}
                  onChange={e => setBottomSearchCol(e.target.value)}
                  className="h-7 px-1.5 text-xs font-semibold border border-[#c4c5d5] dark:border-[#444653] rounded bg-white dark:bg-[#131b2e] outline-none"
                >
                  <option value="all">[Any Column]</option>
                  {currentColumns.filter(c => c.visible).map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>

                <input
                  type="text"
                  value={bottomSearchVal}
                  onChange={e => {
                    setBottomSearchVal(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Locate value in column..."
                  className="flex-1 h-7 px-2 text-xs border border-[#c4c5d5] dark:border-[#444653] rounded bg-white dark:bg-[#131b2e] outline-none focus:border-[#00288e]"
                />
              </div>

              {/* Pagination Controls (Previous / Next) */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[11px] text-[#565e74] dark:text-[#bec6e0] font-mono">
                  Page {page} of {totalPages} ({filteredRecords.length} records)
                </span>

                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  className="h-7 px-2.5 bg-white dark:bg-[#2d3133] border border-[#c4c5d5] dark:border-[#444653] rounded hover:bg-[#f3f4f5] disabled:opacity-30 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft size={13} />
                  <span>Prev</span>
                </button>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  className="h-7 px-2.5 bg-white dark:bg-[#2d3133] border border-[#c4c5d5] dark:border-[#444653] rounded hover:bg-[#f3f4f5] disabled:opacity-30 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight size={13} />
                </button>
              </div>

            </div>

          </main>

        </div>

        {/* ========================================================================= */}
        {/* 3. FOOTER ACTIONS BAR: Ok / Cancel                                        */}
        {/* ========================================================================= */}
        <footer className="px-4 py-2.5 bg-[#f8f9fa] dark:bg-[#131b2e] border-t border-[#c4c5d5] dark:border-[#444653] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <kbd className="px-2 py-0.5 bg-white dark:bg-[#2d3133] border border-[#c4c5d5] dark:border-[#444653] rounded text-[11px] font-mono font-bold text-[#00288e] dark:text-[#a8b8ff] shadow-2xs">
              [↑/↓: Navigate] [Enter: Ok] [Esc: Cancel]
            </kbd>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={closeF2Modal}
              className="px-4 py-1.5 bg-white dark:bg-[#2d3133] border border-[#c4c5d5] dark:border-[#444653] hover:bg-[#f3f4f5] text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Cancel [Esc]
            </button>

            <button
              type="button"
              disabled={!activeSelectedItem}
              onClick={() => handleCommitSelection()}
              className="px-5 py-1.5 bg-[#00288e] hover:bg-[#1e40af] text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-md disabled:opacity-40 cursor-pointer active:scale-95"
            >
              <CornerDownLeft size={13} />
              <span>Ok [Enter]</span>
            </button>
          </div>
        </footer>

      </div>
    </div>
  );
};

export default GlobalF2BrowseModal;
