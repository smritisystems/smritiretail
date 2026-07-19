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
 * * Version    : 3.18.0
 * * Created    : 2026-07-11
 * * Modified   : 2026-07-14
 * * Copyright  : Â© AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import fs from "fs";
import path from "path";
import { pool } from "./pool.js";

const DB_FILE = path.join(process.cwd(), "db_store.json");

/**
 * Seeds PostgreSQL tables using data from db_store.json if the database is unseeded.
 */
async function seedFromFlatFile() {
  const client = await pool.connect();
  try {
    // Allow skipping seeding via env var for safe restarts
    if (process.env.SKIP_SEED === "true") {
      console.log("[SMRITI DB] SKIP_SEED=true, skipping flat-file seeding.");
      return;
    }
    // Check if customer_groups table is already seeded
    const checkRes = await client.query("SELECT COUNT(*) FROM customer_groups");
    const count = parseInt(checkRes.rows[0].count, 10);
    if (count > 0) {
      console.log("[SMRITI DB] PostgreSQL database already contains data. Seeding skipped.");
      return;
    }

    if (!fs.existsSync(DB_FILE)) {
      console.log("[SMRITI DB] db_store.json seed file not found. Seeding skipped.");
      return;
    }

    console.log("[SMRITI DB] Seeding PostgreSQL database from db_store.json...");
    const raw = fs.readFileSync(DB_FILE, "utf8");
    const data = JSON.parse(raw);

    await client.query("BEGIN");
    // Temporarily disable foreign key constraints for bulk seeding
    await client.query("SET session_replication_role = 'replica';");

    // 1. Seed Customer Groups (idempotent)
    if (Array.isArray(data.customerGroups)) {
      for (const cg of data.customerGroups) {
        await client.query(
          `INSERT INTO customer_groups (
            id, name, credit_limit, unlimited_credit, credit_days, grace_days, 
            credit_hold, auto_block_sales, warning_threshold_percent, allow_override, 
            tax_inclusive, max_discount_percent, min_margin_percent, rounding_rule, 
            allowed_payment_methods, preferred_payment_method, allow_back_orders, 
            allow_negative_stock_sales, require_po_number, invoice_language, 
            can_view_price, can_view_margin, can_purchase_on_credit, can_receive_discount
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
          ON CONFLICT DO NOTHING;`,
          [
            cg.id, cg.name, cg.creditLimit ?? 0, cg.unlimitedCredit ?? false, cg.creditDays ?? 0, cg.graceDays ?? 0,
            cg.creditHold ?? false, cg.autoBlockSales ?? true, cg.warningThresholdPercent ?? 80, cg.allowOverride ?? false,
            cg.taxInclusive ?? true, cg.maxDiscountPercent ?? 0, cg.minMarginPercent ?? 0, cg.roundingRule ?? "Nearest1",
            cg.allowedPaymentMethods ?? [], cg.preferredPaymentMethod ?? null, cg.allowBackOrders ?? false,
            cg.allowNegativeStockSales ?? false, cg.requirePoNumber ?? false, cg.invoiceLanguage ?? "en",
            cg.canViewPrice ?? true, cg.canViewMargin ?? false, cg.canPurchaseOnCredit ?? false, cg.canReceiveDiscount ?? true
          ]
        );
      }
    }

    // 2. Seed Customers
    if (Array.isArray(data.customers)) {
      for (const c of data.customers) {
        await client.query(
          `INSERT INTO customers (id, customer_group_id, name, mobile, email, gst_number, outstanding, status, created_date, tags)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT DO NOTHING`,
          [
            c.id, c.customerGroupId, c.name, c.mobile ?? null, c.email ?? null, c.gstNumber ?? null,
            c.outstanding ?? 0.00, c.status ?? "Active", c.createdDate ? new Date(c.createdDate) : new Date(), c.tags ?? []
          ]
        );
      }
    }

    // 3. Seed Products
    if (Array.isArray(data.products)) {
      for (const p of data.products) {
        await client.query(
          `INSERT INTO products (
            id, code, name, price, stock, category, is_favorite, barcode, secondary_barcodes,
            brand, color, size, mrp, gst_percentage, style_code, cost_price, sku, hsn_code,
            pricing_mode, tracking_mode, variant_template_id, weight_grams, attributes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23) ON CONFLICT DO NOTHING`,
          [
            p.id, p.code, p.name, p.price ?? 0.00, p.stock ?? 0, p.category, p.isFavorite ?? false,
            p.barcode, p.secondaryBarcodes ?? [], p.brand ?? null, p.color ?? null, p.size ?? null,
            p.mrp ?? null, p.gstPercentage ?? 18.00, p.styleCode ?? null, p.costPrice ?? null, p.sku ?? null,
            p.hsnCode ?? null, p.pricingMode ?? "Fixed", p.trackingMode ?? "Standard", p.variantTemplateId ?? null,
            p.weightGrams ?? 0.00, JSON.stringify(p.attributes ?? {})
          ]
        );
      }
    }

    // 4. Seed POS Profiles
    if (Array.isArray(data.profiles)) {
      for (const prof of data.profiles) {
        await client.query(
          "INSERT INTO pos_profiles (id, name, cashier, warehouse, is_locked, is_archived) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING",
          [prof.id, prof.name, prof.cashier, prof.warehouse, prof.isLocked ?? false, prof.isArchived ?? false]
        );
      }
    }

    // 5. Seed Shifts
    if (Array.isArray(data.shifts)) {
      for (const s of data.shifts) {
        await client.query(
          `INSERT INTO shifts (id, profile_id, opened_at, closed_at, opening_balance, closing_balance, sales_count, sales_value, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING`,
          [
            s.id, s.profileId, s.openedAt ? new Date(s.openedAt) : new Date(), s.closedAt ? new Date(s.closedAt) : null,
            s.openingBalance ?? 0.00, s.closingBalance ?? null, s.salesCount ?? 0, s.salesValue ?? 0.00, s.status ?? "Open"
          ]
        );
      }
    }

    // 6. Seed Sales Invoices and Invoice Items
    if (Array.isArray(data.salesInvoices)) {
      for (const inv of data.salesInvoices) {
        await client.query(
          "INSERT INTO sales_invoices (id, invoice_no, date, customer_id, tax_total, grand_total, is_interstate, eway_bill_no, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING",
          [
            inv.id, inv.invoiceNo, inv.date ? new Date(inv.date) : new Date(), inv.customerId,
            inv.taxTotal ?? 0.00, inv.grandTotal ?? 0.00, inv.isInterstate ?? false, inv.eWayBillNo ?? null, inv.status ?? "Draft"
          ]
        );
        if (Array.isArray(inv.items)) {
          for (const item of inv.items) {
            await client.query(
              `INSERT INTO sales_invoice_items (invoice_id, product_id, code, name, quantity, price, hsn_code, gst_rate, tax_amount, total_amount)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT DO NOTHING`,
              [
                inv.id, item.productId, item.code ?? "", item.name ?? "", item.quantity ?? 1.00,
                item.price ?? 0.00, item.hsnCode ?? null, item.gstRate ?? 18.00, item.taxAmount ?? 0.00, item.totalAmount ?? 0.00
              ]
            );
          }
        }
      }
    }

    // 7. Seed PSV Parties
    if (Array.isArray(data.psvParties)) {
      for (const p of data.psvParties) {
        await client.query(
          "INSERT INTO psv_parties (id, name, location, stock_count, sell_through, weeks_of_cover, capital_locked, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING",
          [p.id, p.name, p.location, p.stockCount ?? 0, p.sellThrough ?? 0.00, p.weeksOfCover ?? 0.00, p.capitalLocked ?? 0.00, p.status ?? "Healthy"]
        );
        if (Array.isArray(p.skuTracking)) {
          for (const tracking of p.skuTracking) {
            await client.query(
              "INSERT INTO psv_sku_tracking (party_id, product_id, sku, invoiced_qty, confirmed_sold_qty, returned_qty) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING",
              [p.id, tracking.productId, tracking.sku, tracking.invoicedQty ?? 0, tracking.confirmedSoldQty ?? 0, tracking.returnedQty ?? 0]
            );
          }
        }
      }
    }

    // 8. Seed Audit Logs
    if (Array.isArray(data.auditLogs)) {
      const parseJsonField = (val: any) => {
        if (!val) return {};
        if (typeof val === 'object') return val;
        try {
          return JSON.parse(val);
        } catch {
          return { value: val };
        }
      };

      for (const log of data.auditLogs) {
        const op = log.operator || log.userName || log.userId || "System";
        const act = log.action || log.actionType || "UPDATE";
        const tbl = log.module || log.tableName || "unknown";
        const rec = log.targetId || log.recordId || "unknown";
        const ip = log.ipAddress || log.clientIp || null;
        const created = log.timestamp || log.createdAt ? new Date(log.timestamp || log.createdAt) : new Date();

        await client.query(
          "INSERT INTO audit_logs (operator, action_type, table_name, record_id, old_value, new_value, client_ip, machine_info, reason, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT DO NOTHING",
          [
            op, act, tbl, rec,
            JSON.stringify(parseJsonField(log.oldValue)),
            JSON.stringify(parseJsonField(log.newValue)),
            ip, log.machineInfo ?? null, log.reason ?? null, created
          ]
        );
      }
    }

    // Restore constraints/triggers
    await client.query("SET session_replication_role = 'origin';");
    await client.query("COMMIT");
    console.log("[SMRITI DB] PostgreSQL database seeded successfully from flat file.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[SMRITI DB] Failed to seed PostgreSQL database:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Seeds default users (super, manager, cashier) into the PostgreSQL users table if empty.
 */
export async function seedDefaultUsers() {
  const client = await pool.connect();
  try {
    // 1. Auto-provision default company and branch entities if missing
    await client.query(
      `INSERT INTO companies (id, uuid, name, gst_number, is_active, is_deleted, created_at, modified_at)
       VALUES ('comp-default', uuid_generate_v4()::varchar, 'SMRITI Default Company', '27ABCDE1234F1Z5', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO NOTHING`
    );

    await client.query(
      `INSERT INTO branches (id, uuid, company_id, name, code, is_active, is_deleted, created_at, modified_at)
       VALUES ('br-default', uuid_generate_v4()::varchar, 'comp-default', 'SMRITI Default Branch', 'BR-DEFAULT', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO NOTHING`
    );

    // 2. Assign any existing seeded users with missing tenant context to the default company/branch
    await client.query(
      `UPDATE users 
       SET company_id = 'comp-default', branch_id = 'br-default'
       WHERE username IN ('super', 'manager', 'cashier') AND (company_id IS NULL OR branch_id IS NULL)`
    );

    const existingUsersRes = await client.query(
      "SELECT username FROM users WHERE username IN ('super', 'manager', 'cashier')"
    );
    const existingUsernames = new Set(existingUsersRes.rows.map((row) => row.username));

    const { hashPassword } = await import("../lib/helpers.js");
    const defaultUsers = [
      {
        id: "usr-super",
        username: "super",
        email: "super@smritibooks.com",
        mobile: "9999999999",
        password: "whynothing",
        role: "SYSADMIN",
        fullName: "SYSTEM ADMINISTRATOR",
        displayName: "Super",
        employeeId: "EMP-001",
        employeeCode: "EMP-001",
        gender: "Male",
        dateOfBirth: "1980-01-01",
        address: "System Root",
        city: "Mumbai",
        state: "Maharashtra",
        pinCode: "400001",
        status: "Active",
        dateOfJoining: "2026-07-10",
        reportingManager: "",
        employmentType: "Permanent",
        allowedBranches: JSON.stringify(["HQ Store"]),
        preferences: JSON.stringify({ theme: "dark", language: "English", timeZone: "Asia/Kolkata" }),
        notificationSettings: JSON.stringify({
          salaryCredit: true,
          commissionEarned: true,
          targetAchievement: true,
          travelClaimApproval: true,
          leaveApproval: true,
          attendanceAlerts: true,
          holidayWeeklyOff: true,
          birthdayAnniversary: true,
          policyAnnouncements: true
        })
      },
      {
        id: "usr-manager",
        username: "manager",
        email: "manager@smritibooks.com",
        mobile: "9876543210",
        password: "Password@123",
        role: "MANAGER",
        fullName: "STORE MANAGER",
        displayName: "Manager",
        employeeId: "EMP-002",
        employeeCode: "EMP-002",
        gender: "Male",
        dateOfBirth: "1985-05-15",
        address: "HQ Store Area",
        city: "Mumbai",
        state: "Maharashtra",
        pinCode: "400001",
        status: "Active",
        dateOfJoining: "2026-07-10",
        reportingManager: "",
        employmentType: "Permanent",
        allowedBranches: JSON.stringify(["HQ Store"]),
        preferences: JSON.stringify({ theme: "dark", language: "English", timeZone: "Asia/Kolkata" }),
        notificationSettings: JSON.stringify({
          salaryCredit: true,
          commissionEarned: true,
          targetAchievement: true,
          travelClaimApproval: true,
          leaveApproval: true,
          attendanceAlerts: true,
          holidayWeeklyOff: true,
          birthdayAnniversary: true,
          policyAnnouncements: true
        })
      },
      {
        id: "usr-cashier",
        username: "cashier",
        email: "cashier@smritibooks.com",
        mobile: "9876543211",
        password: "cashier123",
        role: "CASHIER",
        fullName: "CASHIER OPERATOR",
        displayName: "Cashier",
        employeeId: "EMP-003",
        employeeCode: "EMP-003",
        gender: "Female",
        dateOfBirth: "1992-08-20",
        address: "Billing Counter 1",
        city: "Mumbai",
        state: "Maharashtra",
        pinCode: "400001",
        status: "Active",
        dateOfJoining: "2026-07-10",
        reportingManager: "",
        employmentType: "Permanent",
        allowedBranches: JSON.stringify(["HQ Store"]),
        preferences: JSON.stringify({ theme: "dark", language: "English", timeZone: "Asia/Kolkata" }),
        notificationSettings: JSON.stringify({
          salaryCredit: true,
          commissionEarned: true,
          targetAchievement: true,
          travelClaimApproval: true,
          leaveApproval: true,
          attendanceAlerts: true,
          holidayWeeklyOff: true,
          birthdayAnniversary: true,
          policyAnnouncements: true
        })
      }
    ];

    const missingUsers = defaultUsers.filter((u) => !existingUsernames.has(u.username));
    if (missingUsers.length > 0) {
      console.log("[SMRITI DB] Seeding default users into PostgreSQL...");
    }

    const insertedUsers: string[] = [];
    for (const u of defaultUsers) {
      if (existingUsernames.has(u.username)) {
        insertedUsers.push(u.username);
        continue;
      }

      const hashedPassword = hashPassword(u.password);
      await client.query(
        `INSERT INTO users (
          id, uuid, username, email, mobile, hashed_password, role, is_active, is_deleted,
          full_name, display_name, employee_id, employee_code, gender, date_of_birth,
          address, city, state, country, pin_code, status, date_of_joining, reporting_manager,
          employment_type, allowed_branches, preferences_json, notification_settings_json,
          company_id, branch_id,
          created_at, modified_at
        ) VALUES (
          $1, uuid_generate_v4()::varchar, $2, $3, $4, $5, $6, true, false,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24,
          $25, $26,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) ON CONFLICT DO NOTHING`,
        [
          u.id, u.username, u.email, u.mobile, hashedPassword, u.role,
          u.fullName, u.displayName, u.employeeId, u.employeeCode, u.gender, u.dateOfBirth,
          u.address, u.city, u.state, "India", u.pinCode, u.status, u.dateOfJoining, u.reportingManager,
          u.employmentType, u.allowedBranches, u.preferences, u.notificationSettings,
          "comp-default", "br-default"
        ]
      );
      insertedUsers.push(u.username);
    }

    const countRes = await client.query(
      "SELECT COUNT(*) FROM users WHERE username IN ('super', 'manager', 'cashier')"
    );
    const seededCount = parseInt(countRes.rows[0].count, 10);
    if (seededCount !== 3) {
      const missing = defaultUsers
        .map((u) => u.username)
        .filter((username) => !insertedUsers.includes(username));
      console.warn(
        `[SMRITI DB] Default user seed validation failed: expected 3 default users, found ${seededCount}. Missing: ${missing.join(", ")}`
      );
    } else if (missingUsers.length === 0) {
      console.log("[SMRITI DB] Default users already exist in PostgreSQL. Seed skipped.");
    } else {
      console.log("[SMRITI DB] Default users seeded successfully in PostgreSQL.");
    }
  } catch (error) {
    console.error("[SMRITI DB] Failed to seed default users in PostgreSQL:", error);
  } finally {
    client.release();
  }
}

/**
 * Initializes the PostgreSQL standalone database: runs schemas and imports existing flat-file database seed data.
 */
export async function initializePostgres() {
  try {
    console.log("[SMRITI DB] Connecting to PostgreSQL pool...");
    await pool.query("SELECT 1"); // Test connection I/O
    console.log("[SMRITI DB] PostgreSQL connection pool active.");

    try {
      await seedFromFlatFile();
    } catch (e) {
      console.warn("[SMRITI DB] Flat file seeding warning/error (continuing):", e);
    }

    try {
      await seedDefaultUsers();
    } catch (e) {
      console.error("[SMRITI DB] Default user seeding failed:", e);
    }
  } catch (error) {
    console.error("[SMRITI DB] PostgreSQL standalone database connection failed:", error);
  }
}
