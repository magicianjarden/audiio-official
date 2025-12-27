# Changelog

All notable changes to Audiio will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive documentation for users and developers
- P2P mobile remote access via self-hosted relay
- End-to-end encryption for mobile connections
- Memorable connection codes (e.g., "SWIFT-EAGLE-42")

### Changed
- Improved mobile web interface
- Enhanced discovery page sections

### Fixed
- P2P connection stability improvements

## [0.1.0] - 2024-12-27

### Added

#### Core Features
- Music streaming via addon system
- Multi-source metadata aggregation
- Library management (likes, dislikes, playlists)
- Download for offline listening
- Local music file support

#### Player
- Full playback controls
- Queue management
- Shuffle and repeat modes
- Volume normalization
- Crossfade support
- Gapless playback

#### Discovery
- Personalized recommendations
- Quick picks
- Weekly rotation
- "Because you like" suggestions
- Trending tracks
- New releases

#### Addons
- Addon SDK for developers
- Built-in metadata providers
- Stream providers
- Lyrics providers
- Karaoke mode (stem separation)
- Scrobbling support

#### Mobile Remote
- Remote control from phone
- Real-time playback sync
- Library browsing
- Queue management
- Local network support
- P2P via relay server

#### Themes
- Light and dark modes
- Custom theme editor
- Dynamic album art colors
- Accent color customization

#### Lyrics
- Synced lyrics display
- Translation support
- Multiple provider fallback

#### Statistics
- Listening history
- Play counts
- Top artists/tracks
- Scrobbling integration

### Technical
- Electron-based desktop app
- React UI with Zustand state management
- SQLite local database
- Fastify mobile server
- TypeScript throughout
- Monorepo structure with Turborepo

## Version History

### Version Numbering

- **Major (X.0.0)**: Breaking changes, major new features
- **Minor (0.X.0)**: New features, non-breaking changes
- **Patch (0.0.X)**: Bug fixes, minor improvements

### Release Cadence

- **Stable releases**: As needed for significant updates
- **Patch releases**: For critical bug fixes
- **Beta releases**: For testing new features

## Upgrade Guide

### From 0.x to 1.0

When version 1.0 is released:
- Review breaking changes in this changelog
- Backup your library before upgrading
- Some addons may need updates

## Links

- [GitHub Releases](https://github.com/magicianjarden/audiio-official/releases)
- [Documentation](docs/README.md)
- [Contributing Guide](CONTRIBUTING.md)

