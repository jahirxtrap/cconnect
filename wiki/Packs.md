A pack is a zip file with the `.ccpack` extension that brings app themes, terminal colours, syntax
colours, accents, fonts and chat backgrounds. The server and the app read it with the same rules, so
a pack that installs in one installs in the other.

## Layout

```text
midnight.ccpack
├── pack.json                          the manifest, required
├── preview.png                        optional picture for the pack's card
├── themes/midnight-dark.json          app themes, one file each
├── terminal/midnight.json             terminal palettes
├── syntax/midnight.json               syntax colours, in the VS Code theme format
├── accents.json                       accent colours
├── fonts/text/Midnight Sans/…woff2    fonts: fonts/<kind>/<family>/<file>
└── backgrounds/aurora.webp            chat backgrounds, each with an optional aurora.json
```

Every section is optional, but a pack has to bring at least one of them. pack.json sits at the root
of the zip, not inside a folder.

---

## pack.json

```json
{
  "schema": 4,
  "id": "midnight",
  "name": "Midnight",
  "version": "1.0.0",
  "author": "You",
  "description": "A deep blue theme with a terminal to match",
  "preview": "preview.png",
  "use": ["midnight-dark", "midnight", "theme"]
}
```

| Field | | What it is |
|---|---|---|
| `schema` | required | Version of the format; `4` is the current one |
| `name` | required | The name the app shows |
| `version` | required | Compared with the installed copy to offer an update |
| `id` | optional | Lowercase words joined by dashes, taken from `name` when left out. `cconnect` and `cconnect-extras` belong to the built-in packs |
| `author`, `contributors`, `description` | optional | A name, a list of names and one line about the pack |
| `preview` | optional | An image inside the pack, shown on its card |
| `use` | optional | What **Use** applies at once: the ids of its themes, its terminal palette, an accent (or `dynamic`, or `theme` to take the theme's), its font families and a background |

Each file's id is its name in lowercase with dashes: `themes/Midnight Dark.json` is `midnight-dark`.

---

## Themes

`themes/midnight-dark.json`:

```json
{
  "name": "Midnight Dark",
  "kind": "dark",
  "extends": "cconnect-dark",
  "accent": "#5c7cfa",
  "syntax": "github-dark-default",
  "colors": {
    "background": "#0b1020",
    "surface": "#10162a",
    "surface-variant": "#1a2140",
    "on-background": "#e6e9f5"
  }
}
```

| Field | | What it is |
|---|---|---|
| `name` | required | The name in the theme picker |
| `kind` | required | `light` or `dark` |
| `extends` | optional | Another theme of the pack, or a built-in one. What this theme leaves out comes from it, and without `extends` from CConnect Light or CConnect Dark |
| `accent` | optional | The accent when the user picks the theme's own |
| `syntax` | optional | A syntax theme of the pack, or a built-in one such as `github-dark-default` |
| `colors` | optional | Any of the colours below |

Colours are `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`. The built-in themes to extend are
`cconnect-dark`, `cconnect-light`, `ayu-dark`, `ayu-light`, `ayu-mirage`, `claude-dark`, `claude-light`,
`catppuccin-latte`, `catppuccin-mocha`, `dracula`, `everforest-dark`, `everforest-light`, `github-dark`,
`github-dark-hc`, `github-dimmed`, `github-light`, `github-light-hc`, `gruvbox-dark`, `kanagawa`, `monokai`,
`nord`, `one-dark`, `rose-pine`, `solarized-dark`, `solarized-light`, `tokyo-night`, `ubuntu-dark`,
`ubuntu-light`, `vscode-dark-modern`, `vscode-dark-plus`, `vscode-light-modern` and
`vscode-light-plus`.

### Colours

| Colour | Where it shows |
|---|---|
| `background` | The window behind everything: the chat, the panels and the browser's start page. |
| `on-background` | Main text and icons. |
| `surface` | Panels, dialogs and cards on the background: the chat list, the composer, and Thinking and the other blocks in the chat. |
| `surface-variant` | Raised controls and your own messages: fields, chips, buttons, the date separator and the selected row of a list. |
| `surface-nested` | Code and command output in the chat and a block inside another block, a tone between surface and surface-variant. |
| `float` | Menus, popovers and floating cards. |
| `on-surface-variant` | Secondary text and icons: summaries, captions, inactive icons. |
| `faint` | The faintest text and marks: placeholders, timestamps and hints. |
| `hover` | The tint under the pointer on rows and buttons. Computed from `on-background` when left out. |
| `shadow` | The shadow under floating surfaces. |
| `shadow-soft` | The shadow under raised controls. |
| `outline` | Visible borders and strokes, such as outlined buttons. |
| `outline-variant` | Subtle dividers, the hairline around menus and media, and the fill of the selected segment in a switch, under `on-background` text. |
| `error` | Error text and the ring of a field in error. |
| `on-accent` | Text and icons on accent and danger buttons, kept while it reaches 4.5:1 on them; otherwise the app takes `on-background`, `background`, black or white, the first that does. |
| `scrollbar` | The scrollbar thumb. Computed from `on-background` when left out. |
| `scrollbar-hover` | The scrollbar thumb under the pointer. Computed from `on-background` when left out. |
| `red` | Errors, danger buttons, deleted files, a context or plan limit nearly used up, the Bypass permissions mode and the caution alert in Markdown. |
| `red-bg` | The tint behind removed lines in a diff and behind failed output. Computed from `red` when left out. |
| `green` | Success, online dots, an idle chat, new files, the Accept edits mode and the tip alert in Markdown. |
| `green-bg` | The tint behind added lines in a diff. Computed from `green` when left out. |
| `blue` | Information notices, compacting, Plan mode, modified files, diff hunk headers and the note alert in Markdown. |
| `blue-bg` | The tint behind a diff's hunk headers. Computed from `blue` when left out. |
| `yellow` | The spinner of a chat retrying a request, degraded service status, warning lines in the server log and the warning alert in Markdown. |
| `orange` | Warnings, a chat waiting for you, an interrupted turn, the notice of a request being retried, a plan limit running low, a signed-out account, a network without internet and the Don't ask mode. |
| `cyan` | The Auto permission mode. |
| `purple` | A chat being renamed, a commit message being written and the important alert in Markdown. |
| `gray` | The Default permission mode, a chat opened from the trash and a service status that could not be read. |
| `logo` | The tile of the CConnect logo, always dark: in a light theme a dark tone that fits its palette, never white. |
| `logo-ring` | The faint full circle inside the logo, a tone between logo and logo-mark. |
| `logo-mark` | The C and the prompt of the logo, in strong contrast with logo. |

---

## Terminal palettes

`terminal/midnight.json` takes a `name` and its `colors`: `background`, `foreground`, and the
sixteen ANSI colours `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white` and their
`bright-` versions.

## Syntax colours

`syntax/midnight.json` is a VS Code colour theme: its `tokenColors` (or `settings`), an optional
`colors` object and a `name`. Any theme exported from VS Code works as it is, and a theme of the pack
picks it by id in its `syntax` field.

## Accents

`accents.json` is a list of accents for the accent picker:

```json
[
  { "name": "Ocean", "color": "#1e88e5" },
  { "name": "Coral", "color": "#ff6f61" }
]
```

## Fonts

A font goes in `fonts/<kind>/<family>/<file>`, where the kind is `text`, `mono`, `symbols` or
`emoji`, the folder's name is the family the app shows, and the files are `woff2`, `woff`, `ttf` or
`otf`. Several files in one folder make the weights and styles of one family.

## Chat backgrounds

Each image in `backgrounds/` (`png`, `jpg`, `webp`, `gif`, `avif` or `svg`) is a background. A JSON
with the same name sets how it shows:

```json
{ "name": "Aurora", "fit": "cover", "opacity": 60, "brightness": 90, "blur": 0, "saturation": 100, "x": 50, "y": 50 }
```

| Field | Range |
|---|---|
| `fit` | `cover`, `contain` or `tile`, which repeats the image at its own size |
| `opacity` | 0 to 100 |
| `brightness` | 0 to 180 |
| `blur` | 0 to 20 |
| `saturation` | 0 to 200 |
| `x`, `y` | 0 to 100, where a `cover` image is anchored |

---

## Limits

A pack can be up to 500 MB, counting what its files take once unzipped. The app reads it whole
before installing, so a lighter pack also installs faster on a phone.

## Build it

Zip the contents of the folder, so that pack.json is at the root of the zip, and rename the file to
`.ccpack`. Claude can also write one for you: it checks the pack with the server's own rules and
leaves it in the server's library, where **Packs** offers to install it.

## Share it

- **As a file.** Open it from the chat, from Shared, from your desktop or from any app on Android, or
  use **Packs → Import pack**.
- **As a link.** Host it anywhere over https and link to
  `cconnect://install/pack?url=https://…/midnight.ccpack`, see [[Install links]].
