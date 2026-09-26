"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.44.0
Created      : 2026-09-23
Modified     : 2026-09-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Code Generator — Canonical Field Registry (TypeScript)
"""

import sys
import os
import json
from pathlib import Path

# Add backend to sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.governance.field_registry import (
    CANONICAL_FIELDS,
    CanonicalFieldDef,
    CFOC_REGISTRY_VERSION,
    CFOC_REGISTRY_FIELDS,
    CFOC_REGISTRY_FINGERPRINT,
)

TARGET_TS_FILE = Path(__file__).resolve().parent.parent / "src" / "services" / "canonicalFieldRegistry.ts"


def generate_typescript_content() -> str:
    field_ids = sorted(CANONICAL_FIELDS.keys())
    field_ids_type = "\n  | ".join(f'"{fid}"' for fid in field_ids)

    # Build TS dictionary content
    ts_entries = []
    for fid in field_ids:
        f = CANONICAL_FIELDS[fid]
        help_text = f'"{f.help_text}"' if f.help_text else "undefined"
        placeholder = f'"{f.placeholder}"' if f.placeholder else "undefined"
        val_rule = f'"{f.validation_rule}"' if f.validation_rule else "undefined"
        opt_source = f'"{f.option_source}"' if f.option_source else "undefined"
        max_len = f"{f.max_length}" if f.max_length is not None else "undefined"
        min_val = f"{f.min_value}" if f.min_value is not None else "undefined"
        max_val = f"{f.max_value}" if f.max_value is not None else "undefined"
        aliases_json = json.dumps(list(f.aliases))

        api_key_str = f'"{f.api_key}"' if f.api_key else "undefined"
        api_ep_str = f'"{f.api_endpoint}"' if f.api_endpoint else "undefined"

        entry = f"""  "{fid}": {{
    fieldId: "{f.field_id}",
    entityId: "{f.entity_id}",
    dbTable: "{f.db_table}",
    dbColumn: "{f.db_column}",
    dataType: "{f.data_type}",
    fieldType: "{f.field_type}",
    label: "{f.label}",
    helpText: {help_text},
    placeholder: {placeholder},
    required: {str(f.required).lower()},
    editable: {str(f.editable).lower()},
    searchable: {str(f.searchable).lower()},
    filterable: {str(f.filterable).lower()},
    sortable: {str(f.sortable).lower()},
    readonly: {str(f.readonly).lower()},
    maxLength: {max_len},
    minValue: {min_val},
    maxValue: {max_val},
    validationRule: {val_rule},
    optionSource: {opt_source},
    status: "{f.status}",
    lifecycle: "{f.lifecycle}",
    ownership: "{f.ownership}",
    version: {f.version},
    aliases: {aliases_json},
    apiKey: {api_key_str},
    apiEndpoint: {api_ep_str},
  }}"""
        ts_entries.append(entry)

    ts_entries_str = ",\n".join(ts_entries)

    content = f"""/**
 * ══════════════════════════════════════════════════════════════════════════════
 * AUTO-GENERATED FILE — DO NOT HAND-EDIT!
 * Any manual changes to this file will be REJECTED by CI Guard.
 * Authoritative Source: backend/app/governance/field_registry.py
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : {CFOC_REGISTRY_VERSION}
 * Created      : 2026-09-23
 * Modified     : 2026-09-23
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Frontend SSOT — Canonical Field Registry
 */

export const CFOC_REGISTRY_VERSION = "{CFOC_REGISTRY_VERSION}";
export const CFOC_REGISTRY_FIELDS = {CFOC_REGISTRY_FIELDS};
export const CFOC_REGISTRY_FINGERPRINT = "{CFOC_REGISTRY_FINGERPRINT}";

export type FieldLifecycle = "DRAFT" | "ACTIVE" | "DEPRECATED" | "RETIRED" | "LEGACY";

export type CanonicalFieldId =
  | {field_ids_type};

export interface CanonicalFieldDef {{
  fieldId: CanonicalFieldId | string;
  entityId: string;
  dbTable: string;
  dbColumn: string;
  dataType: "STRING" | "INTEGER" | "DECIMAL" | "BOOLEAN" | "DATE" | "DATETIME" | "JSON";
  fieldType: "TEXT" | "NUMBER" | "DATE" | "DATETIME" | "SELECT" | "MULTI_SELECT" | "BOOLEAN" | "LOOKUP" | "CURRENCY" | "BARCODE" | "FILE";
  label: string;
  helpText?: string;
  placeholder?: string;
  required: boolean;
  editable: boolean;
  searchable: boolean;
  filterable: boolean;
  sortable: boolean;
  readonly: boolean;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  validationRule?: string;
  optionSource?: string;
  status: FieldLifecycle | string;
  lifecycle: FieldLifecycle;
  ownership: "TENANT" | "CONTROL_PLANE" | "SHARED_REFERENCE";
  version: number;
  aliases: string[];
  apiKey?: string;
  apiEndpoint?: string;
}}

export const CANONICAL_FIELDS: Readonly<Record<string, CanonicalFieldDef>> = Object.freeze({{
{ts_entries_str}
}});

/**
 * Retrieves the canonical definition for a given field ID.
 */
export function getCanonicalField(fieldId: CanonicalFieldId | string): CanonicalFieldDef | undefined {{
  return CANONICAL_FIELDS[fieldId];
}}

/**
 * Resolves a field definition by entity key and either canonical name or alias.
 */
export function resolveCanonicalField(entityId: string, fieldNameOrAlias: string): CanonicalFieldDef | undefined {{
  const target = fieldNameOrAlias.trim();
  if (target.includes(".")) {{
    return CANONICAL_FIELDS[target];
  }}
  const directId = `${{entityId}}.${{target}}`;
  if (CANONICAL_FIELDS[directId]) {{
    return CANONICAL_FIELDS[directId];
  }}

  const lower = target.toLowerCase();
  for (const def of Object.values(CANONICAL_FIELDS)) {{
    if (def.entityId === entityId) {{
      if (def.dbColumn.toLowerCase() === lower) {{
        return def;
      }}
      if (def.aliases && def.aliases.some((a) => a.toLowerCase() === lower)) {{
        return def;
      }}
    }}
  }}
  return undefined;
}}

/**
 * Helper to obtain the authoritative label, with optional fallback.
 */
export function getFieldLabel(fieldId: CanonicalFieldId | string, fallback?: string): string {{
  const f = CANONICAL_FIELDS[fieldId];
  return f ? f.label : (fallback || fieldId);
}}

/**
 * Helper to obtain the authoritative placeholder, with optional fallback.
 */
export function getFieldPlaceholder(fieldId: CanonicalFieldId | string, fallback?: string): string {{
  const f = CANONICAL_FIELDS[fieldId];
  return (f && f.placeholder) ? f.placeholder : (fallback || "");
}}

/**
 * Helper to check if a field is required by canonical business metadata.
 */
export function isFieldRequired(fieldId: CanonicalFieldId | string): boolean {{
  const f = CANONICAL_FIELDS[fieldId];
  return f ? f.required : false;
}}

/**
 * Helper to obtain max character length.
 */
export function getFieldMaxLength(fieldId: CanonicalFieldId | string): number | undefined {{
  const f = CANONICAL_FIELDS[fieldId];
  return f ? f.maxLength : undefined;
}}

/**
 * Helper to check if a field is read-only.
 */
export function isFieldReadOnly(fieldId: CanonicalFieldId | string): boolean {{
  const f = CANONICAL_FIELDS[fieldId];
  return f ? f.readonly : false;
}}

/**
 * Returns all canonical fields registered for a given business entity.
 */
export function getEntityCanonicalFields(entityId: string): CanonicalFieldDef[] {{
  return Object.values(CANONICAL_FIELDS).filter((f) => f.entityId === entityId);
}}
"""
    return content


def generate_typescript_registry():
    print(f"Generating TypeScript Canonical Field Registry from {len(CANONICAL_FIELDS)} definitions...")
    content = generate_typescript_content()
    TARGET_TS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(TARGET_TS_FILE, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Generated {TARGET_TS_FILE} successfully ({len(content)} bytes).")


if __name__ == "__main__":
    generate_typescript_registry()

