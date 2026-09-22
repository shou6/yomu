/**
 * 画像と図のズーム表示の、倍率と位置の計算（純粋関数）。Webview 側から使う。
 * 表示は「左上を (x, y) に置き、scale 倍する」という変換で表す。
 */

export interface View {
  scale: number;
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 20;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 最初の表示。画面に収まる倍率にし、中央に置く。
 * @param content 拡大するものの元の大きさ
 * @param viewport 画面の大きさ
 * @param margin 画面の縁に残す余白（px）
 * @param allowUpscale 画面より小さい時に拡大するか。図（SVG）は拡大しても粗くならないので true、画像は false
 */
export function fitView(
  content: Size,
  viewport: Size,
  margin: number,
  allowUpscale: boolean
): View {
  if (content.width <= 0 || content.height <= 0) {
    return { scale: 1, x: 0, y: 0 };
  }
  const fit = Math.min(
    (viewport.width - margin * 2) / content.width,
    (viewport.height - margin * 2) / content.height
  );
  const scale = clamp(allowUpscale ? fit : Math.min(fit, 1), MIN_SCALE, MAX_SCALE);
  return {
    scale,
    x: (viewport.width - content.width * scale) / 2,
    y: (viewport.height - content.height * scale) / 2,
  };
}

/**
 * point（画面の座標）の下にあるものが動かないように、factor 倍する。倍率は MIN_SCALE〜MAX_SCALE に収める。
 */
export function zoomAt(view: View, factor: number, point: Point): View {
  const scale = clamp(view.scale * factor, MIN_SCALE, MAX_SCALE);
  if (scale === view.scale) {
    return view;
  }
  const ratio = scale / view.scale;
  return {
    scale,
    x: point.x - (point.x - view.x) * ratio,
    y: point.y - (point.y - view.y) * ratio,
  };
}

/** ドラッグした分だけ動かす */
export function panBy(view: View, dx: number, dy: number): View {
  return { scale: view.scale, x: view.x + dx, y: view.y + dy };
}
