/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : POS Business Domain Service (`SPK.domains.pos`)
 * Standard     : SMAP Constitution v1.0 & Wave 1 Architecture Standard
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { SPK } from "../../kernel/SPK.js";
import { PlatformContext } from "../../kernel/context/PlatformContext.js";
import { DomainEventBus, SaleCompletedPayload } from "../events/DomainEventBus.js";
import { POSCheckoutRequestDTO, POSCheckoutResponseDTO } from "../dto/pos.dto.js";

export class POSDomainService {
  public checkout(
    request: POSCheckoutRequestDTO,
    context: Readonly<PlatformContext>
  ): POSCheckoutResponseDTO {
    // 1. Evaluate cashier authorization via SPK.security facade
    const secDecision = SPK.security.evaluateAccess(context.userId, context.userRole, "sales.pos.billing");
    if (!secDecision.allowed) {
      return {
        saleId: "",
        invoiceNo: "",
        subTotalFormatted: "₹0.00",
        taxFormatted: "₹0.00",
        totalFormatted: "₹0.00",
        receiptHtml: "",
        status: "failed",
        reason: secDecision.reason
      };
    }

    // 2. Perform cashier discount permission check if discount requested
    if (request.discountPercent && request.discountPercent > 10) {
      const discountDecision = SPK.security.evaluateAccess(context.userId, context.userRole, "sales.discount.approve");
      if (!discountDecision.allowed) {
        return {
          saleId: "",
          invoiceNo: "",
          subTotalFormatted: "₹0.00",
          taxFormatted: "₹0.00",
          totalFormatted: "₹0.00",
          receiptHtml: "",
          status: "failed",
          reason: `Discount of ${request.discountPercent}% requires approval permission 'sales.discount.approve'.`
        };
      }
    }

    // 3. Compute billing totals
    const rawSubTotal = request.items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
    const discountMultiplier = request.discountPercent ? (100 - request.discountPercent) / 100 : 1;
    const taxableTotal = rawSubTotal * discountMultiplier;
    const gstAmount = taxableTotal * 0.18; // 18% GST standard
    const netTotal = taxableTotal + gstAmount;

    // 4. Format numbers using SPK.configuration facade
    const subTotalFormatted = SPK.configuration.regional.formatCurrency(taxableTotal);
    const taxFormatted = SPK.configuration.regional.formatCurrency(gstAmount);
    const totalFormatted = SPK.configuration.regional.formatCurrency(netTotal);

    const saleId = `sale-${Date.now()}`;
    const invoiceNo = `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    // 5. Render thermal receipt using SPK.printing facade
    const doc = SPK.printing.renderDocument("tmpl.pos_receipt", {
      invoiceNo,
      totalAmount: totalFormatted
    }, context);

    // 6. Emit SaleCompleted.v1 domain event on DomainEventBus (NO direct call to inventory)
    const salePayload: SaleCompletedPayload = {
      saleId,
      invoiceNo,
      storeId: context.storeId,
      cashierId: request.cashierId,
      items: request.items.map((i) => ({ sku: i.sku, qty: i.qty, unitPrice: i.unitPrice, lineTotal: i.qty * i.unitPrice })),
      totalAmount: netTotal,
      taxAmount: gstAmount
    };

    DomainEventBus.publish("SaleCompleted.v1", salePayload, context.tenantId);

    return {
      saleId,
      invoiceNo,
      subTotalFormatted,
      taxFormatted,
      totalFormatted,
      receiptHtml: doc.htmlContent,
      receiptPlainText: doc.plainTextContent,
      status: "completed"
    };
  }
}

export const posDomainService = new POSDomainService();
