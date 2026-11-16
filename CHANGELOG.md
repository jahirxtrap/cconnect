- Devices, a new panel after Databases, lists the Android phones, tablets and emulators the server reaches with adb: plugged in over USB, paired over Wi‑Fi with a QR code or a pairing code, or started from the machine's Android SDK, and a paired phone connects again on its own whenever it shows up on the network, at whatever address it got
- Tapping a device mirrors its screen live, with touch, keyboard, the navigation and volume keys, rotation, screenshots to the shared folder, APK installs from the server's files or from this device, and its logcat inside the panel
- The server uses the adb it has or downloads adb and scrcpy's server with one tap, the panel opens with the security key like Databases, and Claude gets the same devices as tools in turns sent with it: list, screenshot, shell, logcat, tap and type, install and manage
- Each environment's row has Show QR, and so does the Local server dialog while the server is exposed: scan it from Environments on another device to add the environment there
- A plugin whose marketplace has a newer version shows an Update tag with the version in its detail, and Update runs on the server: the card says queued, updating or failed while the rest of the screen stays usable, on every device at once
- Changing the model or the permission mode no longer restarts Claude Code for the next turn
- An emulator started from Devices shows under Emulators in Processes with its name and Stop
- `cconnect expose` opens the Tailscale app on Windows and macOS when it is not running, instead of asking you to sign in
- A plugin the CLI does not load because it needs a newer Claude Code says so on the Claude screen instead of showing as active, and Always allow in a permission is offered only when there is a rule to save
- A message another Claude session sends to a chat shows in it, live and when you come back, a setting changed on one device reaches the others as it happens, a typed command keeps the files you attached in the composer, Copy and Share on a reply leave its suggestions out, running tasks show a play icon, Databases asks for the key again after a refused one instead of staying locked, and on Android a PDF opens from the top of the page instead of centred

> [!NOTE]
> The web version is available at https://app.cconnect.dev/
