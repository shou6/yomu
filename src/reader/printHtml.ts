/**
 * 「ブラウザで開いて印刷」用の HTML を組み立てる（純粋関数）。
 * VS Code の Webview は印刷に対応していないので、1 つの HTML にまとめてブラウザで開き、ブラウザの印刷から PDF にする。
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** fonts.css の url('../fonts/…') を、同梱フォントのフォルダの URI に書き換える */
export function rewriteFontUrls(css: string, fontsDirUri: string): string {
  return css.replace(/url\((['"]?)\.\.\/fonts\//g, `url($1${fontsDirUri}/`);
}

const MERMAID_BLOCK = /<div class="yomu-mermaid">[\s\S]*?<\/div>/g;

/**
 * Mermaid の枠を、上から順にリーダーが描いた SVG に差し替える。
 * @param svgs 各枠の SVG。描けていない枠は null で、ソースのまま残す
 */
export function injectMermaid(html: string, svgs: readonly (string | null)[]): string {
  let index = 0;
  return html.replace(MERMAID_BLOCK, (block) => {
    const svg = svgs[index++];
    return svg === null || svg === undefined ? block : `<div class="yomu-mermaid">${svg}</div>`;
  });
}

export interface PrintHtmlParams {
  /** ブラウザのタブと、PDF の既定のファイル名になる */
  title: string;
  /** 本文の HTML */
  body: string;
  /** 埋め込む CSS の中身（読み込む順） */
  css: readonly string[];
  /** 設定から作った CSS 変数（幅、文字の大きさなど） */
  cssVariables: Record<string, string>;
}

export function printHtml(params: PrintHtmlParams): string {
  const variables = Object.entries(params.cssVariables)
    .map(([name, value]) => `${name}: ${value};`)
    .join(' ');
  const styles = params.css.map((css) => `<style>\n${css}\n</style>`).join('\n');
  // 印刷はインクを使わないよう、テーマに関わらず白地の paper にする
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(params.title)}</title>
${styles}
<style>:root { ${variables} }</style>
</head>
<body data-theme="paper">
<main id="content">${params.body}</main>
<script>
// フォントと画像を読み終えてから印刷のダイアログを出す
window.addEventListener('load', () => setTimeout(() => window.print(), 300));
</script>
</body>
</html>
`;
}
