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
  /** コードの font-family。空なら欧文の等幅フォント、和文は VS Code の editor.fontFamily */
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
  maxWidth: 820,
  align: 'center',
  padding: 32,
  // 欧文フォントを先に並べ、欧文フォントに無い和文は後ろの和文フォントで描く（和欧の出し分け）。
  // 和文は同梱フォント（media/fonts.css で登録）なので、どの OS でも同じ見た目になる。
  // 既定値（幅 820、16px、Noto Sans JP）は開発者が設定で比べて決めた（実装計画のフェーズ 9.5）
  fontFamily:
    "'Segoe UI', 'Helvetica Neue', Helvetica, Arial, 'Noto Sans JP', 'BIZ UDPGothic', sans-serif",
  codeFontFamily: '',
  fontSize: 16,
  lineHeight: 1.8,
  customCss: '',
};

/**
 * コードのフォントを指定しない時の値。欧文の等幅フォントを先に置き、和文だけエディタのフォントで描く。
 * 罫線（─ │ ┌）や三角（▶ ▼）は東アジアの文字幅が曖昧な文字で、和文の等幅フォント（HackGen など）は
 * 1.5〜2 文字幅で描くため、半角前提で書かれたテキストの図がずれる。欧文の等幅フォントなら ASCII と同じ幅になる
 */
const CODE_FONT_FALLBACK =
  "'Cascadia Mono', Consolas, Menlo, 'DejaVu Sans Mono', 'Liberation Mono', var(--vscode-editor-font-family, monospace), monospace";

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
