import type { Plugin } from "@opencode-ai/plugin"

/**
 * Minimal Session Notifier bridge for OpenCode.
 *
 * OpenCode plugins receive an `event` hook. This adapter only supports the
 * `session.idle` event (see docs/sources.md and src/hooks/normalize.ts in
 * the session-notifier service). Save this file to a project's
 * `.opencode/plugin/` directory (or the equivalent global plugin directory)
 * to forward `session.idle` events into Session Notifier's hook inbox.
 *
 * This plugin does not invent any additional OpenCode API surface: it only
 * uses the documented plugin `event` hook and the `directory` value passed
 * into the plugin factory.
 */
export const SessionNotifierBridge: Plugin = async ({ $, directory }) => {
  return {
    event: async ({ event }) => {
      if (event.type !== "session.idle") return

      // The adapter (src/hooks/normalize.ts) requires `properties.sessionID`
      // and a `directory` field on the payload it receives on stdin.
      const payload = JSON.stringify({ ...event, directory })

      await $`printf '%s' ${payload} | npx --prefix /path/to/session-notifier/service tsx /path/to/session-notifier/service/src/hooks/cli.ts --source=opencode`
    },
  }
}
