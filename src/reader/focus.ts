/**
 * 集中モードで濃く表示するブロックを決める（純粋関数）。Webview 側から使う。
 */

/** 読んでいる位置。画面の上端からの割合 */
export const FOCUS_ANCHOR = 0.4;

export interface BlockRange {
  top: number;
  bottom: number;
}

/**
 * anchorY の高さにあるブロックの番号。ブロックの間の隙間なら近い方。ブロックが無ければ -1。
 * @param blocks 上から順に並んだブロックの上端と下端（画面の座標）
 */
export function focusedIndex(blocks: readonly BlockRange[], anchorY: number): number {
  let best = -1;
  let bestDistance = Infinity;
  blocks.forEach((block, index) => {
    const distance =
      anchorY < block.top
        ? block.top - anchorY
        : anchorY > block.bottom
          ? anchorY - block.bottom
          : 0;
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}
