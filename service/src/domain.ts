export type SourceId = 'claude' | 'codex' | 'koda' | 'local-llm' | 'opencode' | 'github-copilot' | 'docker-claude';

export interface SessionRef {
  source: SourceId;
  id: string;
  location: string;
}

export type EndReason = 'completed' | 'aborted' | 'inferred' | 'container-exit';

export interface SessionStartedSignal {
  type: 'started';
  session: SessionRef;
  at: string;
  prompt: string;
}

export interface SessionEndedSignal {
  type: 'ended';
  session: SessionRef;
  at: string;
  reason: EndReason;
}

export interface SessionInactiveSignal {
  type: 'inactive';
  session: SessionRef;
  at: string;
}

export type SessionSignal = SessionStartedSignal | SessionEndedSignal | SessionInactiveSignal;

export interface WorkFinishedEvent {
  type: 'work-finished';
  session: SessionRef;
  at: string;
}

export type SessionEvent = WorkFinishedEvent;

export interface NotificationAdapter {
  notify(signal: SessionSignal): Promise<void>;
  close(): Promise<void>;
}

export function sessionKey(session: SessionRef): string {
  return `${session.source}:${session.location}:${session.id}`;
}
