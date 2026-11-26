/**
 * コードブロックのコピーのボタン。枠（.yomu-code）の右上に置き、押すとコードを拡張機能に送る
 * （クリップボードへの書き込みは拡張機能が vscode.env.clipboard で行う）。
 * 言語の指定が無いコードは枠が無いので、ここで枠を作って包む。
 */

/** 押した後に「コピーしました」を出しておく時間（ms） */
const COPIED_DURATION = 1500;

export interface CopyLabels {
  copy: string;
  copied: string;
}

let labels: CopyLabels = { copy: 'Copy', copied: 'Copied' };

/** コピーの対象のコードブロック。Mermaid のソース、エラー表示、front matter の値は除く */
function codeBlocks(root: HTMLElement): HTMLPreElement[] {
  return [...root.querySelectorAll<HTMLPreElement>('pre')].filter(
    (pre) => pre.closest('.yomu-mermaid, .yomu-error, .yomu-front-matter') === null
  );
}

/** 枠。無ければ pre を包む枠を作る（行番号の data-line は pre に残す） */
function frameOf(pre: HTMLPreElement): HTMLElement {
  const parent = pre.parentElement;
  if (parent?.classList.contains('yomu-code')) {
    return parent;
  }
  const frame = document.createElement('div');
  frame.className = 'yomu-code';
  pre.replaceWith(frame);
  frame.appendChild(pre);
  return frame;
}

/**
 * 本文を差し替えた時と、設定が変わった時に呼ぶ。折りたたみ（applyFolding）より先に呼ぶ
 * （折りたたみは枠を見て畳む対象を決める）
 */
export function applyCopyButtons(
  root: HTMLElement,
  send: (text: string) => void,
  next?: CopyLabels
): void {
  if (next !== undefined) {
    labels = next;
  }
  root.querySelectorAll('.yomu-copy-button').forEach((button) => button.remove());
  for (const pre of codeBlocks(root)) {
    const frame = frameOf(pre);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'yomu-copy-button';
    button.textContent = labels.copy;
    let timer: ReturnType<typeof setTimeout> | undefined;
    button.addEventListener('click', () => {
      send(pre.querySelector('code')?.textContent ?? pre.textContent ?? '');
      button.textContent = labels.copied;
      clearTimeout(timer);
      timer = setTimeout(() => {
        button.textContent = labels.copy;
      }, COPIED_DURATION);
    });
    frame.appendChild(button);
  }
}
