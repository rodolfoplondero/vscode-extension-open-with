import * as path from 'node:path';
import type { WindowsBridge } from './windows';

export const defaultPreloadExtensions = [
  '.docx', '.xlsx', '.pptx', '.pdf', '.odt', '.ods', '.odp', '.rtf',
  '.md', '.txt', '.csv', '.json', '.xml', '.yaml', '.yml',
  '.py', '.html', '.css', '.js', '.ts',
  '.png', '.jpg', '.jpeg', '.svg', '.webp', '.drawio', '.bpmn'
];

export function normalizeExtensions(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value): value is string => typeof value === 'string')
    .map(value => value.trim().toLowerCase().replace(/^\.?/, '.'))
    .filter(value => /^\.[a-z0-9][a-z0-9_-]*$/.test(value)))];
}

type Scan = (extensions: string[], signal: AbortSignal) => Promise<string[]>;

/** One cancellable background pass. Foreground commands pause and drain it. */
export class Preloader {
  private extensions: string[] = [];
  private pending: string[] = [];
  private needsScan = false;
  private paused = false;
  private disposed = false;
  private controller?: AbortController;
  private task?: Promise<void>;

  constructor(private readonly scan: Scan, private readonly bridge: Pick<WindowsBridge, 'list' | 'getCached'>) {}

  restart(extensions: string[]): void {
    this.extensions = normalizeExtensions(extensions);
    this.pending = [];
    this.needsScan = this.extensions.length > 0;
    this.controller?.abort();
    this.start();
  }

  async pause(): Promise<void> {
    this.paused = true;
    this.controller?.abort();
    await this.task;
  }

  resume(): void { this.paused = false; this.start(); }
  dispose(): void { this.disposed = true; this.controller?.abort(); this.pending = []; }

  private start(): void {
    if (this.disposed || this.paused || this.task || (!this.needsScan && this.pending.length === 0)) return;
    const controller = new AbortController();
    this.controller = controller;
    this.task = this.run(controller.signal).catch(() => {
      // A failed background scan must not show a notification or loop forever.
      if (!controller.signal.aborted) this.needsScan = false;
    }).finally(() => {
      this.task = undefined;
      this.controller = undefined;
      if (controller.signal.aborted) this.start();
    });
  }

  private async run(signal: AbortSignal): Promise<void> {
    if (this.needsScan) {
      const files = await this.scan(this.extensions, signal);
      signal.throwIfAborted();
      const representatives = new Map<string, string>();
      for (const file of files) {
        const extension = path.win32.extname(file).toLowerCase();
        if (this.extensions.includes(extension) && !representatives.has(extension)) representatives.set(extension, file);
      }
      this.pending = [...representatives.values()];
      this.needsScan = false;
    }
    while (this.pending.length > 0) {
      signal.throwIfAborted();
      const file = this.pending[0];
      try {
        if (!this.bridge.getCached(file)) await this.bridge.list(file, signal);
      } catch (error) {
        if (signal.aborted) throw error;
        // A single unavailable file or handler does not stop other formats.
      }
      signal.throwIfAborted();
      this.pending.shift();
    }
  }
}
