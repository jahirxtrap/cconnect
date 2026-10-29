# CLAUDE.md — client (Svelte + Tauri)

The app: desktop, web and Android from one Svelte 5 + Tauri 2 codebase, against the backend
contract. Assets and the web build are named `cconnect-tauri`.

## Layout

```
src/
├── App.svelte              # routes, window-level keydown / drag guards
├── app.css                 # global rules + keyframes (menus, ripple, markdown)
└── lib/
    ├── app/                # navigation (URL routing per screen)
    ├── data/               # models, settings, format helpers, time, previewKind
    ├── design/             # tokens.css, theme, themes, fonts, backgrounds, scrollbars.css, packs/
    ├── i18n/               # one JSON per locale — every user-facing string
    ├── markdown/           # the Markdown renderer and its cconnect blocks
    ├── platform/           # isTouch, layout, desktop, fieldSizing polyfill
    ├── screens/            # chat/, agents/, shared/, project/, claude/, mods/, packs/, browser/, monitor/, settings/, terminal/, notes/
    ├── services/           # backend clients: chatSocket, sessionsApi, sharedApi, claudeApi…
    └── ui/                 # the shared toolkit
src-tauri/                  # Rust side + gen/android (committed)
```

Themes, terminal colours, fonts, accents and chat backgrounds come from packs
(`design/packs/`). The built-in ones and the pack format are the backend's: the build globs
`backend/core/packs/**` and imports its `schema.json` and `builtin.json`, `opened.rs` compiles
the schema in, and the client reader (`design/packs/reader.ts`) has to validate exactly as
`backend/services/pack_format.py` does. The Packs dialog lists the server's whole library,
each entry with its standing against the installed copy (`standingFor`); only `new` and
`newer` offer an action, and `offeredPacks` counts those for the settings row. Deleting from
the server asks for the security key through `SecurityKeyDialog` and stores it only once a
request with it went through, as the terminal does.

## Rules

- **Svelte 5 runes only** (`$state`, `$derived`, `$effect`, `$props`). Actions (`use:x`) have
  no `update` hook: reactivity inside one needs its own observers, or an `$effect` in the
  component that calls back into it.
- **Reuse the toolkit.** `PopupMenu`, `MenuSub`, `MenuItem`, `InputField`, `ListRow`,
  `CompactDialog`, `ConfirmDialog`, `CardPanel`, `ScrollCard`, `FloatDock`, `TabPager`,
  `ZoomPane`, `DropOverlay`, `MarkdownText`, `CodeBlock`, `SelectionDot`, `scrollbar`,
  `gridHeight`, `fileDrop`, `keepFocus`, `menuSurface`, `sharedFileActions`. New screens
  compose these; forking a variant is how the two apps drift.
- **Tailwind is concatenated by hand — there is no twMerge.** Two conflicting utilities both
  end up in `class`, and the winner is whatever CSS order decides. Resolve conflicts with a
  prop or a conditional, never by appending another class.
- Menus, tooltips, dialogs and popovers come from **bits-ui**. Menus open to the right
  (`align="start"`), collision padding comes from `layout.menuPadding`, and the exit
  animation is `.menu-surface[data-state="closed"]` in `app.css`. On touch a `MenuSub`
  drills down in place with a row to go back (`ui/menuDrill.svelte.ts`) instead of
  floating a second menu; on the desktop it opens on hover, through a `Portal`, because the
  rounded viewport's mask clips anything positioned inside it.
- Every string goes through `t()` and lives in the `lib/i18n/*.json` catalogs, one per
  locale and picked up on their own. `en.json` is the base: a key missing from another
  catalog falls back to it, so a new string goes there first. Plurals are CLDR forms in
  uppercase (`_ONE`, `_FEW`, `_MANY`, `_OTHER`) and a catalog only has the forms its language
  uses. Outside English every form carries `{1}`, since `_ONE` there also covers numbers
  like 21.
- **`platformName()` answers `"web"` for anything outside Tauri**, so it says which build
  is running, not which system. Anything that depends on the OS — ⌘ versus Ctrl, the
  iPhone's install path — asks `systemName()`, which reads the agent either way. Mixing
  them is what left the browser on a Mac showing Ctrl shortcuts.

## The pixel grid (`lib/ui/gridHeight.ts` + `design/tokens.css`)

Scroll positions only land on whole **device** pixels (0.8 CSS px at dPR 1.25), so anything
that grows inside the message list must be a multiple of that or the content shifts by a
fraction of a pixel on every open/close. It takes two halves and neither is enough alone:

- `theme` publishes `--px-grid` (`1 / devicePixelRatio`) and the chat tokens are rounded to
  it inside `@supports (width: round(1px, 1px))` — a 14px gap that was half a device pixel
  is what clipped the rounded edge of the bars inside a pager. A hardcoded list of snapped
  values is the wrong shape for this; let CSS do the rounding.
- `gridHeight` pads a node up to the next device pixel from a `ResizeObserver`, which is
  what a collapsible body needs. It rounds the padding to Blink's layout unit, and that unit
  is 1/64 of a **device** pixel where Chromium lays out in device pixels (WebView2, Android):
  rounding to 1/64 of a CSS px instead left the body 0.016 device px short at dPR 1.25, and
  the text below it jumped a pixel on every open. An arbitrary epsilon there is wrong and
  unstable.

## Chat scroller (`screens/chat/ChatScroller.svelte`)

One component owns the viewport; the chat list (`MessageList`) and the quick chat
(`SidePanel`) mount it, and the API is exported (`atBottom`, `scrollToEnd`, `holdAt`,
`scrollFromEnd`, `scrollTo`, `bringToTop`, `refreshHeader`, `collapsePinned`…).

- `follow` is the stick-to-the-end state. The `ResizeObserver` re-pins to the end while it
  is on, or to `pendingTop` when a hold is in place, which is what stops a block growing
  above you from moving what you are reading.
- `ownTop` tells our own scroll writes apart from the user's, or every programmatic scroll
  would clear `follow` on the scroll event it causes.
- `atBottom()` must also be true when there is no scroll at all
  (`scrollHeight <= clientHeight`), or expanding a block in a short chat grows downward
  instead of following the end.
- A long block's head sticks with native `position: sticky` (on where `stickyHeads()` is
  provided). On scroll and on resize `updatePinned()` walks forward from `firstVisible()` (a
  binary search over `offsetTop`) and marks the head that is stuck with `data-stuck`, which
  is all the styling hooks onto; there is no copy of the header to measure or push.

## Panels (`screens/chat/panes.svelte.ts`)

Chat and Agents can sit in either panel, each with its own tabs (`tabs` for Claude,
`agentTabs` for ACP); the tools are single-instance, so placing one where the other panel
has it swaps them. The pane a tool goes with (`contextRole`) gives it the environment `focus`
selects, the folder the terminal opens in and the project Project files follows
(`contextChat.workingPath`). The list on the left follows the focused pane (`list`).

Svelte runs a derived again when a component reads it while being destroyed, with the values
from before the change, and keeps the dependencies of that run: bits-ui's tooltip trigger
reads `disabled` on destroy, which reaches `list` through the side list's props. A `list` that
branched on the focused pane lost `kind` that way and stopped updating, so it reads all of its
inputs before deciding. A shared derived that leaves state stuck is checked for the same.

## Mods (`screens/mods/`)

`ModSurface`, one per chat state, holds the `mods` snapshot and every site's drawing.
`ModSite` measures a site in cells and asks for its tree, `ModTree` draws it in CConnect's
style, and `ModClient` hosts a plugin's own client module, which runs in a worker
(`clientWorker.ts`) under a watchdog that ends it when it stops answering.

- The cell comes from `modGrid.gridOf`, stretched to `room / floor(room / glyph)` so a row
  fills its box exactly, and reaches every node through context. `ModFit` shrinks a tree
  with `zoom` only once it was drawn for the current columns (`drawnFor`); a tree drawn for
  the old width would shrink for nothing in the middle of a resize. Until the narrower
  drawing lands, the old one keeps the width it was drawn for (`hold`) and the site clips it,
  instead of reflowing into a box it was not drawn for.
- Every `Text` is `min-w-0`, as Yoga lays out an Ink row: a row of one-column glyphs that the
  font draws wider than the cell (Flightdeck's strip of `■`) shrinks into its cells. Without
  it the row pushes the tree wide and `ModFit` zooms the whole mod out.
- The band (`fit`) asks the mod for fewer columns when a row of short texts does not fit, so
  the mod falls back to its narrower line instead of wrapping. `needs` keeps how wide each
  column count was drawn, which is what stops it going back and forth.
- A site's rows include its padding from the very first render: `padding` is derived from
  the element, not measured in an effect, or the first drawing asks for a row too many and
  the pane flashes a different layout on every tab switch.
- One render in flight per site. A site that changes while one is pending is drawn again
  when the reply lands, so no timer stands between a change and its render.
- `ready` calls `rebind()`, not `reset()`: what is on screen stays until its replacement
  arrives, the way `#frozen` keeps the conversation. The `mods` snapshot that comes while
  attaching is applied at `attached`, and the conversation is published once the renders
  it triggered are answered (`whenDrawn`). The server answers every `mod_render`, so this
  waits on events, never on a clock.
- Text takes the interface font, as Claude Desktop draws it; monospace is only for art:
  multi-line text with art in it, runs of unwrapped Texts in a column, and rows that hold a
  box-drawing glyph (`monoRun`, `monoText`).
- Box-drawing glyphs are SVG masks per cell, never the font's glyphs, which leave seams once
  the cell is stretched. The horizontal arm sits where the font of that text draws `─`
  (`ruleAxes`, measured per site), so a line passes through the `•` and `●` beside it.
- Android's WebView paints `color-mix(…, transparent)` dark; blend with `withAlpha` from
  `design/accents.ts` instead.

## Browser (`screens/browser/`)

Two sides share one panel and one tab strip, switched by `BrowserSideSwitch`:

- **This device** (`deviceBrowser.svelte.ts`): native webviews driven through
  `deviceEngine.browserCall`, which reaches `src-tauri/src/browser.rs` on the desktop and the
  `AndroidBrowser` bridge of `Browser.kt` on Android. The page is a separate view under the
  app's, placed every frame over the panel's surface; a surface that is not visible (the
  phone keeps its side panel mounted under `invisible`) gets no page. On Windows the app's
  region is carved around it (`browserLayer.ts`), so menus and dialogs float over the live
  page; elsewhere the page hides while something covers it. On Linux Tauri packs a child
  webview into the window's `GtkBox`, under the app, and ignores its bounds, so
  `webkit::place` moves it into a `GtkFixed` laid over the main webview and places it there
  on every `browser_bounds`.
- **Server** (`services/browserSocket.ts`): the backend's Chromium, streamed as frames. It
  only runs while the socket `watch`es, so opening the panel does not start it.

Viewport under ⋮ (`BrowserOptionsMenu`) emulates through CDP on Windows and sets the WebKit
agent and page zoom on macOS and Linux; on Android it only switches the agent between the
mobile and the desktop site, and the page stays at 1:1 so a touch lands where it falls. Zoom
is kept per host (`settings.browserZoom`). Home is a state of the tab (`home`, stored with
the tabs), not an address, so going back leaves it for the page underneath. On Android,
`Browser.kt` owns a pull while it is out: the moves feed the indicator and none reach the
page until the finger passes back above where the pull started, and its views take no
window insets, or a page pads its bottom bar for a system bar it does not sit on. The
ad blocker (`src-tauri/src/shield.rs`, the `adblock` crate) answers per request on Windows
and Android (JNI from `android.rs`) and compiles to content-blocking rules on macOS and
Linux (`webkit.rs`); local and tailnet hosts are never blocked. A proxy change needs
`browser_restart`, since WebView2 only takes it as a launch argument. A picked element
travels in the prompt as `<browser-element>` (`data/pickedElements.ts`) and shows as a chip;
picking is left out on touch screens.

## Server files (`services/mediaSource.ts`, `services/pageSource.ts`)

`fetchFile` is the one way to read a file the server serves: the profile comes from
`sharedProfileOf`, the headers from `fileHeaders` (the security key only on the project file
routes), and `cache: "no-cache"`, or a file rewritten under the same name comes back from
Chromium's heuristic cache. `mediaSrc` and `posterSrc` hand it to an element as an object
URL; nothing loads a server URL straight into `src`. HTML goes through `ui/PageFrame.svelte`
(`pageSrc`, the themed scrollbar and the sandbox, the same in the chat and the preview): a
`blob:` document inherits the app's CSP and loses its scripts, styles and fonts, so in the apps
`preview_open` registers the page and the iframe loads it from the `preview` protocol
(`src-tauri/src/preview.rs`) — an origin of its own, without CSP and out of reach of the
app, with the files of its folder proxied from the server. The web has no CSP and keeps
`blob:`, without `allow-same-origin`. `tauri dev` applies no CSP at all, so anything about
it is checked in a build.

Chat media blocks share `.media-frame` (`ui/mediaFrame.ts`): a transparent border pulls the
content's clip a pixel in and an inset `outline` draws the line over the content, or light
content bleeds into the border along the curve.

## PDF (`screens/shared/PdfView.svelte`)

pdf.js's own `PDFViewer` renders every PDF except the full preview on a wide desktop window,
which keeps the system's viewer and reloads it once a resize settles, since Chromium does not
refit a PDF to its iframe. pdf.js floors a page to a multiple of `--scale-round-x`, taken from
the device pixel ratio, so the canvas stays one to one with the screen: never override it, a
stretched page goes soft. The fit takes the next multiple up and centres the page, and the
frame clips the extra pixel or two. The user's zoom is its own state, never derived from the
rounded scale, and while a resize runs the page repaints every 150 ms if it is on screen and
once 250 ms after it stops.

## Image preview (`lib/ui/ZoomPane.svelte`)

Zoom is anchored at the pointer: `offset' = p - (p - offset) * (next / scale)` with `p`
relative to the pane centre, fed from the wheel, the double click and the pinch centroid.
Panning is deliberately unclamped — zooming back to 1 recentres. `<img draggable="false">`
is required or the browser's native image drag eats the pan, and `touch-action` is `none`
only while zoomed so the page still scrolls at rest.

## Drag and drop

`hasFiles(event)` (`lib/ui/fileDrop.ts`) gates every drag handler, including the
window-level guard in `App.svelte`. Without it, dragging **text** raises the file-drop
overlay and the `preventDefault` swallows the drop that the textarea would have handled.

## Text fields

`field-sizing: content` (class `field-auto`) auto-grows textareas, with a JS polyfill in
`platform/fieldSizing.ts` for engines that lack it, plus `keepCaretInView`. Chromium has
open caret bugs around that property, so do not "clean up" the polyfill without testing the
composer: growth, caret while typing, and the caret shown when dragging text over it.

## Installable web app

`public/manifest.json` and `public/sw.js`, registered from `platform/pwa.svelte.ts` only
outside Tauri and only over HTTPS. The worker **caches nothing**: it forwards same-origin
GETs and lets everything else through. It exists because Chrome only promotes the install
when there is a fetch handler, and caching the shell here would mean a stale app arguing
with the server's `SUPPORTED_SERVER` floor — there is no offline mode to win, since the app
does nothing without its backend.

`beforeinstallprompt` is captured with `preventDefault()`, which silences Chrome's own
banner and hands the promotion to **Install app** in Settings → About. iOS fires no
such event and exposes no install API, so there the same entry only spells out the two
steps.

## Android

`src-tauri/gen/android/` **is committed** — it holds `MainActivity.kt`, `PastedContent.kt`,
`Browser.kt`, `Downloads.kt` and the rest of the Kotlin side, and the manifest, so edits there
are real source, not generated scratch. `src-tauri/.taurignore` keeps `tauri dev` from
rebuilding the desktop app every time one of them changes.

The manifest offers CConnect to open only `.ccpack` files: a VIEW whose path ends in
`.ccpack`, with or without a type, and a `content:` VIEW typed `application/octet-stream`,
which is how Files by Google hands one over (its address carries a number, not the name).
Share always attaches, a pack included; an opened file goes through `takePacks`, so a pack
offers its dialog and anything else becomes an attachment (`platform/pastedContent.ts`). Samsung's My Files sends an
extension it does not know with an empty type and a nameless `content://media/external/file/`
address, which only a `*/*` filter accepts, and that filter would offer CConnect for every
file there, so a pack from it goes through Packs → Import pack. Android's file picker cannot
filter by an extension it does not know either, so that dialog adds `application/octet-stream`
on Android.

`MainActivity` deletes `app_webview/variations_seed*` before the WebView starts. That file is
the experiment config the WebView downloads on the first launch and applies from the next
one, and with it the WebView paints layers pure black while a text selection is dragged
(7 of 39 frames black with it, 0 of 78 without, on WebView 157). If the black returns,
check whether the WebView moved that file.

`setOnReceiveContentListener` rejects a MIME type starting with `*`: passing `*/*` throws
`IllegalArgumentException` while the WebView is being created and kills the app on launch,
with nothing on screen. Wildcards are only allowed in the subtype (`image/*`, `video/*`, …).

The keyboard only offers images to the composer because `RustWebView.onCreateInputConnection`
calls `PastedContent.inputConnection`, and wry writes that method into the generated
`RustWebView.kt` from `WRY_RUSTWEBVIEW_CLASS_EXTENSION`. A build runs cargo twice (the CLI's
own build, then Gradle's `BuildTask`), so the variable lives in `client/.cargo/config.toml`:
set for only one of them, the other regenerates the class without the method, and the APK
ships without it while the source on disk still has it. Check the compiled class (`dexdump`
on the APK's `classes*.dex`), never the generated file.

```bash
NDK_HOME="<sdk>/ndk/<version>" npm run tauri android build -- --debug --apk --target aarch64
adb install -r src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
adb logcat -b crash -d          # startup crashes only show here; the main buffer buries them
```

## Build

```bash
npm run check     # svelte-check — the verification to run; must end 0 errors 0 warnings
npm run dev       # vite on :1420
npm run build     # svelte-check + vite build
npm run tauri dev | build
```

## Conventions

1. **Backend is the source of truth**; mirror its event shapes verbatim.
2. **No comments.** Self-explanatory names; rationale goes in the answer or the commit.
   `<!-- svelte-ignore … -->` is a directive, not a comment, and stays.
3. User-facing text comes from the i18n files and reads as written for each language, with
   the terms its catalog already uses; Spanish is neutral, with no regionalisms.
