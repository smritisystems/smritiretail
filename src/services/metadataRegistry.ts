/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

export interface ModuleMetadata {
  id: string;
  name: string;
  version: string;
  owner: string;
  description: string;
  dependencies?: string[];
  relatedModules?: string[];
  apiEndpoints?: string[];
  databaseTables?: string[];
  permissions?: string[];
  lastUpdated?: string;
}

export interface ScreenMetadata {
  id: string;
  name: string;
  module: string;
  route: string;
  icon?: string;
  parentMenu?: string;
  relatedReports?: string[];
  relatedMasters?: string[];
  relatedTransactions?: string[];
  requiredPermissions?: string[];
  keyboardShortcuts?: Record<string, string>;
}

export interface ReportMetadata {
  id: string;
  name: string;
  category: string;
  module: string;
  description: string;
  dataSource?: string;
  defaultFilters?: string[];
  exportFormats?: string[];
  createdBy?: string;
  modifiedBy?: string;
  version: string;
  scheduleEnabled?: boolean;
  drillDownEnabled?: boolean;
}

export interface FormMetadata {
  id: string;
  version: string;
  owner: string;
  relatedTables?: string[];
  validationRules?: string[];
  requiredFields?: string[];
  optionalFields?: string[];
  workflowEnabled?: boolean;
  printFormats?: string[];
  auditEnabled?: boolean;
}

export interface ApiMetadata {
  name: string;
  version: string;
  endpoint: string;
  httpMethod: string;
  authentication: string;
  requestSchema?: string;
  responseSchema?: string;
  errorCodes?: string[];
  rateLimits?: string;
  ownerModule: string;
}

export interface DatabaseMetadata {
  tableName: string;
  primaryKey: string;
  foreignKeys?: string[];
  relationships?: string[];
  indexes?: string[];
  constraints?: string[];
  description: string;
  ownerModule: string;
  version: string;
}

export interface PrintTemplateMetadata {
  id: string;
  name: string;
  format: string;
  module: string;
  documentType: string;
  qrCodeSupport?: boolean;
  barcodeSupport?: boolean;
  logoSupport?: boolean;
  digitalSignatureSupport?: boolean;
  version: string;
}

class MetadataRegistryService {
  private modules: Map<string, ModuleMetadata> = new Map();
  private screens: Map<string, ScreenMetadata> = new Map();
  private reports: Map<string, ReportMetadata> = new Map();
  private forms: Map<string, FormMetadata> = new Map();
  private apis: Map<string, ApiMetadata> = new Map();
  private databases: Map<string, DatabaseMetadata> = new Map();
  private printTemplates: Map<string, PrintTemplateMetadata> = new Map();

  registerModule(metadata: ModuleMetadata) {
    this.modules.set(metadata.id, metadata);
  }

  registerScreen(metadata: ScreenMetadata) {
    this.screens.set(metadata.id, metadata);
  }

  registerReport(metadata: ReportMetadata) {
    this.reports.set(metadata.id, metadata);
  }

  registerForm(metadata: FormMetadata) {
    this.forms.set(metadata.id, metadata);
  }

  registerApi(metadata: ApiMetadata) {
    this.apis.set(`${metadata.httpMethod}:${metadata.endpoint}`, metadata);
  }

  registerDatabase(metadata: DatabaseMetadata) {
    this.databases.set(metadata.tableName, metadata);
  }

  registerPrintTemplate(metadata: PrintTemplateMetadata) {
    this.printTemplates.set(metadata.id, metadata);
  }

  getModules(): ModuleMetadata[] {
    return Array.from(this.modules.values());
  }

  getScreens(): ScreenMetadata[] {
    return Array.from(this.screens.values());
  }

  getReports(): ReportMetadata[] {
    return Array.from(this.reports.values());
  }

  getForms(): FormMetadata[] {
    return Array.from(this.forms.values());
  }

  getApis(): ApiMetadata[] {
    return Array.from(this.apis.values());
  }

  getDatabases(): DatabaseMetadata[] {
    return Array.from(this.databases.values());
  }

  getPrintTemplates(): PrintTemplateMetadata[] {
    return Array.from(this.printTemplates.values());
  }

  getAllMetadata() {
    return {
      modules: this.getModules(),
      screens: this.getScreens(),
      reports: this.getReports(),
      forms: this.getForms(),
      apis: this.getApis(),
      databases: this.getDatabases(),
      printTemplates: this.getPrintTemplates()
    };
  }
}

export const MetadataRegistry = new MetadataRegistryService();
