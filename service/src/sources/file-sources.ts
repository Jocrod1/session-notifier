import { homedir } from 'node:os';
import { basename, join, relative, sep } from 'node:path';
import type { Fact } from '../transcript/facts.js';
import type { FileSource } from './types.js';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const timestamp = (value: unknown) => typeof value === 'string' ? value : new Date().toISOString();
const clip = (text: string) => text.trim().slice(0, 240);
const humanPrompt = (text: string) => {
  const value = text.trim();
  return Boolean(value) && !value.startsWith('<') && !value.startsWith('[Request interrupted') && !value.includes('<system-reminder>');
};

export const claudeSource: FileSource = {
  id: 'claude',
  roots: () => [join(homedir(), '.claude', 'projects')],
  depth: 6,
  classify(path, root) {
    const parts = relative(root, path).split(sep);
    if (parts.length !== 2 || !parts[1]?.endsWith('.jsonl')) return undefined;
    return { id: basename(parts[1], '.jsonl'), location: parts[0] };
  },
  parseLine(line) {
    const record = parse(line);
    if (!record) return [];
    const ts = timestamp(record.timestamp);
    if (record.type === 'queue-operation' && record.operation === 'enqueue' && typeof record.content === 'string' && humanPrompt(record.content)) {
      return [{ kind: 'prompt', text: clip(record.content), ts }];
    }
    if (record.type === 'user') {
      const content = record.message?.content;
      if (typeof content === 'string' && humanPrompt(content)) return [{ kind: 'prompt', text: clip(content), ts }];
    }
    if (record.type === 'assistant' && record.message?.stop_reason === 'end_turn') return [{ kind: 'turn-end', ts }];
    return record.type === 'assistant' || record.type === 'user' ? [{ kind: 'activity', ts }] : [];
  },
};

export const codexSource: FileSource = {
  id: 'codex',
  roots: () => [join(homedir(), '.codex', 'sessions')],
  depth: 5,
  classify(path, root) {
    const rel = relative(root, path);
    if (!rel.endsWith('.jsonl')) return undefined;
    const id = basename(rel).match(UUID_RE)?.[0];
    return id ? { id, location: relative(root, path).split(sep).slice(0, -1).join('/') } : undefined;
  },
  parseLine: parseGenericTurn,
};

export const kodaSource: FileSource = {
  id: 'koda',
  roots: () => [join(homedir(), '.koda', 'agent', 'sessions')],
  depth: 3,
  classify(path, root) {
    const rel = relative(root, path);
    const id = basename(rel).match(UUID_RE)?.[0];
    return id ? { id, location: rel.split(sep)[0] ?? '' } : undefined;
  },
  parseLine: parseGenericTurn,
};

export const localLlmSource: FileSource = {
  id: 'local-llm',
  roots: () => [process.env.LOCAL_LLM_SESSIONS_DIR ?? join(homedir(), '.age-of-agents', 'local-llm', 'sessions')],
  depth: 1,
  classify(path, root) {
    const rel = relative(root, path);
    if (rel.includes(sep) || !rel.endsWith('.jsonl')) return undefined;
    const id = basename(rel).match(UUID_RE)?.[0];
    return id ? { id, location: root } : undefined;
  },
  parseLine: parseGenericTurn,
};

export const FILE_SOURCES: FileSource[] = [claudeSource, codexSource, kodaSource, localLlmSource];

function parseGenericTurn(line: string): Fact[] {
  const record = parse(line);
  if (!record) return [];
  const ts = timestamp(record.timestamp ?? record.ts);
  const payload = record.payload ?? record;
  const content = payload.message?.content ?? payload.content;
  const role = payload.message?.role ?? payload.role;
  const text = Array.isArray(content)
    ? content.filter((part: unknown) => typeof (part as { text?: unknown })?.text === 'string').map((part: { text: string }) => part.text).join('\n')
    : typeof content === 'string' ? content : undefined;
  if (role === 'user' && text && humanPrompt(text)) return [{ kind: 'prompt', text: clip(text), ts }];
  if (['turn_complete', 'task_complete', 'step-finish'].includes(record.type) || ['turn_complete', 'task_complete'].includes(payload.type)) {
    return [{ kind: 'turn-end', ts }];
  }
  if (record.type === 'turn_aborted' || payload.type === 'turn_aborted') return [{ kind: 'turn-aborted', ts }];
  return [{ kind: 'activity', ts }];
}

function parse(line: string): any | undefined {
  try {
    const record = JSON.parse(line);
    return record && typeof record === 'object' ? record : undefined;
  } catch {
    return undefined;
  }
}
