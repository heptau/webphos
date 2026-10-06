# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Only changes since version 5.0.0 are listed here.

## [26.0.0]

### Added

#### Look and interface

- Look of macOS (Apple HIG) with the structure of Photoshop: color tokens for
  dark, light, green and high-contrast themes, translucent menus, application
  menu, menu order like Photoshop, press-drag-release menus, macOS notation of
  shortcuts, context menus, command palette over the menu.
- Tool panel in two columns in groups ordered like the Photoshop toolbar (no
  holes before the separators), with a new consistent set of tool icons, panels Layers (with blend mode and
  opacity), History, Histogram, Navigator and foreground/background colors,
  status bar (size, mouse, color under the pointer, resolution), Window menu
  with workspaces, rulers and guides, editable zoom.
- Dialogs with side-by-side live preview, Preview checkbox, Alt = Reset,
  number boxes next to sliders, tabbed Settings, focus handling.
- Theme and language follow the system (default) and switch live; large
  controls, high contrast theme, keyboard accessibility, reduced motion.
- Application renamed to WebPhos with a new icon.
- Photoshop-like keyboard shortcuts (Ctrl/Cmd + D, J, E, I, L, Alt+Backspace,
  brackets for the brush size, ...) shown in the help.

#### Documents and files

- Several documents in tabs (drag to reorder, context menu; the close cross is
  on the left and shows over the tab, always on touch screens; a green dot
  after the name marks unsaved changes),
  autosave with restore after start, templates, Open Recent, option to open
  files in a new document, paste as a new document, copy a layer to another
  document.
- Resolution (dpi) and units (px, in, cm, mm, pt, pica) belong to the document
  and are used in New, Canvas Size, Resize (with Resample) and Information.
- Export to PDF, quick export, ZIP with several sizes, app icons, selection,
  watermark, sprite sheet, print tiles, document info, copy as data URL; own BMP
  encoder, only formats the browser can encode are offered; optional system
  save dialog; import of SVG.
- Privacy dialog for clearing the data stored in the browser; swatches (`.gpl`).

#### Selections and masks

- Selections backed by an alpha mask: rectangle and ellipse, lasso, magic wand,
  quick select, quick mask, color range, subject, sky, edges, luminosity mask,
  layer transparency, grow and similar.
- Modify: expand, contract, feather, smooth, border, offset, Refine Edge
  (also snapping to image edges) with live preview on the canvas; Shift/Alt to
  add and subtract; stroke selection; selection to a new layer.
- Saved selections (stored in the browser) with import and export (JSON, PNG);
  all changes of a selection can be undone.
- Adjustments, fill, delete and copy respect the selection and its soft edges.
- Layer masks (reveal/hide all, from selection, apply, invert, disable) and
  Remove Background.

#### Layers

- Layer styles: drop shadow, outer glow, stroke, inner shadow, color and
  gradient overlay, bevel and emboss; fill layers, pattern fill.
- Lock, groups, color labels, search, solo layer, inline rename, drag to
  reorder, align and distribute, trim to content, stamp visible, layer via
  copy/cut, copy merged, canvas rotation, free transform.
- The list shows whether a layer is raster or vector; tools that work only
  with raster layers are disabled on vector layers, and the convert-to-raster
  button is disabled on raster layers.
- Buttons for layers have icons; an empty layer (the first layer of a new
  document) has its own icon, because the first brush stroke, shape or text
  makes it a vector layer.

#### Adjustments and effects

- Levels, curves (interactive graph with histogram), brightness/contrast,
  hue/saturation, exposure, color balance, selective color, photo filter,
  gradient map, channel mixer, shadows/highlights, temperature/tint, sepia,
  equalize, auto contrast and color, invert, desaturate, threshold, posterize.
- Effects with live preview: add noise, pixelate, unsharp mask, high pass,
  median, minimum/maximum, motion and smart blur, clarity, twirl, wave,
  clouds, lens flare, vignette, dehaze, tilt-shift, split toning, film grain,
  halftone, chromatic aberration, dust and scratches, defringe, blur
  background, HDR toning, white balance, duotone, palette reduction, pixel art.
- Color lookup (`.cube`), saving the last adjustment as a LUT, match color,
  repeat last adjustment, Fade, proof colors (color blindness), split compare.
- Quick Edit by words (Czech and English) and recipes.

#### Tools

- Healing brush, red eye, background eraser, liquify, dodge/burn, smudge, hand,
  zoom, measure, color picker with sample size.

#### Project

- Tests (Jest), ESLint and TypeScript type check; `AGENTS.md` for AI agents.
- `VERSION` file is the source of the application version; `make build` and
  webpack use it.
- `CHANGELOG.md`, `CONTRIBUTING.md`, `LICENSE`, `SECURITY.md` and
  `.well-known/security.txt`, `CNAME` for the custom domain.

### Changed

- Text color follows the foreground color.
- Quit WebPhos asks about unsaved changes in all documents, forgets the
  autosaved session and opens the project page; the editor with the last image
  does not stay open (an installed application window is closed).
- The About dialog no longer shows the support row.
- Dialogs of confirmations have the look of macOS dialogs.
- Mouse coordinates in the status bar have a fixed width.
- Theme is selected only in Settings (removed from the View menu); settings are
  stored safely (a corrupted cookie no longer breaks the application).
- Translations: texts in the application are translated through one helper,
  languages are loaded on demand, Czech translation added; English (UK) is
  `en-GB`.
- Bundle split (CSS extraction, vendors, language chunks), PWA manifest, icons
  and service worker fixed.
- `make build` creates the release in `docs/` (GitHub Pages); `dist/` and
  `coverage/` are not stored in git.
- The repository moved to https://github.com/heptau/webphos.

### Fixed

- Text color returned to green while writing.
- Opened SVG could disappear after switching between document tabs.
- The tab of the only open document was shorter because of the missing close
  button.
- Name of the green theme in Settings was written in lower case.
- Icons on the layer buttons disappeared after translation.
- A new document or a document opened by switching tabs was marked as changed.

### Security

- Validation of URLs (SSRF) and of user input, escaping against XSS, Content
  Security Policy, no hard-coded API keys.
- Translated texts are sanitized before they are inserted into the page.
- Vulnerable dependencies updated (`npm audit fix`, `uuid`).

### Removed

- External links and the Search Images tool (nothing is sent to a server).
- The icon at the start of the menu.
- Unused code and files: old service worker and manifest, unused libraries and
  modules, example pages, the PHP translation tool and old preview images.
