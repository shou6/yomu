/** 拡張機能と Webview の間で送るメッセージ。両側から import する（型だけ） */

import type { Theme } from './readerSettings';

/** 拡張機能 → Webview */
export type ToWebview =
  /** 本文の差し替え */
  | { type: 'update'; html: string }
  /** 設定の反映。CSS 変数とテーマ名。カスタム CSS があればその Webview URI */
  | { type: 'settings'; theme: Theme; cssVariables: Record<string, string>; customCssUri?: string };

/** Webview → 拡張機能 */
export type FromWebview = { type: 'openLink'; href: string };
