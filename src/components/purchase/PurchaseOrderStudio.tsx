/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Reference Implementation 4: Purchase Order Studio
 * Architecture Standard: Universal Purchase Operations Studio Consumer
 */

import React from "react";
import { PurchaseOperationsStudio } from "./PurchaseOperationsStudio.tsx";
import { Product } from "../../types.js";

export interface PurchaseOrderStudioProps {
  initialData?: any;
  suppliers?: any[];
  products?: Product[];
  currentUser?: { role: string; name: string } | null;
  onSave?: (data: any) => void;
  onCancel?: () => void;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
}

export const PurchaseOrderStudio: React.FC<PurchaseOrderStudioProps> = ({
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
      initialDocumentType="PO"
      initialData={initialData}
      suppliers={suppliers}
      products={products}
      currentUser={currentUser}
      onBack={onCancel}
      onNotification={onNotification}
    />
  );
};
