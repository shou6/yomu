/** 拡張機能と Webview の間で送るメッセージ。両側から import する（型だけ） */

import type { Theme } from './readerSettings';

/** 拡張機能 → Webview */
export type ToWebview =
  /** 本文の差し替え */
  | { type: 'update'; html: string }
  /** 設定の反映。CSS 変数とテーマ名。カスタム CSS があればその Webview URI */
  | {
      type: 'settings';
      theme: Theme;
      cssVariables: Record<string, string>;
      customCssUri?: string;
      /** 集中モード */
      focusMode: boolean;
      /** これより長いコードブロックを畳む（行）。0 なら畳まない */
      foldLines: number;
      /** 折りたたみのボタンの文言（翻訳済み）。expand の {0} は行数 */
      foldLabels: { expand: string; collapse: string };
    };

/** Webview → 拡張機能 */
export type FromWebview =
  /** スクリプトの読み込みが終わった。タブを隠して戻した時にも Webview が作り直されて再び送られる */
  { type: 'ready' } | { type: 'openLink'; href: string };
