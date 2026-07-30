/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Reference Implementation 2: Purchase Invoice Studio
 * Architecture Standard: Universal Purchase Operations Studio Consumer
 */

import React from "react";
import { PurchaseOperationsStudio } from "./PurchaseOperationsStudio.tsx";
import { Product } from "../../types.ts";

interface PurchaseInvoiceStudioProps {
  initialInvoice?: any;
  suppliers?: any[];
  products?: Product[];
  currentUser?: { role: string; name: string } | null;
  onBack: () => void;
  onNotification: (title: string, message: string, type?: "success" | "error") => void;
}

export const PurchaseInvoiceStudio: React.FC<PurchaseInvoiceStudioProps> = ({
  initialInvoice,
  suppliers = [],
  products = [],
  currentUser,
  onBack,
  onNotification,
}) => {
  return (
    <PurchaseOperationsStudio
      initialDocumentType="PINV"
      initialData={initialInvoice}
      suppliers={suppliers}
      products={products}
      currentUser={currentUser}
      onBack={onBack}
      onNotification={onNotification}
    />
  );
};
