#!/bin/sh

###############################################################################
# Pre-commit Hook: Registry Usage Validation
#
# This hook runs before each commit to ensure all form components follow
# the global field registry pattern.
#
# Installation:
#   cp scripts/pre-commit-registry-check.sh .husky/pre-commit
#   chmod +x .husky/pre-commit
#
# To skip: git commit --no-verify
###############################################################################

set -e

echo "🔍 Checking Registry Usage in Form Components..."

# Get staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

# Find form components in staged files
FORM_FILES=$(echo "$STAGED_FILES" | grep -E "(Form|Entry|Grid|Modal|Lookup).*\.tsx$" || true)

if [ -z "$FORM_FILES" ]; then
  echo "✅ No form components to check"
  exit 0
fi

ERRORS=0

for file in $FORM_FILES; do
  if [ ! -f "$file" ]; then
    continue
  fi

  BASENAME=$(basename "$file")

  # Skip exempt files
  case "$BASENAME" in
    GlobalF2BrowseDlg.tsx|ItemDetailsGridTab.tsx|ItemEntryView.tsx|SalesOrderFormPremium.tsx)
      continue
      ;;
  esac

  # Check for inputs without data-field-key
  INPUT_COUNT=$(grep -c 'type="text"\|type="number"\|type="email"' "$file" || true)
  if [ "$INPUT_COUNT" -gt 0 ]; then
    FIELDKEY_COUNT=$(grep -c 'data-field-key' "$file" || true)
    if [ "$FIELDKEY_COUNT" -lt "$INPUT_COUNT" ]; then
      echo "❌ $file: Found inputs without data-field-key attributes ($FIELDKEY_COUNT/$INPUT_COUNT)"
      ERRORS=$((ERRORS + 1))
    fi
  fi

  # Check for hardcoded field arrays
  if grep -q "const.*FIELDS.*=\|const.*COLUMNS.*=\|const DEFAULT_" "$file"; then
    if ! grep -q "globalFieldRegistry" "$file"; then
      echo "⚠️  $file: Contains hardcoded field/column arrays"
      echo "   Tip: Use getVisibleFieldIds() from globalFieldRegistry instead"
      ERRORS=$((ERRORS + 1))
    fi
  fi
done

if [ $ERRORS -gt 0 ]; then
  echo ""
  echo "❌ Pre-commit check failed: $ERRORS issue(s) found"
  echo ""
  echo "💡 To fix:"
  echo "   1. Add data-field-key='field_name' to all input fields"
  echo "   2. Use getVisibleFieldIds() or getFieldMetadata() from registry"
  echo "   3. Run: npm run validate-registry"
  echo ""
  echo "To skip this check (not recommended):"
  echo "   git commit --no-verify"
  echo ""
  exit 1
fi

echo "✅ Registry usage check passed!"
exit 0
