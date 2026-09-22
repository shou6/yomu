/**
 * リーダーで今読んでいる箇所の、元の Markdown の行番号を決める（純粋関数）。Webview 側から使う。
 * 本文の要素には、変換の時に元の行番号（data-line）を付けてある（render.ts）。
 */

export interface LineBlock {
  /** 元の Markdown の行番号（0 始まり） */
  line: number;
  top: number;
  bottom: number;
}

/**
 * 基準の高さに掛かっている要素の行。要素の間の隙間なら、その下の要素の行。
 * 全部より下なら最後の要素の行、要素が無ければ 0。
 * @param blocks 上から順に並んだ要素（画面の座標）
 * @param threshold 基準の高さ（画面の座標）
 */
export function readingLine(blocks: readonly LineBlock[], threshold: number): number {
  const reading = blocks.find((block) => block.bottom >= threshold);
  return (reading ?? blocks[blocks.length - 1])?.line ?? 0;
}
