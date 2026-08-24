/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-14
 * Modified     : 2026-08-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

export interface TrainingSession {
  sessionId: string;
  traineeName: string;
  startDate: string;
  currentDay: number;
  completedDays: number[];
  level: 'Level 1 — Retail Operator' | 'Level 2 — Inventory Operator' | 'Level 3 — Store Supervisor';
  status: 'Active' | 'Completed' | 'Reset';
}

export interface SimulatedItem {
  sku: string;
  name: string;
  hsn: string;
  gstRate: number;
  mrp: number;
  purchaseRate: number;
}

export interface SimulatedSupplier {
  code: string;
  name: string;
  gstin: string;
}

export interface SimulatedPO {
  poNumber: string;
  supplierCode: string;
  sku: string;
  quantity: number;
  rate: number;
  status: 'Draft' | 'Approved' | 'Completed';
}

export interface SimulatedGRN {
  grnNumber: string;
  poNumber: string;
  receivedQty: number;
  shortQty: number;
  excessQty: number;
  receivedDate: string;
}

export interface SimulatedStockLedger {
  sku: string;
  availableStock: number;
  reservedStock: number;
  lastUpdated: string;
}

export interface SimulatedSale {
  invoiceNumber: string;
  customerName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalGst: number;
  totalAmount: number;
  paidAmount: number;
  paymentMode: string;
}

class TrainingSandboxStore {
  private currentSession: TrainingSession | null = null;
  private items: Map<string, SimulatedItem> = new Map();
  private suppliers: Map<string, SimulatedSupplier> = new Map();
  private pos: Map<string, SimulatedPO> = new Map();
  private grns: Map<string, SimulatedGRN> = new Map();
  private stockLedgers: Map<string, SimulatedStockLedger> = new Map();
  private sales: Map<string, SimulatedSale> = new Map();

  constructor() {
    this.initDefaultSession();
  }

  /**
   * Initializes a clean training session scope (e.g. TRAIN-2026-001)
   */
  public initSession(traineeName: string = 'Trainee Operator'): TrainingSession {
    const randomId = Math.floor(100 + Math.random() * 900);
    const sessionId = `TRAIN-${new Date().getFullYear()}-${randomId}`;
    
    this.currentSession = {
      sessionId,
      traineeName,
      startDate: new Date().toISOString().split('T')[0],
      currentDay: 1,
      completedDays: [],
      level: 'Level 1 — Retail Operator',
      status: 'Active',
    };

    this.resetSandboxData();
    return this.currentSession;
  }

  public getCurrentSession(): TrainingSession {
    if (!this.currentSession) {
      return this.initDefaultSession();
    }
    return this.currentSession;
  }

  private initDefaultSession(): TrainingSession {
    this.currentSession = {
      sessionId: 'TRAIN-2026-001',
      traineeName: 'Default Trainee',
      startDate: new Date().toISOString().split('T')[0],
      currentDay: 1,
      completedDays: [],
      level: 'Level 1 — Retail Operator',
      status: 'Active',
    };
    this.resetSandboxData();
    return this.currentSession;
  }

  public resetSandboxData(): void {
    this.items.clear();
    this.suppliers.clear();
    this.pos.clear();
    this.grns.clear();
    this.stockLedgers.clear();
    this.sales.clear();
  }

  // --- Simulated Master Operations ---
  public addSimulatedItem(item: SimulatedItem): void {
    this.items.set(item.sku, item);
    if (!this.stockLedgers.has(item.sku)) {
      this.stockLedgers.set(item.sku, {
        sku: item.sku,
        availableStock: 0,
        reservedStock: 0,
        lastUpdated: new Date().toISOString(),
      });
    }
  }

  public getSimulatedItems(): SimulatedItem[] {
    return Array.from(this.items.values());
  }

  public addSimulatedSupplier(supplier: SimulatedSupplier): void {
    this.suppliers.set(supplier.code, supplier);
  }

  public getSimulatedSuppliers(): SimulatedSupplier[] {
    return Array.from(this.suppliers.values());
  }

  // --- Simulated Purchase Operations ---
  public createSimulatedPO(po: SimulatedPO): SimulatedPO {
    this.pos.set(po.poNumber, po);
    return po;
  }

  public getSimulatedPO(poNumber: string): SimulatedPO | undefined {
    return this.pos.get(poNumber);
  }

  // --- Simulated GRN & Stock Operations ---
  public processSimulatedGRN(grn: SimulatedGRN): { grn: SimulatedGRN; newStock: number } {
    this.grns.set(grn.grnNumber, grn);
    const po = this.pos.get(grn.poNumber);
    if (po) {
      po.status = 'Completed';
      const stock = this.stockLedgers.get(po.sku) || {
        sku: po.sku,
        availableStock: 0,
        reservedStock: 0,
        lastUpdated: new Date().toISOString(),
      };
      stock.availableStock += grn.receivedQty;
      stock.lastUpdated = new Date().toISOString();
      this.stockLedgers.set(po.sku, stock);
      return { grn, newStock: stock.availableStock };
    }
    return { grn, newStock: 0 };
  }

  public getSimulatedStock(sku: string): number {
    return this.stockLedgers.get(sku)?.availableStock || 0;
  }

  // --- Simulated Sales Operations ---
  public processSimulatedSale(sale: SimulatedSale): { sale: SimulatedSale; remainingStock: number } {
    this.sales.set(sale.invoiceNumber, sale);
    const stock = this.stockLedgers.get(sale.sku);
    if (stock) {
      stock.availableStock = Math.max(0, stock.availableStock - sale.quantity);
      stock.lastUpdated = new Date().toISOString();
      return { sale, remainingStock: stock.availableStock };
    }
    return { sale, remainingStock: 0 };
  }

  // --- Deterministic Day 5 Competency Evaluator ---
  public verifyDay5Lifecycle(sku: string): {
    passed: boolean;
    poQty: number;
    grnQty: number;
    shortQty: number;
    salesQty: number;
    expectedStock: number;
    actualStock: number;
    details: string;
  } {
    const poList = Array.from(this.pos.values()).filter(p => p.sku === sku);
    const grnList = Array.from(this.grns.values());
    const salesList = Array.from(this.sales.values()).filter(s => s.sku === sku);

    const poQty = poList.reduce((sum, p) => sum + p.quantity, 0);
    const grnQty = grnList.reduce((sum, g) => sum + g.receivedQty, 0);
    const shortQty = grnList.reduce((sum, g) => sum + g.shortQty, 0);
    const salesQty = salesList.reduce((sum, s) => sum + s.quantity, 0);

    const expectedStock = grnQty - salesQty;
    const actualStock = this.getSimulatedStock(sku);

    const passed = (
      poQty === 50 &&
      grnQty === 48 &&
      shortQty === 2 &&
      salesQty === 5 &&
      expectedStock === 43 &&
      actualStock === 43
    );

    return {
      passed,
      poQty,
      grnQty,
      shortQty,
      salesQty,
      expectedStock,
      actualStock,
      details: passed
        ? 'DAY 5 BUSINESS LIFECYCLE PASSED (PO: 50 -> GRN: 48 -> Short: 2 -> Sales: 5 -> Stock: 43)'
        : `Verification pending: Expected Stock 43, Actual Stock ${actualStock}`,
    };
  }
}

export const trainingStore = new TrainingSandboxStore();
