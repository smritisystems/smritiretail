/**
 * ESLint Plugin: Registry Form Validation Rules
 * 
 * This plugin provides custom ESLint rules to ensure form components
 * follow the global field registry pattern.
 * 
 * To use:
 * 1. Copy this file to eslint-plugin-smriti-registry/index.js
 * 2. Add to .eslintrc.cjs:
 *    {
 *      "plugins": ["smriti-registry"],
 *      "rules": {
 *        "smriti-registry/require-data-field-key": "warn",
 *        "smriti-registry/no-hardcoded-fields": "warn"
 *      }
 *    }
 */

const requireDataFieldKeyRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require data-field-key attribute on form input fields",
      category: "Registry Patterns",
      recommended: true
    },
    fixable: null,
    messages: {
      missingFieldKey: "Form input should have data-field-key attribute for registry integration",
      exampleUsage: "Add: data-field-key='field_name' to enable F2 lookup support"
    }
  },

  create(context) {
    return {
      JSXOpeningElement(node) {
        // Check if this is an input element
        if (node.name.name !== "input" && node.name.name !== "textarea") {
          return;
        }

        // Skip input types that don't need field keys
        const typeAttr = node.attributes.find(
          attr => attr.type === "JSXAttribute" && attr.name?.name === "type"
        );
        
        if (typeAttr?.value?.value) {
          const inputType = typeAttr.value.value;
          if (["hidden", "button", "submit", "reset", "file", "checkbox", "radio"].includes(inputType)) {
            return;
          }
        }

        // Check if data-field-key exists
        const hasFieldKey = node.attributes.some(
          attr => attr.type === "JSXAttribute" && attr.name?.name === "data-field-key"
        );

        if (!hasFieldKey) {
          context.report({
            node,
            messageId: "missingFieldKey",
            data: {
              suggestion: "Add data-field-key='field_name' to this input"
            }
          });
        }
      }
    };
  }
};

const noHardcodedFieldsRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Prohibit hardcoded field/column arrays in form components",
      category: "Registry Patterns",
      recommended: true
    },
    fixable: null,
    messages: {
      hardcodedArray: "Hardcoded field/column arrays should use registry instead",
      usageExample: "Use getVisibleFieldIds(screenId, entity) from globalFieldRegistry"
    }
  },

  create(context) {
    const sourceCode = context.getSourceCode();
    const filename = context.getFilename();

    // Skip registry file itself
    if (filename.includes("globalFieldRegistry")) {
      return {};
    }

    return {
      VariableDeclaration(node) {
        const isMandatoryFields = node.declarations.some(d => 
          /FIELD|COLUMN|DEFAULT_/i.test(d.id.name)
        );

        if (!isMandatoryFields) return;

        const isArrayInit = node.declarations.some(d => d.init?.type === "ArrayExpression");
        if (!isArrayInit) return;

        // Check if this component uses registry helpers
        const hasRegistryImport = sourceCode
          .getTokens(node)
          .some(t => t.value === "globalFieldRegistry");

        if (!hasRegistryImport && node.declarations.length > 0) {
          const varName = node.declarations[0]?.id?.name;
          context.report({
            node,
            messageId: "hardcodedArray",
            data: {
              variable: varName,
              suggestion: "Import getVisibleFieldIds or getFieldMetadata and use those instead"
            }
          });
        }
      }
    };
  }
};

module.exports = {
  rules: {
    "require-data-field-key": requireDataFieldKeyRule,
    "no-hardcoded-fields": noHardcodedFieldsRule
  }
};
