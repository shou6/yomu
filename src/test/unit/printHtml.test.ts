import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { injectMermaid, printHtml, rewriteFontUrls } from '../../reader/printHtml';

// out/test/unit から見たプロジェクトルート
const ROOT = path.resolve(__dirname, '../../..');

suite('rewriteFontUrls', () => {
  test('fonts.css の ../fonts/ を、同梱フォントのフォルダの URI に書き換える', () => {
    const css = "src: url('../fonts/A.woff2') format('woff2'); src: url(\"../fonts/B.woff2\");";
    assert.strictEqual(
      rewriteFontUrls(css, 'file:///ext/fonts'),
      "src: url('file:///ext/fonts/A.woff2') format('woff2'); src: url(\"file:///ext/fonts/B.woff2\");"
    );
  });
});

suite('injectMermaid', () => {
  const html =
    '<p>a</p>\n<div class="yomu-mermaid"><pre class="yomu-mermaid-source">flowchart</pre></div>\n' +
    '<div class="yomu-mermaid"><pre class="yomu-mermaid-source">pie</pre></div>\n';

  test('Mermaid の枠を、上から順にリーダーが描いた SVG に差し替える', () => {
    const out = injectMermaid(html, ['<svg id="a"></svg>', '<svg id="b"></svg>']);
    assert.ok(out.includes('<div class="yomu-mermaid"><svg id="a"></svg></div>'), out);
    assert.ok(out.includes('<div class="yomu-mermaid"><svg id="b"></svg></div>'), out);
    assert.ok(!out.includes('yomu-mermaid-source'), out);
  });

  test('描けていない図（null）はソースのまま残す', () => {
    const out = injectMermaid(html, [null, '<svg id="b"></svg>']);
    assert.ok(out.includes('<pre class="yomu-mermaid-source">flowchart</pre>'), out);
    assert.ok(out.includes('<svg id="b"></svg>'), out);
  });

  test('SVG の数が足りなければ、残りはソースのまま', () => {
    const out = injectMermaid(html, ['<svg id="a"></svg>']);
    assert.ok(out.includes('<pre class="yomu-mermaid-source">pie</pre>'), out);
  });
});

suite('printHtml', () => {
  const params = {
    title: 'a <b> & c.md',
    body: '<h1 id="x">X</h1>',
    css: ['body { color: red; }', '@media print { pre { white-space: pre-wrap; } }'],
    cssVariables: { '--yomu-max-width': '820px', '--yomu-font-size': '16px' },
  };

  test('1 つの HTML にまとめる。題名はエスケープし、CSS と本文を埋め込む', () => {
    const out = printHtml(params);
    assert.ok(out.startsWith('<!DOCTYPE html>'), out);
    assert.ok(out.includes('<title>a &lt;b&gt; &amp; c.md</title>'), out);
    assert.ok(out.includes('body { color: red; }'), out);
    assert.ok(out.includes('<main id="content"><h1 id="x">X</h1></main>'), out);
  });

  test('設定の CSS 変数を :root に書き、印刷はテーマに関わらず paper にする', () => {
    const out = printHtml(params);
    assert.ok(out.includes(':root { --yomu-max-width: 820px; --yomu-font-size: 16px; }'), out);
    assert.ok(out.includes('<body data-theme="paper">'), out);
  });

  test('開いたら印刷のダイアログを出す', () => {
    assert.ok(printHtml(params).includes('window.print()'));
  });
});

suite('media/print.css', () => {
  const css = fs.readFileSync(path.join(ROOT, 'media', 'print.css'), 'utf8');

  test('印刷の時だけ効く', () => {
    assert.ok(css.includes('@media print'));
  });

  test('コードは折り返し、見出しの直後や表・図・コードの途中で改ページしない', () => {
    assert.match(css, /white-space:\s*pre-wrap/);
    assert.match(css, /break-after:\s*avoid/);
    assert.match(css, /break-inside:\s*avoid/);
  });

  test('外部リンクの URL を併記する', () => {
    assert.match(css, /a\[href\^='http'\]::after/);
  });

  test('公開パッケージに入る（media/** に含まれる）', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
      files: string[];
    };
    assert.ok(pkg.files.includes('media/**'));
  });
});
