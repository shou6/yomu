# Change Log

All notable changes to this extension are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
