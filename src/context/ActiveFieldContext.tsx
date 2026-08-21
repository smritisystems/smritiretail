/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.29.1
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

export type ActiveFieldCategory = "product" | "customer" | "supplier" | "invoice" | "hsn" | "general";

export interface ActiveFieldContextState {
  category: ActiveFieldCategory;
  fieldName: string;
  fieldLabel: string;
  fieldValue: string;
  element: HTMLElement | null;
  isInputFocused: boolean;
  activeProductPreview: Product | null;
  activeCustomerPreview: Customer | null;
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
 * using data attributes, name, id, placeholder, and aria metadata.
 */
export function inferFieldCategory(element: HTMLElement | null): { category: ActiveFieldCategory; label: string } {
  if (!element) {
    return { category: "general", label: "Global Search" };
  }

  // 1. Check explicit data-context-type or data-field-type attribute
  const explicitType = (
    element.getAttribute("data-context-type") || 
    element.getAttribute("data-field-type") || 
    element.getAttribute("data-lookup")
  )?.toLowerCase();

  if (explicitType) {
    if (["product", "scan", "barcode", "item", "sku"].includes(explicitType)) {
      return { category: "product", label: "Scan / Product Lookup" };
    }
    if (["customer", "cust", "mobile", "phone", "client"].includes(explicitType)) {
      return { category: "customer", label: "Customer Lookup" };
    }
    if (["supplier", "vendor", "seller"].includes(explicitType)) {
      return { category: "supplier", label: "Supplier Lookup" };
    }
    if (["invoice", "bill", "po", "voucher", "order"].includes(explicitType)) {
      return { category: "invoice", label: "Document / Invoice Lookup" };
    }
    if (["hsn", "sac", "tax"].includes(explicitType)) {
      return { category: "hsn", label: "HSN / Tax Lookup" };
    }
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

  // Keyword Matching Heuristics
  // Product / Scan
  if (
    rawIdentifiers.includes("barcode") || 
    rawIdentifiers.includes("scan") || 
    rawIdentifiers.includes("sku") || 
    rawIdentifiers.includes("product") || 
    rawIdentifiers.includes("item") || 
    rawIdentifiers.includes("stockno") ||
    rawIdentifiers.includes("style") ||
    rawIdentifiers.includes("mrp")
  ) {
    return { category: "product", label: "Product / Barcode Field" };
  }

  // Customer
  if (
    rawIdentifiers.includes("customer") || 
    rawIdentifiers.includes("cust") || 
    rawIdentifiers.includes("mobile") || 
    rawIdentifiers.includes("phone") || 
    rawIdentifiers.includes("client") || 
    rawIdentifiers.includes("buyer") ||
    rawIdentifiers.includes("membership")
  ) {
    return { category: "customer", label: "Customer / Mobile Field" };
  }

  // Supplier
  if (
    rawIdentifiers.includes("supplier") || 
    rawIdentifiers.includes("vendor") || 
    rawIdentifiers.includes("seller")
  ) {
    return { category: "supplier", label: "Supplier / Vendor Field" };
  }

  // Invoice / Bill / Order
  if (
    rawIdentifiers.includes("invoice") || 
    rawIdentifiers.includes("bill") || 
    rawIdentifiers.includes("order") || 
    rawIdentifiers.includes("po") || 
    rawIdentifiers.includes("voucher")
  ) {
    return { category: "invoice", label: "Invoice / Document Field" };
  }

  // HSN / Tax
  if (
    rawIdentifiers.includes("hsn") || 
    rawIdentifiers.includes("sac")
  ) {
    return { category: "hsn", label: "HSN Code Field" };
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
  const [activeProductPreview, setActiveProductPreview] = useState<Product | null>(null);
  const [activeCustomerPreview, setActiveCustomerPreview] = useState<Customer | null>(null);

  const lastFocusedInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Global DOM Focus and Input Tracking
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
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
      // Small timeout to avoid flicker when focus switches between inputs
      setTimeout(() => {
        const active = document.activeElement as HTMLElement;
        const isStillInput = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
        if (!isStillInput) {
          setIsInputFocused(false);
        }
      }, 100);
    };

    const handleInput = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        setFieldValue((target as HTMLInputElement).value || "");
      }
    };

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    document.addEventListener("input", handleInput);

    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      document.removeEventListener("input", handleInput);
    };
  }, []);

  const setManualCategory = useCallback((cat: ActiveFieldCategory, label?: string) => {
    setCategory(cat);
    if (label) setFieldLabel(label);
  }, []);

  const insertValueIntoActiveField = useCallback((value: string | Record<string, any>) => {
    const target = lastFocusedInputRef.current || activeElement as HTMLInputElement;
    if (!target) return;

    const stringVal = typeof value === "string" ? value : (value.code || value.barcode || value.name || value.id || "");
    
    // Set native value
    target.value = stringVal;
    
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
        activeProductPreview,
        activeCustomerPreview,
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
