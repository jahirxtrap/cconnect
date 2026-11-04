Any web page, a chat message or Claude itself can hand CConnect something to install with a link:
an MCP server, a plugin, a marketplace, a skill, an ACP agent or a pack of themes. CConnect opens it, shows
exactly what it is and what it runs, and installs nothing until you press **Install**.

```
cconnect://install/<kind>?<fields>
```

| Kind | Installs | Fields |
|---|---|---|
| `mcp` | An MCP server for Claude Code | `name`, plus one of the [forms below](#mcp-servers) |
| `plugin` | A Claude Code plugin | `name=<plugin>@<marketplace>`, optional `source` |
| `marketplace` | A plugin marketplace | `source` |
| `skill` | A skill from a git repository | `source`, optional `path` and `ref` |
| `agent` | An ACP agent from the official registry | `id` |
| `pack` | A `.ccpack` with themes, fonts or chat backgrounds | `url`, over https |

Values are URL-encoded like any query string, and a field that repeats keeps its order.

---

## MCP servers

Three ways to describe the server, whichever is easier to write:

| Form | Fields |
|---|---|
| **Remote** | `url`, `type=sse` when it is not streamable HTTP, `header=Name: value` (repeats) |
| **Local** | `command`, `arg` (repeats), `env=KEY=value` (repeats) |
| **Config** | `config`: the server's entry from `.mcp.json`, as JSON or base64 |

```text
cconnect://install/mcp?name=linear&url=https://mcp.linear.app/mcp
cconnect://install/mcp?name=fetch&command=uvx&arg=mcp-server-fetch
cconnect://install/mcp?name=files&command=npx&arg=-y&arg=@modelcontextprotocol/server-filesystem&arg=/home/me
cconnect://install/mcp?name=search&command=npx&arg=-y&arg=brave-search-mcp&env=BRAVE_API_KEY=
```

The config form takes the same JSON as an entry of `.mcp.json`:

```json
{ "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/me"], "env": {} }
```

```json
{ "url": "https://api.example.com/mcp", "type": "http", "headers": { "Authorization": "Bearer …" } }
```

**Cursor's links work too.** An *Add to Cursor* link carries that same config in base64, so
`cursor://anysphere.cursor-deeplink/mcp/install?name=…&config=…` opens in CConnect as well, and a
site that already offers one gets *Add to CConnect* by changing the start of its link.

The dialog lists every environment variable and header the link brings, ready to fill in before
installing, so a link can leave an API key empty for the user to type. The server goes into the
user configuration of the Claude Code install of the environment picked in the dialog, the active one
unless you choose another, the same as adding it from the Claude screen, and one with the same name
is replaced after a notice.

---

## Plugins and marketplaces

```text
cconnect://install/plugin?name=code-review@claude-plugins-official&source=anthropics/claude-plugins-official
cconnect://install/marketplace?source=anthropics/claude-plugins-official
```

A plugin is named the way Claude Code names it, `plugin@marketplace`. When that marketplace is not
added yet, CConnect adds it from `source` first: `owner/repo` on GitHub, or a git URL. Without a
`source`, the link only works for a marketplace the user already has.

## Skills

```text
cconnect://install/skill?source=anthropics/skills&path=skills/pdf
cconnect://install/skill?source=https://github.com/anthropics/skills/tree/main/skills/pdf
```

A skill is a folder with a `SKILL.md`. `source` is the repository, `owner/repo` on GitHub or an
https git URL, `path` the folder inside it (left out when the skill is the whole repository) and
`ref` the branch or tag when it is not the default one. A folder's address on GitHub works on its
own too, so a link can be made by copying it from the browser.

The CConnect server downloads only that folder and copies it to `~/.claude/skills/<folder name>`,
leaving out `.git` and any symbolic link, so a skill cannot point at files on the server's machine.
One with the same name is replaced after a notice, and a local plugin of that name is never
touched. Open chats pick it up without restarting, and every account on the server gets it.

## ACP agents

```text
cconnect://install/agent?id=<registry id>
```

The id is the agent's id in the [ACP registry](https://agentclientprotocol.com). The dialog shows its
name, version and description from the registry before installing it.

## Packs

```text
cconnect://install/pack?url=https://example.com/themes/midnight.ccpack
```

The CConnect server downloads the file (https only, up to 500 MB) and checks that it is a valid pack,
then the app shows the same dialog as opening a `.ccpack`: what it brings, **Install**, and **Use**
when its author picked what to apply. Nothing is kept until you install it. How to make one is in
[[Packs]].

---

## In the chat

Any of these links is clickable in a message. Claude offers installs as a block of cards, each
opening the same dialog:

````markdown
```cconnect
{ "type": "install", "items": [
  { "kind": "mcp", "name": "fetch", "command": "uvx", "args": ["mcp-server-fetch"] },
  { "kind": "mcp", "name": "linear", "url": "https://mcp.linear.app/mcp" },
  { "kind": "plugin", "name": "code-review@claude-plugins-official", "source": "anthropics/claude-plugins-official" },
  { "kind": "pack", "url": "https://example.com/themes/midnight.ccpack" }
] }
```
````

An item takes the same fields as the link plus `kind`; for an MCP server, `args` is a list and
`env` and `headers` are objects, as in `.mcp.json`, or the whole entry goes in `config`. An item
with `link` takes a whole link instead.

## On a web page

```html
<a href="cconnect://install/mcp?name=fetch&command=uvx&arg=mcp-server-fetch">Add to CConnect</a>
```

The desktop app registers `cconnect://` when it is installed, on Windows, macOS and Linux, and if it
is already open the link reaches the window you have. On Android any browser hands the link to the
app. The web app only takes these links inside the chat.

---

## Safety

These links carry no signature and ask for no security key, the same as adding something by hand
from the Claude screen: the dialog is the protection. It always shows what the link brings,
including the command and arguments of a local MCP server, which runs on the server's machine, and
nothing is installed until you confirm. Install only what you recognize.

## Requirements

Install links need the app and the server of the release after 2.0.9. An older server answers the
MCP and pack links with a notice to update it.
