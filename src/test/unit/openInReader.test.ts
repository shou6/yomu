import * as assert from 'assert';
import { decideOpenInReader } from '../../reader/openInReader';

function t(message: string, ...args: string[]): string {
  return message.replace(/\{(\d+)\}/g, (_, index: string) => args[Number(index)] ?? '');
}

suite('decideOpenInReader', () => {
  test('アクティブなエディタが .md なら、その URI を開く', () => {
    const decision = decideOpenInReader({ uri: 'file:///a/b.md', fileName: '/a/b.md' }, t);
    assert.deepStrictEqual(decision, { kind: 'open', uri: 'file:///a/b.md' });
  });

  test('拡張子の大文字小文字は問わない', () => {
    const decision = decideOpenInReader({ uri: 'u', fileName: 'C:\\a\\README.MD' }, t);
    assert.deepStrictEqual(decision, { kind: 'open', uri: 'u' });
  });

  test('.md でなければ、その旨のメッセージを返して開かない', () => {
    const decision = decideOpenInReader({ uri: 'u', fileName: '/a/b.ts' }, t);
    assert.strictEqual(decision.kind, 'message');
    assert.ok(
      decision.kind === 'message' && decision.message.includes('.md'),
      JSON.stringify(decision)
    );
  });

  test('エディタが無ければ、その旨のメッセージを返す', () => {
    const decision = decideOpenInReader(undefined, t);
    assert.strictEqual(decision.kind, 'message');
    assert.ok(decision.kind === 'message' && decision.message.length > 0);
  });
});
