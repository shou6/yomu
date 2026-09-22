// markdown-it-anchor 10 の型定義は ESM 扱い（types/package.json の "type": "module"）で、
// CommonJS のこのプロジェクトからは TS1479 で読めない。実行時は CJS の配布物が使えるので、
// 使う範囲だけをここで宣言する（ambient な宣言は node_modules の型より優先される）
declare module 'markdown-it-anchor' {
  import type MarkdownIt from 'markdown-it';

  interface AnchorOptions {
    /** ID を付ける見出しのレベル。既定はすべて */
    level?: number | number[];
    /** 見出しの文字列から ID を作る */
    slugify?: (text: string) => string;
    /** 重複した ID に付ける連番の開始値。既定は 1 */
    uniqueSlugStartIndex?: number;
    /** 見出しに tabindex を付ける。false で付けない */
    tabIndex?: number | false;
  }

  const anchor: (md: MarkdownIt.MarkdownIt, options?: AnchorOptions) => void;
  export default anchor;
}
