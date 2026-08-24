"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.26.0
Created      : 2026-08-18
Modified     : 2026-08-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from typing import Optional


class InvoiceRenderError(Exception):
    """Fail-closed tax invoice render error. Codes are business identifiers, not stack traces."""

    def __init__(
        self,
        code: str,
        title: str,
        explanation: str,
        suggested_action: str,
    ) -> None:
        self.code = code
        self.title = title
        self.explanation = explanation
        self.suggested_action = suggested_action
        super().__init__(f"{code}: {title}")


def missing(code: str, field_label: str) -> InvoiceRenderError:
    return InvoiceRenderError(
        code=code,
        title="Tax invoice cannot be prepared",
        explanation=(
            f"Required business information is missing: {field_label}. "
            "The document was not generated so that incorrect values are not printed."
        ),
        suggested_action=(
            f"Enter the missing {field_label} on the invoice, customer, or company record, then try again."
        ),
    )


def require(value: Optional[object], code: str, field_label: str) -> object:
    if value is None:
        raise missing(code, field_label)
    if isinstance(value, str) and not value.strip():
        raise missing(code, field_label)
    return value
