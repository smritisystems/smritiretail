/**
 * Project      : SMRITI Retail OS
 * System       : Universal Platform Registry (UPR) / Configuration Kernel
 * Component    : SmritiDemoDataRegistry (SCS-DEMO-001 Governance Standard)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Standard     : SCS-DEMO-001 — Demo Data Governance Standard
 * Version      : 1.0.0
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

export interface DemoAddress {
  line1: string;
  line2: string;
  city: string;
  district: string;
  state: string;
  stateCode: string;
  pinCode: string;
  country: string;
}

export interface DemoCompany {
  name: string;
  legalEntity: string;
  website: string;
  email: string;
  phone: string;
  gstin: string;
  pan: string;
  cin?: string;
  address: DemoAddress;
}

export interface DemoBranch {
  id: string;
  name: string;
  code: string;
  phone: string;
  email: string;
  address: DemoAddress;
}

export interface DemoWarehouse {
  id: string;
  name: string;
  code: string;
  contactPerson: string;
  phone: string;
  address: DemoAddress;
}

export interface DemoCustomer {
  id: string;
  name: string;
  companyName: string;
  mobile: string;
  email: string;
  gstin: string;
  address: DemoAddress;
}

export interface DemoSupplier {
  id: string;
  name: string;
  code: string;
  contactPerson: string;
  mobile: string;
  email: string;
  gstin: string;
  address: DemoAddress;
}

export interface DemoBank {
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
  upiId: string;
}

export interface DemoTax {
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  hsnCode: string;
}

export interface DemoItem {
  sku: string;
  code: string;
  name: string;
  category: string;
  brand: string;
  uom: string;
  mrp: number;
  salePrice: number;
  purchaseCost: number;
  hsnCode: string;
  barcode: string;
}

export interface DemoTransport {
  transporterName: string;
  transportId: string;
  vehicleNo: string;
  lrNumber: string;
}

export class SmritiDemoDataRegistryService {
  private _company: DemoCompany;
  private _branch: DemoBranch;
  private _warehouse: DemoWarehouse;
  private _customer: DemoCustomer;
  private _supplier: DemoSupplier;
  private _bank: DemoBank;
  private _tax: DemoTax;
  private _item: DemoItem;
  private _transport: DemoTransport;

  constructor() {
    const companyAddress: DemoAddress = {
      line1: "Gram Belwavadari",
      line2: "Taramandal",
      city: "Gorakhpur",
      district: "Gorakhpur",
      state: "Uttar Pradesh",
      stateCode: "09",
      pinCode: "273017",
      country: "India",
    };

    this._company = {
      name: "SMRITI Systems",
      legalEntity: "Private Limited Company",
      website: "https://smritisys.com",
      email: "support@smritisys.com",
      phone: "+91 9324117007",
      gstin: "09AAACS9999A1Z5",
      pan: "AAACS9999A",
      cin: "U72900UP2026PTC123456",
      address: companyAddress,
    };

    this._branch = {
      id: "br-gkp-01",
      name: "Gorakhpur Flagship Branch",
      code: "BR-GKP-01",
      phone: "+91 9324117007",
      email: "gorakhpur.branch@smritisys.com",
      address: companyAddress,
    };

    this._warehouse = {
      id: "wh-gkp-main",
      name: "Gorakhpur Central Logistics Hub",
      code: "WH-GKP-01",
      contactPerson: "Rajesh Sharma",
      phone: "+91 9324117007",
      address: companyAddress,
    };

    this._customer = {
      id: "cust-demo-01",
      name: "Acme Retail Enterprises",
      companyName: "Acme Retail Enterprises",
      mobile: "+91 9876543210",
      email: "billing@acmeretail.in",
      gstin: "09AABCA1234A1Z1",
      address: {
        line1: "Plot 42, Commercial Hub",
        line2: "Civil Lines",
        city: "Gorakhpur",
        district: "Gorakhpur",
        state: "Uttar Pradesh",
        stateCode: "09",
        pinCode: "273001",
        country: "India",
      },
    };

    this._supplier = {
      id: "supp-demo-01",
      name: "National Apparel & Textile Mills",
      code: "SUPP-NAT-01",
      contactPerson: "Vikram Malhotra",
      mobile: "+91 9123456789",
      email: "orders@nationalapparel.com",
      gstin: "09AAACN5555N1Z8",
      address: {
        line1: "Industrial Area Phase 2",
        line2: "GIDA",
        city: "Gorakhpur",
        district: "Gorakhpur",
        state: "Uttar Pradesh",
        stateCode: "09",
        pinCode: "273209",
        country: "India",
      },
    };

    this._bank = {
      bankName: "State Bank of India",
      accountName: "SMRITI Systems",
      accountNumber: "39876543210",
      ifscCode: "SBIN0001234",
      branchName: "Taramandal Gorakhpur Branch",
      upiId: "smritisys@sbi",
    };

    this._tax = {
      cgstRate: 9,
      sgstRate: 9,
      igstRate: 18,
      hsnCode: "84716060",
    };

    this._item = {
      sku: "SKU-FOOTWEAR-01",
      code: "SHOE-1001",
      name: "SMRITI Premium Leather Shoes",
      category: "Footwear",
      brand: "Smriti Standard",
      uom: "Pair",
      mrp: 3500.0,
      salePrice: 2800.0,
      purchaseCost: 1800.0,
      hsnCode: "6403",
      barcode: "8901234567890",
    };

    this._transport = {
      transporterName: "Gorakhpur Express Freight Carriers",
      transportId: "TRP-2026-09",
      vehicleNo: "UP 53 AT 9988",
      lrNumber: "LR-99881122",
    };
  }

  public company(): DemoCompany {
    return this._company;
  }

  public branch(): DemoBranch {
    return this._branch;
  }

  public warehouse(): DemoWarehouse {
    return this._warehouse;
  }

  public customer(): DemoCustomer {
    return this._customer;
  }

  public supplier(): DemoSupplier {
    return this._supplier;
  }

  public bank(): DemoBank {
    return this._bank;
  }

  public tax(): DemoTax {
    return this._tax;
  }

  public item(): DemoItem {
    return this._item;
  }

  public transport(): DemoTransport {
    return this._transport;
  }

  public getFormattedAddress(addr: DemoAddress): string {
    const parts = [addr.line1, addr.line2, addr.city, `${addr.state} – ${addr.pinCode}`, addr.country].filter(Boolean);
    return parts.join(", ");
  }

  public getFormattedCompanyAddress(): string {
    return this.getFormattedAddress(this._company.address);
  }
}

export const DemoDataRegistry = new SmritiDemoDataRegistryService();
export const SMRITI_SAMPLE_DATA = DemoDataRegistry; // Alias for backward compatibility
