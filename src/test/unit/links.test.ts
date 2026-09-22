import * as assert from 'assert';
import { classifyLink, isMarkdownPath } from '../../reader/links';

suite('classifyLink', () => {
  test('# で始まるリンクは文書内。ID はデコードする', () => {
    assert.deepStrictEqual(classifyLink('#%E3%81%AF%E3%81%98%E3%82%81%E3%81%AB'), {
      kind: 'fragment',
      id: 'はじめに',
    });
    assert.deepStrictEqual(classifyLink('#getting-started'), {
      kind: 'fragment',
      id: 'getting-started',
    });
  });

  test('http(s) と mailto は外部', () => {
    assert.deepStrictEqual(classifyLink('https://example.com/a?b=1'), {
      kind: 'external',
      href: 'https://example.com/a?b=1',
    });
    assert.deepStrictEqual(classifyLink('http://example.com'), {
      kind: 'external',
      href: 'http://example.com',
    });
    assert.deepStrictEqual(classifyLink('mailto:a@example.com'), {
      kind: 'external',
      href: 'mailto:a@example.com',
    });
  });

  test('相対パスはパスとフラグメントに分け、パスはデコードする', () => {
    assert.deepStrictEqual(classifyLink('./other.md'), {
      kind: 'relative',
      path: './other.md',
      fragment: undefined,
    });
    assert.deepStrictEqual(classifyLink('../docs/%E8%A8%AD%E8%A8%88.md#%E6%A6%82%E8%A6%81'), {
      kind: 'relative',
      path: '../docs/設計.md',
      fragment: '概要',
    });
  });

  test('それ以外のスキーム（javascript:、file:、vscode: など）は無視する', () => {
    assert.deepStrictEqual(classifyLink('javascript:alert(1)'), { kind: 'ignore' });
    assert.deepStrictEqual(classifyLink('file:///etc/passwd'), { kind: 'ignore' });
    assert.deepStrictEqual(classifyLink('vscode://settings'), { kind: 'ignore' });
    assert.deepStrictEqual(classifyLink('//example.com/a'), { kind: 'ignore' });
  });

  test('壊れたパーセントエンコードはそのまま使う', () => {
    assert.deepStrictEqual(classifyLink('#100%'), { kind: 'fragment', id: '100%' });
  });
});

suite('isMarkdownPath', () => {
  test('.md と .markdown は Markdown。大文字小文字は問わない', () => {
    assert.strictEqual(isMarkdownPath('./other.md'), true);
    assert.strictEqual(isMarkdownPath('../docs/README.MD'), true);
    assert.strictEqual(isMarkdownPath('notes.markdown'), true);
  });

  test('それ以外は Markdown でない', () => {
    assert.strictEqual(isMarkdownPath('./plain.txt'), false);
    assert.strictEqual(isMarkdownPath('./image.png'), false);
    assert.strictEqual(isMarkdownPath('./md'), false);
  });
});
