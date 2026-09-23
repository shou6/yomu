/**
 * ファイルの先頭の front matter（--- で囲んだ YAML）を、キーと値の表にする markdown-it のプラグイン。
 * GitHub と同じく表で見せる。そのままだと、先頭の --- が水平線、中身が見出し（setext）になり、目次にも出てしまう。
 * YAML は解釈せず、一番外側の「キー: 値」だけを行で見分ける。複数行の値（リストや入れ子）は書かれたままの形で出す
 */
import type MarkdownIt from 'markdown-it';

export interface FrontMatterEntry {
  key: string;
  /** キーと同じ行の値（引用符は外す） */
  value: string;
  /** 次の行から続く値（字下げを外したもの）。無ければ空 */
  block: string[];
}

/** 一番外側の「キー: 値」の行 */
const KEY_LINE = /^([^\s#:-][^:]*?)\s*:(?:\s+(.*?))?\s*$/;
/** ブロックスカラー（| や >）の記号。値は次の行から始まる */
const BLOCK_SCALAR = /^[|>][+-]?$/;

function unquote(value: string): string {
  const quoted = /^"(.*)"$/.exec(value) ?? /^'(.*)'$/.exec(value);
  return quoted ? quoted[1] : value;
}

/** front matter の中身を「キー: 値」の並びに分ける。その形でなければ undefined（front matter とみなさない） */
export function parseFrontMatter(lines: readonly string[]): FrontMatterEntry[] | undefined {
  const entries: FrontMatterEntry[] = [];
  for (const line of lines) {
    const current = entries[entries.length - 1];
    if (line.trim() === '') {
      current?.block.push('');
      continue;
    }
    if (line.startsWith('#')) {
      continue;
    }
    if (/^\s/.test(line) || line.startsWith('- ') || line === '-') {
      if (current === undefined) {
        return undefined;
      }
      current.block.push(line);
      continue;
    }
    const match = KEY_LINE.exec(line);
    if (match === null) {
      return undefined;
    }
    entries.push({ key: match[1], value: unquote(match[2] ?? ''), block: [] });
  }
  for (const entry of entries) {
    while (entry.block.length > 0 && entry.block[entry.block.length - 1] === '') {
      entry.block.pop();
    }
    const indent = Math.min(
      ...entry.block.filter((line) => line !== '').map((line) => /^\s*/.exec(line)?.[0].length ?? 0)
    );
    entry.block = entry.block.map((line) => line.slice(indent));
  }
  return entries.length > 0 ? entries : undefined;
}

export function frontMatter(md: MarkdownIt.MarkdownIt): void {
  const escape = md.utils.escapeHtml;

  md.block.ruler.before('hr', 'yomu_front_matter', (state, startLine, endLine, silent) => {
    if (startLine !== 0 || state.parentType !== 'root') {
      return false;
    }
    const lineText = (line: number): string =>
      state.src.slice(state.bMarks[line], state.eMarks[line]);
    if (lineText(0).trimEnd() !== '---') {
      return false;
    }
    let close = 1;
    while (close < endLine && lineText(close).trimEnd() !== '---') {
      close++;
    }
    if (close >= endLine) {
      return false;
    }
    const lines = Array.from({ length: close - 1 }, (_, index) => lineText(index + 1));
    const entries = parseFrontMatter(lines);
    if (entries === undefined) {
      return false;
    }
    if (!silent) {
      const token = state.push('yomu_front_matter', '', 0);
      token.block = true;
      token.map = [0, close + 1];
      token.meta = { entries };
    }
    state.line = close + 1;
    return true;
  });

  md.renderer.rules.yomu_front_matter = (tokens, idx) => {
    const token = tokens[idx];
    const { entries } = token.meta as { entries: FrontMatterEntry[] };
    const rows = entries.map((entry) => {
      const inline = BLOCK_SCALAR.test(entry.value) ? '' : entry.value;
      const cell =
        entry.block.length > 0
          ? `<pre>${escape([inline, ...entry.block].filter((line, i) => i > 0 || line !== '').join('\n'))}</pre>`
          : escape(inline);
      return `<tr><th>${escape(entry.key)}</th><td>${cell}</td></tr>`;
    });
    const line = token.map?.[0] ?? 0;
    return `<table class="yomu-front-matter" data-line="${line}"><tbody>${rows.join('')}</tbody></table>\n`;
  };
}
