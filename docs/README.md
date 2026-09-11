# Session Notifier Documentation

`session-notifier` contains a local TypeScript service and a separate native Android client boundary. The service observes local AI-agent session transcripts and emits notifications when work starts, when a turn finishes or aborts, and when a session later becomes inactive. The Android project is currently only a scaffold.

It was derived from the input-detection heuristics in the sibling `context-recorder` project, but it does not include any Age of Agents UI, gamification, mission, hero, token, or world model.

## Contents

- [Architecture](architecture.md): pipeline, domain contracts, lifecycle behavior, and extension points.
- [Operations](operations.md): installation, commands, environment configuration, output, state, and troubleshooting.
- [Sources](sources.md): supported agent sources, transcript heuristics, source paths, and current limitations.
- [Implementation Status](implementation-status.md): delivered scope, known constraints, and the next implementation work.
- [PC Pairing](pairing.md): pairing command, deep-link, HTTP protocol, and device persistence.

## Quick Start

```powershell
Set-Location .\service
npm install
npm start
```

By default, the process enables every configured source identifier. The currently implemented file-backed collectors monitor Claude, Codex, Koda, and local-LLM sessions. A notification is printed to stdout as a single JSON line:

```json
{
  "type": "session-notification",
  "signal": {
    "type": "started",
    "session": {
      "source": "claude",
      "id": "session-id",
      "location": "project-directory"
    },
    "at": "2026-09-02T12:00:00.000Z",
    "prompt": "Implement notifications"
  }
}
```

For configuration, behavior, and operational caveats, start with [Operations](operations.md).
