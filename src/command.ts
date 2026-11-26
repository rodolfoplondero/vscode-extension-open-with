import type { App, WindowsBridge } from './windows';
import * as path from 'node:path';

export interface FileTarget { scheme: string; fsPath: string }
export type Choice = { kind: 'app'; app: App } | { kind: 'native' } | { kind: 'refresh' };
type Bridge = Pick<WindowsBridge, 'list' | 'open' | 'native'> & Partial<Pick<WindowsBridge, 'getCached' | 'invalidate'>>;
export interface Host {
  platform: string;
  activeFile(): FileTarget | undefined;
  isFile(filePath: string): Promise<boolean>;
  prepareFile(target: FileTarget): Promise<boolean>;
  pick(apps: App[], filePath: string): Promise<Choice | undefined>;
  progress<T>(task: (signal: AbortSignal) => Promise<T>): Promise<T>;
  offerNative(message: string): Promise<boolean>;
  error(message: string): Promise<void>;
}
export type Status = 'opened' | 'cancelled' | 'unsupported' | 'invalid' | 'failed';
export async function runOpenExternal(
  host: Host, bridge: Bridge, target?: FileTarget
): Promise<Status> {
  try {
    if (host.platform !== 'win32') {
      await host.error('This extension is available on Windows only.');
      return 'unsupported';
    }
    const file = target ?? host.activeFile();
    if (!file || file.scheme !== 'file') {
      await host.error('Select a saved local file on Windows. Remote files and untitled documents are not supported.');
      return 'invalid';
    }
    if (!await host.isFile(file.fsPath)) {
      await host.error('The selected item is not an accessible file. Select a file instead of a folder.');
      return 'invalid';
    }
    if (!await host.prepareFile(file)) return 'cancelled';
    while (true) {
      let apps: App[];
      try {
        apps = bridge.getCached?.(file.fsPath) ?? await host.progress(signal => bridge.list(file.fsPath, signal));
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
        const detail = error instanceof Error ? error.message : String(error);
        if (!await host.offerNative(`Could not query Windows applications: ${detail}`)) return 'cancelled';
        await bridge.native(file.fsPath);
        return 'opened';
      }
      if (apps.length === 0) {
        const message = path.win32.extname(file.fsPath).toLowerCase() === '.docx'
          ? 'No recognized DOCX editors were found. Choose an application using Windows.'
          : 'No recommended applications were found for this file type. Choose an application using Windows.';
        if (!await host.offerNative(message)) return 'cancelled';
        await bridge.native(file.fsPath);
        return 'opened';
      }
      const choice = await host.pick(apps, file.fsPath);
      if (!choice) return 'cancelled';
      if (choice.kind === 'refresh') {
        bridge.invalidate?.(file.fsPath);
        continue;
      }
      if (choice.kind === 'native') await bridge.native(file.fsPath);
      else {
        try { await bridge.open(file.fsPath, choice.app.id); }
        catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          if (!await host.offerNative(`Could not open the file with ${choice.app.name}: ${detail}`)) return 'cancelled';
          await bridge.native(file.fsPath);
        }
      }
      return 'opened';
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await host.error(`Could not open the file: ${detail}`);
    return 'failed';
  }
}
