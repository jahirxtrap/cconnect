# CLAUDE.md — client (Compose Multiplatform)

Kotlin + Compose Multiplatform (Material3 1.5 alpha, MaterialExpressive), package
`com.jahirtrap.cconnect`. **One codebase, three targets:**

- **desktop** — `jvm("desktop")`, packaged as native installers.
- **wasmJs** — the same UI as a static site (Cloudflare Pages).
- **android** — `androidTarget()`; `:app` is a `com.android.library` and the thin
  `:androidApp` wraps it into the APK (AGP 9 rejects the KMP plugin on an application module).

`desktopMain` and `androidMain` share **`jvmSharedMain`** for JVM-only code — the SSH
terminal (sshj + a libvterm emulator) and `SshConnection`.

Screens, view-models, models and the whole `ui/` toolkit live in `commonMain` and are
shared verbatim; each platform only supplies `actual` plumbing.

```
ChatScreen ──> ChatViewModel ──> ChatSocket ──> backend /api/chat/ws
                             └─> SessionsApi / SharedApi / ClaudeApi / … ──> backend /api/...
```

## Platform abstractions

Real divergence goes behind `expect/actual`, never an ad-hoc branch. Current pairs:
`isWebPlatform` / `isCoarsePointer` / `bringAppToFront` (Platform.kt), `HttpTransport`,
`WebSocketConn`, `SharedHttp`, `UrlCodec`, `AppImageLoader`, `AppUpdater`, `Notifier`,
`FilePicker`, `AttachmentFile`, `ClipboardPaste`, `ClipboardShortcuts`, `FilesUrl`,
`ChatUrl`, `Clock` / `DateFormat` / `NumberFormat` / `TimeFormat`, `AppPrefs`,
`MarkdownStore`, `SharedActions`, `TerminalSession`, `LocalServer`, `FileDrop`.

Notable actuals: web `AppUpdater.reload()` clears the service-worker caches and reloads
(there is no installer); `AppPrefs(secure = true)` is EncryptedSharedPreferences on Android
and DPAPI on Windows; `MarkdownStore` is a **file**, not `AppPrefs`, because desktop
`java.util.prefs` throws over 8KB; `TerminalSession` and `LocalServer` are stubs on web.

## Touch and layout

`LocalIsTouch` and `LocalMobileLayout` (`ui/Touch.kt`) are provided once in the theme —
read them, never add a per-component pointer detector. `LocalIsTouch` is seeded from
`isCoarsePointer()` so web-on-phone starts correct. They gate: focusable dropdowns,
pull-to-refresh, interactive scrollbars, the responsive panel (drawer on mobile, inline
64↔300dp sidebar on wide) and the drawer's close button.

## Tabs

Several chats at once. `chat/TabsController` holds `Tab`s persisted to `Settings.tabsState`;
each owns its `ViewModelStoreOwner` and a `ChatViewModel` built from a `TabContext`
(environment, cwd, session, project), so a tab can even target another environment. Each
platform's App renders `key(activeTab.id) { ChatScreen(...) }` — **a tab switch remounts
the list**, which matters for anything that reads layout state on the first frame.
`TabStrip` (desktop/web) vs `TabSwitcher` (mobile); shortcuts in `chat/TabShortcuts.kt`.

## Chat rendering

Event shapes come from the backend verbatim (`backend/CLAUDE.md`). Client-side specifics:

- The list is anchored from the bottom with `reverseLayout = true`: index 0 is the last
  message, items are fed `asReversed()`, "go to end" is `scrollToItem(0)`.
- Until `attached` lands, the previous conversation stays on screen (`frozen`, read through
  `state.view`), so opening or reattaching never shows a half-rebuilt turn.
- Queue chips render on `dequeued`, from the event text, with per-instance unique ids.

**The sticky header of an expanded block is decided in the layout pass, not in
composition.** Candidates come from `state.view` + `expandedState`; position and visibility
are computed inside `Modifier.layout` from `listState.layoutInfo`, returning
`layout(0, 0) {}` when this id is not the sticky one. Reading `layoutInfo` through a
`derivedStateOf` puts the header one frame late, and `visibleItemsInfo` is empty on the
first frame of a remounted list (every tab switch), which is what made it flicker. The
40dp fallback height, used until the header measures itself, is load-bearing: replacing it
with "hidden until measured" trades the flicker for a blank frame.

**Expanding a block follows the bottom** when there is no scroll at all
(`scrollHeight <= clientHeight`), not only when a flag says we are at the end — a short
chat otherwise grows downward instead of staying anchored.

**Image preview.** Coil decodes to the container size, so a zoomable image must request
`size(Size.ORIGINAL)` or it blurs. Pan comes from `detectTransformGestures` (one pointer
pans, two pinch); `transformable` alone gives no mouse pan. Zoom is anchored at the pointer
with `offset' = p - (p - offset) * (next / scale)`, fed from the wheel, the double tap and
the pinch centroid, and the pan is deliberately unclamped.

**File drops filter by type**: `dropHasFiles` (`DragData.FilesList` / `"Files"` in the
`DataTransfer` types / `MIMETYPE_TEXT_URILIST`) gates `shouldStartDragAndDrop`. Without it,
dragging *text* raises the file-drop overlay and steals the drop from the text field.

## Keyboard, mouse and clipboard

Routed at the window (desktop `onPreviewKeyEvent`) / document (web listeners) level so they
work regardless of focus: `ClipboardShortcutHandler` (Ctrl+C/X/V/Esc driving the Files
transfer system and chat paste), `ClipboardPaste`, `DismissStack` (mouse-back closes the
topmost dialog first), `HistoryNav` (browser-like back/forward; native on web, in-memory on
desktop), `BackInterceptor`.

## Build

```bash
./gradlew :app:compileKotlinDesktop :app:compileKotlinWasmJs :app:compileDebugKotlinAndroid  # verify edits
./gradlew :app:run                      # desktop
./gradlew :app:wasmJsBrowserDevelopmentRun
./gradlew :androidApp:assembleRelease   # signed when client/key.properties + keystore exist
./gradlew :app:packageDistributionForCurrentOS
./gradlew :app:wasmJsBrowserDistribution
```

`appVersionName` and `SUPPORTED_SERVER` are generated into `BuildConfig`; keep them in step
with the backend's `[tool.cconnect]` table. CI builds the Android APK on push/PR/tag.

## Traps

- A top-level function cannot live in a `commonMain` file whose name matches an
  `expect/actual` pair: both generate the same JVM class (`NumberFormatKt`) and the desktop
  build fails on a duplicate. That is why `formatTokens` sits in its own `data/TokenFormat.kt`.
- Token formatting is shared by the context ring and the compact block
  (`data/TokenFormat.formatTokens`: rounded K, one decimal for M, no trailing `.0`) and the
  Tauri app mirrors it in `lib/data/format.ts`. Two implementations drifted once and showed
  60K vs 61K for the same session.

## Conventions

1. **One app, many platforms.** Gate divergence by `LocalIsTouch` / `isWebPlatform` /
   `isAndroidPlatform` / expect-actual — nothing else.
2. **Backend is the source of truth**; mirror its event shapes verbatim.
3. **No comments.** A one-line descriptive docstring only when a constraint cannot be
   expressed in code; rationale goes in the answer or the commit.
4. **No inline fully-qualified names.** Always import.
5. **Reusable `ui/` components are not deleted** when temporarily unused — they keep porting
   to the Tauri app cheap.
6. **Neutral Spanish** for user-facing text, from the string resources — no regionalisms.
