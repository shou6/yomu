import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

// out/test/unit から見たプロジェクトルート
const ROOT = path.resolve(__dirname, '../../..');

function readerCss(): string {
  return fs.readFileSync(path.join(ROOT, 'media', 'reader.css'), 'utf8');
}

suite('reader.css: Mermaid', () => {
  test('円グラフは最大幅を 480px に抑える', () => {
    // mermaid は円グラフを高さ 450 の固定の枠で描き、style 属性の max-width で本文の幅いっぱいまで広げる。
    // 他の図は中身に合わせた大きさになるので、円グラフだけが大きく見える。style 属性に勝つよう !important を付ける
    const rule = readerCss().match(
      /\.yomu-mermaid svg\[aria-roledescription='pie'\]\s*{([^}]*)}/
    )?.[1];
    assert.ok(rule, '円グラフの規則が無い');
    assert.match(rule, /max-width:\s*min\(100%,\s*480px\)\s*!important/);
  });
});

suite('reader.css: ズーム表示', () => {
  test('重ね表示の画像は、最大の幅と高さの制限を外す', () => {
    // VS Code は Webview に既定の CSS（img { max-width: 100%; max-height: 100%; }）を差し込む。
    // 重ね表示では元の大きさで置いて transform で縮めるので、高さだけ画面に抑えられると縦に潰れる
    const rule = readerCss().match(/\.yomu-zoom-content\s*{([^}]*)}/)?.[1];
    assert.ok(rule, '.yomu-zoom-content の規則が無い');
    assert.match(rule, /max-width:\s*none/);
    assert.match(rule, /max-height:\s*none/);
  });
});

suite('reader.css: 表', () => {
  test('セルは語の途中で折らない（数字やコードが縦に割れない）', () => {
    // anywhere は最小幅の計算にも効き、狭い列が 1 文字幅まで縮んで数字やコードが途中で折れる。
    // break-word は収まらない語だけを折るので、列は語の幅を保つ。和文は普段どおり文字の間で折り返す
    const rule = readerCss().match(/(?:^|\n)td\s*{([^}]*)}/)?.[1];
    assert.ok(rule, 'td の規則が無い');
    assert.match(rule, /overflow-wrap:\s*break-word/);
  });
});
