/** 拡張機能と Webview の間で送るメッセージ。両側から import する（型だけ） */

import type { Theme } from './readerSettings';

/** 拡張機能 → Webview */
export type ToWebview =
  /** 本文の差し替え */
  | {
      type: 'update';
      html: string;
      /** 新しく開いた時に、この割合（0〜1）の位置から再開する。読書の記録が無ければ付けない */
      resume?: number;
    }
  /** 印刷用に、描いた Mermaid の SVG を返してほしい */
  | { type: 'export' }
  /** 目次で選んだ見出しへ移動する */
  | { type: 'scrollTo'; id: string }
  /** 今読んでいる箇所の、元の Markdown の行番号を返してほしい */
  | { type: 'requestLine' }
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
  | { type: 'ready' }
  | { type: 'openLink'; href: string }
  /** export への返事。Mermaid の枠ごとの SVG（描けていない枠は null） */
  | { type: 'exported'; mermaid: (string | null)[] }
  /** 今読んでいる見出しの id が変わった。最初の見出しより上なら null */
  | { type: 'position'; id: string | null }
  /** 読んだ位置の割合（0〜1）が変わった */
  | { type: 'progress'; value: number }
  /** requestLine への返事 */
  | { type: 'line'; line: number };
