import re
from collections import OrderedDict
from io import BytesIO

try:
    from pypdf import PdfReader
except Exception:  # pragma: no cover - optional in environments without pdf dependency
    PdfReader = None


CODE_TOKEN_CANDIDATE_RE = re.compile(
    r"(?:vendor\s*article|vendor\s*style|article\s*no|article\s*code|style\s*/\s*article|style\s*article|article|style\s*code)\s*[:#-]?\s*([A-Z0-9][A-Z0-9][A-Z0-9\-_/\.]{2,50})",
    re.IGNORECASE,
)


def _clean_code(code: str) -> str:
    code = code.strip().replace("\u2013", "-").replace("\u2014", "-")
    code = re.sub(r"\s+", "", code)
    # Keep a vendor style/article code canonical by removing punctuation noise but keeping valid style article chars.
    code = code.strip("()[]{}<>:;,.\n\r")
    return code.upper()


def extract_vendor_article_codes_from_po_text(text: str) -> list[str]:
    """
    Extract vendor article/style tokens from a PO PDF text blob.

    The parser intentionally favors explicit style/article labels such as
    "Vendor Article", "Article No", "Style / Article", and similar labels,
    then falls back to generic alphanumeric tokens shaped like style/article codes.
    """
    if not text or not isinstance(text, str):
        return []

    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = [line.strip() for line in text.split("\n") if line.strip()]

    found: OrderedDict[str, None] = OrderedDict()

    # Strong label-based lookup.
    for line in lines:
        match = re.search(
            r"(?:vendor\s*article|vendor\s*style|article\s*no|article\s*code|style\s*/\s*article|style\s*article)\s*[:#-]?\s*([A-Z0-9][A-Z0-9\-_/\.]{2,50})",
            line,
            flags=re.IGNORECASE,
        )
        if match:
            code = _clean_code(match.group(1))
            if re.fullmatch(r"[A-Z0-9][A-Z0-9\-_/\.]{2,50}", code):
                found.setdefault(code, None)

    # Generic token pass for repeatable values that look like codes.
    if not found:
        generic = re.findall(
            r"\b[A-Z]{2,10}[-_/]?[A-Z0-9]{2,12}[-_/]?[A-Z0-9]{1,12}\b",
            text.upper(),
        )
        for token in generic:
            token = _clean_code(token)
            if len(token) >= 5 and re.fullmatch(r"[A-Z0-9][A-Z0-9\-_/\.]{2,50}", token):
                found.setdefault(token, None)

    return list(found.keys())


def extract_vendor_article_codes_from_po_pdf(pdf_path: str) -> list[str]:
    """Convenience wrapper for parsing a PO PDF file path and returning style/article codes."""
    if PdfReader is None:
        raise RuntimeError("pypdf is required to read PO PDFs")

    reader = PdfReader(pdf_path)
    all_pages = []
    for page in reader.pages:
        page_text = page.extract_text() or ""
        all_pages.append(page_text)

    text = "\n".join(all_pages)
    return extract_vendor_article_codes_from_po_text(text)


def extract_vendor_article_codes_from_po_pdf_bytes(file_bytes: bytes) -> list[str]:
    """Parse extracted text from bytes of a PO PDF and return vendor article/style codes."""
    if PdfReader is None:
        raise RuntimeError("pypdf is required to read PO PDFs")

    reader = PdfReader(BytesIO(file_bytes))
    all_pages = []
    for page in reader.pages:
        page_text = page.extract_text() or ""
        all_pages.append(page_text)

    text = "\n".join(all_pages)
    return extract_vendor_article_codes_from_po_text(text)
