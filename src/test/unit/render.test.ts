import * as assert from 'assert';
import { render, renderSafely } from '../../reader/render';

/** 相対パスの画像を、Webview 用の URI に見立てた文字列へ置き換える */
function resolveImageSrc(src: string): string {
  return 'https://webview.test/doc/' + src;
}

function html(markdown: string): string {
  return render(markdown, { resolveImageSrc });
}

suite('render: 基本の変換', () => {
  test('見出し、段落、強調を HTML にする', () => {
    const out = html('# Title\n\nHello **world** and *you*.\n');
    assert.ok(out.includes('<h1'), out);
    assert.ok(out.includes('>Title</h1>'), out);
    assert.match(out, /<p[^>]*>Hello <strong>world<\/strong> and <em>you<\/em>\.<\/p>/);
  });

  test('GFM の表と取り消し線を変換する', () => {
    const out = html('| a | b |\n| - | - |\n| 1 | 2 |\n\n~~gone~~\n');
    assert.ok(out.includes('<table'), out);
    assert.ok(out.includes('<td>1</td>'), out);
    assert.ok(out.includes('<s>gone</s>'), out);
  });

  test('生の HTML は表示せず、エスケープする', () => {
    const out = html('<script>alert(1)</script>\n\n<b>bold</b> text\n');
    assert.ok(!out.includes('<script>'), out);
    assert.ok(out.includes('&lt;script&gt;'), out);
    assert.ok(out.includes('&lt;b&gt;bold&lt;/b&gt;'), out);
  });

  test('http(s) のリンクはそのまま', () => {
    const out = html('[site](https://example.com/a?b=1)\n');
    assert.ok(out.includes('<a href="https://example.com/a?b=1">site</a>'), out);
  });
});

suite('render: 画像', () => {
  test('相対パスの画像は基準 URI で書き換える', () => {
    const out = html('![alt](./images/a.png)\n\n![b](../b.png)\n\n![c](c.png)\n');
    assert.ok(out.includes('src="https://webview.test/doc/./images/a.png"'), out);
    assert.ok(out.includes('src="https://webview.test/doc/../b.png"'), out);
    assert.ok(out.includes('src="https://webview.test/doc/c.png"'), out);
    assert.ok(out.includes('alt="alt"'), out);
  });

  test('https と data の画像はそのまま', () => {
    const out = html('![a](https://example.com/a.png)\n\n![d](data:image/png;base64,AAAA)\n');
    assert.ok(out.includes('src="https://example.com/a.png"'), out);
    assert.ok(out.includes('src="data:image/png;base64,AAAA"'), out);
  });
});

suite('render: 見出しの ID', () => {
  test('見出しに ID が付き、日本語はそのまま使う', () => {
    const out = html('## はじめに\n\n## Getting Started\n');
    assert.ok(out.includes('<h2 id="はじめに"'), out);
    assert.ok(out.includes('<h2 id="getting-started"'), out);
  });

  test('同じ見出しが重複したら連番で区別する', () => {
    const out = html('## 手順\n\n## 手順\n\n## 手順\n');
    assert.ok(out.includes('id="手順"'), out);
    assert.ok(out.includes('id="手順-1"'), out);
    assert.ok(out.includes('id="手順-2"'), out);
  });

  test('文書内リンクの href は、デコードすると見出しの ID と一致する', () => {
    // markdown-it は href をパーセントエンコードする。ブラウザはフラグメントをデコードして id と照合する
    const out = html('[go](#はじめに)\n');
    const href = out.match(/href="([^"]*)"/)?.[1] ?? '';
    assert.strictEqual(decodeURIComponent(href), '#はじめに', out);
  });

  test('記号を落として空白が続いたら、GitHub と同じく空白の数だけハイフンにする', () => {
    const out = html('## 設定 / API_v2.0 (sample)\n');
    assert.ok(out.includes('<h2 id="設定--api_v20-sample"'), out);
  });
});

suite('render: コードブロック', () => {
  test('言語指定があれば、その言語でハイライトする', () => {
    const out = html('```ts\nconst a: number = 1;\n```\n');
    assert.match(out, /<div class="yomu-code" data-lang="ts"[^>]*><pre><code class="language-ts">/);
    assert.ok(out.includes('<span class="hljs-'), out);
  });

  test('lib/common に無い言語（PowerShell、Dockerfile）もハイライトされる', () => {
    const ps = html("```powershell\n$cur = [Environment]::GetEnvironmentVariable('WSLENV')\n```\n");
    assert.ok(ps.includes('<span class="hljs-'), ps);
    const docker = html('```dockerfile\nFROM node:24\n```\n');
    assert.ok(docker.includes('<span class="hljs-'), docker);
  });

  test('言語指定のあるコードブロックは、ラベル用の data-lang を持つ枠で包む', () => {
    // 枠は横スクロールしない。pre の中にラベルを置くと、横に長いコードでラベルも一緒に流れてしまう
    const out = html('```ts\nconst a = 1;\n```\n');
    assert.match(out, /<div class="yomu-code" data-lang="ts"[^>]*><pre><code class="language-ts">/);
    assert.ok(out.includes('</pre></div>'), out);
    const plain = html('```\nplain\n```\n');
    assert.ok(!plain.includes('data-lang') && !plain.includes('yomu-code'), '言語なしに枠がある');
    // 未対応の言語でも、書いた言語名はラベルに出す
    assert.ok(html('```nosuchlang\nx\n```\n').includes('data-lang="nosuchlang"'));
  });

  test('data-lang の値はエスケープされる', () => {
    const out = html('```a"b\nx\n```\n');
    assert.ok(!out.includes('data-lang="a"b"'), out);
  });

  test('言語指定が無ければ、装飾なしでエスケープして表示する', () => {
    const out = html('```\nif (a < b) {}\n```\n');
    assert.match(out, /<pre[^>]*><code>if \(a &lt; b\) \{\}\n<\/code><\/pre>/);
  });

  test('未対応の言語なら、装飾なしでエスケープして表示する', () => {
    const out = html('```nosuchlang\n<tag>\n```\n');
    assert.match(
      out,
      /<div class="yomu-code" data-lang="nosuchlang"[^>]*><pre><code class="language-nosuchlang">&lt;tag&gt;\n<\/code><\/pre><\/div>/
    );
    assert.ok(!out.includes('hljs-'), out);
  });

  test('インラインコードは等幅の code になる', () => {
    assert.ok(html('use `npm test` now\n').includes('<code>npm test</code>'));
  });
});

suite('render: タスクリスト', () => {
  test('チェック状態がチェックボックスに反映され、操作はできない', () => {
    const out = html('- [ ] todo\n- [x] done\n');
    const boxes = out.match(/<input[^>]*>/g) ?? [];
    assert.strictEqual(boxes.length, 2, out);
    assert.ok(/type="checkbox"/.test(boxes[0]) && !/checked/.test(boxes[0]), boxes[0]);
    assert.ok(/type="checkbox"/.test(boxes[1]) && /checked/.test(boxes[1]), boxes[1]);
    assert.ok(
      boxes.every((box) => /disabled/.test(box)),
      out
    );
  });
});

suite('renderSafely: 例外時の表示', () => {
  test('変換に成功したら render と同じ HTML', () => {
    assert.strictEqual(
      renderSafely('# a\n', { resolveImageSrc }),
      render('# a\n', { resolveImageSrc })
    );
  });

  test('変換中に例外が出ても白紙にならず、エラーの内容をエスケープして表示する', () => {
    const boom = (): string => {
      throw new Error('resolver <broke>');
    };
    const out = renderSafely('![x](./a.png)\n', { resolveImageSrc: boom });
    assert.ok(out.includes('class="yomu-error"'), out);
    assert.ok(out.includes('resolver &lt;broke&gt;'), out);
    assert.ok(!out.includes('<broke>'), out);
  });

  test('Error でないものが投げられても表示できる', () => {
    const boom = (): string => {
      // eslint-disable-next-line no-throw-literal -- Error でないものが投げられた場合の検証
      throw 'plain string';
    };
    const out = renderSafely('![x](./a.png)\n', { resolveImageSrc: boom });
    assert.ok(out.includes('plain string'), out);
  });
});

suite('render: Mermaid', () => {
  test('言語が mermaid のブロックは、Webview で描く枠に入れ、ソースはエスケープして持つ', () => {
    const out = html('```mermaid\nflowchart LR\n  A --> B<br>\n```\n');
    assert.ok(out.includes('<div class="yomu-mermaid"'), out);
    assert.ok(
      out.includes('<pre class="yomu-mermaid-source">flowchart LR\n  A --&gt; B&lt;br&gt;\n</pre>'),
      out
    );
    assert.ok(!out.includes('hljs-'), 'Mermaid のソースをハイライトしている');
    assert.ok(!out.includes('yomu-code'), '言語ラベルの枠に入っている');
  });

  test('言語名の大文字小文字は問わない', () => {
    assert.ok(html('```Mermaid\npie\n```\n').includes('class="yomu-mermaid"'));
  });
});

suite('render: 元の行番号', () => {
  const markdown = [
    '# 見出し', // 0
    '', // 1
    '段落', // 2
    '', // 3
    '- 項目 1', // 4
    '- 項目 2', // 5
    '', // 6
    '> 引用', // 7
    '', // 8
    '```ts', // 9
    'const a = 1;', // 10
    '```', // 11
    '', // 12
    '| a |', // 13
    '| - |', // 14
    '| 1 |', // 15
    '', // 16
    '```mermaid', // 17
    'pie', // 18
    '```', // 19
    '', // 20
    '```', // 21
    'plain', // 22
    '```', // 23
  ].join('\n');

  test('ブロックの要素に、元の Markdown の行番号（0 始まり）を data-line で付ける', () => {
    const out = html(markdown);
    assert.ok(out.includes('<h1 id="見出し" data-line="0">'), out);
    assert.ok(out.includes('<p data-line="2">段落</p>'), out);
    assert.ok(out.includes('<li data-line="4">'), out);
    assert.ok(out.includes('<li data-line="5">'), out);
    assert.ok(out.includes('<blockquote data-line="7">'), out);
    assert.ok(out.includes('<div class="yomu-code" data-lang="ts" data-line="9">'), out);
    assert.ok(out.includes('<table data-line="13">'), out);
    assert.ok(out.includes('<div class="yomu-mermaid" data-line="17">'), out);
    assert.ok(out.includes('<pre data-line="21">'), out);
  });

  test('リストや引用の中の段落には付けない（外側の要素で足りる）', () => {
    const out = html('- 項目\n\n  続き\n');
    assert.ok(!/<p data-line/.test(out), out);
  });
});

suite('render: front matter', () => {
  test('ファイルの先頭の front matter を、キーと値の表にする', () => {
    const out = html('---\ntitle: Hello\nauthor: Yomu\n---\n\n# Body\n');
    assert.ok(out.includes('<table class="yomu-front-matter" data-line="0">'), out);
    assert.ok(out.includes('<tr><th>title</th><td>Hello</td></tr>'), out);
    assert.ok(out.includes('<tr><th>author</th><td>Yomu</td></tr>'), out);
    assert.ok(!out.includes('<hr'), out);
    assert.ok(!out.includes('<h2'), out);
  });

  test('front matter の後のブロックは、元の行番号を保つ', () => {
    const out = html('---\ntitle: Hello\n---\n\n# Body\n');
    assert.ok(out.includes('<h1 id="body" data-line="4">'), out);
  });

  test('値を囲む引用符は外す', () => {
    const out = html('---\ntitle: "Hello: World"\nnote: \'single\'\n---\n');
    assert.ok(out.includes('<td>Hello: World</td>'), out);
    assert.ok(out.includes('<td>single</td>'), out);
  });

  test('複数行の値（リストや入れ子）は、書かれたままの形で表示する', () => {
    const out = html('---\ntags:\n  - markdown\n  - vscode\ndraft: false\n---\n');
    assert.ok(out.includes('<tr><th>tags</th><td><pre>- markdown\n- vscode</pre></td></tr>'), out);
    assert.ok(out.includes('<tr><th>draft</th><td>false</td></tr>'), out);
  });

  test('キーと値はエスケープする', () => {
    const out = html('---\ntitle: <b>x</b> & y\n---\n');
    assert.ok(out.includes('<td>&lt;b&gt;x&lt;/b&gt; &amp; y</td>'), out);
  });

  test('ファイルの途中の --- で囲まれた部分は front matter にしない', () => {
    const out = html('# Top\n\n---\ntitle: Hello\n---\n');
    assert.ok(!out.includes('yomu-front-matter'), out);
    assert.ok(out.includes('<hr'), out);
  });

  test('閉じる --- が無ければ front matter にしない', () => {
    const out = html('---\ntitle: Hello\n\nText\n');
    assert.ok(!out.includes('yomu-front-matter'), out);
  });

  test('中身が「キー: 値」の形でなければ front matter にしない（先頭の水平線として扱う）', () => {
    const out = html('---\n\n# Title\n\n---\n');
    assert.ok(!out.includes('yomu-front-matter'), out);
    assert.ok(out.includes('<h1'), out);
  });
});
