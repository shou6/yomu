/**
 * リンクの href を、クリック時の扱いごとに分類する（純粋関数）。
 * Webview 側（文書内の移動）と拡張機能側（外部と相対パス）の両方で使う。
 */

export type LinkKind =
  /** `#見出し`。Webview の中で移動する */
  | { kind: 'fragment'; id: string }
  /** http(s) と mailto。既定のブラウザで開く */
  | { kind: 'external'; href: string }
  /** `./other.md` など。ドキュメントからの相対パスで標準エディタで開く */
  | { kind: 'relative'; path: string; fragment: string | undefined }
  /** javascript:、file:、vscode: など。何もしない */
  | { kind: 'ignore' };

const EXTERNAL = /^(https?:\/\/|mailto:)/i;
/** スキーム付き、またはプロトコル相対（//） */
const HAS_SCHEME = /^([a-z][a-z0-9+.-]*:|\/\/)/i;

function decode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

export function classifyLink(href: string): LinkKind {
  if (href.startsWith('#')) {
    return { kind: 'fragment', id: decode(href.slice(1)) };
  }
  if (EXTERNAL.test(href)) {
    return { kind: 'external', href };
  }
  if (HAS_SCHEME.test(href)) {
    return { kind: 'ignore' };
  }
  const hash = href.indexOf('#');
  const path = hash === -1 ? href : href.slice(0, hash);
  const fragment = hash === -1 ? undefined : decode(href.slice(hash + 1));
  return { kind: 'relative', path: decode(path), fragment };
}

/** リーダーで開く Markdown のファイルか（.md と .markdown。大文字小文字は問わない） */
export function isMarkdownPath(path: string): boolean {
  return /\.(md|markdown)$/i.test(path);
}
