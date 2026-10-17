#  Project      : SMRITI Retail OS
#  Author       : Jawahar Ramkripal Mallah
#  Designation  : Chief Systems Architect & Creator
#  Email        : support@smritibooks.com
#  Websites     : smritibooks.com | erpnbook.com | aitdl.com
#  Version      : 6.99.0
#  Created      : 2026-10-17
#  Modified     : 2026-10-17
#  Copyright    : © SMRITIBooks.com. All Rights Reserved.
#  License      : Proprietary Commercial Software
#  Classification: Unified SMRITI CLI Engine Utilities

import json
import os
import sys
from pathlib import Path
from typing import Any, Callable, Dict, Optional


def find_repo_root() -> Path:
    """
    Deterministically find the repository root directory by walking up
    from this file until package.json or .agents directory is found.
    """
    curr = Path(__file__).resolve().parent
    for _ in range(6):
        if (curr / "package.json").exists() or (curr / ".agents").exists():
            return curr
        if curr.parent == curr:
            break
        curr = curr.parent
    # Fallback to current working directory
    return Path(os.getcwd()).resolve()


def confirm_action(prompt: str, force: bool = False) -> bool:
    """
    Interactive safety guard for potentially destructive or mutating operations.
    Returns True if force is True or user explicitly confirms with 'y' or 'yes'.
    """
    if force:
        return True

    # If stdin is not a TTY (e.g. CI pipeline or automated runner), require --yes
    if not sys.stdin.isatty():
        print(f"Safety Guard: Non-interactive environment detected. Refusing '{prompt}' without --yes.", file=sys.stderr)
        return False

    try:
        reply = input(f"{prompt} [y/N]: ").strip().lower()
        return reply in ("y", "yes")
    except (EOFError, KeyboardInterrupt):
        print("\nAction aborted by user.", file=sys.stderr)
        return False


def output_result(
    data: Any,
    as_json: bool = False,
    text_formatter: Optional[Callable[[Any], None]] = None,
) -> None:
    """
    Render output as structured JSON if requested, or delegate to human-readable formatter.
    """
    if as_json:
        print(json.dumps(data, indent=2, default=str))
    elif text_formatter:
        text_formatter(data)
    else:
        print(str(data))
