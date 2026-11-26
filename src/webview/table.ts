/**
 * 表の短いセルに、折り返さない印（yomu-cell-short）を付ける。
 * 和文はどの文字の間でも折れるので、列が多いと名前などの短い語まで縦に割れる。短いセルは 1 行に保つ。
 * 判定は reader/tableLayout.ts（単体テスト済み）。
 */
import { isShortCell } from '../reader/tableLayout';

/** 本文を差し替えた時に呼ぶ */
export function markTableCells(root: HTMLElement): void {
  root.querySelectorAll<HTMLTableCellElement>('.yomu-table td').forEach((cell) => {
    cell.classList.toggle('yomu-cell-short', isShortCell(cell.textContent ?? ''));
  });
}
