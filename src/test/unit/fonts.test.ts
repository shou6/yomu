import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_SETTINGS } from '../../reader/readerSettings';

// out/test/unit から見たプロジェクトルート
const ROOT = path.resolve(__dirname, '../../..');
const FONTS_DIR = path.join(ROOT, 'fonts');

function fontsCss(): string {
  return fs.readFileSync(path.join(ROOT, 'media', 'fonts.css'), 'utf8');
}

/** fonts/ のファイルを url() で読む @font-face の書体名。local() だけの書体（システムフォントの別名）は含めない */
function bundledFamilies(): string[] {
  const faces = fontsCss().match(/@font-face\s*{[^}]*}/g) ?? [];
  return [
    ...new Set(
      faces
        .filter((face) => face.includes('url('))
        .map((face) => face.match(/font-family:\s*['"]([^'"]+)['"]/)?.[1])
        .filter((family): family is string => family !== undefined)
    ),
  ];
}

suite('同梱フォント', () => {
  test('fonts.css の @font-face が参照するファイルは fonts/ にある', () => {
    const urls = [...fontsCss().matchAll(/url\(['"]?\.\.\/fonts\/([^'")]+)['"]?\)/g)].map(
      (m) => m[1]
    );
    assert.ok(urls.length >= 2, '@font-face が足りない: ' + urls.join(', '));
    for (const file of urls) {
      assert.ok(fs.existsSync(path.join(FONTS_DIR, file)), file + ' が無い');
      assert.match(file, /\.woff2$/, 'woff2 でない: ' + file);
    }
  });

  test('fonts.css の font-family ごとに、OFL のライセンスファイルが fonts/ にある', () => {
    const families = bundledFamilies();
    assert.ok(families.length >= 1);
    const licenses = fs.readdirSync(FONTS_DIR).filter((name) => /^OFL-.*\.txt$/.test(name));
    assert.strictEqual(licenses.length, families.length, 'ライセンスの数が書体の数と合わない');
    for (const license of licenses) {
      const text = fs.readFileSync(path.join(FONTS_DIR, license), 'utf8');
      assert.ok(text.includes('SIL Open Font License'), license + ' が OFL でない');
    }
  });

  test('本文のフォントの既定値は、同梱フォントを含む', () => {
    for (const family of bundledFamilies()) {
      assert.ok(DEFAULT_SETTINGS.fontFamily.includes(family), family + ' が既定値に無い');
    }
  });

  test('fonts/ は公開パッケージに入る', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
      files: string[];
    };
    assert.ok(pkg.files.includes('fonts/**'));
  });

  test('コードの罫線・矢印・図形は、1 文字幅で描く等幅フォントに振り向ける', () => {
    // 罫線（─ │ ┌）や三角（▶ ▼）は東アジアの文字幅が曖昧な文字で、和文の等幅フォント（HackGen など）は
    // 1.5〜2 文字幅で描く。半角前提で書かれたテキストの図がずれるので、この範囲だけ欧文の等幅フォントで描く
    const css = fontsCss();
    const face = css.match(/@font-face\s*{[^}]*font-family:\s*'Yomu Mono Symbols'[^}]*}/)?.[0];
    assert.ok(face, 'Yomu Mono Symbols の @font-face が無い');
    for (const range of ['U+2190-21FF', 'U+2500-257F', 'U+2580-259F', 'U+25A0-25FF']) {
      assert.ok(face.includes(range), range + ' が unicode-range に無い');
    }
    for (const font of ['Cascadia Mono', 'Consolas', 'Menlo', 'DejaVu Sans Mono']) {
      assert.ok(face.includes(`local('${font}')`), font + ' が src に無い');
    }
    const reader = fs.readFileSync(path.join(ROOT, 'media', 'reader.css'), 'utf8');
    const codeFonts = [
      ...reader.matchAll(/font-family:\s*([^;]*var\(--yomu-code-font-family[^;]*);/g),
    ];
    assert.ok(codeFonts.length >= 2, 'コードの font-family が見つからない');
    for (const [, value] of codeFonts) {
      assert.ok(value.trim().startsWith("'Yomu Mono Symbols'"), 'コードの先頭に無い: ' + value);
    }
  });
});
