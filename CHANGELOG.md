# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Only changes since version 5.0.0 are listed here.

## [Unreleased]

## [26.1.1] - 2026-10-09

### Fixed

- The main menu and its dropdowns are shown above open dialogs (they were hidden behind the dialog and its dimming).
- The fallback paste handler (`libs/clipboard.js`) used `this` in callbacks where it was not defined.

### Changed

- The application is renamed from WebPhos to Lumifex (name, dialogs, menus, icons, exported file names, internal identifiers such as the storage keys `lumifex_*`, documentation, `package.json`); the domain is now `lumifex.80.cz` (CNAME, sharing preview, `security.txt`), the GitHub repository is `heptau/lumifex`.
- The license file uses standard copyright lines, so GitHub recognizes the MIT license.
- Fewer app icons: the manifest has only 192 and 512 px (normal and maskable), the extra sizes, `favicon.png`, `favicon-32.png`, `logo.png` and `logo-colors.png` and `apple-touch-icon.png` are gone (the favicon and the About dialog use `manifest/192x192.png`, the iOS home screen icon uses `manifest/192x192-maskable.png`); icons are regenerated from the new full-bleed `lumifex-source.webp`. Added a social preview image (Open Graph / Twitter card) and a screenshot in the README.
- Code cleanup: `npm run lint` reports nothing (no `var`, no unused variables and imports, no `_this` aliases; vendored libraries are excluded from style rules).
- Menu items that work only with pixels (adjustments, most effects, Warp, Skew…, some selections) are disabled when the active layer is not a picture, like the tools in the toolbar.
- Files are formatted according to `.editorconfig` (tabs, LF, no trailing whitespace, a newline at the end of the file); the rules are described in `CONTRIBUTING.md`. Third-party libraries and the build output are not reformatted.
- The Code Style section of `CONTRIBUTING.md` and `AGENTS.md` ask for `const` / `let` and arrow functions instead of `var` and `var _this = this`.

## [26.1.0] - 2026-10-07

### Changed

- Dialogs with fields have OK, Cancel and Preview in a column on the right, like in Photoshop.
- Toolbar and menus follow the order of Photoshop: retouching, painting, blur and dodge tools form one group; File, Edit, Image (Adjustments), Layer, Select and View items are regrouped, all exports are in File > Export, Content Fill moved to Edit and Search to Help. The Effects menu is split into categories like the Photoshop Filter menu (Blur, Distort, Noise, Pixelate, Render, Sharpen, Stylize, Other).

### Added

- Type menu like in Photoshop: Character, Paragraph, Style (bold, italic, underline, strikethrough), Case, Warp Text (moved from Layer), Rasterize Type and Paste Lorem Ipsum for the active text layer; the style goes to the selected part of the text while the Text tool edits it.
- The marquee works on vector layers too, and the Move tool drags the selected part of a vector layer (it becomes a picture layer; Alt copies it to a new layer).
- Rectangular selection: handles resize it and dragging inside moves it. The Move tool drags the selection together with its pixels (Alt copies them), only its outline, or the whole layer (option "Selection content").

- Resizing a vector layer with the handles keeps its proportions while Shift or Option is held (Ctrl / Cmd did already); with a picture the same keys free them.

- Keyboard shortcuts: Export and Import buttons in the editor (a JSON file with the changes).

- The rulers show the position of the mouse with a line.

- Keyboard shortcuts can be changed: WebPhos > Keyboard Shortcuts… (also in Settings) lists every command, click a shortcut and press the new keys; conflicts are refused, changes are kept in the browser, the menus show the shortcut in use.
- Tool shortcuts as in Photoshop (V move, M marquee, L lasso, W magic wand, C crop, I eyedropper, J healing, S clone stamp, B brush, E eraser, G gradient, K paint bucket, T type, U shapes, P pen, H hand, Z zoom …), D = default colors, Ctrl+Shift+Z = redo, Ctrl+G / Shift+Ctrl+G = group / ungroup, Ctrl+] / Ctrl+[ = layer up / down, Alt+Ctrl+N / Alt+Ctrl+W = new / close document.

- Touch screens (iPad): holding a finger opens the context menu on a layer and, with tools that do not paint, on the canvas.

- Layer groups: a group mask (Layer > Group > Group Mask from Selection) and dragging layers onto a group in the layer list.

- File > Export as PSD (layers with place, opacity, visibility and blend mode, groups with their opacity and blend mode); File > Open reads groups from PSD files too.

- Pen: Layer > Edit Path (or a double click on a path layer) edits a finished path; Select > Make Path from Selection.

- File > Open reads Photoshop (.psd) files: layers with place, opacity, visibility and blend mode.

- Pen tool: Bezier paths that become a stroke / fill layer or a selection (Select > Selection from Path).

- Layer groups: groups inside groups (`Faces/Eyes`), group opacity and blend mode (drawn on their own), header rows with an eye and folding in the layer list, Layer > Group > Group Settings.

- Patch tool works on rotated and stretched layers.

- Edit > Warp stays accurate for larger moves of the points (the picture is sampled by inverting the displacement).

- Fill opacity no longer fades Drop Shadow and Outer Glow (as in Photoshop).

- Linked layers also follow when the active layer is resized or turned.

- Define Brush: the tip is remembered after the browser is closed.

- Pencil: Stabilizer and Symmetry options (as in Brush).

- Layer > New Adjustment Layer > Curves (graph editor with master, red, green and blue curves, editable any time).

- Marquee: Fixed Ratio and Fixed Size styles, Shift makes a square, Alt grows the selection from the center.
- Edit > Paste in Place (Shift+Ctrl+V) and Paste Into (Alt+Shift+Ctrl+V, the selection becomes the layer mask);
  File > Open > Open as Layer adds pictures to the current document.
- Layer Fill opacity (fades the pixels of the layer, not its styles) next to Opacity in the Layers panel.
- Image > Adjustments: Vibrance and Replace Color; Effects: Emboss and Find Edges.
- Sponge tool (saturate / desaturate with a flow) replaces the Desaturate brush.
- Alt + click with Brush, Pencil, Paint Bucket and Gradient picks the color under the cursor.
- Recently used colors under the color sample; View > Pixel Grid (shown from 600 % zoom).

- Layer > Create / Release Clipping Mask (Alt+Ctrl+G); several clipped layers on one base now clip correctly.
- Gradient tool: Linear, Radial, Angular, Reflected and Diamond types, Reverse, and Tools > Gradient Editor
  (color stops with opacity, presets; edits the active gradient layer or the tool).
- History Brush: paints back the picture the document had before its first change.
- Image > Adjustments > Color to Alpha.

- Edit > Transform Again (Shift+Ctrl+T) repeats the last move, scale or rotation of the Move tool.
- Image > Canvas Rotation > Arbitrary (any angle, the canvas grows) and Image > Straighten (the line drawn with the Ruler tool becomes horizontal).
- Layer > Copy / Paste Layer Style, Reverse Layer Order, Delete Hidden Layers; File > Export Layers (one PNG per layer in a ZIP).
- Brush stabilizer (smooths the stroke).
- Image > Adjustments > Black and White (a slider for every color, optional tint) and Solarize.
- Resize: Bicubic, Bilinear and Nearest Neighbor modes.

- Effects: Spherize, Ripple, Kaleidoscope, Radial Blur (spin / zoom), Surface Blur and Crystallize.
- Select > Modify > Round Corners.

- Layer > Link Layers / Unlink Layer (Shift+click a layer in the panel): linked layers move together with the active one.
- Brush symmetry: horizontal, vertical, both and radial (3, 4, 6, 8) around the center of the picture.

- Edit > Define Brush: the selected part of the picture (or the whole picture) becomes the tip of the Brush
  (options Tip: Round / Custom and Spacing).

- Brush dynamics: Scatter, Size jitter, Angle jitter, Opacity jitter and Follow direction (with a round or a custom tip).

- Select > Transform Selection: a frame with handles on the canvas scales, turns and moves the selection itself (live preview),
  the pixels stay; Enter applies, Escape cancels, the bar has the numeric dialog (Numbers).

- Layer > Warp Text: Arc, Bulge, Flag, Wave, Rise and Squeeze with a bend slider; the text stays editable.

- Layer > Blend If: the layer shows only where its own brightness and / or the brightness of the layers below is in a range, with soft edges.

- Adjustment layers (Layer > New Adjustment Layer): Brightness/Contrast, Levels, Hue/Saturation, Vibrance, Exposure,
  Color Balance, Photo Filter, Temperature/Tint, Black and White, Gradient Map, Selective Color, Threshold, Posterize
  and Invert. They change everything below, keep their settings (edit with Layer > Edit Adjustment Layer or a double
  click), and respect opacity and a layer mask (a selection becomes the mask of a new layer).

- Edit > Skew, Perspective and Distort for picture layers: drag the corners (edges for Skew) on the picture with a live preview;
  Enter applies, Escape cancels, the bar has the old numeric dialog (Numbers).

- Edit > Warp: a grid of points (3x3 to 6x6) over the picture of the layer; drag a point and the picture follows smoothly.

- Patch tool: draw around a blemish and drag the shape onto a clean place; the texture comes from the clean place, the colors
  from the surroundings of the blemish (modes Source / Destination, Adapt).

- Window > Actions: record menu commands together with the settings of their dialogs and play them again on any picture;
  actions are kept in the browser and can be exported / imported as a file.

- View > Rotate View (90° steps or any angle) and Flip View: only the way the picture is shown changes, the tools work as usual.

- Healing Brush: option Source (Automatic = spot healing in one click, Sampled = Alt + click chooses the place to copy from).

### Changed

- Fit window zooms to the next smaller whole percent, so the picture is never a few pixels too big for the free space.

- The plain letter shortcuts of commands are gone, the letters belong to the tools: Open and Save are Ctrl+O and Ctrl+S (Save As Shift+Ctrl+S), Resize is Alt+Ctrl+I, Information Alt+Shift+Ctrl+I; Trim, Rotate 90°, Auto Adjust, Duplicate Layer, Grid (still Ctrl+'), New Layer (still Shift+Ctrl+N) and Rulers (still Ctrl+R) lost their plain letter. Every shortcut can be set again in the editor.

- The menus are a little more transparent (and blur the picture under them) (the blur was on the menu bar itself, which kept the dropdowns from seeing the picture).

- Documents with several adjustment or Blend If layers draw much faster (the cost grows with the number of layers, not with its square).
- Painting on or moving a layer in a big document is much faster: the layers below the active one are drawn once and kept.
- Dragging an adjustment slider (or a layer under an adjustment) in a big document shows a smaller preview until the mouse button is released.

- Merge Down respects Blend If of the upper layer (the layer below is what it looks at).
- Flatten, Stamp Visible and Copy Merged now draw the layers the same way as the canvas (clipping masks, Blend If and
  adjustment layers count).
- Arrow keys with the Move tool nudge by 1 px, Shift + arrow by 10 px (as in Photoshop).

### Fixed

- A saved JSON project keeps layer masks, locks, groups and color labels when it is opened (they were dropped as "wrong key").
- Export dialog: closing it before the file size was calculated no longer throws an error.
- A layer whose name has three letters (for example "pic") was taken for an SVG picture (the Move tool, Erase and Fill refused it).

- Move tool: pressing in the frame of the selected stroke (where the pointer shows the move arrows) moves the stroke, not the picture below it.

- The only open document can be closed (it is replaced by an empty new one; unsaved changes are asked about first).

- Brush and pencil strokes are stretched when the layer is resized with the handles (they only moved before).

- The empty first layer can be converted to a raster layer (the button works), and choosing a tool that works on pixels (eraser, bucket, blur, selections …) does it by itself instead of showing "This layer must contain an image".

- Rulers: the shortcut is Alt+Ctrl+R (Cmd+R reloads the page in Safari). The shortcut editor marks the shortcuts that the browser may take for itself.

- Keyboard shortcuts: holding a key no longer runs a command over and over (a shortcut that switches something, like the rulers, switched back and forth), and the shortcuts work after a click on a checkbox, slider or button.

## [26.0.1] - 2026-10-07

### Security

- Code scanning alerts: the token of the CI workflows has the least permissions, the filename sanitizer drops `..` path
  segments instead of stripping them with a regular expression, and the language loaders are kept in a `Map` instead of a
  lookup by a dynamic property name.
- Dependabot alerts: `qs` and the `uuid` used by `sockjs` are forced to patched versions; the CI audits production
  dependencies only.

### Changed

- Commit messages follow Conventional Commits (see `CONTRIBUTING.md`).
- The published site has a `security.txt`, and the build no longer ships the unused `effect-worker.js`.
- The bundle analysis step of the CI writes clean webpack stats.

## [26.0.0] - 2026-10-06

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
