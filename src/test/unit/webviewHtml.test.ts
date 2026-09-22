import * as assert from 'assert';
import { webviewHtml } from '../../reader/webviewHtml';

const params = {
  nonce: 'abc123',
  cspSource: 'https://webview.test',
  styleUris: ['https://webview.test/media/reader.css', 'https://webview.test/media/theme.css'],
  scriptUri: 'https://webview.test/dist/webview.js',
};

suite('webviewHtml', () => {
  test('CSP は default-src none を基本に、nonce と cspSource だけを許す', () => {
    const out = webviewHtml(params);
    const csp = out.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/)?.[1];
    assert.ok(csp, out);
    assert.ok(csp.includes("default-src 'none'"), csp);
    assert.ok(csp.includes("script-src 'nonce-abc123'"), csp);
    assert.ok(csp.includes('style-src https://webview.test'), csp);
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

  test('本文の差し込み先があり、初期状態の本文は空', () => {
    const out = webviewHtml(params);
    assert.ok(out.includes('<main id="content"></main>'), out);
    assert.ok(out.startsWith('<!DOCTYPE html>'), out);
    assert.ok(out.includes('<html lang="ja">'), out);
  });
});
