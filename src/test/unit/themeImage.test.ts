import * as assert from 'assert';
import * as path from 'path';
import { planThemeImage, screenshotPath } from '../../tooling/themeImage';
import { THEMES } from '../../reader/readerSettings';

const DIR = path.join('docs', 'images');

suite('screenshotPath', () => {
  test('docs/images/theme-<テーマ名>.png を指す', () => {
    assert.strictEqual(screenshotPath(DIR, 'nord'), path.join(DIR, 'theme-nord.png'));
  });
});

suite('planThemeImage', () => {
  test('テーマの順に、3 列の格子へ並べる', () => {
    const plan = planThemeImage(['a', 'b', 'c', 'd'], DIR, () => true);
    assert.deepStrictEqual(
      plan.tiles.map((tile) => [tile.label, tile.x, tile.y]),
      [
        ['a', 18, 18],
        ['b', 487, 18],
        ['c', 956, 18],
        ['d', 18, 367],
      ]
    );
    assert.deepStrictEqual(
      plan.tiles.map((tile) => tile.source),
      ['a', 'b', 'c', 'd'].map((theme) => screenshotPath(DIR, theme))
    );
  });

  test('画像はテーマ名の下に置き、スクリーンショットの左上を切り出して 0.55 倍にする', () => {
    const plan = planThemeImage(['a'], DIR, () => true);
    assert.deepStrictEqual(plan.crop, { width: 820, height: 544 });
    assert.deepStrictEqual(
      { width: plan.tileWidth, height: plan.tileHeight },
      { width: 451, height: 299 }
    );
    assert.strictEqual(plan.tiles[0].imageY, plan.tiles[0].y + plan.labelHeight);
  });

  test('全体の大きさは、列と段の数に合わせる（11 テーマなら 3 列 4 段）', () => {
    const plan = planThemeImage(THEMES, DIR, () => true);
    assert.strictEqual(plan.tiles.length, THEMES.length);
    assert.deepStrictEqual(
      { width: plan.width, height: plan.height },
      { width: 1425, height: 1414 }
    );
  });

  test('スクリーンショットが無いテーマがあれば、その名前をすべて挙げて失敗する', () => {
    const missing = new Set([screenshotPath(DIR, 'b'), screenshotPath(DIR, 'd')]);
    assert.throws(
      () => planThemeImage(['a', 'b', 'c', 'd'], DIR, (file) => !missing.has(file)),
      (error: Error) =>
        error.message.includes('theme-b.png') && error.message.includes('theme-d.png')
    );
  });
});
