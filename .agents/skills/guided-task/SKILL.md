---
name: guided-task
description: Carry an approved repository task from context review through implementation, verification, and handoff while preserving the project's approval and safety rules.
---

# Guided task workflow

Use this skill when the user wants a repository task carried through end to end. It complements, rather than replaces, `AGENTS.md`, the `resume-project` skill, and the `session-handoff` skill.

## 1. Establish current context

- Follow `.agents/skills/resume-project/SKILL.md` to read the canonical instructions, status, roadmap, relevant documentation, Git state and history, and available task tracking.
- Recheck claims that may have changed. Separate verified facts from assumptions, stale information, and unresolved decisions.
- Inspect existing changes before editing; treat unfamiliar or uncommitted work as user-owned.

## 2. Propose one task and wait for approval

- Propose exactly one concrete task at a time. State its scope, acceptance criteria, relevant checks, and material risks or decisions.
- Do not edit files or begin implementation until the user explicitly approves that task. A request to inspect, explain, or propose work is not approval.
- If scope, acceptance, or a material decision is unclear, ask before proposing implementation.
- If the active harness or agent mode prohibits file changes (for example, Plan mode), present the proposal and wait for the user to switch to an implementation-capable mode. Never attempt to bypass that restriction.

## 3. Execute only the approved task

- After approval, work independently through the approved scope. Routine implementation steps and relevant checks do not need separate approval.
- Keep changes focused. If new information requires a material scope change or a different task, stop and ask the user before proceeding.
- Follow `AGENTS.md` for safeguards. In particular, do not deploy, run migrations, modify production resources, perform destructive operations, or commit without the required explicit approval. Approval for the task alone does not authorize those actions.
- Do not expose secrets or inspect ignored local runtime data unless it is necessary and authorized for the approved task.

## 4. Verify and hand off

- Run relevant checks and report the exact commands and outcomes. Do not claim that unrun checks passed. For documentation-only work, explain why application tests were not applicable.
- Follow `.agents/skills/session-handoff/SKILL.md` and update `docs/implementation-status.md` with verified outcomes, actual checks, remaining blockers or assumptions, and exactly one proposed next task.
- Do not silently replace an existing project decision or next task. Record conflicts or blockers and ask the user when resolution requires a decision.
- Finish with a concise summary of changed paths, verification results, and remaining blockers. Do not commit unless explicitly approved.

## Invocation

This skill is in the shared `.agents/skills` location supported by both OpenCode and GitHub Copilot CLI. Invoke it explicitly as `@guided-task` in OpenCode or `/guided-task` in Copilot CLI, or let the harness select it when relevant.
