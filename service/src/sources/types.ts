import type { SourceId } from '../domain.js';
import type { SessionEvent, SessionRef } from '../domain.js';
import type { Fact } from '../transcript/facts.js';

export interface ClassifiedSession {
  id: string;
  location: string;
}

export interface FileSource {
  id: Exclude<SourceId, 'opencode' | 'docker-claude'>;
  roots(): string[];
  depth: number;
  classify(path: string, root: string): ClassifiedSession | undefined;
  parseLine(line: string): Fact[];
}

export type EventSink = (event: SessionEvent) => Promise<void>;

export interface EventSource {
  start(): void;
  stop(): Promise<void>;
}
