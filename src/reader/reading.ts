/**
 * 読了の進捗と読書の記録（純粋関数）。
 * 割合は「どこまでスクロールしたか」で、0 が一番上、1 が一番下。
 */

/** 読書の記録に残す文書の数 */
export const HISTORY_LIMIT = 50;

export interface ReadingRecord {
  /** 一覧に出す名前（ファイル名） */
  title: string;
  /** 読んだ位置の割合（0〜1） */
  progress: number;
  /** 最後に読んだ時刻（ミリ秒） */
  lastRead: number;
}

/** 文書の URI ごとの記録 */
export type ReadingRecords = Record<string, ReadingRecord>;

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * スクロールの位置から割合を求める。本文が画面に収まる時は、全部見えているので 1
 * @param scrollY 今のスクロールの位置
 * @param scrollHeight 本文の高さ
 * @param clientHeight 画面の高さ
 */
export function progressFromScroll(
  scrollY: number,
  scrollHeight: number,
  clientHeight: number
): number {
  const max = scrollHeight - clientHeight;
  return max <= 0 ? 1 : clamp01(scrollY / max);
}

/** 割合から、再開する時のスクロールの位置を求める。本文が画面に収まる時は 0 */
export function resumeScrollY(
  progress: number,
  scrollHeight: number,
  clientHeight: number
): number {
  const max = scrollHeight - clientHeight;
  return max <= 0 ? 0 : Math.round(clamp01(progress) * max);
}

/** 整数の百分率 */
export function formatProgress(progress: number): string {
  return Math.round(clamp01(progress) * 100) + '%';
}

/**
 * 文書の記録を足すか上書きした、新しい記録を返す（元の記録は書き換えない）。
 * HISTORY_LIMIT 件を超えたら、最後に読んだのが古いものから消す
 */
export function updateRecord(
  records: ReadingRecords,
  uri: string,
  title: string,
  progress: number,
  now: number
): ReadingRecords {
  const next: ReadingRecords = {
    ...records,
    [uri]: { title, progress: Math.round(clamp01(progress) * 1000) / 1000, lastRead: now },
  };
  const uris = Object.keys(next);
  if (uris.length <= HISTORY_LIMIT) {
    return next;
  }
  const keep = new Set(
    recentRecords(next)
      .slice(0, HISTORY_LIMIT)
      .map((record) => record.uri)
  );
  return Object.fromEntries(Object.entries(next).filter(([key]) => keep.has(key)));
}

/** 最後に読んだのが新しい順 */
export function recentRecords(records: ReadingRecords): (ReadingRecord & { uri: string })[] {
  return Object.entries(records)
    .map(([uri, record]) => ({ uri, ...record }))
    .sort((a, b) => b.lastRead - a.lastRead);
}
