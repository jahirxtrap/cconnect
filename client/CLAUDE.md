# CLAUDE.md — client (Svelte + Tauri)

The app: desktop, web and Android from one Svelte 5 + Tauri 2 codebase, against the backend
contract. Assets and the web build are named `cconnect-tauri`.

## Layout

```
src/
├── App.svelte              # routes, window-level keydown / drag guards
├── app.css                 # global rules + keyframes (menus, ripple, markdown, scrollbars)
├── lib/
│   ├── app/                # navigation (URL routing per screen)
│   ├── data/               # models, settings, format helpers, time, previewKind
│   ├── design/             # tokens.css, theme, session colors
│   ├── i18n/               # en.json / es.json — every user-facing string
│   ├── platform/           # isTouch, layout, desktop, fieldSizing polyfill
│   ├── screens/            # chat/, shared/, project/, claude/, monitor/, settings/, terminal/, notes/
│   ├── services/           # backend clients: chatSocket, sessionsApi, sharedApi, claudeApi…
│   └── ui/                 # the shared toolkit
└── src-tauri/              # Rust side + gen/android (committed)
```

## Rules

- **Svelte 5 runes only** (`$state`, `$derived`, `$effect`, `$props`). Actions (`use:x`) have
  no `update` hook: reactivity inside one needs its own observers, or an `$effect` in the
  component that calls back into it.
- **Reuse the toolkit.** `PopupMenu`, `MenuSub`, `MenuItem`, `InputField`, `ListRow`,
  `CompactDialog`, `ConfirmDialog`, `ZoomPane`, `DropOverlay`, `MarkdownText`, `CodeBlock`,
  `SelectionDot`, `scrollbar`, `gridHeight`, `fileDrop`, `keepFocus`. New screens compose
  these; forking a variant is how the two apps drift.
- **Tailwind is concatenated by hand — there is no twMerge.** Two conflicting utilities both
  end up in `class`, and the winner is whatever CSS order decides. Resolve conflicts with a
  prop or a conditional, never by appending another class.
- Menus, tooltips, dialogs and popovers come from **bits-ui**. Menus open to the right
  (`align="start"`), collision padding comes from `layout.menuPadding`, and the exit
  animation is `.menu-surface[data-state="closed"]` in `app.css`.
- Every string goes through `t()` and lives in `lib/i18n/en.json` + `es.json`.
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
  what a collapsible body needs. It floors the padding to Blink's layout unit (1/64 px) and
  ignores anything below it — an arbitrary epsilon there is wrong and unstable.

## Chat scroller (`screens/chat/ChatScroller.svelte`)

One component owns the viewport and the chat list, the quick chat and the side panel all
mount it; the API is exported (`atBottom`, `scrollToEnd`, `holdAt`, `scrollFromEnd`,
`bringToTop`, `refreshHeader`).

- `follow` is the stick-to-the-end state. The `ResizeObserver` re-pins to the end while it
  is on, or to `pendingTop` when a hold is in place, which is what stops a block growing
  above you from moving what you are reading.
- `ownTop` tells our own scroll writes apart from the user's, or every programmatic scroll
  would clear `follow` on the scroll event it causes.
- `atBottom()` must also be true when there is no scroll at all
  (`scrollHeight <= clientHeight`), or expanding a block in a short chat grows downward
  instead of following the end.
- The pinned header is recomputed on scroll and on resize, walking forward from
  `firstVisible()` (a binary search over `offsetTop`); its push is snapped to the device
  pixel. The 40px fallback height, used until the header measures itself, is load-bearing —
  replacing it with "invisible until measured" produces a blank frame, which reads as a
  flicker.

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
banner and hands the promotion to **Install app** in Settings → Information. iOS fires no
such event and exposes no install API, so there the same entry only spells out the two
steps.

## Android

`src-tauri/gen/android/` **is committed** — it holds `MainActivity.kt`, `PastedContent.kt`
and the manifest, so edits there are real source, not generated scratch.

`setOnReceiveContentListener` rejects a MIME type starting with `*`: passing `*/*` throws
`IllegalArgumentException` while the WebView is being created and kills the app on launch,
with nothing on screen. Wildcards are only allowed in the subtype (`image/*`, `video/*`, …).

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
3. **Neutral Spanish** for user-facing text, from the i18n files — no regionalisms.
