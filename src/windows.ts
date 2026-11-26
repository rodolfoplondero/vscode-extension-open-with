import { spawn, SpawnOptions, ChildProcess } from 'node:child_process';
import * as path from 'node:path';
import { isCompatibleHandler } from './compatibility';

export interface App { id: string; name: string; recommended: boolean }
export interface BridgeRequest { action: 'list' | 'open' | 'native'; filePath: string; handlerId?: string }
export type Runner = (request: BridgeRequest, signal?: AbortSignal) => Promise<string>;
type Spawner = (command: string, args: string[], options: SpawnOptions) => ChildProcess;

export function createPowerShellRunner(extensionPath: string, spawnProcess: Spawner = spawn): Runner {
  return (request, signal) => new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    // Only the packaged script is executable text. File paths and IDs go through stdin.
    const systemRoot = process.env.SystemRoot || 'C:\\Windows';
    const executable = path.win32.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const child = spawnProcess(executable, [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-Sta', '-ExecutionPolicy', 'Bypass',
      '-File', path.join(extensionPath, 'scripts', 'bridge.ps1')
    ], {
      shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
      timeout: request.action === 'native' ? 0 : 30_000, signal
    });
    let stdout = '', stderr = '', length = 0;
    let cancellation: Error | undefined;
    child.on('error', error => {
      // On abort, Node emits error before close. Drain before the next query.
      if (error.name === 'AbortError') cancellation = error;
      else reject(error);
    });
    child.stdin?.on('error', error => { if (!signal?.aborted) reject(error); });
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    const collect = (chunk: string, errorStream: boolean) => {
      length += Buffer.byteLength(chunk);
      if (length > 4 * 1024 * 1024) {
        child.kill();
        reject(new Error('The Windows response exceeded the size limit.'));
        return;
      }
      if (errorStream) stderr += chunk; else stdout += chunk;
    };
    child.stdout?.on('data', chunk => collect(chunk, false));
    child.stderr?.on('data', chunk => collect(chunk, true));
    child.on('close', (code, signal) => {
      if (cancellation) { reject(cancellation); return; }
      if (code !== 0) {
        reject(new Error(signal
          ? 'The Windows query was interrupted or exceeded 30 seconds.'
          : (stderr.trim() || `PowerShell exited with code ${code}.`)));
      } else resolve(stdout.replace(/^\uFEFF/, '').trim());
    });
    child.stdin?.end(JSON.stringify(request), 'utf8');
  });
}

export class WindowsBridge {
  private readonly run: Runner;
  private readonly cache = new Map<string, { apps: App[]; savedAt: number }>();
  constructor(
    extensionPath: string, runner?: Runner,
    private readonly cacheMinutes: () => number = () => 0,
    private readonly now: () => number = Date.now
  ) {
    this.run = runner ?? createPowerShellRunner(extensionPath);
  }
  getCached(filePath: string): App[] | undefined {
    const key = path.win32.extname(filePath).toLowerCase();
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    const minutes = this.cacheMinutes();
    if (!Number.isFinite(minutes) || minutes <= 0 || this.now() - entry.savedAt >= minutes * 60_000) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.apps.map(app => ({ ...app }));
  }
  invalidate(filePath: string): void {
    this.cache.delete(path.win32.extname(filePath).toLowerCase());
  }
  clearCache(): void { this.cache.clear(); }
  async list(filePath: string, signal?: AbortSignal): Promise<App[]> {
    signal?.throwIfAborted();
    const cached = this.getCached(filePath);
    if (cached) return cached;
    let parsed: unknown;
    try {
      const response = await this.run({ action: 'list', filePath }, signal);
      signal?.throwIfAborted();
      parsed = JSON.parse(response);
    }
    catch (error) {
      if (error instanceof SyntaxError) throw new Error('Invalid response from Windows.');
      throw error;
    }
    if (!Array.isArray(parsed) || parsed.some(item =>
      !item || typeof item.id !== 'string' || !item.id ||
      typeof item.name !== 'string' || !item.name || typeof item.recommended !== 'boolean')) {
      throw new Error('Invalid response from Windows.');
    }
    const unique = new Map<string, App>();
    for (const item of parsed as App[]) {
      if (item.recommended && isCompatibleHandler(filePath, item.id) && !unique.has(item.id)) unique.set(item.id, item);
    }
    const apps = [...unique.values()].sort((a, b) =>
      Number(b.recommended) - Number(a.recommended) || a.name.localeCompare(b.name, 'en') || a.id.localeCompare(b.id));
    const key = path.win32.extname(filePath).toLowerCase();
    const minutes = this.cacheMinutes();
    if (key && apps.length > 0 && Number.isFinite(minutes) && minutes > 0) {
      this.cache.set(key, { apps: apps.map(app => ({ ...app })), savedAt: this.now() });
    }
    return apps;
  }
  async open(filePath: string, handlerId: string): Promise<void> {
    try {
      if (!isCompatibleHandler(filePath, handlerId)) {
        throw new Error('The selected application is not a recognized DOCX document editor.');
      }
      await this.run({ action: 'open', filePath, handlerId });
    } catch (error) {
      this.invalidate(filePath);
      throw error;
    }
  }
  async native(filePath: string): Promise<void> {
    try { await this.run({ action: 'native', filePath }); }
    finally { this.invalidate(filePath); }
  }
}
