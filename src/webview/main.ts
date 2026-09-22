/**
 * Webview 側のスクリプト。dist/webview.js にバンドルされ、リーダータブの中で動く。
 * 拡張機能からの update で本文を差し替え、settings で見た目を変え、スクロール位置を保ち、リンクのクリックを振り分ける。
 */
import { classifyLink } from '../reader/links';
import type { FromWebview, ToWebview } from '../reader/messages';

interface ReaderState {
  scrollY: number;
}

interface VsCodeApi {
  postMessage(message: FromWebview): void;
  getState(): ReaderState | undefined;
  setState(state: ReaderState): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();
const content = requireContent();

function requireContent(): HTMLElement {
  const element = document.getElementById('content');
  if (element === null) {
    throw new Error('#content is missing');
  }
  return element;
}

/** タブを隠して戻した時のために、スクロール位置を保存する */
function saveScroll(): void {
  vscode.setState({ scrollY: window.scrollY });
}

function scrollToId(id: string): void {
  document.getElementById(id)?.scrollIntoView();
}

function applyUpdate(html: string): void {
  // 再描画でスクロール位置が失われないよう、差し替えの前後で位置を保つ
  const scrollY =
    content.childElementCount === 0 ? (vscode.getState()?.scrollY ?? 0) : window.scrollY;
  content.innerHTML = html;
  window.scrollTo(0, scrollY);
  saveScroll();
}

/** 設定は再描画せず、CSS 変数とテーマ属性の差し替えだけで反映する */
function applySettings(message: Extract<ToWebview, { type: 'settings' }>): void {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(message.cssVariables)) {
    root.style.setProperty(name, value);
  }
  document.body.dataset.theme = message.theme;
}

window.addEventListener('message', (event: MessageEvent<ToWebview>) => {
  const message = event.data;
  if (message.type === 'update') {
    applyUpdate(message.html);
  } else if (message.type === 'settings') {
    applySettings(message);
  }
});

window.addEventListener('scroll', saveScroll, { passive: true });

// 設定と本文は ready を受けた拡張機能が送ってくる。タブを隠して戻すと Webview は作り直されるので、その時も送る
vscode.postMessage({ type: 'ready' });

document.addEventListener('click', (event) => {
  const anchor = (event.target as Element | null)?.closest('a[href]');
  const href = anchor?.getAttribute('href');
  if (!href) {
    return;
  }
  event.preventDefault();
  const link = classifyLink(href);
  if (link.kind === 'fragment') {
    scrollToId(link.id);
  } else if (link.kind !== 'ignore') {
    vscode.postMessage({ type: 'openLink', href });
  }
});
