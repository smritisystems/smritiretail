/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Wave 1 Business Domain End-to-End Scenario Integration Tests
 * Standard     : SMAP Constitution v1.0 & Wave 1 Architecture Standard Compliance
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { describe, expect, it, beforeEach } from "vitest";
import { SPK } from "../kernel/SPK.js";
import { createPlatformContext } from "../kernel/context/PlatformContext.js";
import { DomainEventBus } from "../domains/events/DomainEventBus.js";
import { inventoryDomainService } from "../domains/inventory/InventoryDomainService.js";

describe("Wave 1 End-to-End Business Integration Scenarios", () => {
  beforeEach(() => {
    DomainEventBus.clear();
    inventoryDomainService.registerEventSubscriptions();
  });

  it("should execute complete POS checkout pipeline emitting SaleCompleted event and updating inventory stock", () => {
    const context = createPlatformContext({ userId: "usr-cashier", userRole: "cashier" });
    const initialStock = SPK.domains.inventory.getStockQuantity("SKU-1001");

    // Track emitted events
    let capturedSaleEvent: any = null;
    let capturedStockEvent: any = null;

    DomainEventBus.subscribe("SaleCompleted.v1", (event) => {
      capturedSaleEvent = event;
    });

    DomainEventBus.subscribe("StockUpdated.v1", (event) => {
      capturedStockEvent = event;
    });

    // Execute POS Checkout via SPK.domains.pos facade
    const checkoutResult = SPK.domains.pos.checkout({
      items: [{ sku: "SKU-1001", itemName: "Cotton Polo Shirt", qty: 3, unitPrice: 500 }],
      cashierId: "usr-cashier",
      paymentMethod: "cash"
    }, context);

    expect(checkoutResult.status).toBe("completed");
    expect(checkoutResult.invoiceNo).toContain("INV-2026-");
    expect(checkoutResult.totalFormatted).toContain("1,770.00"); // Taxable 1500 + 18% GST (270)
    expect(checkoutResult.receiptHtml).toContain("SMRITI Systems");

    // Verify event bus propagation
    expect(capturedSaleEvent).not.toBeNull();
    expect(capturedSaleEvent.eventType).toBe("SaleCompleted.v1");
    expect(capturedSaleEvent.payload.totalAmount).toBe(1770);

    // Verify reactive stock adjustment in Inventory Domain without direct POS-to-Inventory calls
    expect(capturedStockEvent).not.toBeNull();
    expect(capturedStockEvent.eventType).toBe("StockUpdated.v1");
    expect(capturedStockEvent.payload.sku).toBe("SKU-1001");
    expect(capturedStockEvent.payload.newQty).toBe(initialStock - 3);

    const updatedStock = SPK.domains.inventory.getStockQuantity("SKU-1001");
    expect(updatedStock).toBe(initialStock - 3);
  });

  it("should execute Sales Order approval workflow via SPK.workflow facade and emit OrderApproved event", () => {
    const managerContext = createPlatformContext({ userId: "usr-mgr", userRole: "store_manager" });
    let capturedApprovalEvent: any = null;

    DomainEventBus.subscribe("OrderApproved.v1", (event) => {
      capturedApprovalEvent = event;
    });

    const approvalResult = SPK.domains.sales.approveSalesOrder("PO-9901", managerContext);

    expect(approvalResult.success).toBe(true);
    expect(approvalResult.newState).toBe("approved");

    expect(capturedApprovalEvent).not.toBeNull();
    expect(capturedApprovalEvent.payload.orderId).toBe("PO-9901");
    expect(capturedApprovalEvent.payload.approverId).toBe("usr-mgr");
  });

  it("should render inventory low-stock dashboard widget and return AI reorder recommendations", () => {
    const context = createPlatformContext();

    const widget = SPK.domains.inventory.renderLowStockWidget(context);
    expect(widget.widgetId).toBe("w_low_stock");

    const aiAdvisory = SPK.domains.inventory.getAIReorderAdvisory(context);
    expect(aiAdvisory.skillId).toBe("ai.reorder_recommendation");
    expect(aiAdvisory.disclaimer).toContain("Advisory AI recommendation only");
  });
});
