/**
 * Markdown の中の生の HTML から、決めたタグだけを通す markdown-it のプラグイン。
 * GitHub の README でよく使う折りたたみ（details）やキー（kbd）を表示するため。
 * 通すタグは属性を落として書き直し（details の open だけ残す）、それ以外のタグは文字としてエスケープする。
 * コメントは GitHub と同じく表示しない（要件定義 4.4 節）
 */
import type MarkdownIt from 'markdown-it';

const ALLOWED_TAGS = new Set(['details', 'summary', 'kbd', 'br', 'sub', 'sup']);

/** コメントか、開始・終了のタグ。属性の値は引用符の有無を問わない */
const HTML_PART =
  /<!--[\s\S]*?-->|<(\/?)([a-z][a-z0-9-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/gi;
const OPEN_ATTRIBUTE = /(?:^|\s)open(?=\s|=|$)/i;

/** token.meta に置くので、Record<string, unknown> に代入できる type で書く */
export type SanitizedHtml = {
  html: string;
  /** 通したタグが 1 つでもあるか */
  hasTags: boolean;
};

/** 通すタグだけを書き直して残し、残りの文字とタグはエスケープする。コメントは消す */
export function sanitizeHtml(source: string, escape: (text: string) => string): SanitizedHtml {
  let html = '';
  let hasTags = false;
  let last = 0;
  for (const match of source.matchAll(HTML_PART)) {
    html += escape(source.slice(last, match.index));
    last = match.index + match[0].length;
    const [part, slash, rawName, attributes] = match;
    const name = rawName?.toLowerCase();
    if (part.startsWith('<!--')) {
      continue;
    }
    if (name === undefined || !ALLOWED_TAGS.has(name)) {
      html += escape(part);
      continue;
    }
    hasTags = true;
    if (slash === '/') {
      html += `</${name}>`;
    } else if (name === 'details' && OPEN_ATTRIBUTE.test(attributes ?? '')) {
      html += '<details open>';
    } else {
      html += `<${name}>`;
    }
  }
  html += escape(source.slice(last));
  return { html, hasTags };
}

/**
 * markdown-it は html: true で使う。文書に書かれた生の HTML は、すべてここを通す。
 * 変換（core）の段階で書き換えるので、プラグインが後から足す HTML（タスクリストのチェックボックス）には触れない。
 * そのため、markdown-it-task-lists より後に use する（どちらも inline の直後に入り、後から入れた方が先に動く）
 */
export function htmlAllowlist(md: MarkdownIt.MarkdownIt): void {
  const escape = md.utils.escapeHtml;

  md.core.ruler.after('inline', 'yomu_html_allowlist', (state) => {
    for (const token of state.tokens) {
      if (token.type === 'html_block') {
        token.type = 'yomu_html_block';
        token.meta = sanitizeHtml(token.content, escape);
      }
      for (const child of token.children ?? []) {
        if (child.type === 'html_inline') {
          child.type = 'yomu_html_inline';
          child.meta = sanitizeHtml(child.content, escape);
        }
      }
    }
  });

  md.renderer.rules.yomu_html_block = (tokens, idx) => {
    const token = tokens[idx];
    const { html, hasTags } = token.meta as SanitizedHtml;
    if (hasTags || html.trim() === '') {
      return html;
    }
    // 通すタグの無いブロックは、以前（html: false）と同じく段落の文字として見せる
    const line = token.map?.[0];
    const dataLine = line === undefined || token.level !== 0 ? '' : ` data-line="${line}"`;
    return `<p${dataLine}>${html.trim()}</p>\n`;
  };

  md.renderer.rules.yomu_html_inline = (tokens, idx) => (tokens[idx].meta as SanitizedHtml).html;
}
