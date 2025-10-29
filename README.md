# AI-Browser

A powerful desktop application built with Electron that provides a unified interface for interacting with multiple AI chat services. Designed for users who work with multiple AI models simultaneously, featuring a sophisticated Monaco Editor integration for enhanced text editing capabilities.

![aib](https://github.com/user-attachments/assets/dd609be0-7aa4-4976-b174-8b4e0cbbe761)

https://github.com/Jun-Murakami/AI-Browser/assets/126404131/c39f63ef-11d4-4745-ba53-a6c2c03bfad8

## Features

- **Multi-AI Service Support**: Seamlessly interact with multiple AI services including:
  - ChatGPT
  - Google Gemini
  - Google AI Studio
  - Anthropic Claude
  - DeepSeek
  - Grok
  - Nani !?
  - Phind
  - Perplexity
  - Genspark
  - Felo
  - JENOVA
  - Cody

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
2. Install the application following the standard installation process for your operating system
3. Launch the application

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

```bash
# Clone the repository
git clone https://github.com/Jun-Murakami/AI-Browser.git

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT License](LICENSE)

## More Information

For Japanese users: https://note.com/junmurakami/n/n5d674f5977e6
