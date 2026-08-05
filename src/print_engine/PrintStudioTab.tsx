/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Component    : PrintStudioTab Facade & Re-export (DXP-DOC-001 Standard)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 3.0.0
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 *
 * Facade Compliance
 * Re-exports modular DocumentStudio for 100% backward compatibility.
 */

import React from "react";
import { DocumentStudio } from "../dop/studio/DocumentStudioHost.tsx";

export { DocumentStudio };
export const PrintStudioTab: React.FC = () => <DocumentStudio />;
