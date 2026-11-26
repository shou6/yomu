/**
 * 列が多くて本文の幅に収まらない表を、ウィンドウの空きまで広げる。
 * 表の枠（.yomu-table）の左右の margin を負にする。それでも収まらない分は枠の中で横スクロールする。
 * あわせて、短いセルに折り返さない印を付ける。
 * 広げる量の計算と短いセルの判定は reader/tableLayout.ts（単体テスト済み）。
 */
import { isShortCell, wideTableExtension } from '../reader/tableLayout';

/** ウィンドウの縁に残す余白（px） */
const EDGE = 16;

/** 表の幅を、width を一時的に変えて測る */
function measure(table: HTMLTableElement, width: string): number {
  table.style.width = width;
  const result = table.getBoundingClientRect().width;
  table.style.removeProperty('width');
  return result;
}

/** 本文を差し替えた時、ウィンドウの大きさや設定が変わった時に呼ぶ */
export function layoutTables(root: HTMLElement): void {
  const frames = [...root.querySelectorAll<HTMLElement>('.yomu-table')];
  if (frames.length === 0) {
    return;
  }
  // 測る前に、前に広げた分を戻す
  frames.forEach((frame) => {
    frame.style.removeProperty('margin-left');
    frame.style.removeProperty('margin-right');
  });
  // 短いセルに印を付ける。編集で本文を差し替えるたびに付け直す
  root.querySelectorAll<HTMLTableCellElement>('.yomu-table td').forEach((cell) => {
    cell.classList.toggle('yomu-cell-short', isShortCell(cell.textContent ?? ''));
  });
  const viewport = document.documentElement.clientWidth;
  for (const frame of frames) {
    const table = frame.querySelector<HTMLTableElement>(':scope > table');
    // 引用やリストの中の表は、外側の字下げを崩さないよう広げない
    if (table === null || frame.parentElement !== root) {
      continue;
    }
    const rect = frame.getBoundingClientRect();
    const extension = wideTableExtension({
      minWidth: measure(table, 'min-content'),
      maxWidth: measure(table, 'max-content'),
      contentWidth: rect.width,
      leftRoom: rect.left - EDGE,
      rightRoom: viewport - rect.right - EDGE,
    });
    if (extension.left > 0) {
      frame.style.marginLeft = `${-extension.left}px`;
    }
    if (extension.right > 0) {
      frame.style.marginRight = `${-extension.right}px`;
    }
  }
}

/** ウィンドウの大きさが変わったら、広げ直す。1 フレームに 1 回にまとめる */
export function watchTables(root: HTMLElement): void {
  let frame: number | undefined;
  const schedule = (): void => {
    if (frame !== undefined) {
      return;
    }
    frame = requestAnimationFrame(() => {
      frame = undefined;
      layoutTables(root);
    });
  };
  window.addEventListener('resize', schedule);
  // 同梱フォントの読み込みが終わると文字の幅が変わる
  void document.fonts.ready.then(schedule);
}
