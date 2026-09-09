import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

export class TailRegistry {
  private readonly offsets = new Map<string, number>();
  private readonly remainders = new Map<string, string>();

  async registerAtEnd(path: string): Promise<void> {
    const { size } = await stat(path);
    this.offsets.set(path, size);
    this.remainders.set(path, '');
  }

  has(path: string): boolean {
    return this.offsets.has(path);
  }

  async readNewLines(path: string): Promise<string[]> {
    let offset = this.offsets.get(path) ?? 0;
    let size: number;
    try {
      ({ size } = await stat(path));
    } catch {
      this.offsets.delete(path);
      this.remainders.delete(path);
      return [];
    }
    if (size < offset) {
      offset = 0;
      this.remainders.set(path, '');
    }
    if (size === offset) return [];

    const text = await readRange(path, offset, size - 1);
    this.offsets.set(path, size);
    const parts = ((this.remainders.get(path) ?? '') + text).split('\n');
    this.remainders.set(path, parts.pop() ?? '');
    return parts.filter((line) => line.trim().length > 0);
  }
}

function readRange(path: string, start: number, end: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let content = '';
    createReadStream(path, { start, end, encoding: 'utf8' })
      .on('data', (chunk) => { content += chunk; })
      .on('end', () => resolve(content))
      .on('error', reject);
  });
}
