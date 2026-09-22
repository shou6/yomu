/**
 * Markdown を HTML に変換する（純粋関数）。
 * 生の HTML は無効にし、相対パスの画像だけを Webview 用の URI に書き換える。
 */
import hljs from 'highlight.js';
import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import taskLists from 'markdown-it-task-lists';

export interface RenderOptions {
  /** 相対パスの画像の src を、Webview で読める URI に変換する */
  resolveImageSrc: (src: string) => string;
}

/** スキーム付き（https:、data: など）か、プロトコル相対（//）の URL */
const ABSOLUTE_URL = /^([a-z][a-z0-9+.-]*:|\/\/)/i;

/**
 * 見出しの ID。GitHub と同じ規則で、日本語はそのまま残す。
 * 小文字にし、文字・数字・空白・ハイフン・アンダースコア以外を落とし、空白をハイフンにする
 */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
    .replace(/\s+/g, '-');
}

function highlight(code: string, lang: string): string {
  if (lang === '' || !hljs.getLanguage(lang)) {
    return '';
  }
  return hljs.highlight(code, { language: lang }).value;
}

export function createMarkdownIt(options: RenderOptions): MarkdownIt.MarkdownIt {
  const md = new MarkdownIt({ html: false, linkify: false, typographer: false, highlight });
  md.use(anchor, { slugify, tabIndex: false });
  md.use(taskLists, { enabled: false });

  // 言語指定のあるコードブロックを data-lang 付きの枠で包み、CSS でラベルを出す。
  // ラベルは横スクロールする pre の中ではなく、スクロールしない枠に置く
  const renderFence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
    const lang = tokens[idx].info.trim().split(/\s+/)[0] ?? '';
    if (lang.toLowerCase() === 'mermaid') {
      // 図は Webview で mermaid.js が描く。描くまでと、描けなかった時はソースを見せる
      const source = md.utils.escapeHtml(tokens[idx].content);
      return `<div class="yomu-mermaid"><pre class="yomu-mermaid-source">${source}</pre></div>\n`;
    }
    const html = renderFence
      ? renderFence(tokens, idx, opts, env, self)
      : self.renderToken(tokens, idx, opts);
    return lang === ''
      ? html
      : `<div class="yomu-code" data-lang="${md.utils.escapeHtml(lang)}">${html.trimEnd()}</div>\n`;
  };

  const renderImage = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, idx, opts, env, self) => {
    const token = tokens[idx];
    const src = token.attrGet('src');
    if (src !== null && !ABSOLUTE_URL.test(String(src))) {
      token.attrSet('src', options.resolveImageSrc(String(src)));
    }
    return renderImage
      ? renderImage(tokens, idx, opts, env, self)
      : self.renderToken(tokens, idx, opts);
  };
  return md;
}

export function render(markdown: string, options: RenderOptions): string {
  return createMarkdownIt(options).render(markdown);
}

/**
 * render と同じだが、変換中に例外が出ても投げず、エラーの内容を本文として返す。
 * Webview が白紙になるのを避けるため、Provider はこちらを使う。
 */
export function renderSafely(markdown: string, options: RenderOptions): string {
  try {
    return render(markdown, options);
  } catch (error) {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    const escape = new MarkdownIt().utils.escapeHtml;
    return (
      '<div class="yomu-error"><p>Yomu could not render this document.</p><pre>' +
      escape(message) +
      '</pre></div>'
    );
  }
}
