import re
from typing import Iterable


_VENDOR_CODE_PATTERN = re.compile(r"^V-[0-9A-Z]{3}$")
_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def _candidate_sequence() -> Iterable[str]:
    for letter in _LETTERS:
        yield f"V-00{letter}"
    for digit in "0123456789":
        for letter in _LETTERS:
            yield f"V-{digit}{letter}{letter}"
    for letter in _LETTERS:
        yield f"V-{letter}{letter}{letter}"


def allocate_next_vendor_code(used_codes: Iterable[str]) -> str:
    """Allocate the next unused five-character vendor code, beginning with V-00A."""
    used = {
        str(code).strip().upper()
        for code in used_codes
        if _VENDOR_CODE_PATTERN.fullmatch(str(code).strip().upper())
    }

    for candidate in _candidate_sequence():
        if candidate not in used:
            return candidate

    raise ValueError("All five-character vendor codes in the V- namespace are already used.")
