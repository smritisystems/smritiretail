import { describe, expect, it } from "vitest";
import { ApprovalService } from "../../product-foundation/workflow/approval/application/approvalService";
import { PricingService } from "../../product-foundation/commerce/pricing/application/pricingService";
import { StockLedgerService } from "../../product-foundation/inventory/stock-ledger/application/stockLedgerService";

describe("business workflow coverage", () => {
  it("executes a retail approval and pricing path", () => {
    const approvalService = new ApprovalService();
    const workflow = approvalService.createWorkflow("po-1", "purchase-order");
    const submitted = approvalService.submitWorkflow(workflow);
    const approved = approvalService.approveWorkflow(submitted);

    const pricingService = new PricingService();
    const price = pricingService.calculatePrice(
      { itemId: "sku-1", baseAmount: 100, customerTier: "gold" },
      [{ id: "tier-1", type: "customerGroup", itemId: "sku-1", priority: 1, customerTier: "gold", amount: 90 }]
    );

    expect(approved.status).toBe("approved");
    expect(price).toBe(90);
  });

  it("tracks stock movement through the ledger", () => {
    const stockLedgerService = new StockLedgerService();
    const initial = { itemId: "sku-2", quantity: 10 };
    const afterReceipt = stockLedgerService.applyMovement(initial, { id: "m-1", quantity: 4, type: "in" });
    const afterReserve = stockLedgerService.reserve(afterReceipt, 3);

    expect(afterReserve.quantity).toBe(11);
  });
});
