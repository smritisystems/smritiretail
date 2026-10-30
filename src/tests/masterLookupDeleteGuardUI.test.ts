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

describe("Master Registry Hard Delete Guard UI Contract", () => {
  const masterListScreenPath = path.resolve(__dirname, "../components/global/master/MasterListScreen.tsx");
  const componentContent = fs.readFileSync(masterListScreenPath, "utf-8");

  it("1. includes blockedDeleteError state for capturing 409 reference conflicts", () => {
    expect(componentContent).toContain("blockedDeleteError");
    expect(componentContent).toContain("setBlockedDeleteError");
  });

  it("2. intercepts linked_records in handleDeleteConfirm when delete request fails", () => {
    expect(componentContent).toContain("linked_records");
    expect(componentContent).toContain("total_references");
    expect(componentContent).toContain("suggested_action");
    expect(componentContent).toContain("guardData");
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
});
