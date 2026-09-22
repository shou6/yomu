/**
 * 設定（yomu.*）の値を検査し、Webview に渡す CSS 変数とテーマ名に変換する（純粋関数）。
 * 設定の読み取り（vscode.workspace.getConfiguration）は Provider が行い、ここには生の値だけを渡す。
 */

export const THEMES = ['paper', 'sepia', 'dark', 'vscode'] as const;
export type Theme = (typeof THEMES)[number];

export const ALIGNS = ['left', 'center', 'right'] as const;
export type Align = (typeof ALIGNS)[number];

export interface ReaderSettings {
  theme: Theme;
  /** 本文の最大幅（px）。0 で制限なし */
  maxWidth: number;
  align: Align;
  /** 本文の左右の余白（px） */
  padding: number;
  /** CSS の font-family の値 */
  fontFamily: string;
  /** コードの font-family。空なら VS Code の editor.fontFamily に従う */
  codeFontFamily: string;
  /** 本文の文字の大きさ（px） */
  fontSize: number;
  lineHeight: number;
  /** カスタム CSS のパス。空なら無し */
  customCss: string;
}

/** 設定から読んだままの値。型は信用しない */
export type RawSettings = Partial<Record<keyof ReaderSettings, unknown>>;

export const DEFAULT_SETTINGS: ReaderSettings = {
  theme: 'paper',
  maxWidth: 960,
  align: 'center',
  padding: 32,
  // 欧文フォントを先に並べ、欧文フォントに無い和文は後ろの和文フォントで描く（和欧の出し分け）。
  // 同梱フォントは実装計画のフェーズ 8 で先頭に足す
  fontFamily:
    "'Segoe UI', 'Helvetica Neue', Helvetica, Arial, 'Yu Gothic UI', Meiryo, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans CJK JP', 'Noto Sans JP', sans-serif",
  codeFontFamily: '',
  fontSize: 15,
  lineHeight: 1.8,
  customCss: '',
};

/** コードのフォントを指定しない時の値。VS Code のエディタのフォントに従う */
const CODE_FONT_FALLBACK = 'var(--vscode-editor-font-family, Consolas, monospace)';

function oneOf<T extends string>(value: unknown, choices: readonly T[], fallback: T): T {
  return typeof value === 'string' && (choices as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function numberIn(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : fallback;
}

/** CSS のプロパティ値にそのまま入れる文字列。宣言を閉じたり別の規則を始めたりできる文字は受け付けない */
function cssValue(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed === '' || /[;{}]/.test(trimmed) ? fallback : trimmed;
}

export function normalizeSettings(raw: RawSettings): ReaderSettings {
  return {
    theme: oneOf(raw.theme, THEMES, DEFAULT_SETTINGS.theme),
    maxWidth: numberIn(raw.maxWidth, 0, 10000, DEFAULT_SETTINGS.maxWidth),
    align: oneOf(raw.align, ALIGNS, DEFAULT_SETTINGS.align),
    padding: numberIn(raw.padding, 0, 1000, DEFAULT_SETTINGS.padding),
    fontFamily: cssValue(raw.fontFamily, DEFAULT_SETTINGS.fontFamily),
    codeFontFamily: cssValue(raw.codeFontFamily, DEFAULT_SETTINGS.codeFontFamily),
    fontSize: numberIn(raw.fontSize, 8, 72, DEFAULT_SETTINGS.fontSize),
    lineHeight: numberIn(raw.lineHeight, 1, 3, DEFAULT_SETTINGS.lineHeight),
    customCss: typeof raw.customCss === 'string' ? raw.customCss.trim() : '',
  };
}

/** Webview の :root に設定する CSS 変数 */
export function cssVariables(settings: ReaderSettings): Record<string, string> {
  return {
    '--yomu-max-width': settings.maxWidth === 0 ? 'none' : `${settings.maxWidth}px`,
    '--yomu-margin-left': settings.align === 'left' ? '0' : 'auto',
    '--yomu-margin-right': settings.align === 'right' ? '0' : 'auto',
    '--yomu-padding': `${settings.padding}px`,
    '--yomu-font-family': settings.fontFamily,
    '--yomu-code-font-family':
      settings.codeFontFamily === '' ? CODE_FONT_FALLBACK : settings.codeFontFamily,
    '--yomu-font-size': `${settings.fontSize}px`,
    '--yomu-line-height': String(settings.lineHeight),
  };
}
