/**
 * 本文の左右の余白と最大幅を、リーダーから変えるコマンド（vscode 依存）。
 * 選んだ値は設定（yomu.layout.*）に書き込み、次に開いた時にも使う。判断は layout.ts（単体テスト済み）。
 */
import * as vscode from 'vscode';
import {
  configScope,
  layoutPickItems,
  stepMargin,
  validateLayoutNumber,
  type LayoutKey,
  type LayoutPickItem,
} from './layout';

const SETTING: Record<LayoutKey, string> = {
  margin: 'layout.margin',
  maxWidth: 'layout.maxWidth',
};

/** 設定が無い時の値。package.json の default に合わせる */
const DEFAULTS: Record<LayoutKey, number> = { margin: 10, maxWidth: 0 };

const TARGET = {
  global: vscode.ConfigurationTarget.Global,
  workspace: vscode.ConfigurationTarget.Workspace,
  workspaceFolder: vscode.ConfigurationTarget.WorkspaceFolder,
} as const;

function current(key: LayoutKey): number {
  const value = vscode.workspace.getConfiguration('yomu').get<unknown>(SETTING[key]);
  return typeof value === 'number' && Number.isFinite(value) ? value : DEFAULTS[key];
}

/** 設定に書き込む。ワークスペースやフォルダーで指定していればそちらを書き換える（layout.ts の configScope） */
export function writeLayout(key: LayoutKey, value: number): Thenable<void> {
  const config = vscode.workspace.getConfiguration('yomu');
  const scope = configScope(config.inspect(SETTING[key]) ?? {});
  return config.update(SETTING[key], value, TARGET[scope]);
}

async function askNumber(key: LayoutKey, value: number): Promise<number | undefined> {
  const input = await vscode.window.showInputBox({
    title: key === 'maxWidth' ? vscode.l10n.t('Maximum width') : vscode.l10n.t('Side margins'),
    prompt:
      key === 'maxWidth'
        ? vscode.l10n.t('Maximum width of the body in px. 0 means no limit.')
        : vscode.l10n.t('Left and right margin of the body, as a percentage of the window width.'),
    value: String(value),
    validateInput: (text) => validateLayoutNumber(text, key, vscode.l10n.t),
  });
  return input === undefined ? undefined : Number(input.trim());
}

/** QuickPick で余白か最大幅を選ばせ、設定に書き込む */
async function adjustLayout(): Promise<void> {
  const now = { margin: current('margin'), maxWidth: current('maxWidth') };
  type Item = vscode.QuickPickItem & { source: LayoutPickItem };
  const items: Item[] = layoutPickItems(now, vscode.l10n.t).map((source) =>
    source.separator === true
      ? { label: source.label, kind: vscode.QuickPickItemKind.Separator, source }
      : {
          label: (source.current === true ? '$(check) ' : '$(blank) ') + source.label,
          description: source.description,
          source,
        }
  );
  const picked = await vscode.window.showQuickPick(items, {
    title: vscode.l10n.t('Body width and margins'),
  });
  const key = picked?.source.key;
  const value = picked?.source.value;
  if (key === undefined || value === undefined) {
    return;
  }
  const next = value === 'custom' ? await askNumber(key, now[key]) : value;
  if (next !== undefined && next !== now[key]) {
    await writeLayout(key, next);
  }
}

/** 本文を広げる・狭める。本文の幅はウィンドウから余白を引いた幅なので、余白の割合を変える */
async function step(direction: 'wider' | 'narrower'): Promise<void> {
  const now = current('margin');
  const next = stepMargin(now, direction);
  if (next !== now) {
    await writeLayout('margin', next);
  }
}

export function registerLayoutCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('yomu.adjustLayout', adjustLayout),
    vscode.commands.registerCommand('yomu.widenBody', () => step('wider')),
    vscode.commands.registerCommand('yomu.narrowBody', () => step('narrower'))
  );
}
