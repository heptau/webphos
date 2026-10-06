# AGENTS.md

Informace pro AI agenty pracující na WebPhos (dříve miniPaint, webový editor obrázků, vanilla JS + HTML5 canvas, bez frameworku).

## Příkazy

| Příkaz | Účel |
|---|---|
| `npm run server` | dev server (webpack serve) |
| `npm test` | Jest (ts-jest + jsdom), testy v `tests/*.test.ts` |
| `npm run lint` | ESLint (`src/js public tests scripts`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | produkční build do `dist/` + `scripts/post-build.js` (kopie do `docs/` pro GitHub Pages) |

`VERSION` v kořeni je jediný zdroj verze aplikace (čte ji webpack i `make build`); nové věci patří do `CHANGELOG.md` pod `## [Unreleased]`. `dist/` a `coverage/` jsou v `.gitignore` (release jde do `docs/` přes `make build`; samotné `npm run build` do `docs/` zkopíruje jen `index.html` a obrázky).

Před dokončením změny spusť `npm test` a `npm run lint`. `dist/` a `docs/` jsou **build artefakty** (`docs/` se commituje, `dist/` ne; needituj je ručně; hashe souborů se mění při každém buildu). Nebuilduj, pokud to uživatel nechce.

## Struktura

```
src/js/
  main.js, app.js          vstup, globální objekt `app` (State, Actions, GUI, Layers…)
  config.js                globální stav (`config.layer`, `config.TOOL`, `config.LANG`…)
  config-menu.js           definice hlavního menu (deklarativně)
  config-shortcuts.js      klávesové zkratky s modifikátory (Ctrl/Cmd, Shift, Alt)
  core/                    base-layers, base-state (undo), base-gui, base-selection, gui/*
  actions/                 undo/redo akce (viz actions/_README.md)
  modules/<menu>/<x>.js    jedna třída = jedna položka menu (edit, file, image, layer, effects, tools, view, help)
  tools/                   nástroje v panelu (brush, selection, fill…)
  libs/                    čisté pomocné knihovny – testovatelné bez DOM (adjustments.js, shortcuts.js…)
  languages/*.json         překlady (klíč = anglický text)
tests/                     Jest testy (TypeScript importující JS z src/)
```

## Jak funguje menu

Položka v `config-menu.js`:

```js
{ name: 'Invert', shortcut: 'Ctrl+I', ellipsis: false, target: 'image/adjustments.invert', parameter: 'x' }
```

`target` = `<složka modulu>/<soubor>.<metoda>`. Modul `src/js/modules/image/adjustments.js` se načte dynamicky a zavolá se metoda třídy (default export). Moduly jsou singletony (`if (instance) return instance;`). `ellipsis: true` přidá „…“ (dialog). `parameter` se předá metodě.

## Přidání nové funkce (postup)

1. **Čistá logika** do `src/js/libs/` jako exportované funkce nad `{data, width, height}` (ImageData-like), zachovávej alfa kanál, vstupy ošetři (`clamp`, `parseInt`).
2. **Modul** v `src/js/modules/<menu>/` (nebo rozšíření existujícího). Pro úpravu pixelů vrstvy použij vzor z `modules/image/adjustments.js`:
   - `Base_layers.convert_layer_to_canvas(null, true)` → upravit → `app.State.do_action(new app.Actions.Update_layer_image_action(canvas))` (tím je zajištěno undo/redo).
   - dialog s živým náhledem: `Dialog_class.show({title, preview: true, effects: true, params: [...], on_change, on_finish})`.
   - vrstva musí být `config.layer.type == 'image'`, jinak `alertify.error(t('This layer must contain an image. Please convert it to raster to apply this tool.'))`.
3. **Menu** v `config-menu.js`, případně **zkratka** v `config-shortcuts.js` (zkratky jednoho písmene bez modifikátorů si registrují moduly samy přes `keydown`; používej `has_modifier(event)` z `libs/shortcuts.js`, aby nekolidovaly s Ctrl/Cmd/Alt).
4. **Překlady**: nové texty (názvy menu, popisky parametrů) přidej alespoň do `languages/cs.json` (ostatní jazyky fallbackují na angličtinu). Text volej přes `t('…')` z `modules/tools/translate.js`; popisky parametrů dialogu a položky menu se překládají automaticky podle klíče.
5. **Testy** pro logiku v `libs/` do `tests/`.
6. Aktualizuj tabulku „Hotové funkce“ níže.

## Výběr a maska

- Nástroj `tools/selection.js` drží obdélník (`selection`). Nad ním je `core/selection-mask-state.js` (`Selection_mask_class.get()`), který vrací `{mask, kind: 'rect'|'custom', rect}` nebo `null`, když nic není vybráno. Maska je 8bitový alfa kanál ve velikosti plátna (`libs/selection-mask.js`, čisté funkce).
- „Custom“ maska (inverze, změkčení, elipsa, barevný rozsah…) je vázaná na jeden obdélník (jeho ohraničení). Jakmile se obdélník změní (nový výběr, undo, posun), maska přestane platit a výběr je zase obyčejný obdélník – není potřeba ji ručně rušit.
- Spotřebitelé výběru berou masku přes `new Edit_selection_class().get_mask()`: `apply_direct()` v `modules/image/adjustments.js` (míchá původní a upravený obraz přes `blend_with_mask`), `modules/edit/fill.js`, `Selection_class.delete_selection` (`erase_with_mask`). Pro obdélníkovou masku je rychlá cesta bez míchání.
- Nástroje, které vytvářejí masku (`tools/lasso.js`, `tools/magic_wand.js`), dědí z `core/base-mask-tool.js`: sdílí obdélník a stav masky s výběrovým nástrojem (vlastní `Base_selection` nastavení s `data_function` na `Selection_class.selection`), řeší Feather a Shift/Alt (`commit_mask`) a vykreslují překrytí. Výsledek se ukládá přes `Edit_selection.set_mask(mask, false)`. `on_leave` nástroje musí být odolné vůči startu aplikace (při obnově uloženého nástroje ještě neexistuje `app.Layers`). Nástroje se záznamem `keep_selection: true` v `config.TOOLS` nemažou výběr, když se mezi nimi přepíná (`actions/activate-tool.js`); volitelná metoda `on_switch_keep_selection()` jen zruší rozpracovaný stav nástroje. Nový nástroj = soubor v `src/js/tools/`, záznam v `config.TOOLS`, ikona v `images/icons/` a řádek v `src/css/layout.css`. Ikony nástrojů jsou jednotná sada: SVG 24×24, bez výplně, černý tah 1.5 se zaoblenými konci (barvu v motivu řeší CSS filtr), plná jen drobná zvýraznění.
- Undo/redo masky: každá změna masky jde přes akci. `Set_selection_action` a `Reset_selection_action` custom masku vyčistí a při undo ji vrátí; `Set_selection_mask_action` (`actions/set-selection-mask.js`) nastaví novou masku k aktuálnímu obdélníku. Operace, která mění obdélník i masku, proto dává do `Bundle_action` `Set_selection_action` a hned za něj `Set_selection_mask_action` (to dělá `Edit_selection.set_mask`). Masku neměň přímo přes `Selection_mask.set_custom`/`reset` uvnitř uživatelské operace – nešla by vrátit.
- Dialog s živým náhledem masky: `Edit_selection.preview_dialog({title, params, compute, on_finish})` (volá `compute(params)` po krátké pauze, výsledek se kreslí oranžově místo výběru přes `Selection_mask.set_preview`; zavře se s dialogem). `Dialog.show` má volbu `live: true`, která volá `on_change` i při tažení posuvníku bez náhledu obrázku. Nové operace s maskou dělej přes `mask_dialog` (funkce `(mask, params) => nová maska`).
- Nová operace s výběrem = funkce `libs/selection-mask.js` + `Edit_selection.set_mask(mask)` (nastaví obdélník na ohraničení masky a zaregistruje masku).

## Efekty a styly vrstvy

- Styly, které se kreslí samy (Stroke, Inner Shadow, Color Overlay), dědí z `effects/abstract/layer-style.js`: ten řeší dialog s vlastním náhledem (`draw_preview`), cache (`cached(layer, key, build)`) a transformaci do prostoru vrstvy (`transform_to_layer`); styl, který potřebuje víc obrázků na vrstvu, použije různé `slot` v `cached()`. Stroke kreslí vnější část v `render_pre` (pod obrázek) a vnitřní v `render_post`, ostatní styly v `render_post` (nad obrázek; v `render_post` nastav `ctx.filter = 'none'` a vrať ho, ať se na překrytí neaplikuje stín z jiného filtru). Název souboru s pomlčkou (`inner-shadow.js`) = název filtru = metoda s podtržítkem (`inner_shadow`) – jinak nefunguje úprava filtru v panelu vrstev.
- Živé filtry vrstvy jsou moduly v `src/js/modules/effects/**` (`render_pre(ctx, filter, layer)` se volá před kreslením vrstvy, `render_post` po něm, `demo()` kreslí náhled v Effects browseru). Seznam filtrů vrstvy je `layer.filters` (`Add_layer_filter_action`).
- CSS `ctx.filter` je levný jen pro jedno rozostření (`drop-shadow` s blur, Glow). **Řetězení mnoha `drop-shadow` filtrů je výkonově nepoužitelné** (3 s pro 16 filtrů na 800×600), proto Stroke kreslí vlastní obrys do cache (`WeakMap` podle vrstvy, klíč = obrázek + velikost + barva).
- Hodnoty z filtrů mohou přijít z uloženého projektu – do CSS stringů nic nevkládej bez ověření (`safe_color` v `libs/layer-styles.js`).

## Vrstvová maska

- `layer.mask` = `{width, height, values[], counts[]}` (RLE, 255 = vidět), `layer.mask_enabled === false` ji vypne. Žije v souřadnicích vrstvy, takže se s vrstvou posouvá, mění velikost i otáčí. Mění se jen přes `Update_layer_action` (undo/redo funguje), nikdy přímo.
- `Base_layers.render_object` vykreslí maskovanou vrstvu na dočasné plátno, ořízne ji maskou (`destination-in`) a složí; `render_object_plain` kreslí bez masky. Efekty a styly vrstvy se tedy maskují spolu s ní. Úpravy pixelů (`convert_layer_to_canvas(id, true)`) masku nevidí a pracují s plnými pixely.

## Vzhled (macOS + Photoshop)

- Vzhled se řídí Apple HIG: barevné tokeny (`--accent`, `--separator`, `--field-background`…) jsou v `css/reset.css` pro `:root` (tmavé), `body.theme-light` a `body.theme-green`; strukturu a komponenty přepisuje `css/macos.css` (načítá se po ostatních CSS). Novou barvu přidej jako token do všech tří témat, ne natvrdo.
- Název a ikona: aplikace se jmenuje WebPhos; ikona (štětec, skleněný hranol, duha) je jediný zdrojový obrázek `images/webphos-source.webp`, z něj `scripts/make-icons.sh` (ImageMagick) vytvoří `favicon*.png`, `apple-touch-icon.png`, `logo.png` (menu), `logo-colors.png` (O aplikaci) a `images/manifest/*`. Rohy se ořezávají maskou, protože zdroj má černé rohy.
- Menu: zkratky se na macOS zobrazují jako ⇧⌘D (`format_shortcut_mac` v `libs/shortcuts.js`). Dialogy (`libs/popup.js`): titulek uprostřed, červené zavírací kolečko vlevo, tlačítka vpravo (Zrušit, výchozí Ok modře), třída `has_preview` u dialogů s náhledem.
- Hlavní menu: první položka je název aplikace tučně (`app_menu: true` v `config-menu.js`; O aplikaci, Nastavení), pak File, Edit, Image, Layer, Select, Effects, View, Tools, Help (pořadí jako Photoshop pro Mac). Jazyk aplikace se volí v Nastavení. Menu se otevře už při stisku tlačítka myši, položka se spustí až při puštění nad ní (`on_mouse_down_menu` / `on_mouse_up_menu` v `gui-menu.js`); tři tečky v názvech jsou „…“ bez mezery.
- Panel nástrojů vlevo má dva sloupce ve skupinách jako Photoshop; pořadí určuje `get_ordered_tools()` v `core/gui/gui-tools.js` (nezávisle na pořadí v `config.TOOLS`); skupiny mají sudý počet nástrojů (čtou se po řádcích ve dvou sloupcích), aby před oddělovačem nezůstala díra – nový nástroj přidej tak, aby to zůstalo. Levý i pravý panel začínají hned pod menu.
- Texty voleb v dialogu (`values` u `select`) se překládají přes `t()`; nový text přidej do `languages/cs.json` (klíč = anglický text).
- Dialogy s náhledem (`has_preview`): náhled vlevo, parametry vpravo, zaškrtávátko Náhled, tažení za náhled ukáže originál, Alt změní Zrušit na Obnovit (`reset_params`), vedle posuvníku je číselné pole a tažení za popisek mění hodnotu.
- Panel Vrstvy je v pravém sloupci nahoře pod Barvami a vyplňuje zbytek výšky; v hlavičce je režim prolnutí a krytí aktivní vrstvy (`sync_layer_props`). Detaily vrstvy jsou ve výchozím stavu sbalené.
- Barvy: popředí `config.COLOR`, pozadí `config.COLOR_BG` (X = prohodit, Edit > Fill with Background Color, Ctrl+Backspace). Pravítka (Ctrl+R) a vodítka se vytvářejí tažením z pravítka; Ctrl+; skryje vodítka, Shift+Ctrl+; přepne přichytávání.
- Navigace: kolečko myši posouvá, Ctrl/Cmd/Alt + kolečko (nebo pinch) zvětšuje, Mezerník + tažení = ruka, procento zvětšení je upravitelné ve stavovém řádku.
- Menu Okno (`libs/panels.js`) skrývá/zobrazuje panely (stav v cookie `panel_*`, Tab skryje vše); File > Open Recent drží posledních 8 souborů v IndexedDB (`libs/recent-files.js`); pravé tlačítko na plátně a na vrstvě otevře kontextové menu (`core/gui/gui-context-menu.js`).
- Export: nabízí jen formáty, které prohlížeč umí (`libs/export-formats.js`); BMP kóduje vlastní `libs/bmp.js`. Barva akcentu následuje systém (`AccentColor`), zelené téma má vlastní.
- Testy hlídají překlady (`tests/translations.test.ts`: menu, titulky dialogů, šablona `empty.json`) a kontrast témat (`tests/theme-contrast.test.ts`).
- Záložky dokumentů (`core/gui/gui-documents.js`): aktivní dokument žije v aplikaci, ostatní jsou uložené jako JSON projektu (`export_as_json`) a načtou se zpět při přepnutí; historie (undo) patří aktivnímu dokumentu, takže se při přepnutí maže. File > New (i „+“ v záložkách) otevře nový dokument v nové záložce (`before_new`). Panel Historie je v pravém sloupci (`core/gui/gui-history.js`, událost `minipaint:history` z `base-state`).
- Dialogy: náhled drží poměr stran obrázku (`fit_preview_size`), `{heading: '…'}` v parametrech vloží nadpis sekce, dialog je `aria-modal`, drží fokus (Tab) a po zavření ho vrací. Resize propojuje šířku, výšku a procenta (Zachovat proporce), New file plní rozměry z předvolby a orientace.
- Přístupnost: menu jde ovládat klávesnicí i po otevření myší, panel nástrojů má šipky (roving tabindex), aktivní vrstva má `aria-current`, stavový řádek není `aria-live`; respektuje se `prefers-reduced-motion` a `prefers-contrast: more`.
- Překlady: ostatní jazyky obsahují jen skutečné překlady (žádné prázdné ani shodné s klíčem); nový text přidej do `cs.json`, spusť `npm run translations:sync` (doplní `empty.json`) a přelož ho i do ostatních jazyků (test `translations.test.ts` kontroluje prázdné hodnoty).
- Rozlišení (dpi) patří dokumentu: `config.RESOLUTION` (`null` = výchozí z Nastavení, `Tools_settings.get_setting('resolution')` vrací hodnotu dokumentu, `get_default_resolution()` výchozí); mění se v Image > Information, ukládá se do JSON projektu (`info.resolution`) a nový dokument začíná s výchozím.
- Jednotky velikosti patří dokumentu stejně jako dpi (`config.UNITS`, `libs/units.js`: pixely, palce, cm, mm, body, pika; `get_setting('default_units')` vrací jednotku dokumentu). Nový soubor, Canvas Size a Resize mají pole Šířka/Výška + Jednotky + Rozlišení (dpi) propojená přes `libs/dialog-units.js` (změna jednotky převádí čísla, změna dpi drží fyzický rozměr, pod tím je „Pixely“). Resize má „Převzorkovat“: bez něj se pixely nemění a přepočítá se dpi / druhý rozměr (jako Image Size ve Photoshopu).
- Informace o obrázku (velikost, myš, rozlišení) jsou ve stavovém řádku dole (`#status_bar`, `core/gui/gui-information.js`), ne v pravém panelu.
- Nástroje, které umí jen rastrovou vrstvu (`libs/raster-tools.js`, `RASTER_TOOLS`), jsou v panelu vlevo zakázané (šedé), dokud je aktivní vektorová vrstva (text, tvary); `GUI_tools.update_disabled_tools()` se volá z `render_layers`. Nový nástroj, který hlásí „This layer must contain an image“, přidej do seznamu.

## Konvence

- Styl okolního kódu: tabulátory, `var`/`let` jak je v souboru, žádný framework, žádné nové závislosti bez důvodu.
- Žádné odesílání dat na server (privacy-first); externí volání jen přes existující `url-validator`/`input-validator` knihovny.
- Uživatelský vstup z URL/souborů validuj (`libs/input-validator.js`, `libs/url-validator.js`).
- Nastavení (téma, jazyk) se ukládá do cookie přes `libs/cookie-config.js`; téma/jazyk mají režim `auto` (podle systému, `libs/system-preferences.js`).
- Komunikace s uživatelem a komentáře v commitech: čeština nebo angličtina, commit zprávy anglicky ve stylu stávající historie.
- Nepřidávej osobní údaje zákazníků (PII) do kódu, testů ani odpovědí.

## Hotové funkce ve stylu Photoshopu

Rychlý přehled, co už je hotové (aby se nepřidávalo dvakrát) a kde to je. Při přidání funkce doplň řádek do správné skupiny.

### Výběr

| Funkce | Kde / soubor | Zkratka |
|---|---|---|
| Select All / Deselect / Reselect, Inverse | Select | Ctrl+A / Ctrl+D / Shift+Ctrl+D / Shift+Ctrl+I |
| Výběrový nástroj s volbou Tvar (obdélník / elipsa) | `tools/selection.js` | – |
| Lasso (volná ruka / polygonální, Shift = přidat, Alt = odečíst, Feather) | `tools/lasso.js` | – |
| Kouzelná hůlka (tolerance, souvislé/globální, Shift/Alt, Feather) | `tools/magic_wand.js`, `magic_wand_mask` | – |
| Quick Mask – malování výběru štětcem (velikost, měkkost, Odečítat, Alt = opačně); s cílem „Maska vrstvy“ maluje přímo do masky aktivní vrstvy (živě, jedna akce undo) | `tools/quick_mask.js`, `paint_mask_line` | Q |
| Color Range, Layer Transparency (i Ctrl+klik na vrstvu v panelu vrstev), Grow (souvislé) a Similar | Select, `select_similar_mask` | Ctrl+klik |
| Modify: Expand, Contract, Feather, Smooth, Border, Offset, Rectangle to Ellipse; Refine Edge včetně „Přichytit k hranám“ (guided filter `guided_refine_mask` podle obrazu aktivní vrstvy; funguje, když je hrubá hrana nejvýš pár pixelů od skutečné hrany – větší mezery řeš přes Grow) | Select, `libs/selection-mask.js` | – |
| Živý náhled masky na plátně v dialozích výše | `Edit_selection.preview_dialog` | – |
| Save / Load / Delete Saved Selection (IndexedDB `minipaint_selections`, RLE) | `libs/selection-store.js` | – |
| Import / export výběrů: JSON (`minipaint-selections`) a šedotónové PNG | `libs/selection-file.js` | – |
| Edit > Stroke Selection (uvnitř/uprostřed/vně) | `stroke_mask` | – |
| Fill with Foreground Color, Delete, adjustments a filtry respektují výběr i měkké okraje | Edit, `apply_direct` | Alt+Backspace |

### Kopírování a vrstvy

| Funkce | Kde / soubor | Zkratka |
|---|---|---|
| Layer via Copy / Layer via Cut / Copy / Cut / Copy Merged (vybraná část včetně masky výběru i masky vrstvy) | `Edit_selection.get_selection_canvas` | Ctrl+J / Shift+Ctrl+J / Ctrl+C / Ctrl+X / Shift+Ctrl+C |
| Layer > New from Selection (Merged), Crop to Selection, Trim to Content | `layer/new.js`, `image/crop_selection.js`, `image/trim.js` | – |
| Layer Mask (reveal/hide all, z výběru, na výběr, invertovat, vypnout, použít, smazat; zobrazená v panelu vrstev) | `libs/layer-mask.js`, `modules/layer/mask.js` | – |
| Layer Styles: Drop Shadow, Outer Glow, Stroke (vně/uvnitř/uprostřed), Inner Shadow, Color Overlay, Gradient Overlay (blend módy) | `modules/effects/common/*`, `libs/layer-styles.js` | – |
| Lock / Unlock Layer (zamčená vrstva nejde malovat, filtrovat, hýbat ani měnit velikost; `layer.locked`, `libs/layer-lock.js`, guard v `Update_layer_action` a `Update_layer_image_action`; v panelu ikona 🔒) | `modules/layer/lock.js` | – |
| Skupiny vrstev (odlehčené: `layer.group` = název; Set/Clear Group, Show/Hide Group, Merge Group; v panelu `skupina › vrstva`; `libs/layer-groups.js`) | `modules/layer/group.js` | – |
| Align / Distribute (k výběru nebo plátnu; rovné mezery mezi vrstvami) | `libs/layer-align.js`, `modules/layer/align.js` | – |
| Canvas Rotation (celé plátno), Image Rotation, Mirror | `libs/canvas-rotate.js` | – |
| Edit > History (skok na libovolný krok undo historie), Edit > Fade (zeslabení poslední úpravy z `apply_direct`, jen dokud je to poslední krok historie) | `modules/edit/history.js`, `image/adjustments.js` | Shift+Ctrl+F |
| Merge Down / Flatten / New layer, Zoom, Grid, Brush size | Layer, View, Tools | Ctrl+E / Shift+Ctrl+E / Shift+Ctrl+N, Ctrl +/-/0/1, `[` `]` |

### Úpravy obrazu a efekty

| Funkce | Kde / soubor | Zkratka |
|---|---|---|
| Levels (i po kanálech), Curves (interaktivní graf: klik přidá bod, tažení ohýbá, dvojklik maže; master + R/G/B; histogram vrstvy v pozadí; `curvesFromPoints`, `histograms`), Brightness/Contrast, Hue/Saturation (i Colorize), Exposure, Color Balance, Selective Color, Photo Filter, Gradient Map, Channel Mixer, Shadows/Highlights, Temperature/Tint, Sepia, Swap/Extract Channel | Image > Adjustments, `libs/adjustments.js` | Ctrl+L, Ctrl+M, Ctrl+U, Ctrl+B |
| Invert, Desaturate, Threshold, Posterize, Equalize, Auto Contrast, Auto Color | Image > Adjustments | Ctrl+I, Shift+Ctrl+U, Shift+Ctrl+L, Shift+Ctrl+B |
| Add Noise, Pixelate, Unsharp Mask, High Pass, Median, Maximum, Minimum, Motion Blur, Offset, Clarity, Smart Blur | Effects, `libs/filters.js` | – |
| Twirl, Wave, Clouds, Lens Flare | Effects, `libs/distort.js` | – |
| Dodge/Burn, Smudge | `tools/dodge_burn.js`, `tools/smudge.js` | – |
| Kapátko s velikostí vzorku (bod … 31x31 průměr) | `tools/pick_color.js`, `libs/color-sampling.js` | – |

### Retuš, nástroje a rychlé úpravy (2. etapa)

| Funkce | Kde / soubor | Zkratka |
|---|---|---|
| Hojící štětec (textura ze okolí + přizpůsobení barev), Červené oči, Guma pozadí, Tekutost (posun pixelů) – všechny dědí z `core/base-pixel-tool.js` (stopa po tahu, jeden krok undo); algoritmy v `libs/retouch.js` | `tools/heal.js`, `red_eye.js`, `background_eraser.js`, `liquify.js` | – |
| Ruka (i dočasně Mezerník), Lupa, Měření (délka, úhel ve stavovém řádku), Rychlý výběr (přemalování objektu) | `tools/hand.js`, `zoom.js`, `measure.js`, `quick_select.js` | Z (lupa) |
| Select > Subject – výběr objektu na klidném pozadí (pozadí se hledá od okrajů, `select_subject_mask`) | `edit/selection.js` | – |
| Image > Quick Edit (úprava slovy česky/anglicky, `libs/quick-commands.js`), Recipes (hotové kombinace), Match Color (`libs/color-match.js`), Repeat Last Adjustment | `image/quick_edit.js`, `image/adjustments.js` | Shift+Ctrl+Q, Alt+Ctrl+F |
| Panely Histogram a Historie, barva pod kurzorem a měření ve stavovém řádku | `core/gui/gui-histogram.js`, `gui-history.js`, `gui-information.js` | – |
| Vrstvy: hledání, barevné štítky (`layer.color_label`), přetahování pro změnu pořadí, Bevel & Emboss, výplňové vrstvy | `gui-layers.js`, `layer/label.js`, `layer/fill.js`, `effects/common/bevel.js` | – |
| Okno > Pracovní plocha (Essentials, Painting, Photography, Minimal, vlastní), Proof Colors (simulace barvosleposti CSS filtrem) | `libs/panels.js`, `view/proof.js` | – |
| Export PDF (`libs/pdf.js`), import SVG, rychlý export, volitelný systémový dialog uložení (`libs/file-save.js`), Vložit jako nový dokument, Soukromí (mazání uložených dat) | `file/save*.js`, `edit/paste_new.js`, `help/privacy.js` | Alt+Shift+Ctrl+W |
| Autosave všech dokumentů (`libs/autosave.js`), nabídka obnovení po startu, nový dokument při otevření souboru (nastavení) | `core/gui/gui-documents.js` | – |

Poznámky: historie (undo) patří aktivnímu dokumentu, takže se při přepnutí záložky maže; chytré objekty, cesty (pero), skutečné skupiny a PSD nejsou hotové.

### 3. etapa (fotografické efekty, export, dokumenty)

| Funkce | Kde / soubor |
|---|---|
| Vzhled výběrů jako ve Photoshopu: „pochodující mravenci“ (`libs/marching-ants.js`, příznak `ants` v nastavení `Base_selection`), ořez ztmaví okolí (`shade_outside`), tenké rámečky; Navigator (panel Náhled) má poměr stran obrazu a tenký červený rámeček | `core/base-selection.js`, `core/gui/gui-preview.js` |
| Select: Sky, Edges, Luminosity Mask, Selection to New Layer, Remove Background (maska vrstvy) | `edit/selection.js`, `layer/mask.js`, `libs/selection-mask.js` |
| Efekty s živým náhledem: Vignette, Dehaze, Tilt-Shift, Split Toning, Film Grain, Halftone, Chromatic Aberration, Dust & Scratches, Defringe, Blur Background, Sharpen Edges, Reduce Color Noise, Soften Skin, HDR Toning, White Balance, Duotone, Reduce to Palette, Pixel Art, Color Lookup (.cube), Save Last Adjustment as LUT | `image/photo_effects.js`, `libs/effects2.js`–`effects4.js`, `libs/lut.js` |
| Export: Sizes (ZIP), App Icons, Selection, Watermark, Sprite Sheet, Print Tiles, Document Info, Copy as Data URL; ZIP bez knihovny (`libs/zip.js`) | `file/export_extra.js` |
| Šablony dokumentů (IndexedDB), Copy Layer to Document, tabové kontextové menu, Duplicate Document, Swatches .gpl | `file/templates.js`, `layer/copy_to_document.js`, `tools/swatches.js` |
| Vrstvy: Stamp Visible, Rename All, solo oka (Alt+klik), přejmenování v řádku; úpravy: Repeat Last Command, Zoom to Selection, Pattern Fill, Find and Replace Text | `layer/*.js`, `edit/*.js` |
| View: Split Compare (snímek originálu v `Base_state.remember_original`), Canvas Color, Grid Settings; Help: Describe Document; téma „contrast“; Settings: Large controls | `view/*.js`, `reset.css` |

Poznámka: při přehrávání historie (`Edit_history.go_to`) se pozastaví vykreslování (`config.freeze_render`) – vrstvy jsou v půlce akce a text by spadl.

## Poznámky a omezení

- Uložené výběry nejsou součástí JSON projektu (jsou v IndexedDB prohlížeče, společné pro všechny dokumenty); přenos mezi počítači je přes Select > Import / Export.
- Stránka má Content-Security-Policy bez `blob:` v `img-src`: obrázky ze souborů dekóduj přes `createImageBitmap(file)` nebo `FileReader` (data URL), ne přes `URL.createObjectURL` + `Image`.
- Náhled v dialozích úprav obrazu (`show_dialog`) ukazuje celou vrstvu, i když se výsledek aplikuje jen na výběr.
- Aplikace zná jen jednu aktivní vrstvu, takže zarovnání více vrstev najednou k sobě není možné (Distribute bere všechny viditelné).
- Překlady jsou jen česky (`cs.json`); `empty.json` je šablona se všemi klíči pro překladatele.

## Nápady na další funkce

- Skutečné skupiny vrstev (stromová struktura, sbalování, společná průhlednost/maska skupiny; teď jen pojmenovaná označení).
