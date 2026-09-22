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

async function main() {
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
