"""
Final precise fix: replace only JSX tag names (not import paths).
Replaces <WrongTag and </WrongTag patterns.
"""
import re
from pathlib import Path

repo_root = Path(".").resolve()

# Map of (file_key, wrong_jsx_tag, correct_jsx_tag)
# These are ONLY JSX tag replacements - no import path changes
JSX_ONLY_FIXES = [
    # BillingTerm.tsx
    ("src/components/billing/BillingTerm.tsx", "ItemTypeaheadDrop", "SmritiItemTypeaheadDropdown"),
    ("src/components/billing/BillingTerm.tsx", "InvoiceSettlementD", "SmritiInvoiceSettlementModal"),
    ("src/components/billing/BillingTerm.tsx", "ProductSearchBrows", "ProductSearchBrowserModal"),
    # CustMasterWs.tsx - searchTerm issue - just remove searchTerm prop
    # (handled separately below)
]

# Files that need searchTerm prop removed from ExportButton
REMOVE_SEARCH_TERM_PROP = [
    "src/components/customer/CustMasterWs.tsx",
]


def fix_jsx_tag(content: str, wrong: str, correct: str) -> tuple[str, int]:
    """Replace JSX opening and closing tags only."""
    count = 0
    # Opening tag: <WrongName (followed by space, /, or >)
    open_pattern = rf'<{re.escape(wrong)}(?=[\s/>])'
    new_content = re.sub(open_pattern, f'<{correct}', content)
    if new_content != content:
        count += len(re.findall(open_pattern, content))
        content = new_content

    # Closing tag: </WrongName>
    close_pattern = rf'</{re.escape(wrong)}>'
    new_content = re.sub(close_pattern, f'</{correct}>', content)
    if new_content != content:
        count += len(re.findall(close_pattern, content))
        content = new_content

    return content, count


def process_file(path: Path) -> bool:
    try:
        content = path.read_text(encoding="utf-8")
    except Exception as e:
        print(f"  ERROR reading {path}: {e}")
        return False

    original = content
    try:
        rel = path.relative_to(repo_root)
        file_key = str(rel).replace("\\", "/")
    except ValueError:
        file_key = str(path).replace("\\", "/")

    changes = []

    # 1. JSX tag fixes
    for fkey, wrong, correct in JSX_ONLY_FIXES:
        if fkey == file_key:
            content, n = fix_jsx_tag(content, wrong, correct)
            if n > 0:
                changes.append(f"  jsx tag: {wrong} -> {correct} ({n} times)")

    # 2. Remove searchTerm prop from ExportButton
    if file_key in REMOVE_SEARCH_TERM_PROP:
        # Remove the line: searchTerm={searchTerm}
        new_content = re.sub(r'\s+searchTerm=\{searchTerm\}', '', content)
        if new_content != content:
            content = new_content
            changes.append("  removed: searchTerm={searchTerm} prop")

    if content != original:
        path.write_text(content, encoding="utf-8")
        print(f"FIXED: {path}")
        for c in changes:
            print(c)
        return True
    return False


fixed_count = 0
for path in sorted(list(repo_root.glob("src/**/*.tsx")) + list(repo_root.glob("src/**/*.ts"))):
    if process_file(path):
        fixed_count += 1

print(f"\nTotal files fixed: {fixed_count}")
