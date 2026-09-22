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
