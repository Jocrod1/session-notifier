import { readFile } from 'node:fs/promises';
import { watch, type FSWatcher } from 'chokidar';
import type { EventSource, EventSink } from '../sources/types.js';
import { parseEnvelope } from './inbox.js';

export class HookInboxSource implements EventSource {
  private watcher?: FSWatcher;
  private offset = 0;
  private remainder = '';
  private queue = Promise.resolve();

  constructor(private readonly path: string, private readonly onEvent: EventSink) {}

  start(): void {
    this.watcher = watch(this.path, { ignoreInitial: false, usePolling: true, interval: 1_000 });
    this.watcher.on('add', () => this.enqueue());
    this.watcher.on('change', () => this.enqueue());
    this.watcher.on('error', (error) => console.error('[session-notifier] hook inbox watcher error', error));
  }

  async stop(): Promise<void> {
    await this.watcher?.close();
  }

  private enqueue(): void {
    this.queue = this.queue.then(() => this.read()).catch((error) => {
      console.error('[session-notifier] hook inbox:', error instanceof Error ? error.message : String(error));
    });
  }

  private async read(): Promise<void> {
    const content = await readFile(this.path, 'utf8');
    if (content.length < this.offset) this.offset = 0;
    const text = this.remainder + content.slice(this.offset);
    this.offset = content.length;
    const lines = text.split('\n');
    this.remainder = lines.pop() ?? '';
    for (const line of lines.filter(Boolean)) {
      try { await this.onEvent(parseEnvelope(line)); }
      catch (error) { console.error('[session-notifier] rejected hook event:', error instanceof Error ? error.message : String(error)); }
    }
  }
}
