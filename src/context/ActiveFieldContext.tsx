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

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from "react";
import { Product, Customer } from "../types.ts";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";
import { getCustomers } from "../services/customerStore.ts";

export type ActiveFieldCategory = 
  | "product"
  | "article"
  | "color"
  | "size"
  | "brand"
  | "department"
  | "section"
  | "fabric"
  | "fit"
  | "category"
  | "season"
  | "uom"
  | "customer"
  | "supplier"
  | "store"
  | "classification"
  | "invoice"
  | "hsn"
  | "staff"
  | "scheme"
  | "terms"
  | "general";

export interface ActiveFieldContextState {
  category: ActiveFieldCategory;
  fieldName: string;
  fieldLabel: string;
  fieldValue: string;
  element: HTMLElement | null;
  isInputFocused: boolean;
  isF2ModalOpen: boolean;
  activeProductPreview: Product | null;
  activeCustomerPreview: Customer | null;
  openF2Modal: (category?: ActiveFieldCategory, label?: string) => void;
  closeF2Modal: () => void;
  setManualCategory: (category: ActiveFieldCategory, label?: string) => void;
  insertValueIntoActiveField: (value: string | Record<string, any>) => void;
  setActiveProductPreview: (prod: Product | null) => void;
  setActiveCustomerPreview: (cust: Customer | null) => void;
}

const ActiveFieldContext = createContext<ActiveFieldContextState | undefined>(undefined);

export const useActiveField = () => {
  const context = useContext(ActiveFieldContext);
  if (!context) {
    throw new Error("useActiveField must be used within an ActiveFieldProvider");
  }
  return context;
};

/**
 * Infers the field category and human-readable label from an HTML element
 * using data attributes, name, id, placeholder, surrounding labels, and aria metadata.
 */
export function inferFieldCategory(element: HTMLElement | null): { category: ActiveFieldCategory; label: string } {
  if (!element) {
    return { category: "general", label: "Global Search" };
  }

  // 1. Check explicit data-f2-browse, data-context-type, or data-field-type attribute
  const explicitType = (
    element.getAttribute("data-f2-browse") ||
    element.getAttribute("data-context-type") || 
    element.getAttribute("data-field-type") || 
    element.getAttribute("data-lookup")
  )?.toLowerCase();

  if (explicitType) {
    if (["article", "style", "model"].includes(explicitType)) return { category: "article", label: "Article / Style Lookup" };
    if (["color", "shade", "colour"].includes(explicitType)) return { category: "color", label: "Color / Shade Lookup" };
    if (["size", "waist", "dimension"].includes(explicitType)) return { category: "size", label: "Size Lookup" };
    if (["brand"].includes(explicitType)) return { category: "brand", label: "Brand Lookup" };
    if (["department", "dept"].includes(explicitType)) return { category: "department", label: "Department Lookup" };
    if (["section", "sec"].includes(explicitType)) return { category: "section", label: "Section Lookup" };
    if (["fabric", "material"].includes(explicitType)) return { category: "fabric", label: "Fabric / Material Lookup" };
    if (["fit", "silhouette"].includes(explicitType)) return { category: "fit", label: "Fit / Cut Lookup" };
    if (["category", "subcat", "subcategory"].includes(explicitType)) return { category: "category", label: "Category Lookup" };
    if (["season"].includes(explicitType)) return { category: "season", label: "Season Lookup" };
    if (["uom", "unit"].includes(explicitType)) return { category: "uom", label: "UOM (Unit of Measure) Lookup" };
    if (["supplier", "vendor", "seller", "party", "creditor"].includes(explicitType)) return { category: "supplier", label: "Supplier / Party Lookup" };
    if (["customer", "cust", "mobile", "phone", "client", "buyer", "debtor"].includes(explicitType)) return { category: "customer", label: "Customer Lookup" };
    if (["store", "branch", "warehouse", "godown"].includes(explicitType)) return { category: "store", label: "Chain Store / Branch Lookup" };
    if (["classification", "hierarchy"].includes(explicitType)) return { category: "classification", label: "Item Classification Lookup" };
    if (["hsn", "sac", "tax", "gst"].includes(explicitType)) return { category: "hsn", label: "HSN / GST Lookup" };
    if (["staff", "salesman", "salesstaff", "cashier", "employee"].includes(explicitType)) return { category: "staff", label: "Sales Staff Lookup" };
    if (["scheme", "disc_code", "discount_code", "promo"].includes(explicitType)) return { category: "scheme", label: "Scheme / Discount Code Lookup" };
    if (["terms", "condition"].includes(explicitType)) return { category: "terms", label: "Terms & Conditions Lookup" };
    if (["product", "scan", "barcode", "item", "sku", "stockno"].includes(explicitType)) return { category: "product", label: "Scan / Product Lookup" };
  }

  // 2. Analyze element properties (name, id, placeholder, aria-label, className)
  const inputEl = element as HTMLInputElement;
  const rawIdentifiers = [
    inputEl.name,
    inputEl.id,
    inputEl.placeholder,
    inputEl.getAttribute("aria-label"),
    inputEl.className
  ].filter(Boolean).join(" ").toLowerCase();

  // Article / Style Code
  if (rawIdentifiers.includes("article") || rawIdentifiers.includes("style_no") || rawIdentifiers.includes("styleno") || rawIdentifiers.includes("style_code")) {
    return { category: "article", label: "Article / Style Code Field" };
  }

  // Color / Shade
  if (rawIdentifiers.includes("color") || rawIdentifiers.includes("colour") || rawIdentifiers.includes("shade")) {
    return { category: "color", label: "Color / Shade Field" };
  }

  // Size
  if (rawIdentifiers.includes("size") || rawIdentifiers.includes("waist") || rawIdentifiers.includes("inseam")) {
    return { category: "size", label: "Size Field" };
  }

  // Brand
  if (rawIdentifiers.includes("brand")) {
    return { category: "brand", label: "Brand Field" };
  }

  // Department
  if (rawIdentifiers.includes("dept") || rawIdentifiers.includes("department")) {
    return { category: "department", label: "Department Field" };
  }

  // Section
  if (rawIdentifiers.includes("section") || rawIdentifiers.includes("division")) {
    return { category: "section", label: "Section Field" };
  }

  // Fabric
  if (rawIdentifiers.includes("fabric") || rawIdentifiers.includes("material") || rawIdentifiers.includes("yarn")) {
    return { category: "fabric", label: "Fabric / Material Field" };
  }

  // Fit
  if (rawIdentifiers.includes("fit") || rawIdentifiers.includes("silhouette") || rawIdentifiers.includes("cut")) {
    return { category: "fit", label: "Fit / Cut Field" };
  }

  // Season
  if (rawIdentifiers.includes("season")) {
    return { category: "season", label: "Season Field" };
  }

  // UOM
  if (rawIdentifiers.includes("uom") || rawIdentifiers.includes("unit_of_measure") || rawIdentifiers.includes("unit_measure")) {
    return { category: "uom", label: "Unit of Measure (UOM) Field" };
  }

  // Supplier / Vendor / Party
  if (
    rawIdentifiers.includes("supplier") || 
    rawIdentifiers.includes("vendor") || 
    rawIdentifiers.includes("party") || 
    rawIdentifiers.includes("seller") ||
    rawIdentifiers.includes("creditor")
  ) {
    return { category: "supplier", label: "Supplier / Party Field" };
  }

  // Customer
  if (
    rawIdentifiers.includes("customer") || 
    rawIdentifiers.includes("cust") || 
    rawIdentifiers.includes("mobile") || 
    rawIdentifiers.includes("phone") || 
    rawIdentifiers.includes("client") || 
    rawIdentifiers.includes("buyer") ||
    rawIdentifiers.includes("membership") ||
    rawIdentifiers.includes("debtor")
  ) {
    return { category: "customer", label: "Customer / Mobile Field" };
  }

  // Chain Store / Branch
  if (
    rawIdentifiers.includes("store") ||
    rawIdentifiers.includes("branch") ||
    rawIdentifiers.includes("warehouse") ||
    rawIdentifiers.includes("godown") ||
    rawIdentifiers.includes("location")
  ) {
    return { category: "store", label: "Chain Store / Location Field" };
  }

  // Sales Staff
  if (
    rawIdentifiers.includes("salesman") ||
    rawIdentifiers.includes("salesstaff") ||
    rawIdentifiers.includes("staff") ||
    rawIdentifiers.includes("cashier") ||
    rawIdentifiers.includes("executive")
  ) {
    return { category: "staff", label: "Sales Staff Field" };
  }

  // Classification
  if (
    rawIdentifiers.includes("classification") ||
    rawIdentifiers.includes("hierarchy") ||
    rawIdentifiers.includes("subclass")
  ) {
    return { category: "classification", label: "Item Classification Field" };
  }

  // Scheme / Promo / Disc Code
  if (
    rawIdentifiers.includes("scheme") ||
    rawIdentifiers.includes("disccode") ||
    rawIdentifiers.includes("disc_code") ||
    rawIdentifiers.includes("promo")
  ) {
    return { category: "scheme", label: "Scheme / Discount Code Field" };
  }

  // Terms & Conditions
  if (rawIdentifiers.includes("term") || rawIdentifiers.includes("condition")) {
    return { category: "terms", label: "Terms & Conditions Field" };
  }

  // HSN / GST Code
  if (rawIdentifiers.includes("hsn") || rawIdentifiers.includes("sac") || rawIdentifiers.includes("tax_code")) {
    return { category: "hsn", label: "HSN Code Field" };
  }

  // Document / Invoice
  if (
    rawIdentifiers.includes("invoice") || 
    rawIdentifiers.includes("bill") || 
    rawIdentifiers.includes("order") || 
    rawIdentifiers.includes("po") || 
    rawIdentifiers.includes("voucher")
  ) {
    return { category: "invoice", label: "Invoice / Document Field" };
  }

  // Product / Stock No
  if (
    rawIdentifiers.includes("barcode") || 
    rawIdentifiers.includes("scan") || 
    rawIdentifiers.includes("sku") || 
    rawIdentifiers.includes("product") || 
    rawIdentifiers.includes("item") || 
    rawIdentifiers.includes("stockno") ||
    rawIdentifiers.includes("stock_no") ||
    rawIdentifiers.includes("mrp")
  ) {
    return { category: "product", label: "Product / Barcode Field" };
  }

  return { category: "general", label: inputEl.placeholder || inputEl.name || "Global Field" };
}

export const ActiveFieldProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [category, setCategory] = useState<ActiveFieldCategory>("general");
  const [fieldName, setFieldName] = useState<string>("");
  const [fieldLabel, setFieldLabel] = useState<string>("Global Search");
  const [fieldValue, setFieldValue] = useState<string>("");
  const [activeElement, setActiveElement] = useState<HTMLElement | null>(null);
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);
  const [isF2ModalOpen, setIsF2ModalOpen] = useState<boolean>(false);
  const [activeProductPreview, setActiveProductPreview] = useState<Product | null>(null);
  const [activeCustomerPreview, setActiveCustomerPreview] = useState<Customer | null>(null);

  const lastFocusedInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const openF2Modal = useCallback((cat?: ActiveFieldCategory, label?: string) => {
    if (cat) setCategory(cat);
    if (label) setFieldLabel(label);
    setIsF2ModalOpen(true);
  }, []);

  const closeF2Modal = useCallback(() => {
    setIsF2ModalOpen(false);
    setTimeout(() => {
      lastFocusedInputRef.current?.focus();
    }, 50);
  }, []);

  // Global DOM Focus and Input Tracking
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const token = typeof window !== "undefined" ? (localStorage.getItem("smriti_jwt_token") || localStorage.getItem("smriti_session_token")) : null;
      if (!token) return;

      const target = e.target as HTMLElement;
      if (!target) return;

      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (isInput) {
        lastFocusedInputRef.current = target as HTMLInputElement;
        const { category: inferredCategory, label: inferredLabel } = inferFieldCategory(target);
        const val = (target as HTMLInputElement).value || target.textContent || "";
        
        setCategory(inferredCategory);
        setFieldLabel(inferredLabel);
        setFieldName((target as HTMLInputElement).name || target.id || "active_input");
        setFieldValue(val);
        setActiveElement(target);
        setIsInputFocused(true);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      setTimeout(() => {
        const active = document.activeElement as HTMLElement;
        const isStillInput = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
        if (!isStillInput) {
          setIsInputFocused(false);
        }
      }, 100);
    };

    const handleInput = (e: Event) => {
      const token = typeof window !== "undefined" ? (localStorage.getItem("smriti_jwt_token") || localStorage.getItem("smriti_session_token")) : null;
      if (!token) return;

      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        setFieldValue((target as HTMLInputElement).value || "");
      }
    };

    // Global Keydown Listener for F2
    const handleGlobalF2 = (e: KeyboardEvent) => {
      const token = typeof window !== "undefined" ? (localStorage.getItem("smriti_jwt_token") || localStorage.getItem("smriti_session_token")) : null;
      if (!token) return;

      if (e.key === "F2") {
        const active = document.activeElement as HTMLElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) {
          lastFocusedInputRef.current = active as HTMLInputElement;
          const { category: inferredCategory, label: inferredLabel } = inferFieldCategory(active);
          setCategory(inferredCategory);
          setFieldLabel(inferredLabel);
          setFieldName((active as HTMLInputElement).name || active.id || "active_input");
          setFieldValue((active as HTMLInputElement).value || "");
        }

        e.preventDefault();
        setIsF2ModalOpen(prev => !prev);
      }
    };

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    document.addEventListener("input", handleInput);
    window.addEventListener("keydown", handleGlobalF2);

    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      document.removeEventListener("input", handleInput);
      window.removeEventListener("keydown", handleGlobalF2);
    };
  }, []);

  const setManualCategory = useCallback((cat: ActiveFieldCategory, label?: string) => {
    setCategory(cat);
    if (label) setFieldLabel(label);
  }, []);

  const insertValueIntoActiveField = useCallback((value: string | Record<string, any>) => {
    const target = lastFocusedInputRef.current || activeElement as HTMLInputElement;
    if (!target) return;

    const stringVal = typeof value === "string" 
      ? value 
      : (value.code || value.barcode || value.sku || value.name || value.id || "");
    
    // Use prototype setter to properly update React's internal value tracker on controlled components
    try {
      const isInput = target instanceof HTMLInputElement;
      const isTextArea = target instanceof HTMLTextAreaElement;
      const proto = isInput 
        ? window.HTMLInputElement.prototype 
        : isTextArea 
        ? window.HTMLTextAreaElement.prototype 
        : Object.getPrototypeOf(target);
      
      const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
      if (descriptor && descriptor.set) {
        descriptor.set.call(target, stringVal);
      } else {
        target.value = stringVal;
      }
    } catch {
      target.value = stringVal;
    }
    
    // Dispatch input & change events for React synthetic event listeners
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
    target.focus();
  }, [activeElement]);

  return (
    <ActiveFieldContext.Provider
      value={{
        category,
        fieldName,
        fieldLabel,
        fieldValue,
        element: activeElement,
        isInputFocused,
        isF2ModalOpen,
        activeProductPreview,
        activeCustomerPreview,
        openF2Modal,
        closeF2Modal,
        setManualCategory,
        insertValueIntoActiveField,
        setActiveProductPreview,
        setActiveCustomerPreview
      }}
    >
      {children}
    </ActiveFieldContext.Provider>
  );
};
