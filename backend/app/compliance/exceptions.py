"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

class ComplianceException(Exception):  # noqa: N818
    """Base exception for all SMRITI compliance operations."""
    pass

class ConnectorLoadException(ComplianceException):
    """Raised when a connector fails to load or initialize."""
    pass

class VaultException(ComplianceException):
    """Raised when cryptographic vault operations fail."""
    pass

class ManifestValidationException(ComplianceException):
    """Raised when a connector's manifest fails validation checks."""
    pass

class RepositoryException(ComplianceException):
    """Raised when a database repository operation fails."""
    pass

class PolicyViolationException(ComplianceException):
    """Raised when compliance logic violates business or governmental rules."""
    pass

class ConfigurationException(ComplianceException):
    """Raised when system settings or environment configurations are missing/invalid."""
    pass
