# Lamp Desktop

**Lamp Desktop** is the Mac and PC app for [Lamp](https://github.com/thebreadcat/lamp) — a private, local-first AI assistant for your home. It runs entirely on your computer: your chats, apps, and data stay on your machine.

This repo is the **desktop shell** (installer, setup, and window). The Lamp experience itself is the same PWA you’d run in a browser — calendar, chat, mini-apps, family accounts — packaged so it feels like a normal app.

## What you get

- **One app icon** — open Lamp from the dock or Start menu  
- **Automatic first-time setup** — checks your Mac/PC, installs Ollama if needed, downloads an AI model that fits your RAM, and connects everything  
- **Menu bar / tray** — Lamp keeps running in the background; quit from the tray when you’re done  
- **No cloud account required** — works offline on your LAN once setup finishes (you still choose your own local AI via Ollama)

Lamp Desktop does **not** replace the [Lamp](https://github.com/thebreadcat/lamp) project; it wraps it for people who don’t want to use Terminal or `python3 lamp.py`.

## Download

Installers for **macOS**, **Windows**, and **Linux**:

**[github.com/thebreadcat/lamp-ai-desktop/releases](https://github.com/thebreadcat/lamp-ai-desktop/releases)**

| Platform | Installer |
|----------|-----------|
| Mac (Apple Silicon) | `Lamp-*-arm64.dmg` |
| Mac | `Lamp-*-mac.zip` |
| Windows | `Lamp Setup *.exe` |
| Linux | `.AppImage` or `.deb` |

### First launch

1. Install and open **Lamp**.  
2. A short setup screen runs once (installing Ollama and downloading an AI model can take **5–20 minutes** on first run).  
3. Create your account in the app and start chatting.

Your data lives in the usual Lamp places: `~/.workshop/` (settings and database) and `~/workshop-apps/` (built apps). Reinstalling the desktop app does not delete them.

## macOS: “damaged” or “can’t be opened”

**The download is almost certainly not broken.** Test builds are **not signed** with an Apple Developer certificate yet, so macOS Gatekeeper often blocks them and shows **“damaged”** or **“can’t be opened”** — especially right after downloading from GitHub.

Try this:

1. **Remove the quarantine flag** (Terminal):

   ```bash
   xattr -cr ~/Downloads/Lamp-*.dmg
   ```

   Then open the DMG again and drag **Lamp** to Applications.

2. If the **app** still won’t open after installing:

   ```bash
   xattr -cr /Applications/Lamp.app
   ```

3. Or: **Right-click** `Lamp.app` → **Open** → **Open** again (confirms you trust the app once).

We’ll add proper Apple signing and notarization in a future release so this step goes away. If problems persist after `xattr`, [open an issue](https://github.com/thebreadcat/lamp-ai-desktop/issues) with your macOS version.

## Windows & Linux notes

- **Windows:** SmartScreen may warn on first run; choose “More info” → “Run anyway” for unsigned test builds.  
- **Linux:** AppImage may need `chmod +x`; `.deb` installs like any other package.

## Requirements

- **macOS 12+** (Apple Silicon builds are arm64; Intel Macs need an x64 build when we publish one)  
- **Windows 10+** or **Linux** (64-bit)  
- Internet on **first setup only** (Ollama + model download)  
- Enough disk space for an AI model (roughly **2–5 GB** depending on model)

## Privacy

Setup and chat run **locally**. Lamp Desktop installs [Ollama](https://ollama.com) on your machine to run models; it does not send your conversations to Lamp’s servers (there are none for chat).

## For developers

Building from source, CI, and release process: **[DEVELOPING.md](DEVELOPING.md)**

## License

[Lamp License](LICENSE) — same terms as Lamp.
