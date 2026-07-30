/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Dedicated Purchase Order Registry View
 * Architecture Standard: Pure List Report Pattern (WNG-002)
 */

import React from "react";
import { FioriListReport } from "../common/FioriListReport.tsx";
import poMetadata from "../../metadata/purchase_order.json";

export interface PurchaseOrderRegistryProps {
  orders?: any[];
  onOpenStudio?: (order?: any) => void;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
}

export const PurchaseOrderRegistry: React.FC<PurchaseOrderRegistryProps> = ({
  orders = [],
  onOpenStudio,
  onNotification,
}) => {
  const columns = [
    { key: "po_number", label: "PO Number" },
    { key: "order_date", label: "Order Date" },
    { key: "supplier_name", label: "Vendor / Supplier" },
    { key: "expected_date", label: "Expected Delivery" },
    { key: "total_amount", label: "Total Amount (₹)" },
    { key: "status", label: "PO Status" },
  ];

  return (
    <div className="w-full h-full">
      <FioriListReport
        title="Purchase Order Workstation"
        subtitle="SAWF v1.1 Declarative Sourcing Module #4"
        data={orders}
        columns={columns}
        onCreateNew={() => onOpenStudio?.(null)}
        onRowClick={(item: any) => onOpenStudio?.(item)}
      />
    </div>
  );
};
