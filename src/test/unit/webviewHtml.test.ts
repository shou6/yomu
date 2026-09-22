import * as assert from 'assert';
import { webviewHtml } from '../../reader/webviewHtml';

const params = {
  nonce: 'abc123',
  cspSource: 'https://webview.test',
  styleUris: ['https://webview.test/media/reader.css', 'https://webview.test/media/theme.css'],
  scriptUri: 'https://webview.test/dist/webview.js',
  mermaidUri: 'https://webview.test/dist/mermaid.min.js',
};

suite('webviewHtml', () => {
  test('CSP は default-src none を基本に、nonce と cspSource だけを許す', () => {
    const out = webviewHtml(params);
    const csp = out.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/)?.[1];
    assert.ok(csp, out);
    assert.ok(csp.includes("default-src 'none'"), csp);
    assert.ok(csp.includes("script-src 'nonce-abc123'"), csp);
    // mermaid が SVG に差し込む <style> と style 属性のために、スタイルだけインラインを許す
    assert.ok(csp.includes("style-src https://webview.test 'unsafe-inline'"), csp);
    // スクリプトは nonce だけ。インラインも eval も許さない
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src')) ?? '';
    assert.ok(!scriptSrc.includes('unsafe'), scriptSrc);
    assert.ok(csp.includes('img-src https://webview.test https: data:'), csp);
    assert.ok(csp.includes('font-src https://webview.test'), csp);
  });

  test('CSS と JS は別ファイルで読み込み、インラインのスクリプトやスタイルは無い', () => {
    const out = webviewHtml(params);
    assert.ok(
      out.includes('<link rel="stylesheet" href="https://webview.test/media/reader.css">'),
      out
    );
    assert.ok(
      out.includes('<link rel="stylesheet" href="https://webview.test/media/theme.css">'),
      out
    );
    assert.ok(
      out.includes('<script nonce="abc123" src="https://webview.test/dist/webview.js">'),
      out
    );
    assert.ok(!/<script(?![^>]*\ssrc=)/.test(out), 'インラインのスクリプトがある: ' + out);
    assert.ok(!out.includes('<style'), 'インラインのスタイルがある: ' + out);
  });

  test('mermaid.js の URI を body に持ち、読み込むのは必要になった時だけ', () => {
    const out = webviewHtml(params);
    assert.ok(
      out.includes('<body data-mermaid-src="https://webview.test/dist/mermaid.min.js">'),
      out
    );
    assert.ok(
      !out.includes('<script nonce="abc123" src="https://webview.test/dist/mermaid.min.js"'),
      out
    );
  });

  test('本文の差し込み先があり、初期状態の本文は空', () => {
    const out = webviewHtml(params);
    assert.ok(out.includes('<main id="content"></main>'), out);
    assert.ok(out.startsWith('<!DOCTYPE html>'), out);
    assert.ok(out.includes('<html lang="ja">'), out);
  });
});
