# Contributing to Audiio

Thank you for your interest in contributing to Audiio! This guide will help you get started.

## Ways to Contribute

- **Bug Reports**: Found a bug? Open an issue with steps to reproduce
- **Feature Requests**: Have an idea? Open an issue to discuss it
- **Code**: Fix bugs or implement features via pull requests
- **Documentation**: Improve or add to our docs
- **Addons**: Build and share addons for the community

## Development Setup

See [Development Setup Guide](docs/development/setup.md) for detailed instructions.

### Quick Start

```bash
# Clone the repository
git clone https://github.com/magicianjarden/audiio-official.git
cd audiio-official

# Install dependencies
npm install

# Build all packages
npm run build:all

# Run the desktop app in development
npm run dev
```

## Project Structure

```
audiio-official/
├── packages/
│   ├── core/          # Core types and services
│   ├── sdk/           # SDK for building addons
│   ├── ui/            # React UI components
│   ├── desktop/       # Electron desktop app
│   ├── mobile/        # Mobile server and web app
│   ├── relay/         # P2P relay server
│   ├── icons/         # Icon library
│   └── landing/       # Landing page
├── addons/            # Built-in addons
├── docs/              # Documentation
└── ...
```

## Pull Request Process

### Before You Start

1. Check existing issues and PRs to avoid duplicates
2. For large changes, open an issue first to discuss
3. Fork the repository and create a feature branch

### Making Changes

1. Create a branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following our coding standards

3. Test your changes:
   ```bash
   npm run build:all
   npm run dev  # Test in the app
   ```

4. Commit with a clear message:
   ```bash
   git commit -m "feat: add feature description"
   ```

### Submitting

1. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

2. Open a Pull Request against `main`

3. Fill out the PR template with:
   - Description of changes
   - Related issues
   - Testing done
   - Screenshots (for UI changes)

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Define types explicitly (avoid `any`)
- Export types from appropriate modules

### React Components

- Use functional components with hooks
- Use Zustand for state management
- Follow existing component patterns

### Styling

- Use CSS modules or the existing styling patterns
- Follow the theming system for colors
- Ensure dark mode compatibility

### Commits

We use conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting)
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance tasks

## Building Addons

See our [Addon Development Guide](docs/development/addons/README.md) for building custom addons.

### Addon Types

- **Metadata Provider**: Provide track, artist, album info
- **Stream Provider**: Provide audio streams
- **Lyrics Provider**: Provide synced or plain lyrics
- **Audio Processor**: Process audio (karaoke, stems)
- **Scrobbler**: Track listening history

## Getting Help

- **Documentation**: Check [docs/](docs/) first
- **Issues**: Search existing issues
- **Discussions**: Use GitHub Discussions for questions

## Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
