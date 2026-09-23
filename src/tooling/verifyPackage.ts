/**
 * 公開パッケージ（VSIX）に入るファイルが、意図したものだけかを判定する（scripts/verify-package.js が使う）。
 * 入ってよいファイルは package.json の main と l10n の有無で変わる。main があれば Webview のスクリプトも必須。
 */

export interface PackageManifest {
  main?: string;
  l10n?: string;
}

/** どの拡張機能でも入ってよいファイル */
const ALWAYS_ALLOWED = [
  /^package\.json$/,
  /^package\.nls(\.[a-z-]+)?\.json$/,
  /^README\.md$/,
  /^CHANGELOG\.md$/,
  /^LICENSE(\.txt|\.md)?$/,
  /^resources\/[\w.-]+\.(png|svg)$/,
];

/** どの拡張機能でも入っていなければならないファイル */
const ALWAYS_REQUIRED = ['package.json', 'README.md', 'LICENSE', 'resources/icon.png'];

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** ./dist/extension.js → dist/extension.js */
function normalize(file: string): string {
  return file.replace(/\\/g, '/').replace(/^\.\//, '');
}

/** vsce ls の出力から、ファイルの一覧だけを取り出す */
export function parseVsceLs(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\\/g, '/'))
    .filter((line) => line !== '' && !line.startsWith('>') && !/^(INFO|WARNING)\b/.test(line));
}

export function checkPackageFiles(
  files: string[],
  manifest: PackageManifest
): { unexpected: string[]; missing: string[] } {
  const allowed = [...ALWAYS_ALLOWED];
  const required = [...ALWAYS_REQUIRED];
  if (manifest.main) {
    const main = normalize(manifest.main);
    // 拡張本体に加えて、Webview 側のスクリプトと組版の CSS も配る
    allowed.push(
      new RegExp('^' + escapeRegExp(main) + '$'),
      /^dist\/webview\.js$/,
      /^dist\/mermaid\.min\.js$/,
      // 数式の CSS とフォント（esbuild.js が katex から写す）
      /^dist\/katex\/katex\.min\.css$/,
      /^dist\/katex\/fonts\/KaTeX_[\w-]+\.woff2$/,
      /^media\/(themes\/)?[\w.-]+\.css$/,
      // 同梱フォントとそのライセンス
      /^fonts\/[\w.-]+\.woff2$/,
      /^fonts\/OFL-[\w.-]+\.txt$/
    );
    required.push(main, 'dist/webview.js', 'dist/mermaid.min.js', 'dist/katex/katex.min.css');
  }
  if (manifest.l10n) {
    const dir = normalize(manifest.l10n).replace(/\/$/, '');
    allowed.push(new RegExp('^' + escapeRegExp(dir) + '/bundle\\.l10n(\\.[a-z-]+)?\\.json$'));
  }
  return {
    unexpected: files.filter((file) => !allowed.some((pattern) => pattern.test(file))),
    missing: required.filter((file) => !files.includes(file)),
  };
}
