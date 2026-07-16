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
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 3.17.0
 * * Created    : 2026-07-11
 * * Modified   : 2026-07-14
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import { pool } from "../pool.js";
import { Product, Customer, CustomerGroup, POSProfile, Shift, SalesInvoice, AuditLog, SyncQueueItem } from "../../core/domain/entities.js";
import { IProductRepository, ICustomerRepository, IShiftRepository, ISalesInvoiceRepository, IAuditRepository, ISyncRepository, IUserRepository, IPOSProfileRepository, IPurchaseRepository, IStateRepository } from "../../core/interfaces/db.js";
import { User } from "../../types.js";
import * as store from "../../state/store.js";

export class PostgresProductRepository implements IProductRepository {
  async getAll(): Promise<Product[]> {
    const res = await pool.query(`
      SELECT id, code, name, price::float, stock, category, is_favorite AS "isFavorite",
             barcode, secondary_barcodes AS "secondaryBarcodes", brand, color, size,
             mrp::float, gst_percentage AS "gstPercentage", style_code AS "styleCode",
             cost_price AS "costPrice", sku, hsn_code AS "hsnCode", attributes,
             pricing_mode AS "pricingMode", tracking_mode AS "trackingMode",
             variant_template_id AS "variantTemplateId", weight_grams AS "weightGrams"
      FROM products
      ORDER BY name ASC
    `);
    return res.rows.map(row => ({
      ...row,
      barcodes: [
        { type: "Code128", value: row.barcode, isPrimary: true },
        ...(row.secondaryBarcodes || []).map((val: string) => ({ type: "Code128", value: val, isPrimary: false }))
      ]
    }));
  }

  async getById(id: string): Promise<Product | null> {
    const res = await pool.query("SELECT * FROM products WHERE id = $1", [id]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      price: parseFloat(row.price) || 0,
      stock: row.stock,
      category: row.category,
      isFavorite: row.is_favorite,
      barcode: row.barcode,
      secondaryBarcodes: row.secondary_barcodes,
      barcodes: [
        { type: "Code128", value: row.barcode, isPrimary: true },
        ...(row.secondary_barcodes || []).map((val: string) => ({ type: "Code128", value: val, isPrimary: false }))
      ],
      brand: row.brand,
      color: row.color,
      size: row.size,
      mrp: parseFloat(row.mrp) || 0,
      gstPercentage: parseFloat(row.gst_percentage) || 18,
      styleCode: row.style_code,
      costPrice: parseFloat(row.cost_price) || 0,
      sku: row.sku,
      hsnCode: row.hsn_code,
      attributes: row.attributes,
      pricingMode: row.pricing_mode,
      trackingMode: row.tracking_mode,
      variantTemplateId: row.variant_template_id,
      weightGrams: row.weight_grams
    };
  }

  async create(p: Product): Promise<Product> {
    await pool.query(`
      INSERT INTO products (
        id, name, code, sku, price, cost_price, stock, category, barcode, color, size, mrp, gst_percentage, style_code
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [p.id, p.name, p.code, p.sku || p.code, p.price, p.costPrice || 0, p.stock, p.category || "General", p.barcode, p.color || null, p.size || null, p.mrp || p.price, p.gstPercentage || 18, p.styleCode || p.code]);
    return p;
  }

  async update(id: string, p: Partial<Product>): Promise<Product> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.entries(p).forEach(([key, val]) => {
      // Map camelCase keys to snake_case db columns
      let dbCol = key;
      if (key === "isFavorite") dbCol = "is_favorite";
      if (key === "gstPercentage") dbCol = "gst_percentage";
      if (key === "styleCode") dbCol = "style_code";
      if (key === "costPrice") dbCol = "cost_price";
      if (key === "hsnCode") dbCol = "hsn_code";
      if (key === "pricingMode") dbCol = "pricing_mode";
      if (key === "trackingMode") dbCol = "tracking_mode";
      if (key === "variantTemplateId") dbCol = "variant_template_id";
      if (key === "weightGrams") dbCol = "weight_grams";
      
      // Exclude virtual/joined attributes
      if (key === "barcodes" || key === "secondaryBarcodes") return;

      fields.push(`${dbCol} = $${paramIndex++}`);
      values.push(val);
    });

    values.push(id);
    await pool.query(`
      UPDATE products SET ${fields.join(", ")}, modified_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex}
    `, values);

    const updated = await this.getById(id);
    if (!updated) throw new Error("Product update failed to retrieve record");
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const res = await pool.query("DELETE FROM products WHERE id = $1", [id]);
    return (res.rowCount ?? 0) > 0;
  }

  async addBarcode(id: string, value: string): Promise<Product> {
    await pool.query("UPDATE products SET secondary_barcodes = array_append(secondary_barcodes, $2) WHERE id = $1", [id, value]);
    const updated = await this.getById(id);
    if (!updated) throw new Error("Product failed to retrieve after adding secondary barcode");
    return updated;
  }

  async deleteBarcode(id: string, value: string): Promise<Product> {
    await pool.query("UPDATE products SET secondary_barcodes = array_remove(secondary_barcodes, $2) WHERE id = $1", [id, value]);
    const updated = await this.getById(id);
    if (!updated) throw new Error("Product failed to retrieve after deleting secondary barcode");
    return updated;
  }
}

export class PostgresCustomerRepository implements ICustomerRepository {
  private mapRowToCustomer(row: any): Customer {
    const parseDateStr = (val: any) => {
      if (!val) return undefined;
      if (val instanceof Date) return val.toISOString().split('T')[0];
      return String(val);
    };

    return {
      id: row.id,
      name: row.name,
      mobile: row.mobile || row.phone || "",
      phone: row.mobile || row.phone || "", // legacy compatibility
      email: row.email,
      outstanding: parseFloat(row.outstanding) || 0,
      group: row.customer_group_id || row.group,
      gstNumber: row.gst_number || undefined,
      pan: row.pan || undefined,
      alternateMobile: row.alternate_mobile || undefined,
      customerType: row.customer_type as any || undefined,
      aadhaar: row.aadhaar || undefined,
      billingAddressLine1: row.billing_address_line1 || undefined,
      billingAddressLine2: row.billing_address_line2 || undefined,
      billingCity: row.billing_city || undefined,
      billingState: row.billing_state || undefined,
      billingCountry: row.billing_country || undefined,
      billingPincode: row.billing_pincode || undefined,
      shippingSameAsBilling: row.shipping_same_as_billing !== null ? row.shipping_same_as_billing : undefined,
      shippingAddressLine1: row.shipping_address_line1 || undefined,
      shippingAddressLine2: row.shipping_address_line2 || undefined,
      shippingCity: row.shipping_city || undefined,
      shippingState: row.shipping_state || undefined,
      shippingCountry: row.shipping_country || undefined,
      shippingPincode: row.shipping_pincode || undefined,
      priceListId: row.price_list_id || undefined,
      salesperson: row.salesperson || undefined,
      territory: row.territory || undefined,
      route: row.route || undefined,
      creditLimitOverride: row.credit_limit_override !== null ? parseFloat(row.credit_limit_override) : undefined,
      creditDaysOverride: row.credit_days_override !== null ? row.credit_days_override : undefined,
      openingBalance: row.opening_balance !== null ? parseFloat(row.opening_balance) : undefined,
      openingBalanceType: row.opening_balance_type as any || undefined,
      blacklisted: row.blacklisted !== null ? row.blacklisted : undefined,
      photoUrl: row.photo_url || undefined,
      dateOfBirth: parseDateStr(row.date_of_birth),
      anniversaryDate: parseDateStr(row.anniversary_date),
      gender: row.gender || undefined,
      occupation: row.occupation || undefined,
      preferredLanguage: row.preferred_language || undefined,
      loyaltyMember: row.loyalty_member !== null ? row.loyalty_member : undefined,
      leadSource: row.lead_source || undefined,
      notes: row.notes || undefined,
      status: row.status || undefined,
      createdDate: parseDateStr(row.created_date)
    };
  }

  async getAll(): Promise<Customer[]> {
    const res = await pool.query(`
      SELECT * FROM customers ORDER BY name ASC
    `);
    return res.rows.map(row => this.mapRowToCustomer(row));
  }

  async getById(id: string): Promise<Customer | null> {
    const res = await pool.query("SELECT * FROM customers WHERE id = $1", [id]);
    if (res.rows.length === 0) return null;
    return this.mapRowToCustomer(res.rows[0]);
  }

  async getAllGroups(): Promise<CustomerGroup[]> {
    const res = await pool.query(`
      SELECT id, name, max_discount_percent AS "discountPercentage", can_purchase_on_credit AS "allowCredit"
      FROM customer_groups
    `);
    return res.rows.map(row => ({
      id: row.id,
      name: row.name,
      discountPercentage: parseFloat(row.discountPercentage) || 0,
      allowCredit: row.allowCredit || false
    }));
  }

  async updateOutstanding(id: string, amount: number): Promise<Customer> {
    await pool.query("UPDATE customers SET outstanding = outstanding + $2 WHERE id = $1", [id, amount]);
    const updated = await this.getById(id);
    if (!updated) throw new Error("Customer failed to retrieve after outstanding balance update");
    return updated;
  }

  async create(c: Customer): Promise<Customer> {
    let customerId = c.id;
    if (!customerId || customerId.trim() === "" || customerId.startsWith("CUST-")) {
      const seqRes = await pool.query("SELECT nextval('customer_code_seq') AS seq");
      const nextVal = seqRes.rows[0].seq;
      customerId = `CUST-${String(nextVal).padStart(6, '0')}`;
    }

    await pool.query(`
      INSERT INTO customers (
        id, customer_group_id, name, mobile, email, outstanding, status, created_date,
        pan, alternate_mobile, customer_type, aadhaar,
        billing_address_line1, billing_address_line2, billing_city, billing_state, billing_country, billing_pincode,
        shipping_same_as_billing, shipping_address_line1, shipping_address_line2, shipping_city, shipping_state, shipping_country, shipping_pincode,
        price_list_id, salesperson, territory, route,
        credit_limit_override, credit_days_override, opening_balance, opening_balance_type,
        blacklisted, photo_url, date_of_birth, anniversary_date, gender, occupation, preferred_language,
        loyalty_member, lead_source, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, CURRENT_DATE,
        $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22, $23, $24,
        $25, $26, $27, $28,
        $29, $30, $31, $32,
        $33, $34, $35, $36, $37, $38, $39,
        $40, $41, $42
      )
    `, [
      customerId, c.group || null, c.name, c.mobile || c.phone || null, c.email || null, c.outstanding || 0.00, c.status || 'Active',
      c.pan || null, c.alternateMobile || null, c.customerType || null, c.aadhaar || null,
      c.billingAddressLine1 || null, c.billingAddressLine2 || null, c.billingCity || null, c.billingState || null, c.billingCountry || 'India', c.billingPincode || null,
      c.shippingSameAsBilling !== undefined ? c.shippingSameAsBilling : true, c.shippingAddressLine1 || null, c.shippingAddressLine2 || null, c.shippingCity || null, c.shippingState || null, c.shippingCountry || null, c.shippingPincode || null,
      c.priceListId || null, c.salesperson || null, c.territory || null, c.route || null,
      c.creditLimitOverride !== undefined ? c.creditLimitOverride : null, c.creditDaysOverride !== undefined ? c.creditDaysOverride : null, c.openingBalance !== undefined ? c.openingBalance : 0.00, c.openingBalanceType || null,
      c.blacklisted !== undefined ? c.blacklisted : false, c.photoUrl || null, c.dateOfBirth || null, c.anniversaryDate || null, c.gender || null, c.occupation || null, c.preferredLanguage || null,
      c.loyaltyMember !== undefined ? c.loyaltyMember : false, c.leadSource || null, c.notes || null
    ]);

    const created = await this.getById(customerId);
    if (!created) throw new Error("Failed to retrieve customer after creation");
    return created;
  }

  async update(id: string, c: Partial<Customer>): Promise<Customer> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const columnMappings: { [key: string]: string } = {
      name: "name",
      mobile: "mobile",
      phone: "mobile",
      email: "email",
      outstanding: "outstanding",
      group: "customer_group_id",
      status: "status",
      pan: "pan",
      alternateMobile: "alternate_mobile",
      customerType: "customer_type",
      aadhaar: "aadhaar",
      billingAddressLine1: "billing_address_line1",
      billingAddressLine2: "billing_address_line2",
      billingCity: "billing_city",
      billingState: "billing_state",
      billingCountry: "billing_country",
      billingPincode: "billing_pincode",
      shippingSameAsBilling: "shipping_same_as_billing",
      shippingAddressLine1: "shipping_address_line1",
      shippingAddressLine2: "shipping_address_line2",
      shippingCity: "shipping_city",
      shippingState: "shipping_state",
      shippingCountry: "shipping_country",
      shippingPincode: "shipping_pincode",
      priceListId: "price_list_id",
      salesperson: "salesperson",
      territory: "territory",
      route: "route",
      creditLimitOverride: "credit_limit_override",
      creditDaysOverride: "credit_days_override",
      openingBalance: "opening_balance",
      openingBalanceType: "opening_balance_type",
      blacklisted: "blacklisted",
      photoUrl: "photo_url",
      dateOfBirth: "date_of_birth",
      anniversaryDate: "anniversary_date",
      gender: "gender",
      occupation: "occupation",
      preferredLanguage: "preferred_language",
      loyaltyMember: "loyalty_member",
      leadSource: "lead_source",
      notes: "notes"
    };

    Object.entries(c).forEach(([key, val]) => {
      const dbCol = columnMappings[key];
      if (dbCol !== undefined && val !== undefined) {
        fields.push(`${dbCol} = $${paramIndex++}`);
        values.push(val);
      }
    });

    if (fields.length > 0) {
      values.push(id);
      await pool.query(`UPDATE customers SET ${fields.join(", ")}, modified_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex}`, values);
    }
    const updated = await this.getById(id);
    if (!updated) throw new Error("Customer not found after update");
    return updated;
  }

  async createGroup(cg: CustomerGroup): Promise<CustomerGroup> {
    await pool.query(`
      INSERT INTO customer_groups (id, name, max_discount_percent, can_purchase_on_credit)
      VALUES ($1, $2, $3, $4)
    `, [cg.id, cg.name, cg.discountPercentage || 0, cg.allowCredit || false]);
    return cg;
  }

  async updateGroup(id: string, cg: Partial<CustomerGroup>): Promise<CustomerGroup> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    if (cg.name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(cg.name); }
    if (cg.discountPercentage !== undefined) { fields.push(`max_discount_percent = $${paramIndex++}`); values.push(cg.discountPercentage); }
    if (cg.allowCredit !== undefined) { fields.push(`can_purchase_on_credit = $${paramIndex++}`); values.push(cg.allowCredit); }

    if (fields.length > 0) {
      values.push(id);
      await pool.query(`UPDATE customer_groups SET ${fields.join(", ")}, modified_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex}`, values);
    }
    const res = await pool.query("SELECT id, name, max_discount_percent AS \"discountPercentage\", can_purchase_on_credit AS \"allowCredit\" FROM customer_groups WHERE id = $1", [id]);
    if (res.rows.length === 0) throw new Error("CustomerGroup not found after update");
    const row = res.rows[0];
    return {
      id: row.id,
      name: row.name,
      discountPercentage: parseFloat(row.discountPercentage) || 0,
      allowCredit: row.allowCredit
    };
  }
}

export class PostgresShiftRepository implements IShiftRepository {
  async getAll(): Promise<Shift[]> {
    const res = await pool.query(`
      SELECT id, profile_id AS "profileId", cashier, warehouse, branch,
             start_time AS "startTime", end_time AS "endTime", status,
             opening_cash AS "openingCash", closing_cash AS "closingCash",
             sales_count AS "salesCount", sales_value AS "salesValue"
      FROM shifts
      ORDER BY start_time DESC
    `);
    return res.rows.map(row => ({
      ...row,
      status: row.status === 'OPEN' || row.status === 'Open' ? 'Open' : 'Closed'
    }));
  }

  async getById(id: string): Promise<Shift | null> {
    const res = await pool.query("SELECT id, profile_id AS profile_id, status, cashier, warehouse, branch, start_time, end_time, opening_cash, closing_cash, sales_count, sales_value FROM shifts WHERE id = $1", [id]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      profileId: row.profile_id,
      cashier: row.cashier,
      warehouse: row.warehouse,
      branch: row.branch,
      startTime: row.start_time,
      endTime: row.end_time,
      status: row.status === 'OPEN' || row.status === 'Open' ? 'Open' : 'Closed',
      openingCash: parseFloat(row.opening_cash) || 0,
      closingCash: parseFloat(row.closing_cash) || 0,
      salesCount: parseInt(row.sales_count) || 0,
      salesValue: parseFloat(row.sales_value) || 0
    };
  }

  async getOpenShift(profileId: string): Promise<Shift | null> {
    const res = await pool.query("SELECT id, profile_id AS profile_id, status, cashier, warehouse, branch, start_time, end_time, opening_cash, closing_cash, sales_count, sales_value FROM shifts WHERE profile_id = $1 AND (status = 'Open' OR status = 'OPEN')", [profileId]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      profileId: row.profile_id,
      cashier: row.cashier,
      warehouse: row.warehouse,
      branch: row.branch,
      startTime: row.start_time,
      endTime: row.end_time,
      status: row.status === 'OPEN' || row.status === 'Open' ? 'Open' : 'Closed',
      openingCash: parseFloat(row.opening_cash) || 0,
      closingCash: parseFloat(row.closing_cash) || 0,
      salesCount: parseInt(row.sales_count) || 0,
      salesValue: parseFloat(row.sales_value) || 0
    };
  }

  async create(s: Shift): Promise<Shift> {
    await pool.query(`
      INSERT INTO shifts (
        id, profile_id, cashier, warehouse, branch, start_time, status, opening_cash, sales_count, sales_value, opened_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, $7, $8, $9, CURRENT_TIMESTAMP)
    `, [s.id, s.profileId, s.cashier, s.warehouse, s.branch, s.status.toUpperCase(), s.openingCash, s.salesCount, s.salesValue]);
    return s;
  }

  async updateStats(id: string, count: number, value: number): Promise<Shift> {
    await pool.query("UPDATE shifts SET sales_count = sales_count + $2, sales_value = sales_value + $3 WHERE id = $1", [id, count, value]);
    const updated = await this.getById(id);
    if (!updated) throw new Error("Shift failed to retrieve after status statistic updates");
    return updated;
  }

  async close(id: string, closingCash: number): Promise<Shift> {
    await pool.query("UPDATE shifts SET status = 'CLOSED', end_time = CURRENT_TIMESTAMP, closed_at = CURRENT_TIMESTAMP, closing_cash = $2 WHERE id = $1", [id, closingCash]);
    const updated = await this.getById(id);
    if (!updated) throw new Error("Shift failed to retrieve after shift closure operations");
    return updated;
  }
}

export class PostgresSalesInvoiceRepository implements ISalesInvoiceRepository {
  async getAll(): Promise<SalesInvoice[]> {
    const res = await pool.query("SELECT * FROM sales_invoices ORDER BY date DESC");
    const invoices: SalesInvoice[] = [];
    for (const row of res.rows) {
      const itemsRes = await pool.query("SELECT * FROM sales_invoice_items WHERE invoice_id = $1", [row.id]);
      invoices.push({
        id: row.id,
        invoiceNo: row.invoice_no,
        date: row.date,
        customerId: row.customer_id,
        taxTotal: parseFloat(row.tax_total) || 0,
        grandTotal: parseFloat(row.grand_total) || 0,
        status: row.status,
        items: itemsRes.rows.map(i => ({
          productId: i.product_id,
          code: i.code,
          name: i.name,
          quantity: i.quantity,
          price: parseFloat(i.price) || 0,
          gstRate: parseFloat(i.gst_rate) || 18,
          taxAmount: parseFloat(i.tax_amount) || 0,
          totalAmount: parseFloat(i.total_amount) || 0
        }))
      });
    }
    return invoices;
  }

  async getById(id: string): Promise<SalesInvoice | null> {
    const res = await pool.query("SELECT * FROM sales_invoices WHERE id = $1", [id]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    const itemsRes = await pool.query("SELECT * FROM sales_invoice_items WHERE invoice_id = $1", [id]);
    return {
      id: row.id,
      invoiceNo: row.invoice_no,
      date: row.date,
      customerId: row.customer_id,
      taxTotal: parseFloat(row.tax_total) || 0,
      grandTotal: parseFloat(row.grand_total) || 0,
      status: row.status,
      items: itemsRes.rows.map(i => ({
        productId: i.product_id,
        code: i.code,
        name: i.name,
        quantity: i.quantity,
        price: parseFloat(i.price) || 0,
        gstRate: parseFloat(i.gst_rate) || 18,
        taxAmount: parseFloat(i.tax_amount) || 0,
        totalAmount: parseFloat(i.total_amount) || 0
      }))
    };
  }

  async create(invoice: SalesInvoice): Promise<SalesInvoice> {
    await pool.query(
      "INSERT INTO sales_invoices (id, invoice_no, date, customer_id, tax_total, grand_total, status) VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6)",
      [invoice.id, invoice.invoiceNo, invoice.customerId, invoice.taxTotal, invoice.grandTotal, invoice.status]
    );
    for (const item of invoice.items) {
      await pool.query(
        "INSERT INTO sales_invoice_items (invoice_id, product_id, code, name, quantity, price, gst_rate, tax_amount, total_amount) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        [invoice.id, item.productId, item.code, item.name, item.quantity, item.price, item.gstRate, item.taxAmount, item.totalAmount]
      );
    }
    return invoice;
  }

  async update(id: string, inv: Partial<SalesInvoice>): Promise<SalesInvoice> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    if (inv.customerId !== undefined) { fields.push(`customer_id = $${paramIndex++}`); values.push(inv.customerId); }
    if (inv.status !== undefined) { fields.push(`status = $${paramIndex++}`); values.push(inv.status); }
    if (inv.isInterstate !== undefined) { fields.push(`is_interstate = $${paramIndex++}`); values.push(inv.isInterstate); }
    if (inv.eWayBillNo !== undefined) { fields.push(`eway_bill_no = $${paramIndex++}`); values.push(inv.eWayBillNo); }
    if (inv.date !== undefined) { fields.push(`date = $${paramIndex++}`); values.push(new Date(inv.date)); }
    if (inv.taxTotal !== undefined) { fields.push(`tax_total = $${paramIndex++}`); values.push(inv.taxTotal); }
    if (inv.grandTotal !== undefined) { fields.push(`grand_total = $${paramIndex++}`); values.push(inv.grandTotal); }

    if (fields.length > 0) {
      values.push(id);
      await pool.query(`UPDATE sales_invoices SET ${fields.join(", ")}, modified_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex}`, values);
    }

    if (inv.items !== undefined) {
      await pool.query("DELETE FROM sales_invoice_items WHERE invoice_id = $1", [id]);
      for (const item of inv.items) {
        await pool.query(
          "INSERT INTO sales_invoice_items (invoice_id, product_id, code, name, quantity, price, gst_rate, tax_amount, total_amount) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
          [id, item.productId, item.code, item.name, item.quantity, item.price, item.gstRate, item.taxAmount, item.totalAmount]
        );
      }
    }

    const updated = await this.getById(id);
    if (!updated) throw new Error("Invoice not found after update");
    return updated;
  }
}

export class PostgresAuditRepository implements IAuditRepository {
  async getAll(): Promise<AuditLog[]> {
    const res = await pool.query("SELECT * FROM audit_logs ORDER BY created_at DESC");
    return res.rows.map(row => ({
      id: String(row.id),
      timestamp: row.created_at,
      operator: row.operator,
      actionType: row.action_type,
      tableName: row.table_name,
      recordId: row.record_id,
      oldValue: JSON.stringify(row.old_value),
      newValue: JSON.stringify(row.new_value),
      reason: row.reason
    }));
  }

  async log(audit: Omit<AuditLog, "id">): Promise<void> {
    let oldVal: any = {};
    let newVal: any = {};
    try {
      if (audit.oldValue && audit.oldValue !== "None") {
        oldVal = JSON.parse(audit.oldValue);
      }
    } catch {
      oldVal = { value: audit.oldValue };
    }
    try {
      if (audit.newValue && audit.newValue !== "None") {
        newVal = JSON.parse(audit.newValue);
      }
    } catch {
      newVal = { value: audit.newValue };
    }

    await pool.query(`
      INSERT INTO audit_logs (operator, action_type, table_name, record_id, old_value, new_value, reason)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [audit.operator, audit.actionType, audit.tableName, audit.recordId, oldVal, newVal, audit.reason]);
  }
}

export class PostgresSyncRepository implements ISyncRepository {
  async getQueue(): Promise<SyncQueueItem[]> {
    const res = await pool.query("SELECT * FROM sync_queue WHERE status != 'synced' ORDER BY created_at ASC");
    return res.rows.map(row => ({
      id: row.id,
      uuid: row.uuid,
      module: row.module,
      operation: row.operation,
      entity: row.entity,
      payload: JSON.stringify(row.payload),
      status: row.status,
      retryCount: row.retry_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastAttempt: row.last_attempt,
      deviceId: row.device_id,
      companyId: row.company_id,
      branchId: row.branch_id
    }));
  }

  async enqueue(item: Omit<SyncQueueItem, "id" | "status" | "retryCount" | "createdAt" | "updatedAt">): Promise<SyncQueueItem> {
    const uuid = item.uuid;
    const module = item.module;
    const operation = item.operation;
    const entity = item.entity;
    let payloadObj = {};
    try { payloadObj = JSON.parse(item.payload); } catch { payloadObj = item.payload; }

    const res = await pool.query(`
      INSERT INTO sync_queue (uuid, module, operation, entity, payload, status, retry_count, device_id, company_id, branch_id)
      VALUES ($1, $2, $3, $4, $5, 'pending', 0, $6, $7, $8)
      RETURNING id, uuid, module, operation, entity, payload::text, status, retry_count AS "retryCount",
                created_at AS "createdAt", updated_at AS "updatedAt", last_attempt AS "lastAttempt",
                device_id AS "deviceId", company_id AS "companyId", branch_id AS "branchId"
    `, [uuid, module, operation, entity, payloadObj, item.deviceId || null, item.companyId || null, item.branchId || null]);
    
    return res.rows[0];
  }

  async updateStatus(id: number, status: "pending" | "synced" | "failed", lastAttempt?: string): Promise<void> {
    await pool.query(`
      UPDATE sync_queue
      SET status = $2, last_attempt = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id, status, lastAttempt || new Date().toISOString()]);
  }

  async incrementRetry(id: number): Promise<void> {
    await pool.query(`
      UPDATE sync_queue
      SET retry_count = retry_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id]);
  }
}

export class PostgresUserRepository implements IUserRepository {
  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      userId: row.id,
      employeeId: "EMP-" + row.id,
      username: row.username,
      passwordHash: row.hashed_password,
      role: row.role === "MANAGER" ? "Store Manager" : (row.role === "CASHIER" ? "Cashier" : (row.role === "SYSADMIN" ? "Admin" : (row.role === "REPORT_USER" ? "Report User" : "Viewer"))),
      status: row.is_active ? "Active" : "Inactive",
      photo: "",
      fullName: row.username.toUpperCase(),
      displayName: row.username,
      employeeCode: "EMP-" + row.id,
      gender: "Male",
      dateOfBirth: "1990-01-01",
      mobile: row.mobile || "",
      email: row.email || "",
      emergencyContact: "",
      address: "",
      city: "",
      state: "",
      country: "India",
      pinCode: "",
      department: "Retail Operations",
      designation: row.role === "MANAGER" ? "Store Manager" : (row.role === "CASHIER" ? "Cashier" : "Staff"),
      branch: "HQ Store",
      dateOfJoining: new Date().toISOString().split("T")[0],
      reportingManager: "",
      employmentType: "Permanent",
      allowedBranches: ["HQ Store"],
      preferences: { theme: "dark", language: "English", timeZone: "Asia/Kolkata" },
      notificationSettings: {
        salaryCredit: true,
        commissionEarned: true,
        targetAchievement: true,
        travelClaimApproval: true,
        leaveApproval: true,
        attendanceAlerts: true,
        holidayWeeklyOff: true,
        birthdayAnniversary: true,
        policyAnnouncements: true
      }
    };
  }

  async getAll(): Promise<User[]> {
    const res = await pool.query("SELECT * FROM users WHERE is_deleted = false ORDER BY username ASC");
    return res.rows.map(row => this.mapRowToUser(row));
  }

  async getById(id: string): Promise<User | null> {
    const res = await pool.query("SELECT * FROM users WHERE id = $1 AND is_deleted = false", [id]);
    if (res.rows.length === 0) return null;
    return this.mapRowToUser(res.rows[0]);
  }

  async getByUsername(username: string): Promise<User | null> {
    const res = await pool.query("SELECT * FROM users WHERE username = $1 AND is_deleted = false", [username]);
    if (res.rows.length === 0) return null;
    return this.mapRowToUser(res.rows[0]);
  }

  async create(u: User): Promise<User> {
    const dbRole = u.role === "Store Manager" ? "MANAGER" : (u.role === "Cashier" ? "CASHIER" : (u.role === "Admin" ? "SYSADMIN" : (u.role === "Report User" ? "REPORT_USER" : "VIEWER")));
    await pool.query(`
      INSERT INTO users (id, uuid, username, email, mobile, hashed_password, role, is_active, is_deleted, created_at, modified_at)
      VALUES ($1, uuid_generate_v4()::varchar, $2, $3, $4, $5, $6, $7, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [u.id, u.username, u.email || null, u.mobile || null, u.passwordHash, dbRole, u.status === "Active"]);
    return u;
  }

  async update(id: string, u: Partial<User>): Promise<User> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    if (u.username !== undefined) { fields.push(`username = $${paramIndex++}`); values.push(u.username); }
    if (u.email !== undefined) { fields.push(`email = $${paramIndex++}`); values.push(u.email); }
    if (u.mobile !== undefined) { fields.push(`mobile = $${paramIndex++}`); values.push(u.mobile); }
    if (u.passwordHash !== undefined) { fields.push(`hashed_password = $${paramIndex++}`); values.push(u.passwordHash); }
    if (u.role !== undefined) {
      const dbRole = u.role === "Store Manager" ? "MANAGER" : (u.role === "Cashier" ? "CASHIER" : (u.role === "Admin" ? "SYSADMIN" : (u.role === "Report User" ? "REPORT_USER" : "VIEWER")));
      fields.push(`role = $${paramIndex++}`); values.push(dbRole);
    }
    if (u.status !== undefined) { fields.push(`is_active = $${paramIndex++}`); values.push(u.status === "Active"); }

    if (fields.length > 0) {
      values.push(id);
      await pool.query(`UPDATE users SET ${fields.join(", ")}, modified_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex}`, values);
    }
    const updated = await this.getById(id);
    if (!updated) throw new Error("User not found after update");
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const res = await pool.query("UPDATE users SET is_deleted = true, modified_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
    return (res.rowCount ?? 0) > 0;
  }
}

export class PostgresPOSProfileRepository implements IPOSProfileRepository {
  async getAll(): Promise<POSProfile[]> {
    const res = await pool.query("SELECT id, name, cashier, warehouse, is_locked AS \"isLocked\", is_archived AS \"isArchived\" FROM pos_profiles WHERE is_archived = false ORDER BY name ASC");
    return res.rows;
  }

  async getById(id: string): Promise<POSProfile | null> {
    const res = await pool.query("SELECT id, name, cashier, warehouse, is_locked AS \"isLocked\", is_archived AS \"isArchived\" FROM pos_profiles WHERE id = $1", [id]);
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  async create(p: POSProfile): Promise<POSProfile> {
    await pool.query(`
      INSERT INTO pos_profiles (id, name, cashier, warehouse, is_locked, is_archived)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [p.id, p.name, p.cashier, p.warehouse, p.isLocked || false, p.isArchived || false]);
    return p;
  }

  async update(id: string, p: Partial<POSProfile>): Promise<POSProfile> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    if (p.name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(p.name); }
    if (p.cashier !== undefined) { fields.push(`cashier = $${paramIndex++}`); values.push(p.cashier); }
    if (p.warehouse !== undefined) { fields.push(`warehouse = $${paramIndex++}`); values.push(p.warehouse); }
    if (p.isLocked !== undefined) { fields.push(`is_locked = $${paramIndex++}`); values.push(p.isLocked); }
    if (p.isArchived !== undefined) { fields.push(`is_archived = $${paramIndex++}`); values.push(p.isArchived); }

    if (fields.length > 0) {
      values.push(id);
      await pool.query(`UPDATE pos_profiles SET ${fields.join(", ")}, modified_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex}`, values);
    }
    const updated = await this.getById(id);
    if (!updated) throw new Error("Profile not found after update");
    return updated;
  }
}

export class PostgresPurchaseRepository implements IPurchaseRepository {
  async getAllSuppliers(): Promise<any[]> {
    const res = await pool.query("SELECT id, name, code AS \"vendorCode\", gst_number AS \"taxRegistrationNumber\", address, mobile, email FROM suppliers WHERE is_deleted = false ORDER BY name ASC");
    return res.rows.map(row => ({
      id: row.id,
      name: row.name,
      vendorCode: row.vendorCode,
      taxRegistrationNumber: row.taxRegistrationNumber || "",
      category: "General",
      address: row.address || "",
      contactDetails: `Mobile: ${row.mobile || ""}, Email: ${row.email || ""}`
    }));
  }

  async getSupplierById(id: string): Promise<any | null> {
    const res = await pool.query("SELECT id, name, code AS \"vendorCode\", gst_number AS \"taxRegistrationNumber\", address, mobile, email FROM suppliers WHERE id = $1 AND is_deleted = false", [id]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      name: row.name,
      vendorCode: row.vendorCode,
      taxRegistrationNumber: row.taxRegistrationNumber || "",
      category: "General",
      address: row.address || "",
      contactDetails: `Mobile: ${row.mobile || ""}, Email: ${row.email || ""}`
    };
  }

  async createSupplier(s: any): Promise<any> {
    const mobileMatch = s.contactDetails?.match(/Mobile:\s*([^\s,]+)/);
    const emailMatch = s.contactDetails?.match(/Email:\s*([^\s,]+)/);
    const mobile = mobileMatch ? mobileMatch[1] : null;
    const email = emailMatch ? emailMatch[1] : null;
    
    await pool.query(`
      INSERT INTO suppliers (id, uuid, name, code, gst_number, address, mobile, email, outstanding)
      VALUES ($1, uuid_generate_v4()::varchar, $2, $3, $4, $5, $6, $7, 0)
    `, [s.id, s.name, s.vendorCode, s.taxRegistrationNumber || null, s.address || null, mobile, email]);
    return s;
  }

  async updateSupplier(id: string, s: Partial<any>): Promise<any> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    if (s.name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(s.name); }
    if (s.vendorCode !== undefined) { fields.push(`code = $${paramIndex++}`); values.push(s.vendorCode); }
    if (s.taxRegistrationNumber !== undefined) { fields.push(`gst_number = $${paramIndex++}`); values.push(s.taxRegistrationNumber); }
    if (s.address !== undefined) { fields.push(`address = $${paramIndex++}`); values.push(s.address); }
    if (s.contactDetails !== undefined) {
      const mobileMatch = s.contactDetails?.match(/Mobile:\s*([^\s,]+)/);
      const emailMatch = s.contactDetails?.match(/Email:\s*([^\s,]+)/);
      const mobile = mobileMatch ? mobileMatch[1] : null;
      const email = emailMatch ? emailMatch[1] : null;
      fields.push(`mobile = $${paramIndex++}`); values.push(mobile);
      fields.push(`email = $${paramIndex++}`); values.push(email);
    }

    if (fields.length > 0) {
      values.push(id);
      await pool.query(`UPDATE suppliers SET ${fields.join(", ")}, modified_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex}`, values);
    }
    return this.getSupplierById(id);
  }

  async deleteSupplier(id: string): Promise<boolean> {
    const res = await pool.query("UPDATE suppliers SET is_deleted = true, modified_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
    return (res.rowCount ?? 0) > 0;
  }

  async getAllOrders(): Promise<any[]> {
    const res = await pool.query(`
      SELECT po.id, po.order_no AS "orderNo", po.created_at AS "date",
             po.supplier_id AS "supplierId", s.name AS "supplierName",
             po.status, po.notes AS "remarks", po.tax_total AS "taxTotal", po.grand_total AS "grandTotal"
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.is_deleted = false
      ORDER BY po.created_at DESC
    `);
    const orders = [];
    for (const row of res.rows) {
      const itemsRes = await pool.query(`
        SELECT poi.product_id AS "productId", poi.code, poi.name,
               poi.quantity, poi.cost_price AS "price", poi.gst_rate AS "taxRate",
               poi.tax_amount AS "taxAmount", poi.line_total AS "totalAmount"
        FROM purchase_order_items poi
        WHERE poi.order_id = $1
      `, [row.id]);
      orders.push({
        ...row,
        items: itemsRes.rows.map(item => ({
          ...item,
          quantity: parseFloat(item.quantity) || 0,
          price: parseFloat(item.price) || 0,
          taxRate: parseFloat(item.taxRate) || 0,
          taxAmount: parseFloat(item.taxAmount) || 0,
          totalAmount: parseFloat(item.totalAmount) || 0,
          receivedQuantity: 0
        })),
        taxTotal: parseFloat(row.taxTotal) || 0,
        grandTotal: parseFloat(row.grandTotal) || 0,
        paidAmount: 0,
        receivedPercentage: 0,
        expectedDeliveryDate: new Date().toISOString().split("T")[0]
      });
    }
    return orders;
  }

  async getOrderById(id: string): Promise<any | null> {
    const res = await pool.query(`
      SELECT po.id, po.order_no AS "orderNo", po.created_at AS "date",
             po.supplier_id AS "supplierId", s.name AS "supplierName",
             po.status, po.notes AS "remarks", po.tax_total AS "taxTotal", po.grand_total AS "grandTotal"
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.id = $1 AND po.is_deleted = false
    `, [id]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    const itemsRes = await pool.query(`
      SELECT poi.product_id AS "productId", poi.code, poi.name,
             poi.quantity, poi.cost_price AS "price", poi.gst_rate AS "taxRate",
             poi.tax_amount AS "taxAmount", poi.line_total AS "totalAmount"
      FROM purchase_order_items poi
      WHERE poi.order_id = $1
    `, [id]);
    return {
      ...row,
      items: itemsRes.rows.map(item => ({
        ...item,
        quantity: parseFloat(item.quantity) || 0,
        price: parseFloat(item.price) || 0,
        taxRate: parseFloat(item.taxRate) || 0,
        taxAmount: parseFloat(item.taxAmount) || 0,
        totalAmount: parseFloat(item.totalAmount) || 0,
        receivedQuantity: 0
      })),
      taxTotal: parseFloat(row.taxTotal) || 0,
      grandTotal: parseFloat(row.grandTotal) || 0,
      paidAmount: 0,
      receivedPercentage: 0,
      expectedDeliveryDate: new Date().toISOString().split("T")[0]
    };
  }

  async createOrder(po: any): Promise<any> {
    await pool.query(`
      INSERT INTO purchase_orders (id, uuid, order_no, supplier_id, status, notes, tax_total, grand_total, created_at, modified_at)
      VALUES ($1, uuid_generate_v4()::varchar, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [po.id, po.orderNo, po.supplierId, po.status, po.remarks || "", po.taxTotal || 0, po.grandTotal || 0]);
    
    for (const item of po.items) {
      await pool.query(`
        INSERT INTO purchase_order_items (id, uuid, order_id, product_id, code, name, quantity, cost_price, gst_rate, tax_amount, line_total)
        VALUES ($1, uuid_generate_v4()::varchar, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [`poi-${Date.now()}-${Math.floor(Math.random()*1000)}`, po.id, item.productId, item.code, item.name, item.quantity, item.price, item.taxRate || 18, item.taxAmount || 0, item.totalAmount]);
    }
    return po;
  }

  async updateOrder(id: string, po: Partial<any>): Promise<any> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    if (po.status !== undefined) { fields.push(`status = $${paramIndex++}`); values.push(po.status); }
    if (po.remarks !== undefined) { fields.push(`notes = $${paramIndex++}`); values.push(po.remarks); }
    if (po.taxTotal !== undefined) { fields.push(`tax_total = $${paramIndex++}`); values.push(po.taxTotal); }
    if (po.grandTotal !== undefined) { fields.push(`grand_total = $${paramIndex++}`); values.push(po.grandTotal); }

    if (fields.length > 0) {
      values.push(id);
      await pool.query(`UPDATE purchase_orders SET ${fields.join(", ")}, modified_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex}`, values);
    }
    return this.getOrderById(id);
  }

  async getAllReceipts(): Promise<any[]> {
    const res = await pool.query(`
      SELECT pr.id, pr.receipt_no AS "receiptNo", pr.created_at AS "date",
             pr.order_id AS "purchaseOrderId", s.name AS "supplierName"
      FROM purchase_receipts pr
      LEFT JOIN suppliers s ON pr.supplier_id = s.id
      ORDER BY pr.created_at DESC
    `);
    const receipts = [];
    for (const row of res.rows) {
      const itemsRes = await pool.query(`
        SELECT pri.product_id AS "productId", pri.code, pri.name, pri.quantity_received AS "quantityReceived"
        FROM purchase_receipt_items pri
        WHERE pri.receipt_id = $1
      `, [row.id]);
      receipts.push({
        ...row,
        items: itemsRes.rows.map(item => ({
          ...item,
          quantityReceived: parseFloat(item.quantityReceived) || 0
        }))
      });
    }
    return receipts;
  }

  async getReceiptById(id: string): Promise<any | null> {
    const res = await pool.query(`
      SELECT pr.id, pr.receipt_no AS "receiptNo", pr.created_at AS "date",
             pr.order_id AS "purchaseOrderId", s.name AS "supplierName"
      FROM purchase_receipts pr
      LEFT JOIN suppliers s ON pr.supplier_id = s.id
      WHERE pr.id = $1
    `, [id]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    const itemsRes = await pool.query(`
      SELECT pri.product_id AS "productId", pri.code, pri.name, pri.quantity_received AS "quantityReceived"
      FROM purchase_receipt_items pri
      WHERE pri.receipt_id = $1
    `, [id]);
    return {
      ...row,
      items: itemsRes.rows.map(item => ({
        ...item,
        quantityReceived: parseFloat(item.quantityReceived) || 0
      }))
    };
  }

  async createReceipt(r: any): Promise<any> {
    let supplierId = "";
    const po = await this.getOrderById(r.purchaseOrderId);
    if (po) {
      supplierId = po.supplierId;
    } else {
      const firstSup = await pool.query("SELECT id FROM suppliers LIMIT 1");
      supplierId = firstSup.rows[0]?.id || "";
    }

    await pool.query(`
      INSERT INTO purchase_receipts (id, uuid, receipt_no, supplier_id, order_id, status, created_at, modified_at)
      VALUES ($1, uuid_generate_v4()::varchar, $2, $3, $4, 'RECEIVED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [r.id, r.receiptNo, supplierId, r.purchaseOrderId || null]);

    for (const item of r.items) {
      await pool.query(`
        INSERT INTO purchase_receipt_items (id, uuid, receipt_id, product_id, code, name, quantity_received, cost_price, line_total)
        VALUES ($1, uuid_generate_v4()::varchar, $2, $3, $4, $5, $6, 0, 0)
      `, [`pri-${Date.now()}-${Math.floor(Math.random()*1000)}`, r.id, item.productId, item.code, item.name, item.quantityReceived]);
    }
    return r;
  }

  async updateReceipt(id: string, r: Partial<any>): Promise<any> {
    return this.getReceiptById(id);
  }
}

export class PostgresStateRepository implements IStateRepository {
  async getCollection(name: string): Promise<any[]> {
    return (store as any)[name] || [];
  }
  async saveCollection(name: string, data: any[]): Promise<void> {
    const target = (store as any)[name];
    if (Array.isArray(target)) {
      target.length = 0;
      target.push(...data);
    } else {
      throw new Error(`Cannot reassign non-array collection: ${name}`);
    }
    store.saveDb();
  }
  async saveDb(): Promise<void> {
    store.saveDb();
  }
}


