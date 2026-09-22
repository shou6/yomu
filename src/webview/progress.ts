/**
 * 読んだ位置の割合を調べ、変わったら知らせる。割合の計算は reader/reading.ts（単体テスト済み）。
 */
import { progressFromScroll } from '../reader/reading';

/** これより小さな変化は知らせない（記録の書き込みを減らす） */
const STEP = 0.005;

export function watchProgress(notify: (value: number) => void): () => void {
  let last: number | undefined;
  let frame: number | undefined;
  const check = (): void => {
    frame = undefined;
    const element = document.documentElement;
    const value = progressFromScroll(window.scrollY, element.scrollHeight, window.innerHeight);
    if (last === undefined || Math.abs(value - last) >= STEP || (value === 1 && last !== 1)) {
      last = value;
      notify(value);
    }
  };
  const schedule = (): void => {
    frame ??= requestAnimationFrame(check);
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  return schedule;
}
