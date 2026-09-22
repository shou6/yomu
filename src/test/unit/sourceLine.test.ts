import * as assert from 'assert';
import { readingLine } from '../../reader/sourceLine';

/** 上から順に並んだ要素（元の行番号と、画面の上端・下端） */
const blocks = [
  { line: 0, top: -300, bottom: -200 },
  { line: 4, top: -150, bottom: 80 },
  { line: 9, top: 100, bottom: 300 },
  { line: 15, top: 320, bottom: 500 },
];

suite('readingLine', () => {
  test('基準の高さに掛かっている要素の行', () => {
    assert.strictEqual(readingLine(blocks, 50), 4);
    assert.strictEqual(readingLine(blocks, 200), 9);
  });

  test('要素の間の隙間なら、その下の要素の行', () => {
    assert.strictEqual(readingLine(blocks, 90), 9);
  });

  test('全部より下なら最後の要素、要素が無ければ 0', () => {
    assert.strictEqual(readingLine(blocks, 900), 15);
    assert.strictEqual(readingLine([], 100), 0);
  });
});
