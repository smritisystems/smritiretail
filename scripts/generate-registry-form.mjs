#!/usr/bin/env node

/**
 * Registry-Driven Form Component Template Generator
 * 
 * Generates a new form component that automatically follows registry patterns.
 * 
 * Usage:
 *   node scripts/generate-registry-form.mjs --entity=customer --screen=customer_form --fields=customer_code,customer_name,customer_mobile
 *   node scripts/generate-registry-form.mjs --help
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

function showHelp() {
  console.log(`
📋 Registry-Driven Form Generator

Usage:
  node scripts/generate-registry-form.mjs [options]

Options:
  --entity=NAME       Entity type (e.g., customer, supplier, product)
  --screen=ID         Screen ID for registry config (e.g., customer_form)
  --fields=LIST       Comma-separated field keys (e.g., customer_code,customer_name)
  --output=PATH       Output file path (default: src/components/[Entity]Form.tsx)
  --help              Show this help message

Examples:
  Generate customer form:
    node scripts/generate-registry-form.mjs --entity=customer --screen=customer_form

  Generate supplier form with specific fields:
    node scripts/generate-registry-form.mjs \\
      --entity=supplier \\
      --screen=supplier_edit \\
      --fields=supplier_code,supplier_name,supplier_mobile,gstin

Notes:
  • All form inputs will automatically have data-field-key attributes
  • F2 lookup support is automatic via ActiveFieldContext
  • Field visibility is driven by GLOBAL_SCREEN_FIELD_CONFIG in registry
  • No custom lookup logic needed - GlobalF2LookupModal handles it
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      showHelp();
      process.exit(0);
    }

    const [key, value] = arg.split("=");
    if (key.startsWith("--")) {
      options[key.slice(2)] = value || true;
    }
  }

  return options;
}

function generateComponent(entity, screenId, fields) {
  const entityTitle = entity.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("");
  const componentName = `${entityTitle}Form`;

  const fieldsArray = fields
    ? `["${fields.split(",").map(f => f.trim()).join('", "')}"]`
    : `getVisibleFieldIds("${screenId}", "${entity}")`;

  const template = `/**
 * Project      : SMRITI Retail OS
 * Module       : ${entityTitle} Form
 * Auto-Generated: $(date)
 * 
 * This component follows the Global Field Registry pattern:
 * - All fields are configured in src/services/globalFieldRegistry.ts
 * - F2 lookup is automatic via data-field-key attributes
 * - No custom lookup logic needed
 */

import React, { useState, useMemo, useCallback } from "react";
import { getFieldMetadata, getVisibleFieldIds } from "../../services/globalFieldRegistry.ts";
import { useActiveField } from "../../context/ActiveFieldContext.ts";

interface ${entityTitle}FormProps {
  onSubmit?: (data: Record<string, any>) => Promise<void>;
  initialData?: Record<string, any>;
}

export const ${componentName}: React.FC<${entityTitle}FormProps> = ({
  onSubmit,
  initialData = {}
}) => {
  const { insertValueIntoActiveField } = useActiveField();
  const [formData, setFormData] = useState(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get visible fields from registry for this screen
  const visibleFieldKeys = useMemo(() => ${fieldsArray}, []);

  const handleFieldChange = useCallback((fieldKey: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [fieldKey]: value
    }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubmit) return;

    setIsSaving(true);
    setError(null);

    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Form fields are driven by registry - no hardcoded arrays */}
      {visibleFieldKeys.map(fieldKey => {
        const fieldMeta = getFieldMetadata(fieldKey);
        if (!fieldMeta) return null;

        const value = formData[fieldKey] || "";

        return (
          <div key={fieldKey} className="form-group">
            <label htmlFor={fieldKey} className="block text-sm font-medium mb-1">
              {fieldMeta.label}
              {fieldMeta.required && <span className="text-red-500">*</span>}
            </label>

            {fieldMeta.dataType === "select" ? (
              <select
                id={fieldKey}
                value={value}
                onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                data-field-key={fieldKey}
                data-field-type="${entity}"
                required={fieldMeta.required}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">-- Select {fieldMeta.label} --</option>
                {/* Add options from API or static list */}
              </select>
            ) : fieldMeta.dataType === "date" ? (
              <input
                type="date"
                id={fieldKey}
                value={value}
                onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                data-field-key={fieldKey}
                data-field-type="${entity}"
                required={fieldMeta.required}
                className="w-full px-3 py-2 border rounded-lg"
              />
            ) : fieldMeta.dataType === "number" ? (
              <input
                type="number"
                id={fieldKey}
                value={value}
                onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                data-field-key={fieldKey}
                data-field-type="${entity}"
                required={fieldMeta.required}
                className="w-full px-3 py-2 border rounded-lg text-right"
              />
            ) : fieldMeta.dataType === "currency" ? (
              <div className="flex items-center">
                <span className="text-sm text-gray-500 mr-2">₹</span>
                <input
                  type="number"
                  step="0.01"
                  id={fieldKey}
                  value={value}
                  onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                  data-field-key={fieldKey}
                  data-field-type="${entity}"
                  required={fieldMeta.required}
                  className="flex-1 px-3 py-2 border rounded-lg text-right"
                />
              </div>
            ) : (
              <input
                type="text"
                id={fieldKey}
                value={value}
                onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                data-field-key={fieldKey}
                data-field-type="${entity}"
                placeholder={fieldMeta.label}
                required={fieldMeta.required}
                className="w-full px-3 py-2 border rounded-lg"
              />
            )}

            {fieldMeta.description && (
              <p className="text-xs text-gray-500 mt-1">{fieldMeta.description}</p>
            )}
          </div>
        );
      })}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSaving}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {isSaving ? "Saving..." : "Save"}
      </button>
    </form>
  );
};
`;

  return template;
}

function main() {
  const options = parseArgs();

  if (!options.entity) {
    console.error("❌ Error: --entity is required\n");
    showHelp();
    process.exit(1);
  }

  const entity = options.entity;
  const screenId = options.screen || \`\${entity}_form\`;
  const fields = options.fields || null;
  const output = options.output || path.join(projectRoot, \`src/components/forms/\${entity.charAt(0).toUpperCase() + entity.slice(1)}Form.tsx\`);

  console.log("🔨 Generating Registry-Driven Form Component...\n");
  console.log(\`Entity:  \${entity}\`);
  console.log(\`Screen:  \${screenId}\`);
  console.log(\`Fields:  \${fields || "All visible fields from registry"}\`);
  console.log(\`Output:  \${output}\n\`);

  // Ensure directory exists
  const dir = path.dirname(output);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(\`📁 Created directory: \${dir}\`);
  }

  // Generate component
  const component = generateComponent(entity, screenId, fields);

  // Write file
  fs.writeFileSync(output, component);
  console.log(\`✅ Generated: \${path.relative(projectRoot, output)}\n\`);

  console.log("📝 Next Steps:");
  console.log(\`  1. Verify fields in globalFieldRegistry.ts\`);
  console.log(\`  2. Add screen config to GLOBAL_SCREEN_FIELD_CONFIG\`);
  console.log(\`  3. Import and use the component in your module\`);
  console.log(\`  4. Test F2 lookup by pressing F2 in any field\`);
  console.log(\`  5. Run: npm run build && npm test\n\`);
}

main();
