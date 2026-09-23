const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',

  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started');
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        console.error(`    ${location.file}:${location.line}:${location.column}:`);
      });
      console.log('[watch] build finished');
    });
  },
};

/** @type {import('esbuild').BuildOptions} */
const common = {
  bundle: true,
  minify: production,
  sourcemap: !production,
  sourcesContent: false,
  logLevel: 'silent',
  plugins: [esbuildProblemMatcherPlugin],
};

/** 拡張本体（Node 向け）と Webview 側のスクリプト（ブラウザ向け）は実行環境が違うので、別々にバンドルする */
const builds = [
  {
    ...common,
    entryPoints: ['src/extension.ts'],
    format: 'cjs',
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
  },
  {
    ...common,
    entryPoints: ['src/webview/main.ts'],
    format: 'iife',
    platform: 'browser',
    outfile: 'dist/webview.js',
  },
];

/** mermaid.js はバンドルせず、配布物をそのまま dist に写す。Mermaid のブロックがある時だけ Webview が読み込む */
function copyMermaid() {
  fs.mkdirSync('dist', { recursive: true });
  fs.copyFileSync(
    path.join(__dirname, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js'),
    path.join(__dirname, 'dist', 'mermaid.min.js')
  );
}

/**
 * 数式の CSS とフォントを dist/katex に写す。数式は拡張機能の側で HTML にするので、KaTeX のスクリプトは要らない。
 * フォントは woff2 だけ（CSS は woff2 を先に書いており、Webview の Chromium はそれを使う）
 */
function copyKatex() {
  const from = path.join(__dirname, 'node_modules', 'katex', 'dist');
  const to = path.join(__dirname, 'dist', 'katex');
  fs.mkdirSync(path.join(to, 'fonts'), { recursive: true });
  fs.copyFileSync(path.join(from, 'katex.min.css'), path.join(to, 'katex.min.css'));
  for (const file of fs.readdirSync(path.join(from, 'fonts'))) {
    if (file.endsWith('.woff2')) {
      fs.copyFileSync(path.join(from, 'fonts', file), path.join(to, 'fonts', file));
    }
  }
}

async function main() {
  copyMermaid();
  copyKatex();
  const contexts = await Promise.all(builds.map((options) => esbuild.context(options)));
  if (watch) {
    await Promise.all(contexts.map((ctx) => ctx.watch()));
  } else {
    for (const ctx of contexts) {
      await ctx.rebuild();
      await ctx.dispose();
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
