import * as assert from 'assert';
import { buildOutline, currentHeadingIndex, extractHeadings } from '../../reader/outline';
import { render } from '../../reader/render';

const resolveImageSrc = (src: string): string => src;

suite('extractHeadings', () => {
  test('見出しのレベル、文字、ID を上から順に取り出す', () => {
    const markdown = '# はじめに\n\n本文\n\n## Getting Started\n\n### `npm` の使い方\n';
    assert.deepStrictEqual(extractHeadings(markdown), [
      { level: 1, text: 'はじめに', id: 'はじめに' },
      { level: 2, text: 'Getting Started', id: 'getting-started' },
      { level: 3, text: 'npm の使い方', id: 'npm-の使い方' },
    ]);
  });

  test('同じ見出しは本文と同じく連番の ID になる', () => {
    const ids = extractHeadings('## 手順\n\n## 手順\n\n## 手順\n').map((h) => h.id);
    assert.deepStrictEqual(ids, ['手順', '手順-1', '手順-2']);
  });

  test('ID は本文の見出しの ID と一致する（クリックでその見出しへ移動するため）', () => {
    const markdown = '# A\n\n## B と **C**\n\n## B と **C**\n\n### [link](https://example.com)\n';
    const html = render(markdown, { resolveImageSrc });
    for (const heading of extractHeadings(markdown)) {
      assert.ok(html.includes(`id="${heading.id}"`), heading.id + ' が本文に無い: ' + html);
    }
  });

  test('コードブロックの中の # は見出しにしない', () => {
    assert.deepStrictEqual(extractHeadings('```\n# not heading\n```\n'), []);
  });
});

suite('extractHeadings: front matter', () => {
  test('front matter は目次に出さない', () => {
    const markdown = '---\ntitle: Hello\n---\n\n# Body\n';
    assert.deepStrictEqual(extractHeadings(markdown), [{ level: 1, text: 'Body', id: 'body' }]);
  });
});

suite('buildOutline', () => {
  test('レベルで入れ子にする', () => {
    const outline = buildOutline([
      { level: 1, text: 'A', id: 'a' },
      { level: 2, text: 'B', id: 'b' },
      { level: 3, text: 'C', id: 'c' },
      { level: 2, text: 'D', id: 'd' },
      { level: 1, text: 'E', id: 'e' },
    ]);
    assert.deepStrictEqual(
      outline.map((node) => [node.heading.id, node.children.map((c) => c.heading.id)]),
      [
        ['a', ['b', 'd']],
        ['e', []],
      ]
    );
    assert.deepStrictEqual(
      outline[0].children[0].children.map((c) => c.heading.id),
      ['c']
    );
  });

  test('レベルが飛んでも、直前の浅い見出しの下に入れる', () => {
    const outline = buildOutline([
      { level: 1, text: 'A', id: 'a' },
      { level: 3, text: 'B', id: 'b' },
    ]);
    assert.deepStrictEqual(
      outline[0].children.map((c) => c.heading.id),
      ['b']
    );
  });

  test('最初が h2 なら、それが一番上の階層になる', () => {
    const outline = buildOutline([
      { level: 2, text: 'A', id: 'a' },
      { level: 2, text: 'B', id: 'b' },
      { level: 3, text: 'C', id: 'c' },
    ]);
    assert.deepStrictEqual(
      outline.map((n) => n.heading.id),
      ['a', 'b']
    );
    assert.deepStrictEqual(
      outline[1].children.map((c) => c.heading.id),
      ['c']
    );
  });

  test('親をたどれる（ツリーで選んだ項目を開いて見せるため）', () => {
    const outline = buildOutline([
      { level: 1, text: 'A', id: 'a' },
      { level: 2, text: 'B', id: 'b' },
    ]);
    assert.strictEqual(outline[0].children[0].parent, outline[0]);
    assert.strictEqual(outline[0].parent, undefined);
  });
});

suite('currentHeadingIndex', () => {
  test('基準の高さより上にある、最後の見出し', () => {
    assert.strictEqual(currentHeadingIndex([-500, -100, 50, 400], 120), 2);
    assert.strictEqual(currentHeadingIndex([-500, -100, 150, 400], 120), 1);
  });

  test('最初の見出しより上を読んでいる時は -1', () => {
    assert.strictEqual(currentHeadingIndex([200, 400], 120), -1);
  });

  test('見出しが無ければ -1', () => {
    assert.strictEqual(currentHeadingIndex([], 120), -1);
  });
});
