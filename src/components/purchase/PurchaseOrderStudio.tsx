/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Reference Implementation 4: Purchase Order Studio
 * Architecture Standard: Universal SAWF Studio Shell Consumer
 */

import React, { useState } from "react";
import { DocumentStudio } from "../../framework/sawf/components/DocumentStudio.tsx";
import { MetadataLoader } from "../../framework/sawf/metadata/MetadataLoader.ts";
import poMetadata from "../../metadata/purchase_order.json";
import { SAWFDocumentMeta } from "../../framework/sawf/types/sawf.ts";

// Register PurchaseOrder metadata dynamically with MetadataLoader
MetadataLoader.register("PurchaseOrder", poMetadata as unknown as SAWFDocumentMeta);

export interface PurchaseOrderStudioProps {
  initialData?: any;
  onSave?: (data: any) => void;
  onCancel?: () => void;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
}

export const PurchaseOrderStudio: React.FC<PurchaseOrderStudioProps> = ({
  initialData,
  onSave,
  onCancel,
  onNotification,
}) => {
  const [items, setItems] = useState<any[]>(initialData?.items || []);
  const [orderNo, setOrderNo] = useState<string>(initialData?.po_number || `PO-${Date.now().toString().slice(-6)}`);

  return (
    <div className="w-full h-full">
      <DocumentStudio
        documentType="PurchaseOrder"
        documentNo={orderNo}
        status={initialData?.status || "Draft"}
        items={items}
        onChangeItems={setItems}
        products={[]}
        renderPanelContent={() => null}
        onBack={onCancel || (() => {})}
        onSave={() => {
          if (onSave) onSave(initialData || {});
          if (onNotification) {
            onNotification(
              "Purchase Order Saved",
              "PO saved successfully via SAWF v1.1.",
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
