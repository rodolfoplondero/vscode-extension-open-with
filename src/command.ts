import type { App, WindowsBridge } from './windows';
import * as path from 'node:path';

export interface FileTarget { scheme: string; fsPath: string }
export type Choice = { kind: 'app'; app: App } | { kind: 'native' };
type Bridge = Pick<WindowsBridge, 'list' | 'open' | 'native'> & Partial<Pick<WindowsBridge, 'peek' | 'getCached'>>;
/** A picker that stays open while applications arrive. Closing it resolves `result` with undefined. */
export interface PickerSession {
  result: Promise<Choice | undefined>;
  setApps(apps: App[]): void;
  setBusy(busy: boolean): void;
  hide(): void;
}
export interface Host {
  platform: string;
  activeFile(): FileTarget | undefined;
  isFile(filePath: string): Promise<boolean>;
  prepareFile(target: FileTarget): Promise<boolean>;
  openPicker(filePath: string, apps: App[], busy: boolean, onRefresh: () => void): PickerSession;
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
    const fresh = bridge.peek ? undefined : bridge.getCached?.(file.fsPath);
    const known = bridge.peek?.(file.fsPath) ?? (fresh ? { apps: fresh, stale: false } : undefined);
    let apps = known?.apps ?? [];
    let finished = false;
    let unavailable: { detail?: string } | undefined;
    // Without a signal the query keeps running if the picker closes, so it still fills the cache.
    const load = (force: boolean) => {
      session.setBusy(true);
      bridge.list(file.fsPath, undefined, force).then(list => {
        if (finished) return;
        if (list.length > 0) { apps = list; session.setApps(list); }
        else if (apps.length === 0) { unavailable = {}; session.hide(); return; }
        session.setBusy(false);
      }, error => {
        if (finished) return;
        // A list already on screen stays usable; only an empty picker reports the failure.
        const detail = error instanceof Error ? error.message : String(error);
        if (apps.length === 0) { unavailable = { detail }; session.hide(); return; }
        session.setBusy(false);
        if (force) void host.error(`Could not refresh the applications: ${detail}`);
      });
    };
    const session = host.openPicker(file.fsPath, apps, !known || known.stale, () => load(true));
    const result = session.result.then(value => { finished = true; return value; });
    if (!known || known.stale) load(false);
    const choice = await result;
    if (unavailable) {
      const message = unavailable.detail !== undefined
        ? `Could not query Windows applications: ${unavailable.detail}`
        : path.win32.extname(file.fsPath).toLowerCase() === '.docx'
          ? 'No recognized DOCX editors were found. Choose an application using Windows.'
          : 'No recommended applications were found for this file type. Choose an application using Windows.';
      if (!await host.offerNative(message)) return 'cancelled';
      await bridge.native(file.fsPath);
      return 'opened';
    }
    if (!choice) return 'cancelled';
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
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await host.error(`Could not open the file: ${detail}`);
    return 'failed';
  }
}
