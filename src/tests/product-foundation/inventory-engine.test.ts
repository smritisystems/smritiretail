import { describe, expect, it } from 'vitest';
import { StockLedgerService } from '../../product-foundation/inventory/stock-ledger/application/stockLedgerService';
import { ReservationService } from '../../product-foundation/inventory/reservation/application/reservationService';
import { CostingEngine } from '../../product-foundation/inventory/costing/domain/costing';
import { InventorySettingsService } from '../../product-foundation/inventory/settings/application/inventorySettingsService';
import { PurchaseTransactionService } from '../../product-foundation/commerce/purchase/application/purchaseTransactionService';
import { SalesTransactionService } from '../../product-foundation/commerce/sales/application/salesTransactionService';

describe('Inventory engine foundation', () => {
  it('applies stock movements and tracks available quantity', () => {
    const ledger = new StockLedgerService();
    const entry = { itemId: 'sku-100', quantity: 10 };

    const received = ledger.applyMovement(entry, { id: 'm-1', quantity: 5, type: 'in', unitCost: 20 });
    expect(received.quantity).toBe(15);

    const issued = ledger.applyMovement(received, { id: 'm-2', quantity: 3, type: 'out' });
    expect(issued.quantity).toBe(12);
  });

  it('reserves and releases stock correctly', () => {
    const ledger = new StockLedgerService();
    const reservation = new ReservationService();
    const entry = { itemId: 'sku-200', quantity: 20 };

    const reserved = reservation.reserve(entry, 8);
    expect(reserved.quantity).toBe(12);
    expect(reserved.reserved).toBe(8);

    const released = reservation.release(reserved, 4);
    expect(released.quantity).toBe(16);
    expect(released.reserved).toBe(4);
  });

  it('prevents negative stock by default and allows legacy allowNegative override', () => {
    const ledger = new StockLedgerService();
    const entry = { itemId: 'sku-300', quantity: 3 };

    expect(() => ledger.reserve(entry, 5)).toThrow();

    const negativeStock = ledger.applyMovement({ ...entry, allowNegative: true }, { id: 'm-3', quantity: 5, type: 'out' });
    expect(negativeStock.quantity).toBe(-2);
  });

  it('warns when negative stock policy is WARN and movement goes below zero', () => {
    const settingsService = new InventorySettingsService({
      defaultSettings: { costingMethod: 'fifo', negativeStockPolicy: 'WARN' },
    });
    const ledger = new StockLedgerService(settingsService);
    const entry = { itemId: 'sku-400', quantity: 2 };

    const outcome = ledger.applyMovement(entry, { id: 'm-5', quantity: 5, type: 'out' });
    expect(outcome.quantity).toBe(-3);
    expect(outcome.warnings).toContain('Negative stock allowed by policy');
  });

  it('consumes reserved stock when outbound movement is applied', () => {
    const ledger = new StockLedgerService();
    const entry = { itemId: 'sku-400', quantity: 10 };

    const reserved = ledger.reserve(entry, 4);
    expect(reserved.quantity).toBe(6);
    expect(reserved.reserved).toBe(4);

    const finalEntry = ledger.applyMovement(reserved, { id: 'm-4', quantity: 4, type: 'out', consumeReserved: true });
    expect(finalEntry.onHand).toBe(6);
    expect(finalEntry.reserved).toBe(0);
    expect(finalEntry.quantity).toBe(6);
  });

  it('resolves default costing method from inventory settings', () => {
    const ledger = new StockLedgerService();
    const entry = { itemId: 'sku-600', quantity: 0 };

    const received = ledger.applyMovement(entry, { id: 'm-1', quantity: 5, type: 'in', unitCost: 100 });
    expect(received.inventoryValue).toBe(500);

    const sold = ledger.applyMovement(received, { id: 'm-2', quantity: 2, type: 'out' });
    expect(sold.lastIssuedCost).toBe(200);
    expect(sold.costLayers?.[0]).toEqual({ quantity: 3, unitCost: 100 });
  });

  it('resolves costing method using item > warehouse > company > default precedence', () => {
    const companyId = 'comp-hq';
    const warehouseId = 'wh-mumbai';
    const itemId = 'sku-iphone';

    const settingsService = new InventorySettingsService({
      defaultSettings: { costingMethod: 'fifo' },
      companySettings: {
        [companyId]: { costingMethod: 'weightedAverage' },
      },
      warehouseSettings: {
        [warehouseId]: { costingMethod: 'standard' },
      },
      itemSettings: {
        [itemId]: { costingMethod: 'fifo' },
      },
    });

    expect(settingsService.resolveCostingMethod({ itemId, warehouseId, companyId })).toBe('fifo');
    expect(settingsService.resolveCostingMethod({ itemId: 'sku-other', warehouseId, companyId })).toBe('standard');
    expect(settingsService.resolveCostingMethod({ itemId: 'sku-other', warehouseId: 'wh-other', companyId })).toBe('weightedAverage');
    expect(settingsService.resolveCostingMethod({ itemId: 'sku-other', warehouseId: 'wh-other', companyId: 'comp-other' })).toBe('fifo');
  });

  it('calculates FIFO cost correctly', () => {
    const costing = new CostingEngine();
    const layers = [
      { quantity: 5, unitCost: 10 },
      { quantity: 10, unitCost: 12 },
    ];

    const cost = costing.calculateFifoCost(8, layers);
    expect(cost).toBe(5 * 10 + 3 * 12);
  });

  it('calculates weighted average cost correctly', () => {
    const costing = new CostingEngine();
    const layers = [
      { quantity: 5, unitCost: 10 },
      { quantity: 5, unitCost: 14 },
    ];

    const avg = costing.calculateWeightedAverageCost(layers);
    expect(avg).toBe(12);
  });

  it('creates FIFO layers for sequential purchase movements', () => {
    const ledger = new StockLedgerService();
    const entry = { itemId: 'sku-fifo', quantity: 0 };

    const firstReceipt = ledger.applyMovement(entry, { id: 'm-in-1', quantity: 100, type: 'in', unitCost: 50 });
    expect(firstReceipt.costLayers).toHaveLength(1);
    expect(firstReceipt.costLayers?.[0]).toEqual({ quantity: 100, unitCost: 50 });
    expect(firstReceipt.quantity).toBe(100);
    expect(firstReceipt.inventoryValue).toBe(5000);

    const secondReceipt = ledger.applyMovement(firstReceipt, { id: 'm-in-2', quantity: 50, type: 'in', unitCost: 60 });
    expect(secondReceipt.costLayers).toHaveLength(2);
    expect(secondReceipt.costLayers?.[0]).toEqual({ quantity: 100, unitCost: 50 });
    expect(secondReceipt.costLayers?.[1]).toEqual({ quantity: 50, unitCost: 60 });
    expect(secondReceipt.inventoryValue).toBe(8000);
  });

  it('consumes FIFO layers in order and removes empty layers', () => {
    const ledger = new StockLedgerService();
    const entry = { itemId: 'sku-fifo', quantity: 0 };

    const inbound = ledger.applyMovement(entry, { id: 'm-in-1', quantity: 100, type: 'in', unitCost: 50 });
    const layered = ledger.applyMovement(inbound, { id: 'm-in-2', quantity: 50, type: 'in', unitCost: 60 });

    const sold40 = ledger.applyMovement(layered, { id: 'm-out-1', quantity: 40, type: 'out' });
    expect(sold40.costLayers).toHaveLength(2);
    expect(sold40.costLayers?.[0]).toEqual({ quantity: 60, unitCost: 50 });
    expect(sold40.costLayers?.[1]).toEqual({ quantity: 50, unitCost: 60 });
    expect(sold40.lastIssuedCost).toBe(2000);
    expect(sold40.inventoryValue).toBe(6000);
    expect(sold40.quantity).toBe(110);

    const sold80 = ledger.applyMovement(sold40, { id: 'm-out-2', quantity: 80, type: 'out' });
    expect(sold80.costLayers).toHaveLength(1);
    expect(sold80.costLayers?.[0]).toEqual({ quantity: 30, unitCost: 60 });
    expect(sold80.lastIssuedCost).toBe(4200);
    expect(sold80.inventoryValue).toBe(1800);
    expect(sold80.quantity).toBe(30);
  });

  it('supports purchase and sale wiring through transaction services with FIFO costing', () => {
    const purchaseService = new PurchaseTransactionService();
    const salesService = new SalesTransactionService();

    const initialInventory = { itemId: 'sku-int', quantity: 0 };

    const firstPurchase = purchaseService.executePurchase({
      purchaseId: 'pur-fifo-1',
      supplierId: 'supp-1',
      items: [{ itemId: 'sku-int', description: 'Item FIFO', quantity: 100, unitCost: 50, taxRateId: 'gst-9' }],
      inventoryEntry: initialInventory,
      taxRules: [{ id: 'gst-9', rate: 0.09 }],
      taxRateId: 'gst-9',
    });

    const secondPurchase = purchaseService.executePurchase({
      purchaseId: 'pur-fifo-2',
      supplierId: 'supp-1',
      items: [{ itemId: 'sku-int', description: 'Item FIFO', quantity: 50, unitCost: 60, taxRateId: 'gst-9' }],
      inventoryEntry: firstPurchase.inventoryEntry,
      taxRules: [{ id: 'gst-9', rate: 0.09 }],
      taxRateId: 'gst-9',
    });

    const saleResult = salesService.executeSale({
      saleId: 'sale-fifo-1',
      customerId: 'cust-1',
      items: [{ itemId: 'sku-int', description: 'Item FIFO', quantity: 120, basePrice: 100, taxRateId: 'gst-9' }],
      inventoryEntry: secondPurchase.inventoryEntry,
      pricingRules: [],
      taxRules: [{ id: 'gst-9', rate: 0.09 }],
      taxRateId: 'gst-9',
    });

    expect(saleResult.finalInventory.quantity).toBe(30);
    expect(saleResult.finalInventory.costLayers).toHaveLength(1);
    expect(saleResult.finalInventory.costLayers?.[0]).toEqual({ quantity: 30, unitCost: 60 });
    expect(saleResult.finalInventory.inventoryValue).toBe(1800);
    expect(saleResult.finalInventory.lastIssuedCost).toBe(6200);
  });
});
