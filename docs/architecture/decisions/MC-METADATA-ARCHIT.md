MASTER COMMAND: MC-METADATA-ARCHITECTURE-DECISION_v1.1_precondition_patch
PHASE: 2 of 2 (Architecture Decision + Evidence Standard)

Revision note (v1.0 → v1.1): Adds a targeted ledger currency check to guard against stale evidence when the repository advances after the ledger was written.

# PRECONDITION CHECK (mandatory — halt if not satisfied)

Before doing anything else:

1. Confirm `docs/governance/METADATA_ARCHITECTURE_EVIDENCE_LEDGER.md` exists.
2. Confirm every claim in it is tagged VERIFIED / SELF-REPORTED / UNVERIFIED (per its own Evidence Standard section).
3. Confirm Appendix A ("Prior Verified Findings") has been explicitly reconciled — confirmed or contradicted with citations, not silently repeated or dropped.
4. NEW — Confirm the ledger's recorded repository fingerprint (commit SHA) still matches current HEAD.

- If it matches: proceed.
- If it does not match: do NOT halt entirely and do NOT regenerate the full ledger. Instead:
  a. Run `git diff <ledger-SHA>..HEAD --stat` and list every file touched.
  b. For each file that appears in both that diff AND in the ledger's "Observed metadata systems" list or any of its cited file paths, re-verify the specific claim(s) that cited it. Tag each as CONFIRMED, CONTRADICTED, or STILL ACCURATE, with the current citation.
  c. Append these as a dated addendum to the ledger — do not silently edit prior VERIFIED tags. History stays; corrections are additive.
  d. Only then proceed to Sections 6–7, using the addendum alongside the original ledger as input.
- This check exists because a ledger can be internally perfect — every claim tagged, Appendix A fully reconciled — and still be wrong the moment the repository moves past the commit it was written against. Tagging discipline catches sloppy evidence. It does not catch stale evidence. Only a fingerprint check does.

If precondition 1, 2, or 3 fails, STOP as in v1.0 — that still requires a separate Phase 1 revision, not a patch under this command. Precondition 4 is the only one this command may remediate directly, via the targeted addendum process above, because it doesn't require re-auditing anything the ledger didn't already scope — only re-checking whether scope that was correct at write-time still holds.

# EVIDENCE STANDARD ADDITION

Add this rule to any ledger revision — Phase 1 or an addendum under precondition 4 above:

"Absence of a name is not evidence of absence of the capability."
A search that finds zero references to a class, function, or file name proves that name is unused. It does not prove the capability it implemented is unused — the capability may have been reimplemented under different naming, in a different language, or in a different layer entirely (the WorkflowEngine case: a TypeScript class name will never appear in a Python file, regardless of whether the underlying state machine was ported). Before a ledger records "no consumers found" as grounds for a "retire" or "non-canonical" disposition, check the consuming side, not just the named thing: does the frontend call something that could be this capability's replacement? Does the equivalent capability exist under a different name in another layer? If the search methodology can't answer that, tag the finding UNVERIFIED for "successor existence," not VERIFIED for "unused."

# OBJECTIVE, DELIVERABLE, SECTION 6, SECTION 7, RULES, SUCCESS CRITERIA

Unchanged from v1.0. Re-stated here only for completeness of this file as a standalone document — see `MC-METADATA-ARCHITECTURE-DECISION` v1.0 for full text if this file is consulted independently.
