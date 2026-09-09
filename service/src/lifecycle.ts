import type { SessionEndedSignal, SessionEvent, SessionRef, SessionSignal } from './domain.js';
import { sessionKey } from './domain.js';

export interface LifecycleOptions {
  inactiveAfterMs: number;
}

interface SessionState {
  session: SessionRef;
  lastActivityMs: number;
  started: boolean;
  turnOpen: boolean;
  inactiveNotified: boolean;
}

export class SessionLifecycleTracker {
  private readonly sessions = new Map<string, SessionState>();

  constructor(private readonly options: LifecycleOptions) {}

  prompt(session: SessionRef, prompt: string, at: string): SessionSignal[] {
    const atMs = parseTimestamp(at);
    const key = sessionKey(session);
    const existing = this.sessions.get(key);
    const signals: SessionSignal[] = [];

    if (!existing || !existing.started) {
      signals.push({ type: 'started', session, at, prompt });
    }

    this.sessions.set(key, {
      session,
      lastActivityMs: atMs,
      started: true,
      turnOpen: true,
      inactiveNotified: false,
    });
    return signals;
  }

  activity(session: SessionRef, at: string): void {
    const key = sessionKey(session);
    const existing = this.sessions.get(key);
    if (!existing) return;
    existing.lastActivityMs = parseTimestamp(at);
    existing.inactiveNotified = false;
  }

  end(session: SessionRef, reason: SessionEndedSignal['reason'], at: string): SessionSignal[] {
    const existing = this.sessions.get(sessionKey(session));
    if (!existing || !existing.turnOpen) return [];
    existing.turnOpen = false;
    existing.lastActivityMs = parseTimestamp(at);
    return [{ type: 'ended', session, at, reason }];
  }

  event(event: SessionEvent): SessionSignal[] {
    if (event.type === 'work-finished') {
      const existing = this.sessions.get(sessionKey(event.session));
      if (!existing) {
        this.sessions.set(sessionKey(event.session), {
          session: event.session,
          lastActivityMs: parseTimestamp(event.at),
          started: false,
          turnOpen: false,
          inactiveNotified: false,
        });
        return [{ type: 'ended', session: event.session, at: event.at, reason: 'completed' }];
      }
      return this.end(event.session, 'completed', event.at);
    }
    return [];
  }

  tick(nowMs: number): SessionSignal[] {
    const signals: SessionSignal[] = [];
    for (const state of this.sessions.values()) {
      if (!state.started || state.inactiveNotified || nowMs - state.lastActivityMs < this.options.inactiveAfterMs) continue;
      state.inactiveNotified = true;
      state.started = false;
      signals.push({ type: 'inactive', session: state.session, at: new Date(nowMs).toISOString() });
    }
    return signals;
  }
}

function parseTimestamp(timestamp: string): number {
  const value = Date.parse(timestamp);
  if (Number.isNaN(value)) throw new Error(`Invalid ISO timestamp: ${timestamp}`);
  return value;
}
