/**
 * Yomu のテーマに合わせて mermaid のテーマを選ぶ（純粋関数）。Webview 側から使う。
 */
import type { Theme } from './readerSettings';

/** mermaid が持つテーマのうち、使うもの */
export type MermaidTheme = 'default' | 'neutral' | 'dark';

/**
 * @param theme Yomu のテーマ
 * @param vscodeIsDark VS Code のカラーテーマが暗いか（body に vscode-dark か vscode-high-contrast が付いている）
 */
export function mermaidTheme(theme: Theme, vscodeIsDark: boolean): MermaidTheme {
  switch (theme) {
    case 'paper':
      return 'default';
    case 'sepia':
      return 'neutral';
    case 'dark':
      return 'dark';
    case 'vscode':
      return vscodeIsDark ? 'dark' : 'default';
  }
}

/** mermaid.initialize に渡す設定のうち、Yomu が決めるもの */
export interface MermaidConfig {
  startOnLoad: false;
  /** 図の中のクリック処理と HTML を無効にする */
  securityLevel: 'strict';
  theme: MermaidTheme;
  gantt: {
    /** 描く幅（px）。undefined なら mermaid が枠の幅を読む */
    useWidth: number | undefined;
    fontSize: number;
    sectionFontSize: number;
    barHeight: number;
  };
}

/**
 * @param theme Yomu のテーマ
 * @param width 図を置く枠の幅（px）。mermaid は画面の外の仮の枠で描くので、そのままでは幅が取れず 1200px で描いてしまう
 * @param vscodeIsDark VS Code のカラーテーマが暗いか（vscode テーマの時だけ効く）
 */
export function mermaidConfig(theme: Theme, width: number, vscodeIsDark = false): MermaidConfig {
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    theme: mermaidTheme(theme, vscodeIsDark),
    // ガントチャートは既定の文字が 11px と小さい。本文の幅ちょうどで描き、縮めずに表示できるようにする
    gantt: {
      useWidth: width > 0 ? Math.round(width) : undefined,
      fontSize: 14,
      sectionFontSize: 14,
      barHeight: 24,
    },
  };
}
