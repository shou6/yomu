/**
 * Markdown の中の生の HTML から、決めたタグだけを通す markdown-it のプラグイン。
 * GitHub の README でよく使う折りたたみ（details）やキー（kbd）と、
 * 文字に色を付けたり装飾したりする行内のタグ（span、b、mark など）を表示するため。
 * 通すタグは属性を落として書き直す。残すのは details の open と、行内のタグの style のうち色と文字装飾のプロパティだけ。
 * それ以外のタグは文字としてエスケープし、コメントは GitHub と同じく表示しない（要件定義 4.4 節）
 */
import type MarkdownIt from 'markdown-it';

/** 行内のタグ。GitHub が通す行内の装飾タグに合わせる。style を受け付ける */
const INLINE_TAGS = new Set([
  'kbd',
  'sub',
  'sup',
  'span',
  'b',
  'i',
  'u',
  's',
  'strike',
  'em',
  'strong',
  'mark',
  'ins',
  'del',
  'small',
]);

/** 折りたたみと改行。属性は details の open だけ残す */
const BLOCK_TAGS = new Set(['details', 'summary', 'br']);

/** コメントか、開始・終了のタグ。属性の値は引用符の有無を問わない */
const HTML_PART =
  /<!--[\s\S]*?-->|<(\/?)([a-z][a-z0-9-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/gi;
const OPEN_ATTRIBUTE = /(?:^|\s)open(?=\s|=|$)/i;
const STYLE_ATTRIBUTE = /(?:^|\s)style\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i;

/** style で通す CSS のプロパティ。文字の色と装飾だけで、配置や大きさを変えるものは通さない */
const ALLOWED_STYLE_PROPERTIES = new Set([
  'color',
  'background-color',
  'font-weight',
  'font-style',
  'text-decoration',
  'font-size',
]);

/**
 * style の値に許す文字。色の名前、#rrggbb、rgb(…)、1.2em、underline wavy などが書ける。
 * 引用符、/、:、; を含めないので、url(https://…) や HTML の属性を壊す値は通らない
 */
const STYLE_VALUE = /^[a-z0-9#%.,()\s-]+$/i;
/** 値の中で呼べる関数。色の関数だけで、expression(…) などは通さない */
const STYLE_FUNCTION = /([a-z-]*)\(/gi;
const ALLOWED_STYLE_FUNCTIONS = new Set(['rgb', 'rgba', 'hsl', 'hsla']);

/** token.meta に置くので、Record<string, unknown> に代入できる type で書く */
export type SanitizedHtml = {
  html: string;
  /** 通したタグが 1 つでもあるか */
  hasTags: boolean;
};

function isSafeStyleValue(value: string): boolean {
  if (!STYLE_VALUE.test(value)) {
    return false;
  }
  for (const [, name] of value.matchAll(STYLE_FUNCTION)) {
    if (!ALLOWED_STYLE_FUNCTIONS.has(name.toLowerCase())) {
      return false;
    }
  }
  return true;
}

/** style の宣言から、許したプロパティと安全な値の組だけを残す。残らなければ空文字 */
export function sanitizeStyle(style: string): string {
  const declarations: string[] = [];
  for (const declaration of style.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon === -1) {
      continue;
    }
    const property = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration.slice(colon + 1).trim();
    if (ALLOWED_STYLE_PROPERTIES.has(property) && value !== '' && isSafeStyleValue(value)) {
      declarations.push(`${property}:${value}`);
    }
  }
  return declarations.join(';');
}

/** 開始タグを、残す属性だけ付けて書き直す */
function rewriteOpenTag(name: string, attributes: string): string {
  if (name === 'details' && OPEN_ATTRIBUTE.test(attributes)) {
    return '<details open>';
  }
  if (INLINE_TAGS.has(name)) {
    const match = STYLE_ATTRIBUTE.exec(attributes);
    const style = sanitizeStyle(match?.[1] ?? match?.[2] ?? match?.[3] ?? '');
    // 値は STYLE_VALUE の文字だけなので、引用符や < > を含まず、エスケープせずに属性に入れられる
    if (style !== '') {
      return `<${name} style="${style}">`;
    }
  }
  return `<${name}>`;
}

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
    if (name === undefined || !(INLINE_TAGS.has(name) || BLOCK_TAGS.has(name))) {
      html += escape(part);
      continue;
    }
    hasTags = true;
    html += slash === '/' ? `</${name}>` : rewriteOpenTag(name, attributes ?? '');
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
