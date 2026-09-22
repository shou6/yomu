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
