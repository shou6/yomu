/**
 * 集中モード。読んでいるブロック（画面の上から 4 割の高さにあるもの）以外を薄く表示する。
 * どのブロックかの判定は reader/focus.ts（単体テスト済み）。
 */
import { FOCUS_ANCHOR, focusedIndex } from '../reader/focus';

let enabled = false;
let frame: number | undefined;

/** 薄くする単位。本文の直下の要素。ただしリストは項目ごとにする */
function blocks(root: HTMLElement): HTMLElement[] {
  return [...root.children].flatMap((child) =>
    child instanceof HTMLUListElement || child instanceof HTMLOListElement
      ? [...child.children].filter((item): item is HTMLElement => item instanceof HTMLElement)
      : child instanceof HTMLElement
        ? [child]
        : []
  );
}

/** 読んでいるブロックに印を付け直す */
export function updateFocus(root: HTMLElement): void {
  if (!enabled) {
    return;
  }
  const items = blocks(root);
  const index = focusedIndex(
    items.map((item) => {
      const rect = item.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    }),
    window.innerHeight * FOCUS_ANCHOR
  );
  root
    .querySelectorAll('.yomu-focused')
    .forEach((element) => element.classList.remove('yomu-focused'));
  items[index]?.classList.add('yomu-focused');
}

export function setFocusMode(root: HTMLElement, on: boolean): void {
  if (on === enabled) {
    return;
  }
  enabled = on;
  document.body.classList.toggle('yomu-focus-mode', on);
  if (on) {
    updateFocus(root);
  } else {
    root
      .querySelectorAll('.yomu-focused')
      .forEach((element) => element.classList.remove('yomu-focused'));
  }
}

/** スクロールと大きさの変化で印を付け直す。1 フレームに 1 回にまとめる */
export function watchFocus(root: HTMLElement): void {
  const schedule = (): void => {
    if (!enabled || frame !== undefined) {
      return;
    }
    frame = requestAnimationFrame(() => {
      frame = undefined;
      updateFocus(root);
    });
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
}
