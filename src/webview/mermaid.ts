/**
 * Webview の中で Mermaid の図を描く。
 * render.ts が出力した .yomu-mermaid の枠を探し、mermaid.js で SVG にして差し替える。
 * mermaid.js（dist/mermaid.min.js、約 5.5MB）は枠がある時だけ読み込む。
 */
import { mermaidConfig, type MermaidConfig } from '../reader/mermaidTheme';
import type { Theme } from '../reader/readerSettings';

/** mermaid.min.js が globalThis.mermaid に置く API のうち、使うもの */
interface MermaidApi {
  initialize(config: MermaidConfig): void;
  render(id: string, source: string): Promise<{ svg: string }>;
}

declare global {
  interface Window {
    mermaid?: MermaidApi;
  }
}

/** 読み込みは 1 回だけ。失敗したら次の描画でやり直す */
let loading: Promise<MermaidApi> | undefined;

/** 同じソース・テーマ・幅の SVG を覚えておき、編集で本文を差し替えた時に図がちらつかないようにする */
const cache = new Map<string, string>();

let renderCount = 0;
/** 描いている途中で本文が差し替わったら、古い描画の結果を捨てる */
let generation = 0;

function load(src: string, nonce: string): Promise<MermaidApi> {
  if (window.mermaid) {
    return Promise.resolve(window.mermaid);
  }
  loading ??= new Promise<MermaidApi>((resolve, reject) => {
    const script = document.createElement('script');
    // CSP は nonce 付きのスクリプトだけを許すので、読み込むスクリプトにも同じ nonce を付ける
    script.nonce = nonce;
    script.src = src;
    script.onload = () =>
      window.mermaid ? resolve(window.mermaid) : reject(new Error('mermaid is not defined'));
    script.onerror = () => reject(new Error('failed to load ' + src));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}

function showError(block: HTMLElement, message: string): void {
  block.querySelector('.yomu-mermaid-error')?.remove();
  const note = document.createElement('p');
  note.className = 'yomu-mermaid-error';
  note.textContent = 'Mermaid: ' + message;
  block.prepend(note);
}

export interface MermaidOptions {
  /** mermaid.min.js の Webview URI */
  src: string;
  /** このスクリプト自身の nonce */
  nonce: string;
  theme: Theme;
  /** VS Code のカラーテーマが暗いか */
  vscodeIsDark: boolean;
}

/**
 * root の中の Mermaid の枠を描く。
 * キャッシュにある図はその場で差し替え、無い図は mermaid.js を読み込んでから描く。
 * @returns すべての枠を描き終えたら解決する（描けなかった枠はソースとエラーを見せる）
 */
export async function renderMermaid(root: HTMLElement, options: MermaidOptions): Promise<void> {
  const blocks = [...root.querySelectorAll<HTMLElement>('.yomu-mermaid')];
  const current = ++generation;
  // 図を置く枠の幅。ガントチャートはこの幅で描く（枠はすべて本文の幅なので、最初の 1 つで足りる）
  const width = blocks[0]?.clientWidth ?? 0;
  const config = mermaidConfig(options.theme, width, options.vscodeIsDark);
  const pending: { block: HTMLElement; source: string; key: string }[] = [];
  for (const block of blocks) {
    // ソースは最初の描画の前に保存しておく。テーマを変えた時の描き直しに使う
    block.dataset.source ??= block.querySelector('.yomu-mermaid-source')?.textContent ?? '';
    const source = block.dataset.source;
    const key = [config.theme, width, source].join('\n');
    const svg = cache.get(key);
    if (svg !== undefined) {
      block.innerHTML = svg;
    } else {
      pending.push({ block, source, key });
    }
  }
  if (pending.length === 0) {
    return;
  }

  let mermaid: MermaidApi;
  try {
    mermaid = await load(options.src, options.nonce);
  } catch (error) {
    for (const { block } of pending) {
      showError(block, error instanceof Error ? error.message : String(error));
    }
    return;
  }
  if (current !== generation) {
    return;
  }
  mermaid.initialize(config);
  for (const { block, source, key } of pending) {
    try {
      const { svg } = await mermaid.render('yomu-mermaid-' + ++renderCount, source);
      cache.set(key, svg);
      if (current === generation) {
        block.innerHTML = svg;
      }
    } catch (error) {
      if (current === generation) {
        showError(block, error instanceof Error ? error.message : String(error));
      }
    }
  }
}

/** テーマを変えた時に、描いた図を元のソースに戻してから描き直す */
export function resetMermaid(root: HTMLElement): void {
  for (const block of root.querySelectorAll<HTMLElement>('.yomu-mermaid')) {
    const source = block.dataset.source;
    if (source === undefined) {
      continue;
    }
    const pre = document.createElement('pre');
    pre.className = 'yomu-mermaid-source';
    pre.textContent = source;
    block.replaceChildren(pre);
  }
}
