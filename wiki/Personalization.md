## Themes and packs

**Theme** in the Client settings picks a light theme, a dark theme and the
terminal colours apart — CConnect's own and two dozen more, from Claude and
GitHub to Dracula and Nord — and **Appearance** chooses between them or follows
the system. The accent colour can come from the theme, **Font** sets the
typefaces for text, code, symbols and emoji, and **Chat background** puts the
CConnect logo, a background from a pack or a picture of your own behind the
conversation.

All of that travels as a `.ccpack` pack. **Packs** installs one from a file or
from those available on the server — Claude can write one for you and leave it
there — and opening a `.ccpack` in the chat, in Shared, from the desktop or from
any app on Android shows what it brings, to install, save, share or open
elsewhere. When its author picked what to apply, **Use** puts all of it on at
once. From Samsung's My Files, use **Import pack** instead.

Every pack on the server stays in that list, the ones you already have too:
it offers to install a new one, to update yours when the server holds a newer
version, and to delete one from the server, which takes the security key. How
to make one is in the [[Packs]].

## Settings

A search box finds any option by name or by its value, wherever it lives, and
takes you to it. A **Privacy** section decides what leaves the machine: remote
control from claude.ai, commit co-authorship, and session upload. The backend
also updates itself from here, and on desktop the local server is started,
restarted or stopped from the same place. On the desktop Settings opens in the
centre beside your chats, the same as Claude, Monitor, Shared and Notes.

The app comes in ten languages — English, Spanish, Brazilian Portuguese, French,
German, Italian, Japanese, Simplified Chinese, Korean and Russian — and follows
the system's unless you pick one under **Language**.

## Staying current

The app and the backend declare which versions of each other — and of the
Claude CLI — they support. When something falls behind, a notice in the chat
takes you straight to the right place: the app's own update (with its
changelog), the server requirement, or the CLI update button. On the desktop and
Android the app also tells you once when a new version of it is out. Release notes
for both CConnect and Claude Code are readable in the app, and **Report a
problem** in Settings → About opens a GitHub issue with the app, system, server
and CLI versions already filled in. Settings → Recovery
exports your settings to copy them into another install, or keeps copies of them
in your Google Drive (encrypted with a password if you give one, and with this
device's notes, packs and backgrounds if you want them along); the chats
themselves stay on the server.

## Discord

The desktop app can show on your Discord profile what you are working on: the
action, the elapsed time of the turn, the model, the environment, the project
folder or the chat title. Each piece is a switch of its own and everything is
off until you turn the integration on — the content of the messages never goes
out, at any setting. It talks to the Discord desktop client over its local
socket, so nothing leaves the machine and there is nothing to publish while it
is off.
