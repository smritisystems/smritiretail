#!/usr/bin/env python3
"""Fail when a migration already present in the target branch is edited or removed."""

import subprocess
import sys


MIGRATION_PATH = "backend/alembic/versions"


def existing_migration_changes(name_status_output: str) -> list[str]:
    violations = []
    for line in name_status_output.splitlines():
        fields = line.split("\t")
        status = fields[0]
        paths = fields[1:]
        if status != "A":
            violations.extend(path for path in paths if path.endswith(".py"))
    return violations


def main() -> int:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: check_immutable_migrations.py BASE_SHA HEAD_SHA")

    base_sha, head_sha = sys.argv[1:]
    result = subprocess.run(
        [
            "git",
            "diff",
            "--name-status",
            "--find-renames",
            base_sha,
            head_sha,
            "--",
            MIGRATION_PATH,
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    violations = existing_migration_changes(result.stdout)
    if violations:
        print("Existing Alembic revisions are immutable; add a forward-only revision instead:")
        for path in sorted(set(violations)):
            print(f"  {path}")
        return 1

    print("No existing Alembic revisions were modified or removed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
