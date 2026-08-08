/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printing Kernel — Multi-PRN Universal Template Registry
 * Standard     : SCS-PRINT-TEMPLATE-REGISTRY-001 (v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { UniversalPrintTemplate, TemplateStatus, TemplateSourceFormat } from "../models/UniversalPrintTemplate.ts";
import { PRNAstParser } from "../prn_engine/PRNAstParser.ts";
import { PrinterLanguageDetector, DetectedPrinterLanguage } from "../prn_engine/PrinterLanguageDetector.ts";

export interface TemplateFilterCriteria {
  name?: string;
  language?: DetectedPrinterLanguage;
  status?: TemplateStatus;
  sourceFormat?: TemplateSourceFormat;
  minWidthMm?: number;
  maxWidthMm?: number;
  supportsBarcode?: boolean;
  supportsQR?: boolean;
}

export interface ImportPRNOptions {
  name?: string;
  description?: string;
  languageOverride?: DetectedPrinterLanguage;
  templateId?: string;
  version?: string;
}

export class UniversalTemplateRegistryService {
  // Map of templateId -> Map of version -> UniversalPrintTemplate
  private templates: Map<string, Map<string, UniversalPrintTemplate>> = new Map();

  constructor() {
    this.clear();
  }

  /**
   * Resets the registry to an empty state with zero templates.
   */
  public clear(): void {
    this.templates.clear();
  }

  /**
   * Returns the count of unique template families registered.
   */
  public size(): number {
    return this.templates.size;
  }

  /**
   * Checks whether a template family (or specific version) exists in the registry.
   */
  public exists(templateId: string, version?: string): boolean {
    const versionsMap = this.templates.get(templateId);
    if (!versionsMap) return false;
    if (version) {
      return versionsMap.has(version);
    }
    return versionsMap.size > 0;
  }

  /**
   * Registers a UniversalPrintTemplate instance.
   */
  public register(template: UniversalPrintTemplate): UniversalPrintTemplate {
    if (!template || !template.metadata || !template.metadata.id) {
      throw new Error("Cannot register invalid template: missing ID or metadata.");
    }

    const id = template.metadata.id;
    const version = template.metadata.version || "1.0.0";

    if (!this.templates.has(id)) {
      this.templates.set(id, new Map());
    }

    const versionsMap = this.templates.get(id)!;
    versionsMap.set(version, template);
    return template;
  }

  /**
   * Unregisters a template (all versions or a specific version).
   */
  public unregister(templateId: string, version?: string): boolean {
    const versionsMap = this.templates.get(templateId);
    if (!versionsMap) return false;

    if (version) {
      const deleted = versionsMap.delete(version);
      if (versionsMap.size === 0) {
        this.templates.delete(templateId);
      }
      return deleted;
    }

    return this.templates.delete(templateId);
  }

  /**
   * Retrieves a template by ID. Returns the active version or latest registered version if no active version is set.
   */
  public get(templateId: string): UniversalPrintTemplate | undefined {
    const active = this.resolveActiveVersion(templateId);
    if (active) return active;

    const versionsMap = this.templates.get(templateId);
    if (!versionsMap || versionsMap.size === 0) return undefined;

    // Fall back to latest version string
    const sortedVersions = Array.from(versionsMap.keys()).sort();
    return versionsMap.get(sortedVersions[sortedVersions.length - 1]);
  }

  /**
   * Retrieves a specific version of a template.
   */
  public getVersion(templateId: string, version: string): UniversalPrintTemplate | undefined {
    const versionsMap = this.templates.get(templateId);
    if (!versionsMap) return undefined;
    return versionsMap.get(version);
  }

  /**
   * Resolves the ACTIVE version of a template.
   */
  public resolveActiveVersion(templateId: string): UniversalPrintTemplate | undefined {
    const versionsMap = this.templates.get(templateId);
    if (!versionsMap) return undefined;

    for (const tmpl of versionsMap.values()) {
      if (tmpl.status === "ACTIVE") {
        return tmpl;
      }
    }
    return undefined;
  }

  /**
   * Lists all registered templates (one representative per template family: active or latest).
   */
  public list(): UniversalPrintTemplate[] {
    const result: UniversalPrintTemplate[] = [];
    this.templates.forEach((versionsMap, id) => {
      const activeOrLatest = this.get(id);
      if (activeOrLatest) {
        result.push(activeOrLatest);
      }
    });
    return result;
  }

  /**
   * Lists all versions registered for a given template ID.
   */
  public listVersions(templateId: string): UniversalPrintTemplate[] {
    const versionsMap = this.templates.get(templateId);
    if (!versionsMap) return [];
    return Array.from(versionsMap.values());
  }

  /**
   * Searches templates by name, ID, or description substring match.
   */
  public search(query: string): UniversalPrintTemplate[] {
    if (!query || query.trim().length === 0) return this.list();
    const q = query.toLowerCase();

    return this.list().filter(
      (tmpl) =>
        tmpl.metadata.id.toLowerCase().includes(q) ||
        tmpl.metadata.name.toLowerCase().includes(q) ||
        (tmpl.metadata.description && tmpl.metadata.description.toLowerCase().includes(q))
    );
  }

  /**
   * Filters templates by structural metadata and hardware capability criteria.
   */
  public filter(criteria: TemplateFilterCriteria): UniversalPrintTemplate[] {
    return this.list().filter((tmpl) => {
      if (criteria.name && !tmpl.metadata.name.toLowerCase().includes(criteria.name.toLowerCase())) {
        return false;
      }
      if (criteria.status && tmpl.status !== criteria.status) {
        return false;
      }
      if (criteria.sourceFormat && tmpl.metadata.sourceFormat !== criteria.sourceFormat) {
        return false;
      }
      if (criteria.language && tmpl.source.originalFormat !== criteria.language) {
        return false;
      }
      if (criteria.minWidthMm !== undefined && tmpl.document.dimensions.widthMm < criteria.minWidthMm) {
        return false;
      }
      if (criteria.maxWidthMm !== undefined && tmpl.document.dimensions.widthMm > criteria.maxWidthMm) {
        return false;
      }
      if (criteria.supportsBarcode && !tmpl.document.capabilities.supportsBarcode) {
        return false;
      }
      if (criteria.supportsQR && !tmpl.document.capabilities.supportsQRCode) {
        return false;
      }
      return true;
    });
  }

  /**
   * Clones an existing template into a completely new template identity family.
   */
  public clone(templateId: string, newName?: string): UniversalPrintTemplate {
    const sourceTmpl = this.get(templateId);
    if (!sourceTmpl) {
      throw new Error(`Cannot clone non-existent template '${templateId}'.`);
    }

    const clonedId = `tmpl-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const cloned = sourceTmpl.clone(clonedId, newName || `Copy of ${sourceTmpl.metadata.name}`);
    cloned.status = "DRAFT";

    this.register(cloned);
    return cloned;
  }

  /**
   * Duplicates a template (alias for clone).
   */
  public duplicate(templateId: string, newName?: string): UniversalPrintTemplate {
    return this.clone(templateId, newName);
  }

  /**
   * Creates a new version of an existing template without mutating the active version in place.
   */
  public createVersion(templateId: string, newVersion?: string): UniversalPrintTemplate {
    const current = this.get(templateId);
    if (!current) {
      throw new Error(`Cannot create version for non-existent template '${templateId}'.`);
    }

    const newTmpl = current.clone(current.metadata.id, current.metadata.name);
    newTmpl.bumpVersion(newVersion);
    newTmpl.status = "DRAFT"; // New versions start in DRAFT state

    this.register(newTmpl);
    return newTmpl;
  }

  /**
   * Activates a template version, setting its status to ACTIVE and optionally archiving previous ACTIVE versions.
   */
  public activate(templateId: string, version?: string): UniversalPrintTemplate {
    const targetVersion = version || (this.get(templateId)?.metadata.version ?? "1.0.0");
    const tmpl = this.getVersion(templateId, targetVersion);

    if (!tmpl) {
      throw new Error(`Cannot activate template '${templateId}' version '${targetVersion}' - not found.`);
    }

    // Archive current active version if different
    const currentActive = this.resolveActiveVersion(templateId);
    if (currentActive && currentActive.metadata.version !== targetVersion) {
      currentActive.status = "ARCHIVED";
    }

    tmpl.status = "ACTIVE";
    tmpl.metadata.updatedAt = new Date().toISOString();
    return tmpl;
  }

  /**
   * Archives a template version, retaining it for diagnostics/history while blocking production selection.
   */
  public archive(templateId: string, version?: string): UniversalPrintTemplate {
    const targetVersion = version || (this.get(templateId)?.metadata.version ?? "1.0.0");
    const tmpl = this.getVersion(templateId, targetVersion);

    if (!tmpl) {
      throw new Error(`Cannot archive template '${templateId}' version '${targetVersion}' - not found.`);
    }

    tmpl.status = "ARCHIVED";
    tmpl.metadata.updatedAt = new Date().toISOString();
    return tmpl;
  }

  /**
   * Invalidates a template version, blocking it from print execution.
   */
  public invalidate(templateId: string, version?: string): UniversalPrintTemplate {
    const targetVersion = version || (this.get(templateId)?.metadata.version ?? "1.0.0");
    const tmpl = this.getVersion(templateId, targetVersion);

    if (!tmpl) {
      throw new Error(`Cannot invalidate template '${templateId}' version '${targetVersion}' - not found.`);
    }

    tmpl.status = "INVALID";
    tmpl.metadata.updatedAt = new Date().toISOString();
    return tmpl;
  }

  /**
   * Multi-PRN Import Pipeline: Detects printer language, parses AST, creates template, and registers it.
   */
  public importPRN(
    sourceContent: string,
    options?: ImportPRNOptions
  ): {
    template?: UniversalPrintTemplate;
    diagnostics: string[];
    ambiguous: boolean;
  } {
    const diagnostics: string[] = [];

    // Language Detection
    const detected = PrinterLanguageDetector.detect(sourceContent);
    const lang = options?.languageOverride || detected.language;

    // Check ambiguity requirement: if confidence is low and no override supplied, require user confirmation
    if (!options?.languageOverride && (detected.ambiguous || detected.confidence < 0.5)) {
      diagnostics.push(
        `Printer language detection is ambiguous (detected: ${detected.language}, confidence: ${detected.confidence}). Explicit user language confirmation required.`
      );
      return { template: undefined, diagnostics, ambiguous: true };
    }

    const ast = PRNAstParser.parse(sourceContent, lang);
    const doc = ast.convertToUniversalLabelDocument();

    const templateId = options?.templateId || `tmpl-import-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const tmpl = new UniversalPrintTemplate({
      name: options?.name || `Imported ${lang} Template`,
      metadata: {
        id: templateId,
        name: options?.name || `Imported ${lang} Template`,
        version: options?.version || "1.0.0",
        description: options?.description || `Imported ${lang} script`,
        sourceFormat: `PRN_${lang}` as any,
        sourceType: "IMPORTED_PRN",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      source: {
        originalContent: sourceContent,
        originalFormat: lang,
      },
      document: doc.toJSON(),
      status: "ACTIVE",
    });

    // Extract placeholders into field mappings facade
    ast.variables.forEach((v) => {
      tmpl.setFieldMapping(v.tag, "");
    });

    this.register(tmpl);
    return { template: tmpl, diagnostics, ambiguous: false };
  }

  /**
   * Exports the original unmodified PRN source stream for a registered template version.
   */
  public exportTemplate(templateId: string, version?: string): string {
    const tmpl = version ? this.getVersion(templateId, version) : this.get(templateId);
    if (!tmpl) {
      throw new Error(`Cannot export non-existent template '${templateId}'.`);
    }
    return tmpl.source.originalContent;
  }

  /**
   * Finds registered templates with an identical source checksum without merging their identities.
   */
  public findTemplatesWithSameChecksum(checksum: string): UniversalPrintTemplate[] {
    const matches: UniversalPrintTemplate[] = [];
    this.list().forEach((tmpl) => {
      if (tmpl.source.checksum === checksum) {
        matches.push(tmpl);
      }
    });
    return matches;
  }
}

export const UniversalTemplateRegistry = new UniversalTemplateRegistryService();
