/**
 * Project      : SMRITI Retail OS
 * Module       : Standardized Modal Dialog Component (SIF Standard v1.0 Compliant)
 * Standard     : SIF-001 & Rule PBC-001 (Promotes SEEFDialog Universal Primitive)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 *
 * SIF Compliance Declaration
 * SIF Compatible : Yes
 * Surface        : Centered Dialog (SEEFDialog mode="centered")
 * Interaction    : InteractionService.confirm() / alert()
 * Accessibility  : PASS
 * Keyboard       : PASS
 */

import React from "react";
import { SEEFDialog } from "../../components/common/SEEFDialog.tsx";

interface SmritiDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  footerActions?: React.ReactNode;
  maxWidthClass?: string;
}

export const SmritiDialog: React.FC<SmritiDialogProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  footerActions,
  maxWidthClass = "max-w-2xl"
}) => {
  return (
    <SEEFDialog
      open={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon={Icon}
      mode="centered"
      maxWidthClass={`w-full ${maxWidthClass}`}
      footer={footerActions}
    >
      <div className="space-y-4">
        {children}
      </div>
    </SEEFDialog>
  );
};
