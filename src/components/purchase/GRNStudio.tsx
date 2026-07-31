/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Reference Implementation 5: Goods Receipt Note (GRN) Studio
 * Architecture Standard: Universal Purchase Operations Studio Consumer
 */

import React from "react";
import { PurchaseOperationsStudio } from "./PurchaseOperationsStudio.tsx";
import { Product } from "../../types.ts";

export interface GRNStudioProps {
  initialData?: any;
  suppliers?: any[];
  products?: Product[];
  currentUser?: { role: string; name: string } | null;
  onSave?: (data: any) => void;
  onCancel?: () => void;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
}

export const GRNStudio: React.FC<GRNStudioProps> = ({
  initialData,
  suppliers = [],
  products = [],
  currentUser,
  onSave,
  onCancel,
  onNotification,
}) => {
  return (
    <PurchaseOperationsStudio
      initialDocumentType="GRN"
      initialData={initialData}
      suppliers={suppliers}
      products={products}
      currentUser={currentUser}
      onBack={onCancel}
      onNotification={onNotification}
    />
  );
};
