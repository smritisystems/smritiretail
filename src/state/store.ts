/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-12
 * Modified     : 2026-07-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import fs from "fs";
import path from "path";
import { hashPassword } from "../lib/helpers.js";
import { initialSalesInvoices, initialSalesReturns } from "../services/customerStore.js";
import { Product, POSProfile, Shift, FieldInfo, Formula, PSVParty, Bill, Quotation, SalesOrder, SalesInvoice, SalesReturn, Customer, CustomerGroup, User } from "../types.js";

const DB_FILE = path.join(process.cwd(), "db_store.json");

// Define state arrays

// TODO: migrate to DB in Phase 2b
export let tallyExportQueue: any[] = [];



// TODO: migrate to DB in Phase 2b


// TODO: migrate to DB in Phase 2b
export let partnersList: any[] = [];

// TODO: migrate to DB in Phase 2b
export let transformationMappings: any[] = [];

// TODO: migrate to DB in Phase 2b
export let exchangeLogs: any[] = [];

export let ledgerEntries: any[] = [];
export let stockLedger: any[] = [];
export let auditLogs: any[] = [];
export let products: Product[] = [];
export let profiles: POSProfile[] = [];
export let shifts: Shift[] = [];
export let bills: Bill[] = [];
export let holdBills: Bill[] = [];
export let quotations: Quotation[] = [];
export let salesOrders: SalesOrder[] = [];
export let salesInvoices: SalesInvoice[] = [...initialSalesInvoices];
export let salesReturns: SalesReturn[] = [...initialSalesReturns];

// TODO: migrate to DB in Phase 2b
export let fields: FieldInfo[] = [];

// TODO: migrate to DB in Phase 2b
export let formulas: Formula[] = [];

// TODO: migrate to DB in Phase 2b
export let psvParties: PSVParty[] = [];

// TODO: migrate to DB in Phase 2b
export let companyState: string | null = "DL";

export let suppliers: any[] = [];
export let purchaseOrders: any[] = [];
export let goodsReceipts: any[] = [];
export let attributeDefinitions: any[] = [];
export let attributeGroups: any[] = [];
export let variantTemplates: any[] = [];
export let categoryAttributeGroupMappings: any[] = [];



export let users: User[] = [];
export let roles: { name: string; permissions: string[] }[] = [];
export let companies: any[] = [];
export let branches: any[] = [];

// TODO: migrate to DB in Phase 2b
export let reportSchedules: any[] = [];

export let customers: Customer[] = [];
export let customerGroups: CustomerGroup[] = [];

export const sessions: Record<string, {
  username: string;
  userId: string;
  name: string;
  role: string;
  userAgent?: string;
  deviceType?: "desktop" | "mobile" | "tablet";
  ipAddress?: string;
  loginAt?: string;
  expiresAt?: string;
}> = {};

// Save database state
export function saveDb() {
  try {
    const data = {
      tallyExportQueue,
      partnersList,
      transformationMappings,
      exchangeLogs,
      ledgerEntries,
      auditLogs,
      profiles,
      bills,
      holdBills,
      quotations,
      salesOrders,
      salesInvoices,
      salesReturns,
      fields,
      formulas,
      psvParties,
      companyState,
      goodsReceipts,
      attributeDefinitions,
      attributeGroups,
      variantTemplates,
      categoryAttributeGroupMappings,

      roles,
      reportSchedules
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("Failed to write to file database:", e);
  }
}

// Load database state
export function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf8");
      const data = JSON.parse(raw);
      if (data.tallyExportQueue) tallyExportQueue = data.tallyExportQueue;

      if (data.partnersList) partnersList = data.partnersList;
      if (data.transformationMappings) {
        transformationMappings.length = 0;
        transformationMappings.push(...data.transformationMappings);
      }
      if (data.exchangeLogs) exchangeLogs = data.exchangeLogs;
      if (data.ledgerEntries) ledgerEntries = data.ledgerEntries;
      if (data.auditLogs) auditLogs = data.auditLogs;
      if (data.profiles) profiles = data.profiles;
      if (data.bills) bills = data.bills;
      if (data.holdBills) holdBills = data.holdBills;
      if (data.quotations) quotations = data.quotations;
      if (data.salesOrders) salesOrders = data.salesOrders;
      if (data.salesInvoices) salesInvoices = data.salesInvoices;
      if (data.salesReturns) salesReturns = data.salesReturns;
      if (data.fields) fields = data.fields;
      if (data.formulas) formulas = data.formulas;
      if (data.psvParties) psvParties = data.psvParties;
      if (data.companyState !== undefined) companyState = data.companyState;
      if (data.goodsReceipts) goodsReceipts = data.goodsReceipts;
      if (data.attributeDefinitions) attributeDefinitions = data.attributeDefinitions;
      if (data.attributeGroups) attributeGroups = data.attributeGroups;
      if (data.variantTemplates) variantTemplates = data.variantTemplates;
      if (data.categoryAttributeGroupMappings) categoryAttributeGroupMappings = data.categoryAttributeGroupMappings;

      if (data.roles) roles = data.roles;
      if (data.reportSchedules) reportSchedules = data.reportSchedules;

      saveDb();
      console.log("[Local DB] Loaded data successfully from disk!");
    } else {
      console.log("[Local DB] No database file found on disk. Initializing with default seeded data...");
      saveDb();
    }
  } catch (e) {
    console.warn("\n" + "=".repeat(80));
    console.warn("⚠️  SMRITI SYSTEM WARNING: FLAT-FILE DATABASE PARSE FAILURE  ⚠️");
    console.warn("The database JSON file on disk was corrupted or unreadable.");
    console.warn("Error message:", e instanceof Error ? e.message : String(e));
    console.warn("Resetting and overwriting local disk database with current in-memory seeded state.");
    console.warn("=".repeat(80) + "\n");
    try {
      saveDb();
    } catch (saveError) {
      console.error("Critical recovery failed: Unable to overwrite database on disk:", saveError);
    }
  }
}

// Initial Database Seeding & Migration
export function migrateUsersAndSeedOrganizationData() {
  // Seed default roles if they don't exist
  if (!roles.find(r => r.name === "Store Manager")) {
    roles.push({
      name: "Store Manager",
      permissions: [
        "pos.sell",
        "inventory.view",
        "reports.view",
        "staff.manage",
        "settings.manage",
        "purchase.write",
        "roles.manage"
      ]
    });
  }
  if (!roles.find(r => r.name === "Cashier")) {
    roles.push({
      name: "Cashier",
      permissions: [
        "pos.sell",
        "inventory.view",
        "reports.view"
      ]
    });
  }
  if (!roles.find(r => r.name === "Report User")) {
    roles.push({
      name: "Report User",
      permissions: [
        "reports.view",
        "reports.print",
        "reports.export",
        "reports.email",
        "reports.schedule"
      ]
    });
  }

  // Seed default users if they don't exist
  if (!users.find(u => u.username === "super")) {
    users.push({
      id: "usr-super",
      userId: "usr-super",
      employeeId: "EMP-001",
      username: "super",
      passwordHash: "whynothing", // Will be hashed in the self-healing block below
      role: "Admin",
      status: "Active",
      photo: "",
      fullName: "SYSTEM ADMINISTRATOR",
      displayName: "Super",
      employeeCode: "EMP-001",
      gender: "Male",
      dateOfBirth: "1980-01-01",
      mobile: "9999999999",
      email: "super@smritibooks.com",
      emergencyContact: "",
      address: "System Root",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
      pinCode: "400001",
      department: "Management",
      designation: "Administrator",
      branch: "HQ Store",
      dateOfJoining: "2026-07-10",
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
    });
  }

  if (!users.find(u => u.username === "manager")) {
    users.push({
      id: "usr-manager",
      userId: "usr-manager",
      employeeId: "EMP-002",
      username: "manager",
      passwordHash: "Password@123",
      role: "Store Manager",
      status: "Active",
      photo: "",
      fullName: "STORE MANAGER",
      displayName: "Manager",
      employeeCode: "EMP-002",
      gender: "Male",
      dateOfBirth: "1985-05-15",
      mobile: "9876543210",
      email: "manager@smritibooks.com",
      emergencyContact: "",
      address: "HQ Store Area",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
      pinCode: "400001",
      department: "Retail Operations",
      designation: "Store Manager",
      branch: "HQ Store",
      dateOfJoining: "2026-07-10",
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
    });
  }

  if (!users.find(u => u.username === "cashier")) {
    users.push({
      id: "usr-cashier",
      userId: "usr-cashier",
      employeeId: "EMP-003",
      username: "cashier",
      passwordHash: "cashier123",
      role: "Cashier",
      status: "Active",
      photo: "",
      fullName: "CASHIER OPERATOR",
      displayName: "Cashier",
      employeeCode: "EMP-003",
      gender: "Female",
      dateOfBirth: "1992-08-20",
      mobile: "9876543211",
      email: "cashier@smritibooks.com",
      emergencyContact: "",
      address: "Billing Counter 1",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
      pinCode: "400001",
      department: "Billing Desk",
      designation: "Cashier",
      branch: "HQ Store",
      dateOfJoining: "2026-07-10",
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
    });
  }

  // 1. Seed Company if empty
  if (companies.length === 0) {
    companies.push({
      id: "comp-default",
      code: "SMRITI_IND",
      name: "SMRITI India Retail Pvt Ltd",
      abbr: "SMRITI",
      tax_id: "27AAAAA1111A1Z1",
      currency: "INR",
      address: "Corporate Headquarters, Mumbai",
      status: "Active",
      created_at: new Date().toISOString()
    });
  }

  // 2. Migrate User Records to store departmentId, designationId, branchId
  users.forEach((user: any) => {
    // Branch Migration
    if (user.branch && typeof user.branch === "string" && !user.branchId) {
      const branchName = user.branch;
      let bRecord = branches.find(b => b.name.toLowerCase() === branchName.toLowerCase());
      if (!bRecord) {
        bRecord = {
          id: "br-" + Math.random().toString(36).substr(2, 6),
          code: branchName.split(" ")[0].substring(0, 4).toUpperCase() + Math.floor(10 + Math.random() * 90),
          name: branchName,
          company: "comp-default",
          address: branchName + " Area",
          status: "Active",
          created_at: new Date().toISOString()
        };
        branches.push(bRecord);
      }
      user.branchId = bRecord.id;
      delete user.branch;
    }

    // Password Hashing Migration (Self-Healing)
    if (user.passwordHash && !user.passwordHash.startsWith("pbkdf2$")) {
      user.passwordHash = hashPassword(user.passwordHash);
    }
  });



  // 4. Seed Customer Groups if empty
  if (customerGroups.length === 0) {
    customerGroups.push(
      {
        id: "CG-Retail",
        name: "Retail Customers",
        creditLimit: 20000,
        unlimitedCredit: false,
        creditDays: 0,
        graceDays: 2,
        creditHold: false,
        autoBlockSales: true,
        warningThresholdPercent: 80,
        allowOverride: false,
        taxInclusive: true,
        maxDiscountPercent: 10,
        minMarginPercent: 15,
        roundingRule: "Nearest1",
        allowedPaymentMethods: ["Cash", "UPI", "Card"],
        preferredPaymentMethod: "UPI",
        allowBackOrders: false,
        allowNegativeStockSales: false,
        requirePoNumber: false,
        invoiceLanguage: "en",
        canViewPrice: true,
        canViewMargin: false,
        canPurchaseOnCredit: false,
        canReceiveDiscount: true,
      },
      {
        id: "CG-Corporate",
        name: "Corporate Clients",
        creditLimit: 500000,
        unlimitedCredit: false,
        creditDays: 30,
        graceDays: 7,
        creditHold: false,
        autoBlockSales: true,
        warningThresholdPercent: 85,
        allowOverride: true,
        taxInclusive: false,
        maxDiscountPercent: 20,
        minMarginPercent: 10,
        roundingRule: "None",
        allowedPaymentMethods: ["Cash", "UPI", "Card", "BankTransfer"],
        preferredPaymentMethod: "BankTransfer",
        allowBackOrders: true,
        allowNegativeStockSales: false,
        requirePoNumber: true,
        invoiceLanguage: "en",
        canViewPrice: true,
        canViewMargin: true,
        canPurchaseOnCredit: true,
        canReceiveDiscount: true,
      },
      {
        id: "CG-LargeRetail",
        name: "Large-Format Retail",
        creditLimit: 1000000,
        unlimitedCredit: false,
        creditDays: 60,
        graceDays: 15,
        creditHold: false,
        autoBlockSales: true,
        warningThresholdPercent: 90,
        allowOverride: true,
        taxInclusive: false,
        maxDiscountPercent: 25,
        minMarginPercent: 8,
        roundingRule: "None",
        allowedPaymentMethods: ["BankTransfer", "Cheque"],
        preferredPaymentMethod: "BankTransfer",
        allowBackOrders: true,
        allowNegativeStockSales: true,
        requirePoNumber: true,
        invoiceLanguage: "en",
        canViewPrice: true,
        canViewMargin: true,
        canPurchaseOnCredit: true,
        canReceiveDiscount: true,
      },
      {
        id: "CG-Branches",
        name: "Internal Branches",
        creditLimit: 0,
        unlimitedCredit: true,
        creditDays: 90,
        graceDays: 30,
        creditHold: false,
        autoBlockSales: false,
        warningThresholdPercent: 95,
        allowOverride: true,
        taxInclusive: true,
        maxDiscountPercent: 0,
        minMarginPercent: 0,
        roundingRule: "Nearest1",
        allowedPaymentMethods: ["Cash", "UPI", "BankTransfer"],
        preferredPaymentMethod: "BankTransfer",
        allowBackOrders: true,
        allowNegativeStockSales: true,
        requirePoNumber: false,
        invoiceLanguage: "en",
        canViewPrice: true,
        canViewMargin: true,
        canPurchaseOnCredit: true,
        canReceiveDiscount: false,
      },
      {
        id: "CG-Franchises",
        name: "Franchise Partners",
        creditLimit: 300000,
        unlimitedCredit: false,
        creditDays: 45,
        graceDays: 10,
        creditHold: false,
        autoBlockSales: true,
        warningThresholdPercent: 80,
        allowOverride: true,
        taxInclusive: true,
        maxDiscountPercent: 15,
        minMarginPercent: 12,
        roundingRule: "Nearest1",
        allowedPaymentMethods: ["Cash", "UPI", "BankTransfer"],
        preferredPaymentMethod: "BankTransfer",
        allowBackOrders: true,
        allowNegativeStockSales: false,
        requirePoNumber: false,
        invoiceLanguage: "en",
        canViewPrice: true,
        canViewMargin: false,
        canPurchaseOnCredit: true,
        canReceiveDiscount: true,
      }
    );
  }

  // 5. Seed Customers if empty
  if (customers.length === 0) {
    customers.push(
      {
        id: "CUST-001",
        customerGroupId: "CG-Retail",
        name: "Rahul Sharma",
        mobile: "9876543210",
        email: "rahul.sharma@gmail.com",
        outstanding: 15000,
        status: "Active",
        createdDate: "2026-07-10",
        tags: ["VIP", "Retail"],
      },
      {
        id: "CUST-002",
        customerGroupId: "CG-LargeRetail",
        name: "Super Textiles Ltd",
        mobile: "9988776655",
        email: "finance@supertextiles.com",
        gstNumber: "27AAACS1094J1Z3",
        outstanding: 450000,
        status: "Active",
        createdDate: "2026-07-10",
        tags: ["Wholesale", "Corporate"],
      },
      {
        id: "CUST-003",
        customerGroupId: "CG-Branches",
        name: "Branch - South Delhi",
        mobile: "9911223344",
        email: "southdelhi@smriti.com",
        outstanding: 0,
        status: "Active",
        createdDate: "2026-07-10",
        tags: ["Internal", "Branch"],
      },
      {
        id: "CUST-004",
        customerGroupId: "CG-Franchises",
        name: "Franchise - Mumbai Central",
        mobile: "9922334455",
        email: "mumbaifranchise@smriti.com",
        outstanding: 120000,
        status: "Active",
        createdDate: "2026-07-10",
        tags: ["Franchise", "Premium"],
      },
      {
        id: "CUST-005",
        customerGroupId: "CG-LargeRetail",
        name: "Reliance Retail",
        mobile: "9822334455",
        email: "operations@relianceretail.com",
        gstNumber: "27AAACR1234F1Z1",
        outstanding: 180000,
        status: "Active",
        createdDate: "2026-07-10",
        tags: ["Wholesale", "Key-Account"],
      },
      {
        id: "CUST-006",
        customerGroupId: "CG-LargeRetail",
        name: "Shoppers Stop",
        mobile: "9833445566",
        email: "billing@shoppersstop.com",
        gstNumber: "27AAACS4321E1Z2",
        outstanding: 250000,
        status: "Active",
        createdDate: "2026-07-10",
        tags: ["Key-Account"],
      },
      {
        id: "CUST-007",
        customerGroupId: "CG-LargeRetail",
        name: "Lifestyle Stores",
        mobile: "9844556677",
        email: "accounts@lifestylestores.com",
        gstNumber: "27AAACL5678A1Z3",
        outstanding: 320000,
        status: "Active",
        createdDate: "2026-07-10",
        tags: ["Wholesale"],
      }
    );
  }
}

// Automatically load database state when the store starts up
loadDb();
