/**
 * 集中モードで濃く表示するブロックを決める（純粋関数）。Webview 側から使う。
 *
 * 最初は「画面の上から 4 割の高さの 1 本の線」に掛かるブロックだけを濃くしていた。
 * ホイール 1 目盛りで画面は約 100px 動くので、高さ 30〜50px のリストの項目などが線を通り過ぎ、
 * 一度も濃くならなかった。線の代わりに、1 目盛りより高い帯を使う。
 */

/** 読んでいる範囲。画面の上端からの割合（高さ 800px の画面なら 240〜440px の 200px） */
export const FOCUS_BAND = { top: 0.3, bottom: 0.55 } as const;

export interface Range {
  top: number;
  bottom: number;
}

/**
 * 帯に掛かっているブロックの番号（上から順）。帯に何も掛かっていなければ、帯の中央に一番近いもの 1 つ。
 * ブロックが無ければ空。
 * @param blocks 上から順に並んだブロックの上端と下端（画面の座標）
 * @param band 帯の上端と下端（画面の座標）
 */
export function focusedIndices(blocks: readonly Range[], band: Range): number[] {
  const inBand = blocks.flatMap((block, index) =>
    block.bottom >= band.top && block.top <= band.bottom ? [index] : []
  );
  if (inBand.length > 0 || blocks.length === 0) {
    return inBand;
  }
  const center = (band.top + band.bottom) / 2;
  let best = 0;
  let bestDistance = Infinity;
  blocks.forEach((block, index) => {
    const distance =
      center < block.top ? block.top - center : center > block.bottom ? center - block.bottom : 0;
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return [best];
}
