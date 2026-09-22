/**
 * 長いコードブロックを畳む。設定 yomu.code.foldLines より長いコードは、その行数の高さで表示し、
 * 下端をぼかして「全 N 行を表示」のボタンを出す。判定は reader/fold.ts（単体テスト済み）。
 */
import { countLines, shouldFold } from '../reader/fold';

export interface FoldOptions {
  foldLines: number;
  labels: { expand: string; collapse: string };
}

let options: FoldOptions | undefined;
/** 開いたコードブロックの番号。編集で本文を差し替えても、開いたままにする */
const expanded = new Set<number>();

/** 畳む対象のコードブロック。Mermaid のソースとエラー表示は除く */
function codeBlocks(root: HTMLElement): HTMLPreElement[] {
  return [...root.querySelectorAll<HTMLPreElement>('pre')].filter(
    (pre) => pre.closest('.yomu-mermaid, .yomu-error') === null
  );
}

function expandLabel(lines: number): string {
  return (options?.labels.expand ?? 'Show all {0} lines').replace('{0}', String(lines));
}

function setExpanded(
  frame: HTMLElement,
  button: HTMLButtonElement,
  index: number,
  open: boolean
): void {
  frame.classList.toggle('yomu-folded', !open);
  button.textContent = open
    ? (options?.labels.collapse ?? 'Collapse')
    : expandLabel(Number(frame.dataset.lines));
  button.setAttribute('aria-expanded', String(open));
  if (open) {
    expanded.add(index);
  } else {
    expanded.delete(index);
  }
}

/** 本文を差し替えた時と、設定が変わった時に呼ぶ */
export function applyFolding(root: HTMLElement, next?: FoldOptions): void {
  if (next !== undefined) {
    options = next;
  }
  // 付け直す前に、前に付けたものを外す
  root.querySelectorAll('.yomu-fold-button').forEach((button) => button.remove());
  root.querySelectorAll('.yomu-foldable').forEach((frame) => {
    frame.classList.remove('yomu-foldable', 'yomu-folded');
    (frame as HTMLElement).style.removeProperty('--fold-lines');
  });
  if (options === undefined) {
    return;
  }
  const foldLines = options.foldLines;
  codeBlocks(root).forEach((pre, index) => {
    const lines = countLines(pre.textContent ?? '');
    if (!shouldFold(lines, foldLines)) {
      return;
    }
    // 言語ラベルの枠があればそれを、無ければ pre を枠にする
    const frame = pre.parentElement?.classList.contains('yomu-code') ? pre.parentElement : pre;
    frame.classList.add('yomu-foldable');
    frame.dataset.lines = String(lines);
    frame.style.setProperty('--fold-lines', String(foldLines));
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'yomu-fold-button';
    button.addEventListener('click', () =>
      setExpanded(frame, button, index, frame.classList.contains('yomu-folded'))
    );
    frame.after(button);
    setExpanded(frame, button, index, expanded.has(index));
  });
}
