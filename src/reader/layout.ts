/**
 * 本文の幅と左右の余白を、リーダーから変える操作の判断部分（純粋関数）。
 * 値は設定（yomu.layout.maxWidth と yomu.layout.padding）に書き込む。書き込みと QuickPick の表示は extension.ts が行う。
 */
import type { Translate } from './openInReader';

export type LayoutKey = 'maxWidth' | 'padding';

/** 「本文を広げる／狭める」で順に移る幅（px）。一番広い段階より広げると制限なし（0） */
const WIDTH_STEPS = [560, 680, 820, 1000, 1200] as const;

/** 設定で受け付ける範囲。package.json の minimum と maximum に合わせる */
const LIMITS: Record<LayoutKey, { min: number; max: number }> = {
  maxWidth: { min: 0, max: 10000 },
  padding: { min: 0, max: 1000 },
};

/** 幅を 1 段階広げる、または狭める。0 は制限なし */
export function stepWidth(current: number, direction: 'wider' | 'narrower'): number {
  if (direction === 'wider') {
    if (current === 0) {
      return 0;
    }
    return WIDTH_STEPS.find((step) => step > current) ?? 0;
  }
  if (current === 0) {
    return WIDTH_STEPS[WIDTH_STEPS.length - 1];
  }
  return [...WIDTH_STEPS].reverse().find((step) => step < current) ?? current;
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

function choice(
  key: LayoutKey,
  value: number,
  label: string,
  description: string,
  currentValue: number
): LayoutPickItem {
  return { key, value, label, description, current: value === currentValue };
}

function customChoice(
  key: LayoutKey,
  presets: readonly number[],
  currentValue: number,
  t: Translate
): LayoutPickItem {
  const current = !presets.includes(currentValue);
  return {
    key,
    value: 'custom',
    label: t('Enter a number...'),
    ...(current ? { description: t('{0}px', String(currentValue)), current } : {}),
  };
}

/** QuickPick「本文の幅と余白」の項目 */
export function layoutPickItems(
  current: { maxWidth: number; padding: number },
  t: Translate
): LayoutPickItem[] {
  const px = (value: number): string => t('{0}px', String(value));
  const widths = [
    choice('maxWidth', 680, t('Narrow'), px(680), current.maxWidth),
    choice('maxWidth', 820, t('Standard'), px(820), current.maxWidth),
    choice('maxWidth', 1000, t('Wide'), px(1000), current.maxWidth),
    choice('maxWidth', 1200, t('Extra wide'), px(1200), current.maxWidth),
    choice('maxWidth', 0, t('No limit'), t('Fill the window'), current.maxWidth),
  ];
  const paddings = [
    choice('padding', 0, t('None'), px(0), current.padding),
    choice('padding', 16, t('Narrow'), px(16), current.padding),
    choice('padding', 32, t('Standard'), px(32), current.padding),
    choice('padding', 64, t('Wide'), px(64), current.padding),
  ];
  return [
    { label: t('Body width'), separator: true },
    ...widths,
    customChoice('maxWidth', [680, 820, 1000, 1200, 0], current.maxWidth, t),
    { label: t('Side margins'), separator: true },
    ...paddings,
    customChoice('padding', [0, 16, 32, 64], current.padding, t),
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
