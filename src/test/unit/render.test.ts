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
    assert.ok(out.includes('<p>Hello <strong>world</strong> and <em>you</em>.</p>'), out);
  });

  test('GFM の表と取り消し線を変換する', () => {
    const out = html('| a | b |\n| - | - |\n| 1 | 2 |\n\n~~gone~~\n');
    assert.ok(out.includes('<table>'), out);
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
    assert.ok(out.includes('<h2 id="はじめに">'), out);
    assert.ok(out.includes('<h2 id="getting-started">'), out);
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
});

suite('render: コードブロック', () => {
  test('言語指定があれば、その言語でハイライトする', () => {
    const out = html('```ts\nconst a: number = 1;\n```\n');
    assert.ok(
      out.includes('<div class="yomu-code" data-lang="ts"><pre><code class="language-ts">'),
      out
    );
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
    assert.ok(
      out.includes('<div class="yomu-code" data-lang="ts"><pre><code class="language-ts">'),
      out
    );
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
    assert.ok(out.includes('<pre><code>if (a &lt; b) {}\n</code></pre>'), out);
  });

  test('未対応の言語なら、装飾なしでエスケープして表示する', () => {
    const out = html('```nosuchlang\n<tag>\n```\n');
    assert.ok(
      out.includes(
        '<div class="yomu-code" data-lang="nosuchlang"><pre><code class="language-nosuchlang">&lt;tag&gt;\n</code></pre></div>'
      ),
      out
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
    assert.ok(out.includes('<div class="yomu-mermaid">'), out);
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
