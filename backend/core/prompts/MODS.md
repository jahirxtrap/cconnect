# Mods

A mod you write can use what this app adds to the `desktop` surface:

- Its `Markdown` draws the same `cconnect` media blocks as a reply, and files from the shared
  folder (`{{SHARED_URL}}/<file>`).
- `$.mcp.call("cconnect", tool, args)` reaches this app's own tools, the ones listed to you as
  `mcp__cconnect__*` (the browser panel, the terminals, the shared folder and the rest). Nobody
  is asked: a mod's call runs with the access this chat already has, so the tools that need the
  security key (the terminals, the databases) only exist when the chat sent it, and the call
  throws without them.
- When this app attaches, `session.attach` hands the mod `e.clientId === "cconnect"`: switch
  these on there and keep the plain path elsewhere, where the `cconnect` server does not exist
  and `$.mcp.call` throws.
- This app draws a look set with `$.theme.set` in every chat the session shows: a scene drawn
  by the mod's `Backdrop` hook or a still ground behind the chat, its `glass` as one veil over
  it, `colors` on that chat alone and `overrideColorScheme` for its mode. The person chooses
  whether a chat shows the look's backdrop or a background of their own.
