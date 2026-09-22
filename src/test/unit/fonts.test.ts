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

  test('Yomu Symbols は、欧文の等幅フォントの罫線と図形を、ちょうど半角（0.5em）の幅に縮める', () => {
    // 各フォントの ASCII と罫線の字幅（em）。fontTools で hmtx の値を unitsPerEm で割って測った
    const advances: Record<string, { local: string; advance: number }> = {
      'Yomu Symbols Cascadia': { local: 'CascadiaMono-Regular', advance: 1200 / 2048 },
      'Yomu Symbols Consolas': { local: 'Consolas', advance: 1126 / 2048 },
      'Yomu Symbols Menlo': { local: 'Menlo-Regular', advance: 1233 / 2048 },
      'Yomu Symbols DejaVu': { local: 'DejaVuSansMono', advance: 1233 / 2048 },
      'Yomu Symbols Liberation': { local: 'LiberationMono-Regular', advance: 1229 / 2048 },
    };
    const faces = fontsCss().match(/@font-face\s*{[^}]*}/g) ?? [];
    for (const [family, { local, advance }] of Object.entries(advances)) {
      const face = faces.find((f) => f.includes(`font-family: '${family}'`));
      assert.ok(face, family + ' の @font-face が無い');
      assert.ok(face.includes(`local('${local}')`), family + ' に ' + local + ' が無い');
      assert.ok(!face.includes('url('), family + ' はフォントを同梱しない');
      const sizeAdjust = Number(face.match(/size-adjust:\s*([\d.]+)%/)?.[1]);
      assert.ok(Math.abs((advance * sizeAdjust) / 100 - 0.5) < 0.0001, family + ': ' + sizeAdjust);
      for (const range of ['U+2190-21FF', 'U+2500-257F', 'U+2580-259F', 'U+25A0-25FF']) {
        assert.ok(face.includes(range), family + ' の unicode-range に ' + range + ' が無い');
      }
    }
  });
});
