const assert = require('assert');

// Mock SKU generation function directly in test runner for assertion
function sanitizeSkuToken(val, maxLen = 20) {
  if (!val) return "";
  return val.trim().toUpperCase().replace(/[^A-Z0-9\-]/g, "").slice(0, maxLen);
}

function generateSkuCode(params) {
  const {
    mode,
    manualSku = "",
    hybridPrefix = "",
    formatPattern = "STYLE_COLOR_SIZE",
    customTemplate = "{style}-{color}-{size}",
    styleCode = "",
    color = "",
    size = "",
    category = "",
    brand = "",
    sequence = "",
  } = params;

  if (mode === "manual") {
    return manualSku.trim().toUpperCase();
  }

  const tokenStyle = sanitizeSkuToken(styleCode, 15) || "STL";
  const tokenColor = sanitizeSkuToken(color, 10);
  const tokenSize = sanitizeSkuToken(size, 8);
  const tokenCategory = sanitizeSkuToken(category, 10);
  const tokenBrand = sanitizeSkuToken(brand, 6);
  const tokenSeq = sequence ? String(sequence).padStart(4, "0") : "";

  let baseSku = "";

  if (formatPattern === "CUSTOM" && customTemplate) {
    baseSku = customTemplate
      .replace(/{style}/gi, tokenStyle)
      .replace(/{color}/gi, tokenColor)
      .replace(/{size}/gi, tokenSize)
      .replace(/{category}/gi, tokenCategory)
      .replace(/{brand}/gi, tokenBrand)
      .replace(/{seq}/gi, tokenSeq);
    baseSku = baseSku.replace(/-+/g, "-").replace(/^-|-$/g, "");
  } else {
    switch (formatPattern) {
      case "STYLE_SIZE_COLOR": {
        const parts = [tokenStyle, tokenSize, tokenColor].filter(Boolean);
        baseSku = parts.join("-");
        break;
      }
      case "CAT_STYLE_COLOR_SIZE": {
        const parts = [tokenCategory, tokenStyle, tokenColor, tokenSize].filter(Boolean);
        baseSku = parts.join("-");
        break;
      }
      case "BRAND_STYLE_COLOR_SIZE": {
        const parts = [tokenBrand, tokenStyle, tokenColor, tokenSize].filter(Boolean);
        baseSku = parts.join("-");
        break;
      }
      case "STYLE_COLOR_SIZE":
      default: {
        const parts = [tokenStyle, tokenColor, tokenSize].filter(Boolean);
        baseSku = parts.join("-");
        break;
      }
    }
  }

  if (mode === "hybrid") {
    const cleanPrefix = sanitizeSkuToken(hybridPrefix, 20);
    if (!cleanPrefix) return baseSku;
    const attrParts = [tokenColor, tokenSize].filter(Boolean);
    return attrParts.length > 0 ? `${cleanPrefix}-${attrParts.join("-")}` : cleanPrefix;
  }

  return baseSku;
}

console.log('=== SMRITI RETAIL OS — SKU GENERATION ENGINE UNIT TEST SUITE ===\n');

// 1. Test MANUAL Mode
const skuManual = generateSkuCode({ mode: 'manual', manualSku: 'MY-CUSTOM-SKU-123' });
console.log('Test 1 [MANUAL Mode]:', skuManual);
assert.strictEqual(skuManual, 'MY-CUSTOM-SKU-123');

// 2. Test AUTO Mode (Style + Color + Size)
const skuAuto1 = generateSkuCode({
  mode: 'auto',
  formatPattern: 'STYLE_COLOR_SIZE',
  styleCode: 'STL-101',
  color: 'RED',
  size: 'XL',
});
console.log('Test 2 [AUTO Mode - Style+Color+Size]:', skuAuto1);
assert.strictEqual(skuAuto1, 'STL-101-RED-XL');

// 3. Test AUTO Mode (Style + Size + Color)
const skuAuto2 = generateSkuCode({
  mode: 'auto',
  formatPattern: 'STYLE_SIZE_COLOR',
  styleCode: 'STL-101',
  color: 'RED',
  size: 'XL',
});
console.log('Test 3 [AUTO Mode - Style+Size+Color]:', skuAuto2);
assert.strictEqual(skuAuto2, 'STL-101-XL-RED');

// 4. Test AUTO Mode (Category + Style + Color + Size)
const skuAuto3 = generateSkuCode({
  mode: 'auto',
  formatPattern: 'CAT_STYLE_COLOR_SIZE',
  styleCode: 'STL-101',
  color: 'BLUE',
  size: 'M',
  category: 'APPAREL',
});
console.log('Test 4 [AUTO Mode - Cat+Style+Color+Size]:', skuAuto3);
assert.strictEqual(skuAuto3, 'APPAREL-STL-101-BLUE-M');

// 5. Test AUTO Mode (Custom Formula Template)
const skuCustom = generateSkuCode({
  mode: 'auto',
  formatPattern: 'CUSTOM',
  customTemplate: '{brand}-{style}-{color}-{size}',
  styleCode: 'JKT-500',
  color: 'BLACK',
  size: 'L',
  brand: 'NIKE',
});
console.log('Test 5 [AUTO Mode - Custom Template]:', skuCustom);
assert.strictEqual(skuCustom, 'NIKE-JKT-500-BLACK-L');

// 6. Test HYBRID Mode (Custom Prefix + Auto Attributes)
const skuHybrid = generateSkuCode({
  mode: 'hybrid',
  hybridPrefix: 'PRE-888',
  color: 'GREEN',
  size: 'S',
});
console.log('Test 6 [HYBRID Mode - Prefix + Attributes]:', skuHybrid);
assert.strictEqual(skuHybrid, 'PRE-888-GREEN-S');

console.log('\n✅ ALL 6 SKU GENERATION TEST CASES PASSED PERFECTLY!');
