/**
 * Project      : SMRITI Business OS
 * Product      : SMRITI Enterprise Design System (SEDS)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * SIF Compliance: SIF-001 & PBC-001 (Promotes SEEFDialog Universal Primitive)
 */

import React from "react";
import { SEEFDialog } from "../../components/common/SEEFDialog.tsx";

export interface SEDSDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  children: React.ReactNode;
}

export const SEDSDialog: React.FC<SEDSDialogProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  footer,
  maxWidth = "md",
  className = "",
  children,
}) => {
  const widthCls = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  }[maxWidth];

  return (
    <SEEFDialog
      open={isOpen}
      onClose={onClose}
      title={typeof title === "string" ? title : undefined}
      headerExtra={typeof title !== "string" ? title : undefined}
      subtitle={typeof subtitle === "string" ? subtitle : undefined}
      mode="centered"
      maxWidthClass={`w-full ${widthCls} ${className}`}
      footer={footer}
    >
      <div className="space-y-3 font-mono text-xs select-none">
        {typeof subtitle !== "string" && subtitle}
        {children}
      </div>
    </SEEFDialog>
  );
};
