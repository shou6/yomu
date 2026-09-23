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
import { setFocusMode, updateFocus, watchFocus } from './focus';
import { applyFolding } from './fold';
import { watchPosition } from './position';
import { watchProgress } from './progress';
import { resumeScrollY } from '../reader/reading';
import { readingLine } from '../reader/sourceLine';

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

function applyUpdate(
  html: string,
  resume: number | undefined,
  anchor: string | undefined,
  resetFrontMatter: boolean
): void {
  // 再描画でスクロール位置が失われないよう、差し替えの前後で位置を保つ。
  // 開いた直後は、タブを隠して戻した時の位置を優先し、無ければ読書の記録の割合から再開する
  const opening = content.childElementCount === 0;
  const saved = vscode.getState()?.scrollY;
  // 文書を編集するたびに front matter が閉じないよう、読者が開け閉めした状態を保つ
  const frontMatterSelector = 'details.yomu-front-matter';
  const frontMatterOpen = content.querySelector<HTMLDetailsElement>(frontMatterSelector)?.open;
  content.innerHTML = html;
  const frontMatter = content.querySelector<HTMLDetailsElement>(frontMatterSelector);
  if (frontMatter !== null && frontMatterOpen !== undefined && !resetFrontMatter) {
    frontMatter.open = frontMatterOpen;
  }
  // 見出し付きのリンクで開いた時は、その見出しを一番に優先する
  const anchorTop =
    opening && anchor !== undefined
      ? document.getElementById(anchor)?.getBoundingClientRect().top
      : undefined;
  const scrollY = !opening
    ? window.scrollY
    : anchorTop !== undefined
      ? anchorTop
      : saved !== undefined
        ? saved
        : resume !== undefined
          ? resumeScrollY(resume, document.documentElement.scrollHeight, window.innerHeight)
          : 0;
  window.scrollTo(0, scrollY);
  if (opening && scrollY > 0) {
    restoreScrollY = scrollY;
  }
  applyFolding(content);
  window.scrollTo(0, scrollY);
  saveScroll();
  drawMermaid();
  updateFocus(content);
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
  setFocusMode(content, message.focusMode);
  applyFolding(content, { foldLines: message.foldLines, labels: message.foldLabels });
}

window.addEventListener('message', (event: MessageEvent<ToWebview>) => {
  const message = event.data;
  if (message.type === 'update') {
    applyUpdate(message.html, message.resume, message.anchor, message.resetFrontMatter === true);
    checkProgress();
  } else if (message.type === 'settings') {
    applySettings(message);
  } else if (message.type === 'requestLine') {
    // 画面の上から 2 割の高さを、今読んでいる箇所とみなす（目次の今読んでいる見出しと同じ）
    const blocks = [...content.querySelectorAll<HTMLElement>('[data-line]')].map((element) => {
      const rect = element.getBoundingClientRect();
      return { line: Number(element.dataset.line), top: rect.top, bottom: rect.bottom };
    });
    // 一番上にいる時は、文書の先頭を読んでいるとみなす
    const line =
      window.scrollY <= 0 ? (blocks[0]?.line ?? 0) : readingLine(blocks, window.innerHeight * 0.2);
    vscode.postMessage({ type: 'line', line });
  } else if (message.type === 'scrollTo') {
    document.getElementById(message.id)?.scrollIntoView();
  } else if (message.type === 'export') {
    // 印刷用に、描いた Mermaid の SVG を枠の順に返す。描けていない枠は null
    vscode.postMessage({
      type: 'exported',
      mermaid: [...content.querySelectorAll('.yomu-mermaid')].map(
        (block) => block.querySelector('svg')?.outerHTML ?? null
      ),
    });
  }
});

window.addEventListener('scroll', saveScroll, { passive: true });
watchFocus(content);
// 読んだ位置の割合を拡張機能に知らせ、ステータスバーと読書の記録に使ってもらう
const checkProgress = watchProgress((value) => vscode.postMessage({ type: 'progress', value }));
// 今読んでいる見出しを拡張機能に知らせ、目次のビューで選んだ状態にしてもらう
watchPosition(content, (id) => vscode.postMessage({ type: 'position', id }));

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
