import json
import re
import subprocess
import sys
from pathlib import Path


def normalize_path(path: str) -> str:
    parts = path.replace("\\", "/").removeprefix("./").split("/")
    for index in range(len(parts) - 1):
        if parts[index] == "backend" and parts[index + 1] == "app":
            return "/".join(parts[index + 1 :])
    return "/".join(parts)


def added_line_ranges(base_sha: str, head_sha: str) -> dict[str, list[tuple[int, int]]]:
    repo_root = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    diff = subprocess.run(
        [
            "git",
            "-C",
            repo_root,
            "diff",
            "--unified=0",
            base_sha,
            head_sha,
            "--",
            "backend/app",
        ],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    ranges: dict[str, list[tuple[int, int]]] = {}
    current_path = None
    hunk_pattern = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")

    for line in diff.splitlines():
        if line.startswith("+++ b/"):
            current_path = normalize_path(line[6:])
        elif line.startswith("@@") and current_path:
            match = hunk_pattern.match(line)
            if match:
                start = int(match.group(1))
                count = int(match.group(2) or 1)
                if count:
                    ranges.setdefault(current_path, []).append((start, start + count - 1))

    return ranges


def diagnostics(tool: str, report_path: Path) -> list[tuple[str, int, str]]:
    report = json.loads(report_path.read_text(encoding="utf-8"))
    if tool == "ruff":
        return [
            (
                normalize_path(item["filename"]),
                item["location"]["row"],
                f'{item.get("code", "Ruff")}: {item["message"]}',
            )
            for item in report
        ]
    if tool == "bandit":
        return [
            (
                normalize_path(item["filename"]),
                item["line_number"],
                f'{item["test_id"]}: {item["issue_text"]}',
            )
            for item in report.get("results", [])
        ]
    raise ValueError(f"Unsupported scanner: {tool}")


def main() -> int:
    if len(sys.argv) != 5:
        raise SystemExit("Usage: check_changed_python_lines.py BASE_SHA HEAD_SHA TOOL REPORT_JSON")
    base_sha, head_sha, tool, report_path = sys.argv[1:]
    changed = added_line_ranges(base_sha, head_sha)
    findings = [
        (path, line, message)
        for path, line, message in diagnostics(tool, Path(report_path))
        if any(start <= line <= end for start, end in changed.get(path, []))
    ]

    if findings:
        for path, line, message in findings:
            print(f"{path}:{line}: {message}")
        return 1

    print(f"No {tool} findings on added backend application lines.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
