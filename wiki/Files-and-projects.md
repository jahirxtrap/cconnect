## Shared

The shared folder grew into a full file manager. Browse `~/.cconnect/data/shared/` from
the app: upload files (with per-file progress you can cancel), create folders,
rename, sort by name/date/type/size, and long-press (or right-click on desktop)
to multi-select — then move, copy, share, delete, save to Downloads, or copy a
file's PC path. Open a file to preview it in place — images with zoom, video,
audio, PDF, SVG, Markdown, source code and HTML — and delete it right from the
preview if it's no longer needed.

With the side panel open the preview lands there instead of covering the chat,
so you can watch a file while Claude rewrites it — it reloads on its own when it
changes on disk. A button blows it up to full screen, and closing it gives you
back the panel you had. The same goes for a file Claude links in the chat: one
tap opens it, and the rest of the actions stay in the viewer's menu.

Each project keeps its own folder inside it: what you upload from a chat and what
Claude writes for you land there, so with a project pinned you see that project's
files and nothing else. The three-dot menu filters what to show — images, video,
audio, PDF, Markdown, code, archives, packs.

It works in both directions: drop a file into `~/.cconnect/data/shared/` on the PC — or
just ask Claude to write one there — and you get a tap-to-download link in the
chat, served over the same authenticated connection.

## Project files

The side panel also browses the project of the chat beside it, or another you
pick. Search the tree by
typing a few letters of any path, and open a file read-only while Claude edits
it. Git colours the tree — added, modified, untracked — and inside a file the
change is painted on the numbered lines themselves, with buttons to walk from
one to the next. An eye in the file's header moves it to the centre pane, where
it takes the place of the chat, and from either side it expands to the whole
window. A toggle folds the tree down to only what changed. An archive opens in
the tree like a folder, and a file inside it previews without extracting
anything. From a file you can
mention its full path in the chat or copy it. What git ignores stays hidden
until you unlock it with the security key.

With that changed view open, a bar at the bottom carries the branch, how far
ahead or behind it is, and everything a commit takes: tick the files that go in,
write the message — or have Claude write it from what you marked, following a
prompt of your own kept in the Claude screen — choose the author among the
identities the repository knows, amend the last commit, and pull or push. The
same bar opens the branch's history: the commits behind it, newest first,
loading more as you reach the end. Every repository under the project is listed,
not only the one at its root, so each file is committed to the one it belongs
to.

Throwing away the changes of what you ticked, pushing a branch that has no
remote yet, and forcing a push are each one confirmation away. The security key
gates all of it: without it the bar shows the branch you are on and nothing
else.

## Notes

A built-in Markdown editor keeps as many notes as you need, shown as a list or
as cards and searchable across all of them. A bar formats as you write (tasks you
tick, bullets, headings, bold, code) with undo and redo, the preview renders the
note as Markdown, and any of them can be duplicated, saved, exported or shared as
a file. What you type stays between sessions. Syntax highlighting covers
everything Shiki knows, here and anywhere else code shows up.
