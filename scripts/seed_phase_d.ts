/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-13
 * Modified     : 2026-07-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { pool } from "../src/db/pool.js";
import { MasterRepository } from "../src/repositories/masterRepository.js";

async function run() {
  console.log("Seeding Phase D master types...");
  const repo = new MasterRepository();

  // 1. Bank
  const bankSchema = {
    type: "object",
    properties: {
      account_no: { type: "string" },
      ifsc: { type: "string" }
    },
    additionalProperties: false
  };
  const existingBank = await repo.getMasterType("bank");
  if (!existingBank) {
    console.log("Creating 'bank' master type...");
    await repo.createMasterType({
      code: "bank",
      label: "Bank",
      field_schema: bankSchema
    });
  } else {
    console.log("Updating 'bank' field_schema...");
    await pool.query("UPDATE master_types SET field_schema = $1 WHERE code = $2", [JSON.stringify(bankSchema), "bank"]);
  }

  // 2. Payment Mode
  const paymentModeSchema = {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["Cash", "Card", "UPI", "Wallet", "Bank Transfer"]
      }
    },
    additionalProperties: false
  };
  const existingMode = await repo.getMasterType("payment_mode");
  if (!existingMode) {
    console.log("Creating 'payment_mode' master type...");
    await repo.createMasterType({
      code: "payment_mode",
      label: "Payment Mode",
      field_schema: paymentModeSchema
    });
  } else {
    console.log("Updating 'payment_mode' field_schema...");
    await pool.query("UPDATE master_types SET field_schema = $1 WHERE code = $2", [JSON.stringify(paymentModeSchema), "payment_mode"]);
  }

  // 3. Currency
  const currencySchema = {
    type: "object",
    properties: {
      symbol: { type: "string" }
    },
    additionalProperties: false
  };
  const existingCurrency = await repo.getMasterType("currency");
  if (!existingCurrency) {
    console.log("Creating 'currency' master type...");
    await repo.createMasterType({
      code: "currency",
      label: "Currency",
      field_schema: currencySchema
    });
  } else {
    console.log("Updating 'currency' field_schema...");
    await pool.query("UPDATE master_types SET field_schema = $1 WHERE code = $2", [JSON.stringify(currencySchema), "currency"]);
  }

  // 4. Expense Category
  const expenseCategorySchema = {
    type: "object",
    properties: {},
    additionalProperties: false
  };
  const existingExpense = await repo.getMasterType("expense_category");
  if (!existingExpense) {
    console.log("Creating 'expense_category' master type...");
    await repo.createMasterType({
      code: "expense_category",
      label: "Expense Category",
      field_schema: expenseCategorySchema
    });
  } else {
    console.log("Updating 'expense_category' field_schema...");
    await pool.query("UPDATE master_types SET field_schema = $1 WHERE code = $2", [JSON.stringify(expenseCategorySchema), "expense_category"]);
  }

  console.log("Phase D master types seeded successfully.");
  await pool.end();
}

run().catch(err => {
  console.error("Failed to seed Phase D master types:", err);
  process.exit(1);
});
