"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-12
Modified     : 2026-07-12
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from app.compliance.exceptions import PolicyViolationException
from app.compliance.services.registry_service import RegistryService


class PolicyService:
    """
    Validates business and compliance policy rules before letting operations proceed.
    """
    def __init__(self, registry_service: RegistryService | None = None) -> None:
        self.registry_service = registry_service or RegistryService()

    def validate_submission(self, service_id: str, action: str, environment: str = "sandbox") -> None:
        """
        Validates whether a service is registered, enables the specific action capability,
        and allows submissions in the target run mode/environment.
        """
        manifest = self.registry_service.get_manifest(service_id)
        if not manifest:
            raise PolicyViolationException(f"SGIP-POL-001: Compliance service '{service_id}' is not registered.")

        # Verify capability
        capabilities = manifest.get("capabilities", [])
        if action not in capabilities:
            raise PolicyViolationException(
                f"SGIP-POL-002: Service '{service_id}' does not support capability/action '{action}'."
            )

        # Verify environment settings
        envs = manifest.get("environments", {})
        if environment not in envs:
            raise PolicyViolationException(
                f"SGIP-POL-003: Service '{service_id}' does not support run environment '{environment}'."
            )

        env_config = envs[environment]
        if not env_config.get("enabled", False):
            raise PolicyViolationException(
                f"SGIP-POL-004: Service '{service_id}' environment '{environment}' is currently disabled."
            )
