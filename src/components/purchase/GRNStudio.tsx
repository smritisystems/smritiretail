/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Reference Implementation 5: Goods Receipt Note (GRN) Studio
 * Architecture Standard: Universal SAWF Studio Shell Consumer
 */

import React, { useState } from "react";
import { DocumentStudio } from "../../framework/sawf/components/DocumentStudio.tsx";
import { MetadataLoader } from "../../framework/sawf/metadata/MetadataLoader.ts";
import grnMetadata from "../../metadata/grn.json";
import { SAWFDocumentMeta } from "../../framework/sawf/types/sawf.ts";

MetadataLoader.register("GRN", grnMetadata as unknown as SAWFDocumentMeta);

export interface GRNStudioProps {
  initialData?: any;
  onSave?: (data: any) => void;
  onCancel?: () => void;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
}

export const GRNStudio: React.FC<GRNStudioProps> = ({
  initialData,
  onSave,
  onCancel,
  onNotification,
}) => {
  const [items, setItems] = useState<any[]>(initialData?.items || []);
  const [grnNo, setGrnNo] = useState<string>(initialData?.grn_no || `GRN-${Date.now().toString().slice(-6)}`);

  return (
    <div className="w-full h-full">
      <DocumentStudio
        documentType="GRN"
        documentNo={grnNo}
        status={initialData?.quality_status || "PASSED"}
        items={items}
        onChangeItems={setItems}
        products={[]}
        renderPanelContent={() => null}
        onBack={onCancel || (() => {})}
        onSave={() => {
          if (onSave) onSave(initialData || {});
          if (onNotification) {
            onNotification(
              "GRN Saved",
              "Goods Receipt Note saved successfully via SAWF v1.1.",
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
