# AI-Browser

A powerful desktop application built with Tauri that provides a unified interface for interacting with multiple AI chat services. Designed for users who work with multiple AI models simultaneously, featuring a sophisticated Monaco Editor integration for enhanced text editing capabilities.

![aib](https://github.com/user-attachments/assets/dd609be0-7aa4-4976-b174-8b4e0cbbe761)

https://github.com/Jun-Murakami/AI-Browser/assets/126404131/c39f63ef-11d4-4745-ba53-a6c2c03bfad8

## Features

- **Multi-AI Service Support**: Seamlessly interact with multiple AI services including:
  - ChatGPT
  - Google Gemini
  - Anthropic Claude
  - Moonshot Kimi
  - DeepSeek
  - Grok
  - Meta Muse
  - Nani !?
  - Perplexity
  - Genspark

- **Integrated Terminal Support**: Use CLI-based AI agents alongside chat interfaces:
  - Built-in terminal emulator with up to 3 instances
  - Seamlessly integrate CLI tools like Claude Code, Gemini CLI, Codex CLI
  - Terminal tabs appear alongside chat service tabs
  - Full support for dark/light theme switching
  - Drag and drop tab reordering for both chat and terminal tabs
  - Toggle terminal visibility just like chat services

- **Advanced Editor Integration**:
  - Powered by Monaco Editor (VS Code's editor)
  - Up to 5-way vertical split editing
  - Syntax highlighting for multiple programming languages
  - Customizable font size and theme settings

- **Efficient Workflow Features**:
  - Send prompts to multiple AI services simultaneously
  - Bulk send feature to broadcast prompts to all active services at once
  - Maintain and access prompt history
  - Quick prompt reuse from history
  - Drag and drop text manipulation
  - Dark/Light mode support

- **Browser Integration**:
  - Dedicated tabs for each AI service
  - Individual service reload options
  - URL tracking for each service
  - Customizable tab visibility
  - Selective service activation/deactivation

- **Keyboard Shortcuts**:
  - Quick navigation between tabs
  - Efficient prompt management
  - Editor manipulation shortcuts
  - History navigation

## Screenshots

![sc1](https://github.com/Jun-Murakami/AI-Browser/assets/126404131/c0fc5156-9c70-4290-ba5d-51b110431048)
![sc2](https://github.com/Jun-Murakami/AI-Browser/assets/126404131/bcf36152-35e4-40d2-a4f3-2f71f1ad1c99)
![sc3](https://github.com/Jun-Murakami/AI-Browser/assets/126404131/8f26a02a-9053-41d9-ad03-14cca7733612)

## Installation

1. Download the latest release from the [Releases](https://github.com/Jun-Murakami/AI-Browser/releases) page
   - Windows: `AI-Browser-<version>-setup_win_x64.msi`
   - macOS (Apple Silicon / Intel): `AI-Browser-<version>_mac_universal.dmg`
2. Install the application following the standard installation process for your operating system
3. Launch the application

The app updates itself from the Releases page. Versions up to v1.7.2 were built with Electron; v1.7.2 users are offered the update to the Tauri version, and your settings, prompt history and Nani! history are carried over. On Windows, the app offers to uninstall the old Electron version on first launch.

> **Linux:** builds of the Tauri version are not available yet. v1.7.2 (`.AppImage` / `.deb`) remains available on the Releases page.

### Verifying Downloads

Each release binary is published with its own SHA-256 checksum file (`<filename>.sha256`), and with a detached GPG signature (`<filename>.sha256.asc`) when it was built on a machine with the signing key. Windows installers are also Authenticode-signed, and the macOS app is signed and notarized. The signing key's public part is included in this repository as [`ai-browser-public-key.asc`](ai-browser-public-key.asc).

```bash
# Import the public key (first time only)
gpg --import ai-browser-public-key.asc

# Example (replace the filename with the one you downloaded)
FILE="AI-Browser-2.0.0_mac_universal.dmg"

# Verify the checksum file is genuinely signed by the developer (authenticity)
gpg --verify "${FILE}.sha256.asc" "${FILE}.sha256"

# Verify the downloaded binary is intact (integrity)
sha256sum -c "${FILE}.sha256"
```

Signing key fingerprint:

```
ABDB E9E8 3A2E 98A3 2988  69EB E8C7 A338 F858 A18F
Jun Takahashi (Jun Murakami App Factory) <app@bucketrelay.com>
```

> **Note for v1.7.2 `.AppImage` users (Linux):** AppImages require FUSE 2 (`libfuse.so.2`), which is not installed by default on recent distributions such as Ubuntu 22.04 and later. If the AppImage does not start, install it first:
>
> ```bash
> # Ubuntu 22.04 / Debian 12
> sudo apt install libfuse2
> # Ubuntu 24.04 and later / Debian 13 and later
> sudo apt install libfuse2t64
> # Fedora
> sudo dnf install fuse-libs
> ```
>
> Alternatively, run it without FUSE: `./ai-browser-<version>_linux_amd64.AppImage --appimage-extract-and-run`

## Usage

1. **Editor Management**:
   - Use the split icons at the top to divide the editor
   - Each split can contain different text
   - Use the syntax highlighting dropdown to select appropriate language

2. **AI Service Interaction**:
   - Select the desired AI service tab or terminal tab
   - Type or paste your prompt in the editor
   - Click "Send" to send to the current service
   - Use the "All" button to broadcast your prompt to all active services simultaneously (chat services only)
   - Enable/disable specific services or terminals using the settings icon in the tab bar
   - For terminal tabs, input is sent directly to the terminal emulator

3. **History Management**:
   - Access previous prompts from the history dropdown
   - Use up/down arrows or keyboard shortcuts to navigate history
   - Delete individual history items as needed

4. **Customization**:
   - Toggle dark/light mode
   - Adjust font size
   - Show/hide AI service tabs
   - Resize the browser/editor split

## Keyboard Shortcuts

- `Ctrl/Cmd + Enter`: Send to current AI service
- `Ctrl/Cmd + S`: Save to history
- `Ctrl/Cmd + Shift + C`: Copy to clipboard
- `Ctrl/Cmd + Backspace`: Clear editor
- `Ctrl/Cmd + ↑/↓`: Navigate history
- `Ctrl + Tab`: Switch between AI services and terminals

## Development

Requirements: Node.js 22+, Rust (stable), and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform (WebView2 is preinstalled on Windows 10/11; Xcode Command Line Tools on macOS).

```bash
# Clone the repository
git clone https://github.com/Jun-Murakami/AI-Browser.git

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build an (unsigned) installer
npm run build
```

Release builds are signed and published with `build_macos.zsh` and `build_windows_release.ps1` (see [docs/tauri-release.md](docs/tauri-release.md), in Japanese).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT License](LICENSE)

## More Information

For Japanese users: https://note.com/junmurakami/n/n5d674f5977e6
