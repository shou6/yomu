/**
 * 本文の幅に収まらない表を、ウィンドウの空きまで広げる量の計算（純粋関数）。Webview 側から使う。
 * 広げた分は表の枠（.yomu-table）の負の margin にする。それでも収まらない分は枠の中で横スクロールする。
 */

export interface TableSpace {
  /** 表の最小の幅（min-content）。これが本文の幅を超える時だけ広げる */
  minWidth: number;
  /** 表が望む幅（max-content）。ここまで広げれば、セルを折り返さずに済む */
  maxWidth: number;
  /** 本文の幅 */
  contentWidth: number;
  /** 本文の左右に使える空き（ウィンドウの縁の余白を除く） */
  leftRoom: number;
  rightRoom: number;
}

/** 左右へ広げる量（px、0 以上） */
export function wideTableExtension(space: TableSpace): { left: number; right: number } {
  const leftRoom = Math.max(0, space.leftRoom);
  const rightRoom = Math.max(0, space.rightRoom);
  if (space.minWidth <= space.contentWidth) {
    return { left: 0, right: 0 };
  }
  const extra = Math.max(space.maxWidth, space.minWidth) - space.contentWidth;
  // まず左右へ均等に、片側の空きが足りなければ残りをもう片側から取る
  let left = Math.min(extra / 2, leftRoom);
  const right = Math.min(extra - left, rightRoom);
  left = Math.min(extra - right, leftRoom);
  return { left, right };
}

/** これ以下の文字数のセルは折り返さない */
const SHORT_CELL_LENGTH = 12;

/**
 * 折り返さないセルか。和文はどの文字の間でも折れるので、列が多いと名前などの短い語まで
 * 「サン／プル／ホー／ス」のように割れる。短いセルは 1 行に保ち、長い文のセルだけを折り返す
 */
export function isShortCell(text: string): boolean {
  return [...text.trim()].length <= SHORT_CELL_LENGTH;
}
