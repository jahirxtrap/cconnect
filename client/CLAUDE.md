# CLAUDE.md — client (Svelte + Tauri)

Desktop, web and Android from one Svelte 5 + Tauri 2 codebase, against the backend contract.
Assets and the web build are named `cconnect-tauri`.

```
src/
├── App.svelte              # routes, window-level keydown / drag guards
├── app.css                 # global rules + keyframes
└── lib/
    ├── app/                # navigation (URL routing per screen)
    ├── data/               # models, settings, format helpers, time, previewKind
    ├── design/             # tokens.css, themes, fonts, backgrounds, packs/
    ├── i18n/               # one JSON per locale
    ├── markdown/           # the Markdown renderer and its cconnect blocks
    ├── platform/           # isTouch, layout, desktop, polyfills
    ├── screens/            # one folder per screen
    ├── services/           # backend clients
    └── ui/                 # the shared toolkit
src-tauri/                  # Rust side + gen/android (committed)
```

## Rules

- **Svelte 5 runes only.** Actions (`use:x`) have no `update` hook: reactivity inside one needs
  its own observers, or an `$effect` that calls back into it.
- **Reuse the toolkit** (`ui/`: `PopupMenu`, `MenuSub`, `MenuItem`, `InputField`, `ListRow`,
  `CompactDialog`, `ConfirmDialog`, `CardPanel`, `ScrollCard`, `FloatDock`, `TabPager`,
  `ZoomPane`, `DropOverlay`, `MarkdownText`, `CodeBlock`, `gridHeight`, `fileDrop`,
  `sharedFileActions`, `ListDrag`…) and the shared data helpers (`data/time.ts`, `sessionInfo`,
  `EnvironmentSlots`, `Redial` in `services/socket.ts`). Never fork a variant.
- **There is no twMerge.** Two conflicting utilities both land in `class` and CSS order picks;
  resolve with a prop or a conditional, never by appending a class.
- Menus, tooltips, dialogs and popovers are **bits-ui**. Menus open with `align="start"` and
  `layout.menuPadding`. On touch a `MenuSub` drills down in place (`ui/menuDrill.svelte.ts`); on
  the desktop it opens through a `Portal`, because the viewport's mask clips anything inside it.
- `AppTopBar`'s control strip clips its corners (`SCROLL_ROW_CLASS`): a search field goes in its
  `search` slot.
- Every string goes through `t()`. `en.json` is the base and the fallback. Plurals are uppercase
  CLDR suffixes; every catalog has every key the base has plus its language's extra forms, a
  language without inflection repeats `_OTHER` under `_ONE`, and outside English every form
  carries `{1}`.
- `platformName()` says which build runs (`"web"` outside Tauri); anything that depends on the OS
  asks `systemName()`.
- Svelte reruns a derived that a component reads while it is destroyed, with the old values, and
  keeps that run's dependencies. A shared derived (such as `panes.list`) reads all its inputs
  before branching, or it stops updating.

## Packs (`design/packs/`)

The built-in packs and the format are the backend's: the build globs `backend/core/packs/**`,
`opened.rs` compiles the schema in, and `design/packs/reader.ts` must validate exactly as
`backend/services/pack_format.py`. Pack icons and previews go through `services/imageCache`;
Shared, project files and chat media never do.

## Pixel grid (`ui/gridHeight.ts`, `design/tokens.css`)

Scroll positions land on whole **device** pixels, so anything that grows in the message list
must be a multiple of one or the content shifts.

- `theme` publishes `--px-grid` (`1 / devicePixelRatio`) and the chat tokens round to it inside
  `@supports (width: round(1px, 1px))`. Let CSS round; never hardcode snapped values.
- `gridHeight` rounds a node's height up to the grid: `calc-size()` where Chromium has it, else a
  `ResizeObserver` that pads to 1/64 of a device pixel, with no epsilon.
- Measure at a real scale (`--force-device-scale-factor`); CDP's emulated scale lies.
- `content-visibility: auto` is not usable in the message list.

## Chat scroller (`screens/chat/ChatScroller.svelte`)

One component owns the viewport for `MessageList` and `SidePanel`, with an exported API.

- `follow` sticks to the end; the `ResizeObserver` re-pins to the end, or to `pendingTop` while a
  hold is in place. `ownTop` tells our scroll writes from the user's.
- `atBottom()` is also true when nothing scrolls.
- Long block heads use native `position: sticky`; `updatePinned()` marks the stuck one with
  `data-stuck`.
- Which blocks are open is a `BlockExpansion` owned by the chat state (or the quick chat), never a
  prop the list writes into. A head opens and closes through `toggleBlock(id, expansion)`, and
  anything that grows goes through `grow`, which keeps the end pinned when it was there.
- History pages in on scroll but never across a compaction: past it only **Earlier messages**
  loads (`loadEarlier`), and those messages carry `beforeCompaction`, which drops Fork.
- The composer's ↑/↓ history keeps no list of its own: `userHistory()` is the server's
  `earlier_prompts` (the prompts before the loaded page, sent with every page) followed by the user
  messages on screen and the queue, so it follows paging, Earlier messages, compaction and what
  other devices send. A long press on Send (`contextmenu`) lists the same history. Send is
  `aria-disabled`, never `disabled`: a disabled button gets no `contextmenu`.

## Panels (`screens/chat/panes.svelte.ts`)

Chat and Agents sit in either panel with their own tabs (`tabs`, `agentTabs`); tools are
single-instance and swap. A view added to `DEFAULT_PANE_BAR` also lands in customized bars
(`withNewDefaults`). `contextRole` gives a tool its environment, terminal folder and project.
The desktop's right pane sets the compact `--page-inset` (`COMPACT_INSET_CLASS`); a view that
expands with `fixed inset-0` inside it puts the full one back (`FULL_INSET_CLASS`).

## Databases (`screens/databases/`)

- A database object and a project file share one slot (`app/viewer.svelte.ts`): opening one
  closes the other.
- The tree, console drafts, loaded nodes and open tables live in `services/databases.svelte.ts`
  per environment, so they survive remounts. The tree derives its missing loads (`pending`), a
  load marks its node before awaiting, and `forget` reloads what is expanded. A table keeps its
  view there (`tableViewOf` / `saveTableView`) and loads only while `rows` is `null`.
- On a gated server even listing connections needs the key, so the list is kept per stored key,
  and every change goes through a `KeyGate`.
- The console's text is its draft (`draftOf(...).sql`). It clears its previous failure only once a
  run succeeds.
- Tree rows hand a `TreeMenuTarget` to `DatabasesView.treeMenu`. **Query in console** quotes with
  `sqlIdentifier` and the engine's `quote`; every export ends in `deliverExport`.
- `db_query` / `db_execute` rows draw with `QueryBlock` under the `ToolUse` mod site, in the
  `action` tone (Claude Code's own work stays `process`), each part held to `CAPPED_HEIGHT`. Its
  chips and **Open SQL console** need a saved connection (`query.saved`).
- `DataGrid` never selects its header or row numbers, selects cells only where a row does not open
  on click, and right-aligns numbers from `kinds`, or from the values (`kindsOfValues`).
- A database file's preview (`DatabaseFile`) reuses `DatabaseTree`; the extensions come from the
  backend's `engines.json` at build time.

## Mods (`screens/mods/`)

`ModSurface` (one per chat) holds the snapshot, `ModSite` measures a site and asks for its tree,
`ModTree` draws it, and `ModClient` runs a plugin's client module in a worker under a watchdog.

- The cell is `modGrid.gridOf`, stretched so a row fills its box. `ModFit` zooms only a tree
  drawn for the current columns (`drawnFor`); until the new drawing lands the old one keeps its
  width (`hold`).
- Every `Text` is `min-w-0`, as Yoga lays out an Ink row.
- The band asks for fewer columns instead of wrapping; `needs` stops it oscillating.
- A site's padding is derived, not measured in an effect.
- One render in flight per site; a change while pending redraws when the reply lands.
- `ready` calls `rebind()`, not `reset()`. The snapshot that arrives while attaching applies at
  `attached`, and the conversation publishes once its renders are answered (`whenDrawn`).
- Text uses the interface font; monospace only for art (`monoRun`, `monoText`). Box-drawing
  glyphs are SVG masks per cell, with the arm placed by `ruleAxes`.
- Android's WebView paints `color-mix(…, transparent)` dark: use `withAlpha`.

## Browser (`screens/browser/`)

- **This device** (`deviceBrowser.svelte.ts`) drives native webviews through
  `deviceEngine.browserCall` (`browser.rs`, or `Browser.kt` on Android), placed every frame over
  the panel. On Windows the app's region is carved around it (`browserLayer.ts`); elsewhere the
  page hides while something covers it. On Linux `webkit::place` moves the child webview into a
  `GtkFixed`, since Tauri ignores its bounds there.
- **Server** (`services/browserSocket.ts`): the backend's Chromium, running only while `watch`ed.
- Home is a blank page on both sides (`blankPage(url)`, the server's `home` message).
- The ad blocker (`shield.rs`) answers per request on Windows and Android and compiles to
  content-blocking rules on macOS and Linux; local and tailnet hosts are never blocked. A proxy
  change needs `browser_restart` (WebView2 takes it only at launch).

## Server files (`services/mediaSource.ts`, `services/pageSource.ts`)

- `fetchFile` is the one way to read a served file (`sharedProfileOf`, `fileHeaders`,
  `cache: "no-cache"`).
- Video, audio, large images and PDFs go through `serveFile`: in the apps a loopback server
  (`media.rs`) forwards range requests, one port per file because Chromium allows six connections
  per origin, and one upstream connection per request so a request nobody reads never holds back
  another. While a file is open in a player, the bytes already fetched stay in the app's cache
  folder and are served from there again; closing its last player deletes them. A custom protocol
  cannot do it on Android. Android allows cleartext only to
  `127.0.0.1` (`network_security_config.xml`).
- HTML goes through `ui/PageFrame.svelte` and the server's `/api/pages`, on its own origin. The
  apps fall back to `preview_open` and the `preview` protocol (`preview.rs`), since a `blob:` page
  inherits the app's CSP. `tauri dev` applies no CSP: check CSP in a build.
- A file linked before it exists waits on its shared folder (`services/sharedArrival.svelte.ts`).
  A loaded image follows its file (`followSharedFile`) and swaps in off screen.
- Media blocks share `.media-frame` (`ui/mediaFrame.ts`).

## Media player (`ui/MediaPlayer.svelte`)

- Every audio and video plays in `MediaPlayer` (file preview, gallery, chat card, playlist); no native
  `controls`. Icons are lucide with `fill="currentColor"`; `SpeakerIcon` fills only the speaker.
- The video controls span the whole frame, like the native ones, not just the picture. On touch,
  `pointerleave` fires on every lift, before the `click`, so leaving only hides them for a mouse;
  hiding them there sent the tap on a button to the video underneath.
- The poster is an `imageSrc` layer until playback starts, so a still already painted in the gallery
  shows in the same frame; there is no `poster` attribute.
- A chat player hands its position over when it expands (`handOff`, `ui/mediaHandoff.ts`); the
  player that mounts with that URL resumes there.
- `AudioCard` is the chat's audio: one track (a lone `![](x.mp3)` through `MarkdownImage`, or a
  `playlist` of one) shows its title and the player, like a lone image or video; more tracks list
  their rows above one player, which moves on when a track ends. Capability `media.markdown_audio`
  tells the server to offer `![](x.mp3)` to Claude. Inside a chat gallery of several items an audio
  file takes the media frame instead (`MarkdownImage framed`): `MediaPlayer`'s `artwork` snippet puts
  its `AudioCover` where a video's picture goes, under the same controls, which never hide for audio.
- `ui/AudioCover.svelte` is the one cover-or-note render: the preview's stage, the chat frame and the
  strip's tiles.
- Volume: a slider beside the speaker where a pointer has room (`@sm`); on touch or in a narrow
  player the speaker opens a menu with a `MenuSlider`. Both move in 1 % steps.
- The gallery takes audio too (`AudioStage`, cover tiles in the strip) and moves on the same way,
  playing the next track only when the previous one ended (`continuing` in `FilePreview`).
- A gallery's neighbouring audio slides mount their player too (`active={false}`: paused, metadata
  read), so the seek bar never drops out mid-swipe. A playlist track passes its `duration` until the
  file reports its own; until then the seek bar is `pending`, which waits without looking disabled.
- Full screen is the frame itself. `platform/fullscreen.svelte.ts` feeds `BitsConfig defaultPortalTo`
  in `App.svelte`, so every bits-ui portal (menus, tooltips, dialogs) lands inside the element that is
  full screen.
- Full screen turns a phone sideways: the Android app forces landscape unless auto-rotate is on
  (`Fullscreen.kt`), mobile web locks `screen.orientation` until it leaves. The expanded preview never
  turns.
- A video's picture zooms like an image (`ZoomPane`, `doubleTap={false}`) in the preview and the gallery
  (`zoomable`) and in full screen, by wheel and pinch only: click and double click stay play and full
  screen. Leaving full screen resets it. `ZoomPane` captures the pointer only past `TOUCH_SLOP`, so a
  tap on a zoomed video still reaches it.
- The audio preview shows the cover the server extracts (`audioCoverOf`, `?size=`, capability
  `audio_covers`) or `AudioCover`'s placeholder, and the tags from `services/fileInfo.ts`.
- **Information**, first in the preview's menu (`FileInfoDialog`, rows in `fileInfoSections.ts`), reads `/shared-info` or
  `/projects/<key>/info` when the server offers `file_info`.

## Install links (`data/installRequest.ts`, `screens/install/`)

Every link (`cconnect://install/<kind>?…`, Cursor's `mcp/install`, the chat's `install` block)
goes through `installRequest.ts` and ends in `InstallDialog`, which installs through its own
`createHttp` for the chosen environment; packs go to `packOffers.offerRemote`. The desktop gets
links from `opened.rs` (the bundler registers the scheme, so `tauri dev` cannot test it) and
Android from `MainActivity` (`window.__cconnectOpenLink`).

## Markdown (`markdown/render.ts`)

`MarkdownText` takes a `flavor`: `chat` renders no HTML; `note` and `document` render GitHub's
allowed HTML, cleaned by `markdown/githubHtml.ts`. Relative images load beside the file through
`imageSrc`. A list holding a fenced block becomes a `list` segment drawn by `MarkdownText`. A tight
item's hidden paragraph is rendered as a `<div>` (`blockTightParagraphs`): bare inline HTML in the
item's flex column would put every run on its own row.

## PDF (`screens/shared/PdfView.svelte`)

pdf.js's `PDFViewer` renders every PDF except the wide desktop's full preview, which keeps the
system viewer. Never override `--scale-round-x`. The user's zoom is its own state. Keep pdf.js's
renderer worker (`GlobalWorkerOptions.rendererSrc`) off, or pages blank during a resize.

## Small rules

- `ZoomPane`: zoom anchors at the pointer, panning is unclamped, `<img draggable="false">`, and
  `touch-action: none` only while zoomed.
- `hasFiles(event)` gates every drag handler, or dragging text raises the file overlay.
- Whether a server accepts its stored key is `securityKeys.unlocked(profile)`, recorded only by
  answers that prove it (`judgeKey`, the project tree's `unlocked`): a read-only database also
  answers 403. Screens derive their lock from it and reload what they listed with another key.
- `field-auto` with the `platform/fieldSizing.ts` polyfill and `keepCaretInView`: test the
  composer before touching it.
- The service worker (`public/sw.js`) caches nothing; it exists so Chrome offers the install.
- The app shrinks by `--keyboard` while the keyboard is up. The chat background reaches under it
  (`behind-keyboard`, the pair of `above-keyboard`), so its size and framing never change.

## Android

- `src-tauri/gen/android/` **is committed source**; `src-tauri/.taurignore` keeps `tauri dev`
  from rebuilding on its changes.
- The manifest opens only `.ccpack` (a VIEW ending in `.ccpack`, and `application/octet-stream`
  from Files by Google). Samsung's My Files needs a `*/*` filter, so packs from it use Import
  pack.
- `MainActivity` deletes `app_webview/variations_seed*` before the WebView starts, or layers paint
  black while dragging a selection.
- The chat's sockets are native (`BackgroundLink.kt`, OkHttp, 20 s ping). A failure without a
  response on a host that showed life within two pings (`LinkPulse`, beaten by messages and
  download chunks) reopens once, silently. `chatSocket` keeps a stale socket while
  `transfers.flowingTo` sees a transfer to that server. Never raise the deadlines.
- `setOnReceiveContentListener` takes no MIME type starting with `*`: it kills the app on launch.
- The WebView only learns about window focus changes that come with `onPause` / `onResume`
  (`WindowFocusGate`, called from the `onWindowFocusChanged` override in the class extension).
  Chromium 157+ forgets the focused field when the window loses focus and asks the renderer again
  when it returns, which hides the keyboard that a system overlay such as the notification shade
  only borrowed. Chrome itself loses the keyboard that way on this device.
- Keyboard images reach the composer through `PastedContent.inputConnection`, injected into the
  generated `RustWebView.kt` from `WRY_RUSTWEBVIEW_CLASS_EXTENSION` in `client/.cargo/config.toml`
  (both cargo runs need it). Check the compiled class with `dexdump`, never the generated file.

```bash
NDK_HOME="<sdk>/ndk/<version>" npm run tauri android build -- --debug --apk --target aarch64
adb install -r src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
adb logcat -b crash -d
```

## Build

```bash
npm run check     # contract types from the backend, then svelte-check: 0 errors, 0 warnings
npm run dev       # vite on :1420
npm run build
npm run tauri dev | build
```

`svelte-check` uses TypeScript 7 (`--tsgo`, `@typescript/native`) and still needs TypeScript 6 as
`typescript`; `--incremental` drops the output of deleted components. Vite ignores `src-tauri`
and takes `index.html` as its only entry (`optimizeDeps.entries`).

## Conventions

1. **Backend is the source of truth**; mirror its event shapes verbatim.
2. **No comments.** `<!-- svelte-ignore … -->` is a directive and stays.
3. User-facing text comes from the i18n files, in each catalog's own terms; Spanish is neutral.
