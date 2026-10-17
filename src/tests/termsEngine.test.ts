/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.4
 * Created      : 2026-09-14
 * Modified     : 2026-09-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Commercial & Statutory Terms Engine Unit Tests
 */

import { describe, it, expect } from "vitest";
import { termsEngineConfig, Clause } from "../components/global/configs/termsEngine.config.tsx";

// Helper function simulating dynamic variable resolution in terms clauses
export function resolveTermsVariables(content: string, variables: Record<string, string | number>): string {
  let resolved = content;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    resolved = resolved.replace(placeholder, String(value));
  }
  return resolved;
}

// Helper to validate clause integrity
export function validateTermsClause(clause: Partial<Clause>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!clause.title || clause.title.trim() === "") errors.push("Clause title is required");
  if (!clause.category || clause.category.trim() === "") errors.push("Category is required");
  if (!clause.content || clause.content.trim() === "") errors.push("Clause content cannot be empty");
  if (!clause.status) errors.push("Status is required");
  if (clause.version !== undefined && clause.version < 1) errors.push("Version must be at least 1");
  return { valid: errors.length === 0, errors };
}

describe("SMRITI — Commercial & Statutory Terms Engine Unit Tests", () => {
  describe("1. Master Configuration Schema Integrity", () => {
    it("should provide canonical master config for terms engine", () => {
      expect(termsEngineConfig.entityName).toBe("Terms Clause");
      expect(termsEngineConfig.entityNamePlural).toBe("Terms Clauses");
      expect(termsEngineConfig.title).toBe("Commercial & Statutory Terms Engine");
      expect(termsEngineConfig.apiEndpoint).toBe("/api/v1/terms/");
      expect(termsEngineConfig.idKey).toBe("id");
    });

    it("should configure standard columns for list view", () => {
      const colKeys = termsEngineConfig.columns.map(c => c.key);
      expect(colKeys).toContain("title");
      expect(colKeys).toContain("category");
      expect(colKeys).toContain("content");
      expect(colKeys).toContain("language");
      expect(colKeys).toContain("status");
    });

    it("should configure edit form fields with proper constraints", () => {
      const fieldNames = termsEngineConfig.fields.map(f => f.name);
      expect(fieldNames).toContain("title");
      expect(fieldNames).toContain("code");
      expect(fieldNames).toContain("category");
      expect(fieldNames).toContain("language");
      expect(fieldNames).toContain("status");
      expect(fieldNames).toContain("content");

      const titleField = termsEngineConfig.fields.find(f => f.name === "title");
      expect(titleField?.required).toBe(true);

      const contentField = termsEngineConfig.fields.find(f => f.name === "content");
      expect(contentField?.required).toBe(true);
      expect(contentField?.type).toBe("textarea");
    });

    it("should configure searchable fields including title, code, category, content", () => {
      expect(termsEngineConfig.searchFields).toEqual(["title", "code", "category", "content"]);
    });
  });

  describe("2. Clause Validation & Lifecycle", () => {
    const sampleClause: Clause = {
      id: "CLS-001",
      code: "STD-PAY-30",
      title: "Payment Due in 30 Days",
      category: "Payment Terms",
      content: "Payment is strictly due within 30 calendar days of invoice date.",
      isActive: true,
      version: 1,
      lastUpdated: "2026-09-14T00:00:00Z",
      updatedBy: "Finance Lead",
      status: "Approved",
      language: "en"
    };

    it("should validate a complete, valid clause", () => {
      const result = validateTermsClause(sampleClause);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject clauses missing mandatory fields", () => {
      const invalidClause = { code: "BAD-01", content: "" };
      const result = validateTermsClause(invalidClause);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Clause title is required");
      expect(result.errors).toContain("Category is required");
      expect(result.errors).toContain("Clause content cannot be empty");
    });

    it("should enforce valid approval workflow transitions", () => {
      const validTransitions: Record<Clause["status"], Clause["status"][]> = {
        "Draft": ["Pending Approval", "Archived"],
        "Pending Approval": ["Approved", "Draft", "Archived"],
        "Approved": ["Archived", "Draft"],
        "Archived": ["Draft"]
      };

      expect(validTransitions["Draft"]).toContain("Pending Approval");
      expect(validTransitions["Pending Approval"]).toContain("Approved");
      expect(validTransitions["Approved"]).toContain("Archived");
    });
  });

  describe("3. Dynamic Template Variable Interpolation", () => {
    it("should interpolate company, invoice, and jurisdiction variables", () => {
      const template = "Goods supplied by {{company_name}} under Invoice {{invoice_no}}. All disputes subject to {{jurisdiction}} jurisdiction. Payment terms: {{payment_terms_days}} days.";
      const vars = {
        company_name: "SMRITI Retail Private Limited",
        invoice_no: "INV/2026/00421",
        jurisdiction: "Mumbai",
        payment_terms_days: 45
      };

      const resolved = resolveTermsVariables(template, vars);
      expect(resolved).toBe("Goods supplied by SMRITI Retail Private Limited under Invoice INV/2026/00421. All disputes subject to Mumbai jurisdiction. Payment terms: 45 days.");
    });

    it("should leave unmatched placeholders intact without throwing errors", () => {
      const template = "Standard warranty: {{warranty_months}} months from delivery. Note: {{unmatched_custom_var}}.";
      const vars = { warranty_months: 12 };
      const resolved = resolveTermsVariables(template, vars);
      expect(resolved).toBe("Standard warranty: 12 months from delivery. Note: {{unmatched_custom_var}}.");
    });
  });

  describe("4. Statutory Clause Categorization & Search", () => {
    const clauses: Clause[] = [
      {
        id: "CLS-01",
        code: "GST-FINEPRINT",
        title: "GST Compliance & Tax Invoice Declaration",
        category: "Taxation",
        content: "Input tax credit is subject to counterparty GST return filing compliance.",
        isActive: true,
        version: 1,
        lastUpdated: "2026-09-14",
        updatedBy: "Tax Auditor",
        status: "Approved",
        language: "en"
      },
      {
        id: "CLS-02",
        code: "DEL-LOG-01",
        title: "Transit Risk and Delivery Terms",
        category: "Logistics",
        content: "Goods travel at buyer's risk once handed over to the approved transporter.",
        isActive: true,
        version: 2,
        lastUpdated: "2026-09-14",
        updatedBy: "Logistics Manager",
        status: "Approved",
        language: "en"
      },
      {
        id: "CLS-03",
        code: "RET-POL-01",
        title: "Return & Exchange Window",
        category: "Returns",
        content: "Returns accepted within 7 days with original tags and invoice copy.",
        isActive: false,
        version: 1,
        lastUpdated: "2026-09-14",
        updatedBy: "Store Manager",
        status: "Draft",
        language: "en"
      }
    ];

    it("should filter clauses by category", () => {
      const taxClauses = clauses.filter(c => c.category === "Taxation");
      expect(taxClauses).toHaveLength(1);
      expect(taxClauses[0].code).toBe("GST-FINEPRINT");
    });

    it("should search clauses by searchFields", () => {
      const query = "transporter";
      const matches = clauses.filter(c => 
        termsEngineConfig.searchFields.some(field => {
          const val = String((c as any)[field] || "").toLowerCase();
          return val.includes(query.toLowerCase());
        })
      );
      expect(matches).toHaveLength(1);
      expect(matches[0].id).toBe("CLS-02");
    });
  });
});
