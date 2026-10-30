/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.1
 * Created      : 2026-10-30
 * Modified     : 2026-10-30
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Master Registry Hard Delete Guard UI Suite
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseDeleteGuardError } from "../components/global/master/MasterListScreen.tsx";

describe("Master Registry Hard Delete Guard UI Contract", () => {
  const masterListScreenPath = path.resolve(__dirname, "../components/global/master/MasterListScreen.tsx");
  const componentContent = fs.readFileSync(masterListScreenPath, "utf-8");

  it("1. includes blockedDeleteError state for capturing 409 reference conflicts", () => {
    expect(componentContent).toContain("blockedDeleteError");
    expect(componentContent).toContain("setBlockedDeleteError");
  });

  it("2. intercepts linked_records in handleDeleteConfirm via parseDeleteGuardError", () => {
    expect(componentContent).toContain("linked_records");
    expect(componentContent).toContain("total_references");
    expect(componentContent).toContain("suggested_action");
    expect(componentContent).toContain("parseDeleteGuardError");
  });

  it("3. renders Deletion Blocked modal with error badge and human-readable explanation", () => {
    expect(componentContent).toContain("Deletion Blocked: Active References Detected");
    expect(componentContent).toContain("SMRITI-VAL-003");
  });

  it("4. enumerates linked operational records showing entity_type, identifier, and reference field", () => {
    expect(componentContent).toContain("rec.entity_type");
    expect(componentContent).toContain("rec.identifier");
    expect(componentContent).toContain("rec.field");
    expect(componentContent).toContain("Linked Operational Records");
  });

  it("5. presents a highlighted suggested action callout instructing user how to resolve links", () => {
    expect(componentContent).toContain("Suggested Action:");
    expect(componentContent).toContain("Close & Review Links");
  });

  describe("parseDeleteGuardError behavior", () => {
    it("6. correctly parses structured Path C payload on err.body", () => {
      const err = {
        status: 409,
        body: {
          code: "SMRITI-VAL-003",
          message: "Cannot delete Brand 'Nike': linked to active items.",
          total_references: 3,
          linked_records: [
            { entity_type: "Item Master", identifier: "NK-01", field: "brand" },
            { entity_type: "Item Variant", identifier: "NK-01-RED", field: "brand" },
            { entity_type: "Item Barcode", identifier: "8901234567890", field: "barcode" },
          ],
          suggested_action: "Unlink or retire the 3 item records first.",
        },
      };

      const result = parseDeleteGuardError(err);
      expect(result).not.toBeNull();
      expect(result?.code).toBe("SMRITI-VAL-003");
      expect(result?.total).toBe(3);
      expect(result?.linkedRecords?.length).toBe(3);
      expect(result?.linkedRecords?.[0].identifier).toBe("NK-01");
      expect(result?.suggestedAction).toBe("Unlink or retire the 3 item records first.");
    });

    it("7. correctly parses structured payload on err.detail", () => {
      const err = {
        status: 409,
        detail: {
          code: "SMRITI-VAL-003",
          message: "Cannot delete size group.",
          linked_records: [
            { entity_type: "Attribute Group", identifier: "AG-01", field: "size_group_id" },
          ],
        },
      };

      const result = parseDeleteGuardError(err);
      expect(result).not.toBeNull();
      expect(result?.code).toBe("SMRITI-VAL-003");
      expect(result?.linkedRecords?.length).toBe(1);
    });

    it("8. falls back gracefully on flat 409 conflict responses", () => {
      const err = {
        status: 409,
        message: "Cannot delete Brand 'Tattly Threads': this value is still in use by 20 Item Master references.",
        body: {
          error_code: "SMRITI-DATA-001",
          suggested_action: "Please verify references before deleting.",
        },
      };

      const result = parseDeleteGuardError(err);
      expect(result).not.toBeNull();
      expect(result?.message).toContain("Tattly Threads");
      expect(result?.code).toBe("SMRITI-DATA-001");
      expect(result?.total).toBe(1);
      expect(result?.linkedRecords).toEqual([]);
      expect(result?.suggestedAction).toBe("Please verify references before deleting.");
    });

    it("9. returns null for generic non-conflict errors to allow standard notification", () => {
      const err = {
        status: 500,
        message: "Internal server error occurred.",
      };

      const result = parseDeleteGuardError(err);
      expect(result).toBeNull();
    });
  });
});
