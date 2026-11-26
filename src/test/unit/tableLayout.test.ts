import * as assert from 'assert';
import { isShortCell } from '../../reader/tableLayout';

suite('isShortCell', () => {
  test('12 文字までのセルは短い（折り返さない）', () => {
    assert.strictEqual(isShortCell('山田太郎'), true);
    assert.strictEqual(isShortCell('直線で外から差し切り'), true);
    assert.strictEqual(isShortCell('2026/11/23'), true);
    assert.strictEqual(isShortCell('  前後の空白は数えない  '), true);
  });

  test('13 文字以上のセルは長い（折り返す）', () => {
    assert.strictEqual(isShortCell('道中で掛かり気味だったが最後まで粘った'), false);
    assert.strictEqual(isShortCell('a'.repeat(13)), false);
  });

  test('サロゲートペアの文字は 1 文字と数える', () => {
    assert.strictEqual(isShortCell('𠮷'.repeat(12)), true);
  });
});
