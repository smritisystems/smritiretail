"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smriti.com
Version      : 3.25.0
Created      : 2026-07-15
Modified     : 2026-07-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ...api.deps import require_permission

router = APIRouter()

DOCS_ROOT = Path(__file__).resolve().parents[4] / "docs"


class WikiDoc(BaseModel):
    path: str
    name: str
    folder: str
    title: str
    snippet: str | None = None


class DocsAskRequest(BaseModel):
    question: str


def crawl_docs_directory(dir_path: Path) -> list[WikiDoc]:
    docs: list[WikiDoc] = []
    if not dir_path.exists() or not dir_path.is_dir():
        return docs

    for entry in dir_path.rglob("*.md"):
        if entry.is_file():
            rel_path = entry.relative_to(dir_path).as_posix()
            folder = entry.parent.relative_to(dir_path).as_posix() or "Root"
            if folder == ".":
                folder = "Root"
            name = entry.name
            title = name
            try:
                content = entry.read_text(encoding="utf-8")
                for line in content.splitlines():
                    if line.strip().startswith("# "):
                        title = line.strip()[2:].strip()
                        break
                    if line.strip().startswith("title:"):
                        title = line.split("title:", 1)[1].strip().strip("'\"")
                        break
            except Exception:
                pass

            docs.append(WikiDoc(path=rel_path, name=name, folder=folder, title=title))

    return sorted(docs, key=lambda item: item.title.lower())


@router.get(
    "/list",
    response_model=list[WikiDoc],
    dependencies=[Depends(require_permission("REPORT.VIEW"))],
)
async def list_wiki_docs():
    """List available SMRITI documentation files."""
    return crawl_docs_directory(DOCS_ROOT)


@router.get(
    "/content",
    response_model=WikiDoc,
    dependencies=[Depends(require_permission("REPORT.VIEW"))],
)
async def get_wiki_doc_content(path: str = Query(..., description="Relative path to the Markdown document.")):
    """Return the content of a specific documentation page."""
    if not path:
        raise HTTPException(status_code=400, detail="Missing 'path' query parameter.")

    safe_path = Path(path).resolve()
    full_path = (DOCS_ROOT / path).resolve()
    if not full_path.exists() or not str(full_path).startswith(str(DOCS_ROOT)):
        raise HTTPException(status_code=404, detail="SMRITI Gyan Kendra document not found or access denied.")

    try:
        content = full_path.read_text(encoding="utf-8")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return WikiDoc(
        path=path,
        name=full_path.name,
        folder=full_path.parent.relative_to(DOCS_ROOT).as_posix() or "Root",
        title=full_path.name,
        snippet=content,
    )


@router.get(
    "/search",
    response_model=list[WikiDoc],
    dependencies=[Depends(require_permission("REPORT.VIEW"))],
)
async def search_wiki_docs(q: str = Query(..., min_length=1, description="Search query string.")):
    """Search markdown documentation text and return matching pages."""
    query = q.strip().lower()
    if not query:
        return []

    results: list[WikiDoc] = []
    for doc in crawl_docs_directory(DOCS_ROOT):
        file_path = DOCS_ROOT / doc.path
        try:
            content = file_path.read_text(encoding="utf-8").lower()
        except Exception:
            continue

        if query in content or query in doc.title.lower() or query in doc.name.lower():
            idx = content.find(query)
            snippet = ""
            if idx >= 0:
                start = max(0, idx - 80)
                end = min(len(content), idx + len(query) + 120)
                snippet = "..." + content[start:end].replace("\n", " ") + "..."
            results.append(WikiDoc(path=doc.path, name=doc.name, folder=doc.folder, title=doc.title, snippet=snippet or None))

    return results[:20]


@router.post(
    "/ask",
    dependencies=[Depends(require_permission("REPORT.VIEW"))],
)
async def ask_wiki_copilot(payload: DocsAskRequest):
    """Answer a knowledge query against local SMRITI documentation."""
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Missing 'question' parameter in request body.")

    matches = search_wiki_docs(q=question)
    file_list = [f"* {doc.title} ({doc.path})" for doc in matches]
    sources = "\n".join(file_list) if file_list else "No matching documentation pages were found."

    return {
        "reply": (
            "SMRITI Offline Gyan Kendra Copilot is operating in local knowledge mode. "
            f"Your question was: '{question}'.\n\nRelevant pages:\n{sources}"
        ),
        "matchedFiles": [doc.dict() for doc in matches]
    }
