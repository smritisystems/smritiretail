/**
 * Project      : SMRITI Retail OS
 * Module       : Capability System Types (Rule SLP-003 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

export type CapabilityId =
  | "ai_advisory"
  | "barcode_engine"
  | "direct_printing"
  | "email_gateway"
  | "sms_gateway"
  | "whatsapp_integration"
  | "cloud_backup"
  | "communicator"
  | "tally_connector"
  | "excel_studio";

export interface CapabilityDescriptor {
  id: CapabilityId;
  name: string;
  category: "Advisory" | "Hardware" | "Communication" | "Integration" | "Data";
  enabled: boolean;
  status: "Available" | "Disabled" | "Unconfigured" | "Unavailable";
  description: string;
}
