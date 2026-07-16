<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 2.1.1
  * Created    : 2026-07-10
  * Modified   : 2026-07-11
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# Contributing to SMRITI Retail OS

First of all, thank you for taking the time to contribute.

SMRITI Retail OS is an enterprise-grade retail operating system designed for the Indian retail ecosystem. Every contribution—whether code, documentation, testing, design, or feedback—helps improve the platform for thousands of businesses.

---

# Project Vision

Our mission is simple:

> Build the most intelligent, reliable, explainable and business-friendly Retail Operating System for India.

Every contribution should align with this vision.

---

# Ways You Can Contribute

You can contribute by:

- Bug Fixes
- New Features
- Documentation
- UI / UX Improvements
- Performance Optimization
- Security Improvements
- Test Cases
- Localization
- Accessibility
- Developer Experience
- Knowledge Base Articles

---

# Before Opening an Issue

Please check:

- Existing Issues
- Existing Pull Requests
- Documentation

Avoid duplicate reports whenever possible.

---

# Reporting Bugs

Please include:

- SMRITI Version
- Browser
- Operating System
- Steps to Reproduce
- Expected Behaviour
- Actual Behaviour
- Screenshots (if applicable)
- Logs (if available)

---

# Feature Requests

A good feature request should answer:

- What business problem does it solve?
- Who benefits?
- Expected workflow
- Expected business value

Business-first features are preferred over technology-first features.

---

# Development Workflow

## 1. Fork Repository

Fork the repository to your own GitHub account.

---

## 2. Create Branch

```bash
git checkout -b feature/your-feature
```

Examples

```
feature/customer-wallet
feature/loyalty-engine
fix/invoice-rounding
docs/setup-guide
```

---

## 3. Make Changes

Keep commits focused.

Avoid mixing multiple unrelated changes.

---

## 4. Test Everything

Before submitting:

- Existing tests pass
- New tests added where appropriate
- No lint errors
- No formatting issues

---

## 5. Commit

Use Conventional Commits.

Examples

```
feat(pos): add customer wallet support

fix(gst): correct GST rounding

docs(api): update billing endpoints

refactor(stock): simplify valuation logic

test(pos): add invoice cancellation tests
```

---

## 6. Push

```bash
git push origin feature/your-feature
```

---

## 7. Open Pull Request

Include:

- Summary
- Screenshots (if UI)
- Test Results
- Related Issues

---

# Coding Standards

Please follow the existing project architecture.

Code should be:

- Readable
- Maintainable
- Modular
- Well documented
- Production ready

Avoid unnecessary complexity.

---

# Architecture Principles

Contributors should preserve:

- Explainability First
- Business First Design
- Offline First Philosophy
- Backward Compatibility
- Modular Architecture
- Performance
- Security
- Stability

## SMRITI Core Framework — Platform Adapter Rule

**Every contribution must follow the platform adapter boundary.**

### Python — where to put platform calls

| Layer | Allowed | Forbidden |
|---|---|---|
| Business service / studio / API | `from smriti_retail_os import smriti` | `import frappe` for ORM calls |
| `core/platform/` only | `frappe.get_doc(...)`, `frappe.db.*`, etc. | — (this is the only permitted location) |
| Repository layer | Delegates to `smriti.core.platform` | Direct `frappe.*` for new code |

**Correct pattern in a business service:**
```python
from smriti_retail_os import smriti

# Good — routes through Framework API
customer = smriti.documents.get("Customer", name)
smriti.cache.set("smriti_pos_profiles", data, ttl=600)
smriti.errors.raise_validation("Supplier Required", "Please select a supplier.")
```

**Forbidden in a business service:**
```python
import frappe
doc = frappe.get_doc("Customer", name)   # VIOLATION — Guard 6 will flag this
```

### Adding a new SMRITI model

To map a new business model to a platform DocType, add one entry to `core/platform/document_map.yaml`:
```yaml
MyModel:
  platform: "My DocType Name"
  description: "Brief description"
```
No Python changes required.

### JavaScript — all www/ pages

```javascript
// Correct
smriti.api.call("smriti_retail_os.my_api.method", { arg })
  .then(data => smriti.notify.success("Done", "Action completed."))
  .catch(err => smriti.notify.error("Failed", err.message));

smriti.navigation.go(smriti.navigation.routes.customers);

// Forbidden
frappe.call({ method: "...", ... });   // VIOLATION
frappe.show_alert(...);               // VIOLATION
frappe.set_route(...);               // VIOLATION
```

Reference: `ARCHITECTURE.md §15`, `docs/implementation/foundation/SMRITI_Core_Framework_v1.0.md`

---

# Documentation Standards

Every new feature should include:

- User Documentation
- Technical Documentation
- Configuration Notes
- Upgrade Notes (if required)

Documentation is considered part of the feature.

---

# Testing Standards

All contributions should aim to include:

- Unit Tests
- Integration Tests
- Regression Tests (where applicable)

Never intentionally reduce test coverage.

---

# Security

Please do NOT disclose security vulnerabilities publicly.

Instead:

- Open a private security report.
- Provide reproduction steps.
- Allow maintainers time to investigate.

---

# Pull Request Checklist

Before submitting, verify:

- Code builds successfully
- Tests pass
- Documentation updated
- Screenshots included (UI changes)
- No sensitive data committed
- No unnecessary files included

---

# Commit Message Guidelines

Preferred format:

```
type(scope): description
```

Examples

```
feat(pos): add split payment

fix(stock): correct valuation

docs(api): improve authentication guide

test(cge): add loyalty rule tests

refactor(invoice): simplify calculation flow
```

---

# Code of Conduct

We expect contributors to:

- Be respectful
- Be constructive
- Welcome feedback
- Help others
- Keep discussions professional

Harassment or abusive behaviour will not be tolerated.

---

# License

By contributing to this repository, you agree that your contributions will be licensed under the same license as the project.

---

# Credits

SMRITI Retail OS

Designed & Architected by the Jawahar Ramkripal Mallah.

---

# Thank You

Every contribution—no matter how small—helps make SMRITI Retail OS better for the global retail community.

We sincerely appreciate your support.

**Happy Coding! 🚀**
