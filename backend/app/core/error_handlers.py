"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-11
Modified     : 2026-07-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import datetime
import traceback
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.errors import SmritiErrorResponse, build_error_response

# Setup templates path using absolute resolution relative to app
templates_dir = Path(__file__).resolve().parent.parent / "templates"
templates = Jinja2Templates(directory=str(templates_dir))


def build_enhanced_json(status_code: int, response_model: SmritiErrorResponse) -> dict:
    """Helper to build enhanced, backward-compatible SMRITI HREP JSON object."""
    content = response_model.model_dump()
    content.update(
        {
            "success": False,
            "status": status_code,
            "title": response_model.error.title,
            "message": response_model.error.explanation,
            "suggested_action": response_model.error.suggested_action,
            "error_code": response_model.error.error_code,
            "reference_id": response_model.error.reference_id,
            "timestamp": datetime.datetime.now(datetime.UTC).isoformat() + "Z",
            "documentation": "/docs",
        }
    )
    return content


def dispatch_response(
    request: Request,
    exc: Exception | None,
    status_code: int,
    response_model: SmritiErrorResponse,
):
    """Dynamically route the exception to HTML page or JSON object based on content negotiation."""
    accept = request.headers.get("accept", "")
    if "text/html" in accept:
        stack_trace = ""
        if settings.ENVIRONMENT == "development" and exc:
            stack_trace = "".join(
                traceback.format_exception(type(exc), exc, exc.__traceback__)
            )

        request_id = getattr(request.state, "request_id", None)
        timestamp = datetime.datetime.now(datetime.UTC).strftime(
            "%Y-%m-%d %H:%M:%S UTC"
        )

        return templates.TemplateResponse(
            request=request,
            name="errors/error.html",
            context={
                "status_code": status_code,
                "title": response_model.error.title,
                "explanation": response_model.error.explanation,
                "suggested_action": response_model.error.suggested_action,
                "reference_id": response_model.error.reference_id,
                "error_code": response_model.error.error_code,
                "env": settings.ENVIRONMENT,
                "request_id": request_id,
                "timestamp": timestamp,
                "exception_type": type(exc).__name__ if exc else "N/A",
                "stack_trace": stack_trace,
            },
            status_code=status_code,
        )

    return JSONResponse(
        status_code=status_code,
        content=build_enhanced_json(status_code, response_model),
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        loc = " -> ".join(str(loc_val) for loc_val in err.get("loc", []))
        msg = err.get("msg", "Invalid value")
        errors.append(f"{loc}: {msg}")

    explanation = "The input data provided was invalid. Details: " + "; ".join(errors)
    res = build_error_response(
        error_code="SMRITI-VAL-001",
        custom_explanation=explanation,
        reference_msg=str(exc),
    )
    return dispatch_response(request, exc, 422, res)


async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    # Map HTTP status codes to standard SMRITI families
    if exc.status_code == 400:
        code = "SMRITI-VAL-001"
        title = "Bad Request"
    elif exc.status_code == 401:
        code = "SMRITI-AUTH-001"
        title = "Authentication Required"
    elif exc.status_code == 403:
        code = "SMRITI-PERM-001"
        title = "Access Denied"
    elif exc.status_code == 404:
        code = "SMRITI-VAL-001"
        title = "Page Not Found"
    elif exc.status_code == 405:
        code = "SMRITI-VAL-001"
        title = "Method Not Allowed"
    elif exc.status_code == 409:
        code = "SMRITI-DATA-001"
        title = "Data Conflict"
    elif exc.status_code == 429:
        code = "SMRITI-NET-001"
        title = "Too Many Requests"
    elif exc.status_code == 503:
        code = "SMRITI-NET-001"
        title = "Service Temporarily Unavailable"
    else:
        code = "SMRITI-SYS-001"
        title = None  # Use dictionary default

    explanation = exc.detail
    suggested_action = None
    if isinstance(exc.detail, dict):
        explanation = exc.detail.get("explanation") or exc.detail.get("detail")
        suggested_action = exc.detail.get("suggested_action")
        if exc.detail.get("title"):
            title = exc.detail.get("title")

    res = build_error_response(
        error_code=code,
        custom_explanation=explanation,
        custom_action=suggested_action,
        reference_msg=str(exc.detail),
        custom_title=title,
    )
    return dispatch_response(request, exc, exc.status_code, res)


async def db_exception_handler(request: Request, exc: SQLAlchemyError):
    import logging

    logger = logging.getLogger("smriti-core")
    logger.exception("--- SQLAlchemyException occurred ---", exc_info=exc)
    res = build_error_response(
        error_code="SMRITI-DATA-001",
        custom_explanation="A database operations conflict occurred or referential integrity check failed.",
        reference_msg=str(exc),
    )
    return dispatch_response(request, exc, 400, res)


async def generic_exception_handler(request: Request, exc: Exception):
    res = build_error_response(
        error_code="SMRITI-SYS-001",
        custom_explanation="An internal server error occurred while processing the request.",
        reference_msg=str(exc),
    )
    return dispatch_response(request, exc, 500, res)


def register_error_handlers(app: FastAPI):
    """Registers standard SMRITI HREP error handlers on the FastAPI application."""
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(SQLAlchemyError, db_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)
