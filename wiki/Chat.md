## In the chat

Claude Code's own slash commands show up in the composer, plus a `/usage` view
of your plan's token limits. A message that starts with `!` runs as a shell
command with the terminal's shell, like `!` in Claude Code: sent while Claude is
working it waits in the queue like any message, a `cd` carries over to the chat's
next `!` commands, and one that leaves the chat's folder goes back to it. The menu offers the chat's earlier `!` commands, the same ones arrow up walks
back through, and Claude reads the command and its output and answers. It takes the
security key, like the terminal. The context ring in the composer bar shows how full
the context is, your session and weekly limits as they move, and how long the cache
has left. A **quick chat** button opens a pane under the chat for a
throwaway question — handy to ask something while a long task keeps running,
without derailing it.

**Queue** keeps your messages flowing: send another while Claude is still
working and it's held, then picked up in order and placed in the conversation
as each one runs — and anything still waiting comes back if you reload or
resume the chat.

**Questions come as forms.** When Claude needs something from you it asks in
the chat itself — choices, text fields, toggles and a note kept apart from the
answer — and longer questions arrive as pages you move through. An MCP server
that needs a value or wants you to open a page asks the same way. Its replies can
carry more than text too: galleries, audio, PDFs and live previews, plus
drawings once **Drawings in replies** is on in Settings → Tools: a checklist or a
diagram sketched right in the reply, growing as it writes, that opens large like
an image to save, share or save to Shared. Ask what the session is spending and
the plan usage is drawn in the chat, and ask it to compact and it does.

**Attachments** travel with your message: tap the clip, pick any files or
photos on your device, and they land on the PC before the prompt runs. Images
reach Claude as real vision input — it sees them, not a path — and other files
arrive as mentions it can open directly. Pasting works without clicking the
box first: files and images become attachments, text goes into the message.

**Rewind** takes a conversation back to an earlier point. Pick the moment,
preview what would change on disk (`+added −removed • files`), and
choose whether to roll back the conversation alone or code and conversation
together. What a terminal command changed is not part of a checkpoint, so after
one the preview says those changes are unknown, and a notice tells you when some
files could not be put back. The conversation goes back with your next message:
until then the chat shows a notice with **Undo**, which brings the rest of it
back and leaves the files as Rewind left them. **Earlier points** at the end of
the list reaches the stretches before each compaction; Claude Code cannot roll
those back, so they only fork.

**Fork** copies a chat into a new one and leaves the original as it is: the
whole conversation from the chat's menu, or up to a point from Rewind or from
the row under each reply, which also shares and copies it.

**Listen** reads a reply aloud — from the row under it, or just the part you
select — with the voices the system ships. **Read aloud** in the Client settings
picks the voice and the speed, and can read the last reply by itself when the
work is done, always or only while the app is in the background.

**Arrow up walks back** through what you already sent in this chat, straight
from the composer, and arrow down comes forward again — with what you were
writing kept aside and handed back at the end. It reaches the messages before
the page on screen and the ones sent from other devices, and holding **Send**
(right-click on the desktop) lists them to pick one.

**Continue** sits in a turn that stopped halfway — interrupted, or a reply that
ran out of length — and a passing error from Anthropic's servers offers
**Retry** instead. Either sends a short message in the app's language, and only
on the last card of a chat that is not working.

**Dictate instead of typing.** The microphone next to Send writes what you say
into the composer — words appear as you speak and each finished sentence lands
in the message. On Android it goes through the phone's own recogniser, which
works offline once the language is downloaded; on the desktop app and the
browser it uses the engine they ship. Attach and the slash commands moved into
the **+** menu beside it, so the bar keeps two buttons.

**Persistent sessions** keep a chat's Claude process running while you have it
open: a message is answered without starting the CLI first, and commands can
keep working in the background between turns. Each one holds its own process
(around 400 MB of memory, not counting its MCP servers), so **Sessions** in the
Server settings chooses how many chats and ACP agents may keep one at once and how
long each waits after the last device closes it, and you can close it yourself
from the chat's header. Whatever runs in the
background is listed under **Running** in that header, each task with a button to
stop it, and the session stays open while any of it is still working. A `/loop` or
a scheduled task keeps it open too, even with the app closed, and what it asks
Claude shows in the chat as **Scheduled message**.

Model, effort and the effort subagents run at, permission mode, whether Claude may
write outside the chat's working folders, how much of each turn you see, when the
context gets compacted, which of CLAUDE.md and AGENTS.md Claude reads as the
project's instructions, and which Claude CLI the backend drives are all set from the app.
The server holds the defaults and every client follows them, but each device can
decide for itself how much of a turn it receives — including a **simple mode**
that folds thinking and tool detail into a single working block, the way the
quick chat already reads. What you cannot afford to miss stays visible there:
file changes, databases, shared files, forms, and what runs under Running.

## Tabs

Keep several chats open at once, each in its own tab with its own session,
project and environment — start a long task in one, switch to another, and come
back to find it where you left it. Desktop and web get a tab bar; on mobile a
switcher does the same. Open any chat or session in a new tab, reorder them, and
on desktop reach for the keyboard (Ctrl+T to open, Ctrl+W to close, Ctrl+Tab to
cycle). Chats and ACP agents open in either panel, each panel with its own
tabs: a tab drags from one bar to the other, **Swap panels** in the panel menu
trades the two, and the list on the left shows the chats of the panel you are
in. The tabs you had open come back when you reopen the app, each
loading only once you switch to it. A chat's menu in the list — long-press or
right-click — also copies its session ID, for ACP agents too. The side panel's views — terminal, browser,
project files, mods and ACP agents — sit in a bar you reorder by dragging, moving
any of them into or out of its menu.
