import * as assert from 'assert';
import { isShortCell, wideTableExtension } from '../../reader/tableLayout';

suite('wideTableExtension', () => {
  test('本文の幅に収まる表は広げない', () => {
    assert.deepStrictEqual(
      wideTableExtension({
        minWidth: 600,
        maxWidth: 1500,
        contentWidth: 760,
        leftRoom: 300,
        rightRoom: 300,
      }),
      { left: 0, right: 0 }
    );
  });

  test('収まらない表は、望む幅（max-content）まで左右へ均等に広げる', () => {
    assert.deepStrictEqual(
      wideTableExtension({
        minWidth: 900,
        maxWidth: 1000,
        contentWidth: 760,
        leftRoom: 300,
        rightRoom: 300,
      }),
      { left: 120, right: 120 }
    );
  });

  test('空きが足りなければ、空きの分だけ広げる（残りは枠の中で横スクロール）', () => {
    assert.deepStrictEqual(
      wideTableExtension({
        minWidth: 1200,
        maxWidth: 2000,
        contentWidth: 760,
        leftRoom: 100,
        rightRoom: 150,
      }),
      { left: 100, right: 150 }
    );
  });

  test('片側の空きが足りない分は、もう片側から取る（本文を左寄せにした時など）', () => {
    assert.deepStrictEqual(
      wideTableExtension({
        minWidth: 900,
        maxWidth: 1000,
        contentWidth: 760,
        leftRoom: 0,
        rightRoom: 500,
      }),
      { left: 0, right: 240 }
    );
  });

  test('空きが負（本文が画面より広い）でも広げない側に縮めない', () => {
    assert.deepStrictEqual(
      wideTableExtension({
        minWidth: 900,
        maxWidth: 1000,
        contentWidth: 760,
        leftRoom: -20,
        rightRoom: -20,
      }),
      { left: 0, right: 0 }
    );
  });
});

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
