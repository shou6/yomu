import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { THEMES } from '../../reader/readerSettings';

// out/test/unit から見たプロジェクトルート
const ROOT = path.resolve(__dirname, '../../..');
const THEMES_DIR = path.join(ROOT, 'media', 'themes');

/** CSS の中で定義している --yomu-* の変数名 */
function definedVariables(css: string): Set<string> {
  return new Set([...css.matchAll(/(--yomu-[\w-]+)\s*:/g)].map((m) => m[1]));
}

/** CSS の中で参照している --yomu-* の変数名 */
function usedVariables(css: string): Set<string> {
  return new Set([...css.matchAll(/var\(\s*(--yomu-[\w-]+)/g)].map((m) => m[1]));
}

suite('テーマの CSS', () => {
  test('設定で選べるテーマごとに、media/themes/<name>.css がある', () => {
    for (const theme of THEMES) {
      assert.ok(fs.existsSync(path.join(THEMES_DIR, theme + '.css')), theme + '.css が無い');
    }
  });

  test('各テーマは同じ変数の組を定義している（構成が共通で、色だけが違う）', () => {
    const sets = THEMES.map((theme) => ({
      theme,
      names: definedVariables(fs.readFileSync(path.join(THEMES_DIR, theme + '.css'), 'utf8')),
    }));
    const base = sets[0];
    for (const other of sets.slice(1)) {
      assert.deepStrictEqual(
        [...other.names].sort(),
        [...base.names].sort(),
        other.theme + ' と ' + base.theme + ' で定義している変数が違う'
      );
    }
  });

  test('各テーマは自分の data-theme のセレクタの中で定義している', () => {
    for (const theme of THEMES) {
      const css = fs.readFileSync(path.join(THEMES_DIR, theme + '.css'), 'utf8');
      assert.ok(css.includes(`body[data-theme='${theme}']`), theme + '.css にセレクタが無い');
    }
  });

  test('reader.css と highlight.css が参照する --yomu-* は、設定由来の変数を除いてテーマが定義している', () => {
    const defined = definedVariables(fs.readFileSync(path.join(THEMES_DIR, 'paper.css'), 'utf8'));
    // 設定（readerSettings の cssVariables）から入る変数
    const fromSettings = new Set([
      '--yomu-max-width',
      '--yomu-margin-left',
      '--yomu-margin-right',
      '--yomu-padding',
      '--yomu-font-family',
      '--yomu-code-font-family',
      '--yomu-font-size',
      '--yomu-line-height',
    ]);
    for (const file of ['reader.css', 'highlight.css']) {
      const used = usedVariables(fs.readFileSync(path.join(ROOT, 'media', file), 'utf8'));
      const missing = [...used].filter((name) => !defined.has(name) && !fromSettings.has(name));
      assert.deepStrictEqual(missing, [], file + ' が参照する変数がテーマに無い');
    }
  });

  test('古い theme.css は残っていない（themes/ に分けた）', () => {
    assert.ok(!fs.existsSync(path.join(ROOT, 'media', 'theme.css')));
  });
});
