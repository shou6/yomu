# Change Log

All notable changes to this extension are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0]

### Added

- Mermaid diagrams: code blocks with the `mermaid` language are drawn as diagrams (flowcharts, sequence, class, state, Gantt, pie and more). Colors follow the reader theme, and a syntax error shows the message with the source instead of a blank area. mermaid.js is loaded only for documents that contain a Mermaid block.
- Zoom for images and diagrams: click an image or a Mermaid diagram to open it full screen. Scroll to zoom around the pointer, drag to pan, double-click to fit, and press Esc or click the backdrop to close. Diagrams stay sharp at any zoom level.
- Focus mode: dims everything except the blocks you are reading (between 30% and 55% down the screen). Turn it on with `yomu.focusMode` or the command "Yomu: Toggle Focus Mode".
- Long code blocks fold: blocks longer than `yomu.code.foldLines` (20 by default, 0 to disable) show that many lines with a "Show all N lines" button.
- Print and PDF: "Yomu: Open in Browser to Print" (also in the reader tab's ... menu) opens the document in your browser with print styles and the print dialog. Save it as PDF from there. VS Code webviews cannot print, so Yomu hands the page to the browser.
- Reader tab title bar buttons: focus mode on/off (the icon shows the current state), print, and open in the text editor.

### Fixed

- Text diagrams drawn with box-drawing characters (─ │ ┌ ▶ ▼) now line up in code blocks, including diagrams that contain Japanese. The default code font is a Japanese monospace font whose Latin and Japanese widths are exactly 1:2 (BIZ UDGothic on Windows, Osaka-Mono on macOS, Noto Sans Mono CJK JP on Linux). Box-drawing characters, arrows and geometric shapes are drawn from a Latin monospace font narrowed to exactly half width, because Japanese fonts draw them full width.

## [0.1.0]

First release (MVP).

### Added

- Reader tab: open `.md` files in a read-only custom editor via the title bar icon, the Command Palette (`Yomu: Open in Reader`), or "Reopen Editor With...". The default editor is left untouched.
- Rendering with markdown-it: CommonMark, GFM tables, strikethrough and task lists, heading anchors, local and remote images. Raw HTML is disabled.
- Syntax highlighting for all highlight.js languages, with a language label on each code block.
- Links: in-document anchors scroll in place, relative links open in the text editor, external links open in the browser.
- Live update when the document changes in the text editor. Scroll position survives tab switches.
- Settings under `yomu.*`: theme, maximum width, alignment, padding, font family, code font, font size, line height and a custom CSS file. Changes apply to open reader tabs immediately.
- Themes: `paper` (default), `sepia`, `dark` and `vscode`. High-contrast VS Code themes always use the VS Code colors.
- Bundled Japanese fonts under the SIL Open Font License: BIZ UDPGothic (Regular, Bold) and Noto Sans JP (variable).
- Japanese typography: separate Latin and Japanese fonts, comfortable line height, and `text-spacing-trim` for punctuation.
- English and Japanese UI strings.
