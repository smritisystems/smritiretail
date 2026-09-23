"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.1
Created      : 2026-09-23
Modified     : 2026-09-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal — Package Init
"""

import os
import sys

# Extend __path__ to include the installed site-packages alembic package
# so that both local modules (migration_contract) and library modules (config, command) resolve.
for _p in sys.path:
    _cand = os.path.join(_p, "alembic")
    if os.path.isdir(_cand) and os.path.abspath(_cand) != os.path.dirname(os.path.abspath(__file__)):
        if os.path.exists(os.path.join(_cand, "config.py")):
            if _cand not in __path__:
                __path__.append(_cand)
            break

try:
    from . import context, op  # type: ignore
except (ImportError, AttributeError):
    pass

__version__ = "1.13.1"
