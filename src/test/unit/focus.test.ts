import * as assert from 'assert';
import { FOCUS_ANCHOR, focusedIndex } from '../../reader/focus';

/** 上から順に並んだブロックの上端と下端 */
const blocks = [
  { top: 0, bottom: 100 },
  { top: 120, bottom: 300 },
  { top: 320, bottom: 400 },
];

suite('focusedIndex', () => {
  test('読んでいる位置の高さを含むブロック', () => {
    assert.strictEqual(focusedIndex(blocks, 50), 0);
    assert.strictEqual(focusedIndex(blocks, 200), 1);
    assert.strictEqual(focusedIndex(blocks, 400), 2);
  });

  test('ブロックの間の隙間なら、近い方', () => {
    assert.strictEqual(focusedIndex(blocks, 105), 0);
    assert.strictEqual(focusedIndex(blocks, 116), 1);
  });

  test('全部より上なら最初、全部より下なら最後', () => {
    assert.strictEqual(focusedIndex(blocks, -50), 0);
    assert.strictEqual(focusedIndex(blocks, 900), 2);
  });

  test('ブロックが無ければ -1', () => {
    assert.strictEqual(focusedIndex([], 100), -1);
  });

  test('読んでいる位置は、画面の上から 4 割の高さ', () => {
    assert.strictEqual(FOCUS_ANCHOR, 0.4);
  });
});
