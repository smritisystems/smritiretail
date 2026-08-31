# SH9 Extraction Log v2.0

**Date:** 2026-08-24T21:36:46.330432
**Source:** `D:\Shoper9\Backup\A_CSW_250814_1846_C\Shoper9\ini`

## Summary

| Metric | Value |
|---|---|
| S9Q files (disk) | 185 |
| INSERT matches | 594 |
| Active entries | 265 |
| Deleted entries | 18 |
| Unique executables | 177 |
| TrnType codes | 63 |
| User records | 0 |
| Behavior sysParams | 58 |

## Log

```
[2026-08-24T21:36:44.593173] Sprint 0 v2 -- Full Extraction
Disk S9Q files : 185
ZIP entries    : 189

INSERT matches: 594 | Unique keys: 283
ExeName UPDATE patches: 8
DELETE operations found: 52 | Unique keys to remove: 26
Active rows after DELETE removal : 265
Deleted/stale rows               : 18
Wrote: F:\SMRITRretailNX\docs\legacy\shoper\SH9_MENU_CATALOG.csv (265 active rows)
Wrote: F:\SMRITRretailNX\docs\legacy\shoper\SH9_MENU_DELETES.csv (52 delete operations)
Wrote: F:\SMRITRretailNX\docs\legacy\shoper\SH9_MENU_TREE.csv (265 rows)
Wrote: F:\SMRITRretailNX\docs\legacy\shoper\SH9_TXN_TYPES.csv (63 TrnType codes)
Wrote: F:\SMRITRretailNX\docs\legacy\shoper\SH9_USERS.csv (0 user records)
Wrote: F:\SMRITRretailNX\docs\legacy\shoper\SH9_SYSPARAM.csv (58 behavior-related sysParams)
Wrote: F:\SMRITRretailNX\docs\legacy\shoper\SH9_MENU_EXEC.csv (177 executables, active entries only)
```
