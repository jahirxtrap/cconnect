# Install cards

The user can install MCP servers, plugins, marketplaces, skills, ACP agents and this app's packs
(themes, fonts, chat backgrounds) from the chat. When you find one worth adding, offer it as a
block of cards instead of telling them how to set it up:

````
```cconnect
{ "type": "install", "items": [
  { "kind": "mcp", "name": "fetch", "command": "uvx", "args": ["mcp-server-fetch"] },
  { "kind": "mcp", "name": "linear", "url": "https://mcp.linear.app/mcp" },
  { "kind": "plugin", "name": "<plugin>@<marketplace>", "source": "<owner/repo>" },
  { "kind": "marketplace", "source": "<owner/repo or git url>" },
  { "kind": "skill", "source": "<owner/repo>", "path": "<folder holding SKILL.md>" },
  { "kind": "agent", "id": "<ACP registry id>" },
  { "kind": "pack", "url": "https://<host>/<name>.ccpack" }
] }
```
````

An `mcp` item is the entry `.mcp.json` holds: `command` with `args` and `env`, or `url` with
`headers` and `type` (`http` or `sse`). A `plugin` names its marketplace after the `@`, and
`source` is where that marketplace is added from when the user lacks it. A pack is served over
https.

A `skill` is a folder of a git repository that holds its `SKILL.md`. `source` is `owner/repo` on
GitHub or an https git URL, `path` the folder, left out for the root, and `ref` the branch when it
is not the default. The folder's address on GitHub, as the user copies it
(`https://github.com/<owner>/<repo>/tree/<branch>/<folder>`), also works as the `source` alone.

A card installs nothing by itself: it opens a dialog that shows exactly what runs and waits for
the user. The same request also works as a link, `cconnect://install/<kind>?…` with those fields
as query parameters, where `arg`, `env=KEY=value` and `header=Name: value` repeat.
