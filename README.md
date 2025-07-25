# Electron API Key Manager

A secure, native macOS application for managing API keys from various platforms. Built with Electron, TypeScript, and modern security practices.

## Features

- 🔐 **Secure Storage**: API keys stored in macOS Keychain with encryption
- 🖥️ **Native macOS UI**: Modern, native-looking interface
- 🔍 **Quick Search**: Fast search and filtering of API keys
- 📋 **Copy to Clipboard**: One-click copying with auto-clear functionality
- 🏷️ **Organization**: Categorize and tag your API keys
- 🔑 **Biometric Security**: Touch ID/Face ID authentication support
- 🌙 **Dark Mode**: Full dark mode support
- 📱 **Platform Templates**: Pre-configured templates for popular services
- 🔒 **Audit Logging**: Track access and modifications
- 📤 **Import/Export**: Secure backup and migration tools

## Tech Stack

- **Framework**: Electron with TypeScript
- **Build Tool**: electron-vite for fast development
- **Security**: macOS Keychain integration via keytar
- **Storage**: electron-store for app preferences
- **UI**: Modern web technologies with native macOS styling

## Development

### Prerequisites

- Node.js 18+ 
- macOS for development and testing
- Apple Developer account (for code signing)

### Getting Started

```bash
# Clone the repository
git clone <repository-url>
cd electron-api-key-manager

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Package for distribution
npm run dist
```

### Project Structure

```
src/
├── main/           # Main process (Electron backend)
├── preload/        # Preload scripts (secure IPC bridge)
└── renderer/       # Renderer process (UI)
```

### Security Considerations

This application follows Electron security best practices:

- Context isolation enabled
- Node.js integration disabled in renderer
- Secure IPC communication via preload scripts
- Content Security Policy (CSP) implemented
- API keys stored in macOS Keychain
- No sensitive data in localStorage or files

## Building for Distribution

### macOS

```bash
# Build for current architecture
npm run build:mac

# Build for ARM64 (Apple Silicon)
npm run build:mac-arm64

# Build for x64 (Intel)
npm run build:mac-x64
```

### Code Signing & Notarization

Set up environment variables for automatic code signing:

```bash
export APPLE_ID="your-apple-id@example.com"
export APPLE_ID_PASSWORD="app-specific-password"
export CSC_IDENTITY_AUTO_DISCOVERY=true
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Follow TypeScript and ESLint conventions
4. Add tests for new features
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Security

For security issues, please email security@yourproject.com instead of creating public issues. 