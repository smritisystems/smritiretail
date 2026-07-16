<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-07-12
  Modified     : 2026-07-12
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SGAS Appendix: AI Agent Output Verification Framework (AOVF v1.0)

This is a companion reference to the SMRITI Governance Audit Standard (SGAS).
Where SGAS governs document lifecycle and evidence levels, this framework
is specifically about **verifying claims made by AI coding agents** —
plans, completion reports, and self-assessments. Every pattern below was
found *in this codebase*, not invented hypothetically. Use it two ways:

1. **As a reviewer checklist** — before accepting any AI agent's
   completion report, walk Section B.
2. **As agent instructions** — paste Section D into any task you hand to
   an AI agent, so it self-corrects before you have to.

---

## A. Fabrication & Overclaim Patterns (what to watch for)

Each pattern below is named, with a real example from this codebase, so
it's recognizable rather than abstract.

### A1. "Missing" thing that already exists
An agent recommends building something that's already built, because it
never checked. *Example: a review recommended "adopt SQLAlchemy 2.x ORM"
when the codebase already used it; another recommended "reserve folder
ai/" when `backend/app/ai/` already had 8 scaffolded sub-modules.*
**Check:** grep/view the actual file tree before accepting any "we need to
build X" claim.

### A2. Unverifiable citation used as authority
A plan cites a governance document ("Master AI Development Directive
v4.0") to justify a design choice. The document doesn't exist anywhere in
the repo. Repetition across multiple agent reviews made it *feel* more
credible without adding any evidence.
**Check:** grep the exact document name. If it doesn't resolve to a real
file, the citation is void until proven otherwise — regardless of how many
times it's repeated.

### A3. Self-reported metrics with no underlying data
A "Dev Intelligence Center" reported `Security Score: 100%`, `Critical
Gaps: 0` — backed by a `SECURITY_STATUS.md` that was a 3-line empty stub.
The score was also stale across two version bumps (still said `v3.5.0`
target after the app was at `v3.7.0`).
**Check:** for any quantitative score/percentage, find the underlying
computation. If it's not derivable from something you can independently
re-run, treat the number as fiction.

### A4. Knowledge-cutoff false correction
A plan "fixed" `gemini-3.5-flash` to `gemini-2.5-flash`, believing 3.5 was
hallucinated. It wasn't — 3.5 was the newer, correct model; the "fix" was
a downgrade based on stale training data.
**Check:** for any claim that something "doesn't exist" (an API, a model
name, a package version), verify against current reality (web search),
don't just trust the agent's confidence.

### A5. Fabricated version/identifier with no grounding
A plan asked to bump the version to `3.14.4` — a number that appeared
nowhere in the repo (grep returned zero matches).
**Check:** grep any specific number, ID, or string the agent asserts is
"current" before accepting it as a target.

### A6. Silent override that drops a parent safety behavior
`ProductRepository` inherited `BaseRepository` (which filters
`is_deleted`), but overrode `get_all()` without preserving that filter —
soft-deleted rows leaked back into results.
**Check:** whenever a subclass overrides a method from a class that has
safety/filtering behavior, diff the override against the parent method
line by line — don't assume inheritance alone preserves behavior.

### A7. Self-assigned confidence score with no rubric
Multiple reviews scored plans "8.7/10 → 10/10" or "9.8/10" with no stated
criteria.
**Check:** any bare numeric score is not evidence. Ask what it measures,
or replace it with a pass/fail checklist per concrete criterion.

### A8. Self-assigned "Evidence Level" on a completion report
An agent labeled its own report "Evidence Level: A" — despite explicit
instruction that only the human reviewer makes that determination.
**Check:** an agent's own claim about the strength of its own evidence is
not evidence. Strip it and re-derive the level yourself (see Section C).

### A9. Incomplete report hiding behind a "Done" checklist
A completion report's evidence table just said "Done" for every file,
with no literal diff, no coverage %, no lint/type-check output — even
though the task explicitly required those fields.
**Check:** a checkmark is not a diff. If a required field (coverage, lint
output, specific test names) is silently absent from a report, treat it
as **not verified**, not as passing by omission.

### A10. Scope hidden under an innocuous label
A branch named `chore-author-designation-headers` actually contained a new
governance framework, a DB migration, and 7 new test files.
**Check:** always diff branch/PR contents against what the name implies.
Mismatch is itself a finding, independent of whether the content is good.

### A11. Hardcoded secret/default that defeats the point of security work
`JWT_SECRET_KEY` had a hardcoded fallback value committed in source. A new
user with no explicit password got a shared default (`"smriti123"`). CORS
was `allow_origins=["*"]` combined with `allow_credentials=True` — a
combination that lets any origin make credentialed requests.
**Check:** grep for hardcoded default secrets, shared fallback passwords,
and wildcard-origin + credentials-enabled CORS configs on every security
review, regardless of what the task description says it's about.

### A12. Plan describes a clean end-state with no bridge from current state
An architecture doc proposed a full CQRS split with an event bus, but the
codebase currently had live write endpoints in the "read-only" side and no
event-bus infrastructure at all — and the doc didn't mention any of this.
**Check:** for any target-architecture document, ask "what already
contradicts this today, and what's the migration path" — a beautiful
diagram is not a plan without one.

---

## B. Reviewer Checklist (run this before accepting any completion report)

1. **Re-derive, don't trust, every number.** Coverage %, test pass counts,
   security scores — run the command yourself in a clean environment.
2. **Grep every "already exists" or "doesn't exist" claim.** Both
   directions — agents fabricate absence as often as presence.
3. **Read the diff of every touched file, not the summary.** A "Done"
   table row is not a diff.
4. **Check subclass overrides against parent behavior**, especially for
   repository/data-access layers (A6).
5. **Check for hardcoded secrets/defaults** introduced or left behind,
   even in tasks unrelated to security (A11).
6. **Check the branch/PR name against the actual diff scope** (A10).
7. **Verify any external fact (API/model names, library versions,
   currently-accurate technical claims) with a live source**, not memory
   (A4).
8. **Strip self-assigned confidence language** ("Evidence Level: A", "9.8/10",
   "production-ready") before evaluating — treat it as noise, not signal.
9. **If a required report field is missing, treat it as unverified — not
   as implicitly passing.**
10. **Run the actual test suite yourself** when possible. If you can't
    (e.g. no live Postgres), say so explicitly rather than inferring pass
    from the agent's transcript.

---

## C. Evidence Levels for Agent Claims (extends SGAS A–D)

| Level | Meaning |
|---|---|
| **A** | You personally re-ran the command/test in a clean environment and observed the same result. |
| **B** | The artifact exists and is internally consistent (e.g. a real test file with real assertions), but you could not execute it (e.g. missing infra like a live DB). |
| **C** | The agent's report claims it, with a plausible-looking transcript, but you have not independently checked the underlying files. |
| **D** | Pure assertion — a claim with no artifact, transcript, or diff to check at all. |

An agent's own "Evidence Level" label is never accepted as-is — it is
always re-derived by the reviewer using this table.

---

## D. Rules to Hand to Any AI Agent (paste into task prompts)

```
1. Do not claim something is missing or broken without first grepping/
   viewing the actual current file. Cite the exact file and line you
   checked.
2. Do not cite a governance document, ADR, or "directive" by name unless
   you have located the actual file in this repository.
3. Do not report a numeric score, percentage, or coverage figure unless
   you can show the exact command that produced it.
4. Do not hardcode a default value for any secret, key, token, or
   password. Missing required config must fail startup loudly, never
   fall back silently.
5. When overriding a method from a parent/base class, explicitly diff
   your override against the parent's behavior and state what safety
   filters (soft-delete, tenant scoping, etc.) you preserved or dropped.
6. Do not touch files outside the stated task scope. If you find
   something else broken, list it separately as "found but not fixed" —
   do not fix it inline.
7. Name your branch/commit/PR to reflect the actual full scope of the
   diff, not just the primary intent.
8. Do not self-assign an "Evidence Level," confidence score, or
   "production-ready" status. Report literal command output; the human
   reviewer determines the evidence level.
9. Your completion report must follow the exact requested format. If a
   field cannot be completed (e.g. a test requires infrastructure you
   don't have), write "Not verified — [reason]" in that field. Do not
   omit the field silently.
10. If a task's scope grows beyond what was asked, stop and report back
    instead of continuing into unrequested work.
```

---

## E. Recurring Technical Anti-Patterns (SMRITI-specific, keep growing this list)

- Hardcoded secret defaults (`JWT_SECRET_KEY`, shared fallback passwords).
- `allow_origins=["*"]` + `allow_credentials=True` in FastAPI CORS config.
- Repository method overrides that silently drop `is_deleted`/tenant
  filters present in the parent class.
- Two backends (Express, FastAPI) writing to the same Postgres tables
  without an explicit write-ownership contract per domain.
- `pyproject.toml` `testpaths` not matching the actual test directory.
- CI installing test dependencies but never invoking the test runner.
- Multi-tenant fields (`company_id`/`branch_id`) added to models without
  a corresponding `Company`/`Branch` table or backfill/default strategy —
  rows written before the fields existed can silently vanish from
  tenant-filtered queries.

*(Add new entries here as future audits surface them — this list is meant
to grow, not be rewritten each time.)*
