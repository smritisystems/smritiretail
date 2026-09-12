/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.0.0
 * Created      : 2026-08-28
 * Modified     : 2026-09-11
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Status       : DEPRECATED ADAPTER (Consolidated into VendorReturnModal & Canonical RTV Engine)
 */

import React from "react";
import { VendorReturnModal } from "./VendorReturnModal.tsx";

export interface PRTVModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

/**
 * PRTVModal (Deprecated Adapter)
 *
 * Provides 100% backward compatibility for any legacy callers of PRTVModal by delegating
 * directly to the unified, full-lifecycle VendorReturnModal and Canonical RTV Engine.
 */
export const PRTVModal: React.FC<PRTVModalProps> = (props) => {
  return <VendorReturnModal {...props} />;
};

export default PRTVModal;
