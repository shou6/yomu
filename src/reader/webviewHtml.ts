/**
 * Webview の HTML の骨組みを組み立てる（純粋関数）。
 * 本文は後から postMessage で差し込むので、ここでは空にしておく。
 * CSP は default-src 'none' を基本に、スクリプトは nonce、スタイルと画像は cspSource に限定する。
 */

export interface WebviewHtmlParams {
  /** スクリプトを許可するための、1 回限りの値 */
  nonce: string;
  /** webview.cspSource */
  cspSource: string;
  /** asWebviewUri で変換した CSS の URI */
  styleUris: readonly string[];
  /** asWebviewUri で変換した dist/webview.js の URI */
  scriptUri: string;
  /** asWebviewUri で変換した dist/mermaid.min.js の URI。Mermaid のブロックがある時だけ Webview が読み込む */
  mermaidUri: string;
}

export function webviewHtml(params: WebviewHtmlParams): string {
  const csp = [
    "default-src 'none'",
    `img-src ${params.cspSource} https: data:`,
    // mermaid は描いた SVG に <style> と style 属性を差し込むので、スタイルだけインラインを許す（要件定義 4.11 節）
    `style-src ${params.cspSource} 'unsafe-inline'`,
    `font-src ${params.cspSource}`,
    `script-src 'nonce-${params.nonce}'`,
  ].join('; ');
  const styles = params.styleUris
    .map((uri) => `<link rel="stylesheet" href="${uri}">`)
    .join('\n    ');
  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${styles}
  </head>
  <body data-mermaid-src="${params.mermaidUri}">
    <main id="content"></main>
    <script nonce="${params.nonce}" src="${params.scriptUri}"></script>
  </body>
</html>
`;
}
