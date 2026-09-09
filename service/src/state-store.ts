import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

interface PersistedState {
  delivered: string[];
}

export class StateStore {
  private readonly delivered = new Set<string>();

  constructor(private readonly path: string) {}

  async load(): Promise<void> {
    try {
      const parsed = JSON.parse(await readFile(this.path, 'utf8')) as PersistedState;
      if (!Array.isArray(parsed.delivered) || !parsed.delivered.every((key) => typeof key === 'string')) {
        throw new Error('delivered must be a string array');
      }
      for (const key of parsed.delivered) this.delivered.add(key);
    } catch (error: unknown) {
      if (isMissingFile(error)) return;
      console.error(`[session-notifier] ignoring unreadable state at ${this.path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  hasDelivered(key: string): boolean {
    return this.delivered.has(key);
  }

  async markDelivered(key: string): Promise<void> {
    this.delivered.add(key);
    await mkdir(dirname(this.path), { recursive: true });
    const temporaryPath = `${this.path}.tmp`;
    await writeFile(temporaryPath, JSON.stringify({ delivered: [...this.delivered] }, null, 2), 'utf8');
    await rename(temporaryPath, this.path);
  }
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT';
}
