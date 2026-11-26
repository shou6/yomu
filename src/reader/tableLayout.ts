/**
 * 表のセルの判定（純粋関数）。Webview 側（webview/table.ts）から使う。
 */

/** これ以下の文字数のセルは折り返さない */
const SHORT_CELL_LENGTH = 12;

/**
 * 折り返さないセルか。和文はどの文字の間でも折れるので、列が多いと名前などの短い語まで
 * 「サン／プル／ホー／ス」のように割れる。短いセルは 1 行に保ち、長い文のセルだけを折り返す
 */
export function isShortCell(text: string): boolean {
  return [...text.trim()].length <= SHORT_CELL_LENGTH;
}
