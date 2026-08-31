- The models, their effort levels and the slash commands are read from Claude Code itself, so a new model or a new command shows up without updating the app
- Typing / opens the command list, tab fills in the closest match before it cycles, and the list stays out of the way while you write the arguments
- The context ring knows the real window of every model, and the style Claude answers in is chosen next to the model
- A subagent now closes with what it did — whether it finished, how long it took and what it spent — both while it runs and when the chat is reopened
- Thinking blocks can report the tokens they spent, off by default and switchable for a single chat from the visibility menu
- One of your hooks failing now says so in the chat instead of failing in silence
- Settings gained a Chats section, holding the trash and the days a chat is kept before Claude Code deletes it, which applies to every account at once
- Deleted chats are kept outside Claude Code's own folder, where its cleanup can no longer reach them
- Renaming or recolouring a chat no longer sends it to the top of the list, and the list counts only the chats you can actually open
- Asking about usage warns when Claude says the limit is close instead of at a fixed number, and shows what extra usage has spent when the account has it turned on
- MCP servers and plugins added on one account are there on all of them, and you choose which built-in tools Claude gets in every chat
- Smaller fixes across both apps: selected text and its colour, the progress rings and bars, figures that now read 1M instead of 1000K, and a few blocks that could be selected by accident

> [!NOTE]
> The web version is available at https://cconnect.pages.dev/  
> The Tauri web version is available at https://cconnect-tauri.pages.dev/
