/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Reference Implementation 6: Stock Transfer Studio
 * Architecture Standard: Universal SAWF Studio Shell Consumer
 */

import React, { useState } from "react";
import { DocumentStudio } from "../../framework/sawf/components/DocumentStudio.tsx";
import { MetadataLoader } from "../../framework/sawf/metadata/MetadataLoader.ts";
import stockTransferMetadata from "../../metadata/stock_transfer.json";
import { SAWFDocumentMeta } from "../../framework/sawf/types/sawf.ts";

MetadataLoader.register("StockTransfer", stockTransferMetadata as unknown as SAWFDocumentMeta);

export interface StockTransferStudioProps {
  initialData?: any;
  onSave?: (data: any) => void;
  onCancel?: () => void;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
}

export const StockTransferStudio: React.FC<StockTransferStudioProps> = ({
  initialData,
  onSave,
  onCancel,
  onNotification,
}) => {
  const [items, setItems] = useState<any[]>(initialData?.items || []);
  const [transferNo, setTransferNo] = useState<string>(initialData?.transfer_no || `ST-${Date.now().toString().slice(-6)}`);

  return (
    <div className="w-full h-full">
      <DocumentStudio
        documentType="StockTransfer"
        documentNo={transferNo}
        status={initialData?.status || "IN_TRANSIT"}
        items={items}
        onChangeItems={setItems}
        products={[]}
        renderPanelContent={() => null}
        onBack={onCancel || (() => {})}
        onSave={() => {
          if (onSave) onSave(initialData || {});
          if (onNotification) {
            onNotification(
              "Stock Transfer Saved",
              "Inter-Store Stock Transfer saved successfully via SAWF v1.1.",
              "success"
            );
          }
        }}
        sidebarData={{
          taxable: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          grandTotal: 0,
        }}
      />
    </div>
  );
};
