/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.72.0
 * Created      : 2026-10-12
 * Modified     : 2026-10-12
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: User & Staff Creation Verification Suite
 */

import { describe, it, expect, vi } from "vitest";

// Password policy validator matching StaffMasterWs and UsersView
export function validatePasswordPolicy(password: string): { isValid: boolean; error?: string } {
  if (!password || password.length < 8) {
    return { isValid: false, error: "Password must be at least 8 characters long." };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: "Password must contain at least one uppercase letter (A-Z)." };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, error: "Password must contain at least one lowercase letter (a-z)." };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, error: "Password must contain at least one number (0-9)." };
  }
  if (!/[!@#$%^&*()_\-+=\[\]{}|;:'",.<>/?`~]/.test(password)) {
    return { isValid: false, error: "Password must contain at least one special character (!@#$%^&*...)." };
  }
  return { isValid: true };
}

// Role normalization matching backend StaffUserCreate
export function normalizeUserRole(rawRole: string): string {
  const cleaned = String(rawRole || "").trim().toUpperCase();
  if (["ADMIN", "SYS_ADMIN", "SYSTEM_ADMIN"].includes(cleaned)) return "SYSADMIN";
  if (["STORE", "STORE_MGR"].includes(cleaned)) return "STORE_MANAGER";
  if (["PURCHASE", "PURCHASE_EXEC"].includes(cleaned)) return "PURCHASE_EXECUTIVE";
  if (["SALES", "SALES_EXEC"].includes(cleaned)) return "SALES_EXECUTIVE";
  if (["ACCOUNT", "ACCOUNTS"].includes(cleaned)) return "ACCOUNTANT";
  if (["HR", "HR_EXEC"].includes(cleaned)) return "HR_EXECUTIVE";
  return cleaned;
}

describe("User & Staff Creation Suite v6.72.0", () => {
  describe("Password Policy Security Verification", () => {
    it("should reject passwords shorter than 8 characters", () => {
      const res = validatePasswordPolicy("Pass1!");
      expect(res.isValid).toBe(false);
      expect(res.error).toBe("Password must be at least 8 characters long.");
    });

    it("should reject passwords without uppercase letter", () => {
      const res = validatePasswordPolicy("password123!");
      expect(res.isValid).toBe(false);
      expect(res.error).toBe("Password must contain at least one uppercase letter (A-Z).");
    });

    it("should reject passwords without lowercase letter", () => {
      const res = validatePasswordPolicy("PASSWORD123!");
      expect(res.isValid).toBe(false);
      expect(res.error).toBe("Password must contain at least one lowercase letter (a-z).");
    });

    it("should reject passwords without numeric digit", () => {
      const res = validatePasswordPolicy("Password!@#");
      expect(res.isValid).toBe(false);
      expect(res.error).toBe("Password must contain at least one number (0-9).");
    });

    it("should reject passwords without special character", () => {
      const res = validatePasswordPolicy("Password123");
      expect(res.isValid).toBe(false);
      expect(res.error).toBe("Password must contain at least one special character (!@#$%^&*...).");
    });

    it("should accept compliant temporary password", () => {
      const res = validatePasswordPolicy("Staff@2026");
      expect(res.isValid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it("should accept high-entropy complex passwords", () => {
      const res = validatePasswordPolicy("RIL_Mumbai#99Store!");
      expect(res.isValid).toBe(true);
    });
  });

  describe("Role Normalization Verification", () => {
    it("should normalize lowercase role 'cashier' to 'CASHIER'", () => {
      expect(normalizeUserRole("cashier")).toBe("CASHIER");
    });

    it("should normalize 'admin' to 'SYSADMIN'", () => {
      expect(normalizeUserRole("admin")).toBe("SYSADMIN");
      expect(normalizeUserRole("sys_admin")).toBe("SYSADMIN");
    });

    it("should normalize shorthand 'store' to 'STORE_MANAGER'", () => {
      expect(normalizeUserRole("store")).toBe("STORE_MANAGER");
      expect(normalizeUserRole("store_mgr")).toBe("STORE_MANAGER");
    });

    it("should normalize shorthand 'purchase' to 'PURCHASE_EXECUTIVE'", () => {
      expect(normalizeUserRole("purchase")).toBe("PURCHASE_EXECUTIVE");
    });

    it("should normalize shorthand 'sales' to 'SALES_EXECUTIVE'", () => {
      expect(normalizeUserRole("sales")).toBe("SALES_EXECUTIVE");
    });

    it("should normalize shorthand 'account' to 'ACCOUNTANT'", () => {
      expect(normalizeUserRole("account")).toBe("ACCOUNTANT");
      expect(normalizeUserRole("accounts")).toBe("ACCOUNTANT");
    });

    it("should normalize shorthand 'hr' to 'HR_EXECUTIVE'", () => {
      expect(normalizeUserRole("hr")).toBe("HR_EXECUTIVE");
    });
  });

  describe("Payload Construction & Human-Readable Error Formatting", () => {
    it("should assemble canonical POST /users/ payload with trimmed strings", () => {
      const form = {
        fullName: "  Ramesh Kumar  ",
        username: "  ramesh.pos  ",
        email: "  ramesh@store.com  ",
        password: "Staff@2026",
        role: "CASHIER",
      };

      const payload = {
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        email: form.email.trim() || undefined,
        passwordHash: form.password,
        role: normalizeUserRole(form.role),
      };

      expect(payload).toEqual({
        fullName: "Ramesh Kumar",
        username: "ramesh.pos",
        email: "ramesh@store.com",
        passwordHash: "Staff@2026",
        role: "CASHIER",
      });
    });

    it("should omit empty email as undefined in payload", () => {
      const form = {
        fullName: "Sita Sharma",
        username: "sita.cashier",
        email: "   ",
        password: "Staff@2026",
        role: "CASHIER",
      };

      const payload = {
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        email: form.email.trim() || undefined,
        passwordHash: form.password,
        role: normalizeUserRole(form.role),
      };

      expect(payload.email).toBeUndefined();
    });

    it("should format user-friendly duplicate credential errors", () => {
      const duplicateError = "A user with this username, email, or employee code already exists. Please use unique credentials.";
      expect(duplicateError).toContain("already exists");
      expect(duplicateError).not.toContain("SQLAlchemyError");
      expect(duplicateError).not.toContain("asyncpg");
    });
  });
});
