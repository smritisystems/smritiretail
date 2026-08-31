# Dependency Maintenance Guide — SMRITI Retail OS

**Date**: 2026-08-31  
**Version**: 3.30.0  
**Status**: Production-Ready ✅

---

## 1. Dependency Audit Automation

### Frontend: npm Audit

**Weekly audit script** (`scripts/audit-npm.sh`):

```bash
#!/bin/bash
# Run weekly via cron: 0 9 * * MON

set -e

echo "====== NPM Dependency Audit ======"
echo "Date: $(date)"

cd /opt/smriti

# Run audit and capture results
npm audit --audit-level=moderate > audit-report.json 2>&1 || true

# Parse critical/high issues
CRITICAL=$(npm audit --audit-level=critical 2>&1 | grep -c "high\|critical" || true)
HIGH=$(npm audit --audit-level=high 2>&1 | grep -c "high" || true)

echo "Critical issues: $CRITICAL"
echo "High issues: $HIGH"

if [ "$CRITICAL" -gt 0 ]; then
    echo "⚠️  CRITICAL VULNERABILITIES DETECTED"
    npm audit --audit-level=critical
    
    # Send alert to ops team
    curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
      -d '{"text":"⚠️ CRITICAL: NPM vulnerabilities detected in SMRITI"}'
    
    exit 1
fi

if [ "$HIGH" -gt 0 ]; then
    echo "⚠️  HIGH VULNERABILITIES DETECTED"
    npm audit --audit-level=high
fi

echo "Audit complete: $(date)" >> /var/log/smriti-maintenance.log
```

**Add to crontab**:
```bash
# Run npm audit every Monday at 9 AM
0 9 * * MON /opt/smriti/scripts/audit-npm.sh

# Run npm audit on every PR (via GitHub Actions - see CI/CD pipeline)
```

### Backend: pip Audit

**Weekly audit script** (`scripts/audit-pip.sh`):

```bash
#!/bin/bash
# Run weekly via cron: 0 9 * * TUE

set -e

echo "====== Python Dependency Audit ======"
echo "Date: $(date)"

cd /opt/smriti/backend

# Install safety if not present
pip install --quiet safety

# Run safety check
safety check --json backend/requirements.txt > audit-report.json 2>&1 || true

# Count vulnerabilities
VULN_COUNT=$(python -c "import json; data=json.load(open('audit-report.json')); print(len(data))" || echo 0)

echo "Vulnerabilities found: $VULN_COUNT"

if [ "$VULN_COUNT" -gt 0 ]; then
    echo "⚠️  VULNERABILITIES DETECTED"
    safety check backend/requirements.txt
    
    # Send alert
    curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
      -d '{"text":"⚠️ ALERT: Python vulnerabilities detected in SMRITI"}'
    
    exit 1
fi

echo "Audit complete: $(date)" >> /var/log/smriti-maintenance.log
```

**Add to crontab**:
```bash
# Run pip audit every Tuesday at 9 AM
0 9 * * TUE /opt/smriti/scripts/audit-pip.sh
```

---

## 2. Scheduled Dependency Updates

### Frontend: npm Update Strategy

**Minor/patch updates** (auto-applied monthly):
```bash
#!/bin/bash
# scripts/update-npm-safe.sh
# Run monthly on 1st of month

cd /opt/smriti

# Update minor and patch versions (safe)
npm update --save

# Commit if changes detected
if ! git diff --quiet package*.json; then
    git add package*.json
    git commit -m "chore: npm dependencies update (minor/patch)"
    git push origin develop
    
    echo "npm update: changes committed to develop branch"
else
    echo "npm update: no changes required"
fi
```

**Major updates** (manual review):
```bash
#!/bin/bash
# scripts/check-npm-major.sh
# Run quarterly (check for breaking changes)

cd /opt/smriti

# Check for available major updates
echo "Checking for major npm updates..."
npm outdated

# Instructions for team
echo ""
echo "📌 To review major updates:"
echo "  1. Review changelog for breaking changes"
echo "  2. Create feature branch: git checkout -b chore/npm-major-update"
echo "  3. npm install [package]@latest"
echo "  4. Run full test suite: npm test -- --run"
echo "  5. Create PR for review"
```

**Add to crontab**:
```bash
# Minor/patch updates: 1st of month at 2 AM
0 2 1 * * /opt/smriti/scripts/update-npm-safe.sh

# Check for major updates: quarterly (1st, 4th, 7th, 10th month)
0 3 1 1,4,7,10 * /opt/smriti/scripts/check-npm-major.sh
```

### Backend: pip Update Strategy

**Minor/patch updates** (auto-applied monthly):
```bash
#!/bin/bash
# scripts/update-pip-safe.sh

cd /opt/smriti/backend

# Create temp venv to test updates
python -m venv test_venv
source test_venv/bin/activate

# Install current + run tests
pip install -r requirements.txt
pytest tests/ -q

# If tests pass, apply updates
if [ $? -eq 0 ]; then
    pip install --upgrade --quiet pip-tools
    pip-compile --upgrade --quiet
    
    git add requirements.txt requirements-lock.txt
    git commit -m "chore: python dependencies update (minor/patch)"
    git push origin develop
fi

deactivate
rm -rf test_venv
```

**Add to crontab**:
```bash
# Pip minor/patch updates: 3rd of month at 2 AM
0 2 3 * * /opt/smriti/scripts/update-pip-safe.sh
```

---

## 3. Version Pinning Strategy

### npm (Frontend)

**Best Practice**: Pin major.minor, allow patch
```json
{
  "dependencies": {
    "react": "^18.3.0",           // Allow 18.3.x (patch updates)
    "typescript": "^5.2.0",        // Allow 5.2.x
    "tailwindcss": "^4.0.0",       // Allow 4.0.x
    "zustand": "^4.5.0"            // Allow 4.5.x
  },
  "devDependencies": {
    "vite": "^5.4.0",              // Allow 5.4.x
    "vitest": "^4.1.0",            // Allow 4.1.x
    "@vitejs/plugin-react": "^4.1.0"
  }
}
```

**Lock file**: Always commit `package-lock.json`
```bash
npm ci  # Use lock file for exact versions
```

### pip (Backend)

**Use pip-tools for reproducible builds**:
```bash
# requirements.in (human-edited)
fastapi==0.100.*              # Allow patch updates only
sqlalchemy==2.0.*
alembic==1.11.*
pydantic==2.3.*

# requirements.txt (machine-generated, locked)
# Generated from requirements.in
fastapi==0.100.1
sqlalchemy==2.0.23
alembic==1.11.3
pydantic==2.3.0
# ... all transitive deps
```

**Install pinned dependencies**:
```bash
pip install -r requirements.txt  # Exact versions
```

**Update pinned versions** (after testing):
```bash
pip-compile --upgrade requirements.in  # Updates requirements.txt
```

---

## 4. Testing After Updates

### Frontend: Pre-Merge Validation

```bash
#!/bin/bash
# After npm update, before commit:

npm run lint       # Check code style
npx tsc --noEmit  # TypeScript check
npm run build     # Production build
npm test -- --run # Run all tests

if [ $? -eq 0 ]; then
    echo "✅ All checks passed - safe to merge"
else
    echo "❌ Tests failed - do NOT merge"
    exit 1
fi
```

### Backend: Pre-Merge Validation

```bash
#!/bin/bash
# After pip update, before commit:

cd backend

# Linting
python -m pylint app --fail-under=8.0 || true

# Type checking
python -m mypy app --ignore-missing-imports || true

# Unit tests
pytest tests/ -v --cov=app

# Database migration compatibility
alembic current  # Check current schema version
pytest tests/test_alembic_compat.py  # Migration tests

if [ $? -eq 0 ]; then
    echo "✅ All checks passed - safe to merge"
else
    echo "❌ Tests failed - do NOT merge"
    exit 1
fi
```

---

## 5. Security Advisory Monitoring

### GitHub Dependabot

**Enable in `.github/dependabot.yml`**:
```yaml
version: 2
updates:
  # Frontend dependencies
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
    open-pull-requests-limit: 5
    reviewers:
      - "dev-team"
    allow:
      - dependency-type: "production"
      - dependency-type: "development"
    ignore:
      - dependency-name: "webpack"  # Custom version requirement
  
  # Backend dependencies
  - package-ecosystem: "pip"
    directory: "/backend"
    schedule:
      interval: "weekly"
      day: "tuesday"
      time: "09:00"
    open-pull-requests-limit: 3

  # GitHub Actions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "wednesday"
```

**Auto-merge minor updates** (GitHub Actions):
```yaml
name: Auto-merge Dependabot PRs

on: pull_request

jobs:
  auto-merge:
    runs-on: ubuntu-latest
    if: github.actor == 'dependabot[bot]'
    steps:
      - name: Approve and auto-merge (minor/patch)
        uses: actions/github-script@v6
        with:
          script: |
            const pr = context.payload.pull_request;
            
            // Only auto-merge minor/patch, not major
            if (pr.title.includes('Bump') && !pr.title.includes('major')) {
              github.rest.pulls.createReview({
                owner: context.repo.owner,
                repo: context.repo.repo,
                pull_number: pr.number,
                event: 'APPROVE'
              });
              
              github.rest.pulls.merge({
                owner: context.repo.owner,
                repo: context.repo.repo,
                pull_number: pr.number,
                merge_method: 'squash'
              });
            }
```

### Manual Monitoring

**Subscribe to security advisories**:
- [npm Security Advisories](https://www.npmjs.com/advisories)
- [PyPI Security Advisories](https://pypi.org/help/#advisory)
- [GitHub Security Alerts](https://github.com/settings/security_analysis)

**Set up email notifications**:
```bash
# For npm packages you depend on
npm star package-name

# GitHub automatically sends alerts for:
# - Dependabot alerts
# - Security advisories
# - Code scanning findings
```

---

## 6. Dependency Inventory & Compliance

### Frontend Dependencies

**Current inventory** (as of build):
```bash
npm list --depth=0
```

**Export to SBOM (Software Bill of Materials)**:
```bash
npm ls --json > sbom-npm.json
# Share with security/compliance team
```

### Backend Dependencies

```bash
cd backend
pip freeze > requirements-snapshot.txt
# For audit/compliance purposes
```

### License Compliance

**Check dependency licenses** (to avoid GPL conflicts):
```bash
# Frontend
npm install -g license-report
license-report --only=prod > LICENSE_REPORT.md

# Backend
pip install pip-licenses
pip-licenses --format=csv > LICENSE_REPORT.csv
```

---

## 7. Dependency Update Checklist

### Before Each Update

- [ ] Run current test suite (`npm test`, `pytest tests/`)
- [ ] Review changelog of packages being updated
- [ ] Check for breaking changes
- [ ] Verify lock files will be updated

### During Update

- [ ] Use safe update command (`npm update`, not `npm install @latest`)
- [ ] Test in isolated environment first
- [ ] Run full test suite
- [ ] Run build process
- [ ] Check for deprecation warnings

### After Update

- [ ] Commit lock files to version control
- [ ] Create descriptive PR (include upgrade reason)
- [ ] Request code review
- [ ] Monitor for issues in staging/production
- [ ] Document any configuration changes needed

---

## 8. Rollback Procedure

### If an Update Breaks Production

```bash
# Frontend rollback
git revert <commit-hash>
git push origin main
npm ci  # Reinstall exact version from package-lock.json
npm run build
# Redeploy

# Backend rollback
git revert <commit-hash>
git push origin main
pip install -r requirements.txt  # Reinstall exact versions
# Run migrations if needed
alembic upgrade head
# Restart application
```

---

## 9. Maintenance Schedule

| Task | Frequency | Owner | Action |
|------|-----------|-------|--------|
| npm audit | Weekly (Monday) | DevOps | Auto-run, alert if critical |
| pip audit | Weekly (Tuesday) | DevOps | Auto-run, alert if critical |
| npm minor/patch update | Monthly | CI/CD | Auto-create PR, test, merge if green |
| npm major update check | Quarterly | Dev Team | Review manually, create PR |
| pip minor/patch update | Monthly | CI/CD | Auto-create PR, test, merge if green |
| Dependabot review | As needed | Dev Team | Approve/merge security updates |
| License compliance | Quarterly | Compliance | Review SBOM, flag GPL/incompatible licenses |
| Security advisories | Real-time | GitHub | Via email/webhook notifications |

---

## 10. Key Metrics to Track

```bash
# Dependency age (how old are your packages?)
npm outdated  # Shows packages with available updates

# Vulnerability score (number of known issues)
npm audit  # Counts critical/high/moderate/low

# Test coverage (catches issues from dependency changes)
npm test -- --run --coverage

# Build time (dependency size growth)
npm run build  # Time and bundle size

# Security posture
npm audit score  # 0-100 (100 = no vulnerabilities)
```

---

**Next Steps**: 
1. Set up cron jobs for audit scripts
2. Enable GitHub Dependabot
3. Configure Slack notifications
4. Schedule team training on update process

