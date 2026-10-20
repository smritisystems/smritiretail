#  Project      : SMRITI Retail OS
#  Author       : Jawahar Ramkripal Mallah
#  Designation  : Chief Systems Architect & Creator
#  Email        : support@smritibooks.com
#  Websites     : smritibooks.com | erpnbook.com | aitdl.com
#  Version      : 6.99.0
#  Created      : 2026-10-17
#  Modified     : 2026-10-17
#  Copyright    : © SMRITIBooks.com. All Rights Reserved.
#  License      : Proprietary Commercial Software
#  Classification: Unified SMRITI CLI Main Dispatcher

import argparse
import sys
from typing import List, Optional

from app.cli import __version__
from app.cli.commands import (
    attendance_cmd,
    db_cmd,
    fleet_cmd,
    governance_cmd,
    health_cmd,
    stock_cmd,
    version_cmd,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="smriti",
        description="SMRITI Retail OS — Unified Operational CLI Engine (v" + __version__ + ")",
        epilog="Use 'smriti <subcommand> --help' for command-specific options."
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"SMRITI Retail OS CLI v{__version__}"
    )

    subparsers = parser.add_subparsers(
        title="Operational Subcommands",
        dest="subcommand",
        help="Target subsystem to execute"
    )

    version_cmd.register_subparser(subparsers)
    health_cmd.register_subparser(subparsers)
    fleet_cmd.register_subparser(subparsers)
    db_cmd.register_subparser(subparsers)
    governance_cmd.register_subparser(subparsers)
    attendance_cmd.register_subparser(subparsers)
    stock_cmd.register_subparser(subparsers)

    return parser


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_parser()
    if argv is None:
        argv = sys.argv[1:]

    if not argv:
        parser.print_help()
        return 0

    args = parser.parse_args(argv)
    if hasattr(args, "func"):
        return args.func(args)

    parser.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
