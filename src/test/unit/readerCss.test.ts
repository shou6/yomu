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

/** セレクタがちょうど selector の規則の中身。無ければ undefined */
function rule(selector: string): string | undefined {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
  return readerCss().match(new RegExp(`(?:^|\\n|})\\s*${escaped}\\s*{([^}]*)}`))?.[1];
}

suite('reader.css: 本文の幅と余白', () => {
  test('左右の余白は、ウィンドウの幅に対する割合（設定）にし、狭くても縁から最低限は離す', () => {
    const body = rule('body');
    assert.ok(body, 'body の規則が無い');
    assert.match(body, /padding:\s*0 max\(\d+px,\s*var\(--yomu-side-margin[^)]*\)\)/);
  });

  test('本文の左右の余白を px で固定しない（幅はウィンドウに合わせて伸び縮みさせる）', () => {
    const content = rule('#content');
    assert.ok(content, '#content の規則が無い');
    assert.doesNotMatch(content, /--yomu-padding/);
    assert.match(content, /padding:\s*2em 0/);
  });
});

suite('reader.css: 列の多い表', () => {
  test('表は枠の中で横スクロールする（ページ全体をスクロールさせない）', () => {
    const wrapper = rule('.yomu-table');
    assert.ok(wrapper, '.yomu-table の規則が無い');
    assert.match(wrapper, /overflow-x:\s*auto/);
  });

  test('横に続きがある側の端に影を出し、表が切れているのではなく続いていると分かるようにする', () => {
    // 影は scroll、それを隠す背景色の覆いは local で描く。端までスクロールすると覆いが影に重なって消える
    const wrapper = rule('.yomu-table') ?? '';
    assert.match(wrapper, /background:[^;]*\blocal\b[^;]*\bscroll\b/);
  });

  test('枠の横のスクロールバーは常に見せ、スクロールできることが分かるようにする', () => {
    const bar = rule('.yomu-table::-webkit-scrollbar');
    assert.ok(bar, 'スクロールバーの規則が無い');
    assert.match(bar, /height:\s*\d+px/);
    assert.ok(rule('.yomu-table::-webkit-scrollbar-thumb'), 'スクロールバーのつまみの規則が無い');
  });

  test('表は中身の幅にし、本文より狭い表を引き伸ばさない（数字の列の間が空きすぎない）', () => {
    const table = readerCss().match(/(?:^|\n)table\s*{([^}]*)}/)?.[1] ?? '';
    assert.doesNotMatch(table, /width:\s*100%/);
  });

  test('セルに最小幅を付け、和文の列が 1〜2 文字の幅まで縮まないようにする', () => {
    const td = readerCss().match(/(?:^|\n)td\s*{([^}]*)}/)?.[1] ?? '';
    const minWidth = Number(td.match(/min-width:\s*([\d.]+)em/)?.[1]);
    assert.ok(minWidth >= 4, `td の min-width が ${minWidth}em`);
  });

  test('短いセル（webview/table.ts が印を付ける）は折り返さない', () => {
    const short = rule('td.yomu-cell-short');
    assert.ok(short, 'td.yomu-cell-short の規則が無い');
    assert.match(short, /white-space:\s*nowrap/);
  });
});

suite('reader.css: リスト', () => {
  test('リストの行間は本文と揃える（リストだけ line-height を変えない）', () => {
    const list = rule('ul,\nol');
    assert.ok(list, 'ul, ol の規則が無い');
    assert.doesNotMatch(list, /line-height/);
  });

  test('子を持つ項目と次の項目の間は、グループ内より見て分かるだけ広く空ける', () => {
    const em = (selector: string): number =>
      Number(rule(selector)?.match(/margin-top:\s*([\d.]+)em/)?.[1] ?? NaN);
    const group = em('li:has(> ul, > ol) + li');
    const sibling = em('li + li');
    // 1em（16px）の差があれば、行間（1.8 で 29px）に埋もれず切れ目として見える
    assert.ok(group - sibling >= 0.75, `グループの間 ${group}em、項目の間 ${sibling}em`);
  });

  test('入れ子のリストの前に少し間隔を空ける', () => {
    const nested = rule('li > ul,\nli > ol');
    assert.ok(nested, '入れ子のリストの規則が無い');
    assert.match(nested, /margin:\s*0\.\d+em 0 0/);
  });

  test('記号の色は本文より薄くする', () => {
    const marker = rule('li::marker');
    assert.ok(marker, 'li::marker の規則が無い');
    assert.match(marker, /color:/);
  });

  test('入れ子のタスクリストは、親のタスクの文字の位置まで字下げする', () => {
    const nested = rule('li > ul.contains-task-list');
    assert.ok(nested, '入れ子のタスクリストの規則が無い');
    assert.match(nested, /padding-left:\s*1\.\d+em/);
  });

  test('番号の桁数に応じて、番号付きリストの左の余白を広げる', () => {
    assert.ok(rule("ol[data-digits='2']"), '2 桁の規則が無い');
    assert.ok(rule("ol[data-digits='3']"), '3 桁の規則が無い');
  });
});

suite('reader.css: 見出し', () => {
  test('移動した時に見出しが画面の上端に貼り付かないよう、上に間隔を空ける', () => {
    const headings = readerCss().match(/h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6\s*{([^}]*)}/)?.[1];
    assert.ok(headings, '見出しの規則が無い');
    assert.match(headings, /scroll-margin-top:/);
  });
});

suite('reader.css: コードのコピー', () => {
  test('コピーのボタンは、マウスを乗せた時とフォーカスした時に出す', () => {
    assert.ok(rule('.yomu-copy-button'), '.yomu-copy-button の規則が無い');
    assert.match(readerCss(), /:hover\s*>\s*\.yomu-copy-button/);
    assert.match(readerCss(), /\.yomu-copy-button:focus-visible/);
  });
});
