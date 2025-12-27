# Security Policy

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in Audiio, please report it responsibly.

### How to Report

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please report security issues through one of these channels:

1. **GitHub Security Advisories** (Preferred)
   - Go to the [Security tab](https://github.com/magicianjarden/audiio-official/security)
   - Click "Report a vulnerability"
   - Fill out the form with details

2. **Private Contact**
   - If GitHub Security Advisories aren't available, contact the maintainers privately
   - Include "[SECURITY]" in your message subject

### What to Include

When reporting a vulnerability, please include:

- **Description**: Clear description of the vulnerability
- **Impact**: What could an attacker do with this?
- **Steps to Reproduce**: How to trigger the vulnerability
- **Affected Versions**: Which versions are affected
- **Possible Fix**: If you have suggestions for fixing

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Fix Development**: Depends on severity
- **Disclosure**: Coordinated with reporter

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

Only the latest minor version receives security updates.

## Security Measures

### Desktop Application

- **Electron Security**: Follows Electron security best practices
- **Context Isolation**: Renderer processes are isolated
- **No Remote Code**: No execution of remote code
- **Sandboxed Addons**: Addons run with limited permissions

### Mobile Remote

- **E2E Encryption**: All P2P data is end-to-end encrypted
- **NaCl Cryptography**: Industry-standard X25519 + XSalsa20-Poly1305
- **No Cloud Storage**: Music data never leaves your network
- **Device Authorization**: Explicit approval for new devices

### Data Storage

- **Local Storage**: All data stored locally, not in cloud
- **SQLite**: Standard database with no network access
- **Settings**: Stored in user-accessible location

### Network

- **HTTPS**: All external API calls use HTTPS
- **WebSocket Security**: Secure WebSocket for real-time features
- **Relay Server**: Only routes encrypted messages, cannot read them

## Best Practices for Users

### General

- Keep Audiio updated to the latest version
- Only install addons from trusted sources
- Review addon permissions before enabling
- Regenerate mobile connection codes periodically

### Mobile Remote

- Use P2P mode when on untrusted networks
- Revoke devices you no longer use
- Don't share your connection code publicly

### Addons

- Verify addon source before installing
- Check addon permissions
- Keep addons updated
- Remove unused addons

## Security Features

### Authentication

- **Connection Codes**: Memorable, time-limited codes
- **Device Authorization**: Manual approval for new devices
- **Session Management**: Configurable session timeouts

### Encryption

- **Algorithm**: NaCl (TweetNaCl.js)
- **Key Exchange**: X25519 Diffie-Hellman
- **Symmetric**: XSalsa20-Poly1305
- **Forward Secrecy**: New keys per session

### Audit Logging

- Connection attempts logged
- Device authorizations logged
- Logs stored locally only

## Known Security Considerations

### Local Network Mode

When using local network mode (HTTP on LAN):
- Data is not encrypted in transit
- Only accessible on local network
- Suitable for trusted home networks
- Use P2P mode for untrusted networks

### Addon Security

Addons can:
- Access track metadata
- Make network requests
- Store data locally

Addons cannot:
- Access arbitrary files
- Execute system commands
- Access other addons' data

## Vulnerability Disclosure Policy

We follow responsible disclosure:

1. Reporter contacts us privately
2. We acknowledge and investigate
3. We develop and test a fix
4. We release the fix
5. We publicly disclose after users have time to update

We credit reporters unless they prefer anonymity.

## Bug Bounty

Currently, we don't have a formal bug bounty program. However, we deeply appreciate security research and will acknowledge contributors in our release notes.

## Contact

For security matters:
- Use [GitHub Security Advisories](https://github.com/magicianjarden/audiio-official/security)
- For urgent issues, open a private issue on GitHub

Thank you for helping keep Audiio secure!

