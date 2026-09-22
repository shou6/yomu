/**
 * Webview 側のスクリプト。dist/webview.js にバンドルされ、リーダータブの中で動く。
 * 拡張機能からの update で本文を差し替え、settings で見た目を変え、スクロール位置を保ち、リンクのクリックを振り分ける。
 */
import { classifyLink } from '../reader/links';
import type { FromWebview, ToWebview } from '../reader/messages';
import { mermaidTheme } from '../reader/mermaidTheme';
import type { Theme } from '../reader/readerSettings';
import { renderMermaid, resetMermaid } from './mermaid';
import { openZoom, zoomTarget } from './zoom';

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
/** このスクリプトの nonce。mermaid.js を後から読み込む時に同じ値を付ける（currentScript は読み込み中しか取れない） */
const nonce = (document.currentScript as HTMLScriptElement | null)?.nonce ?? '';
/** 今のテーマ。settings が来るまでは既定の paper */
let theme: Theme = 'paper';
/** 開いた直後に復元したいスクロール位置。図を描いて本文が伸びた後に、もう一度合わせる */
let restoreScrollY: number | undefined;

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

function vscodeIsDark(): boolean {
  return (
    document.body.classList.contains('vscode-dark') ||
    document.body.classList.contains('vscode-high-contrast')
  );
}

function currentMermaidTheme(): ReturnType<typeof mermaidTheme> {
  return mermaidTheme(theme, vscodeIsDark());
}

/** Mermaid の図を描く。開いた直後なら、図で本文が伸びた後にスクロール位置を合わせ直す */
function drawMermaid(): void {
  const src = document.body.dataset.mermaidSrc;
  if (src === undefined || content.querySelector('.yomu-mermaid') === null) {
    return;
  }
  void renderMermaid(content, { src, nonce, theme, vscodeIsDark: vscodeIsDark() }).then(() => {
    if (restoreScrollY !== undefined) {
      window.scrollTo(0, restoreScrollY);
      restoreScrollY = undefined;
    }
  });
}

function applyUpdate(html: string): void {
  // 再描画でスクロール位置が失われないよう、差し替えの前後で位置を保つ
  const opening = content.childElementCount === 0;
  const scrollY = opening ? (vscode.getState()?.scrollY ?? 0) : window.scrollY;
  content.innerHTML = html;
  window.scrollTo(0, scrollY);
  if (opening && scrollY > 0) {
    restoreScrollY = scrollY;
  }
  saveScroll();
  drawMermaid();
}

/** カスタム CSS。テーマの後（head の末尾）に <link> を置き、どのスタイルも上書きできるようにする */
function applyCustomCss(uri: string | undefined): void {
  const existing = document.getElementById('custom-css');
  if (uri === undefined) {
    existing?.remove();
    return;
  }
  const link = existing instanceof HTMLLinkElement ? existing : document.createElement('link');
  link.id = 'custom-css';
  link.rel = 'stylesheet';
  if (link.href !== uri) {
    link.href = uri;
  }
  if (link.parentNode === null) {
    document.head.appendChild(link);
  }
}

/** 設定は再描画せず、CSS 変数とテーマ属性の差し替えだけで反映する */
function applySettings(message: Extract<ToWebview, { type: 'settings' }>): void {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(message.cssVariables)) {
    root.style.setProperty(name, value);
  }
  document.body.dataset.theme = message.theme;
  applyCustomCss(message.customCssUri);
  // 図の配色の描き直しは、data-theme の変化を見ている MutationObserver が行う
  theme = message.theme;
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

// VS Code のカラーテーマを変えると body のクラスが変わる。vscode テーマの時は図の配色が変わるので描き直す
let lastMermaidTheme = currentMermaidTheme();
new MutationObserver(() => {
  const next = currentMermaidTheme();
  if (next !== lastMermaidTheme) {
    lastMermaidTheme = next;
    resetMermaid(content);
    drawMermaid();
  }
}).observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme'] });

// 設定と本文は ready を受けた拡張機能が送ってくる。タブを隠して戻すと Webview は作り直されるので、その時も送る
vscode.postMessage({ type: 'ready' });

document.addEventListener('click', (event) => {
  // 画像と図はクリックで拡大する（リンクの中の画像は、下のリンクの処理を優先する）
  const zoomable = zoomTarget(event.target as Element | null);
  if (zoomable !== undefined) {
    event.preventDefault();
    openZoom(zoomable);
    return;
  }
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
