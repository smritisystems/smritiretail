"""
Script to refresh the end-user guide index section in docs/user_guide/USER_GUIDE.md.

The script scans all Markdown files in docs/user_guide/ except USER_GUIDE.md
and generates a reference list under the marker section.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
USER_GUIDE = ROOT / "docs" / "user_guide" / "USER_GUIDE.md"
GUIDE_DIR = ROOT / "docs" / "user_guide"
START_MARKER = "<!-- USER GUIDE INDEX START -->"
END_MARKER = "<!-- USER GUIDE INDEX END -->"

if not USER_GUIDE.exists():
    raise SystemExit(f"USER_GUIDE.md not found at {USER_GUIDE}")

md_files = sorted(
    p for p in GUIDE_DIR.glob("*.md")
    if p.name != "USER_GUIDE.md"
)

entries = []
for md_file in md_files:
    title = None
    with md_file.open("r", encoding="utf-8") as fh:
        for line in fh:
            if line.strip().startswith("# "):
                title = line.strip().lstrip("# ").strip()
                break
    if not title:
        title = md_file.stem.replace("_", " ").title()
    rel_path = md_file.relative_to(ROOT).as_posix()
    entries.append(f"- [{title}]({rel_path})")

index_section = [
    START_MARKER,
    "## Related User Guide Documents",
    "",
    "This section is auto-generated from `docs/user_guide/*.md`. Run this script after adding or removing files.",
    "",
    *entries,
    "",
    END_MARKER,
]

content = USER_GUIDE.read_text(encoding="utf-8")
if START_MARKER in content and END_MARKER in content:
    before, rest = content.split(START_MARKER, 1)
    _, after = rest.split(END_MARKER, 1)
    new_content = before + "\n" + "\n".join(index_section) + after
else:
    new_content = content.rstrip() + "\n\n" + "\n".join(index_section) + "\n"

USER_GUIDE.write_text(new_content, encoding="utf-8")
print(f"USER_GUIDE index refreshed with {len(entries)} document(s).")
