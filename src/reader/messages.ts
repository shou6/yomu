/** 拡張機能と Webview の間で送るメッセージ。両側から import する（型だけ） */

/** 拡張機能 → Webview */
export type ToWebview = { type: 'update'; html: string };

/** Webview → 拡張機能 */
export type FromWebview = { type: 'openLink'; href: string };
