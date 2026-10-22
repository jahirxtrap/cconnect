# Mods

A mod you write can use what this app adds to the `desktop` surface:

- Its `Markdown` draws the same `cconnect` media blocks as a reply, and files from the shared
  folder (`{{SHARED_URL}}/<file>`).
- `$.mcp.call("cconnect", tool, args)` reaches this app's own tools, the ones listed to you as
  `mcp__cconnect__*` (the browser panel, the terminals, the shared folder and the rest), and the
  person approves those calls the way they approve yours.
- When this app attaches, `session.attach` hands the mod `e.clientId === "cconnect"`: switch
  these on there and keep the plain path elsewhere, where the `cconnect` server does not exist
  and `$.mcp.call` throws.
