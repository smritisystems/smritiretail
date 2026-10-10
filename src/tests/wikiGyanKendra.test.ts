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
 * Source Module: SMRITI Gyan Kendra (Wiki & Knowledge Base) Unit Tests
 */

import { describe, it, expect } from "vitest";

// Canonical SMRITI Gyan Kendra folder categories
export const FOLDER_NAMES: Record<string, string> = {
  "01-product": "Product Vision & Constitution",
  "02-user-guide": "Operations & User Guide",
  "03-admin-guide": "System Administration & Custodian",
  "04-installation": "Installation & Deployment",
  "05-developer": "Developer Runbooks & Pilots",
  "06-api": "API Integration Manuals",
  "07-kb": "Knowledge Base & FAQs",
  "08-architecture": "Architecture Change Proposals (ACP)",
  "09-release-notes": "System Release Logs",
  "Root": "General Documentation"
};

export const SUGGESTED_QUESTIONS = [
  "What is the SMRITI core formula for Weeks of Cover (WOC)?",
  "Explain SMRITI OS Backup Encryption & Custodian Security.",
  "What are the integration specifications for Customer Growth Engine (CGE)?",
  "How are Barcodes validated in SMRITI OS?",
  "Detail the Tattly Threads pilot execution plan."
];

export interface WikiDoc {
  path: string;
  name: string;
  folder: string;
  title: string;
  snippet?: string;
}

export function filterWikiDocuments(docs: WikiDoc[], query: string, selectedFolder: string): WikiDoc[] {
  const q = query.toLowerCase().trim();
  return docs.filter(doc => {
    const matchesQuery = !q ||
      doc.title.toLowerCase().includes(q) ||
      doc.name.toLowerCase().includes(q) ||
      (doc.snippet && doc.snippet.toLowerCase().includes(q));
    const matchesFolder = selectedFolder === "All" || doc.folder === selectedFolder;
    return matchesQuery && matchesFolder;
  });
}

export function extractMarkdownHeadings(markdown: string): { level: number; text: string; slug: string }[] {
  const headings: { level: number; text: string; slug: string }[] = [];
  const lines = markdown.split("\n");
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      const slug = text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
      headings.push({ level, text, slug });
    }
  }
  return headings;
}

describe("SMRITI — Gyan Kendra (Wiki & Knowledge Base) Unit Tests", () => {
  describe("1. Documentation Taxonomy & Folder Registry", () => {
    it("should provide canonical standard folder mapping", () => {
      expect(FOLDER_NAMES["01-product"]).toBe("Product Vision & Constitution");
      expect(FOLDER_NAMES["02-user-guide"]).toBe("Operations & User Guide");
      expect(FOLDER_NAMES["06-api"]).toBe("API Integration Manuals");
      expect(FOLDER_NAMES["07-kb"]).toBe("Knowledge Base & FAQs");
      expect(FOLDER_NAMES["08-architecture"]).toBe("Architecture Change Proposals (ACP)");
    });

    it("should provide approved suggested questions for instant AI explainability", () => {
      expect(SUGGESTED_QUESTIONS.length).toBeGreaterThanOrEqual(5);
      expect(SUGGESTED_QUESTIONS).toContain("What is the SMRITI core formula for Weeks of Cover (WOC)?");
      expect(SUGGESTED_QUESTIONS).toContain("How are Barcodes validated in SMRITI OS?");
    });
  });

  describe("2. Document Search & Folder Filtering", () => {
    const sampleDocs: WikiDoc[] = [
      {
        path: "01-product/vision.md",
        name: "vision.md",
        folder: "01-product",
        title: "Product Vision and Architecture",
        snippet: "SMRITI Retail OS is an AI-native operating system for single and multi-store retail enterprises."
      },
      {
        path: "06-api/integration.md",
        name: "integration.md",
        folder: "06-api",
        title: "FastAPI Backend REST Endpoints",
        snippet: "Core transactional system of record with PostgreSQL and FastAPI."
      },
      {
        path: "07-kb/woc-kpi.md",
        name: "woc-kpi.md",
        folder: "07-kb",
        title: "Weeks of Cover Metric Calculation",
        snippet: "WOC is calculated as Current Stock Units divided by Average Weekly Sales Units."
      }
    ];

    it("should search documents by title or snippet content", () => {
      const results = filterWikiDocuments(sampleDocs, "fastapi", "All");
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("integration.md");
    });

    it("should filter documents by folder", () => {
      const results = filterWikiDocuments(sampleDocs, "", "07-kb");
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Weeks of Cover Metric Calculation");
    });

    it("should return empty array when search yields no matches", () => {
      const results = filterWikiDocuments(sampleDocs, "nonexistent-keyword-xyz", "All");
      expect(results).toHaveLength(0);
    });
  });

  describe("3. Markdown Table of Contents Parsing", () => {
    it("should extract hierarchical headings and slugs from markdown content", () => {
      const sampleMarkdown = `
# Executive Overview
Welcome to SMRITI Retail OS.
## Architecture Principles
Detailed below.
### Database System of Record
PostgreSQL is canonical.
## Deployment Guide
Run via Docker.
      `;

      const headings = extractMarkdownHeadings(sampleMarkdown);
      expect(headings).toHaveLength(4);
      expect(headings[0]).toEqual({ level: 1, text: "Executive Overview", slug: "executive-overview" });
      expect(headings[1]).toEqual({ level: 2, text: "Architecture Principles", slug: "architecture-principles" });
      expect(headings[2]).toEqual({ level: 3, text: "Database System of Record", slug: "database-system-of-record" });
      expect(headings[3]).toEqual({ level: 2, text: "Deployment Guide", slug: "deployment-guide" });
    });
  });
});
