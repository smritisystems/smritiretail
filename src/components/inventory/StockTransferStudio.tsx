/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Reference Implementation 6: Stock Transfer Studio
 * Architecture Standard: Universal SAWF Studio Shell Consumer
 */

import React, { useState } from "react";
import { DocumentStudio } from "../../framework/sawf/components/DocumentStudio.tsx";
import { MetadataLoader } from "../../framework/sawf/metadata/MetadataLoader.ts";
import { DocumentService } from "../../dop/core/DocumentService.ts";
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
        onSave={async () => {
          if (onSave) onSave(initialData || {});
          const res = await DocumentService.output({
            documentType: "STOCK_TRANSFER",
            referenceId: transferNo,
            channel: "PRINT",
            data: { transferNo },
            items: items.map((i) => ({
              itemCode: String(i.code || i.id || "SKU-TRANSFER"),
              itemName: String(i.name || "Stock Item"),
              barcode: String(i.barcode || i.code || i.id || "8901234567890"),
              mrp: Number(i.mrp || i.price || 0),
              sellingPrice: Number(i.price || 0),
              quantity: Number(i.quantity || 1),
            })),
          });
          if (onNotification) {
            onNotification(
              "Stock Transfer Saved",
              `Transfer Note ${transferNo} dispatched via SCS-DXP-001 ${res.adapterUsed}.`,
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
