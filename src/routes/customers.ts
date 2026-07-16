// DEPRECATED v3.20.0: Superseded by FastAPI /api/v1/* — not mounted in server.ts. Safe to delete after v3.21.0.

/**
 * @file src/routes/customers.ts
 * @description Customer relationship management (CRM), customer groups, and import validations.
 * @module src/routes/customers
 *
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-12
 * Modified     : 2026-07-12
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import express from "express";
import { container } from "../bootstrap/di.js";
import { isValidMobile, isValidGSTIN } from "../utils/validators.js";

const router = express.Router();

// Bulk Customer CSV Import Validation Engine
router.post("/api/customers/import-validate", async (req, res) => {
  const { rows, customerGroups: bodyCustomerGroups, existingCustomers } = req.body;
  
  if (!Array.isArray(rows)) {
    return res.status(400).json({ error: "Invalid payload: 'rows' must be an array." });
  }

  const results: any[] = [];
  let hasErrors = false;
  
  try {
    const groups = Array.isArray(bodyCustomerGroups) ? bodyCustomerGroups : await container.customers.getAllGroups();
    const existing = Array.isArray(existingCustomers) ? existingCustomers : await container.customers.getAll();

    const batchMobiles = new Set<string>();
    const batchEmails = new Set<string>();

    rows.forEach((row: any, idx: number) => {
      const errors: string[] = [];
      const warnings: string[] = [];

      const name = (row.name || "").trim();
      const mobile = (row.mobile || "").trim();
      const email = (row.email || "").trim();
      const customerGroupId = (row.customerGroupId || "").trim();
      const status = (row.status || "Active").trim();
      const outstandingInput = row.outstanding;

      if (!name || name.startsWith("Unnamed Customer")) {
        errors.push("Customer Name is required.");
      }

      if (!mobile) {
        errors.push("Mobile number is required.");
      } else {
        const cleanMobile = mobile.replace(/[- ]/g, "");
        if (!isValidMobile(cleanMobile)) {
          errors.push("Mobile number must be exactly 10 digits.");
        } else {
          const isDupExisting = existing.some((c: any) => c.phone === cleanMobile || c.phone === mobile || c.mobile === cleanMobile || c.mobile === mobile);
          if (isDupExisting) {
            errors.push(`Mobile number '${mobile}' is already registered in SMRITI database.`);
          }
          if (batchMobiles.has(cleanMobile)) {
            errors.push(`Duplicate mobile number '${mobile}' detected within the imported batch.`);
          } else {
            batchMobiles.add(cleanMobile);
          }
        }
      }

      if (!email) {
        errors.push("Email address is required.");
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          errors.push("Invalid email address format.");
        } else {
          const isDupEmailExisting = existing.some((c: any) => c.email && c.email.toLowerCase() === email.toLowerCase());
          if (isDupEmailExisting) {
            errors.push(`Email address '${email}' is already registered in SMRITI database.`);
          }
          const lowerEmail = email.toLowerCase();
          if (batchEmails.has(lowerEmail)) {
            errors.push(`Duplicate email address '${email}' detected within the imported batch.`);
          } else {
            batchEmails.add(lowerEmail);
          }
        }
      }

      const gstVal = (row.gstNumber || row.gstin || "").trim();
      if (gstVal && !isValidGSTIN(gstVal)) {
        errors.push(`Invalid GSTIN format for '${gstVal}'.`);
      }

      let resolvedGroup = "";
      if (!customerGroupId) {
        errors.push("Customer Group / Tier is required.");
      } else {
        const normalizedGroup = customerGroupId.toLowerCase();
        const groupFound = groups.find((g: any) => 
          g.id.toLowerCase() === normalizedGroup || 
          g.name.toLowerCase() === normalizedGroup ||
          g.name.toLowerCase().includes(normalizedGroup)
        );
        if (groupFound) {
          resolvedGroup = groupFound.id;
        } else {
          errors.push(`Customer Group '${customerGroupId}' is invalid or not found.`);
        }
      }

      let resolvedStatus = "Active";
      if (status) {
        const s = status.toLowerCase();
        if (s === "inactive") resolvedStatus = "Inactive";
        else if (s === "blocked") resolvedStatus = "Blocked";
        else if (s !== "active") {
          warnings.push(`Unknown status '${status}'; falling back to 'Active'.`);
        }
      }

      let resolvedOutstanding = 0;
      if (outstandingInput !== undefined && outstandingInput !== null) {
        const parsedOut = parseFloat(String(outstandingInput).replace(/[^\d.-]/g, ""));
        if (!isNaN(parsedOut)) {
          resolvedOutstanding = parsedOut;
        } else {
          warnings.push("Invalid outstanding balance format; defaulted to ₹0.");
        }
      }

      if (errors.length > 0) {
        hasErrors = true;
      }

      results.push({
        name: name || `Row ${idx + 2} Customer`,
        mobile,
        email,
        gstNumber: row.gstNumber || row.gstin || "",
        pan: row.pan || "",
        customerGroupId: resolvedGroup || "CG-Retail",
        status: resolvedStatus,
        outstanding: resolvedOutstanding,
        rowNumber: idx + 2,
        warnings,
        errors,
        valid: errors.length === 0
      });
    });

    res.json({ hasErrors, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Single Customer Addition Validation Engine
router.post("/api/customers/validate-add", async (req, res) => {
  const { customer, existingCustomers } = req.body;
  if (!customer) {
    return res.status(400).json({ error: "Invalid payload: 'customer' must be provided." });
  }

  try {
    const existing = Array.isArray(existingCustomers) ? existingCustomers : await container.customers.getAll();
    const errors: string[] = [];
    const warnings: string[] = [];

    const name = (customer.name || "").trim();
    const mobile = (customer.mobile || "").trim();
    const email = (customer.email || "").trim();

    if (!name) {
      errors.push("Customer Name is required.");
    }

    if (!mobile) {
      errors.push("Mobile number is required.");
    } else {
      const cleanMobile = mobile.replace(/[- ]/g, "");
      if (!isValidMobile(cleanMobile)) {
        errors.push("Mobile number must be exactly 10 digits.");
      } else {
        const isDupExisting = existing.some((c: any) => c.phone === cleanMobile || c.phone === mobile || c.mobile === cleanMobile || c.mobile === mobile);
        if (isDupExisting) {
          errors.push(`Mobile number '${mobile}' is already registered in SMRITI database.`);
        }
      }
    }

    if (!email) {
      errors.push("Email address is required.");
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push("Invalid email address format.");
      } else {
        const isDupEmailExisting = existing.some((c: any) => c.email && c.email.toLowerCase() === email.toLowerCase());
        if (isDupEmailExisting) {
          errors.push(`Email address '${email}' is already registered in SMRITI database.`);
        }
      }
    }

    const gstNumber = (customer.gstNumber || "").trim();
    if (gstNumber && !isValidGSTIN(gstNumber)) {
      errors.push("Invalid GSTIN format. Indian GSTIN must be exactly 15 characters matching standard layout.");
    }

    res.json({
      valid: errors.length === 0,
      errors,
      warnings
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Customer API
router.get("/api/customers", async (req, res) => {
  try {
    const list = await container.customers.getAll();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/customers/groups", async (req, res) => {
  try {
    const list = await container.customers.getAllGroups();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api/customers", async (req, res) => {
  const newCustomer = req.body;
  
  if (!newCustomer.createdDate) {
    newCustomer.createdDate = new Date().toISOString().split("T")[0];
  }
  if (!newCustomer.status) {
    newCustomer.status = "Active";
  }
  if (newCustomer.outstanding === undefined) {
    newCustomer.outstanding = 0;
  }
  
  try {
    const created = await container.customers.create(newCustomer);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/api/customers/:id", async (req, res) => {
  const id = req.params.id;
  const updates = req.body;
  
  try {
    const existing = await container.customers.getById(id);
    if (!existing) {
      return res.status(404).json({ error: "Customer not found" });
    }
    const updated = await container.customers.update(id, updates);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
