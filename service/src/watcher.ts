import { existsSync } from 'node:fs';
import { watch, type FSWatcher } from 'chokidar';
import type { SessionRef } from './domain.js';
import type { FileSource } from './sources/types.js';
import { TailRegistry } from './transcript/tail.js';
import type { Fact } from './transcript/facts.js';

export class SourceWatcher {
  private readonly tails = new TailRegistry();
  private watcher?: FSWatcher;
  private queue = Promise.resolve();

  constructor(
    private readonly source: FileSource,
    private readonly onFacts: (session: SessionRef, facts: Fact[]) => Promise<void>,
  ) {}

  start(): void {
    const roots = this.source.roots().filter(existsSync);
    if (roots.length === 0) {
      console.error(`[session-notifier] ${this.source.id}: no transcript root found`);
      return;
    }
    this.watcher = watch(roots, { depth: this.source.depth, ignoreInitial: false, usePolling: true, interval: 1_000 });
    const enqueue = (path: string, initial: boolean) => {
      this.queue = this.queue.then(() => this.handle(path, roots, initial)).catch((error) => {
        console.error(`[session-notifier] ${this.source.id}: ${path}`, error);
      });
    };
    this.watcher.on('add', (path) => enqueue(path, true));
    this.watcher.on('change', (path) => enqueue(path, false));
    this.watcher.on('error', (error) => console.error(`[session-notifier] ${this.source.id} watcher error`, error));
  }

  async stop(): Promise<void> {
    await this.watcher?.close();
  }

  private async handle(path: string, roots: string[], initial: boolean): Promise<void> {
    if (!path.endsWith('.jsonl')) return;
    const root = roots.find((candidate) => path === candidate || path.startsWith(`${candidate}\\`) || path.startsWith(`${candidate}/`));
    if (!root) return;
    const classified = this.source.classify(path, root);
    if (!classified) return;
    if (!this.tails.has(path) && initial) {
      await this.tails.registerAtEnd(path);
      return;
    }
    const facts = (await this.tails.readNewLines(path)).flatMap((line) => this.source.parseLine(line));
    if (facts.length > 0) await this.onFacts({ source: this.source.id, id: classified.id, location: classified.location }, facts);
  }
}
