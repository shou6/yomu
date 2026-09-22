/**
 * 画像と図（Mermaid の SVG）のズーム表示。クリックで画面いっぱいの重ね表示を開く。
 * ホイールでマウスの位置を中心に拡大・縮小、ドラッグで移動、ダブルクリックで最初の大きさに戻す。
 * Esc、背景のクリック、× のボタンで閉じる。倍率と位置の計算は reader/zoom.ts（単体テスト済み）。
 */
import { fitView, panBy, zoomAt, type Size, type View } from '../reader/zoom';

/** 画面の縁に残す余白（px） */
const MARGIN = 40;
/** ホイール 1 目盛り（deltaY 100）あたりの倍率の変化 */
const WHEEL_SPEED = 0.0015;
/** これ以下の移動は、ドラッグではなくクリックとみなす（px） */
const CLICK_TOLERANCE = 4;

/** クリックでズームできるものか。リンクの中の画像はリンクを優先する */
export function zoomTarget(target: Element | null): HTMLImageElement | SVGSVGElement | undefined {
  if (target === null || target.closest('a[href]') !== null || target.closest('.yomu-zoom')) {
    return undefined;
  }
  const svg = target.closest<SVGSVGElement>('.yomu-mermaid svg');
  if (svg !== null) {
    return svg;
  }
  return target instanceof HTMLImageElement ? target : undefined;
}

/** 元の大きさ。画像は画素数、図は viewBox の大きさ */
function naturalSize(element: HTMLImageElement | SVGSVGElement): Size {
  if (element instanceof HTMLImageElement) {
    return { width: element.naturalWidth, height: element.naturalHeight };
  }
  const box = element.viewBox.baseVal;
  if (box !== null && box.width > 0 && box.height > 0) {
    return { width: box.width, height: box.height };
  }
  const rect = element.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

/** 画像はラスタなので拡大しない。SVG の画像と図は拡大しても粗くならない */
function isVector(element: HTMLImageElement | SVGSVGElement): boolean {
  return !(element instanceof HTMLImageElement) || /\.svg(\?|#|$)/i.test(element.src);
}

export function openZoom(source: HTMLImageElement | SVGSVGElement): void {
  document.querySelector('.yomu-zoom')?.remove();

  const size = naturalSize(source);
  const allowUpscale = isVector(source);

  const overlay = document.createElement('div');
  overlay.className = 'yomu-zoom';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.tabIndex = -1;

  const content = source.cloneNode(true) as HTMLElement | SVGSVGElement;
  content.classList.add('yomu-zoom-content');
  // 元の大きさで置き、transform で拡大する。mermaid が付けた max-width などは外す
  content.removeAttribute('style');
  content.setAttribute('width', String(size.width));
  content.setAttribute('height', String(size.height));

  const closeButton = document.createElement('button');
  closeButton.className = 'yomu-zoom-close';
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Close');
  closeButton.textContent = '×';

  overlay.append(content, closeButton);
  document.body.appendChild(overlay);

  const viewport = (): Size => ({ width: overlay.clientWidth, height: overlay.clientHeight });
  let view: View = fitView(size, viewport(), MARGIN, allowUpscale);
  const apply = (): void => {
    content.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
  };
  const reset = (): void => {
    view = fitView(size, viewport(), MARGIN, allowUpscale);
    apply();
  };
  apply();

  const close = (): void => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const center = (): { x: number; y: number } => ({
    x: overlay.clientWidth / 2,
    y: overlay.clientHeight / 2,
  });
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      close();
    } else if (event.key === '+' || event.key === '=') {
      view = zoomAt(view, 1.25, center());
      apply();
    } else if (event.key === '-') {
      view = zoomAt(view, 0.8, center());
      apply();
    } else if (event.key === '0') {
      reset();
    } else {
      return;
    }
    event.preventDefault();
  };
  document.addEventListener('keydown', onKey);

  overlay.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      view = zoomAt(view, Math.exp(-event.deltaY * WHEEL_SPEED), {
        x: event.clientX,
        y: event.clientY,
      });
      apply();
    },
    { passive: false }
  );

  // ドラッグで移動。ほとんど動かさずに背景を離したら閉じる
  let drag: { x: number; y: number; moved: number; onBackdrop: boolean } | undefined;
  overlay.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target === closeButton) {
      return;
    }
    overlay.setPointerCapture(event.pointerId);
    drag = { x: event.clientX, y: event.clientY, moved: 0, onBackdrop: event.target === overlay };
    overlay.classList.add('yomu-zoom-dragging');
  });
  overlay.addEventListener('pointermove', (event) => {
    if (drag === undefined) {
      return;
    }
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag = { ...drag, x: event.clientX, y: event.clientY, moved: drag.moved + Math.hypot(dx, dy) };
    view = panBy(view, dx, dy);
    apply();
  });
  overlay.addEventListener('pointerup', () => {
    const clicked = drag !== undefined && drag.onBackdrop && drag.moved <= CLICK_TOLERANCE;
    drag = undefined;
    overlay.classList.remove('yomu-zoom-dragging');
    if (clicked) {
      close();
    }
  });
  overlay.addEventListener('dblclick', (event) => {
    event.preventDefault();
    reset();
  });
  closeButton.addEventListener('click', close);

  overlay.focus();
}
