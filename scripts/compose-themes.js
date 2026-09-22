// README のテーマ比較の画像（images/themes.png）を、docs/images/theme-<テーマ名>.png から作り直す。
// 使い方: npm run themes-image
//
// テーマの一覧と順は src/reader/readerSettings.ts の THEMES に従う。テーマを足したら、
// docs/sample.md をリーダーで開いて各テーマのスクリーンショットを docs/images/ に置き、これを実行する。
// 配置は out/ の実装（単体テストで検証済み）で決め、描くのは Python（Pillow）に任せる。
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const compile = spawnSync('npm run compile-tests', { cwd: root, stdio: 'inherit', shell: true });
if (compile.status !== 0) {
  process.exit(compile.status ?? 1);
}
const { planThemeImage } = require(path.join(root, 'out', 'tooling', 'themeImage.js'));
const { THEMES } = require(path.join(root, 'out', 'reader', 'readerSettings.js'));

let plan;
try {
  plan = planThemeImage(THEMES, path.join(root, 'docs', 'images'), (file) => fs.existsSync(file));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const output = path.join(root, 'images', 'themes.png');
const python = process.platform === 'win32' ? 'python' : 'python3';
const result = spawnSync(python, [path.join(__dirname, 'compose-themes.py'), output], {
  input: JSON.stringify(plan),
  stdio: ['pipe', 'inherit', 'inherit'],
  // Windows のコンソールは cp932 なので、日本語の出力が化けないよう UTF-8 に揃える
  env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
});
if (result.error && result.error.code === 'ENOENT') {
  console.error(python + ' が見つかりません。Python と Pillow（pip install pillow）を入れてください。');
  process.exit(1);
}
process.exit(result.status ?? 1);
