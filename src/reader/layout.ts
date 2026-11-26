/**
 * 本文の左右の余白と最大幅を、リーダーから変える操作の判断部分（純粋関数）。
 * 本文の幅はウィンドウの幅から左右の余白を引いた幅で、余白はウィンドウの幅に対する割合で決める。
 * 値は設定（yomu.layout.margin と yomu.layout.maxWidth）に書き込む。書き込みと QuickPick の表示は layoutCommands.ts が行う。
 */
import type { Translate } from './openInReader';

export type LayoutKey = 'margin' | 'maxWidth';

/** 「本文を広げる／狭める」で順に移る、左右の余白の割合（%） */
const MARGIN_STEPS = [0, 5, 10, 15, 20, 25, 30] as const;

/** QuickPick に並べる値 */
const MARGIN_PRESETS = [0, 5, 10, 15, 20] as const;
/** 0 は制限なし */
const MAX_WIDTH_PRESETS = [0, 820, 1000, 1200, 1600] as const;

/** 設定で受け付ける範囲。package.json の minimum と maximum に合わせる */
const LIMITS: Record<LayoutKey, { min: number; max: number }> = {
  margin: { min: 0, max: 40 },
  maxWidth: { min: 0, max: 10000 },
};

/** 本文を 1 段階広げる（余白を小さくする）、または狭める（余白を大きくする） */
export function stepMargin(current: number, direction: 'wider' | 'narrower'): number {
  if (direction === 'wider') {
    return [...MARGIN_STEPS].reverse().find((step) => step < current) ?? current;
  }
  return MARGIN_STEPS.find((step) => step > current) ?? current;
}

export type ConfigScope = 'global' | 'workspace' | 'workspaceFolder';

/**
 * 書き込む先。ワークスペースやフォルダーの設定で値を指定していると、ユーザー設定に書いても効かないので、そちらを書き換える。
 * @param inspect WorkspaceConfiguration.inspect の結果
 */
export function configScope(inspect: {
  workspaceValue?: unknown;
  workspaceFolderValue?: unknown;
}): ConfigScope {
  if (inspect.workspaceFolderValue !== undefined) {
    return 'workspaceFolder';
  }
  return inspect.workspaceValue !== undefined ? 'workspace' : 'global';
}

export interface LayoutPickItem {
  label: string;
  description?: string;
  /** 見出し（選べない区切り） */
  separator?: boolean;
  key?: LayoutKey;
  /** 設定する値。custom は数値を入力してもらう */
  value?: number | 'custom';
  /** 今の値 */
  current?: boolean;
}

/** QuickPick「本文の幅と余白」の項目 */
export function layoutPickItems(
  current: { margin: number; maxWidth: number },
  t: Translate
): LayoutPickItem[] {
  const percent = (value: number): string => t('{0}%', String(value));
  const px = (value: number): string => t('{0}px', String(value));
  const describe: Record<LayoutKey, (value: number) => string> = { margin: percent, maxWidth: px };
  const choice = (key: LayoutKey, value: number, label: string, description: string) => ({
    key,
    value,
    label,
    description,
    current: value === current[key],
  });
  const custom = (key: LayoutKey, presets: readonly number[]): LayoutPickItem => {
    const isCurrent = !presets.includes(current[key]);
    return {
      key,
      value: 'custom',
      label: t('Enter a number...'),
      ...(isCurrent ? { description: describe[key](current[key]), current: true } : {}),
    };
  };
  return [
    { label: t('Side margins'), separator: true },
    choice('margin', 0, t('None'), percent(0)),
    choice('margin', 5, t('Narrow'), percent(5)),
    choice('margin', 10, t('Standard'), percent(10)),
    choice('margin', 15, t('Wide'), percent(15)),
    choice('margin', 20, t('Extra wide'), percent(20)),
    custom('margin', MARGIN_PRESETS),
    { label: t('Maximum width'), separator: true },
    choice('maxWidth', 0, t('No limit'), t('Follow the window width')),
    choice('maxWidth', 820, t('Narrow'), px(820)),
    choice('maxWidth', 1000, t('Standard'), px(1000)),
    choice('maxWidth', 1200, t('Wide'), px(1200)),
    choice('maxWidth', 1600, t('Extra wide'), px(1600)),
    custom('maxWidth', MAX_WIDTH_PRESETS),
  ];
}

/** 数値の入力を検査する。受け付けるなら undefined、受け付けないなら理由 */
export function validateLayoutNumber(
  input: string,
  key: LayoutKey,
  t: Translate
): string | undefined {
  const { min, max } = LIMITS[key];
  const text = input.trim();
  const value = Number(text);
  if (text === '' || !/^-?\d+$/.test(text) || value < min || value > max) {
    return t('Enter a whole number from {0} to {1}.', String(min), String(max));
  }
  return undefined;
}
