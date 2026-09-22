/**
 * Webview に読み込む CSS の一覧（media/ からの相対パス）。
 * テーマは全部読み込み、body の data-theme で切り替える。
 * vscode.css は最後に置く。ハイコントラストの上書き（body.vscode-high-contrast）が他のテーマより後に来るようにするため
 */
import { THEMES } from './readerSettings';

export const STYLE_FILES: readonly string[] = [
  'fonts.css',
  'reader.css',
  'highlight.css',
  ...THEMES.filter((theme) => theme !== 'vscode').map((theme) => `themes/${theme}.css`),
  'themes/vscode.css',
];
