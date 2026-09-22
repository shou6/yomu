/**
 * 目次（見出しのツリー）を作る（純粋関数）。
 * 見出しの ID は本文と同じ markdown-it の設定（render.ts）で作るので、クリックでその見出しへ移動できる。
 */
import { createMarkdownIt } from './render';

export interface Heading {
  level: number;
  /** 見出しの文字。強調やコードの記号は外す */
  text: string;
  /** 本文の見出しに付く id */
  id: string;
}

export interface OutlineNode {
  heading: Heading;
  children: OutlineNode[];
  parent: OutlineNode | undefined;
}

/** 画像の src は目次に関係しないので、そのまま返す */
const noImages = { resolveImageSrc: (src: string): string => src };

/** 見出しを上から順に取り出す */
export function extractHeadings(markdown: string): Heading[] {
  const tokens = createMarkdownIt(noImages).parse(markdown, {});
  const headings: Heading[] = [];
  tokens.forEach((token, index) => {
    if (token.type !== 'heading_open') {
      return;
    }
    const inline = tokens[index + 1];
    const text = (inline?.children ?? [])
      .filter((child) => child.type === 'text' || child.type === 'code_inline')
      .map((child) => child.content)
      .join('');
    headings.push({
      level: Number(token.tag.slice(1)),
      text,
      id: String(token.attrGet('id') ?? ''),
    });
  });
  return headings;
}

/** 見出しをレベルで入れ子にする。レベルが飛んでも、直前の浅い見出しの下に入れる */
export function buildOutline(headings: readonly Heading[]): OutlineNode[] {
  const roots: OutlineNode[] = [];
  const stack: OutlineNode[] = [];
  for (const heading of headings) {
    while (stack.length > 0 && stack[stack.length - 1].heading.level >= heading.level) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    const node: OutlineNode = { heading, children: [], parent };
    (parent?.children ?? roots).push(node);
    stack.push(node);
  }
  return roots;
}

/**
 * 今読んでいる見出しの番号。基準の高さより上にある最後の見出し。最初の見出しより上なら -1。
 * @param tops 見出しの上端（画面の座標、上から順）
 * @param threshold 基準の高さ（画面の座標）
 */
export function currentHeadingIndex(tops: readonly number[], threshold: number): number {
  let current = -1;
  tops.forEach((top, index) => {
    if (top <= threshold) {
      current = index;
    }
  });
  return current;
}
