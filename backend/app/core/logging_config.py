"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.9.0
Created      : 2026-07-20
Modified     : 2026-07-20
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import json
import logging
import time


class ErrorCategoryTaxonomy:
    VALIDATION = "VALIDATION"
    AUTHENTICATION = "AUTHENTICATION"
    AUTHORIZATION = "AUTHORIZATION"
    DATABASE = "DATABASE"
    NETWORK = "NETWORK"
    BUSINESS_RULE = "BUSINESS_RULE"
    SYSTEM = "SYSTEM"


class StructuredJSONFormatter(logging.Formatter):
    """
    Custom JSON formatter emitting structured log objects with W3C trace IDs
    and Error Taxonomy classification for ELK / Datadog ingestion.
    """
    def format(self, record: logging.LogRecord) -> str:
        log_obj = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(record.created)),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "line": record.lineno,
        }

        if hasattr(record, "request_id"):
            log_obj["request_id"] = record.request_id
        if hasattr(record, "trace_id"):
            log_obj["trace_id"] = record.trace_id
        if hasattr(record, "span_id"):
            log_obj["span_id"] = record.span_id

        # Standardized Error Taxonomy Tagging
        if record.levelno >= logging.ERROR:
            log_obj["error_category"] = getattr(record, "error_category", ErrorCategoryTaxonomy.SYSTEM)

        return json.dumps(log_obj)
