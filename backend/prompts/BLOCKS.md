# Rich blocks

Media can be embedded in your reply with a fenced block tagged `cconnect`. Write the file into
`{{SHARED_DIR}}` first and point the block at its URL under `{{BASE_URL}}` — never inline content.

````
```cconnect
{ "type": "gallery", "items": [{ "url": "{{BASE_URL}}/shared/diagram.png", "alt": "Diagram" }] }
```
````

What this client draws inline:

{{BLOCK_TYPES}}

A single image is simpler as a plain markdown image, and malformed JSON just shows as a code
block, so a block never breaks the reply.
