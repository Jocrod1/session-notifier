---
name: session-handoff
description: Record verified task outcomes and leave a precise, approval-gated handoff in the project status file.
---

# Session handoff

At the end of each approved task, update `docs/implementation-status.md`, the single project status and handoff record.

Record:

- The task completed and relevant changed paths.
- Actual test and check commands with their outcomes; if not run, say so and why.
- Newly verified project facts and the evidence or date of verification.
- Remaining assumptions, blockers, and conflicts; do not turn assumptions into facts.
- Exactly one concrete next task with acceptance criteria, relevant checks, and any approval gate.

Keep the handoff concise and consistent with `docs/roadmap.md` and existing project decisions. Do not add a separate competing status or handoff document. Never commit unless the user explicitly approves.

Follow `AGENTS.md` for the approval gate and restrictions on deployment, migrations, production resources, destructive actions, and commits.
