"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.11.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import uuid
import time
import random
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("smriti.request_context")


class RequestContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware injecting X-Request-ID, W3C traceparent (Trace-ID & Span-ID) distributed tracing headers,
    probabilistic trace sampling, and logging execution latency.
    """
    # Default trace sample rate: 1.0 (100% trace sampling). In production: 0.1 (10% sampling)
    TRACE_SAMPLE_RATE: float = 1.0

    async def dispatch(self, request: Request, call_next) -> Response:
        # 1. Single-node correlation request ID
        request_id = request.headers.get("X-Request-ID") or f"req_{uuid.uuid4().hex[:12]}"
        request.state.request_id = request_id

        # 2. W3C Distributed Tracing Context (traceparent: 00-{trace_id}-{span_id}-01)
        traceparent = request.headers.get("traceparent") or request.headers.get("X-Trace-ID")
        if traceparent and traceparent.startswith("00-") and len(traceparent.split("-")) >= 4:
            parts = traceparent.split("-")
            trace_id = parts[1]
            parent_span_id = parts[2]
        else:
            trace_id = traceparent or uuid.uuid4().hex
            parent_span_id = None

        span_id = uuid.uuid4().hex[:16]

        request.state.trace_id = trace_id
        request.state.span_id = span_id
        request.state.parent_span_id = parent_span_id

        # Probabilistic Tracing Decider
        sampled = random.random() < self.TRACE_SAMPLE_RATE

        from ..db.session import active_tenant_ctx, active_security_context
        start_time = time.time()
        try:
            response = await call_next(request)
        finally:
            active_tenant_ctx.set(None)
            active_security_context.set(None)
        duration_ms = round((time.time() - start_time) * 1000, 2)

        # 100% error sample policy: Force tracing on HTTP errors (>= 500)
        if response.status_code >= 500:
            sampled = True

        response.headers["X-Request-ID"] = request_id
        response.headers["X-Trace-ID"] = trace_id
        response.headers["X-Span-ID"] = span_id
        response.headers["X-Response-Time-Ms"] = str(duration_ms)

        # Sampled flag inside traceparent: '01' if sampled, '00' if not sampled
        traceparent_flag = "01" if sampled else "00"
        response.headers["traceparent"] = f"00-{trace_id}-{span_id}-{traceparent_flag}"

        if sampled:
            logger.info(
                f"Method={request.method} Path={request.url.path} Status={response.status_code} "
                f"Duration={duration_ms}ms RequestID={request_id} TraceID={trace_id} SpanID={span_id} Sampled=True"
            )
        return response
