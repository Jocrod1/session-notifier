---
name: resume-project
description: Reconstruct the repository's verified project context after a work gap and propose one approved next task.
---

# Resume project

Use this skill when resuming project work after a pause, especially a gap of days or weeks.

1. Read `AGENTS.md`, `docs/implementation-status.md`, `docs/roadmap.md`, and the relevant project documentation.
2. Inspect Git status, recent commits, and available task tracking. Do not assume prior session notes or dated status still match the current branch.
3. Recheck relevant claims against the repository. Clearly label verified facts with evidence or a check date; distinguish assumptions, stale claims, and unresolved decisions.
4. Identify conflicts in existing decisions or docs. Preserve the established decisions; record unresolved conflicts as blockers rather than choosing silently or adding duplicate policy.
5. Present exactly one concrete next task, with scope, acceptance criteria, relevant tests/checks, and material risks or decisions. Do not implement it until the user explicitly approves.
6. If the user asked only for status or a proposal, answer with findings and stop. Do not edit files or run unrelated checks.

Follow `AGENTS.md` for approval gates, safeguards, verification, and end-of-task status updates.
