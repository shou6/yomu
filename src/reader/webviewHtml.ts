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
}

export function webviewHtml(params: WebviewHtmlParams): string {
  const csp = [
    "default-src 'none'",
    `img-src ${params.cspSource} https: data:`,
    `style-src ${params.cspSource}`,
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
  <body>
    <main id="content"></main>
    <script nonce="${params.nonce}" src="${params.scriptUri}"></script>
  </body>
</html>
`;
}
