import * as assert from 'assert';
import { DEFAULT_SETTINGS, cssVariables, normalizeSettings } from '../../reader/readerSettings';

suite('normalizeSettings', () => {
  test('何も無ければ既定値', () => {
    assert.deepStrictEqual(normalizeSettings({}), DEFAULT_SETTINGS);
    assert.strictEqual(DEFAULT_SETTINGS.theme, 'paper');
    assert.strictEqual(DEFAULT_SETTINGS.maxWidth, 820);
    assert.strictEqual(DEFAULT_SETTINGS.align, 'center');
    assert.strictEqual(DEFAULT_SETTINGS.padding, 32);
    assert.strictEqual(DEFAULT_SETTINGS.fontSize, 16);
    assert.strictEqual(DEFAULT_SETTINGS.lineHeight, 1.8);
    assert.strictEqual(DEFAULT_SETTINGS.codeFontFamily, '');
    assert.strictEqual(DEFAULT_SETTINGS.customCss, '');
    assert.strictEqual(DEFAULT_SETTINGS.frontMatter, 'collapsed');
  });

  test('正しい値はそのまま通る', () => {
    const settings = normalizeSettings({
      theme: 'dark',
      maxWidth: 720,
      align: 'left',
      padding: 16,
      fontFamily: '"Noto Sans JP", sans-serif',
      codeFontFamily: 'Consolas',
      fontSize: 18,
      lineHeight: 2,
      customCss: '${workspaceFolder}/style.css',
      focusMode: true,
      foldLines: 30,
      frontMatter: 'hidden',
    });
    assert.deepStrictEqual(settings, {
      theme: 'dark',
      maxWidth: 720,
      align: 'left',
      padding: 16,
      fontFamily: '"Noto Sans JP", sans-serif',
      codeFontFamily: 'Consolas',
      fontSize: 18,
      lineHeight: 2,
      customCss: '${workspaceFolder}/style.css',
      focusMode: true,
      foldLines: 30,
      frontMatter: 'hidden',
    });
  });

  test('追加のテーマ（Solarized、GitHub、Nord、Catppuccin）も受け付ける', () => {
    for (const theme of [
      'solarized-light',
      'solarized-dark',
      'github-light',
      'github-dark',
      'nord',
      'catppuccin-latte',
      'catppuccin-mocha',
    ]) {
      assert.strictEqual(normalizeSettings({ theme }).theme, theme);
    }
  });

  test('front matter の表示は、collapsed、expanded、hidden のどれか', () => {
    assert.strictEqual(normalizeSettings({ frontMatter: 'expanded' }).frontMatter, 'expanded');
    assert.strictEqual(normalizeSettings({ frontMatter: 'show' }).frontMatter, 'collapsed');
  });

  test('列挙に無い値は既定値に戻す', () => {
    assert.strictEqual(normalizeSettings({ theme: 'neon' }).theme, 'paper');
    assert.strictEqual(normalizeSettings({ align: 'middle' }).align, 'center');
    assert.strictEqual(normalizeSettings({ theme: 1 }).theme, 'paper');
  });

  test('範囲外の数値は既定値に戻す。maxWidth の 0 は「制限なし」として通す', () => {
    assert.strictEqual(normalizeSettings({ maxWidth: -1 }).maxWidth, 820);
    assert.strictEqual(normalizeSettings({ maxWidth: 0 }).maxWidth, 0);
    assert.strictEqual(normalizeSettings({ maxWidth: '900' }).maxWidth, 820);
    assert.strictEqual(normalizeSettings({ padding: -5 }).padding, 32);
    assert.strictEqual(normalizeSettings({ fontSize: 3 }).fontSize, 16);
    assert.strictEqual(normalizeSettings({ fontSize: 100 }).fontSize, 16);
    assert.strictEqual(normalizeSettings({ lineHeight: 0.5 }).lineHeight, 1.8);
    assert.strictEqual(normalizeSettings({ lineHeight: 5 }).lineHeight, 1.8);
    assert.strictEqual(normalizeSettings({ lineHeight: Number.NaN }).lineHeight, 1.8);
  });

  test('font-family は CSS の値にそのまま入るので、; { } を含むものは既定値に戻す', () => {
    assert.strictEqual(
      normalizeSettings({ fontFamily: 'Arial; color: red' }).fontFamily,
      DEFAULT_SETTINGS.fontFamily
    );
    assert.strictEqual(
      normalizeSettings({ fontFamily: 'a } body {' }).fontFamily,
      DEFAULT_SETTINGS.fontFamily
    );
    assert.strictEqual(normalizeSettings({ codeFontFamily: 'x;' }).codeFontFamily, '');
    assert.strictEqual(
      normalizeSettings({ fontFamily: '   ' }).fontFamily,
      DEFAULT_SETTINGS.fontFamily
    );
    assert.strictEqual(normalizeSettings({ fontFamily: '  Meiryo  ' }).fontFamily, 'Meiryo');
  });

  test('集中モードは既定でオフ。真偽値でなければオフ', () => {
    assert.strictEqual(DEFAULT_SETTINGS.focusMode, false);
    assert.strictEqual(normalizeSettings({ focusMode: true }).focusMode, true);
    assert.strictEqual(normalizeSettings({ focusMode: 'yes' }).focusMode, false);
  });

  test('コードの折りたたみは既定で 20 行。0 は畳まない。範囲外や数でなければ既定値', () => {
    assert.strictEqual(DEFAULT_SETTINGS.foldLines, 20);
    assert.strictEqual(normalizeSettings({ foldLines: 0 }).foldLines, 0);
    assert.strictEqual(normalizeSettings({ foldLines: 40 }).foldLines, 40);
    assert.strictEqual(normalizeSettings({ foldLines: -1 }).foldLines, 20);
    assert.strictEqual(normalizeSettings({ foldLines: 2.5 }).foldLines, 20);
    assert.strictEqual(normalizeSettings({ foldLines: '30' }).foldLines, 20);
  });

  test('customCss は前後の空白を落とし、文字列でなければ空', () => {
    assert.strictEqual(normalizeSettings({ customCss: '  /a/b.css ' }).customCss, '/a/b.css');
    assert.strictEqual(normalizeSettings({ customCss: 3 }).customCss, '');
  });
});

suite('cssVariables', () => {
  test('既定値から CSS 変数を作る', () => {
    const vars = cssVariables(DEFAULT_SETTINGS);
    assert.strictEqual(vars['--yomu-max-width'], '820px');
    assert.strictEqual(vars['--yomu-margin-left'], 'auto');
    assert.strictEqual(vars['--yomu-margin-right'], 'auto');
    assert.strictEqual(vars['--yomu-padding'], '32px');
    assert.strictEqual(vars['--yomu-font-family'], DEFAULT_SETTINGS.fontFamily);
    // コードの既定は、半角と全角が 1:2 の和文等幅フォントを土台にする。和文を含むテキストの図が揃う。
    // 罫線（─ │ ┌）や三角（▶ ▼）は和文等幅フォントだと全角の幅になるので、その範囲だけ先頭の
    // Yomu Symbols（欧文の等幅フォントを半角の幅に縮めたもの。media/fonts.css）で描く
    const code = vars['--yomu-code-font-family'];
    assert.ok(
      code.startsWith(
        "'Yomu Symbols Cascadia', 'Yomu Symbols Consolas', 'Yomu Symbols Menlo', 'Yomu Symbols DejaVu', 'Yomu Symbols Liberation', 'BIZ UDGothic', 'Osaka-Mono', 'Noto Sans Mono CJK JP', 'MS Gothic'"
      ),
      code
    );
    assert.ok(code.trim().endsWith('monospace'), code);
    assert.strictEqual(vars['--yomu-font-size'], '16px');
    assert.strictEqual(vars['--yomu-line-height'], '1.8');
  });

  test('maxWidth の 0 は none、align は margin の auto と 0 で表す', () => {
    assert.strictEqual(
      cssVariables({ ...DEFAULT_SETTINGS, maxWidth: 0 })['--yomu-max-width'],
      'none'
    );
    const left = cssVariables({ ...DEFAULT_SETTINGS, align: 'left' });
    assert.strictEqual(left['--yomu-margin-left'], '0');
    assert.strictEqual(left['--yomu-margin-right'], 'auto');
    const right = cssVariables({ ...DEFAULT_SETTINGS, align: 'right' });
    assert.strictEqual(right['--yomu-margin-left'], 'auto');
    assert.strictEqual(right['--yomu-margin-right'], '0');
  });

  test('コードのフォントを指定すると、そのまま入る', () => {
    const vars = cssVariables({ ...DEFAULT_SETTINGS, codeFontFamily: '"Fira Code", monospace' });
    assert.strictEqual(vars['--yomu-code-font-family'], '"Fira Code", monospace');
  });

  test('変数名はすべて --yomu- で始まり、値に ; や } を含まない', () => {
    for (const [name, value] of Object.entries(cssVariables(DEFAULT_SETTINGS))) {
      assert.ok(name.startsWith('--yomu-'), name);
      assert.ok(!/[;{}]/.test(value), name + ': ' + value);
    }
  });
});
