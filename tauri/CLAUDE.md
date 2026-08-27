# CLAUDE.md — tauri (Svelte + Tauri)

The second app line: same backend contract and the same platforms as `client/`, built with
Svelte 5 + Tauri 2. Assets and the web build are named `cconnect-tauri`.

**It must match `client/` one to one** — same screens, same wording, same spacing, same
gestures. A change lands in both or it is a divergence, which counts as a bug. When the two
disagree, `client/CLAUDE.md` describes the behaviour to copy.

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
│   ├── screens/            # chat/, files/, claude/, monitor/, settings/, terminal/, markdown/
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
  `scrollbar`, `pixelGrid`, `fileDrop`, `keepFocus`. New screens compose these; forking a
  variant is how the two apps drift.
- **Tailwind is concatenated by hand — there is no twMerge.** Two conflicting utilities both
  end up in `class`, and the winner is whatever CSS order decides. Resolve conflicts with a
  prop or a conditional, never by appending another class.
- Menus, tooltips, dialogs and popovers come from **bits-ui**. Menus open to the right
  (`align="start"`), collision padding comes from `layout.menuPadding`, and the exit
  animation is `.menu-surface[data-state="closed"]` in `app.css`.
- Every string goes through `t()` and lives in `lib/i18n/en.json` + `es.json`.

## The pixel grid (`lib/ui/pixelGrid.ts`)

Scroll positions only land on whole **device** pixels (0.8 CSS px at dPR 1.25), so anything
that grows inside the message list must be a multiple of that or the content shifts by a
fraction of a pixel on every open/close. `gridHeight` measures a node and pads it up to the
grid; `ceilPx` ignores differences below Blink's layout unit (1/64 px) — an arbitrary
epsilon there is wrong and unstable. Tokens listed in `SNAPPED` get a `-snap` variant
resolved at runtime; a 14px gap that was half a device pixel is what clipped the rounded
edge of the bars inside a pager.

## Chat list (`screens/chat/MessageList.svelte`)

- The container is `flex-col-reverse`, so `scrollTop = 0` is the bottom and its **sign
  differs per engine**: reads use `Math.abs`, writes a sign detected at runtime.
- `atBottom()` must also be true when there is no scroll at all
  (`scrollHeight <= clientHeight`), or expanding a block in a short chat grows downward
  instead of following the end.
- Growth is anchored with `overflow-anchor: none` + `shiftBy`/`carry` around a
  `ResizeObserver`, so opening a block does not move what you are reading.
- `updateSticky()` runs on scroll, on content resize **and** right after collapsing from the
  sticky header itself: collapsing may leave `scrollTop` untouched, no scroll event fires,
  and the ghost header stays pinned over the real one. The 40px fallback height, used until
  the header measures itself, is load-bearing — replacing it with "invisible until measured"
  produces a blank frame, which reads as a flicker.

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

1. **Parity with `client/` first.** If a behaviour exists there, copy it instead of inventing
   one; if it is missing there, say so before diverging.
2. **Backend is the source of truth**; mirror its event shapes verbatim.
3. **No comments.** Self-explanatory names; rationale goes in the answer or the commit.
   `<!-- svelte-ignore … -->` is a directive, not a comment, and stays.
4. **Neutral Spanish** for user-facing text, from the i18n files — no regionalisms.
