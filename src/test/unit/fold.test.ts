import * as assert from 'assert';
import { countLines, shouldFold } from '../../reader/fold';

suite('countLines', () => {
  test('末尾の改行は数えない', () => {
    assert.strictEqual(countLines('a\nb\n'), 2);
    assert.strictEqual(countLines('a\nb'), 2);
    assert.strictEqual(countLines('a'), 1);
  });

  test('空なら 0', () => {
    assert.strictEqual(countLines(''), 0);
    assert.strictEqual(countLines('\n'), 1);
  });

  test('Windows の改行も 1 行と数える', () => {
    assert.strictEqual(countLines('a\r\nb\r\n'), 2);
  });
});

suite('shouldFold', () => {
  test('設定の行数より長い時だけ畳む', () => {
    assert.strictEqual(shouldFold(21, 20), true);
    assert.strictEqual(shouldFold(20, 20), false);
    assert.strictEqual(shouldFold(3, 20), false);
  });

  test('設定が 0 なら畳まない', () => {
    assert.strictEqual(shouldFold(1000, 0), false);
  });
});
