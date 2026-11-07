## Shared

The shared folder grew into a full file manager. Browse `~/.cconnect/data/shared/` from
the app: upload files (with per-file progress you can cancel), create folders,
rename, sort by name/date/type/size, and long-press (or right-click on desktop)
to multi-select — then move, copy, share, delete, save to Downloads, or copy a
file's PC path. Open a file to preview it in place — images with zoom, video,
audio, PDF, SVG, Markdown, source code, HTML and database files — and delete it
right from the preview if it's no longer needed.

With the side panel open the preview lands there instead of covering the chat,
so you can watch a file while Claude rewrites it — it reloads on its own when it
changes on disk. A button blows it up to full screen, and closing it gives you
back the panel you had. The same goes for a file Claude links in the chat: one
tap opens it, and the rest of the actions stay in the viewer's menu.

Each project keeps its own folder inside it: what you upload from a chat and what
Claude writes for you land there, so with a project pinned you see that project's
files and nothing else. The three-dot menu filters what to show — images, video,
audio, PDF, Markdown, code, archives, packs.

It works in both directions: drop a file into `~/.cconnect/data/shared/` on the PC — or
just ask Claude to write one there — and you get a tap-to-download link in the
chat, served over the same authenticated connection.

## Project files

The side panel also browses the project of the chat beside it, or another you
pick. Search the tree by
typing a few letters of any path, and open a file read-only while Claude edits
it. Git colours the tree — added, modified, untracked — and inside a file the
change is painted on the numbered lines themselves, with buttons to walk from
one to the next. An eye in the file's header moves it to the centre pane, where
it takes the place of the chat, and from either side it expands to the whole
window. A toggle folds the tree down to only what changed. An archive opens in
the tree like a folder, and a file inside it previews without extracting
anything. From a file you can
mention its full path in the chat or copy it. What git ignores stays hidden
until you unlock it with the security key.

With that changed view open, a bar at the bottom carries the branch, how far
ahead or behind it is, and everything a commit takes: tick the files that go in,
write the message — or have Claude write it from what you marked, following a
prompt of your own kept in the Claude screen — choose the author among the
identities the repository knows, amend the last commit, and pull or push. The
same bar opens the branch's history: the commits behind it, newest first,
loading more as you reach the end. Every repository under the project is listed,
not only the one at its root, so each file is committed to the one it belongs
to.

Throwing away the changes of what you ticked, pushing a branch that has no
remote yet, and forcing a push are each one confirmation away. The security key
gates all of it: without it the bar shows the branch you are on and nothing
else.

## Databases

The Databases panel, beside the ACP agents in the panel bar, keeps connections
to over fifty engines: SQLite, PostgreSQL, MySQL, MariaDB, SQL Server, Oracle and
DuckDB, the databases that speak their protocol (CockroachDB, YugabyteDB, TiDB,
Redshift and more), the warehouses (Snowflake, BigQuery, Databricks, ClickHouse,
Athena, Trino) and the rest of SQLAlchemy's dialects. **Custom** takes any URL
SQLAlchemy understands, with the pip packages its driver needs. A
file database takes its path on the server; the others take a host, a port, the
database, a user and **Parameters**, the options its URL carries (one
`key=value` per line, such as Snowflake's warehouse), and reach it through an SSH
tunnel when only another machine can, with the server's own ssh client and a key
or an agent. The password stays on the server, even when it was typed inside a
URL: the app only learns that there is one, and leaves it untouched unless you
type a new one. **Test connection** answers with
the server's version before you save, and **Read only** keeps every query in a
transaction that is rolled back and hides the row editor.

Each engine needs its driver on the server. The plug in the panel's header
lists the drivers, each with the engines it serves, installs one with a tap and
uninstalls it again; a connection whose driver is missing says so in the tree
and offers the install right there. Installing a driver never changes the
server's own packages: one that needs other versions of them fails with the
reason instead.

The tree opens a connection into its SQL console and its schemas, tables and
views, the way an IDE does. A PostgreSQL or SQL Server connection that names no
database lists every database on the server the user can open, each with its own
console, and reads one only when it is expanded; without a database, PostgreSQL
connects to `postgres` (or its family's own, such as CockroachDB's `defaultdb`). A table opens like a file: over the panel, or in the
centre pane with the eye, and from either side it expands to the whole window.
Rows come in a paged grid (25 to 1,000 a page) with the row number and the
primary key marked; a column header sorts by it, and a WHERE bar filters with
any condition the database understands. **Structure** shows the columns with
their types, defaults and comments, the foreign keys, the indexes and a view's
definition. A row opens in a form with a field per column, a NULL toggle where
the column allows it, and buttons to duplicate or delete it; the add button
fills a new one, with the database's defaults left in place. Tables without a
primary key, views and read-only connections open the same form to read.

The console runs one statement or several separated by semicolons, with Ctrl +
Enter (⌘ + Enter on a Mac), a shortcut you can change with the others. A query shows its rows (the first 1,000) and how long
it took; anything else shows the rows it changed. Its text and last result stay
per connection and database while the app is open. Tables export to CSV or to SQL inserts in
the database's own dialect, and a query to CSV; the file is written to the
server's shared folder and downloads like any other.

A database file opens the same tree in the preview of the shared folder and of
Project files, with its console, tables and views, without saving a connection:
SQLite (`.db`, `.sqlite`, `.sqlite3`, `.db3`, `.s3db`, `.sl3`, `.sqlitedb`,
`.sdb`, GeoPackage `.gpkg` and MBTiles `.mbtiles`) and DuckDB (`.duckdb`, `.ddb`).
The file's header picks the engine, so a DuckDB file named `.db` opens as DuckDB
and a `.db` that is no database shows as a binary file. The server opens the file
for each query and closes it after, so it can still be moved or deleted while it
is open.

The security key gates every change: saving or deleting a connection, testing
one, editing rows, any SQL that writes and installing a custom URL's packages.
Reading needs nothing. Claude gets the same panel as tools: it reads schemas and
runs queries on its own, installs the drivers a connection needs, and with the
key creates, edits, tests and deletes connections and runs SQL that writes.

## Notes

A built-in Markdown editor keeps as many notes as you need, shown as a list or
as cards and searchable across all of them. A bar formats as you write (tasks you
tick, bullets, headings, bold, code) with undo and redo, the preview renders the
note as Markdown, and any of them can be duplicated, saved, exported or shared as
a file. What you type stays between sessions. Syntax highlighting covers
everything Shiki knows, here and anywhere else code shows up.
