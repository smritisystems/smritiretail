# Business Document Development Standard (BDDS) v1.0

**Status:** FROZEN  
**Version:** 1.0  
**Change Policy:** ADR only

## Purpose
Provide the canonical structure for business-document implementation packages in RC2.

## Frozen Standard
Every business document package must include:
- Requirements
- Design
- Database design
- API design
- Implementation notes
- Test cases
- UAT checklist
- Changelog
- Decisions
- Known issues
- Checklist

## Required Folder Shape
```text
<document-id>/
├── README.md
├── <document-id>_REQUIREMENTS.md
├── <document-id>_DESIGN.md
├── <document-id>_DB.md
├── <document-id>_API.md
├── <document-id>_IMPLEMENTATION.md
├── <document-id>_TEST_CASES.md
├── <document-id>_UAT.md
├── <document-id>_CHANGELOG.md
├── <document-id>_DECISIONS.md
├── <document-id>_KNOWN_ISSUES.md
└── <document-id>_CHECKLIST.md
```

## Delivery Rule
Implementation work must now produce executable business functionality. Documentation is secondary and exists to support the implementation of a specific business document.
