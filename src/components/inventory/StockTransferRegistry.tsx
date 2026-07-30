/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Dedicated Stock Transfer Registry View
 * Architecture Standard: Pure List Report Pattern (WNG-002)
 */

import React from "react";
import { FioriListReport } from "../common/FioriListReport.tsx";

export interface StockTransferRegistryProps {
  transfers?: any[];
  onOpenStudio?: (transfer?: any) => void;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
}

export const StockTransferRegistry: React.FC<StockTransferRegistryProps> = ({
  transfers = [],
  onOpenStudio,
}) => {
  const columns = [
    { key: "transfer_no", label: "Transfer Order No" },
    { key: "transfer_date", label: "Transfer Date" },
    { key: "source_location", label: "Source Location" },
    { key: "destination_location", label: "Destination Location" },
    { key: "total_amount", label: "Transfer Value (₹)" },
    { key: "status", label: "Transit Status" },
  ];

  return (
    <div className="w-full h-full">
      <FioriListReport
        title="Inter-Store Stock Transfer Workstation"
        subtitle="SAWF v1.1 Declarative Inventory Logistics Module #6"
        data={transfers}
        columns={columns}
        onCreateNew={() => onOpenStudio?.(null)}
        onRowClick={(item: any) => onOpenStudio?.(item)}
      />
    </div>
  );
};
