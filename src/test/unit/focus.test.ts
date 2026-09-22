import * as assert from 'assert';
import { FOCUS_BAND, focusedIndices } from '../../reader/focus';

/** 上から順に並んだブロックの上端と下端 */
const blocks = [
  { top: 0, bottom: 100 },
  { top: 120, bottom: 150 },
  { top: 160, bottom: 190 },
  { top: 200, bottom: 400 },
];

suite('focusedIndices', () => {
  test('帯に掛かっているブロックをすべて返す', () => {
    assert.deepStrictEqual(focusedIndices(blocks, { top: 130, bottom: 210 }), [1, 2, 3]);
    assert.deepStrictEqual(focusedIndices(blocks, { top: 50, bottom: 60 }), [0]);
  });

  test('帯の端に触れているだけのブロックも含める', () => {
    assert.deepStrictEqual(focusedIndices(blocks, { top: 100, bottom: 120 }), [0, 1]);
  });

  test('帯に何も掛かっていなければ、帯の中央に一番近いもの 1 つ', () => {
    assert.deepStrictEqual(focusedIndices(blocks, { top: 102, bottom: 108 }), [0]);
    assert.deepStrictEqual(focusedIndices(blocks, { top: 112, bottom: 118 }), [1]);
    assert.deepStrictEqual(focusedIndices(blocks, { top: 900, bottom: 950 }), [3]);
  });

  test('ブロックが無ければ空', () => {
    assert.deepStrictEqual(focusedIndices([], { top: 0, bottom: 100 }), []);
  });

  test('帯は画面の上から 3 割〜5.5 割。ホイール 1 目盛り（約 100px）より高いので、短いブロックも飛ばされない', () => {
    assert.deepStrictEqual(FOCUS_BAND, { top: 0.3, bottom: 0.55 });
    // 高さ 800px の画面なら帯は 200px
    assert.ok((FOCUS_BAND.bottom - FOCUS_BAND.top) * 800 > 100);
  });
});
