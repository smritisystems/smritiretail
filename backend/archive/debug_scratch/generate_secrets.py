#!/usr/bin/env python3
"""
SMRITI Retail OS - Secure Secrets Generator
Generates cryptographically secure random secrets for production deployment.

Usage:
    python generate_secrets.py
    python generate_secrets.py --format env
    python generate_secrets.py --output .env.production
"""

import os
import sys
import secrets
import argparse
from pathlib import Path
from datetime import datetime


def generate_secret(length: int = 32) -> str:
    """Generate a cryptographically secure random hex string."""
    return secrets.token_hex(length // 2)


def generate_secrets(count: int = 3) -> dict:
    """Generate all required secrets."""
    return {
        "JWT_SECRET_KEY": generate_secret(32),
        "INTERNAL_SERVICE_KEY": generate_secret(32),
        "SGIP_VAULT_MASTER_KEY": generate_secret(32),
    }


def format_env(secrets_dict: dict) -> str:
    """Format secrets as environment variables (.env format)."""
    lines = [
        "# Generated on: " + datetime.now().isoformat(),
        "# ⚠️  SECURITY: Keep this file secure and never commit to version control",
        "# Use this only for LOCAL DEVELOPMENT OR via secure secrets manager",
        "",
    ]
    for key, value in secrets_dict.items():
        lines.append(f"{key}={value}")
    return "\n".join(lines)


def format_export(secrets_dict: dict) -> str:
    """Format secrets as shell export commands."""
    lines = [
        "#!/usr/bin/env bash",
        "# Generated on: " + datetime.now().isoformat(),
        "# ⚠️  SECURITY: Keep this file secure and never commit to version control",
        "# Load secrets: source ./secrets.sh",
        "",
    ]
    for key, value in secrets_dict.items():
        lines.append(f"export {key}='{value}'")
    return "\n".join(lines)


def format_docker_secrets(secrets_dict: dict) -> str:
    """Format secrets as Docker compose secrets."""
    lines = [
        "# Add to docker-compose.yml under 'secrets:' section",
        "# docker secret create jwt_secret - < <(echo 'YOUR_VALUE')",
        "",
    ]
    for key, value in secrets_dict.items():
        secret_name = key.lower().replace("_", "_")
        lines.append(f"# {secret_name}:")
        lines.append(f"#   external: true")
    return "\n".join(lines)


def format_json(secrets_dict: dict) -> str:
    """Format secrets as JSON (for Vault/other tools)."""
    import json
    data = {
        "generated_at": datetime.now().isoformat(),
        "secrets": secrets_dict,
        "warning": "Keep this file secure. Never commit to version control.",
    }
    return json.dumps(data, indent=2)


def main():
    parser = argparse.ArgumentParser(
        description="Generate secure secrets for SMRITI Retail OS production deployment"
    )
    parser.add_argument(
        "--format",
        choices=["env", "export", "docker", "json"],
        default="env",
        help="Output format (default: env)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Output file (default: print to stdout)",
    )
    parser.add_argument(
        "--no-display",
        action="store_true",
        help="Don't display secrets to stdout (for security)",
    )

    args = parser.parse_args()

    # Generate secrets
    secrets_dict = generate_secrets()

    # Format output
    if args.format == "env":
        output = format_env(secrets_dict)
    elif args.format == "export":
        output = format_export(secrets_dict)
    elif args.format == "docker":
        output = format_docker_secrets(secrets_dict)
    elif args.format == "json":
        output = format_json(secrets_dict)

    # Write to file if specified
    if args.output:
        output_path = Path(args.output)
        output_path.write_text(output)
        
        # Set restrictive permissions for sensitive files
        if os.name != "nt":  # Unix-like systems
            os.chmod(output_path, 0o600)  # rw-------
        
        print(f"✓ Secrets written to: {output_path}")
        print(f"✓ File permissions: rw------- (600)")
        
        if not args.no_display:
            print(f"\n⚠️  PREVIEW (keep this secure):")
            print(output[:200] + "...\n")
        
        print(f"Next steps:")
        print(f"1. Review the file: cat {output_path}")
        print(f"2. Load in your environment:")
        if args.format == "export":
            print(f"   source {output_path}")
        else:
            print(f"   export $(cat {output_path} | grep -v '^#' | xargs)")
        print(f"3. Delete after loading (or store securely in vault)")
        print(f"4. Never commit this file to version control")
    else:
        # Print to stdout
        if not args.no_display:
            print(output)
        else:
            print("✓ Secrets generated (not displayed for security)")


if __name__ == "__main__":
    main()
