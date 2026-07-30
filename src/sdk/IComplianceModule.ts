/**
 * Project      : SMRITI Retail OS
 * Architecture : SMRITI Compliance Platform (SCP v1.0 Kernel)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 * Classification: Internal Platform Standard (SCP-001)
 */

export interface ComplianceIssue {
  severity: 'ERROR' | 'WARNING' | 'INFO';
  code: string;
  message: string;
  fieldRef: string;
  suggestedFix?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ComplianceIssue[];
  validatedAt: string;
}

export interface CalculationComponent {
  component: string; // e.g., "CGST", "SGST", "IGST", "CESS", "TDS_194C"
  rate: number;
  taxableAmount: number;
  taxAmount: number;
  ledgerAccount: string;
}

export interface CalculationResult {
  taxableTotal: number;
  taxTotal: number;
  grandTotal: number;
  components: CalculationComponent[];
}

export interface ReturnPayload {
  period: string; // YYYY-MM
  moduleName: string;
  jsonPayload: Record<string, any>;
  summary: {
    totalTaxable: number;
    totalTax: number;
    recordCount: number;
  };
}

export interface ComplianceException {
  exceptionId: string;
  voucherId: string;
  voucherNo: string;
  entityType: 'SALES_INVOICE' | 'PURCHASE_RECEIPT' | 'PAYMENT_VOUCHER' | 'JOURNAL_VOUCHER';
  severity: 'ERROR' | 'WARNING';
  category: 'GSTIN' | 'HSN' | 'TAX_RATE' | 'EWAY_BILL' | 'MSME' | 'REVERSE_CHARGE';
  errorCode: string;
  title: string;
  description: string;
  suggestedFix: string;
  fieldRef: string;
  currentValue?: string;
}

export interface IComplianceModule {
  readonly id: string;
  readonly name: string;
  readonly jurisdiction: string;
  readonly category: 'TAX' | 'REGULATORY' | 'LABOUR' | 'CORPORATE';
  
  initialize(tenantConfig: Record<string, any>): Promise<void>;
  validate(voucher: Record<string, any>): Promise<ValidationResult>;
  calculate(voucher: Record<string, any>, effectiveDate?: string): Promise<CalculationResult>;
  generateReturn(period: string): Promise<ReturnPayload>;
  exportPayload(payload: ReturnPayload, format: 'JSON' | 'EXCEL' | 'CSV' | 'XML'): Promise<Blob>;
  submitToGateway(payload: ReturnPayload, connectorName: string): Promise<{ ackNo: string; status: string }>;
  simulateSandbox(voucher: Record<string, any>): Promise<{ validation: ValidationResult; calculation: CalculationResult }>;
}
