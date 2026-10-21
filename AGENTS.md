# Project instructions

This file is the canonical repository-wide agent instruction. Keep project policy here; put task procedures in the repository-local skills rather than copying policy into multiple documents.

## Resume and plan

- Before proposing work, read `docs/implementation-status.md`, `docs/roadmap.md`, the relevant project documentation, Git status and recent history, and available task tracking. Recheck claims that may have changed since the last session.
- Distinguish verified facts (include their evidence or verification date) from assumptions, unresolved decisions, and stale or conflicting documentation. Never present an unverified status snapshot as a fresh test result.
- Propose exactly one concrete next task at a time. State its scope, acceptance criteria, relevant checks, and material risks or decisions. Wait for the user's explicit approval before implementing it. Do not interpret a request to inspect, explain, or propose as approval to change files.
- Preserve existing project decisions and documentation. Resolve conflicts by identifying them as blockers, not by silently choosing a side or adding duplicate instructions.

## Implementation and safeguards

- Keep changes focused on the approved task. Do not deploy, run database migrations, modify production resources, or perform destructive operations without explicit approval for that operation.
- Never commit changes unless the user explicitly approves the commit.
- Run the relevant tests and checks for approved implementation work. Report the actual commands and outcomes; do not imply unrun checks passed. For documentation-only work, say when tests were not applicable and why.
- At the end of each task, update `docs/implementation-status.md` with verified outcomes, actual checks, remaining blockers or assumptions, and exactly one proposed next task. Use the `session-handoff` skill for its required handoff fields.

## Repository workflow skills

- Use `.github/skills/resume-project/SKILL.md` to resume work after a gap or establish current project context.
- Use `.github/skills/session-handoff/SKILL.md` to record a completed task and leave a reliable handoff.
- `docs/roadmap.md` records phase goals and acceptance criteria. `docs/implementation-status.md` is the single current status and handoff record.
