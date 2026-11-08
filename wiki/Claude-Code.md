## Manage Claude Code itself

The **Claude** screen is a remote manager for the Claude Code install on the
PC:

- See the active CLI version, switch where it comes from, update it, and read
  the official changelog without leaving the app.
- Browse any **marketplace** catalog and install **plugins** from the app;
  enable, disable, update, or uninstall the ones you have.
- Add or remove **MCP servers**, with the credentials or environment variables
  they need, and marketplaces.
- **Install from a link** an MCP server, a plugin, a marketplace, an ACP agent or
  a pack, from a web page, a message or a card Claude offers; the app shows what
  it runs before installing anything. The syntax is in the
  [[Install links]].
- Read the **skills** your plugins provide, and view or delete Claude's
  **memories**, globally or per project.
- Keep your own standing instructions in a **user prompt** editable from the
  app — it rides along every conversation, on top of CConnect's own system
  conventions.
- See your **plan usage** at a glance — your plan as Anthropic names it and a bar
  per limit window: current session, this week with where it went by product,
  and the per-model weekly caps with how much of the week each can take, each
  with its reset time.
- Keep several **Claude accounts** on one backend and switch between them.

### Multiple accounts

One backend can hold more than one Claude login. Add an account from the Claude
screen and sign in without leaving the app: it hands you a link — copy it, open
it on whatever device you like, approve the account there and paste the code
back. Nothing is typed on the server, and each account keeps its own
credentials, refreshed by the CLI as usual.

Everything else is one configuration for all of them — conversation history,
MCP servers, plugins, skills, settings and memories — so something added while
using one account is there for every other, and switching accounts only changes
who pays for the turn, not what you see.

Signing in to an MCP server is a credential too, so each account keeps its own.
An MCP server that asks for a sign-in lists the accounts in its card in the
Claude screen, each with its status, and the list says how many of them are
signed in: pick one to sign it in, again or out. The
link opens anywhere; in a browser on the server it finishes by itself, and on
another device the page it ends on won't load, so you paste its address back.

Pick the account per chat from the composer bar, or set the server-wide default
from the Claude screen's header (the usage shown there follows it, and its
picker shows another account's for a quick look) or in Settings. Accounts you haven't signed into yet are listed too, so you can
finish later.

### Model providers

An account doesn't have to be a Claude login. A **provider** one points the CLI
at an address of your own, anything answering the Anthropic API — a model running
on your machine with [Ollama](https://ollama.com), or a gateway like
[OmniRoute](https://github.com/diegosouzapw/OmniRoute) standing in front of
hundreds of them. Give it the address and, if it asks for one, a token, an API
key or a header of your own; the models it serves are read from there and become
the list you pick from, effort levels and context window included, for the reply,
the quick chat and the title the chat writes for itself.

Models that cannot call tools are left out, since Claude Code leans on them for
everything it does, and a small model tends to describe a tool call instead of
making one — the system prompt alone is around 17K tokens, which also rules out
anything with a short context window.

An account can also move between backends. Export it and you get a small zip
holding its credentials and its own settings — no conversations, no projects,
nothing tied to the machine it came from. Import it from the same dialog you add
an account in: the bundle always lands on a **new** account, so it can never
overwrite a login you're already using.

## Mods

Claude Code mods are plugins that change what Claude shows and how it behaves:
panes that stay beside the chat and update as it works, a band above the
composer, a status line, notices and commands of their own. CConnect draws them
in its own style instead of as terminal text, on desktop, web and Android alike.

Panes open in the side panel's **Mods** view, one tab each, and take the same
shortcuts as the chat's tabs. The band sits on top of the composer with the mods'
status line under it, and its bar hides and shows it; with **Collapsible mods
band** off in Settings that is left to a shortcut of your own. **Mods**, on by
default in the server settings, shows what mods report in any chat, while panes
and the band also need persistent sessions, since the Claude process that stays
running is the one drawing them. It rides on an internal Claude Code protocol
that can change between versions, so it is marked experimental.

**Reload plugins** under ⋮ in the Mods view, or `/reload-plugins` and
`/reload-skills` in the composer, bring in what you changed without leaving the
chat. Installing a plugin or switching one on or off reloads the open persistent
chats on its own, and asks first when they would lose their cache.

They install like any plugin, from a marketplace or from a folder. When Claude
writes one for you in a chat, CConnect asks before turning it on for that
session (a mod is code, and it runs with the same access you have), and **Mods
from chats** in the catalog installs it for every chat. In the Claude screen a
mod's card lists its commands and, in plain words, what it reaches (the
interface, your files, programs, the internet, requests to Claude), and its
options are edited from there.

## Built-in features

On top of plain Claude Code, the backend ships a few helpers wired into the
agent so they're available out of the box from the phone:

- **Cross-project progress check.** Ask things like _"how's the README I left
  running in <other-project> going?"_ and Claude summarizes that other
  session's latest activity into Done / Pending / Files touched / Next step,
  without you having to open it.
- **Editable system prompt.** CConnect's own conventions are appended to every
  chat — that's where the file-sharing and progress-check rules live. Your
  personal additions go in the user prompt, edited straight from the Claude
  screen.
- **ACP agents.** A view for either panel runs agents that speak the Agent
  Client Protocol, such as Copilot, Codex or Gemini, installed from the
  official catalog or added by hand, with their chats listed on the left like
  Claude's, sorted into categories and renamed from there. They get CConnect's
  `share_files` and its guides, so they hand you files and answer with galleries,
  PDFs and next-step buttons, and an agent that signs in through a web page shows
  it in its card, to finish in the server's browser from another device.
- **Delegation.** Claude can hand a task to another AI and get its answer
  back: an ACP agent, an agent CLI added under ACP agents as a command, or
  another of your Claude accounts once its sheet says Claude can use it, with
  the model you ask for when the destination offers a choice. Claude can also
  install an agent from the catalog when you ask; in a persistent chat the task
  can run in the background while the conversation goes on.
