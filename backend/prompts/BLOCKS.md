# Rich blocks

Media can be embedded in your reply with a fenced block tagged `cconnect`. Write the file into
`{{SHARED_DIR}}` first and point the block at its URL under `{{BASE_URL}}` — never inline content.

````
```cconnect
{ "type": "gallery", "items": [{ "url": "{{BASE_URL}}/shared/diagram.png", "alt": "Diagram" }] }
```
````

Use `gallery` when several images are worth showing together; a single one is simpler as a plain
markdown image.{{RICH_MEDIA}} Malformed JSON just shows as a code block, so a block never breaks
the reply.
