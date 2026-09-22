/**
 * 今読んでいる見出し（画面の上から 2 割の高さより上にある最後の見出し）を調べ、変わったら知らせる。
 * 判定は reader/outline.ts の currentHeadingIndex（単体テスト済み）。
 */
import { currentHeadingIndex } from '../reader/outline';

/** 読んでいる位置。画面の上端からの割合 */
const THRESHOLD = 0.2;

export function watchPosition(root: HTMLElement, notify: (id: string | null) => void): void {
  let last: string | null | undefined;
  let frame: number | undefined;
  const check = (): void => {
    frame = undefined;
    const headings = [...root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')];
    const index = currentHeadingIndex(
      headings.map((heading) => heading.getBoundingClientRect().top),
      window.innerHeight * THRESHOLD
    );
    const id = index < 0 ? null : headings[index].id;
    if (id !== last) {
      last = id;
      notify(id);
    }
  };
  const schedule = (): void => {
    frame ??= requestAnimationFrame(check);
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  // 本文の差し替え（開いた直後、編集）でも調べ直す
  new MutationObserver(schedule).observe(root, { childList: true });
}
