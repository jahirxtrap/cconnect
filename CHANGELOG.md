- A terminal opens beside the chat: shells on the machine running the backend, each in its own tab, and the SSH hosts you saved, all kept running on the server so you find them where you left them from any device
- Claude can open a shell and run a command in it when you let it, behind the same key that unlocks the terminal for you
- Chats can run on a model of your own, from an account pointing at any provider that speaks the Anthropic API, be it Ollama on your machine or a gateway in front of hundreds of models
- A provider account takes the token, API key or header it asks for, can be edited when any of that changes, and travels between backends like the rest
- The quick chat now reaches the same built-in tools as the main chat, so asking it what your plan is spending draws the bars instead of describing them
- A message sent from another Claude session arrives as its own block with the sender's name, instead of raw markup in the middle of the conversation
- Signing in to the primary account works again, and secondary accounts can be renamed and deleted
- Horizontal lists no longer show a scrollbar on touch, where it never did anything, while tables, code blocks and diffs keep theirs
- Smaller fixes across both apps: the chat panels remember their width, the transfers panel stays out of the terminal's way, the days a chat is kept accepts any number, and blocks that opened onto an empty gap now stay shut

> [!NOTE]
> The web version is available at https://cconnect.pages.dev/  
> The Tauri web version is available at https://cconnect-tauri.pages.dev/
