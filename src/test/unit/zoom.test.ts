import * as assert from 'assert';
import { MAX_SCALE, MIN_SCALE, fitView, panBy, zoomAt } from '../../reader/zoom';

function close(actual: number, expected: number, message?: string): void {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message ?? ''} ${actual} !== ${expected}`);
}

suite('fitView', () => {
  test('画面より大きいものは、余白を残して画面に収まる倍率にし、中央に置く', () => {
    const view = fitView({ width: 2000, height: 1000 }, { width: 1000, height: 800 }, 40, true);
    // 収まる幅は 920、高さは 720。幅で決まって 0.46
    close(view.scale, 0.46);
    close(view.x, (1000 - 2000 * 0.46) / 2);
    close(view.y, (800 - 1000 * 0.46) / 2);
  });

  test('図（SVG）は、画面より小さければ画面に収まるまで拡大する', () => {
    const view = fitView({ width: 400, height: 200 }, { width: 1000, height: 800 }, 40, true);
    close(view.scale, 920 / 400);
  });

  test('画像（ラスタ）は拡大しない。粗くなるので元の大きさを上限にする', () => {
    const view = fitView({ width: 400, height: 200 }, { width: 1000, height: 800 }, 40, false);
    close(view.scale, 1);
    close(view.x, 300);
    close(view.y, 300);
  });

  test('大きさが 0 の時は 1 倍で左上に置く（割り算で壊れない）', () => {
    const view = fitView({ width: 0, height: 0 }, { width: 1000, height: 800 }, 40, true);
    assert.deepStrictEqual(view, { scale: 1, x: 0, y: 0 });
  });
});

suite('zoomAt', () => {
  test('指定した点の下にあるものが動かないように拡大する', () => {
    const before = { scale: 1, x: 100, y: 50 };
    const after = zoomAt(before, 2, { x: 300, y: 250 });
    close(after.scale, 2);
    // 点 (300, 250) の下の内容の座標は、拡大の前後で同じ
    close((300 - before.x) / before.scale, (300 - after.x) / after.scale, 'x');
    close((250 - before.y) / before.scale, (250 - after.y) / after.scale, 'y');
  });

  test('倍率は下限と上限の間に収める', () => {
    assert.strictEqual(zoomAt({ scale: 1, x: 0, y: 0 }, 1000, { x: 0, y: 0 }).scale, MAX_SCALE);
    assert.strictEqual(zoomAt({ scale: 1, x: 0, y: 0 }, 0.0001, { x: 0, y: 0 }).scale, MIN_SCALE);
  });

  test('上限に張り付いている時は位置も動かない', () => {
    const view = { scale: MAX_SCALE, x: 10, y: 20 };
    assert.deepStrictEqual(zoomAt(view, 2, { x: 500, y: 500 }), view);
  });
});

suite('panBy', () => {
  test('ドラッグした分だけ位置を動かし、倍率は変えない', () => {
    assert.deepStrictEqual(panBy({ scale: 2, x: 10, y: 20 }, 5, -7), { scale: 2, x: 15, y: 13 });
  });
});
