/**
 * Markdown を HTML に変換する（純粋関数）。
 * 生の HTML は決めたタグ（details など）だけを通し、相対パスの画像だけを Webview 用の URI に書き換える。
 */
import katex from '@vscode/markdown-it-katex';
import hljs from 'highlight.js';
import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import footnote from 'markdown-it-footnote';
import taskLists from 'markdown-it-task-lists';
import { frontMatter } from './frontMatter';
import { htmlAllowlist } from './htmlAllowlist';

export interface RenderOptions {
  /** 相対パスの画像の src を、Webview で読める URI に変換する */
  resolveImageSrc: (src: string) => string;
}

/** 元の行番号を付ける、一番外側のブロックの要素 */
const LINE_BLOCKS = new Set([
  'paragraph_open',
  'heading_open',
  'blockquote_open',
  'table_open',
  'bullet_list_open',
  'ordered_list_open',
  'hr',
  'code_block',
]);

/** スキーム付き（https:、data: など）か、プロトコル相対（//）の URL */
const ABSOLUTE_URL = /^([a-z][a-z0-9+.-]*:|\/\/)/i;

/**
 * 見出しの ID。GitHub と同じ規則で、日本語はそのまま残す。
 * 小文字にし、文字・数字・空白・ハイフン・アンダースコア以外を落とし、空白を 1 文字ずつハイフンにする
 * （「A / B」は記号を落とした後に空白が 2 つ残るので「a--b」になる）
 */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/** KaTeX が描いたブロックの数式（<p class="katex-block">）に、元の行番号を付ける */
function withDataLine(html: string, dataLine: string): string {
  return html.replace(/^<p /, `<p${dataLine} `);
}

function highlight(code: string, lang: string): string {
  if (lang === '' || !hljs.getLanguage(lang)) {
    return '';
  }
  return hljs.highlight(code, { language: lang }).value;
}

export function createMarkdownIt(options: RenderOptions): MarkdownIt.MarkdownIt {
  const md = new MarkdownIt({ html: true, linkify: false, typographer: false, highlight });
  md.use(anchor, { slugify, tabIndex: false });
  md.use(taskLists, { enabled: false });
  md.use(footnote);
  // 数式（$…$、$$…$$、言語が math のコードブロック）は KaTeX で描く。GitHub と同じ書き方
  md.use(katex, { enableFencedBlocks: true, throwOnError: false });
  // 脚注の番号は GitHub と同じく角括弧を付けない（既定は [1]）
  md.renderer.rules.footnote_caption = (tokens, idx) => {
    const meta = tokens[idx].meta as { id: number; subId: number };
    return meta.subId > 0 ? `${meta.id + 1}:${meta.subId}` : String(meta.id + 1);
  };
  md.use(frontMatter);
  // 生の HTML は決めたタグだけを通し、残りはエスケープする。タスクリストより後に use する（htmlAllowlist.ts）
  md.use(htmlAllowlist);

  // ブロックの要素に元の行番号（0 始まり）を data-line で付ける。「標準エディタで開く」で読んでいる行へ移るため。
  // 見出しの id より後に付けるよう、anchor の後に足す。リストの項目は深さに関わらず、他は一番外側だけに付ける
  md.core.ruler.push('yomu_source_line', (state) => {
    for (const token of state.tokens) {
      const line = token.map?.[0];
      if (line === undefined || token.nesting === -1) {
        continue;
      }
      const topLevel = token.level === 0 && LINE_BLOCKS.has(token.type);
      if (token.type === 'list_item_open' || topLevel) {
        token.attrSet('data-line', String(line));
      }
    }
  });

  // 言語指定のあるコードブロックを data-lang 付きの枠で包み、CSS でラベルを出す。
  // ラベルは横スクロールする pre の中ではなく、スクロールしない枠に置く
  const renderFence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
    const lang = tokens[idx].info.trim().split(/\s+/)[0] ?? '';
    const line = tokens[idx].map?.[0];
    const dataLine = line === undefined ? '' : ` data-line="${line}"`;
    if (lang.toLowerCase() === 'mermaid') {
      // 図は Webview で mermaid.js が描く。描くまでと、描けなかった時はソースを見せる
      const source = md.utils.escapeHtml(tokens[idx].content);
      return `<div class="yomu-mermaid"${dataLine}><pre class="yomu-mermaid-source">${source}</pre></div>\n`;
    }
    if (lang === 'math') {
      return withDataLine(renderFence!(tokens, idx, opts, env, self), dataLine);
    }
    // コードの行番号は、pre の中の code ではなく外側の要素に付ける
    tokens[idx].attrs = tokens[idx].attrs?.filter(([name]) => name !== 'data-line') ?? null;
    const html = renderFence
      ? renderFence(tokens, idx, opts, env, self)
      : self.renderToken(tokens, idx, opts);
    return lang === ''
      ? html.replace(/^<pre>/, `<pre${dataLine}>`)
      : `<div class="yomu-code" data-lang="${md.utils.escapeHtml(lang)}"${dataLine}>${html.trimEnd()}</div>\n`;
  };

  const renderMathBlock = md.renderer.rules.math_block;
  md.renderer.rules.math_block = (tokens, idx, opts, env, self) => {
    const line = tokens[idx].map?.[0];
    const dataLine = line === undefined || tokens[idx].level !== 0 ? '' : ` data-line="${line}"`;
    return withDataLine(renderMathBlock!(tokens, idx, opts, env, self), dataLine);
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
