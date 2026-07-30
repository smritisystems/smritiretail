/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Dedicated Goods Receipt Note (GRN) Registry View
 * Architecture Standard: Pure List Report Pattern (WNG-002)
 */

import React from "react";
import { FioriListReport } from "../common/FioriListReport.tsx";

export interface GRNRegistryProps {
  receipts?: any[];
  onOpenStudio?: (grn?: any) => void;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
}

export const GRNRegistry: React.FC<GRNRegistryProps> = ({
  receipts = [],
  onOpenStudio,
}) => {
  const columns = [
    { key: "grn_no", label: "GRN Number" },
    { key: "receipt_date", label: "Receipt Date" },
    { key: "supplier_name", label: "Vendor / Supplier" },
    { key: "po_reference", label: "PO Ref" },
    { key: "total_amount", label: "Total Value (₹)" },
    { key: "quality_status", label: "QC Status" },
  ];

  return (
    <div className="w-full h-full">
      <FioriListReport
        title="Goods Receipt Note (GRN) Workstation"
        subtitle="SAWF v1.1 Declarative Inward Sourcing Module #5"
        data={receipts}
        columns={columns}
        onCreateNew={() => onOpenStudio?.(null)}
        onRowClick={(item: any) => onOpenStudio?.(item)}
      />
    </div>
  );
};
