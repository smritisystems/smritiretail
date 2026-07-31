/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Sales Business Domain Service (`SPK.domains.sales`)
 * Standard     : SMAP Constitution v1.0 & Wave 1 Architecture Standard
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { SPK } from "../../kernel/SPK.js";
import { PlatformContext } from "../../kernel/context/PlatformContext.js";
import { DomainEventBus, OrderApprovedPayload } from "../events/DomainEventBus.js";
import { SalesOrderResponseDTO } from "../dto/sales.dto.js";

export class SalesDomainService {
  public approveSalesOrder(
    orderId: string,
    context: Readonly<PlatformContext>
  ): SalesOrderResponseDTO {
    // 1. Delegate purchase order approval workflow state transition to SPK.workflow facade
    const transitionResult = SPK.workflow.executeTransition("wf.purchase_order", "submitted", "approve", context);

    if (!transitionResult.success) {
      return {
        orderId,
        previousState: transitionResult.previousState,
        newState: transitionResult.newState,
        success: false,
        message: transitionResult.reason
      };
    }

    // 2. Emit OrderApproved.v1 domain event
    const approvedPayload: OrderApprovedPayload = {
      orderId,
      approverId: context.userId,
      roleId: context.userRole,
      approvedAt: new Date().toISOString()
    };

    DomainEventBus.publish("OrderApproved.v1", approvedPayload, context.tenantId);

    return {
      orderId,
      previousState: transitionResult.previousState,
      newState: transitionResult.newState,
      success: true,
      message: transitionResult.reason
    };
  }

  public generateSalesSummaryReport(
    startDate: string,
    endDate: string,
    context: Readonly<PlatformContext>
  ) {
    // Delegate reporting projection to SPK.reports facade
    return SPK.reports.executeReport("rep.sales_summary", { startDate, endDate }, context);
  }
}

export const salesDomainService = new SalesDomainService();
