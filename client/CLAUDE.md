# CLAUDE.md — CConnect Client (desktop + web + Android)

Compose Multiplatform app (Kotlin, Material3 1.5 alpha, MaterialExpressive) that
drives the CConnect backend via REST + WebSocket. One codebase, three targets:

- **desktop** — JVM (`jvm("desktop")`), packaged as native installers for
  Windows, Linux and macOS.
- **wasmJs** — the same UI compiled to WebAssembly, a static site hosted on
  Cloudflare Pages.
- **android** — `androidTarget()`. Because AGP 9 rejects the KMP plugin on a
  `com.android.application` module, `:app` is a `com.android.library` and the thin
  `:androidApp` module (`com.android.application`) wraps it into the APK.

`desktopMain` and `androidMain` share an intermediate **`jvmSharedMain`** source
set (both JVM) for JVM-only code — notably the SSH terminal (sshj + the libvterm
emulator) and `SshConnection`.

Talks to a Claude Code instance running on a PC, locally over Tailscale or
publicly over a Tailscale Funnel.

Package: `com.jahirtrap.cconnect`. **This is the single CConnect app** — desktop,
web and Android all build from `commonMain`; real platform differences live behind
expect/actual and the `LocalIsTouch` / `isWebPlatform` / `isAndroidPlatform`
locals.

---

## Architecture

```
ChatScreen (UI) ──> ChatViewModel ──> ChatSocket (WebSocketConn) ──> backend /api/chat/ws
                                  └─> SessionsApi / SharedApi / ClaudeApi / ... (Http) ──> backend /api/...
```

- Single ViewModel per screen; state via `StateFlow<ChatUiState>`. The VM and all
  business logic live in **`commonMain`** and are shared verbatim across the three
  targets.
- Networking is abstracted behind **expect/actual**: `data/remote/HttpTransport`,
  `WebSocketConn`, `SharedHttp`, `UrlCodec`, `AppImageLoader` and the
  `GitHubApi` cache hooks have a desktop actual (OkHttp + JVM) and a wasmJs
  actual (Ktor/browser `fetch` + the DOM WebSocket). `Backend` holds the active
  connection (kind, host, port, authKind, auth fields), mirrored from `Settings`
  on start and on every switch.
- All requests carry `Backend.authHeaders` (Bearer, Basic, or custom), the same
  headers on downloads, uploads, Coil image loads and previews.

## Project Structure

`commonMain` holds the screens, view-models, models and the whole `ui/` toolkit;
each platform supplies the `actual` plumbing in `desktopMain` / `wasmJsMain`.

```
client/app/src/
├── commonMain/kotlin/com/jahirtrap/cconnect/
│   ├── Platform.kt              # expect isWebPlatform / isCoarsePointer() / bringAppToFront() + desktopWindowToFront hook
│   ├── chat/                    # ChatScreen, ChatBlocks, ChatViewModel(+Factory), Tabs(Controller/Bar/Shortcuts/Context), PermissionUi, ChatUrl(expect)
│   ├── claude/                  # ClaudeScreen + ClaudeDetailScreen (enum ClaudeKind) + AccountsSection (accounts + remote OAuth login)
│   ├── data/
│   │   ├── ChatModels / SessionModels / EnvironmentProfile / QrConnectionPayload / SshProfile+SshStore
│   │   ├── AppCompat.kt         # version-range compare for the app/server/CLI contract
│   │   ├── AppUpdater.kt        # expect: openRelease / downloadAndInstall / reload
│   │   ├── Settings.kt / AppPrefs.kt(expect)   # persisted prefs (desktop: java Prefs/file; web: localStorage)
│   │   ├── MarkdownStore.kt(expect)            # markdown scratchpad text (desktop/android: a file; web: localStorage) — NOT AppPrefs (desktop java Prefs caps a value at 8KB)
│   │   ├── Clock / DateFormat / NumberFormat    # expect time/number formatting (no kotlinx-datetime dep)
│   │   └── remote/              # Backend(+Config), Http, ChatSocket, Sessions/Shared/Claude/Cli/Capabilities/Settings/System/Network/Accounts Api,
│   │                           #   GitHubApi, + expect HttpTransport/WebSocketConn/SharedHttp/UrlCodec/AppImageLoader
│   ├── files/                   # FileExplorerScreen, FilePreviewScreen, UploadManager, FileDrop, FilePicker(expect),
│   │                           #   AttachmentFile(expect), ClipboardPaste(expect), FilesUrl(expect), SharedActions(expect: URL save/share + local-text save/share), PreviewKind
│   ├── markdown/MarkdownScreen.kt # notes scratchpad: BasicTextField editor + live MarkdownText preview toggle; local save/save-as/share via SharedActions text funcs
│   ├── monitor/                 # MonitorScreen (resource graphs + server logs) + NetworkPage (interfaces, Wi-Fi, speed test); the Network tab shows only when the backend reports support
│   ├── service/                 # Notifier(expect: desktop tray/notify-send; web Notification API) + LocalServer(expect: desktop spawns the backend run.py)
│   ├── settings/                # SettingsScreen + SettingsComponents (SettingsGroup/PreferenceRow, reused by claude/)
│   ├── terminal/                # TerminalScreen + TerminalSession(expect) + OsIcons  (SSH; real impl desktop-only)
│   └── ui/                      # the shared toolkit (see below) incl. Touch, HistoryNav, DismissStack, ClipboardShortcuts,
│                               #   BackInterceptor, Dialogs, Menus, AppBottomSheet, PopupMenu, MarkdownText, theme/
├── desktopMain/kotlin/...       # actuals: Main.kt (Window + App), WindowTitleBar, OkHttp transport, AWT clipboard,
│   │                           #   FileDialogs (lwjgl tinyfd), FileTransfer, SshConnection+TerminalEmulator+TerminalView
│   └── ...
├── wasmJsMain/
│   ├── kotlin/...               # actuals: Main.kt (ComposeViewport + App), Ktor/browser transport, document listeners,
│   │                           #   FilesUrl/ChatUrl via window.history, ClipboardPaste via "paste" event
│   └── resources/               # index.html, cconnect.js entry, sw.js (service worker), manifest.json, favicon.png, _redirects
```

## Platform abstractions (expect/actual)

The single most important client-specific concern. Each of these is an `expect`
in `commonMain` with a `desktop` + `wasmJs` actual:

| expect | desktop actual | wasmJs actual |
|---|---|---|
| `isWebPlatform` (Platform.kt) | `false` | `true` |
| `isCoarsePointer()` | `false` | `matchMedia('(pointer: coarse)') \|\| maxTouchPoints>0` |
| `bringAppToFront()` | `window.toFront()+requestFocus()` (via `desktopWindowToFront` set in Main) | no-op |
| `HttpTransport` / `WebSocketConn` / `SharedHttp` | OkHttp + JVM | Ktor client + browser `fetch`/`WebSocket` |
| `AppUpdater` | download installer → `Desktop.open` runs it; `reload`=no-op | `downloadAndInstall`=false; **`reload`** clears SW caches + `location.reload()` |
| `Notifier` | tray / `notify-send -a CConnect` on Linux | Web Notification API; `appInForeground` from `document.hasFocus()` |
| `FilePicker` / `FileDialogs` | lwjgl tinyfd native dialogs | `<input type=file>` | 
| `AttachmentFile` | wraps `java.io.File` | wraps `org.w3c.files.File` |
| `ClipboardPaste` | AWT clipboard (files / image→temp PNG) | document `"paste"` event → `clipboardData.files` |
| `ClipboardShortcuts` (dispatchClipboardShortcut) | fed from the Window `onPreviewKeyEvent` | document `"keydown"` listener |
| `FilesUrl` / `ChatUrl` | no-op (in-memory folder history instead) | `window.history` pushState/popstate (SPA URLs) |
| `Clock` / `DateFormat` / `NumberFormat` / `TimeFormat` | `java.time` / `java.text` | JS `Date` / `Intl` |
| `AppPrefs` | file/Java Prefs | `localStorage` |
| `TerminalSession` | sshj-backed PTY (SshConnection + libvterm TerminalEmulator), shared with android in **`jvmSharedMain`** | stub (no JVM sshj in the browser) |
| `LocalServer` / `pickDirectory` / `pickExecutable` (service/LocalServer.kt) | spawns `run.py` as a child, status parsed from its stdout; tinyfd dir/file pickers | stub (no local backend in the browser) |
| `MarkdownStore` (data/MarkdownStore.kt) | `~/.cconnect/markdown.md` file | `localStorage` |
| `saveTextToDownloads` / `saveTextAs` / `shareText` (files/SharedActions.kt) | Downloads dir / tinyfd save dialog / copy text to clipboard | blob download / `showSaveFilePicker` / clipboard |

**Android** (`androidMain`) supplies its own actual for each of the above
(`AppPrefs` → `EncryptedSharedPreferences` for the secure store; `Notifier` →
NotificationManager; `FilePicker`/`AttachmentFile` → SAF; `TerminalSession` →
shared with desktop via `jvmSharedMain`; `MarkdownStore` → `filesDir/markdown.md`;
the text save/share actuals → MediaStore Downloads / SAF `CreateDocument` /
temp `.md` + `ACTION_SEND`; `LocalServer` → stub; etc.) plus
`isAndroidPlatform = true`.

**Rule:** never branch on platform inside `commonMain` with ad-hoc checks beyond
`isWebPlatform` / `isAndroidPlatform` / the CompositionLocals below; put real
divergence behind an expect/actual.

## Touch & layout detection (single source of truth)

- **`LocalIsTouch`** (`ui/Touch.kt`) — provided once in `CConnectTheme` via
  `ProvideIsTouch` (root pointerInput, Initial pass, reads `PointerType` → touch
  on Touch / false on Mouse; **seeded** by `isCoarsePointer()` so web-on-phone
  starts correct, no flash). Read `LocalIsTouch.current` everywhere; do **not**
  add per-component pointer detectors.
- **`LocalMobileLayout`** (also `ui/Touch.kt`) — `true` when the viewport is
  portrait **or** narrow (`height>width || width<600dp`), recomputed on resize
  from `LocalWindowInfo.containerSize`. Drives the responsive panel.
- Uses: `focusable = !LocalIsTouch.current` on the field-style dropdowns
  (SelectField, the chat SelectorChip, AbovePopupMenu) — touch keeps `false`
  (a focusable popup misbehaves on touch); mouse gets `true` so Esc
  closes them; reload/refresh buttons hidden when `LocalIsTouch`; pull-to-refresh
  gated by touch (Settings/Claude/Monitor — the chat list and Files are live over
  `/api/list/ws` + `/api/shared/ws`, no manual refresh); interactive scrollbars
  not drawn on touch.

## Responsive left panel

The chat's environments/projects/sessions panel adapts to `LocalMobileLayout`:

- **Mobile layout** → a `ModalNavigationDrawer` (gesturesEnabled, drawer sheet =
  `ChatPanelContent`), opened by a hamburger in the top bar. `drawerState` is
  hoisted to the App (Main.kt) so it survives navigation (open drawer → Files →
  back → still open), and a `LaunchedEffect(LocalMobileLayout)` closes it on the
  desktop↔mobile switch so it always starts closed in mobile.
- **Wide layout** → the inline 64↔300dp sidebar `Surface` (its own persisted
  `expanded`), independent of the drawer state.
- Wrapped in `MaterialExpressiveTheme(MotionScheme...)`. The drawer's close
  button shows on non-touch; on touch it's null (gesture/scrim only).

## Tabs (multiple chat sessions)

The chat runs as **tabs** — several independent sessions open at once, each with
its own environment, working directory, session and project. `chat/TabsController`
(an object) is the registry: a `mutableStateListOf<Tab>` + `activeId`, persisted
to `Settings.tabsState` as JSON (`{active, tabs:[{env, cwd, sid, proj, title}]}`;
the accent color is derived per session, not stored). Each `Tab` owns its own
`ViewModelStoreOwner` and a `ChatViewModel` factory built from its `TabContext`
(`environmentId`, `cwd`, `initialSessionId`, `initialProjectKey`), so every tab is
a fully isolated chat with its own ViewModel.

- **Per-tab wiring (the three Mains).** Each platform's App provides
  `LocalViewModelStoreOwner` + `LocalChatViewModelFactory` from the active tab and
  renders `key(activeTab.id) { ChatScreen(...) }`, so per-tab UI state is isolated
  and a tab's session loads **lazily** — only when first selected. `ChatViewModel`
  reads its `TabContext` (not the global `Settings.cwd`), and its `ChatSocket`
  resolves a per-tab `BackendConfig` (`activeEnv()?.toBackendConfig()`), so a tab
  can target a different environment than the one in front.
- **Write-back.** `ChatScreen` pushes the live title / color / running / sessionId
  / projectKey into `TabsController.updateActive(...)` from a `LaunchedEffect`;
  persistence fires only on a structural or identity change.
- **UI (`chat/TabBar.kt`).** `TabStrip` is the desktop/web strip (vertical wheel →
  horizontal scroll via `horizontalScrollbar(wheelScroll = true)`, a
  `BringIntoViewRequester` keeps the active tab in view); `TabSwitcher` is the
  mobile dropdown. "Open in new tab" is offered on **every** platform (no longer
  web-only) through `TabsController.openSessionTab(...)`.
- **Shortcuts (`chat/TabShortcuts.kt`).** `tabShortcut(KeyEvent)` handles Ctrl+Tab /
  Ctrl+Shift+Tab (next / prev), Ctrl+T (new), Ctrl+W (close) and Alt+Left /
  Alt+Right (reorder), routed at the window level next to the clipboard shortcuts.
- **Desktop full-screen.** F11 toggles a borderless full screen in `Main.kt` —
  `key(fullscreen) { Window(undecorated = fullscreen, placement = Maximized) }`
  (the window is recreated because `undecorated` can't change on a live frame), and
  the previous placement / size / position is restored on exit.
- **Backend reattach.** Two tabs may ride the same backend session; the server
  reattaches a channel to a `LiveSession` by session id **only when the prior
  channel is detached**, so switching tabs mid-load never steals the live one's
  sink.

## Keyboard, mouse & clipboard (focus-independent)

Desktop/web input that has no mobile equivalent. All routed at the **window**
(desktop `Window.onPreviewKeyEvent`) / **document** (web listeners) level so they
work regardless of which composable has focus:

- **`ClipboardShortcutHandler`** (`ui/ClipboardShortcuts.kt`) — `ClipKey {Copy,
  Cut, Paste, Cancel}`. Files registers it (gated `!searching` + no dialog) for
  Ctrl+C/X/V driving the existing move/copy **transfer** system (`TransferOp`),
  Esc=Cancel clears a marked transfer; Ctrl+V also falls back to OS-clipboard
  upload. Chat registers it (gated `!sideActive && !mobileDrawerOpen && !dialog`)
  for Ctrl+V upload + Esc closing the quick-chat.
- **`ClipboardPaste`** (`files/ClipboardPaste.kt`) — OS file/image paste into
  Files (`pendingUploads`) and Chat (`vm.addAttachments`); web via the document
  `"paste"` event (delivers files), desktop via the AWT clipboard inside the
  shortcut handler.
- **`DismissStack`** (`ui/DismissStack.kt`) — shared dialogs/sheets/dropdowns
  register `Dismissable(onDismiss)`; the desktop **mouse-back** button closes the
  topmost one before navigating (`if (!DismissStack.dismissTop() && !HistoryNav.back()) goBack()`).
  Esc layering stays native per focusable popup (so only the topmost closes).
- **`HistoryNav`** (`ui/HistoryNav.kt`) — browser-like back/forward. WEB is
  native (mouse buttons → `window.history` → popstate, folder URLs via
  `FilesUrl`). DESKTOP has an in-memory folder history inside FileExplorerScreen;
  mouse button 4 = back, button 5 = forward (read in Main's pointerInput via
  `isBackPressed`/`isForwardPressed` + AWT button 4/5). The Files toolbar "up"
  button still goes to the parent folder.
- **`BackInterceptor`** (`ui/BackInterceptor.kt`) — the logical back stack
  (deselect → goUp parent → close overlay), consulted by Esc and mouse-back
  fallback.

## Connection model

`EnvironmentProfile`: `kind ∈ "http" | "https"`, `port: Int?` (null for https =
implicit 443; defaults 8723 for http), `authKind ∈ none|bearer|basic|header`.
`Backend.authHeaders` flattens auth into headers consumed uniformly. **On web the
environment form offers only HTTPS** (`kind` defaults to "https", the protocol
SelectField hides HTTP) because the HTTPS page can't reach `http://`/`ws://`
backends (mixed content); desktop keeps both for local backends. QR setup is
desktop/web manual (paste URL + token); the camera-scan flow is Android-only
(`androidMain` `QrScan` → `GmsBarcodeScanning`, which needs the **Activity**
context — tracked in `AppContext` — to launch its scanner UI).

**Per-host overrides:** `EnvironmentProfile` also stores `model` / `effort` /
`permissionMode` (`""` = inherit the server default) and `streaming` (`Boolean?`,
null = inherit), edited from the chat toolbar — each selector has a "Servidor"
entry, and streaming is a `Radio`/`RadioOff` toggle. The effective value
(`override ?: server`) is what the toolbar shows and what the WS `start` sends;
Settings → Generación still sets the **server** default via `SettingsApi.update`.
The environments blob and SSH passwords are kept in a **secure** `AppPrefs`
(`AppPrefs(name, secure = true)` → Android EncryptedSharedPreferences, Windows
DPAPI via JNA; plain elsewhere).

## WebSocket event handling

`ChatSocket` parses server JSON into `ServerEvent`; `ChatViewModel.onEvent` turns
each into a `ChatMessage` or state mutation. Notable:

| Event | Role / Effect |
|---|---|
| `assistant_text` / `thinking` | streamed into the current ASSISTANT / THINKING message |
| `tool_use` / `tool_result` | TOOL block (input + folded result), running spinner until the result |
| `file_change` | FILE_CHANGE diff block (backend pre-classifies each line) |
| `interaction_request` | INTERACTION block (permission buttons or question form) |
| `todos` / `task` | top-bar todos / task indicator |
| `command` / `usage` | local-command markdown / ephemeral plan-usage markdown |
| **`compacting`** | sets `state.compacting=true` → an inline "Compactando" progress band (`CompactProgress`, same band style as `status`); fired by the backend's PreCompact hook, so it shows on **auto**-compaction too, not just manual `/compact` |
| `compact` / `compact_summary` | compaction block + summary; `compact` also clears `compacting` |
| **`status`** | transient progress indicator (`streamStatus`) → an inline band: orange "tardando más de lo normal" (`slow`) / orange "Reintentando" (`retrying`) / red "Fallo temporal" (`failed`); `ok` clears it, and `slow` is hidden while `compacting`. The backend emits `slow` from an idle watchdog (suppressed during compact / tool-in-flight / awaiting-user) and classifies API failures: transient (5xx / connection / "no response from API") → `status`, usage-limit/auth/etc → `error` |
| **`queued`** / **`dequeued`** | message queue: `queued` (id, text) acks an enqueued prompt; `dequeued` (id) renders its user bubble in place (render-on-dequeue) and drops the chip — see **Message queue** |
| `result` / `done` / `interrupted` / `error` | session id / UI transitions; an `error` block now shows a red warning icon + the clean SDK message |
| `history_chunk` | older messages backfill (prepended; non-active session dropped) |

Reconnect/replay (`channel`+`last_seq` resume tokens), the cursor-based
transcript window (100 initial / 500 tail cap), chat attachments (sequential
upload to `shared/uploads/` then `attachments:[relpaths]`; backend builds the
native vision blocks), the file manager, FilePreview (typed renderer + optional
delete via the route-level overlay), the Claude manager, the Monitor (system WS),
markdown rendering, code-edit diffs, and rewind all live in shared `commonMain`,
so they behave identically on every target. Platform-specific differences:

- **Drag & drop upload** (`files/FileDrop.kt`, `Modifier.fileDropTarget`) — OS
  file drops into chat and the files folder (Android N/A); desktop reads
  `DragData.FilesList`, web `transferData.domDataTransferOrNull.files`.
- **Previews/HTML** open in the browser tab on web / a window on desktop, not a
  WebView.
- **Interactive scrollbars** (`ui/ScrollIndicator.kt`) on scrollable content
  blocks (code, tables, diffs) for mouse, hidden on touch (mobile keeps swipe).
- **Share / Save as** (`files/SharedActions.kt`) — there is no native share
  sheet from the JVM/browser, so desktop & web **copy to the clipboard** (the
  URL for a file preview, the text for the markdown notes) and "save as" uses
  tinyfd / `showSaveFilePicker`. Android keeps the real share sheet
  (`ACTION_SEND` / `ACTION_SEND_MULTIPLE`) and SAF `CreateDocument`.

## Message queue

Keep typing while a turn runs. The composer calls `ChatViewModel.enqueueOutgoing`,
which adds a `QueuedMessage` to `state.queue` and pumps it to the backend; the
first idle (non-queued) message is flagged `silent` so it never flashes in the
queue UI. Each item gets a per-instance unique id (`nextOutgoingId()` →
`q<tag>-N`, `tag` seeded once per ViewModel) so a fresh ViewModel reusing a
reattached `LiveSession` can't collide with its already-seen ids — a collision
would make the backend treat the first message as already-consumed and hang on a
phantom turn. On `dequeued` the bubble is drawn from the chip (`appendOrMergeUser`,
render-on-dequeue — no extra `user_message` round-trip, so a resume never
duplicates it) and the chip is dropped. `QueueRow` lists the pending,
non-`silent` items above the composer.

## Version compatibility & updates

Same split as `backend/CLAUDE.md`: **compat** (AppOutdated /
ServerOutdated / CliOutdated NoticeCards) comes from the backend
(`CapabilitiesApi` → `evaluateCompat`); **"update available"** comes only from
**GitHub** (`checkForUpdates()` on open + the Settings button →
`GitHubApi.latestRelease()` → `latestRelease`). The two never cross.

- **Desktop** downloads the OS installer (`installerExtensions`: .msi/.exe / .deb/.rpm / .dmg) and opens it; the Windows MSI uses a stable `upgradeUuid` + `perUserInstall` so it upgrades in place.
- **Web** has no installer: when `latestRelease != null && isWebPlatform` the
  Settings button is **"Actualizar" → `AppUpdater.reload()`** (clears the SW
  caches + reloads). The service worker (`sw.js`) is network-first with
  `cache: 'no-cache'` so a redeployed build is picked up on reload.

## SSH client (desktop + Android)

`TerminalScreen` (commonMain UI) over `TerminalSession` (expect). The desktop and
Android actual is the full client, **shared in `jvmSharedMain`** — `SshConnection`
(sshj, password auth, `PromiscuousVerifier`, OS probe, debounced resize) + a
libvterm-style `TerminalEmulator`/`TerminalView`, with BouncyCastle for modern
OpenSSH defaults. On touch, input goes through a hidden `BasicTextField`: a space
sentinel makes the on-screen Backspace fire, `KeyboardType.Ascii` +
`autoCorrectEnabled = false` keep characters literal, and `imeAction = Go` sends
CR; physical keys still route through `onPreviewKeyEvent`. The wasmJs actual is a
stub (no JVM sshj in the browser).

## Local server (desktop)

`service/LocalServer.kt` (expect; real actual **desktop-only**, android/web are
stubs) lets the desktop app launch and supervise the backend itself instead of
running `python run.py` by hand. `Settings` holds `localServerEnabled`,
`localServerDir` (the backend folder), `localServerPython`
(`auto`/`system`/`custom`) + `localServerPythonPath`, and `localServerMode`
(`local` / `tailscale`). On launch — or the Settings "Run" button — it resolves a
Python (`auto` = a venv under the backend dir, else system `python`/`python3`),
`ProcessBuilder`s `run.py` (`--expose tailscale` in tailscale mode) with
`PYTHONUNBUFFERED=1`, and streams stdout to scrape the **Public URL** / **Token**
from `--expose`. State (`LocalServerState`: Stopped / Starting / RunningManaged /
RunningExternal / Failed; `LocalServerError`: BadDir / NoPython / LaunchFailed /
Crashed) is **derived from the process plus the existing chat WebSocket, never a
poll loop**: if the port is already open it reports `RunningExternal` and stays
hands-off; `stop()` kills the process tree; `restart()` waits for the old process
to exit and the port to free before relaunching. Errors render as red text in the
panel, which hides when a backend is already running externally.

## Markdown scratchpad

`markdown/MarkdownScreen.kt` is a notes editor reachable from the sidebar
(`Lucide.Type`, right of Terminal): a full-screen `BasicTextField` with a
`MarkdownText` live-preview toggle. Content persists through `MarkdownStore`
(debounced 400ms + an `onDispose` flush) — a **file**, not `AppPrefs`, because
desktop `java.util.prefs` throws `Value too long` over 8KB. The overflow menu's
Save / Save As / Share map to the local-text `SharedActions` funcs
(`saveTextToDownloads` / `saveTextAs` / `shareText`); default name `file.md` /
`archivo.md` by locale. No delete (it's a scratchpad, not a file).

## Build / packaging

- **Run desktop:** `./gradlew :app:run`. **Run web:** `./gradlew :app:wasmJsBrowserDevelopmentRun`.
- **Compile-check (use this to verify edits):**
  `./gradlew :app:compileKotlinDesktop :app:compileDebugKotlinAndroid :app:compileKotlinWasmJs`.
- **Android APK:** `./gradlew :androidApp:assembleRelease` →
  `androidApp/build/outputs/apk/release/CConnect-<ver>.apk` (R8 + proguard; signed
  when `client/key.properties` + the keystore exist, unsigned otherwise).
- **Desktop installers:** `./gradlew :app:packageDistributionForCurrentOS` →
  `app/build/compose/binaries/main/{msi,exe,deb,rpm,dmg}/`. `nativeDistributions`
  (build.gradle.kts) sets `packageName=CConnect`, the Windows `upgradeUuid` +
  `perUserInstall`, and per-OS icons. Linux installers are built on `ubuntu-22.04`
  in CI so the `.deb` links against jammy lib names.
- **Web build:** `./gradlew :app:wasmJsBrowserDistribution` →
  `app/build/dist/wasmJs/productionExecutable/` (index.html, cconnect.js, the
  `.wasm`, sw.js, manifest.json, favicon.png, `_redirects`, composeResources).
- **CI:** `.github/workflows/android.yml` (repo root) builds the Android APK on
  push/PR/tag and uploads it as an artifact (signed when the `KEYSTORE_BASE64` /
  `KEYSTORE_PASSWORD` / `KEY_ALIAS` / `KEY_PASSWORD` repo secrets are set, else
  unsigned). The web is served from Cloudflare Pages (`_redirects`
  `/* /index.html 200` gives SPA routing so `/files` etc. survive a reload);
  desktop installers are built per-OS (Linux on `ubuntu-22.04` so the `.deb` links
  against jammy libs).
- **Version contract:** `appVersionName` + `SUPPORTED_SERVER` are generated into
  `BuildConfig` (see the `generateBuildConfig` task) — keep them in step with the
  backend's `[tool.cconnect]` table. `appVersionName` + `appVersionCode` are also
  set in `androidApp/build.gradle.kts` for the APK.

## Conventions

1. **One app, many platforms.** desktop/web/Android share `commonMain`; gate real
   divergences by `LocalIsTouch` / `isWebPlatform` / `isAndroidPlatform` /
   expect-actual (touch: pull-to-refresh, system back, swipe scroll; desktop/web:
   mouse buttons, OS clipboard, drag&drop, window).
2. **Backend is the source of truth.** Mirror its event shapes verbatim.
3. **Real platform divergence goes behind expect/actual**, not ad-hoc branches in
   `commonMain`.
4. **Comments are WHY-only.** No noise restating the code.
5. **No inline fully-qualified names.** Always import.
6. **Reusable shared components** (especially `ui/`) aren't deleted even if
   temporarily unused — they keep porting cheap.
7. **Español neutro** for user-facing Spanish (no regionalisms). Accent color
   names stay in English.
