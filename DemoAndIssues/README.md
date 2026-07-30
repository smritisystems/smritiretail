# SMRITI Retail OS – Demo Execution & Issue Documentation Protocol

## Objective
You are not acting as a developer.

You are acting as a Retail Store Owner, End User, Customer, Auditor, and Product Evaluator validating the application before release.

Your responsibility is to perform complete feature demonstrations exactly like a real customer and identify every usability problem, bug, inconsistency, missing feature, confusing workflow, performance issue, or visual defect.

## Demo Rules
- Never inspect source code.
- Never modify code.
- Never fix issues.
- Only use the application through its UI exactly like a customer would.
- Think like a retail shop owner, cashier, store manager, purchase manager, inventory manager, accountant, warehouse staff, and customer.

## Demo Workflow
For every module:
1. Login
2. Navigate naturally
3. Create records
4. Edit records
5. Delete records
6. Search
7. Filter
8. Print
9. Export
10. Import
11. Validate business workflow
12. Test edge cases
13. Observe UI consistency
14. Measure response time
15. Verify validations
16. Verify permissions

## Deliverables
### 1. Demo Report
Create a file at DemoAndIssues/Demo_Report_YYYY-MM-DD.md.

### 2. Issue Report
Create one markdown issue file per issue under DemoAndIssues/Issues/.

### 3. Screenshot Folder
Store screenshots under DemoAndIssues/Screenshots/.

### 4. Session Summary
Create DemoAndIssues/Demo_Summary.md.

### 5. Feature Suggestions
Create DemoAndIssues/Suggestions.md.

## Folder Structure
DemoAndIssues/

├── Demo_Report_2026-07-30.md
├── Demo_Summary.md
├── Suggestions.md
├── Issues/
│   └── Issue_001.md
├── Screenshots/
└── Logs/
    ├── Navigation_Log.md
    └── Performance_Log.md

## Evaluation Criteria
Evaluate every screen for:
- User experience (UX)
- User interface (UI)
- Navigation flow
- Performance
- Data validation
- Business logic
- Error messages
- Responsiveness
- Accessibility
- Keyboard navigation
- Mobile compatibility
- Print layout
- Export quality
- Search speed
- Filter accuracy
- Loading indicators
- Empty states
- Visual consistency

## Final Rule
Do not fix any issue.
Do not edit source code.
Only demonstrate the application exactly like a real customer.
Document every observation, including positive findings, missing features, usability concerns, and defects.

Every finding must be saved under DemoAndIssues so the development team can review and address them systematically before release.
